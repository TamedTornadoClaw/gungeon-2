/**
 * CollisionDetectionSystem — quadtree broad-phase + AABB narrow-phase.
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
import { Quadtree } from '../spatial/quadtree';

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

// ── System State ──────────────────────────────────────────────────────────

const staticTree = new Quadtree();
const dynamicTree = new Quadtree();
let staticEntities: CollisionEntity[] = [];

/**
 * Rebuild the static quadtree. Call when the level changes (room load, etc).
 * Idempotent — safe to call multiple times.
 */
export function rebuildStatics(entities: CollisionEntity[]): void {
  staticEntities = entities.filter(e => e.collider.isStatic);
  staticTree.clear();
  for (const e of staticEntities) {
    staticTree.insertEntity(e.id, e.position.x, e.position.z, e.collider.width / 2, e.collider.depth / 2);
  }
}

/** Get the static quadtree for external queries (LOS, visibility). */
export function getStaticTree(): Quadtree {
  return staticTree;
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

  // Rebuild dynamic quadtree each frame
  dynamicTree.clear();
  for (const e of dynamicEntities) {
    dynamicTree.insertEntity(e.id, e.position.x, e.position.z, e.collider.width / 2, e.collider.depth / 2);
  }

  // Rebuild static tree each frame (statics may have been passed in entities list)
  staticTree.clear();
  for (const e of staticEntities) {
    staticTree.insertEntity(e.id, e.position.x, e.position.z, e.collider.width / 2, e.collider.depth / 2);
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

  // Dynamic vs Dynamic: for each dynamic entity, query dynamic tree for candidates
  for (const e of dynamicEntities) {
    const halfW = e.collider.width / 2;
    const halfD = e.collider.depth / 2;
    const candidates = dynamicTree.queryRect({
      minX: e.position.x - halfW,
      minZ: e.position.z - halfD,
      maxX: e.position.x + halfW,
      maxZ: e.position.z + halfD,
    });
    for (const c of candidates) {
      if (c.id === e.id) continue;
      const other = entityMap.get(c.id);
      if (!other) continue;
      if (other.collider.isStatic) continue;
      addPair(e, other);
    }
  }

  // Dynamic vs Static: for each dynamic entity, query static tree
  for (const e of dynamicEntities) {
    const halfW = e.collider.width / 2;
    const halfD = e.collider.depth / 2;
    const candidates = staticTree.queryRect({
      minX: e.position.x - halfW,
      minZ: e.position.z - halfD,
      maxX: e.position.x + halfW,
      maxZ: e.position.z + halfD,
    });
    for (const c of candidates) {
      const other = entityMap.get(c.id);
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
  staticTree.clear();
  dynamicTree.clear();
  staticEntities = [];
}
