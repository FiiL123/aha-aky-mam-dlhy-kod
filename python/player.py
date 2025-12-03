#!/bin/python3
from typing import List
from proboj import *
import math
from enum import Enum



class MyClient(Client):
    my_ships : List['MyShip']= []
    miner_destinations_ids = [List[int]]


    def update_my_ships(self):
        for ship in self.my_ships:
            ship.update()
            if ship.ship == None:
                ship = None

        self.my_ships = [ship for ship in self.my_ships if ship != None]

        for ship in self.get_my_ships():
            for my_ship in self.my_ships:
                if ship.id == my_ship.id:
                    break
            else:
                self.my_ships.append(MyShip(ship.id, self))


    def turn(self) -> List[Turn]:
        self.update_my_ships()
        if not self.my_ships:
            return []

        turns: List[Turn] = []

        if self.game_map.round == 300 and False:
            turns.append(BuyTurn(ShipType.BATTLE_SHIP))

        if self.get_my_mothership().fuel >= 400 and self.get_my_mothership().rock >= 500:
            turns.append(BuyTurn(ShipType.SUCKER_SHIP))
            turns.append(BuyTurn(ShipType.DRILL_SHIP))

        for ship in self.my_ships:
            turns += ship.make_turn()

        return turns
    


class MinerState(Enum):
    AT_MOTHERSHIP = 0
    TRAVELING_TO = 1
    MINING = 2
    TRAVELING_FROM = 3
    UNLOADING = 4
    REFUELING = 5

class MothershipState(Enum):
    IDLE = 0

class FighterState(Enum):
    DEFENDING_MOTHERSHIP = -1

    AT_MOTHERSHIP = 0
    TRAVELING_TO = 1
    AT_DESTINATION = 2

class MyShipType(Enum):
    MINER = 0
    TRANSFER = 1
    FIGHTER = 2
    MOTHER = 3

