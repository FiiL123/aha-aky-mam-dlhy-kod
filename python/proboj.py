import json
import math
import sys
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Union, Dict, Any, TypeAlias


class ShipType(Enum):
    MOTHER_SHIP = 0
    SUCKER_SHIP = 1
    DRILL_SHIP = 2
    TANKER_SHIP = 3
    TRUCK_SHIP = 4
    BATTLE_SHIP = 5


class AsteroidType(Enum):
    ROCK_ASTEROID = 0
    FUEL_ASTEROID = 1


class TurnType(Enum):
    BUY_TURN = 0
    MOVE_TURN = 1
    LOAD_TURN = 2
    SIPHON_TURN = 3
    SHOOT_TURN = 4
    REPAIR_TURN = 5


@dataclass
class Position:
    x: float
    y: float

    def add(self, other: "Position") -> "Position":
        return Position(self.x + other.x, self.y + other.y)

    def sub(self, other: "Position") -> "Position":
        return Position(self.x - other.x, self.y - other.y)

    def distance(self, other: "Position") -> float:
        return math.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)

    def size(self) -> float:
        return self.distance(Position(0, 0))

    def scale(self, factor: float) -> "Position":
        return Position(self.x * factor, self.y * factor)

    def normalize(self) -> "Position":
        size = self.size()
        if size == 0:
            return Position(0, 0)
        return Position(self.x / size, self.y / size)

    def to_dict(self) -> Dict[str, float]:
        return {"x": self.x, "y": self.y}

    def update_from_dict(self, data: Dict[str, float]) -> None:
        self.x = data["x"]
        self.y = data["y"]

    @classmethod
    def from_dict(cls, data: Dict[str, float]) -> "Position":
        obj = cls(0, 0)
        obj.update_from_dict(data)
        return obj


@dataclass
class Ship:
    id: int
    player_id: int
    position: Position
    vector: Position
    health: int
    fuel: float
    type: ShipType
    rock: int
    is_destroyed: bool = False

    def update_from_dict(self, data: Dict[str, Any]) -> None:
        self.id = data["id"]
        self.player_id = data["player"]
        self.position.update_from_dict(data["position"])
        self.vector.update_from_dict(data["vector"])
        self.health = data["health"]
        self.fuel = data["fuel"]
        self.type = ShipType(data["type"])
        self.rock = data["rock"]
        self.is_destroyed = data.get("is_destroyed", False)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Ship":
        obj = cls(
            0, 0, Position(0, 0), Position(0, 0), 0, 0, ShipType.MOTHER_SHIP, 0, False
        )
        obj.update_from_dict(data)
        return obj

    def is_alive(self) -> bool:
        """Check if the ship is alive (has health and is not destroyed)."""
        return self.health > 0 and not self.is_destroyed

    def is_operable(self) -> bool:
        """Check if the ship can be operated (not destroyed)."""
        return not self.is_destroyed

    def can_shoot(self) -> bool:
        """Check if the ship can shoot (BattleShip and not destroyed)."""
        return self.type == ShipType.BATTLE_SHIP and not self.is_destroyed

    def can_mine(self) -> bool:
        """Check if the ship can mine (DrillShip or SuckerShip and not destroyed)."""
        return (
            self.type == ShipType.DRILL_SHIP or self.type == ShipType.SUCKER_SHIP
        ) and not self.is_destroyed

    def can_carry_cargo(self) -> bool:
        """Check if the ship can carry cargo (TankerShip or TruckShip and not destroyed)."""
        return (
            self.type == ShipType.TANKER_SHIP or self.type == ShipType.TRUCK_SHIP
        ) and not self.is_destroyed


@dataclass
class Asteroid:
    id: int
    position: Position
    type: AsteroidType
    size: float
    owner_id: int
    surface: float

    def update_from_dict(self, data: Dict[str, Any]) -> None:
        self.id = data["id"]
        self.position.update_from_dict(data["position"])
        self.type = AsteroidType(data["type"])
        self.size = data["size"]
        self.owner_id = data["owner_id"]
        self.surface = data["surface"]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Asteroid":
        obj = cls(0, Position(0, 0), AsteroidType.ROCK_ASTEROID, 0, 0, 0)
        obj.update_from_dict(data)
        return obj


@dataclass
class Wormhole:
    id: int
    target_id: int
    position: Position

    def update_from_dict(self, data: Dict[str, Any]) -> None:
        self.id = data["id"]
        self.target_id = data["target_id"]
        self.position.update_from_dict(data["position"])

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Wormhole":
        obj = cls(0, 0, Position(0, 0))
        obj.update_from_dict(data)
        return obj


@dataclass
class Player:
    id: int
    name: str
    color: str
    rock: int
    fuel: int
    alive: bool

    def update_from_dict(self, data: Dict[str, Any]) -> None:
        self.id = data["id"]
        self.name = data["name"]
        self.color = data["color"]
        self.rock = data["mothership"]["rock"]
        self.fuel = data["mothership"]["fuel"]
        self.alive = data["alive"]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Player":
        obj = cls(0, "", "", 0, 0, False)
        obj.update_from_dict(data)
        return obj


