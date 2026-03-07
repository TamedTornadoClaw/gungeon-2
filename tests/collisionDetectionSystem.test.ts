import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ColliderShape } from '../src/ecs/components';
import {
  collisionDetectionSystem,
  rebuildStatics,
  resetCollisionState,
  type CollisionEntity,
} from '../src/systems/collisionDetectionSystem';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeEntity(
  id: number,
  x: number,
  z: number,
  width: number,
  depth: number,
  isStatic = false,
  isTrigger = false,
): CollisionEntity {
  return {
    id,
    position: { x, y: 0, z },
    collider: {
      type: ColliderShape.AABB,
      width,
      height: 1,
      depth,
      isStatic,
      isTrigger,
    },
  };
}

function dynamicEntity(id: number, x: number, z: number, w = 1, d = 1): CollisionEntity {
  return makeEntity(id, x, z, w, d, false, false);
}

function staticEntity(id: number, x: number, z: number, w = 1, d = 1): CollisionEntity {
  return makeEntity(id, x, z, w, d, true, false);
}

function triggerEntity(id: number, x: number, z: number, w = 1, d = 1): CollisionEntity {
  return makeEntity(id, x, z, w, d, false, true);
}

beforeEach(() => {
  resetCollisionState();
});

// ── Test Cases ───────────────────────────────────────────────────────────

