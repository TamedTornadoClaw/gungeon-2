import { DestructibleType, EnemyType, HazardType, MeshId } from '../ecs/components.js';

// Re-export DestructibleType for consumers that import from this module
export { DestructibleType } from '../ecs/components.js';

// ── Template Interfaces ─────────────────────────────────────────────────────

export interface SpawnZoneTemplate {
  /** Center X relative to room origin */
  x: number;
  /** Center Z relative to room origin */
  z: number;
  width: number;
  height: number;
  enemyTypes: EnemyType[];
  enemyCount: number;
}

export interface HazardPlacementTemplate {
  x: number;
  z: number;
  width: number;
  height: number;
  hazardType: HazardType;
}

export const DESTRUCTIBLE_MESH: Record<DestructibleType, MeshId> = {
  [DestructibleType.Crate]: MeshId.Crate,
  [DestructibleType.Pillar]: MeshId.Pillar,
  [DestructibleType.Barrel]: MeshId.Barrel,
};

export interface DestructiblePlacementTemplate {
  x: number;
  z: number;
  destructibleType: DestructibleType;
}

export interface ChestPlacementTemplate {
  x: number;
  z: number;
}

export interface ShopPlacementTemplate {
  x: number;
  z: number;
}

export interface RoomTemplate {
  name: string;
  width: number;
  height: number;
  spawnZones: SpawnZoneTemplate[];
  hazards: HazardPlacementTemplate[];
  destructibles: DestructiblePlacementTemplate[];
  chestPlacement: ChestPlacementTemplate | null;
  shopPlacement: ShopPlacementTemplate | null;
}

// ── Templates ───────────────────────────────────────────────────────────────

