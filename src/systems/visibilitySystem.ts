/**
 * VisibilitySystem — fog of war (dungeon reveal) + enemy line-of-sight.
 *
 * Fog of war: Dungeon entities start hidden. As the player moves, entities
 * within the reveal radius are permanently revealed (Revealed component added,
 * Renderable.visible = true). Uses a dungeon quadtree built once per floor.
 *
 * Enemy LOS: Each frame, enemies within losMaxRange are checked for line of
 * sight to the player by raycasting against walls in the static quadtree.
 * Enemies with clear LOS are visible; occluded enemies are hidden.
 *
 * System execution order: after Spawn (#20), before Death (#22).
 */
import type { World } from '../ecs/world';
import type { Position, Renderable, Collider, Door } from '../ecs/components';
import { Quadtree } from '../spatial/quadtree';
import { getStaticTree } from './collisionDetectionSystem';
import { getDesignParams } from '../config/designParams';

// ── Dungeon quadtree (static, rebuilt per floor) ────────────────────────

let dungeonTree = new Quadtree();
let dungeonTreeBuilt = false;

/**
 * Build the dungeon quadtree from all DungeonEntityTag entities.
 * Call once after dungeon generation (and after rebuildStatics).
 */
export function rebuildDungeonTree(world: World): void {
  dungeonTree = new Quadtree();
  const entities = world.query(['DungeonEntityTag', 'Position', 'Renderable']);

  for (const id of entities) {
    const pos = world.getComponent<Position>(id, 'Position')!;
    const collider = world.getComponent<Collider>(id, 'Collider');
    const renderable = world.getComponent<Renderable>(id, 'Renderable')!;

    // Use Collider extents if available, otherwise use Renderable scale
    let halfW: number;
    let halfD: number;
    if (collider) {
      halfW = collider.width / 2;
      halfD = collider.depth / 2;
    } else {
      halfW = (renderable.scaleX ?? renderable.scale) / 2;
      halfD = (renderable.scaleZ ?? renderable.scale) / 2;
    }
    dungeonTree.insertEntity(id, pos.x, pos.z, halfW, halfD);
  }
  dungeonTreeBuilt = true;
}

/**
 * Run an initial reveal pass at the player's current position.
 * Call once after dungeon generation + player placement.
 */
export function initialReveal(world: World): void {
  if (!dungeonTreeBuilt) return;
  const players = world.query(['PlayerTag', 'Position']);
  if (players.length === 0) return;
  const playerPos = world.getComponent<Position>(players[0], 'Position')!;
  const params = getDesignParams().visibility;
  revealNearbyDungeonEntities(world, playerPos, params.fogOfWarRadius);
  updateEnemyVisibility(world, playerPos, params.losMaxRange);
}

/** Reset state (for testing). */
export function resetVisibilityState(): void {
  dungeonTree = new Quadtree();
  dungeonTreeBuilt = false;
}

// ── System ──────────────────────────────────────────────────────────────

export function visibilitySystem(world: World): void {
  const players = world.query(['PlayerTag', 'Position']);
  if (players.length === 0) return;

  const playerPos = world.getComponent<Position>(players[0], 'Position')!;
  const params = getDesignParams().visibility;

  // ── Fog of war: reveal dungeon entities near the player ─────────────
  if (dungeonTreeBuilt) {
    revealNearbyDungeonEntities(world, playerPos, params.fogOfWarRadius);
  }

  // ── Enemy LOS: show/hide enemies based on wall occlusion ────────────
  updateEnemyVisibility(world, playerPos, params.losMaxRange);
}

// ── Fog of war ──────────────────────────────────────────────────────────