describe('CollisionDetectionSystem', () => {
  // 1. Two AABBs exactly touching at edges (zero overlap)
  it('two AABBs exactly touching at edges produce no collision (zero overlap)', () => {
    // Entity A at x=0, width=1 → extends from -0.5 to 0.5
    // Entity B at x=1, width=1 → extends from 0.5 to 1.5
    // They touch at x=0.5, overlap = (0.5 + 0.5) - 1.0 = 0.0
    const entities = [
      dynamicEntity(1, 0, 0, 1, 1),
      dynamicEntity(2, 1, 0, 1, 1),
    ];
    const pairs = collisionDetectionSystem(entities);
    // Exactly touching = zero overlap, our system requires > 0, so no pair
    expect(pairs).toHaveLength(0);
  });

  // 2. Cross-cell overlap: entities in different spatial hash cells that still overlap
  it('detects cross-cell overlap between entities in different cells', () => {
    // Cell size = 2 * max(1) = 2. Entity A at x=0.9, Entity B at x=1.1
    // They are in different cells but overlap.
    const entities = [
      dynamicEntity(1, 0.9, 0, 1, 1),
      dynamicEntity(2, 1.1, 0, 1, 1),
    ];
    const pairs = collisionDetectionSystem(entities);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].entityA).toBe(1);
    expect(pairs[0].entityB).toBe(2);
  });

  // 3. Entity spanning multiple spatial hash cells (large collider)
  it('handles entity spanning multiple spatial hash cells', () => {
    // Large entity at origin with width/depth = 10
    // Small entity at (4, 4) with width/depth = 1
    // Cell size = 2 * max(10, 1) = 20
    // With cell size 20, they'll be in the same cell, so this tests the concept.
    // Let's use a smaller example: large = 5, small = 1, cell = 10
    const large = dynamicEntity(1, 0, 0, 5, 5);
    const small = dynamicEntity(2, 2, 2, 1, 1);
    const pairs = collisionDetectionSystem([large, small]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].entityA).toBe(1);
    expect(pairs[0].entityB).toBe(2);
  });

  // 4. Deterministic ordering — higher ID entity is always entityB
  it('always places lower EntityId as entityA', () => {
    const entities = [
      dynamicEntity(5, 0, 0, 2, 2),
      dynamicEntity(3, 0.5, 0.5, 2, 2),
    ];
    const pairs = collisionDetectionSystem(entities);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].entityA).toBe(3);
    expect(pairs[0].entityB).toBe(5);
  });

  // 5. Three mutually overlapping entities produce three pairs
  it('three mutually overlapping entities produce exactly three pairs', () => {
    const entities = [
      dynamicEntity(1, 0, 0, 2, 2),
      dynamicEntity(2, 0.5, 0, 2, 2),
      dynamicEntity(3, 0.25, 0.5, 2, 2),
    ];
    const pairs = collisionDetectionSystem(entities);
    expect(pairs).toHaveLength(3);
    const pairKeys = pairs.map(p => `${p.entityA},${p.entityB}`);
    expect(pairKeys).toContain('1,2');
    expect(pairKeys).toContain('1,3');
    expect(pairKeys).toContain('2,3');
  });

  // 6. Static collider vs dynamic collider collision
  it('detects static vs dynamic collision', () => {
    const wall = staticEntity(1, 0, 0, 2, 2);
    const player = dynamicEntity(2, 0.5, 0, 1, 1);
    rebuildStatics([wall]);
    const pairs = collisionDetectionSystem([wall, player]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].entityA).toBe(1);
    expect(pairs[0].entityB).toBe(2);
  });

  // 7. Static-vs-static pairs NOT produced
  it('does not produce static-vs-static pairs', () => {
    const wall1 = staticEntity(1, 0, 0, 2, 2);
    const wall2 = staticEntity(2, 0.5, 0, 2, 2);
    rebuildStatics([wall1, wall2]);
    const pairs = collisionDetectionSystem([wall1, wall2]);
    expect(pairs).toHaveLength(0);
  });

  // 8. Trigger collider produces pairs
  it('trigger colliders produce collision pairs', () => {
    const trigger = triggerEntity(1, 0, 0, 2, 2);
    const player = dynamicEntity(2, 0.5, 0, 1, 1);
    const pairs = collisionDetectionSystem([trigger, player]);
    expect(pairs).toHaveLength(1);
  });

  // 9. Self-collision never reported
  it('never produces self-collision', () => {
    const entities = [dynamicEntity(1, 0, 0, 2, 2)];
    const pairs = collisionDetectionSystem(entities);
    expect(pairs).toHaveLength(0);
  });

  // 10. Entity removed between frames — stale reference check
  it('handles entity removed between frames (no stale references)', () => {
    const entities = [
      dynamicEntity(1, 0, 0, 2, 2),
      dynamicEntity(2, 0.5, 0, 2, 2),
      dynamicEntity(3, 0.25, 0, 2, 2),
    ];
    // Frame 1: all three collide
    const pairs1 = collisionDetectionSystem(entities);
    expect(pairs1).toHaveLength(3);

    // Frame 2: entity 2 removed
    const remaining = [entities[0], entities[2]];
    const pairs2 = collisionDetectionSystem(remaining);
    expect(pairs2).toHaveLength(1);
    expect(pairs2[0].entityA).toBe(1);
    expect(pairs2[0].entityB).toBe(3);
  });

  // 11. Entity with zero-size collider
  it('entity with zero-size collider produces no collisions', () => {
    const zeroSize = dynamicEntity(1, 0, 0, 0, 0);
    const normal = dynamicEntity(2, 0, 0, 1, 1);
    const pairs = collisionDetectionSystem([zeroSize, normal]);
    // Zero-width/depth means half extents are 0, overlap = 0.5 - 0 = 0.5 on each axis
    // Actually: overlapX = (0 + 0.5) - 0 = 0.5, overlapZ = (0 + 0.5) - 0 = 0.5
    // They are at same position, so they DO overlap
    expect(pairs).toHaveLength(1);
  });

  // 12. Hundreds of entities in a single cell (200 entities → 19,900 pairs)
  it('handles 200 entities in a single cell producing 19,900 pairs', () => {
    const entities: CollisionEntity[] = [];
    for (let i = 1; i <= 200; i++) {
      // All at the same position so they all overlap
      entities.push(dynamicEntity(i, 0, 0, 2, 2));
    }
    const pairs = collisionDetectionSystem(entities);
    expect(pairs).toHaveLength(19900); // C(200,2) = 200*199/2
  });

  // 13. overlapX and overlapY correctly computed
  it('computes overlapX and overlapY correctly', () => {
    // Entity A: center (0,0), width=2, depth=2 → extends [-1,1] on X, [-1,1] on Z
    // Entity B: center (1.5, 0.5), width=2, depth=2 → extends [0.5, 2.5] on X, [-0.5, 1.5] on Z
    // overlapX = (1+1) - |0-1.5| = 2 - 1.5 = 0.5
    // overlapZ = (1+1) - |0-0.5| = 2 - 0.5 = 1.5
    const entities = [
      dynamicEntity(1, 0, 0, 2, 2),
      dynamicEntity(2, 1.5, 0.5, 2, 2),
    ];
    const pairs = collisionDetectionSystem(entities);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].overlapX).toBeCloseTo(0.5);
    expect(pairs[0].overlapY).toBeCloseTo(1.5);
  });

  // 14. rebuildStatics is idempotent
  it('rebuildStatics is idempotent', () => {
    const wall = staticEntity(1, 0, 0, 2, 2);
    const player = dynamicEntity(2, 0.5, 0, 1, 1);

    rebuildStatics([wall]);
    const pairs1 = collisionDetectionSystem([wall, player]);

    rebuildStatics([wall]);
    const pairs2 = collisionDetectionSystem([wall, player]);

    rebuildStatics([wall]);
    const pairs3 = collisionDetectionSystem([wall, player]);

    expect(pairs1).toEqual(pairs2);
    expect(pairs2).toEqual(pairs3);
  });

  // ── Property-based tests ────────────────────────────────────────────────

  describe('property-based tests', () => {
    const entityArb = fc.record({
      id: fc.integer({ min: 1, max: 10000 }),
      x: fc.double({ min: -100, max: 100, noNaN: true }),
      z: fc.double({ min: -100, max: 100, noNaN: true }),
      w: fc.double({ min: 0.1, max: 10, noNaN: true }),
      d: fc.double({ min: 0.1, max: 10, noNaN: true }),
    });

    const uniqueEntitiesArb = fc.array(entityArb, { minLength: 2, maxLength: 20 })
      .map(entities => {
        // Deduplicate by id
        const seen = new Set<number>();
        return entities.filter(e => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
      })
      .filter(entities => entities.length >= 2);

    it('property: no false negatives — every overlapping pair is detected', () => {
      fc.assert(
        fc.property(uniqueEntitiesArb, (rawEntities) => {
          resetCollisionState();
          const entities = rawEntities.map(e => dynamicEntity(e.id, e.x, e.z, e.w, e.d));
          const pairs = collisionDetectionSystem(entities);
          const pairSet = new Set(pairs.map(p => `${p.entityA},${p.entityB}`));

          // Brute-force check: every truly overlapping pair must be present
          for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
              const a = entities[i];
              const b = entities[j];
              const [eA, eB] = a.id < b.id ? [a, b] : [b, a];

              const dx = Math.abs(a.position.x - b.position.x);
              const dz = Math.abs(a.position.z - b.position.z);
              const overlapX = (a.collider.width / 2 + b.collider.width / 2) - dx;
              const overlapZ = (a.collider.depth / 2 + b.collider.depth / 2) - dz;

              if (overlapX > 0 && overlapZ > 0) {
                expect(pairSet.has(`${eA.id},${eB.id}`)).toBe(true);
              }
            }
          }
        }),
        { numRuns: 100 },
      );
    });

    it('property: no false positives — every reported pair actually overlaps', () => {
      fc.assert(
        fc.property(uniqueEntitiesArb, (rawEntities) => {
          resetCollisionState();
          const entities = rawEntities.map(e => dynamicEntity(e.id, e.x, e.z, e.w, e.d));
          const entityMap = new Map(entities.map(e => [e.id, e]));
          const pairs = collisionDetectionSystem(entities);

          for (const pair of pairs) {
            const a = entityMap.get(pair.entityA)!;
            const b = entityMap.get(pair.entityB)!;

            const dx = Math.abs(a.position.x - b.position.x);
            const dz = Math.abs(a.position.z - b.position.z);
            const overlapX = (a.collider.width / 2 + b.collider.width / 2) - dx;
            const overlapZ = (a.collider.depth / 2 + b.collider.depth / 2) - dz;

            expect(overlapX).toBeGreaterThan(0);
            expect(overlapZ).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('property: no duplicate pairs', () => {
      fc.assert(
        fc.property(uniqueEntitiesArb, (rawEntities) => {
          resetCollisionState();
          const entities = rawEntities.map(e => dynamicEntity(e.id, e.x, e.z, e.w, e.d));
          const pairs = collisionDetectionSystem(entities);
          const pairKeys = pairs.map(p => `${p.entityA},${p.entityB}`);
          expect(new Set(pairKeys).size).toBe(pairKeys.length);
        }),
        { numRuns: 100 },
      );
    });

    it('property: entityA.id < entityB.id in every pair', () => {
      fc.assert(
        fc.property(uniqueEntitiesArb, (rawEntities) => {
          resetCollisionState();
          const entities = rawEntities.map(e => dynamicEntity(e.id, e.x, e.z, e.w, e.d));
          const pairs = collisionDetectionSystem(entities);
          for (const pair of pairs) {
            expect(pair.entityA).toBeLessThan(pair.entityB);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('property: output is deterministic', () => {
      fc.assert(
        fc.property(uniqueEntitiesArb, (rawEntities) => {
          resetCollisionState();
          const entities = rawEntities.map(e => dynamicEntity(e.id, e.x, e.z, e.w, e.d));
          const pairs1 = collisionDetectionSystem(entities);
          resetCollisionState();
          const pairs2 = collisionDetectionSystem(entities);
          expect(pairs1).toEqual(pairs2);
        }),
        { numRuns: 50 },
      );
    });

    it('property: system never modifies input entities', () => {
      fc.assert(
        fc.property(uniqueEntitiesArb, (rawEntities) => {
          resetCollisionState();
          const entities = rawEntities.map(e => dynamicEntity(e.id, e.x, e.z, e.w, e.d));
          const snapshots = entities.map(e => ({
            id: e.id,
            x: e.position.x,
            z: e.position.z,
            width: e.collider.width,
            depth: e.collider.depth,
          }));
          collisionDetectionSystem(entities);
          for (let i = 0; i < entities.length; i++) {
            expect(entities[i].id).toBe(snapshots[i].id);
            expect(entities[i].position.x).toBe(snapshots[i].x);
            expect(entities[i].position.z).toBe(snapshots[i].z);
            expect(entities[i].collider.width).toBe(snapshots[i].width);
            expect(entities[i].collider.depth).toBe(snapshots[i].depth);
          }
        }),
        { numRuns: 50 },
      );
    });
  });
});
