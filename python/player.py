#!/bin/python3
from typing import List
from proboj import (
    Client,
    BuyTurn,
    MoveTurn,
    LoadTurn,
    SiphonTurn,
    ShootTurn,
    RepairTurn,
    ShipType,
    Position,
    Turn,
)


class MyClient(Client):
    travelling_back = False
    def turn(self) -> List[Turn]:
        my_ships = self.get_my_ships()
        if not my_ships:
            return []

        turns: List[Turn] = []
        if self.game_map.round == 0:
            turns.append(BuyTurn(ShipType.DRILL_SHIP))

        elif self.game_map.round == 1:
            asteroid = self.game_map.asteroids[67] #ruky hore dole
            smer = asteroid.position.sub(my_ships[1].position).normalize()
            turns.append(MoveTurn(my_ships[1].id, smer.scale(20)))

        if self.game_map.round > 1:
            if not self.travelling_back and my_ships[1].rock > 0:
                turns.append(MoveTurn(my_ships[1].id, my_ships[1].vector.scale(-2)))
                self.travelling_back = True

            if self.travelling_back:
                dist = my_ships[0].position.distance(my_ships[1].position)
                if dist < 25:
                    turns.append(LoadTurn(my_ships[1].id, my_ships[0].id, my_ships[1].rock))

        
        return turns


if __name__ == "__main__":
    client = MyClient()
    client.run()
