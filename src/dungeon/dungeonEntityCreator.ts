import { World } from '../ecs/world.js';
import { GunType, PickupType } from '../ecs/components.js';
import type { Position, Collider } from '../ecs/components.js';
import {
  createWall,
  createFloor,
  createHazard,
  createDestructible,
  createDoor,
  createChest,
  createShop,
  createStairs,
  createSpawnZone,
  createBoss,
} from '../ecs/factories.js';
import { rebuildStatics } from '../systems/collisionDetectionSystem.js';
import type { CollisionEntity } from '../systems/collisionDetectionSystem.js';
import { getDesignParams } from '../config/designParams.js';
import type { DungeonData } from './dungeonData.js';
import type { EntityId, Vec3 } from '../types/index.js';

export interface DungeonEntityResult {
  wallIds: EntityId[];
  floorIds: EntityId[];
  hazardIds: EntityId[];
  destructibleIds: EntityId[];
  doorIds: EntityId[];
  chestIds: EntityId[];
  shopIds: EntityId[];
  stairsId: EntityId | null;
  spawnZoneIds: EntityId[];
  bossId: EntityId | null;
}

export function createDungeonEntities(
  world: World,
  dungeonData: DungeonData,
  depth: number,
): DungeonEntityResult {
  const params = getDesignParams();
  const isBossFloor = depth === params.dungeon.bossFloorDepth;
  const wt = params.dungeon.wallThickness;
  const wh = params.dungeon.wallHeight;

  const result: DungeonEntityResult = {
    wallIds: [],
    floorIds: [],
    hazardIds: [],
    destructibleIds: [],
    doorIds: [],
    chestIds: [],
    shopIds: [],
    stairsId: null,
    spawnZoneIds: [],
    bossId: null,
  };

  // Track wall positions to avoid duplicates at shared room boundaries
  const wallPositionSet = new Set<string>();

  function wallKey(x: number, z: number, sizeX: number, sizeZ: number): string {
    return `${x},${z},${sizeX},${sizeZ}`;
  }

  function addWall(position: Vec3, size: Vec3): EntityId | null {
    const key = wallKey(position.x, position.z, size.x, size.z);
    if (wallPositionSet.has(key)) return null;
    wallPositionSet.add(key);
    const id = createWall(world, position, size);
    result.wallIds.push(id);
    return id;
  }

  // Create room entities
  for (const room of dungeonData.rooms) {
    const min = room.bounds.min;
    const max = room.bounds.max;
    const roomW = max.x - min.x;
    const roomH = max.z - min.z;

    // Room walls (4 sides)
    // North wall
    addWall({ x: min.x + roomW / 2, y: 0, z: min.z }, { x: roomW + wt * 2, y: wh, z: wt });
    // South wall
    addWall({ x: min.x + roomW / 2, y: 0, z: max.z }, { x: roomW + wt * 2, y: wh, z: wt });
    // West wall
    addWall({ x: min.x, y: 0, z: min.z + roomH / 2 }, { x: wt, y: wh, z: roomH });
    // East wall
    addWall({ x: max.x, y: 0, z: min.z + roomH / 2 }, { x: wt, y: wh, z: roomH });

    // Floor tile for room
    const floorId = createFloor(
      world,
      { x: min.x + roomW / 2, y: 0, z: min.z + roomH / 2 },
      { x: roomW, y: 0, z: roomH },
    );
    result.floorIds.push(floorId);

    // Spawn zones
    for (const sp of room.spawnPoints) {
      const szId = createSpawnZone(
        world,
        sp.position,
        { x: roomW * params.dungeon.spawnZoneScale, y: roomH * params.dungeon.spawnZoneScale },
        sp.enemyTypes,
        sp.enemyCount,
      );
      result.spawnZoneIds.push(szId);
    }

    // Hazards
    for (const hp of room.hazardPlacements) {
      const hId = createHazard(world, hp.hazardType, hp.position, { x: hp.width, y: 1, z: hp.height });
      result.hazardIds.push(hId);
    }

    // Destructibles
    for (const dp of room.destructiblePlacements) {
      const dId = createDestructible(world, dp.position, { x: dp.width, y: dp.height, z: dp.depth }, dp.health);
      result.destructibleIds.push(dId);
    }

    // Chest
    if (room.hasChest) {
      const cx = (min.x + max.x) / 2 + params.dungeon.chestOffset;
      const cz = (min.z + max.z) / 2;
      const allGunTypes = [GunType.Pistol, GunType.SMG, GunType.AssaultRifle, GunType.Shotgun, GunType.LMG];
      const randomGun = allGunTypes[Math.floor(Math.random() * allGunTypes.length)];
      const chId = createChest(world, { x: cx, y: 0, z: cz }, randomGun);
      result.chestIds.push(chId);
    }

    // Shop
    if (room.hasShop) {
      const sx = (min.x + max.x) / 2 + params.dungeon.shopOffset;
      const sz = (min.z + max.z) / 2;
      const shId = createShop(world, { x: sx, y: 0, z: sz }, [
        {
          type: PickupType.HealthPickup,
          price: params.shop.healthPickupPrice,
          healAmount: params.shop.healthPickupHealAmount,
          sold: false,
        },
      ]);
      result.shopIds.push(shId);
    }
  }

  // Corridor walls and floor tiles
  for (const corridor of dungeonData.corridors) {
    const startX = Math.min(corridor.start.x, corridor.end.x);
    const endX = Math.max(corridor.start.x, corridor.end.x);
    const startZ = Math.min(corridor.start.z, corridor.end.z);
    const endZ = Math.max(corridor.start.z, corridor.end.z);
    const corW = endX - startX;
    const corH = endZ - startZ;

    // Floor tile for corridor
    if (corW > 0 || corH > 0) {
      const fId = createFloor(
        world,
        { x: startX + corW / 2, y: 0, z: startZ + corH / 2 },
        { x: corW, y: 0, z: corH },
      );
      result.floorIds.push(fId);
    }

    // Corridor walls: horizontal corridor has walls on north/south, vertical has walls on east/west
    if (corW > corH) {
      // Horizontal corridor - walls on top and bottom
      addWall({ x: startX + corW / 2, y: 0, z: startZ }, { x: corW, y: wh, z: wt });
      addWall({ x: startX + corW / 2, y: 0, z: endZ }, { x: corW, y: wh, z: wt });
    } else {
      // Vertical corridor - walls on left and right
      addWall({ x: startX, y: 0, z: startZ + corH / 2 }, { x: wt, y: wh, z: corH });
      addWall({ x: endX, y: 0, z: startZ + corH / 2 }, { x: wt, y: wh, z: corH });
    }

    // Door at corridor midpoint
    const midX = (corridor.start.x + corridor.end.x) / 2;
    const midZ = (corridor.start.z + corridor.end.z) / 2;
    const doorId = createDoor(world, { x: midX, y: 0, z: midZ });
    result.doorIds.push(doorId);
  }

  // Boss
  if (isBossFloor && dungeonData.rooms.length > 0) {
    const bossRoom = dungeonData.rooms[0];
    const bossPos: Vec3 = {
      x: (bossRoom.bounds.min.x + bossRoom.bounds.max.x) / 2,
      y: 0,
      z: (bossRoom.bounds.min.z + bossRoom.bounds.max.z) / 2,
    };
    result.bossId = createBoss(world, bossPos, depth);
  }

  // Stairs (not on boss floor)
  if (!isBossFloor) {
    const stairsId = createStairs(world, dungeonData.stairsPosition, depth + 1);
    result.stairsId = stairsId;
  }

  // Rebuild spatial hash with all static colliders
  rebuildStaticColliders(world);

  return result;
}

export function rebuildStaticColliders(world: World): void {
  const allEntities = world.query(['Position', 'Collider']);
  const staticColliders: CollisionEntity[] = [];
  for (const id of allEntities) {
    const collider = world.getComponent<Collider>(id, 'Collider')!;
    if (collider.isStatic) {
      const position = world.getComponent<Position>(id, 'Position')!;
      staticColliders.push({ id, position, collider });
    }
  }
  rebuildStatics(staticColliders);
}

export function setPlayerStartPosition(
  world: World,
  playerId: EntityId,
  startPosition: Vec3,
): void {
  const pos = world.getComponent<Position>(playerId, 'Position');
  if (pos) {
    pos.x = startPosition.x;
    pos.y = startPosition.y;
    pos.z = startPosition.z;
  }
  const prevPos = world.getComponent<Position>(playerId, 'PreviousPosition');
  if (prevPos) {
    prevPos.x = startPosition.x;
    prevPos.y = startPosition.y;
    prevPos.z = startPosition.z;
  }
}
