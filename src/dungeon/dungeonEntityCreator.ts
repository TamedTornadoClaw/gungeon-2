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
import type { DungeonData, Room, Corridor } from './dungeonData.js';
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

/** Represents a gap in a wall segment where a corridor connects */
interface WallGap {
  /** Start position along the wall axis */
  start: number;
  /** End position along the wall axis */
  end: number;
}

/** Check if a point is inside a room's bounds */
function pointInsideRoom(px: number, pz: number, room: Room): boolean {
  return (
    px >= room.bounds.min.x &&
    px <= room.bounds.max.x &&
    pz >= room.bounds.min.z &&
    pz <= room.bounds.max.z
  );
}

/**
 * Find where corridors intersect a given wall of a room.
 * Returns gaps (in the wall's lateral axis) where doors connect.
 */
function findWallGaps(
  room: Room,
  wall: 'north' | 'south' | 'east' | 'west',
  corridors: Corridor[],
): WallGap[] {
  const min = room.bounds.min;
  const max = room.bounds.max;
  const gaps: WallGap[] = [];

  for (const corridor of corridors) {
    const cStartX = Math.min(corridor.start.x, corridor.end.x);
    const cEndX = Math.max(corridor.start.x, corridor.end.x);
    const cStartZ = Math.min(corridor.start.z, corridor.end.z);
    const cEndZ = Math.max(corridor.start.z, corridor.end.z);

    switch (wall) {
      case 'north': {
        // North wall is at min.z, horizontal wall. Corridor must touch this z and overlap in x.
        if (cStartZ <= min.z && cEndZ >= min.z) {
          const overlapStart = Math.max(cStartX, min.x);
          const overlapEnd = Math.min(cEndX, max.x);
          if (overlapStart < overlapEnd) {
            gaps.push({ start: overlapStart, end: overlapEnd });
          }
        }
        break;
      }
      case 'south': {
        // South wall is at max.z
        if (cStartZ <= max.z && cEndZ >= max.z) {
          const overlapStart = Math.max(cStartX, min.x);
          const overlapEnd = Math.min(cEndX, max.x);
          if (overlapStart < overlapEnd) {
            gaps.push({ start: overlapStart, end: overlapEnd });
          }
        }
        break;
      }
      case 'west': {
        // West wall is at min.x, vertical wall
        if (cStartX <= min.x && cEndX >= min.x) {
          const overlapStart = Math.max(cStartZ, min.z);
          const overlapEnd = Math.min(cEndZ, max.z);
          if (overlapStart < overlapEnd) {
            gaps.push({ start: overlapStart, end: overlapEnd });
          }
        }
        break;
      }
      case 'east': {
        // East wall is at max.x
        if (cStartX <= max.x && cEndX >= max.x) {
          const overlapStart = Math.max(cStartZ, min.z);
          const overlapEnd = Math.min(cEndZ, max.z);
          if (overlapStart < overlapEnd) {
            gaps.push({ start: overlapStart, end: overlapEnd });
          }
        }
        break;
      }
    }
  }

  // Sort gaps by start position
  gaps.sort((a, b) => a.start - b.start);
  return gaps;
}

/**
 * Create wall segments along a wall axis, leaving gaps where corridors connect.
 */
