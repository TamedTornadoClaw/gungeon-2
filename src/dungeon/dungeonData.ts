import type { Vec3 } from '../types/index.js';
import { EnemyType, HazardType } from '../ecs/components.js';

export interface SpawnPoint {
  position: Vec3;
  enemyTypes: EnemyType[];
  enemyCount: number;
}

export interface HazardPlacement {
  position: Vec3;
  width: number;
  height: number;
  hazardType: HazardType;
}

export interface DestructiblePlacement {
  position: Vec3;
  width: number;
  height: number;
  depth: number;
  health: number;
}

export interface Room {
  id: number;
  bounds: {
    min: Vec3;
    max: Vec3;
  };
  spawnPoints: SpawnPoint[];
  hazardPlacements: HazardPlacement[];
  destructiblePlacements: DestructiblePlacement[];
  hasChest: boolean;
  hasShop: boolean;
}

export interface Corridor {
  start: Vec3;
  end: Vec3;
  width: number;
}

export interface DungeonData {
  rooms: Room[];
  corridors: Corridor[];
  playerStart: Vec3;
  stairsPosition: Vec3;
}
