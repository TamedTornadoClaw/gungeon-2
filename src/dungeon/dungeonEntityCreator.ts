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
  createEnemy,
  createBoss,
} from '../ecs/factories.js';
import { rebuildStatics } from '../systems/collisionDetectionSystem.js';
import { rebuildDungeonTree } from '../systems/visibilitySystem.js';
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

/** Check if a point is inside a room's bounds */
function pointInsideRoom(px: number, pz: number, room: Room): boolean {
  return (
    px >= room.bounds.min.x &&
    px <= room.bounds.max.x &&
    pz >= room.bounds.min.z &&
    pz <= room.bounds.max.z
  );
}

interface DoorPlacement {
  position: Vec3;
  /** true when the door spans the X axis (blocks a vertical corridor) */
  spansX: boolean;
}

/**
 * Find positions where doors should be placed at room wall boundaries.
 * Returns orientation so the door can be sized to fill the corridor opening.
 */
function findDoorPositions(corridor: Corridor, rooms: Room[]): DoorPlacement[] {
  const placements: DoorPlacement[] = [];
  const cStartX = Math.min(corridor.start.x, corridor.end.x);
  const cEndX = Math.max(corridor.start.x, corridor.end.x);
  const cStartZ = Math.min(corridor.start.z, corridor.end.z);
  const cEndZ = Math.max(corridor.start.z, corridor.end.z);
  const corH = cEndZ - cStartZ;
  const isHorizontal = Math.abs(corH - corridor.width) < 0.01;

  for (const room of rooms) {
    const rMin = room.bounds.min;
    const rMax = room.bounds.max;

    if (isHorizontal) {
      // Corridor runs along X — door blocks X movement, spans Z axis
      const midZ = (cStartZ + cEndZ) / 2;
      if (midZ >= rMin.z && midZ <= rMax.z) {
        if (cStartX >= rMin.x && cStartX <= rMax.x && cEndX > rMax.x) {
          placements.push({ position: { x: rMax.x, y: 0, z: midZ }, spansX: false });
        }
        if (cEndX >= rMin.x && cEndX <= rMax.x && cStartX < rMin.x) {
          placements.push({ position: { x: rMin.x, y: 0, z: midZ }, spansX: false });
        }
      }
    } else {
      // Corridor runs along Z — door blocks Z movement, spans X axis
      const midX = (cStartX + cEndX) / 2;
      if (midX >= rMin.x && midX <= rMax.x) {
        if (cStartZ >= rMin.z && cStartZ <= rMax.z && cEndZ > rMax.z) {
          placements.push({ position: { x: midX, y: 0, z: rMax.z }, spansX: true });
        }
        if (cEndZ >= rMin.z && cEndZ <= rMax.z && cStartZ < rMin.z) {
          placements.push({ position: { x: midX, y: 0, z: rMin.z }, spansX: true });
        }
      }
    }
  }

  return placements;
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

  // ── Step 1: Build floor coverage grid ────────────────────────────────────
  const floorCoverage = new Set<string>();

  // Add room tiles to grid
  for (const room of dungeonData.rooms) {
    const min = room.bounds.min;
    const max = room.bounds.max;
    for (let x = Math.floor(min.x); x < Math.ceil(max.x); x++) {
      for (let z = Math.floor(min.z); z < Math.ceil(max.z); z++) {
        floorCoverage.add(`${x},${z}`);
      }
    }
  }

  // Add corridor tiles to grid
  for (const corridor of dungeonData.corridors) {
    const startX = Math.min(corridor.start.x, corridor.end.x);
    const endX = Math.max(corridor.start.x, corridor.end.x);
    const startZ = Math.min(corridor.start.z, corridor.end.z);
    const endZ = Math.max(corridor.start.z, corridor.end.z);
    for (let x = Math.floor(startX); x < Math.ceil(endX); x++) {
      for (let z = Math.floor(startZ); z < Math.ceil(endZ); z++) {
        floorCoverage.add(`${x},${z}`);
      }
    }
  }

  // ── Step 2: Create room contents (hazards, destructibles, chests, etc.) ─
  for (const room of dungeonData.rooms) {
    const min = room.bounds.min;
    const max = room.bounds.max;
    const roomW = max.x - min.x;
    const roomH = max.z - min.z;

    // Pre-place enemies in rooms — skip starting room (#396)
    const isStartingRoom = startingRoom === room;
    if (!isStartingRoom) {
      const halfW = roomW * params.dungeon.spawnZoneScale / 2;
      const halfH = roomH * params.dungeon.spawnZoneScale / 2;

      for (const sp of room.spawnPoints) {
        for (let i = 0; i < sp.enemyCount; i++) {
          const enemyType = sp.enemyTypes[Math.floor(Math.random() * sp.enemyTypes.length)];
          const x = sp.position.x - halfW + Math.random() * halfW * 2;
          const z = sp.position.z - halfH + Math.random() * halfH * 2;
          createEnemy(world, enemyType, { x, y: 0, z }, depth - 1, false);
        }
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

  // ── Step 3: Create floor entities via flood-fill + greedy rect merge ────
  // Flood-fill finds connected floor regions, then greedily merges tiles
  // into maximal-width rectangles (up to MAX_FLOOR_RECT tiles per side).
  // This produces ~1 entity per room + a few for corridors, with no seams.
  const MAX_FLOOR_RECT = 64;
  const visited = new Set<string>();

  for (const key of floorCoverage) {
    if (visited.has(key)) continue;

    // Parse seed tile
    const [xStr, zStr] = key.split(',');
    const seedX = parseInt(xStr, 10);
    const seedZ = parseInt(zStr, 10);

    // Greedy rectangle expansion from this tile:
    // 1. Expand width (x) as far as possible
    let maxX = seedX;
    while (
      maxX - seedX < MAX_FLOOR_RECT &&
      floorCoverage.has(`${maxX + 1},${seedZ}`) &&
      !visited.has(`${maxX + 1},${seedZ}`)
    ) {
      maxX++;
    }

    // 2. Expand height (z) as far as all columns in the row are present
    let maxZ = seedZ;
    let canExpand = true;
    while (canExpand && maxZ - seedZ < MAX_FLOOR_RECT) {
      const nextZ = maxZ + 1;
      for (let x = seedX; x <= maxX; x++) {
        const k = `${x},${nextZ}`;
        if (!floorCoverage.has(k) || visited.has(k)) {
          canExpand = false;
          break;
        }
      }
      if (canExpand) maxZ = nextZ;
    }

    // Mark all tiles in this rect as visited
    for (let x = seedX; x <= maxX; x++) {
      for (let z = seedZ; z <= maxZ; z++) {
        visited.add(`${x},${z}`);
      }
    }

    // Create floor entity for this rect
    const w = maxX - seedX + 1;
    const h = maxZ - seedZ + 1;
    const fId = createFloor(
      world,
      { x: seedX + w / 2, y: 0, z: seedZ + h / 2 },
      { x: w, y: 0, z: h },
    );
    result.floorIds.push(fId);
  }

  // ── Step 4: Generate walls from grid boundaries ────────────────────────
  // Scan every floor tile and find edges adjacent to non-floor.
  // Collect edge segments grouped by fixed coordinate for merging.
  const hEdges = new Map<number, number[]>(); // z-coord → sorted x positions
  const vEdges = new Map<number, number[]>(); // x-coord → sorted z positions

  for (const key of floorCoverage) {
    const [xStr, zStr] = key.split(',');
    const x = parseInt(xStr, 10);
    const z = parseInt(zStr, 10);

    // North edge: tile (x,z) is floor, (x,z-1) is not → wall at z boundary
    if (!floorCoverage.has(`${x},${z - 1}`)) {
      const arr = hEdges.get(z) ?? [];
      arr.push(x);
      hEdges.set(z, arr);
    }
    // South edge: tile (x,z) is floor, (x,z+1) is not → wall at z+1 boundary
    if (!floorCoverage.has(`${x},${z + 1}`)) {
      const arr = hEdges.get(z + 1) ?? [];
      arr.push(x);
      hEdges.set(z + 1, arr);
    }
    // West edge: tile (x,z) is floor, (x-1,z) is not → wall at x boundary
    if (!floorCoverage.has(`${x - 1},${z}`)) {
      const arr = vEdges.get(x) ?? [];
      arr.push(z);
      vEdges.set(x, arr);
    }
    // East edge: tile (x,z) is floor, (x+1,z) is not → wall at x+1 boundary
    if (!floorCoverage.has(`${x + 1},${z}`)) {
      const arr = vEdges.get(x + 1) ?? [];
      arr.push(z);
      vEdges.set(x + 1, arr);
    }
  }

  // Merge adjacent edge tiles into wall segments and create entities
  for (const [z, xArr] of hEdges) {
    xArr.sort((a, b) => a - b);
    // Deduplicate (a tile could be added twice from both sides)
    const xs = [...new Set(xArr)].sort((a, b) => a - b);
    let segStart = xs[0];
    let segEnd = segStart + 1;
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] === segEnd) {
        segEnd = xs[i] + 1;
      } else {
        const len = segEnd - segStart;
        const mid = segStart + len / 2;
        addWall({ x: mid, y: 0, z }, { x: len, y: wh, z: wt });
        segStart = xs[i];
        segEnd = segStart + 1;
      }
    }
    const len = segEnd - segStart;
    const mid = segStart + len / 2;
    addWall({ x: mid, y: 0, z }, { x: len, y: wh, z: wt });
  }

  for (const [x, zArr] of vEdges) {
    zArr.sort((a, b) => a - b);
    const zs = [...new Set(zArr)].sort((a, b) => a - b);
    let segStart = zs[0];
    let segEnd = segStart + 1;
    for (let i = 1; i < zs.length; i++) {
      if (zs[i] === segEnd) {
        segEnd = zs[i] + 1;
      } else {
        const len = segEnd - segStart;
        const mid = segStart + len / 2;
        addWall({ x, y: 0, z: mid }, { x: wt, y: wh, z: len });
        segStart = zs[i];
        segEnd = segStart + 1;
      }
    }
    const len = segEnd - segStart;
    const mid = segStart + len / 2;
    addWall({ x, y: 0, z: mid }, { x: wt, y: wh, z: len });
  }

  // ── Step 5: Create doors at room/corridor boundaries ───────────────────
  const corridorWidth = params.dungeon.corridorWidth;
  for (const corridor of dungeonData.corridors) {
    const doorPlacements = findDoorPositions(corridor, dungeonData.rooms);
    for (const dp of doorPlacements) {
      const doorId = createDoor(world, dp.position, dp.spansX, corridorWidth);
      result.doorIds.push(doorId);
    }
    if (doorPlacements.length === 0) {
      const midX = (corridor.start.x + corridor.end.x) / 2;
      const midZ = (corridor.start.z + corridor.end.z) / 2;
      // Determine orientation from corridor direction
      const cStartZ = Math.min(corridor.start.z, corridor.end.z);
      const cEndZ = Math.max(corridor.start.z, corridor.end.z);
      const corH = cEndZ - cStartZ;
      const isHorizontal = Math.abs(corH - corridor.width) < 0.01;
      const doorId = createDoor(world, { x: midX, y: 0, z: midZ }, !isHorizontal, corridorWidth);
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
  rebuildDungeonTree(world);
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
