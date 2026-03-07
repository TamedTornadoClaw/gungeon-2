/**
 * CollisionDetectionSystem — spatial hash grid broad-phase + AABB narrow-phase.
 *
 * Detects AABB overlaps on the X/Z plane (top-down game, Y is height).
 * Uses Collider.width for X extent and Collider.depth for Z extent.
 *
 * System execution order: 5 (after movementSystem, before damageSystem).
 *
 * Integration: Called by the game loop each fixed-timestep tick.
 * Produces CollisionPair[] consumed by CollisionResponseSystem.
 */
import type { EntityId } from '../types';
import type { Position, Collider } from '../ecs/components';

export interface CollisionPair {
  entityA: EntityId;
  entityB: EntityId;
  overlapX: number;
  overlapY: number;
}

export interface CollisionEntity {
  id: EntityId;
  position: Position;
  collider: Collider;
}

// ── Spatial Hash Grid ─────────────────────────────────────────────────────

type CellKey = string;

function cellKey(cx: number, cz: number): CellKey {
  return `${cx},${cz}`;
}

class SpatialHashGrid {
  private cellSize: number;
  private cells: Map<CellKey, EntityId[]> = new Map();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  getCellSize(): number {
    return this.cellSize;
  }

  setCellSize(size: number): void {
    this.cellSize = size;
  }

  insert(id: EntityId, pos: Position, col: Collider): void {
    const halfW = col.width / 2;
    const halfD = col.depth / 2;
    const minCX = Math.floor((pos.x - halfW) / this.cellSize);
    const maxCX = Math.floor((pos.x + halfW) / this.cellSize);
    const minCZ = Math.floor((pos.z - halfD) / this.cellSize);
    const maxCZ = Math.floor((pos.z + halfD) / this.cellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const key = cellKey(cx, cz);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(id);
      }
    }
  }

  /** Returns all entity IDs that share at least one cell with the given AABB. */
  query(pos: Position, col: Collider): EntityId[] {
    const halfW = col.width / 2;
    const halfD = col.depth / 2;
    const minCX = Math.floor((pos.x - halfW) / this.cellSize);
    const maxCX = Math.floor((pos.x + halfW) / this.cellSize);
    const minCZ = Math.floor((pos.z - halfD) / this.cellSize);
    const maxCZ = Math.floor((pos.z + halfD) / this.cellSize);

    const seen = new Set<EntityId>();
    const result: EntityId[] = [];

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const cell = this.cells.get(cellKey(cx, cz));
        if (!cell) continue;
        for (const id of cell) {
          if (!seen.has(id)) {
            seen.add(id);
            result.push(id);
          }
        }
      }
    }
    return result;
  }
}

// ── System State ──────────────────────────────────────────────────────────

const staticGrid = new SpatialHashGrid(1);
const dynamicGrid = new SpatialHashGrid(1);
let staticEntities: CollisionEntity[] = [];

/**
 * Rebuild the static spatial hash. Call when the level changes (room load, etc).
 * Idempotent — safe to call multiple times.
 */
export function rebuildStatics(entities: CollisionEntity[]): void {
  staticEntities = entities.filter(e => e.collider.isStatic);
  staticGrid.clear();
  for (const e of staticEntities) {
    staticGrid.insert(e.id, e.position, e.collider);
  }
}

/**
 * Compute the cell size as 2 * the largest dimension among dynamic colliders.
 * Falls back to 2 if there are no dynamic entities.
 */
function computeCellSize(entities: CollisionEntity[]): number {
  let maxDim = 0;
  for (const e of entities) {
    if (!e.collider.isStatic) {
      maxDim = Math.max(maxDim, e.collider.width, e.collider.depth);
    }
  }
  return maxDim > 0 ? 2 * maxDim : 2;
}

// ── AABB Test ─────────────────────────────────────────────────────────────

function testAABB(
  posA: Position, colA: Collider,
  posB: Position, colB: Collider,
): { overlapX: number; overlapY: number } | null {
  const halfWA = colA.width / 2;
  const halfDA = colA.depth / 2;
  const halfWB = colB.width / 2;
  const halfDB = colB.depth / 2;

  const dx = Math.abs(posA.x - posB.x);
  const dz = Math.abs(posA.z - posB.z);

  const overlapX = (halfWA + halfWB) - dx;
  const overlapZ = (halfDA + halfDB) - dz;

  if (overlapX > 0 && overlapZ > 0) {
    return { overlapX, overlapY: overlapZ };
  }
  return null;
}

// ── Main System ───────────────────────────────────────────────────────────

export function collisionDetectionSystem(
  entities: CollisionEntity[],
): CollisionPair[] {
  const dynamicEntities = entities.filter(e => !e.collider.isStatic);

  // Recompute cell size & rebuild dynamic grid
  const cellSize = computeCellSize(entities);
  dynamicGrid.setCellSize(cellSize);
  dynamicGrid.clear();
  for (const e of dynamicEntities) {
    dynamicGrid.insert(e.id, e.position, e.collider);
  }

  // Also update static grid cell size to match
  staticGrid.setCellSize(cellSize);
  staticGrid.clear();
  for (const e of staticEntities) {
    staticGrid.insert(e.id, e.position, e.collider);
  }

  // Build entity lookup
  const entityMap = new Map<EntityId, CollisionEntity>();
  for (const e of entities) {
    entityMap.set(e.id, e);
  }
  for (const e of staticEntities) {
    if (!entityMap.has(e.id)) {
      entityMap.set(e.id, e);
    }
  }

  const pairs: CollisionPair[] = [];
  const seenPairs = new Set<string>();

  function addPair(a: CollisionEntity, b: CollisionEntity): void {
    // Deterministic ordering: lower ID first
    const [eA, eB] = a.id < b.id ? [a, b] : [b, a];
    const pairKey = `${eA.id},${eB.id}`;
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    const result = testAABB(eA.position, eA.collider, eB.position, eB.collider);
    if (result) {
      pairs.push({
        entityA: eA.id,
        entityB: eB.id,
        overlapX: result.overlapX,
        overlapY: result.overlapY,
      });
    }
  }

  // Dynamic vs Dynamic
  for (const e of dynamicEntities) {
    const candidates = dynamicGrid.query(e.position, e.collider);
    for (const candidateId of candidates) {
      if (candidateId === e.id) continue; // no self-collision
      const other = entityMap.get(candidateId);
      if (!other) continue;
      if (other.collider.isStatic) continue;
      addPair(e, other);
    }
  }

  // Dynamic vs Static
  for (const e of dynamicEntities) {
    const candidates = staticGrid.query(e.position, e.collider);
    for (const candidateId of candidates) {
      const other = entityMap.get(candidateId);
      if (!other) continue;
      addPair(e, other);
    }
  }

  // Sort for deterministic output: by entityA, then entityB
  pairs.sort((a, b) => a.entityA - b.entityA || a.entityB - b.entityB);

  return pairs;
}

/** Reset module-level state (for testing). */
export function resetCollisionState(): void {
  staticGrid.clear();
  dynamicGrid.clear();
  staticEntities = [];
}
