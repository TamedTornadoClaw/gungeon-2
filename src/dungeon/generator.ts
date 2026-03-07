import { getDesignParams } from '../config/designParams.js';
import { EnemyType, GunType, HazardType } from '../ecs/components.js';
import type { Vec3 } from '../types/index.js';
import type {
  Corridor,
  DestructiblePlacement,
  DungeonData,
  HazardPlacement,
  Room,
  SpawnPoint,
} from './dungeonData.js';

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededIntRange(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// ── Room placement ──────────────────────────────────────────────────────────

interface Rect {
  x: number;
  z: number;
  w: number;
  h: number;
}

function rectsOverlap(a: Rect, b: Rect, padding: number): boolean {
  return !(
    a.x + a.w + padding <= b.x ||
    b.x + b.w + padding <= a.x ||
    a.z + a.h + padding <= b.z ||
    b.z + b.h + padding <= a.z
  );
}

function placeRooms(
  rng: () => number,
  count: number,
  minSize: number,
  maxSize: number,
): Rect[] {
  const rooms: Rect[] = [];
  const spacing = 12; // minimum gap between rooms for corridors

  for (let i = 0; i < count; i++) {
    const w = seededIntRange(rng, minSize, maxSize);
    const h = seededIntRange(rng, minSize, maxSize);

    let placed = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = seededIntRange(rng, 0, count * maxSize);
      const z = seededIntRange(rng, 0, count * maxSize);
      const candidate: Rect = { x, z, w, h };

      let overlaps = false;
      for (const existing of rooms) {
        if (rectsOverlap(candidate, existing, spacing)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        rooms.push(candidate);
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Fallback: place far away to guarantee no overlap
      const offset = rooms.length > 0
        ? Math.max(...rooms.map(r => r.x + r.w + r.z + r.h)) + spacing + maxSize
        : 0;
      rooms.push({ x: offset, z: offset, w, h });
    }
  }

  return rooms;
}

// ── Corridor connection (MST via Prim's to guarantee full connectivity) ─────

function roomCenter(r: Rect): { cx: number; cz: number } {
  return { cx: r.x + r.w / 2, cz: r.z + r.h / 2 };
}

function distance(a: Rect, b: Rect): number {
  const ac = roomCenter(a);
  const bc = roomCenter(b);
  return Math.abs(ac.cx - bc.cx) + Math.abs(ac.cz - bc.cz);
}

function buildMST(rooms: Rect[]): [number, number][] {
  const n = rooms.length;
  if (n <= 1) return [];

  const inMST = new Set<number>([0]);
  const edges: [number, number][] = [];

  while (inMST.size < n) {
    let bestDist = Infinity;
    let bestFrom = -1;
    let bestTo = -1;

    for (const from of inMST) {
      for (let to = 0; to < n; to++) {
        if (inMST.has(to)) continue;
        const d = distance(rooms[from], rooms[to]);
        if (d < bestDist) {
          bestDist = d;
          bestFrom = from;
          bestTo = to;
        }
      }
    }

    edges.push([bestFrom, bestTo]);
    inMST.add(bestTo);
  }

  return edges;
}

function createCorridors(rooms: Rect[], edges: [number, number][], corridorWidth: number): Corridor[] {
  const corridors: Corridor[] = [];

  for (const [fromIdx, toIdx] of edges) {
    const from = roomCenter(rooms[fromIdx]);
    const to = roomCenter(rooms[toIdx]);

    // L-shaped corridor: horizontal then vertical
    const midX = to.cx;
    const midZ = from.cz;

    // Horizontal segment
    if (Math.abs(from.cx - midX) > 0.1) {
      corridors.push({
        start: { x: Math.min(from.cx, midX), y: 0, z: from.cz - corridorWidth / 2 },
        end: { x: Math.max(from.cx, midX), y: 0, z: from.cz + corridorWidth / 2 },
        width: corridorWidth,
      });
    }

    // Vertical segment
    if (Math.abs(midZ - to.cz) > 0.1) {
      corridors.push({
        start: { x: midX - corridorWidth / 2, y: 0, z: Math.min(midZ, to.cz) },
        end: { x: midX + corridorWidth / 2, y: 0, z: Math.max(midZ, to.cz) },
        width: corridorWidth,
      });
    }
  }

  return corridors;
}

// ── Room content population ─────────────────────────────────────────────────

const ALL_ENEMY_TYPES: EnemyType[] = [
  EnemyType.KnifeRusher,
  EnemyType.ShieldGun,
  EnemyType.Shotgunner,
  EnemyType.Rifleman,
  EnemyType.SuicideBomber,
];

const ALL_GUN_TYPES: GunType[] = [
  GunType.Pistol,
  GunType.SMG,
  GunType.AssaultRifle,
  GunType.Shotgun,
  GunType.LMG,
];

const ALL_HAZARD_TYPES: HazardType[] = [
  HazardType.Fire,
  HazardType.Spikes,
  HazardType.Water,
];

function populateRoom(
  rng: () => number,
  rect: Rect,
  roomIndex: number,
  isStairsRoom: boolean,
  hasChest: boolean,
  hasShop: boolean,
  enemiesMin: number,
  enemiesMax: number,
): Room {
  const spawnPoints: SpawnPoint[] = [];
  const hazardPlacements: HazardPlacement[] = [];
  const destructiblePlacements: DestructiblePlacement[] = [];

  if (!isStairsRoom) {
    // Add enemy spawn zone
    const enemyCount = seededIntRange(rng, enemiesMin, enemiesMax);
    // Pick 2-3 enemy types for variety
    const typeCount = seededIntRange(rng, 2, Math.min(3, ALL_ENEMY_TYPES.length));
    const shuffled = [...ALL_ENEMY_TYPES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const enemyTypes = shuffled.slice(0, typeCount);

    const cx = rect.x + rect.w / 2;
    const cz = rect.z + rect.h / 2;

    spawnPoints.push({
      position: { x: cx, y: 0, z: cz },
      enemyTypes,
      enemyCount,
    });

    // Possibly add hazards (30% chance per room)
    if (rng() < 0.3) {
      const hazardType = ALL_HAZARD_TYPES[Math.floor(rng() * ALL_HAZARD_TYPES.length)];
      const hx = rect.x + 4 + rng() * (rect.w - 8);
      const hz = rect.z + 4 + rng() * (rect.h - 8);
      hazardPlacements.push({
        position: { x: hx, y: 0, z: hz },
        width: 4,
        height: 4,
        hazardType,
      });
    }

    // Add destructibles (1-3 per room)
    const destructibleCount = seededIntRange(rng, 1, 3);
    for (let d = 0; d < destructibleCount; d++) {
      const dx = rect.x + 3 + rng() * (rect.w - 6);
      const dz = rect.z + 3 + rng() * (rect.h - 6);
      destructiblePlacements.push({
        position: { x: dx, y: 0, z: dz },
        width: 2,
        height: 2,
        depth: 2,
        health: 30,
      });
    }
  }

  return {
    id: roomIndex,
    bounds: {
      min: { x: rect.x, y: 0, z: rect.z },
      max: { x: rect.x + rect.w, y: 0, z: rect.z + rect.h },
    },
    spawnPoints,
    hazardPlacements,
    destructiblePlacements,
    hasChest,
    hasShop,
  };
}

// ── Main generator ──────────────────────────────────────────────────────────

export function generateDungeon(seed: number, depth: number): DungeonData {
  const rng = mulberry32(seed);
  const params = getDesignParams().dungeon;

  const isBossFloor = depth === params.bossFloorDepth;

  // Boss floor: single large room
  if (isBossFloor) {
    const bossRoom: Room = {
      id: 0,
      bounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: params.roomMaxSize, y: 0, z: params.roomMaxSize },
      },
      spawnPoints: [],
      hazardPlacements: [],
      destructiblePlacements: [],
      hasChest: false,
      hasShop: false,
    };

    const center: Vec3 = {
      x: params.roomMaxSize / 2,
      y: 0,
      z: params.roomMaxSize / 2,
    };

    return {
      rooms: [bossRoom],
      corridors: [],
      playerStart: { x: center.x, y: 0, z: center.z - 15 },
      stairsPosition: { x: center.x, y: 0, z: center.z + 15 },
    };
  }

  // Normal floor
  const rects = placeRooms(rng, params.roomsPerFloor, params.roomMinSize, params.roomMaxSize);
  const mstEdges = buildMST(rects);
  const corridors = createCorridors(rects, mstEdges, params.corridorWidth);

  // Determine shop placement (at most one per floor, floor-level roll)
  let shopRoomIndex = -1;
  if (rng() < params.shopChancePerFloor) {
    // Place shop in a random non-first, non-last room
    const candidates = [];
    for (let i = 1; i < rects.length - 1; i++) {
      candidates.push(i);
    }
    if (candidates.length > 0) {
      shopRoomIndex = candidates[Math.floor(rng() * candidates.length)];
    } else if (rects.length > 1) {
      shopRoomIndex = 1;
    }
  }

  // Build rooms
  const stairsRoomIndex = rects.length - 1;
  const rooms: Room[] = rects.map((rect, i) => {
    const isStairsRoom = i === stairsRoomIndex;
    const hasChest = !isStairsRoom && rng() < params.chestChancePerRoom;
    const hasShop = i === shopRoomIndex;

    return populateRoom(
      rng,
      rect,
      i,
      isStairsRoom,
      hasChest,
      hasShop,
      params.enemiesPerRoom.min,
      params.enemiesPerRoom.max,
    );
  });

  // Player starts in the center of the first room
  const firstCenter = roomCenter(rects[0]);
  const playerStart: Vec3 = { x: firstCenter.cx, y: 0, z: firstCenter.cz };

  // Stairs in center of last room
  const lastCenter = roomCenter(rects[stairsRoomIndex]);
  const stairsPosition: Vec3 = { x: lastCenter.cx, y: 0, z: lastCenter.cz };

  return {
    rooms,
    corridors,
    playerStart,
    stairsPosition,
  };
}

// ── Helper: pick a random gun type for chests ───────────────────────────────

export function randomGunType(rng: () => number): GunType {
  return ALL_GUN_TYPES[Math.floor(rng() * ALL_GUN_TYPES.length)];
}

// Re-export for testing
export { mulberry32, placeRooms, buildMST, seededIntRange, ALL_GUN_TYPES };