@dataclass
class GameMap:
    radius: float
    ships: List[Optional[Ship]]
    asteroids: List[Optional[Asteroid]]
    wormholes: List[Optional[Wormhole]]
    players: List[Optional[Player]]
    round: int
    my_player_id: int

    def _update_ships(self, ships_data: List[Optional[Dict[str, Any]]]) -> None:
        # Ensure list is correct length
        while len(self.ships) < len(ships_data):
            self.ships.append(None)
        while len(self.ships) > len(ships_data):
            self.ships.pop()

        # Update existing ships or create new ones
        for i, ship_data in enumerate(ships_data):
            if ship_data is None:
                self.ships[i] = None
            elif self.ships[i] is None:
                # New ship - create object
                self.ships[i] = Ship.from_dict(ship_data)
            else:
                # Existing ship - update in place
                self.ships[i].update_from_dict(ship_data)

    def _update_asteroids(self, asteroids_data: List[Optional[Dict[str, Any]]]) -> None:
        # Ensure list is correct length
        while len(self.asteroids) < len(asteroids_data):
            self.asteroids.append(None)
        while len(self.asteroids) > len(asteroids_data):
            self.asteroids.pop()

        # Update existing asteroids or create new ones
        for i, asteroid_data in enumerate(asteroids_data):
            if asteroid_data is None:
                self.asteroids[i] = None
            elif self.asteroids[i] is None:
                # New asteroid - create object
                self.asteroids[i] = Asteroid.from_dict(asteroid_data)
            else:
                # Existing asteroid - update in place
                self.asteroids[i].update_from_dict(asteroid_data)

    def _update_wormholes(self, wormholes_data: List[Dict[str, Any]]) -> None:
        # Wormholes list doesn't change length, just update
        for i, wormhole_data in enumerate(wormholes_data):
            if self.wormholes[i] is None:
                self.wormholes[i] = Wormhole.from_dict(wormhole_data)
            else:
                self.wormholes[i].update_from_dict(wormhole_data)

    def _update_players(self, players_data: List[Dict[str, Any]]) -> None:
        # Players list doesn't change length, just update
        for i, player_data in enumerate(players_data):
            if self.players[i] is None:
                self.players[i] = Player.from_dict(player_data)
            else:
                self.players[i].update_from_dict(player_data)

    def _update_from_dict(self, data: Dict[str, Any]) -> None:
        self.radius = data["radius"]
        self.round = data["round"]
        self._update_ships(data["ships"])
        self._update_asteroids(data["asteroids"])
        self._update_wormholes(data["wormholes"])
        self._update_players(data["players"])

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GameMap":
        # Create GameMap with properly sized lists
        ships: List[Optional[Ship]] = [None] * len(data["ships"])
        asteroids: List[Optional[Asteroid]] = [None] * len(data["asteroids"])
        wormholes: List[Optional[Wormhole]] = [None] * len(data["wormholes"])
        players: List[Optional[Player]] = [None] * len(data["players"])

        obj = cls(0, ships, asteroids, wormholes, players, 0, 0)

        # Now use update logic to populate it
        obj._update_from_dict(data)
        return obj


@dataclass
class BuyTurn:
    ship_type: ShipType

    def to_dict(self) -> Dict[str, Any]:
        return {"type": TurnType.BUY_TURN.value, "data": {"type": self.ship_type.value}}


@dataclass
class MoveTurn:
    ship_id: int
    vector: Position

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": TurnType.MOVE_TURN.value,
            "data": {
                "ship_id": self.ship_id,
                "vector": {"x": self.vector.x, "y": self.vector.y},
            },
        }


@dataclass
class LoadTurn:
    source_id: int
    destination_id: int
    amount: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": TurnType.LOAD_TURN.value,
            "data": {
                "source_id": self.source_id,
                "destination_id": self.destination_id,
                "amount": self.amount,
            },
        }


@dataclass
class SiphonTurn:
    source_id: int
    destination_id: int
    amount: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": TurnType.SIPHON_TURN.value,
            "data": {
                "source_id": self.source_id,
                "destination_id": self.destination_id,
                "amount": self.amount,
            },
        }


@dataclass
class ShootTurn:
    source_id: int
    destination_id: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": TurnType.SHOOT_TURN.value,
            "data": {
                "source_id": self.source_id,
                "destination_id": self.destination_id,
            },
        }


@dataclass
class RepairTurn:
    ship_id: int

    def to_dict(self) -> Dict[str, Any]:
        return {"type": TurnType.REPAIR_TURN.value, "data": {"ship_id": self.ship_id}}


# Type alias for all possible turn types
Turn: TypeAlias = Union[BuyTurn, MoveTurn, LoadTurn, SiphonTurn, ShootTurn, RepairTurn]


class Client:
    def __init__(self):
        self.game_map: Optional[GameMap] = None
        self.my_player_id: Optional[int] = None

    def log(self, *args, **kwargs):
        kwargs["file"] = sys.stderr
        print(*args, **kwargs)

    def load_game_state(self, json_data: str) -> None:
        data = json.loads(json_data)

        if self.game_map is None:
            self.game_map = GameMap.from_dict(data["map"])
        else:
            self.game_map._update_from_dict(data["map"])

        self.my_player_id = data["player_id"]

    def get_my_player(self) -> Optional[Player]:
        if self.game_map is None or self.my_player_id is None:
            return None
        return self.game_map.players[self.my_player_id]

    def get_my_ships(self) -> List[Ship]:
        if self.game_map is None or self.my_player_id is None:
            return []

        my_ships = []
        for ship in self.game_map.ships:
            if ship is not None and ship.player_id == self.my_player_id:
                my_ships.append(ship)
        return my_ships

    def get_my_mothership(self) -> Optional[Ship]:
        if self.game_map is None or self.my_player_id is None:
            return None

        for ship in self.game_map.ships:
            if (
                ship is not None
                and ship.player_id == self.my_player_id
                and ship.type == ShipType.MOTHER_SHIP
            ):
                return ship
        return None

    def turn(self) -> List[Turn]:
        return []

    def run(self) -> None:
        while True:
            line = input()
            assert input() == "."

            self.load_game_state(line)
            turns = self.turn()
            turns_data = [turn.to_dict() for turn in turns]
            print(json.dumps(turns_data), flush=True)
            print(".", flush=True)
