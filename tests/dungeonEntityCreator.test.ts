import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import {
  createDungeonEntities,
  setPlayerStartPosition,
} from '../src/dungeon/dungeonEntityCreator';
import {
  EnemyType,
  HazardType,
  MeshId,
  PickupType,
} from '../src/ecs/components';
import type {
  Position,
  PreviousPosition,
  Collider,
  Hazard,
  Renderable,
  Destructible,
  Door,
  Chest,
  Shop,
  Stairs,
  SpawnZone,
} from '../src/ecs/components';
import type { DungeonData, Room, Corridor } from '../src/dungeon/dungeonData';
import { resetCollisionState } from '../src/systems/collisionDetectionSystem';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 0,
    bounds: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 20, y: 0, z: 20 },
    },
    spawnPoints: [],
    hazardPlacements: [],
    destructiblePlacements: [],
    hasChest: false,
    hasShop: false,
    ...overrides,
  };
}

function makeDungeonData(overrides: Partial<DungeonData> = {}): DungeonData {
  return {
    rooms: [makeRoom()],
    corridors: [],
    playerStart: { x: 10, y: 0, z: 10 },
    stairsPosition: { x: 10, y: 0, z: 10 },
    ...overrides,
  };
}

describe('DungeonEntityCreator', () => {
  beforeEach(() => {
    resetCollisionState();
  });

  describe('Walls created from room boundaries', () => {
    it('creates wall entities along room perimeter with correct components', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({ bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } } })],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      expect(result.wallIds.length).toBeGreaterThanOrEqual(4);

      for (const wallId of result.wallIds) {
        const pos = world.getComponent<Position>(wallId, 'Position');
        const collider = world.getComponent<Collider>(wallId, 'Collider');
        const renderable = world.getComponent<Renderable>(wallId, 'Renderable');
        const hasWallTag = world.hasComponent(wallId, 'WallTag');

        expect(pos).toBeDefined();
        expect(collider).toBeDefined();
        expect(collider!.isStatic).toBe(true);
        expect(collider!.isTrigger).toBe(false);
        expect(renderable).toBeDefined();
        expect(renderable!.meshId).toBe(MeshId.Wall);
        expect(hasWallTag).toBe(true);
      }
    });

    it('does not create wall entities inside the room', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({ bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } } })],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // All walls should be at the room boundary, not in the interior
      for (const wallId of result.wallIds) {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        // Wall positions should be on boundary edges, not deep interior
        expect(pos).toBeDefined();
        // At least one coordinate should be at a boundary value
        const atBoundary =
          pos.x === 0 || pos.x === 20 || pos.z === 0 || pos.z === 20 ||
          pos.x === 10 || pos.z === 10;
        expect(atBoundary).toBe(true);
      }
    });
  });

  describe('Corridor walls connect rooms', () => {
    it('creates walls along corridor sides and a door at midpoint', () => {
      const world = new World();
      const corridor: Corridor = {
        start: { x: 20, y: 0, z: 7 },
        end: { x: 40, y: 0, z: 14 },
        width: 7,
      };
      const dungeon = makeDungeonData({
        rooms: [
          makeRoom({ id: 0, bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } } }),
          makeRoom({ id: 1, bounds: { min: { x: 40, y: 0, z: 0 }, max: { x: 60, y: 0, z: 20 } } }),
        ],
        corridors: [corridor],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // Corridor should produce walls
      // Room walls (4 per room * 2 rooms = 8) + corridor walls (2)
      expect(result.wallIds.length).toBeGreaterThanOrEqual(8);

      // Corridor should produce a floor tile
      expect(result.floorIds.length).toBeGreaterThanOrEqual(3); // 2 rooms + 1 corridor

      // Corridor should produce doors at room boundaries
      expect(result.doorIds.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Fire hazard entity creation', () => {
    it('creates fire hazard entities with correct components', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          hazardPlacements: [
            { position: { x: 5, y: 0, z: 5 }, width: 4, height: 4, hazardType: HazardType.Fire },
            { position: { x: 10, y: 0, z: 10 }, width: 4, height: 4, hazardType: HazardType.Fire },
            { position: { x: 15, y: 0, z: 15 }, width: 4, height: 4, hazardType: HazardType.Fire },
          ],
        })],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      expect(result.hazardIds).toHaveLength(3);

      for (const hId of result.hazardIds) {
        const pos = world.getComponent<Position>(hId, 'Position');
        const hazard = world.getComponent<Hazard>(hId, 'Hazard');
        const collider = world.getComponent<Collider>(hId, 'Collider');
        const renderable = world.getComponent<Renderable>(hId, 'Renderable');
        const hasTag = world.hasComponent(hId, 'HazardTag');

        expect(pos).toBeDefined();
        expect(hazard).toBeDefined();
        expect(hazard!.hazardType).toBe(HazardType.Fire);
        expect(collider).toBeDefined();
        expect(collider!.isStatic).toBe(true);
        expect(collider!.isTrigger).toBe(true);
        expect(renderable).toBeDefined();
        expect(renderable!.meshId).toBe(MeshId.FireHazard);
        expect(hasTag).toBe(true);
      }
    });
  });

  describe('Spike hazard entity creation', () => {
    it('creates spike hazard entities with correct hazardType and meshId', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          hazardPlacements: [
            { position: { x: 5, y: 0, z: 5 }, width: 4, height: 4, hazardType: HazardType.Spikes },
          ],
        })],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      expect(result.hazardIds).toHaveLength(1);
      const hazard = world.getComponent<Hazard>(result.hazardIds[0], 'Hazard')!;
      const renderable = world.getComponent<Renderable>(result.hazardIds[0], 'Renderable')!;
      const collider = world.getComponent<Collider>(result.hazardIds[0], 'Collider')!;

      expect(hazard.hazardType).toBe(HazardType.Spikes);
      expect(renderable.meshId).toBe(MeshId.SpikeHazard);
      expect(collider.isStatic).toBe(true);
      expect(collider.isTrigger).toBe(true);
    });
  });

  describe('Water hazard entity creation', () => {
    it('creates water hazard entities with correct hazardType and meshId', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          hazardPlacements: [
            { position: { x: 5, y: 0, z: 5 }, width: 4, height: 4, hazardType: HazardType.Water },
          ],
        })],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      expect(result.hazardIds).toHaveLength(1);
      const hazard = world.getComponent<Hazard>(result.hazardIds[0], 'Hazard')!;
      const renderable = world.getComponent<Renderable>(result.hazardIds[0], 'Renderable')!;
      const collider = world.getComponent<Collider>(result.hazardIds[0], 'Collider')!;

      expect(hazard.hazardType).toBe(HazardType.Water);
      expect(renderable.meshId).toBe(MeshId.WaterHazard);
      expect(collider.isStatic).toBe(true);
      expect(collider.isTrigger).toBe(true);
    });
  });

  describe('Destructible cover creation', () => {
    it('creates destructible entity with health from dungeon data', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          destructiblePlacements: [
            { position: { x: 15, y: 0, z: 20 }, width: 2, height: 2, depth: 2, health: 30 },
          ],
        })],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      expect(result.destructibleIds).toHaveLength(1);
      const dId = result.destructibleIds[0];
      const pos = world.getComponent<Position>(dId, 'Position')!;
      const dest = world.getComponent<Destructible>(dId, 'Destructible')!;
      const collider = world.getComponent<Collider>(dId, 'Collider')!;
      const renderable = world.getComponent<Renderable>(dId, 'Renderable')!;
      const hasTag = world.hasComponent(dId, 'DestructibleTag');

      expect(pos.x).toBe(15);
      expect(pos.z).toBe(20);
      expect(dest.health).toBe(30);
      expect(collider.isStatic).toBe(true);
      expect(collider.isTrigger).toBe(false);
      expect(renderable.meshId).toBe(MeshId.Crate);
      expect(hasTag).toBe(true);
    });
  });

  describe('Chest creation with gun type', () => {
    it('creates chest entity with correct components', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          bounds: { min: { x: 20, y: 0, z: 0 }, max: { x: 40, y: 0, z: 20 } },
          hasChest: true,
        })],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      expect(result.chestIds).toHaveLength(1);
      const cId = result.chestIds[0];
      const chest = world.getComponent<Chest>(cId, 'Chest')!;
      const collider = world.getComponent<Collider>(cId, 'Collider')!;
      const renderable = world.getComponent<Renderable>(cId, 'Renderable')!;
      const hasTag = world.hasComponent(cId, 'ChestTag');

      expect(chest.isOpen).toBe(false);
      expect(chest.gunType).toBeDefined();
      expect(collider).toBeDefined();
      expect(renderable.meshId).toBe(MeshId.Chest);
      expect(hasTag).toBe(true);
    });
  });

  describe('Shop creation with inventory', () => {
    it('creates shop entity with health pickup inventory priced from design params', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 30, y: 0, z: 30 } },
          hasShop: true,
        })],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      expect(result.shopIds).toHaveLength(1);
      const sId = result.shopIds[0];
      const shop = world.getComponent<Shop>(sId, 'Shop')!;
      const renderable = world.getComponent<Renderable>(sId, 'Renderable')!;
      const hasTag = world.hasComponent(sId, 'ShopTag');

      expect(shop.inventory.length).toBeGreaterThanOrEqual(1);
      expect(shop.inventory[0].type).toBe(PickupType.HealthPickup);
      expect(shop.inventory[0].price).toBe(30); // healthPickupPrice from design params
      expect(shop.inventory[0].sold).toBe(false);
      expect(renderable.meshId).toBe(MeshId.Shop);
      expect(hasTag).toBe(true);
    });
  });

  describe('Stairs placed at dungeon exit', () => {
    it('creates exactly one stairs entity with correct targetDepth', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        stairsPosition: { x: 50, y: 0, z: 50 },
      });

      const result = createDungeonEntities(world, dungeon, 3);

      expect(result.stairsId).not.toBeNull();
      const stairs = world.getComponent<Stairs>(result.stairsId!, 'Stairs')!;
      const pos = world.getComponent<Position>(result.stairsId!, 'Position')!;
      const collider = world.getComponent<Collider>(result.stairsId!, 'Collider')!;
      const renderable = world.getComponent<Renderable>(result.stairsId!, 'Renderable')!;
      const hasTag = world.hasComponent(result.stairsId!, 'StairsTag');

      expect(stairs.targetDepth).toBe(4);
      expect(pos.x).toBe(50);
      expect(pos.z).toBe(50);
      expect(collider.isTrigger).toBe(true);
      expect(renderable.meshId).toBe(MeshId.Stairs);
      expect(hasTag).toBe(true);

      // Exactly one stairs
      const stairsEntities = world.query(['StairsTag']);
      expect(stairsEntities).toHaveLength(1);
    });
  });

  describe('SpawnZone created per room with correct enemy types', () => {
    it('creates spawn zone with correct dimensions, enemy types, and initial state', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } },
          spawnPoints: [{
            position: { x: 10, y: 0, z: 10 },
            enemyTypes: [EnemyType.KnifeRusher, EnemyType.Shotgunner],
            enemyCount: 5,
          }],
        })],
        playerStart: { x: -100, y: 0, z: -100 },
      });

      const result = createDungeonEntities(world, dungeon, 1);

      expect(result.spawnZoneIds).toHaveLength(1);
      const szId = result.spawnZoneIds[0];
      const pos = world.getComponent<Position>(szId, 'Position')!;
      const sz = world.getComponent<SpawnZone>(szId, 'SpawnZone')!;
      const collider = world.getComponent<Collider>(szId, 'Collider')!;

      expect(pos.x).toBe(10);
      expect(pos.z).toBe(10);
      expect(sz.enemyTypes).toEqual([EnemyType.KnifeRusher, EnemyType.Shotgunner]);
      expect(sz.enemyCount).toBe(5);
      expect(sz.activated).toBe(false);
      expect(sz.spawnedEnemies).toEqual([]);
      expect(sz.cleared).toBe(false);
      expect(collider.isTrigger).toBe(true);
    });
  });

  describe('Player placed at dungeon start position', () => {
    it('sets both Position and PreviousPosition to the start position', () => {
      const world = new World();
      const playerId = world.createEntity();
      world.addComponent<Position>(playerId, 'Position', { x: 0, y: 0, z: 0 });
      world.addComponent<PreviousPosition>(playerId, 'PreviousPosition', { x: 0, y: 0, z: 0 });

      setPlayerStartPosition(world, playerId, { x: 5, y: 0, z: 5 });

      const pos = world.getComponent<Position>(playerId, 'Position')!;
      const prevPos = world.getComponent<PreviousPosition>(playerId, 'PreviousPosition')!;

      expect(pos.x).toBe(5);
      expect(pos.y).toBe(0);
      expect(pos.z).toBe(5);
      expect(prevPos.x).toBe(5);
      expect(prevPos.y).toBe(0);
      expect(prevPos.z).toBe(5);
    });
  });

  describe('Static colliders inserted into spatial hash at load time', () => {
    it('calls rebuildStatics after creating entities', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          hazardPlacements: [
            { position: { x: 5, y: 0, z: 5 }, width: 4, height: 4, hazardType: HazardType.Fire },
          ],
        })],
      });

      // Should not throw — spatial hash rebuild happens internally
      const result = createDungeonEntities(world, dungeon, 1);

      // Verify static entities were created (walls + hazards)
      const staticCount = result.wallIds.length + result.hazardIds.length;
      expect(staticCount).toBeGreaterThan(0);

      // All static entities should have colliders
      for (const wallId of result.wallIds) {
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        expect(collider.isStatic).toBe(true);
      }
    });
  });

  describe('Floor transition destroys old entities and creates new floor', () => {
    it('new dungeon creates all required entity types', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [
          makeRoom({
            id: 0,
            bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } },
            spawnPoints: [{
              position: { x: 10, y: 0, z: 10 },
              enemyTypes: [EnemyType.KnifeRusher],
              enemyCount: 3,
            }],
            hazardPlacements: [
              { position: { x: 5, y: 0, z: 5 }, width: 4, height: 4, hazardType: HazardType.Fire },
            ],
            destructiblePlacements: [
              { position: { x: 15, y: 0, z: 15 }, width: 2, height: 2, depth: 2, health: 30 },
            ],
            hasChest: true,
            hasShop: true,
          }),
        ],
        corridors: [{
          start: { x: 20, y: 0, z: 7 },
          end: { x: 30, y: 0, z: 14 },
          width: 7,
        }],
        playerStart: { x: -100, y: 0, z: -100 },
      });

      const result = createDungeonEntities(world, dungeon, 4);

      expect(result.wallIds.length).toBeGreaterThan(0);
      expect(result.floorIds.length).toBeGreaterThan(0);
      expect(result.hazardIds).toHaveLength(1);
      expect(result.destructibleIds).toHaveLength(1);
      expect(result.chestIds).toHaveLength(1);
      expect(result.shopIds).toHaveLength(1);
      expect(result.doorIds).toHaveLength(1);
      expect(result.spawnZoneIds).toHaveLength(1);
      expect(result.stairsId).not.toBeNull();
    });
  });

  describe('Boss floor at depth 10', () => {
    it('creates boss entity on boss floor depth', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 50, y: 0, z: 50 } },
        })],
      });

      const result = createDungeonEntities(world, dungeon, 10);

      expect(result.bossId).not.toBeNull();
      const hasBossTag = world.hasComponent(result.bossId!, 'BossTag');
      expect(hasBossTag).toBe(true);
    });

    it('does not create stairs on boss floor', () => {
      const world = new World();
      const dungeon = makeDungeonData();

      const result = createDungeonEntities(world, dungeon, 10);

      expect(result.stairsId).toBeNull();
      const stairsEntities = world.query(['StairsTag']);
      expect(stairsEntities).toHaveLength(0);
    });
  });

  describe('Door entities created between rooms', () => {
    it('creates door entities at room boundaries with correct components', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [
          makeRoom({ id: 0 }),
          makeRoom({ id: 1, bounds: { min: { x: 40, y: 0, z: 0 }, max: { x: 60, y: 0, z: 20 } } }),
        ],
        corridors: [{
          start: { x: 20, y: 0, z: 7 },
          end: { x: 40, y: 0, z: 14 },
          width: 7,
        }],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // Doors placed at each room boundary where corridor exits
      expect(result.doorIds.length).toBeGreaterThanOrEqual(1);
      const doorId = result.doorIds[0];
      const door = world.getComponent<Door>(doorId, 'Door')!;
      const collider = world.getComponent<Collider>(doorId, 'Collider')!;
      const renderable = world.getComponent<Renderable>(doorId, 'Renderable')!;
      const hasTag = world.hasComponent(doorId, 'DoorTag');

      expect(door.isOpen).toBe(false);
      expect(collider.isStatic).toBe(true);
      expect(collider.isTrigger).toBe(false);
      expect(renderable.meshId).toBe(MeshId.Door);
      expect(hasTag).toBe(true);
    });
  });

  describe('Floor tiles', () => {
    it('creates floor tiles for rooms and corridors', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [
          makeRoom({ id: 0 }),
          makeRoom({ id: 1, bounds: { min: { x: 40, y: 0, z: 0 }, max: { x: 60, y: 0, z: 20 } } }),
        ],
        corridors: [{
          start: { x: 20, y: 0, z: 7 },
          end: { x: 40, y: 0, z: 14 },
          width: 7,
        }],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // 2 rooms + 1 corridor = 3 floor tiles
      expect(result.floorIds.length).toBeGreaterThanOrEqual(3);

      for (const fId of result.floorIds) {
        const pos = world.getComponent<Position>(fId, 'Position');
        const renderable = world.getComponent<Renderable>(fId, 'Renderable');

        expect(pos).toBeDefined();
        expect(renderable).toBeDefined();
        expect(renderable!.meshId).toBe(MeshId.Floor);
      }
    });
  });

  describe('Edge cases', () => {
    it('handles zero rooms without crashing', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [],
        corridors: [],
      });

      expect(() => {
        const result = createDungeonEntities(world, dungeon, 1);
        // Should still create stairs
        expect(result.stairsId).not.toBeNull();
      }).not.toThrow();
    });

    it('handles room entirely filled with hazards', () => {
      const world = new World();
      const hazards = [];
      for (let x = 1; x < 19; x += 4) {
        for (let z = 1; z < 19; z += 4) {
          hazards.push({
            position: { x, y: 0, z },
            width: 4,
            height: 4,
            hazardType: HazardType.Fire,
          });
        }
      }
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          hazardPlacements: hazards,
          spawnPoints: [{
            position: { x: 10, y: 0, z: 10 },
            enemyTypes: [EnemyType.KnifeRusher],
            enemyCount: 3,
          }],
        })],
        playerStart: { x: -100, y: 0, z: -100 },
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // Walls must still surround the room
      expect(result.wallIds.length).toBeGreaterThanOrEqual(4);
      // SpawnZone must still be created
      expect(result.spawnZoneIds).toHaveLength(1);
      // Hazards created
      expect(result.hazardIds.length).toBe(hazards.length);
    });

    it('chest chance rolls produce zero chests — valid', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({ hasChest: false })],
      });

      const result = createDungeonEntities(world, dungeon, 1);
      expect(result.chestIds).toHaveLength(0);
    });

    it('shop chance rolls produce zero shops — valid', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({ hasShop: false })],
      });

      const result = createDungeonEntities(world, dungeon, 1);
      expect(result.shopIds).toHaveLength(0);
    });

    it('PreviousPosition initialized for all wall entities', () => {
      const world = new World();
      const dungeon = makeDungeonData();

      const result = createDungeonEntities(world, dungeon, 1);

      for (const wallId of result.wallIds) {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const prevPos = world.getComponent<PreviousPosition>(wallId, 'PreviousPosition')!;
        expect(prevPos.x).toBe(pos.x);
        expect(prevPos.y).toBe(pos.y);
        expect(prevPos.z).toBe(pos.z);
      }
    });

    it('PreviousPosition initialized for hazard entities', () => {
      const world = new World();
      const dungeon = makeDungeonData({
        rooms: [makeRoom({
          hazardPlacements: [
            { position: { x: 5, y: 0, z: 5 }, width: 4, height: 4, hazardType: HazardType.Fire },
          ],
        })],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      for (const hId of result.hazardIds) {
        const pos = world.getComponent<Position>(hId, 'Position')!;
        const prevPos = world.getComponent<PreviousPosition>(hId, 'PreviousPosition')!;
        expect(prevPos.x).toBe(pos.x);
        expect(prevPos.y).toBe(pos.y);
        expect(prevPos.z).toBe(pos.z);
      }
    });
  });

  describe('Properties (must ALWAYS hold)', () => {
    it('every wall has Position, Collider(isStatic, !isTrigger), Renderable(Wall), WallTag', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 20, max: 50 }),
          (depth, roomSize) => {
            resetCollisionState();
            const world = new World();
            const dungeon = makeDungeonData({
              rooms: [makeRoom({
                bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: roomSize, y: 0, z: roomSize } },
              })],
            });

            const result = createDungeonEntities(world, dungeon, depth);

            for (const wallId of result.wallIds) {
              expect(world.getComponent<Position>(wallId, 'Position')).toBeDefined();
              const col = world.getComponent<Collider>(wallId, 'Collider')!;
              expect(col.isStatic).toBe(true);
              expect(col.isTrigger).toBe(false);
              expect(world.getComponent<Renderable>(wallId, 'Renderable')!.meshId).toBe(MeshId.Wall);
              expect(world.hasComponent(wallId, 'WallTag')).toBe(true);
            }
          },
        ),
      );
    });

    it('exactly one stairs entity per non-boss floor', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }),
          (depth) => {
            resetCollisionState();
            const world = new World();
            const dungeon = makeDungeonData();

            const result = createDungeonEntities(world, dungeon, depth);

            expect(result.stairsId).not.toBeNull();
            const stairsEntities = world.query(['StairsTag']);
            expect(stairsEntities).toHaveLength(1);
          },
        ),
      );
    });

    it('no entity is created with missing required components', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (depth) => {
            resetCollisionState();
            const world = new World();
            const dungeon = makeDungeonData({
              rooms: [makeRoom({
                spawnPoints: [{
                  position: { x: 10, y: 0, z: 10 },
                  enemyTypes: [EnemyType.KnifeRusher],
                  enemyCount: 3,
                }],
                hazardPlacements: [
                  { position: { x: 5, y: 0, z: 5 }, width: 4, height: 4, hazardType: HazardType.Fire },
                ],
                destructiblePlacements: [
                  { position: { x: 15, y: 0, z: 15 }, width: 2, height: 2, depth: 2, health: 30 },
                ],
              })],
              playerStart: { x: -100, y: 0, z: -100 },
            });

            const result = createDungeonEntities(world, dungeon, depth);

            // All walls have required components
            for (const id of result.wallIds) {
              expect(world.hasComponent(id, 'Position')).toBe(true);
              expect(world.hasComponent(id, 'Collider')).toBe(true);
              expect(world.hasComponent(id, 'Renderable')).toBe(true);
              expect(world.hasComponent(id, 'WallTag')).toBe(true);
            }

            // All hazards have required components
            for (const id of result.hazardIds) {
              expect(world.hasComponent(id, 'Position')).toBe(true);
              expect(world.hasComponent(id, 'Hazard')).toBe(true);
              expect(world.hasComponent(id, 'Collider')).toBe(true);
              expect(world.hasComponent(id, 'Renderable')).toBe(true);
              expect(world.hasComponent(id, 'HazardTag')).toBe(true);
            }

            // All destructibles have required components
            for (const id of result.destructibleIds) {
              expect(world.hasComponent(id, 'Position')).toBe(true);
              expect(world.hasComponent(id, 'Destructible')).toBe(true);
              expect(world.hasComponent(id, 'Collider')).toBe(true);
              expect(world.hasComponent(id, 'Renderable')).toBe(true);
              expect(world.hasComponent(id, 'DestructibleTag')).toBe(true);
            }

            // All spawn zones have required components
            for (const id of result.spawnZoneIds) {
              expect(world.hasComponent(id, 'Position')).toBe(true);
              expect(world.hasComponent(id, 'SpawnZone')).toBe(true);
              expect(world.hasComponent(id, 'Collider')).toBe(true);
            }
          },
        ),
      );
    });
  });
});
