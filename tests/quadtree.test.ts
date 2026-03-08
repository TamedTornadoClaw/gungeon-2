import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Quadtree } from '../src/spatial/quadtree';
import type { QuadtreeItem, Rect } from '../src/spatial/quadtree';

// ── Helpers ──────────────────────────────────────────────────────────────

function item(id: number, x: number, z: number, halfW = 0.5, halfD = 0.5): QuadtreeItem {
  return { id, x, z, halfW, halfD };
}

function overlaps(a: QuadtreeItem, rect: Rect): boolean {
  return (
    a.x - a.halfW < rect.maxX && a.x + a.halfW > rect.minX &&
    a.z - a.halfD < rect.maxZ && a.z + a.halfD > rect.minZ
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Quadtree', () => {
  it('returns empty results from empty tree', () => {
    const qt = new Quadtree();
    const results = qt.queryRect({ minX: -1, minZ: -1, maxX: 1, maxZ: 1 });
    expect(results).toHaveLength(0);
  });

  it('finds inserted item within query rect', () => {
    const qt = new Quadtree();
    qt.insert(item(1, 0, 0));
    const results = qt.queryRect({ minX: -1, minZ: -1, maxX: 1, maxZ: 1 });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it('does not return items outside query rect', () => {
    const qt = new Quadtree();
    qt.insert(item(1, 10, 10));
    const results = qt.queryRect({ minX: -1, minZ: -1, maxX: 1, maxZ: 1 });
    expect(results).toHaveLength(0);
  });

  it('handles items spanning the subdivision boundary', () => {
    const qt = new Quadtree({ minX: -10, minZ: -10, maxX: 10, maxZ: 10 });
    // Large item centered at origin spans all quadrants
    qt.insert(item(1, 0, 0, 5, 5));
    const results = qt.queryRect({ minX: 3, minZ: 3, maxX: 6, maxZ: 6 });
    expect(results).toHaveLength(1);
  });

  it('handles many items triggering subdivision', () => {
    const qt = new Quadtree({ minX: -100, minZ: -100, maxX: 100, maxZ: 100 });
    for (let i = 0; i < 100; i++) {
      qt.insert(item(i, i - 50, i - 50, 0.5, 0.5));
    }
    // Query a small area that should contain a few items
    const results = qt.queryRect({ minX: -1, minZ: -1, maxX: 2, maxZ: 2 });
    // Items at (0,0), (1,1), (2,2) — each with halfW=0.5
    // Item at (-1,-1) halfW=0.5 extends from -1.5 to -0.5, overlaps rect at -1
    const ids = results.map(r => r.id);
    expect(ids).toContain(49); // x=-1
    expect(ids).toContain(50); // x=0
    expect(ids).toContain(51); // x=1
  });

  it('clear removes all items', () => {
    const qt = new Quadtree();
    for (let i = 0; i < 20; i++) {
      qt.insert(item(i, 0, 0));
    }
    qt.clear();
    const results = qt.queryRect({ minX: -1, minZ: -1, maxX: 1, maxZ: 1 });
    expect(results).toHaveLength(0);
  });

  it('queryRadius returns items within circular distance', () => {
    const qt = new Quadtree();
    qt.insert(item(1, 0, 0, 0.1, 0.1));
    qt.insert(item(2, 3, 0, 0.1, 0.1));
    qt.insert(item(3, 5, 0, 0.1, 0.1));
    const results = qt.queryRadius(0, 0, 4);
    const ids = results.map(r => r.id);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).not.toContain(3);
  });

  it('queryRay returns items intersecting the ray', () => {
    const qt = new Quadtree();
    qt.insert(item(1, 5, 0, 0.5, 0.5));   // on the ray path
    qt.insert(item(2, 5, 5, 0.5, 0.5));   // off to the side
    qt.insert(item(3, 15, 0, 0.5, 0.5));  // beyond maxT
    // Ray from origin going +X, length 10
    const results = qt.queryRay(0, 0, 1, 0, 10);
    const ids = results.map(r => r.id);
    expect(ids).toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(3);
  });

  it('queryRay handles diagonal rays', () => {
    const qt = new Quadtree();
    qt.insert(item(1, 3, 3, 0.5, 0.5));
    qt.insert(item(2, 3, -3, 0.5, 0.5));
    // Diagonal ray toward (1,1) direction
    const results = qt.queryRay(0, 0, 1, 1, 10);
    const ids = results.map(r => r.id);
    expect(ids).toContain(1);
    expect(ids).not.toContain(2);
  });

  // ── Property-based ─────────────────────────────────────────────────────

  describe('property-based', () => {
    const itemArb = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      x: fc.double({ min: -50, max: 50, noNaN: true }),
      z: fc.double({ min: -50, max: 50, noNaN: true }),
      halfW: fc.double({ min: 0.1, max: 5, noNaN: true }),
      halfD: fc.double({ min: 0.1, max: 5, noNaN: true }),
    });

    const uniqueItemsArb = fc.array(itemArb, { minLength: 1, maxLength: 50 })
      .map(items => {
        const seen = new Set<number>();
        return items.filter(i => {
          if (seen.has(i.id)) return false;
          seen.add(i.id);
          return true;
        });
      })
      .filter(items => items.length >= 1);

    const rectArb = fc.tuple(
      fc.double({ min: -50, max: 50, noNaN: true }),
      fc.double({ min: -50, max: 50, noNaN: true }),
      fc.double({ min: 1, max: 20, noNaN: true }),
      fc.double({ min: 1, max: 20, noNaN: true }),
    ).map(([x, z, w, h]) => ({
      minX: x, minZ: z, maxX: x + w, maxZ: z + h,
    }));

    it('no false negatives — every overlapping item is returned', () => {
      fc.assert(
        fc.property(uniqueItemsArb, rectArb, (items, rect) => {
          const qt = new Quadtree({ minX: -100, minZ: -100, maxX: 100, maxZ: 100 });
          for (const i of items) qt.insert(i);
          const results = qt.queryRect(rect);
          const resultIds = new Set(results.map(r => r.id));

          for (const i of items) {
            if (overlaps(i, rect)) {
              expect(resultIds.has(i.id)).toBe(true);
            }
          }
        }),
        { numRuns: 200 },
      );
    });

    it('no false positives — every returned item actually overlaps', () => {
      fc.assert(
        fc.property(uniqueItemsArb, rectArb, (items, rect) => {
          const qt = new Quadtree({ minX: -100, minZ: -100, maxX: 100, maxZ: 100 });
          for (const i of items) qt.insert(i);
          const results = qt.queryRect(rect);

          for (const r of results) {
            expect(overlaps(r, rect)).toBe(true);
          }
        }),
        { numRuns: 200 },
      );
    });

    it('no duplicates in results', () => {
      fc.assert(
        fc.property(uniqueItemsArb, rectArb, (items, rect) => {
          const qt = new Quadtree({ minX: -100, minZ: -100, maxX: 100, maxZ: 100 });
          for (const i of items) qt.insert(i);
          const results = qt.queryRect(rect);
          const ids = results.map(r => r.id);
          expect(new Set(ids).size).toBe(ids.length);
        }),
        { numRuns: 200 },
      );
    });
  });
});
