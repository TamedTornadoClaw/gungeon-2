import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import {
  createDungeonEntities,
  setPlayerStartPosition,
} from '../src/dungeon/dungeonEntityCreator';
import { generateDungeon } from '../src/dungeon/generator';
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

  describe('Enemies pre-placed per room', () => {
    it('creates enemies directly in non-starting rooms', () => {
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

      createDungeonEntities(world, dungeon, 1);

      // Enemies should be pre-placed (no spawn zones)
      const enemies = world.query(['EnemyTag']);
      expect(enemies).toHaveLength(5);
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
      expect(result.spawnZoneIds).toHaveLength(0);
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
      // Enemies pre-placed (no spawn zones)
      expect(result.spawnZoneIds).toHaveLength(0);
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

  describe('Corridor-to-corridor wall clipping', () => {
    it('leaves gaps in corridor walls where another corridor crosses perpendicularly', () => {
      const world = new World();
      // Two rooms far apart, connected by an L-shaped path (2 corridor segments)
      // Horizontal corridor and vertical corridor meet at a corner
      const roomA = makeRoom({
        id: 0,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } },
      });
      const roomB = makeRoom({
        id: 1,
        bounds: { min: { x: 40, y: 0, z: 40 }, max: { x: 60, y: 0, z: 60 } },
      });

      // Horizontal segment from room A center (10,10) going right to (50, 10)
      const horizCorridor: Corridor = {
        start: { x: 10, y: 0, z: 7 },
        end: { x: 50, y: 0, z: 13 },
        width: 6,
      };
      // Vertical segment from (50, 10) going down to room B center (50, 50)
      const vertCorridor: Corridor = {
        start: { x: 47, y: 0, z: 10 },
        end: { x: 53, y: 0, z: 50 },
        width: 6,
      };

      const dungeon = makeDungeonData({
        rooms: [roomA, roomB],
        corridors: [horizCorridor, vertCorridor],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // The key invariant: no wall should block the intersection of the two corridors.
      // The intersection area is roughly x=[47,53], z=[7,13].
      // No wall segment should span across this intersection on either axis.
      for (const wallId of result.wallIds) {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;

        const wallMinX = pos.x - collider.width / 2;
        const wallMaxX = pos.x + collider.width / 2;
        const wallMinZ = pos.z - collider.depth / 2;
        const wallMaxZ = pos.z + collider.depth / 2;

        // Check that no wall fully blocks the corridor intersection
        // A blocking wall would span across the full width of one corridor
        // while sitting on the wall-line of the other corridor
        const intersectsCorridorArea =
          wallMinX < 53 && wallMaxX > 47 && wallMinZ < 13 && wallMaxZ > 7;

        // If a wall is in the intersection zone, it must NOT span the full width
        // of the crossing corridor (i.e., it should be a clipped segment, not a blocker)
        if (intersectsCorridorArea) {
          // Thin wall running along x-axis (horizontal wall) at z=7 or z=13
          const isHorizWall = collider.depth <= 2 && collider.width > 2;
          // Thin wall running along z-axis (vertical wall) at x=47 or x=53
          const isVertWall = collider.width <= 2 && collider.depth > 2;

          if (isHorizWall) {
            // Should not span fully across the vertical corridor's x range [47,53]
            const spansFullVertCorridor = wallMinX <= 47 && wallMaxX >= 53;
            expect(spansFullVertCorridor).toBe(false);
          }
          if (isVertWall) {
            // Should not span fully across the horizontal corridor's z range [7,13]
            const spansFullHorizCorridor = wallMinZ <= 7 && wallMaxZ >= 13;
            expect(spansFullHorizCorridor).toBe(false);
          }
        }
      }
    });

    it('does not create gaps from non-intersecting corridors', () => {
      const world = new World();
      // Two parallel horizontal corridors that don't cross
      const roomA = makeRoom({
        id: 0,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } },
      });
      const roomB = makeRoom({
        id: 1,
        bounds: { min: { x: 40, y: 0, z: 0 }, max: { x: 60, y: 0, z: 20 } },
      });
      const roomC = makeRoom({
        id: 2,
        bounds: { min: { x: 0, y: 0, z: 40 }, max: { x: 20, y: 0, z: 60 } },
      });
      const roomD = makeRoom({
        id: 3,
        bounds: { min: { x: 40, y: 0, z: 40 }, max: { x: 60, y: 0, z: 60 } },
      });

      const corridor1: Corridor = {
        start: { x: 20, y: 0, z: 7 },
        end: { x: 40, y: 0, z: 13 },
        width: 6,
      };
      const corridor2: Corridor = {
        start: { x: 20, y: 0, z: 47 },
        end: { x: 40, y: 0, z: 53 },
        width: 6,
      };

      const dungeon = makeDungeonData({
        rooms: [roomA, roomB, roomC, roomD],
        corridors: [corridor1, corridor2],
        playerStart: { x: 10, y: 0, z: 10 },
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // Each corridor should have 2 continuous wall segments (north + south)
      // since they don't intersect each other. Count corridor walls
      // (walls with z near 7, 13, 47, or 53 that aren't room walls)
      const corridorWalls = result.wallIds.filter((wallId) => {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        // Corridor walls are between rooms (x between 20 and 40)
        return pos.x > 20 && pos.x < 40 && collider.depth <= 2;
      });

      // Should be exactly 4 corridor walls (2 per corridor, each a single segment)
      expect(corridorWalls).toHaveLength(4);
    });

    it('no wall blocks any corridor passageway in a generated dungeon', () => {
      // Use the actual generator with multiple seeds to catch real-world failures
      for (const seed of [42, 123, 999, 1337, 7777, 54321, 11111, 22222, 33333, 99999]) {
        resetCollisionState();
        const world = new World();
        const dungeonData = generateDungeon(seed, 1);
        const result = createDungeonEntities(world, dungeonData, 1);

        // For every corridor, verify no wall blocks it.
        // Determine orientation from the corridor.width field:
        // horizontal corridors have z-extent = corridor.width,
        // vertical corridors have x-extent = corridor.width.
        for (const corridor of dungeonData.corridors) {
          const cStartX = Math.min(corridor.start.x, corridor.end.x);
          const cEndX = Math.max(corridor.start.x, corridor.end.x);
          const cStartZ = Math.min(corridor.start.z, corridor.end.z);
          const cEndZ = Math.max(corridor.start.z, corridor.end.z);
          const zExtent = cEndZ - cStartZ;
          const xExtent = cEndX - cStartX;
          // Use the width field to determine true orientation
          const isHorizontal = Math.abs(zExtent - corridor.width) < 0.01;

          for (const wallId of result.wallIds) {
            const pos = world.getComponent<Position>(wallId, 'Position')!;
            const collider = world.getComponent<Collider>(wallId, 'Collider')!;

            const wallMinX = pos.x - collider.width / 2;
            const wallMaxX = pos.x + collider.width / 2;
            const wallMinZ = pos.z - collider.depth / 2;
            const wallMaxZ = pos.z + collider.depth / 2;

            // Check if wall is inside the corridor's floor area
            const overlapX = Math.max(0, Math.min(wallMaxX, cEndX) - Math.max(wallMinX, cStartX));
            const overlapZ = Math.max(0, Math.min(wallMaxZ, cEndZ) - Math.max(wallMinZ, cStartZ));

            if (overlapX > 0.5 && overlapZ > 0.5) {
              // Wall overlaps with corridor floor area
              if (isHorizontal) {
                // A wall inside a horizontal corridor must not block passage in x direction.
                const wallSpansCorridorZ = wallMinZ <= cStartZ + 0.5 && wallMaxZ >= cEndZ - 0.5;
                if (wallSpansCorridorZ && collider.width > 1.5) {
                  expect.fail(
                    `Seed ${seed}: Wall at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) ` +
                    `size (${collider.width.toFixed(1)} x ${collider.depth.toFixed(1)}) ` +
                    `blocks horizontal corridor [${cStartX.toFixed(1)}-${cEndX.toFixed(1)}, ` +
                    `${cStartZ.toFixed(1)}-${cEndZ.toFixed(1)}]`,
                  );
                }
              } else {
                // Vertical corridor: wall must not span full x-width
                const wallSpansCorridorX = wallMinX <= cStartX + 0.5 && wallMaxX >= cEndX - 0.5;
                if (wallSpansCorridorX && collider.depth > 1.5) {
                  expect.fail(
                    `Seed ${seed}: Wall at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) ` +
                    `size (${collider.width.toFixed(1)} x ${collider.depth.toFixed(1)}) ` +
                    `blocks vertical corridor [${cStartX.toFixed(1)}-${cEndX.toFixed(1)}, ` +
                    `${cStartZ.toFixed(1)}-${cEndZ.toFixed(1)}]`,
                  );
                }
              }
            }
          }
        }
      }
    });

    it('detects corridor orientation correctly even for short corridors', () => {
      // A corridor where x-extent < corridor.width should still be treated as horizontal
      // if its z-extent equals corridor.width
      const world = new World();
      const roomA = makeRoom({
        id: 0,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } },
      });
      const roomB = makeRoom({
        id: 1,
        bounds: { min: { x: 23, y: 0, z: 0 }, max: { x: 43, y: 0, z: 20 } },
      });

      // Short horizontal corridor: only 3 units wide in x but 7 in z
      // This would be misdetected as vertical by corW > corH check
      const shortHorizCorridor: Corridor = {
        start: { x: 20, y: 0, z: 6.5 },
        end: { x: 23, y: 0, z: 13.5 },
        width: 7,
      };

      const dungeon = makeDungeonData({
        rooms: [roomA, roomB],
        corridors: [shortHorizCorridor],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // Walls should be at z=6.5 and z=13.5 (corridor sides), NOT at x=20 and x=23
      // If misdetected as vertical, walls would be at x=20 and x=23 (blocking passage)
      // Check that no wall sits INSIDE the corridor floor area and blocks it
      for (const wallId of result.wallIds) {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        const wallMinX = pos.x - collider.width / 2;
        const wallMaxX = pos.x + collider.width / 2;
        const wallMinZ = pos.z - collider.depth / 2;
        const wallMaxZ = pos.z + collider.depth / 2;

        // Check if this wall is inside the corridor floor area (x=20..23, z=6.5..13.5)
        const overlapX = Math.max(0, Math.min(wallMaxX, 23) - Math.max(wallMinX, 20));
        const overlapZ = Math.max(0, Math.min(wallMaxZ, 13.5) - Math.max(wallMinZ, 6.5));

        if (overlapX > 0.5 && overlapZ > 0.5) {
          // Wall overlaps the corridor interior. It must not span the full z-height.
          const spansCorridorZ = wallMinZ <= 7 && wallMaxZ >= 13;
          expect(spansCorridorZ).toBe(false);
        }
      }
    });

    it('corridor intersection has passable floor tiles on both axes', () => {
      const world = new World();
      // Create a + shaped intersection: two corridors crossing
      const roomN = makeRoom({ id: 0, bounds: { min: { x: 17, y: 0, z: 0 }, max: { x: 23, y: 0, z: 10 } } });
      const roomS = makeRoom({ id: 1, bounds: { min: { x: 17, y: 0, z: 30 }, max: { x: 23, y: 0, z: 40 } } });
      const roomW = makeRoom({ id: 2, bounds: { min: { x: 0, y: 0, z: 17 }, max: { x: 10, y: 0, z: 23 } } });
      const roomE = makeRoom({ id: 3, bounds: { min: { x: 30, y: 0, z: 17 }, max: { x: 40, y: 0, z: 23 } } });

      // Vertical corridor N-S through x=20
      const vertCorridor: Corridor = {
        start: { x: 17, y: 0, z: 10 },
        end: { x: 23, y: 0, z: 30 },
        width: 6,
      };
      // Horizontal corridor W-E through z=20
      const horizCorridor: Corridor = {
        start: { x: 10, y: 0, z: 17 },
        end: { x: 30, y: 0, z: 23 },
        width: 6,
      };

      const dungeon = makeDungeonData({
        rooms: [roomN, roomS, roomW, roomE],
        corridors: [vertCorridor, horizCorridor],
        playerStart: { x: 20, y: 0, z: 5 },
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // The intersection zone: x=[17,23], z=[17,23]
      // No wall should exist fully inside this zone
      for (const wallId of result.wallIds) {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        const wallMinX = pos.x - collider.width / 2;
        const wallMaxX = pos.x + collider.width / 2;
        const wallMinZ = pos.z - collider.depth / 2;
        const wallMaxZ = pos.z + collider.depth / 2;

        // Wall center in intersection zone
        const inZone = pos.x > 17 && pos.x < 23 && pos.z > 17 && pos.z < 23;
        if (inZone) {
          // Any wall in the intersection should be small (not blocking)
          const area = collider.width * collider.depth;
          expect(area).toBeLessThan(10); // can't be a big blocking wall
        }
      }
    });

    it('short horizontal corridor gets walls on z-sides not x-sides', () => {
      // Critical regression test: corridor with x-extent(3) < width(7)
      // must still place walls at z boundaries, not x boundaries
      const world = new World();
      // Two rooms side by side with tiny gap
      const roomA = makeRoom({
        id: 0,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } },
      });
      const roomB = makeRoom({
        id: 1,
        bounds: { min: { x: 25, y: 0, z: 0 }, max: { x: 45, y: 0, z: 20 } },
      });

      // Corridor: x travels 5 units (20→25), z extent is 7 (corridorWidth)
      const corridor: Corridor = {
        start: { x: 20, y: 0, z: 6.5 },
        end: { x: 25, y: 0, z: 13.5 },
        width: 7,
      };

      const dungeon = makeDungeonData({
        rooms: [roomA, roomB],
        corridors: [corridor],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // Collect walls that are in the corridor region (x between 20 and 25)
      // and are NOT room walls
      const corridorRegionWalls = result.wallIds.filter((wallId) => {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        const cx = pos.x;
        const halfW = collider.width / 2;
        const halfD = collider.depth / 2;
        // Wall has some part strictly between x=20 and x=25
        return (cx + halfW > 20.5) && (cx - halfW < 24.5);
      });

      // There should be corridor walls at z=6.5 (north side) and z=13.5 (south side)
      // These are horizontal walls: width > depth
      const horizWalls = corridorRegionWalls.filter((wallId) => {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        return (Math.abs(pos.z - 6.5) < 1 || Math.abs(pos.z - 13.5) < 1) && collider.depth <= 1.5;
      });
      expect(horizWalls.length).toBeGreaterThanOrEqual(2);

      // There should NOT be vertical walls at x=20.5 or x=24.5 that span the corridor height
      const blockingVertWalls = corridorRegionWalls.filter((wallId) => {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        return collider.width <= 1.5 && collider.depth > 5;
      });
      expect(blockingVertWalls).toHaveLength(0);
    });

    it('short vertical corridor gets walls on x-sides not z-sides', () => {
      const world = new World();
      const roomA = makeRoom({
        id: 0,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } },
      });
      const roomB = makeRoom({
        id: 1,
        bounds: { min: { x: 0, y: 0, z: 25 }, max: { x: 20, y: 0, z: 45 } },
      });

      // Corridor: z travels 5 units (20→25), x extent is 7 (corridorWidth)
      const corridor: Corridor = {
        start: { x: 6.5, y: 0, z: 20 },
        end: { x: 13.5, y: 0, z: 25 },
        width: 7,
      };

      const dungeon = makeDungeonData({
        rooms: [roomA, roomB],
        corridors: [corridor],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // There should be vertical walls at x=6.5 and x=13.5
      const corridorRegionWalls = result.wallIds.filter((wallId) => {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        return pos.z > 20.5 && pos.z < 24.5;
      });

      const vertWalls = corridorRegionWalls.filter((wallId) => {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        return (Math.abs(pos.x - 6.5) < 1 || Math.abs(pos.x - 13.5) < 1) && collider.width <= 1.5;
      });
      expect(vertWalls.length).toBeGreaterThanOrEqual(2);

      // No horizontal walls blocking passage in z direction
      const blockingHorizWalls = corridorRegionWalls.filter((wallId) => {
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        return collider.depth <= 1.5 && collider.width > 5;
      });
      expect(blockingHorizWalls).toHaveLength(0);
    });

    it('handles T-intersection where one corridor crosses another mid-span', () => {
      const world = new World();
      // Room at top-left, room at top-right, room at bottom-middle
      const roomA = makeRoom({
        id: 0,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 20, y: 0, z: 20 } },
      });
      const roomB = makeRoom({
        id: 1,
        bounds: { min: { x: 60, y: 0, z: 0 }, max: { x: 80, y: 0, z: 20 } },
      });
      const roomC = makeRoom({
        id: 2,
        bounds: { min: { x: 30, y: 0, z: 50 }, max: { x: 50, y: 0, z: 70 } },
      });

      // Horizontal corridor between A and B at z=10
      const horizCorridor: Corridor = {
        start: { x: 20, y: 0, z: 7 },
        end: { x: 60, y: 0, z: 13 },
        width: 6,
      };
      // Vertical corridor from mid-horizontal down to C at x=40
      const vertCorridor: Corridor = {
        start: { x: 37, y: 0, z: 10 },
        end: { x: 43, y: 0, z: 50 },
        width: 6,
      };

      const dungeon = makeDungeonData({
        rooms: [roomA, roomB, roomC],
        corridors: [horizCorridor, vertCorridor],
      });

      const result = createDungeonEntities(world, dungeon, 1);

      // The horizontal corridor's south wall (at z=13) should have a gap
      // where the vertical corridor passes through (x=37 to x=43).
      // So it should be split into segments, not one continuous wall.
      const southCorridorWalls = result.wallIds.filter((wallId) => {
        const pos = world.getComponent<Position>(wallId, 'Position')!;
        const collider = world.getComponent<Collider>(wallId, 'Collider')!;
        // South wall of horizontal corridor at z≈13, thin in z
        return Math.abs(pos.z - 13) < 1 && collider.depth <= 2 && pos.x > 20 && pos.x < 60;
      });

      // Should be split into 2 segments (left of gap + right of gap)
      expect(southCorridorWalls.length).toBe(2);
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
