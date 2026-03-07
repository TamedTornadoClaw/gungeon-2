import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateDungeon,
  mulberry32,
  ALL_GUN_TYPES,
  randomGunType,
  placeRooms,
  buildMST,
} from '../src/dungeon/generator.js';
import { getDesignParams } from '../src/config/designParams.js';
import { GunType } from '../src/ecs/components.js';
import type { Room } from '../src/dungeon/dungeonData.js';

const params = getDesignParams().dungeon;

// Helper: check if two axis-aligned rects overlap
function roomsOverlap(a: Room, b: Room): boolean {
  return !(
    a.bounds.max.x <= b.bounds.min.x ||
    b.bounds.max.x <= a.bounds.min.x ||
    a.bounds.max.z <= b.bounds.min.z ||
    b.bounds.max.z <= a.bounds.min.z
  );
}

// Helper: verify MST connectivity using union-find over MST edges
function isMSTConnected(roomCount: number, edges: [number, number][]): boolean {
  if (roomCount <= 1) return true;

  const parent = Array.from({ length: roomCount }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  for (const [a, b] of edges) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  const root = find(0);
  for (let i = 1; i < roomCount; i++) {
    if (find(i) !== root) return false;
  }
  return true;
}

describe('Dungeon Generator', () => {
  describe('Room count', () => {
    it('generates exactly roomsPerFloor rooms on non-boss floors', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          expect(dungeon.rooms.length).toBe(params.roomsPerFloor);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('No room overlap', () => {
    it('no two rooms overlap across many seeds', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          for (let i = 0; i < dungeon.rooms.length; i++) {
            for (let j = i + 1; j < dungeon.rooms.length; j++) {
              expect(roomsOverlap(dungeon.rooms[i], dungeon.rooms[j])).toBe(false);
            }
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Room dimensions', () => {
    it('all rooms have dimensions within [roomMinSize, roomMaxSize]', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          for (const room of dungeon.rooms) {
            const w = room.bounds.max.x - room.bounds.min.x;
            const h = room.bounds.max.z - room.bounds.min.z;
            expect(w).toBeGreaterThanOrEqual(params.roomMinSize);
            expect(w).toBeLessThanOrEqual(params.roomMaxSize);
            expect(h).toBeGreaterThanOrEqual(params.roomMinSize);
            expect(h).toBeLessThanOrEqual(params.roomMaxSize);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('produces boundary dimensions (20 and 50) over many seeds', () => {
      const allWidths = new Set<number>();
      const allHeights = new Set<number>();
      for (let seed = 1; seed <= 500; seed++) {
        const dungeon = generateDungeon(seed, 1);
        for (const room of dungeon.rooms) {
          allWidths.add(room.bounds.max.x - room.bounds.min.x);
          allHeights.add(room.bounds.max.z - room.bounds.min.z);
        }
      }
      expect(allWidths.has(params.roomMinSize)).toBe(true);
      expect(allWidths.has(params.roomMaxSize)).toBe(true);
    });
  });

  describe('Connectivity', () => {
    it('MST connects all rooms', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const rng = mulberry32(seed);
          const rects = placeRooms(rng, params.roomsPerFloor, params.roomMinSize, params.roomMaxSize);
          const edges = buildMST(rects);
          expect(isMSTConnected(rects.length, edges)).toBe(true);
        }),
        { numRuns: 50 },
      );
    });

    it('has at least n-1 corridors for n rooms', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          // Each MST edge produces 1-2 corridor segments (L-shaped)
          // MST has n-1 edges, so at least n-1 corridor segments
          expect(dungeon.corridors.length).toBeGreaterThanOrEqual(dungeon.rooms.length - 1);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Corridor width', () => {
    it('all corridors have correct width', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          for (const corridor of dungeon.corridors) {
            expect(corridor.width).toBe(params.corridorWidth);
          }
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Stairs placement', () => {
    it('stairsPosition is inside the last room bounds', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          const lastRoom = dungeon.rooms[dungeon.rooms.length - 1];
          expect(dungeon.stairsPosition.x).toBeGreaterThanOrEqual(lastRoom.bounds.min.x);
          expect(dungeon.stairsPosition.x).toBeLessThanOrEqual(lastRoom.bounds.max.x);
          expect(dungeon.stairsPosition.z).toBeGreaterThanOrEqual(lastRoom.bounds.min.z);
          expect(dungeon.stairsPosition.z).toBeLessThanOrEqual(lastRoom.bounds.max.z);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('SpawnZone enemy count', () => {
    it('every spawn zone has enemyCount within [min, max]', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          for (const room of dungeon.rooms) {
            for (const sp of room.spawnPoints) {
              expect(sp.enemyCount).toBeGreaterThanOrEqual(params.enemiesPerRoom.min);
              expect(sp.enemyCount).toBeLessThanOrEqual(params.enemiesPerRoom.max);
            }
          }
        }),
        { numRuns: 100 },
      );
    });

    it('stairs room has no spawn points', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          const lastRoom = dungeon.rooms[dungeon.rooms.length - 1];
          expect(lastRoom.spawnPoints.length).toBe(0);
        }),
        { numRuns: 50 },
      );
    });

    it('non-stairs rooms have at least one spawn point', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          for (let i = 0; i < dungeon.rooms.length - 1; i++) {
            expect(dungeon.rooms[i].spawnPoints.length).toBeGreaterThanOrEqual(1);
          }
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Boss floor', () => {
    it('generates exactly 1 room on boss floor', () => {
      const dungeon = generateDungeon(42, params.bossFloorDepth);
      expect(dungeon.rooms.length).toBe(1);
    });

    it('boss room has no spawn points (boss entity handled separately)', () => {
      const dungeon = generateDungeon(42, params.bossFloorDepth);
      expect(dungeon.rooms[0].spawnPoints.length).toBe(0);
    });

    it('boss floor has no corridors', () => {
      const dungeon = generateDungeon(42, params.bossFloorDepth);
      expect(dungeon.corridors.length).toBe(0);
    });

    it('boss floor has no chests or shops', () => {
      const dungeon = generateDungeon(42, params.bossFloorDepth);
      expect(dungeon.rooms[0].hasChest).toBe(false);
      expect(dungeon.rooms[0].hasShop).toBe(false);
    });

    it('boss room has max size dimensions', () => {
      const dungeon = generateDungeon(42, params.bossFloorDepth);
      const room = dungeon.rooms[0];
      const w = room.bounds.max.x - room.bounds.min.x;
      const h = room.bounds.max.z - room.bounds.min.z;
      expect(w).toBe(params.roomMaxSize);
      expect(h).toBe(params.roomMaxSize);
    });
  });

  describe('Chest placement probability', () => {
    it('chest frequency is roughly chestChancePerRoom within tolerance', () => {
      let totalRooms = 0;
      let totalChests = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const dungeon = generateDungeon(seed, 1);
        for (let i = 0; i < dungeon.rooms.length - 1; i++) {
          totalRooms++;
          if (dungeon.rooms[i].hasChest) totalChests++;
        }
      }
      const ratio = totalChests / totalRooms;
      // Allow generous statistical tolerance
      expect(ratio).toBeGreaterThan(params.chestChancePerRoom * 0.5);
      expect(ratio).toBeLessThan(params.chestChancePerRoom * 1.5);
    });
  });

  describe('Shop placement', () => {
    it('at most 1 shop per floor', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          const shopCount = dungeon.rooms.filter(r => r.hasShop).length;
          expect(shopCount).toBeLessThanOrEqual(1);
        }),
        { numRuns: 100 },
      );
    });

    it('shop frequency is roughly shopChancePerFloor within tolerance', () => {
      let floorsWithShop = 0;
      const totalFloors = 200;
      for (let seed = 1; seed <= totalFloors; seed++) {
        const dungeon = generateDungeon(seed, 1);
        if (dungeon.rooms.some(r => r.hasShop)) floorsWithShop++;
      }
      const ratio = floorsWithShop / totalFloors;
      expect(ratio).toBeGreaterThan(params.shopChancePerFloor * 0.4);
      expect(ratio).toBeLessThan(params.shopChancePerFloor * 1.6);
    });
  });

  describe('Chest GunType uniform distribution', () => {
    it('all 5 gun types appear with roughly equal frequency', () => {
      const counts = new Map<GunType, number>();
      for (const gt of ALL_GUN_TYPES) counts.set(gt, 0);

      let totalChests = 0;
      for (let seed = 1; seed <= 2000; seed++) {
        const rng = mulberry32(seed);
        const gt = randomGunType(rng);
        counts.set(gt, counts.get(gt)! + 1);
        totalChests++;
      }

      const expected = totalChests / 5;
      for (const [, count] of counts) {
        // Chi-squared-like check: each should be within 50% of expected
        expect(count).toBeGreaterThan(expected * 0.5);
        expect(count).toBeLessThan(expected * 1.5);
      }

      // All 5 types appeared
      expect(counts.size).toBe(5);
      for (const count of counts.values()) {
        expect(count).toBeGreaterThan(0);
      }
    });
  });

  describe('Hazard and destructible placement within bounds', () => {
    it('all hazards are within their room bounds', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          for (const room of dungeon.rooms) {
            for (const h of room.hazardPlacements) {
              expect(h.position.x).toBeGreaterThanOrEqual(room.bounds.min.x);
              expect(h.position.x).toBeLessThanOrEqual(room.bounds.max.x);
              expect(h.position.z).toBeGreaterThanOrEqual(room.bounds.min.z);
              expect(h.position.z).toBeLessThanOrEqual(room.bounds.max.z);
            }
          }
        }),
        { numRuns: 50 },
      );
    });

    it('all destructibles are within their room bounds', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          for (const room of dungeon.rooms) {
            for (const d of room.destructiblePlacements) {
              expect(d.position.x).toBeGreaterThanOrEqual(room.bounds.min.x);
              expect(d.position.x).toBeLessThanOrEqual(room.bounds.max.x);
              expect(d.position.z).toBeGreaterThanOrEqual(room.bounds.min.z);
              expect(d.position.z).toBeLessThanOrEqual(room.bounds.max.z);
            }
          }
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Deterministic output', () => {
    it('same seed and depth produce identical output', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }),
          fc.integer({ min: 1, max: 9 }),
          (seed, depth) => {
            const d1 = generateDungeon(seed, depth);
            const d2 = generateDungeon(seed, depth);
            expect(d1).toEqual(d2);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Player start position', () => {
    it('playerStart is inside the first room', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (seed) => {
          const dungeon = generateDungeon(seed, 1);
          const firstRoom = dungeon.rooms[0];
          expect(dungeon.playerStart.x).toBeGreaterThanOrEqual(firstRoom.bounds.min.x);
          expect(dungeon.playerStart.x).toBeLessThanOrEqual(firstRoom.bounds.max.x);
          expect(dungeon.playerStart.z).toBeGreaterThanOrEqual(firstRoom.bounds.min.z);
          expect(dungeon.playerStart.z).toBeLessThanOrEqual(firstRoom.bounds.max.z);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Seeded PRNG (mulberry32)', () => {
    it('produces deterministic sequences', () => {
      const rng1 = mulberry32(12345);
      const rng2 = mulberry32(12345);
      for (let i = 0; i < 100; i++) {
        expect(rng1()).toBe(rng2());
      }
    });

    it('produces values in [0, 1)', () => {
      const rng = mulberry32(99999);
      for (let i = 0; i < 1000; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('different seeds produce different sequences', () => {
      const rng1 = mulberry32(1);
      const rng2 = mulberry32(2);
      // At least one of the first 10 values should differ
      let allSame = true;
      for (let i = 0; i < 10; i++) {
        if (rng1() !== rng2()) {
          allSame = false;
          break;
        }
      }
      expect(allSame).toBe(false);
    });
  });
});