function revealNearbyDungeonEntities(
  world: World,
  playerPos: Position,
  radius: number,
): void {
  const candidates = dungeonTree.queryRect({
    minX: playerPos.x - radius,
    minZ: playerPos.z - radius,
    maxX: playerPos.x + radius,
    maxZ: playerPos.z + radius,
  });

  const staticTree = getStaticTree();

  for (const item of candidates) {
    // Already revealed — skip
    if (world.hasComponent(item.id, 'Revealed')) continue;
    // Entity might have been destroyed (destructibles)
    if (!world.hasEntity(item.id)) continue;

    const renderable = world.getComponent<Renderable>(item.id, 'Renderable');
    if (!renderable) continue;

    // Use nearest point on entity AABB to player for both distance and LOS.
    // This prevents long merged walls from failing LOS checks when the player
    // is near one end but the center is far away or behind a perpendicular wall.
    const nearX = Math.max(item.x - item.halfW, Math.min(playerPos.x, item.x + item.halfW));
    const nearZ = Math.max(item.z - item.halfD, Math.min(playerPos.z, item.z + item.halfD));
    const dx = nearX - playerPos.x;
    const dz = nearZ - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > radius) continue;

    // LOS check: raycast from player to nearest visible point
    if (dist > 0.01) {
      if (isOccludedByWalls(world, staticTree, playerPos, dx, dz, dist, item.id)) continue;
    }

    renderable.visible = true;
    world.addComponent(item.id, 'Revealed', {});
  }
}

// ── Shared LOS occlusion check ──────────────────────────────────────────

/**
 * Returns true if the ray from playerPos toward (dx,dz) at `dist` length
 * is blocked by a wall or closed door. Only WallTag and closed-door entities
 * in the static tree count as occluders — hazards, chests, shops, stairs,
 * open doors, etc. are ignored.
 *
 * `skipId` is the target entity to exclude from occlusion checks (so an
 * entity doesn't occlude itself).
 */
function isOccludedByWalls(
  world: World,
  staticTree: Quadtree,
  playerPos: Position,
  dx: number,
  dz: number,
  dist: number,
  skipId: number,
): boolean {
  const dirX = dx / dist;
  const dirZ = dz / dist;

  const hits = staticTree.queryRay(playerPos.x, playerPos.z, dirX, dirZ, dist);

  for (const hit of hits) {
    if (hit.id === skipId) continue;

    // Only walls and closed doors occlude
    const isWall = world.hasComponent(hit.id, 'WallTag');
    if (!isWall) {
      if (!world.hasComponent(hit.id, 'DoorTag')) continue;
      const door = world.getComponent<Door>(hit.id, 'Door');
      if (!door || door.isOpen) continue;
    }

    const tHit = rayAABBIntersect(
      playerPos.x, playerPos.z,
      dirX, dirZ,
      hit.x - hit.halfW, hit.z - hit.halfD,
      hit.x + hit.halfW, hit.z + hit.halfD,
    );
    if (tHit !== null && tHit < dist - 0.1) {
      return true;
    }
  }
  return false;
}

// ── Enemy LOS ───────────────────────────────────────────────────────────

function updateEnemyVisibility(
  world: World,
  playerPos: Position,
  maxRange: number,
): void {
  const enemies = world.query(['EnemyTag', 'Position', 'Renderable']);
  const staticTree = getStaticTree();
  const rangeSq = maxRange * maxRange;

  for (const enemyId of enemies) {
    const enemyPos = world.getComponent<Position>(enemyId, 'Position')!;
    const renderable = world.getComponent<Renderable>(enemyId, 'Renderable')!;

    const dx = enemyPos.x - playerPos.x;
    const dz = enemyPos.z - playerPos.z;
    const distSq = dx * dx + dz * dz;

    if (distSq > rangeSq) {
      renderable.visible = false;
      continue;
    }

    const dist = Math.sqrt(distSq);
    if (dist < 0.01) {
      renderable.visible = true;
      continue;
    }

    renderable.visible = !isOccludedByWalls(world, staticTree, playerPos, dx, dz, dist, enemyId);
  }
}

/**
 * 2D ray-AABB intersection returning the parametric t of the first hit,
 * or null if no intersection.
 */
function rayAABBIntersect(
  ox: number, oz: number,
  dx: number, dz: number,
  minX: number, minZ: number,
  maxX: number, maxZ: number,
): number | null {
  let tMin = 0;
  let tMax = Infinity;

  if (Math.abs(dx) > 1e-10) {
    const invDx = 1 / dx;
    let t1 = (minX - ox) * invDx;
    let t2 = (maxX - ox) * invDx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  } else {
    if (ox < minX || ox > maxX) return null;
  }

  if (Math.abs(dz) > 1e-10) {
    const invDz = 1 / dz;
    let t1 = (minZ - oz) * invDz;
    let t2 = (maxZ - oz) * invDz;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  } else {
    if (oz < minZ || oz > maxZ) return null;
  }

  return tMin;
}