export const ROOM_TEMPLATES: readonly RoomTemplate[] = [
  // 1. Small square arena — tight combat room
  {
    name: 'SmallArena',
    width: 20,
    height: 20,
    spawnZones: [
      {
        x: 10,
        z: 10,
        width: 14,
        height: 14,
        enemyTypes: [EnemyType.KnifeRusher, EnemyType.SuicideBomber],
        enemyCount: 3,
      },
    ],
    hazards: [],
    destructibles: [
      { x: 5, z: 5, destructibleType: DestructibleType.Crate },
      { x: 15, z: 5, destructibleType: DestructibleType.Crate },
      { x: 5, z: 15, destructibleType: DestructibleType.Barrel },
      { x: 15, z: 15, destructibleType: DestructibleType.Barrel },
    ],
    chestPlacement: null,
    shopPlacement: null,
  },

  // 2. Medium rectangular room with fire hazards
  {
    name: 'FireCorridor',
    width: 40,
    height: 20,
    spawnZones: [
      {
        x: 10,
        z: 10,
        width: 12,
        height: 14,
        enemyTypes: [EnemyType.Rifleman, EnemyType.ShieldGun],
        enemyCount: 4,
      },
      {
        x: 30,
        z: 10,
        width: 12,
        height: 14,
        enemyTypes: [EnemyType.Shotgunner, EnemyType.KnifeRusher],
        enemyCount: 4,
      },
    ],
    hazards: [
      { x: 20, z: 5, width: 4, height: 4, hazardType: HazardType.Fire },
      { x: 20, z: 15, width: 4, height: 4, hazardType: HazardType.Fire },
    ],
    destructibles: [
      { x: 20, z: 10, destructibleType: DestructibleType.Pillar },
    ],
    chestPlacement: { x: 35, z: 10 },
    shopPlacement: null,
  },

  // 3. Large square arena with spike hazards and cover
  {
    name: 'SpikeArena',
    width: 40,
    height: 40,
    spawnZones: [
      {
        x: 10,
        z: 10,
        width: 12,
        height: 12,
        enemyTypes: [EnemyType.KnifeRusher, EnemyType.SuicideBomber],
        enemyCount: 5,
      },
      {
        x: 30,
        z: 30,
        width: 12,
        height: 12,
        enemyTypes: [EnemyType.Rifleman, EnemyType.Shotgunner],
        enemyCount: 5,
      },
    ],
    hazards: [
      { x: 20, z: 10, width: 6, height: 6, hazardType: HazardType.Spikes },
      { x: 10, z: 30, width: 6, height: 6, hazardType: HazardType.Spikes },
      { x: 30, z: 10, width: 6, height: 6, hazardType: HazardType.Water },
    ],
    destructibles: [
      { x: 15, z: 20, destructibleType: DestructibleType.Pillar },
      { x: 25, z: 20, destructibleType: DestructibleType.Pillar },
      { x: 20, z: 25, destructibleType: DestructibleType.Crate },
      { x: 20, z: 15, destructibleType: DestructibleType.Crate },
    ],
    chestPlacement: { x: 20, z: 20 },
    shopPlacement: null,
  },

  // 4. Maximum size boss arena
  {
    name: 'BossArena',
    width: 50,
    height: 50,
    spawnZones: [
      {
        x: 25,
        z: 25,
        width: 30,
        height: 30,
        enemyTypes: [
          EnemyType.KnifeRusher,
          EnemyType.ShieldGun,
          EnemyType.Shotgunner,
          EnemyType.Rifleman,
          EnemyType.SuicideBomber,
        ],
        enemyCount: 8,
      },
    ],
    hazards: [
      { x: 10, z: 10, width: 4, height: 4, hazardType: HazardType.Fire },
      { x: 40, z: 10, width: 4, height: 4, hazardType: HazardType.Fire },
      { x: 10, z: 40, width: 4, height: 4, hazardType: HazardType.Spikes },
      { x: 40, z: 40, width: 4, height: 4, hazardType: HazardType.Spikes },
    ],
    destructibles: [
      { x: 15, z: 25, destructibleType: DestructibleType.Pillar },
      { x: 35, z: 25, destructibleType: DestructibleType.Pillar },
      { x: 25, z: 15, destructibleType: DestructibleType.Pillar },
      { x: 25, z: 35, destructibleType: DestructibleType.Pillar },
      { x: 20, z: 20, destructibleType: DestructibleType.Barrel },
      { x: 30, z: 30, destructibleType: DestructibleType.Barrel },
    ],
    chestPlacement: null,
    shopPlacement: null,
  },

  // 5. Shop room — wide with a central shop placement
  {
    name: 'ShopRoom',
    width: 30,
    height: 25,
    spawnZones: [
      {
        x: 8,
        z: 12,
        width: 10,
        height: 10,
        enemyTypes: [EnemyType.KnifeRusher, EnemyType.Rifleman],
        enemyCount: 3,
      },
    ],
    hazards: [],
    destructibles: [
      { x: 5, z: 5, destructibleType: DestructibleType.Crate },
      { x: 25, z: 5, destructibleType: DestructibleType.Crate },
    ],
    chestPlacement: null,
    shopPlacement: { x: 22, z: 12 },
  },

  // 6. Narrow corridor — long and thin with water hazards
  {
    name: 'WaterCorridor',
    width: 50,
    height: 20,
    spawnZones: [
      {
        x: 15,
        z: 10,
        width: 10,
        height: 14,
        enemyTypes: [EnemyType.Shotgunner, EnemyType.KnifeRusher],
        enemyCount: 4,
      },
      {
        x: 35,
        z: 10,
        width: 10,
        height: 14,
        enemyTypes: [EnemyType.Rifleman, EnemyType.ShieldGun],
        enemyCount: 4,
      },
    ],
    hazards: [
      { x: 25, z: 5, width: 6, height: 4, hazardType: HazardType.Water },
      { x: 25, z: 15, width: 6, height: 4, hazardType: HazardType.Water },
    ],
    destructibles: [
      { x: 12, z: 5, destructibleType: DestructibleType.Barrel },
      { x: 38, z: 15, destructibleType: DestructibleType.Barrel },
      { x: 25, z: 10, destructibleType: DestructibleType.Pillar },
    ],
    chestPlacement: { x: 45, z: 10 },
    shopPlacement: null,
  },

  // 7. Tall narrow room
  {
    name: 'TallChamber',
    width: 20,
    height: 45,
    spawnZones: [
      {
        x: 10,
        z: 12,
        width: 14,
        height: 10,
        enemyTypes: [EnemyType.KnifeRusher, EnemyType.SuicideBomber],
        enemyCount: 4,
      },
      {
        x: 10,
        z: 33,
        width: 14,
        height: 10,
        enemyTypes: [EnemyType.ShieldGun, EnemyType.Shotgunner],
        enemyCount: 4,
      },
    ],
    hazards: [
      { x: 10, z: 22, width: 8, height: 4, hazardType: HazardType.Spikes },
    ],
    destructibles: [
      { x: 5, z: 22, destructibleType: DestructibleType.Crate },
      { x: 15, z: 22, destructibleType: DestructibleType.Crate },
    ],
    chestPlacement: null,
    shopPlacement: { x: 10, z: 40 },
  },
] as const;
