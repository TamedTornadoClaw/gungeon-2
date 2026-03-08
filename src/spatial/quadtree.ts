/**
 * Quadtree — spatial index for broad-phase collision, range queries, and ray tests.
 *
 * Operates on the XZ plane (top-down 2D). All items are axis-aligned bounding
 * boxes defined by center (x, z) and half-extents (halfW, halfD).
 *
 * Supports:
 * - AABB range queries (collision broad-phase, visibility queries)
 * - Ray intersection queries (line-of-sight checks)
 * - Bulk insert with automatic subdivision
 * - Separate static/dynamic trees (static rebuilt per floor, dynamic per frame)
 */

import type { EntityId } from '../types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AABB {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

export interface QuadtreeItem {
  id: EntityId;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

/** Axis-aligned bounding rectangle for range queries */
export interface Rect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

// ── Configuration ───────────────────────────────────────────────────────────

/** Max items per node before subdivision */
const MAX_ITEMS = 8;
/** Max tree depth to prevent infinite subdivision from overlapping items */
const MAX_DEPTH = 8;

// ── Quadtree Node ───────────────────────────────────────────────────────────

class QuadtreeNode {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
  readonly midX: number;
  readonly midZ: number;
  readonly depth: number;

  items: QuadtreeItem[] = [];
  children: QuadtreeNode[] | null = null;

  constructor(minX: number, minZ: number, maxX: number, maxZ: number, depth: number) {
    this.minX = minX;
    this.minZ = minZ;
    this.maxX = maxX;
    this.maxZ = maxZ;
    this.midX = (minX + maxX) / 2;
    this.midZ = (minZ + maxZ) / 2;
    this.depth = depth;
  }

  insert(item: QuadtreeItem): void {
    // If we have children, try to push into a child that fully contains the item
    if (this.children) {
      const child = this.getContainingChild(item);
      if (child) {
        child.insert(item);
        return;
      }
      // Item spans multiple children — store at this level
      this.items.push(item);
      return;
    }

    this.items.push(item);

    // Subdivide if over capacity and not at max depth
    if (this.items.length > MAX_ITEMS && this.depth < MAX_DEPTH) {
      this.subdivide();
    }
  }

  /** Query all items whose AABB overlaps the given rect. Results appended to `out`. */
  queryRect(rect: Rect, out: QuadtreeItem[]): void {
    // Early-out if this node doesn't overlap the query rect
    if (rect.maxX <= this.minX || rect.minX >= this.maxX ||
        rect.maxZ <= this.minZ || rect.minZ >= this.maxZ) {
      return;
    }

    // Check items stored at this node
    for (const item of this.items) {
      if (item.x - item.halfW < rect.maxX && item.x + item.halfW > rect.minX &&
          item.z - item.halfD < rect.maxZ && item.z + item.halfD > rect.minZ) {
        out.push(item);
      }
    }

    // Recurse into children
    if (this.children) {
      for (const child of this.children) {
        child.queryRect(rect, out);
      }
    }
  }

  /**
   * Query all items whose AABB intersects the ray from (ox, oz) in direction (dx, dz).
   * maxT limits the ray length (parametric t in [0, maxT]).
   * Results appended to `out`.
   */
  queryRay(ox: number, oz: number, dx: number, dz: number, maxT: number, out: QuadtreeItem[]): void {
    // Test ray against this node's bounds
    if (!rayIntersectsAABB(ox, oz, dx, dz, maxT, this.minX, this.minZ, this.maxX, this.maxZ)) {
      return;
    }

    for (const item of this.items) {
      if (rayIntersectsAABB(ox, oz, dx, dz, maxT,
          item.x - item.halfW, item.z - item.halfD,
          item.x + item.halfW, item.z + item.halfD)) {
        out.push(item);
      }
    }

    if (this.children) {
      for (const child of this.children) {
        child.queryRay(ox, oz, dx, dz, maxT, out);
      }
    }
  }

  clear(): void {
    this.items.length = 0;
    this.children = null;
  }

  private subdivide(): void {
    this.children = [
      new QuadtreeNode(this.minX, this.minZ, this.midX, this.midZ, this.depth + 1), // NW
      new QuadtreeNode(this.midX, this.minZ, this.maxX, this.midZ, this.depth + 1), // NE
      new QuadtreeNode(this.minX, this.midZ, this.midX, this.maxZ, this.depth + 1), // SW
      new QuadtreeNode(this.midX, this.midZ, this.maxX, this.maxZ, this.depth + 1), // SE
    ];

    // Re-insert existing items
    const existing = this.items;
    this.items = [];
    for (const item of existing) {
      const child = this.getContainingChild(item);
      if (child) {
        child.insert(item);
      } else {
        // Spans multiple children — stays at this level
        this.items.push(item);
      }
    }
  }