function createWallWithGaps(
  wallStart: number,
  wallEnd: number,
  fixedCoord: number,
  orientation: 'horizontal' | 'vertical',
  gaps: WallGap[],
  wt: number,
  wh: number,
  addWallFn: (position: Vec3, size: Vec3) => EntityId | null,
): void {
  if (gaps.length === 0) {
    const length = wallEnd - wallStart;
    const mid = wallStart + length / 2;
    if (orientation === 'horizontal') {
      addWallFn({ x: mid, y: 0, z: fixedCoord }, { x: length, y: wh, z: wt });
    } else {
      addWallFn({ x: fixedCoord, y: 0, z: mid }, { x: wt, y: wh, z: length });
    }
    return;
  }

  let cursor = wallStart;
  for (const gap of gaps) {
    if (gap.start > cursor) {
      const segLen = gap.start - cursor;
      const segMid = cursor + segLen / 2;
      if (orientation === 'horizontal') {
        addWallFn({ x: segMid, y: 0, z: fixedCoord }, { x: segLen, y: wh, z: wt });
      } else {
        addWallFn({ x: fixedCoord, y: 0, z: segMid }, { x: wt, y: wh, z: segLen });
      }
    }
    cursor = gap.end;
  }

  if (cursor < wallEnd) {
    const segLen = wallEnd - cursor;
    const segMid = cursor + segLen / 2;
    if (orientation === 'horizontal') {
      addWallFn({ x: segMid, y: 0, z: fixedCoord }, { x: segLen, y: wh, z: wt });
    } else {
      addWallFn({ x: fixedCoord, y: 0, z: segMid }, { x: wt, y: wh, z: segLen });
    }
  }
}

/**
 * Clip corridor wall endpoints to stop at room boundaries.
 */
function clipCorridorToRoomEdges(
  corridorStart: number,
  corridorEnd: number,
  crossStart: number,
  crossEnd: number,
  isHorizontal: boolean,
  rooms: Room[],
): { clippedStart: number; clippedEnd: number } {
  let clippedStart = corridorStart;
  let clippedEnd = corridorEnd;
  const crossMid = (crossStart + crossEnd) / 2;

  for (const room of rooms) {
    const rMin = room.bounds.min;
    const rMax = room.bounds.max;

    if (isHorizontal) {
      if (crossMid >= rMin.z && crossMid <= rMax.z) {
        if (clippedStart >= rMin.x && clippedStart <= rMax.x) {
          clippedStart = rMax.x;
        }
        if (clippedEnd >= rMin.x && clippedEnd <= rMax.x) {
          clippedEnd = rMin.x;
        }
      }
    } else {
      if (crossMid >= rMin.x && crossMid <= rMax.x) {
        if (clippedStart >= rMin.z && clippedStart <= rMax.z) {
          clippedStart = rMax.z;
        }
        if (clippedEnd >= rMin.z && clippedEnd <= rMax.z) {
          clippedEnd = rMin.z;
        }
      }
    }
  }

  return { clippedStart, clippedEnd };
}

/**
 * Find positions where doors should be placed at room wall boundaries.
 */