class MyShip:
    ship = None
    state = None
    destination = None
    id = None
    mothership = None
    client : Client = None
    path = []
    path_back = []

    FIGHTER_FUEL_PER_TRIP = 100
    FIGHTER_RANGE = 500
    MOTHERSHIP_SAFE_RADIUS = 50

    MINER_FUEL_PER_TRIP = 50
    MINE_TO_TRAVEL_RATIO = 3
    MINE_SPEED = 10
    MINER_FREE_MOVEMENT = 1

    def update(self):
        for ship in self.client.game_map.ships:
            if self.id == ship.id:
                self.ship = ship
                break
        else:
            self.ship = None

        self.mothership = self.client.get_my_mothership()


    def __init__(self, id, client : Client):
        self.client = client
        self.client.log("inniting")
        self.id = id
        ship_type = self.client.game_map.ships[id].type

        match ship_type:
            case ShipType.BATTLE_SHIP:
                self.ship_type = MyShipType.FIGHTER
                self.state = FighterState.AT_MOTHERSHIP

            case ShipType.DRILL_SHIP | ShipType.SUCKER_SHIP:
                self.ship_type = MyShipType.MINER
                self.state = MinerState.AT_MOTHERSHIP

            case ShipType.MOTHER_SHIP:
                self.ship_type = MyShipType.MOTHER
                self.state = MothershipState.IDLE

            case ShipType.TANKER_SHIP | ShipType.TRUCK_SHIP:
                self.ship_type = MyShipType.TRANSFER

            case _:
                self.client.log("ERR: something wrong with ship type")
        

        self.mothership = self.client.get_my_mothership()
    

    def make_turn(self) -> list[TurnType]:
        self.ship = self.client.game_map.ships[self.id]
        if self.ship_type == MyShipType.FIGHTER:
            return self.make_turn_fighter()
        elif self.ship_type == MyShipType.MINER:
            return self.make_turn_miner()
        elif self.ship_type == MyShipType.TRANSFER:
            return self.make_turn_transfer()
        elif self.ship_type == MyShipType.MOTHER:
            return self.make_turn_mother()
        else:
            self.client.log("ERR: Ship has no type")
            return []
        

    def make_turn_fighter(self):
        turns : List[TurnType] = []
        match self.state:
            case FighterState.DEFENDING_MOTHERSHIP:
                pass

            case FighterState.AT_MOTHERSHIP:
                self.destination = self.fighter_find_destination()
                turn, _ = self.calculate_path_to_dest(self.destination, self.FIGHTER_FUEL_PER_TRIP)
                self.client.log("bbb", turn)
                turns.append(turn)
                self.state = FighterState.TRAVELING_TO
                
            case FighterState.TRAVELING_TO:
                dist = self.ship.position.distance(self.destination.position)
                if dist <= 25:
                    turns.append(MoveTurn(self.ship.id, self.ship.vector.scale(-1)))
                    self.state = FighterState.AT_DESTINATION

            case FighterState.AT_DESTINATION:
                available_targets = self.fighter_find_targets()
                if len(available_targets) != 0:
                    target = self.fighter_find_best_target(available_targets)
                    turns.append(ShootTurn(self.ship.id, target.id))

            case _:
                self.client.log("ERR: Wrong fighter type")

        return turns
    
    
    def make_turn_miner(self) -> list[TurnType]:
        turns = []
        match self.state:
            case MinerState.AT_MOTHERSHIP:
                if self.ship.fuel < self.MINER_FUEL_PER_TRIP*2:
                    self.state = MinerState.REFUELING
                else:
                    destination = self.miner_find_destination(blacklist = self.client.miner_destinations_ids)
                    turn_to_dest, time_normal = self.calculate_path_to_dest(destination, self.MINER_FUEL_PER_TRIP)
                    
                    path_through_worm, path_back, dist = self.miner_find_destination_worm(blacklist= self.client.miner_destinations_ids) 
                    time_worm = math.ceil(dist/(self.MINER_FUEL_PER_TRIP / 4))



                    if time_worm < time_normal:
                        self.path = path_through_worm
                        self.path_back = path_back
                        self.destination = self.path.pop(0)
                        turn, time_first_dest = self.calculate_path_to_dest(self.destination, self.MINER_FUEL_PER_TRIP / 2)
                        turns.append(turn)
                        self.client.miner_destinations_ids.append(self.path[-1].id)
                    else:
                        self.destination = destination
                        self.path = []
                        self.client.miner_destinations_ids.append(self.destination.id)
                        turns.append(turn_to_dest)
                    
                    self.state = MinerState.TRAVELING_TO

            case MinerState.TRAVELING_TO:
                self.client.log("p", self.ship.id, self.path)
                if len(self.path) > 0:
                    dist = self.client.game_map.wormholes[self.destination.target_id].position.distance(self.ship.position)
                else:
                    dist = self.destination.position.distance(self.ship.position)

                if dist < 25:
                    if len(self.path) == 0:
                        turns.append(MoveTurn(self.id, self.ship.vector.scale(-1)))
                        self.state = MinerState.MINING
                    else:
                        
                        self.destination = self.path.pop(0)
                        turn, _ = self.calculate_path_to_dest(self.destination, self.MINER_FUEL_PER_TRIP / 2)
                        self.client.log("aaa", turn)
                        turns.append(turn)

                else:
                    correction_vector = self.miner_correction_vector(self.destination)
                    turns.append(MoveTurn(self.id, correction_vector))

            case MinerState.MINING:
                cargo_wanted = self.dist_to_mothership() / (self.MINER_FUEL_PER_TRIP // 2) * self.MINE_SPEED  * self.MINE_TO_TRAVEL_RATIO
                if self.miner_stop_mining(self.destination, cargo_wanted= cargo_wanted, fuel_cost= self.MINER_FUEL_PER_TRIP):
                    self.client.miner_destinations_ids.remove(self.destination.id)
                    
                    if len(self.path_back) > 0:
                        self.destination = self.path_back.pop(0)
                    else:
                        self.destination = self.mothership

                    turn, _ = self.calculate_path_to_dest(self.destination, self.MINER_FUEL_PER_TRIP)
                    turns.append(turn)
                    self.state = MinerState.TRAVELING_FROM
                else:
                    dist = self.destination.position.distance(self.ship.position)
                    if dist > 1:

                        correction_vector = self.miner_correct_position(self.destination)
                        turns.append(MoveTurn(self.id, correction_vector))
                        

            case MinerState.TRAVELING_FROM:
                if len(self.path_back) > 0:
                    dist = self.client.game_map.wormholes[self.destination.target_id].position.distance(self.ship.position)
                else:
                    dist = self.destination.position.distance(self.ship.position)
                
                if dist < 10:
                    if len(self.path_back) == 0:
                        turns.append(MoveTurn(self.id, self.ship.vector.scale(-1)))
                        self.state = MinerState.UNLOADING
                    else:
                        self.destination = self.path_back.pop(0)
                        turn, _ = self.calculate_path_to_dest(self.destination, self.MINER_FUEL_PER_TRIP / 2)
                        self.client.log("ccccc", turn)
                        turns.append(turn)

            case MinerState.UNLOADING:
                if self.ship.type == ShipType.SUCKER_SHIP:
                    turns.append(SiphonTurn(self.id, self.mothership.id, math.floor(self.ship.fuel)))
                else:
                    turns.append(LoadTurn(self.id, self.mothership.id, self.ship.rock))
                self.state = MinerState.REFUELING

            case MinerState.REFUELING:
                turns.append(SiphonTurn(self.mothership.id, self.id, math.ceil(self.MINER_FUEL_PER_TRIP * 2 - self.ship.fuel)))
                self.state = MinerState.AT_MOTHERSHIP

            case _:
                self.client.log("ERR: No state assigned to miner")
        self.client.log(turns)
        return turns
    
    
    def fighter_find_destination(self, blacklist = []):
        all_ships = self.client.game_map.ships
        motherships : list[int] = [mother for mother in all_ships if mother.type == ShipType.MOTHER_SHIP]
        motherships.remove(self.mothership)

        closest = self.find_closest(motherships, blacklist)
        return closest
    
    
    def fighter_find_targets(self):
        all_ships = self.client.game_map.ships
        enemy_ships = [ship for ship in all_ships if ship.player_id != self.ship.player_id and ship.is_alive()]
        ships_in_range = [ship for ship in enemy_ships if self.ship.position.distance(ship.position) <= self.FIGHTER_RANGE]

        ships_outside_mothership = []
        for ship in ships_in_range:
            for mother in all_ships:
                if mother.type == ShipType.MOTHER_SHIP and mother.player_id == ship.player_id:
                    ships_mothership = mother

            if ship.position.distance(ships_mothership.position) > self.MOTHERSHIP_SAFE_RADIUS:
                ships_outside_mothership.append(ship)

        return ships_outside_mothership

    
    def fighter_find_best_target(self, targets : list[Ship]):
        lowest = targets[0]
        lowest_hp = targets[0].health

        for target in targets:
            if target.health < lowest_hp:
                lowest_hp = target.health
                lowest = target

        return lowest


    
    def find_closest(self, objects, blacklist):
        min_dist = self.ship.position.distance(objects[0].position)
        closest = objects[0]
        for ob in objects:
            if ob is None:
                continue

            if ob in blacklist:
                continue

            dist = self.ship.position.distance(ob.position)
            if dist < min_dist:
                min_dist = dist
                closest = ob

        return closest         


    def miner_find_destination(self, blacklist :list[int] = []):
        types = []
        if self.ship.type == ShipType.SUCKER_SHIP: types.append(AsteroidType.FUEL_ASTEROID)
        else: types.append(AsteroidType.ROCK_ASTEROID)

        return self.find_closest_ass(self.ship.id, types= types, blacklist= blacklist)
    
    def miner_find_destination_worm(self, blacklist :list[int] = []):
        worms : list[Wormhole] = self.client.game_map.wormholes            
        types = []
        if self.ship.type == ShipType.SUCKER_SHIP: types.append(AsteroidType.FUEL_ASTEROID)
        else: types.append(AsteroidType.ROCK_ASTEROID)

        smallest_dist = 10000000000000000
        path = [None, None]
        path_back = [None, None]
        for worm in worms:
            ass, dist = self.find_closest_ass_worm(worms[worm.target_id],  types= types, blacklist= blacklist)
            dist += self.ship.position.distance(worm.position)
            if dist < smallest_dist:
                smallest_dist = dist
                path = [worm, ass]
                path_back = [worms[worm.target_id], self.mothership]

        
        return path, path_back, smallest_dist



    def miner_stop_mining(self, asteroid : Asteroid, cargo_wanted = 250, fuel_cost = 50) -> bool:
        if self.client.game_map.asteroids[asteroid.id] is None:
            return True
        if asteroid.size <= 10:
            return True
        if self.ship.type == ShipType.DRILL_SHIP:
            return cargo_wanted <= self.ship.rock
        else:
            return cargo_wanted + fuel_cost <= self.ship.fuel


    def miner_correct_position(self, destination : Asteroid):
        smer = destination.position.sub(self.ship.position).normalize()
        vector = self.ship.vector
        vysledok = smer.sub(vector)
        if vysledok.size() > 1:
            return vector.scale(-1)
        else:
            return vysledok
        

    def miner_correction_vector(self, destination : Asteroid) -> MoveTurn:
        vector = self.ship.vector
        wanted_vector = destination.position.sub(self.ship.position).normalize().scale(vector.size())
        correction_vector = wanted_vector.sub(vector)
        if correction_vector.size() > self.MINER_FREE_MOVEMENT:
            return correction_vector.normalize().scale(self.MINER_FREE_MOVEMENT)
        else:
            return correction_vector

        
    def dist_to_mothership(self):
        return self.mothership.position.distance(self.ship.position)
         

    def make_turn_transfer(self):
        return []
    
    def make_turn_mother(self):
        return []
    
    
    def calculate_path_to_dest(self, destination, fuel_per_trip):

        smer : Position = destination.position.sub(self.ship.position).normalize()
        dist = destination.position.distance(self.ship.position)
        pocet_tahov = math.ceil(dist/(fuel_per_trip / 2))
        sila = dist / pocet_tahov 
        return MoveTurn(self.id, smer.scale(sila).sub(self.ship.vector)), pocet_tahov
    

    def find_closest_ass(self, ship_id, types = [AsteroidType.FUEL_ASTEROID, AsteroidType.ROCK_ASTEROID], blacklist : List[int] = []) -> Asteroid: 
        ship_pos : Position = self.client.game_map.ships[ship_id].position
        asteroids : List[Asteroid]= self.client.game_map.asteroids

        min_dist = 100000000
        closest = asteroids[0]
        for ass in asteroids:
            if ass is None:
                continue
            if ass.type not in types:
                continue
            if ass.id in blacklist:
                continue

            if ass.size <= 10:
                continue

            dist = ship_pos.distance(ass.position)
            if dist < min_dist:
                min_dist = dist
                closest = ass

        return closest   

    def find_closest_ass_worm(self, worm, types = [AsteroidType.FUEL_ASTEROID, AsteroidType.ROCK_ASTEROID], blacklist : List[int] = []) -> Asteroid: 
        worm_pos : Position = worm.position
        asteroids : List[Asteroid]= self.client.game_map.asteroids

        min_dist = 100000000
        closest = asteroids[0]
        for ass in asteroids:
            if ass is None:
                continue
            if ass.type not in types:
                continue
            if ass.id in blacklist:
                continue

            dist = worm_pos.distance(ass.position)
            if dist < min_dist:
                min_dist = dist
                closest = ass

        return closest, min_dist


if __name__ == "__main__":
    client = MyClient()
    client.run()