  /** Returns the child quadrant that fully contains the item, or null if it spans multiple. */
  private getContainingChild(item: QuadtreeItem): QuadtreeNode | null {
    if (!this.children) return null;

    const itemMinX = item.x - item.halfW;
    const itemMaxX = item.x + item.halfW;
    const itemMinZ = item.z - item.halfD;
    const itemMaxZ = item.z + item.halfD;

    const west = itemMaxX <= this.midX;
    const east = itemMinX >= this.midX;
    const north = itemMaxZ <= this.midZ;
    const south = itemMinZ >= this.midZ;

    if (west && north) return this.children[0];
    if (east && north) return this.children[1];
    if (west && south) return this.children[2];
    if (east && south) return this.children[3];
    return null; // spans boundary
  }
}

// ── Ray-AABB intersection (2D, XZ plane) ─────────────────────────────────

function rayIntersectsAABB(
  ox: number, oz: number,
  dx: number, dz: number,
  maxT: number,
  minX: number, minZ: number,
  maxX: number, maxZ: number,
): boolean {
  // Slab method on XZ plane
  let tMin = 0;
  let tMax = maxT;

  if (Math.abs(dx) > 1e-10) {
    const invDx = 1 / dx;
    let t1 = (minX - ox) * invDx;
    let t2 = (maxX - ox) * invDx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  } else {
    if (ox < minX || ox > maxX) return false;
  }

  if (Math.abs(dz) > 1e-10) {
    const invDz = 1 / dz;
    let t1 = (minZ - oz) * invDz;
    let t2 = (maxZ - oz) * invDz;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  } else {
    if (oz < minZ || oz > maxZ) return false;
  }

  return true;
}

// ── Public Quadtree API ─────────────────────────────────────────────────────

export class Quadtree {
  private root: QuadtreeNode;
  private defaultBounds: Rect;

  constructor(bounds?: Rect) {
    const b = bounds ?? { minX: -500, minZ: -500, maxX: 500, maxZ: 500 };
    this.defaultBounds = b;
    this.root = new QuadtreeNode(b.minX, b.minZ, b.maxX, b.maxZ, 0);
  }

  /** Remove all items and reset the tree. */
  clear(): void {
    this.root = new QuadtreeNode(
      this.defaultBounds.minX, this.defaultBounds.minZ,
      this.defaultBounds.maxX, this.defaultBounds.maxZ, 0,
    );
  }

  /** Insert an item into the tree. */
  insert(item: QuadtreeItem): void {
    this.root.insert(item);
  }

  /** Insert an entity by ID with center position and half-extents. */
  insertEntity(id: EntityId, x: number, z: number, halfW: number, halfD: number): void {
    this.root.insert({ id, x, z, halfW, halfD });
  }

  /** Query all items overlapping the given axis-aligned rectangle. */
  queryRect(rect: Rect): QuadtreeItem[] {
    const out: QuadtreeItem[] = [];
    this.root.queryRect(rect, out);
    return out;
  }

  /** Query all items within a circular radius (approximated as a square query + distance filter). */
  queryRadius(cx: number, cz: number, radius: number): QuadtreeItem[] {
    const rect: Rect = {
      minX: cx - radius,
      minZ: cz - radius,
      maxX: cx + radius,
      maxZ: cz + radius,
    };
    const candidates = this.queryRect(rect);
    // Filter to actual circular radius (center-to-center)
    const rSq = radius * radius;
    return candidates.filter(item => {
      const dx = item.x - cx;
      const dz = item.z - cz;
      return dx * dx + dz * dz <= rSq;
    });
  }

  /**
   * Query all items whose AABB intersects a ray.
   * @param ox Ray origin X
   * @param oz Ray origin Z
   * @param dx Ray direction X (not necessarily normalized)
   * @param dz Ray direction Z
   * @param maxT Maximum parametric t (ray length = maxT * |dir|)
   */
  queryRay(ox: number, oz: number, dx: number, dz: number, maxT: number = 1): QuadtreeItem[] {
    const out: QuadtreeItem[] = [];
    this.root.queryRay(ox, oz, dx, dz, maxT, out);
    return out;
  }
}