function findDoorPositions(corridor: Corridor, rooms: Room[]): Vec3[] {
  const positions: Vec3[] = [];
  const cStartX = Math.min(corridor.start.x, corridor.end.x);
  const cEndX = Math.max(corridor.start.x, corridor.end.x);
  const cStartZ = Math.min(corridor.start.z, corridor.end.z);
  const cEndZ = Math.max(corridor.start.z, corridor.end.z);
  const corW = cEndX - cStartX;
  const corH = cEndZ - cStartZ;
  const isHorizontal = corW > corH;

  for (const room of rooms) {
    const rMin = room.bounds.min;
    const rMax = room.bounds.max;

    if (isHorizontal) {
      const midZ = (cStartZ + cEndZ) / 2;
      if (midZ >= rMin.z && midZ <= rMax.z) {
        if (cStartX >= rMin.x && cStartX <= rMax.x && cEndX > rMax.x) {
          positions.push({ x: rMax.x, y: 0, z: midZ });
        }
        if (cEndX >= rMin.x && cEndX <= rMax.x && cStartX < rMin.x) {
          positions.push({ x: rMin.x, y: 0, z: midZ });
        }
      }
    } else {
      const midX = (cStartX + cEndX) / 2;
      if (midX >= rMin.x && midX <= rMax.x) {
        if (cStartZ >= rMin.z && cStartZ <= rMax.z && cEndZ > rMax.z) {
          positions.push({ x: midX, y: 0, z: rMax.z });
        }
        if (cEndZ >= rMin.z && cEndZ <= rMax.z && cStartZ < rMin.z) {
          positions.push({ x: midX, y: 0, z: rMin.z });
        }
      }
    }
  }

  return positions;
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

  // Determine the starting room (room containing playerStart) for spawn zone suppression (#396)
  const startingRoom = dungeonData.rooms.find((room) =>
    pointInsideRoom(dungeonData.playerStart.x, dungeonData.playerStart.z, room),
  );

  // Create room entities
  for (const room of dungeonData.rooms) {
    const min = room.bounds.min;
    const max = room.bounds.max;
    const roomW = max.x - min.x;
    const roomH = max.z - min.z;

    // Find wall gaps from corridors for each wall side (#404)
    const northGaps = findWallGaps(room, 'north', dungeonData.corridors);
    const southGaps = findWallGaps(room, 'south', dungeonData.corridors);
    const westGaps = findWallGaps(room, 'west', dungeonData.corridors);
    const eastGaps = findWallGaps(room, 'east', dungeonData.corridors);

    // Room walls with gaps where corridors connect (#403: roomW not roomW+wt*2, #404: gaps for doors)
    // North wall (at min.z)
    createWallWithGaps(min.x, max.x, min.z, 'horizontal', northGaps, wt, wh, addWall);
    // South wall (at max.z)
    createWallWithGaps(min.x, max.x, max.z, 'horizontal', southGaps, wt, wh, addWall);
    // West wall (at min.x)
    createWallWithGaps(min.z, max.z, min.x, 'vertical', westGaps, wt, wh, addWall);
    // East wall (at max.x)
    createWallWithGaps(min.z, max.z, max.x, 'vertical', eastGaps, wt, wh, addWall);

    // Floor tile for room
    const floorId = createFloor(
      world,
      { x: min.x + roomW / 2, y: 0, z: min.z + roomH / 2 },
      { x: roomW, y: 0, z: roomH },
    );
    result.floorIds.push(floorId);

    // Spawn zones — skip in starting room to prevent instant player death (#396)
    const isStartingRoom = startingRoom === room;
    if (!isStartingRoom) {
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
    const isHorizontal = corW > corH;

    // Floor tile for corridor
    if (corW > 0 || corH > 0) {
      const fId = createFloor(
        world,
        { x: startX + corW / 2, y: 0, z: startZ + corH / 2 },
        { x: corW, y: 0, z: corH },
      );
      result.floorIds.push(fId);
    }

    // Corridor walls clipped to room boundaries (#407)
    if (isHorizontal) {
      const { clippedStart, clippedEnd } = clipCorridorToRoomEdges(
        startX, endX, startZ, endZ, true, dungeonData.rooms,
      );
      if (clippedEnd > clippedStart) {
        const clippedW = clippedEnd - clippedStart;
        const cx = clippedStart + clippedW / 2;
        addWall({ x: cx, y: 0, z: startZ }, { x: clippedW, y: wh, z: wt });
        addWall({ x: cx, y: 0, z: endZ }, { x: clippedW, y: wh, z: wt });
      }
    } else {
      const { clippedStart, clippedEnd } = clipCorridorToRoomEdges(
        startZ, endZ, startX, endX, false, dungeonData.rooms,
      );
      if (clippedEnd > clippedStart) {
        const clippedH = clippedEnd - clippedStart;
        const cz = clippedStart + clippedH / 2;
        addWall({ x: startX, y: 0, z: cz }, { x: wt, y: wh, z: clippedH });
        addWall({ x: endX, y: 0, z: cz }, { x: wt, y: wh, z: clippedH });
      }
    }

    // Doors placed at room boundary exits, not corridor midpoint (#404)
    const doorPositions = findDoorPositions(corridor, dungeonData.rooms);
    for (const doorPos of doorPositions) {
      const doorId = createDoor(world, doorPos);
      result.doorIds.push(doorId);
    }

    // Fallback: if no room boundaries found, place door at midpoint
    if (doorPositions.length === 0) {
      const midX = (corridor.start.x + corridor.end.x) / 2;
      const midZ = (corridor.start.z + corridor.end.z) / 2;
      const doorId = createDoor(world, { x: midX, y: 0, z: midZ });
      result.doorIds.push(doorId);
    }
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
