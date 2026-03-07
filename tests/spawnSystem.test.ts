import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { spawnSystem } from '../src/systems/spawnSystem';
import { EnemyType } from '../src/ecs/components';
import type { Position, SpawnZone, Health, Enemy } from '../src/ecs/components';
import { createSpawnZone } from '../src/ecs/factories';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeZone(
  world: World,
  opts: {
    x?: number;
    z?: number;
    width?: number;
    height?: number;
    enemyTypes?: EnemyType[];
    enemyCount?: number;
    activated?: boolean;
    cleared?: boolean;
  } = {},
): number {
  const id = createSpawnZone(
    world,
    { x: opts.x ?? 10, y: 0, z: opts.z ?? 10 },
    { x: opts.width ?? 20, y: opts.height ?? 20 },
    opts.enemyTypes ?? [EnemyType.KnifeRusher, EnemyType.Shotgunner],
    opts.enemyCount ?? 5,
  );
  const zone = world.getComponent<SpawnZone>(id, 'SpawnZone')!;
  zone.activated = opts.activated ?? true;
  if (opts.cleared) zone.cleared = true;
  return id;
}

function getZone(world: World, id: number): SpawnZone {
  return world.getComponent<SpawnZone>(id, 'SpawnZone')!;
}

function deterministicRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('spawnSystem', () => {
  describe('basic spawn on activation', () => {
    it('spawns exactly enemyCount enemies when activated with empty spawnedEnemies', () => {
      const world = new World();
      const zoneId = makeZone(world, {
        x: 10,
        z: 10,
        width: 20,
        height: 20,
        enemyTypes: [EnemyType.KnifeRusher, EnemyType.Shotgunner],
        enemyCount: 5,
        activated: true,
      });

      spawnSystem(world, 1);

      const zone = getZone(world, zoneId);
      expect(zone.spawnedEnemies).toHaveLength(5);

      for (const enemyId of zone.spawnedEnemies) {
        expect(world.hasEntity(enemyId)).toBe(true);
        const pos = world.getComponent<Position>(enemyId, 'Position')!;
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThanOrEqual(20);
        expect(pos.z).toBeGreaterThanOrEqual(0);
        expect(pos.z).toBeLessThanOrEqual(20);
        const enemy = world.getComponent<Enemy>(enemyId, 'Enemy')!;
        expect([EnemyType.KnifeRusher, EnemyType.Shotgunner]).toContain(enemy.enemyType);
      }
    });
  });

  describe('no double-spawn on subsequent frames', () => {
    it('does not spawn new enemies on second run', () => {
      const world = new World();
      const zoneId = makeZone(world, { enemyCount: 3 });

      spawnSystem(world, 1);
      const zone = getZone(world, zoneId);
      expect(zone.spawnedEnemies).toHaveLength(3);

      const originalIds = [...zone.spawnedEnemies];
      spawnSystem(world, 1);
      expect(zone.spawnedEnemies).toHaveLength(3);
      expect(zone.spawnedEnemies).toEqual(originalIds);
    });
  });

  describe('depth scaling', () => {
    it('at depth 1 applies no scaling (multiplier = 1.0)', () => {
      const world = new World();
      const zoneId = makeZone(world, {
        enemyTypes: [EnemyType.KnifeRusher],
        enemyCount: 1,
      });

      // Use fixed rng: miniBoss roll > threshold, enemy type index 0
      spawnSystem(world, 1, deterministicRng([0.95, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      const enemyId = zone.spawnedEnemies[0];
      const health = world.getComponent<Health>(enemyId, 'Health')!;
      // base health 30, depth=1 → createEnemy gets depth-1=0 → 30 * (1 + 0 * 0.15) = 30
      expect(health.current).toBe(30);
      expect(health.max).toBe(30);
    });

    it('at depth 5 scales stats correctly', () => {
      const world = new World();
      const zoneId = makeZone(world, {
        enemyTypes: [EnemyType.KnifeRusher],
        enemyCount: 1,
      });

      spawnSystem(world, 5, deterministicRng([0.95, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      const enemyId = zone.spawnedEnemies[0];
      const health = world.getComponent<Health>(enemyId, 'Health')!;
      // depth=5 → createEnemy gets depth-1=4 → 30 * (1 + 4 * 0.15) = 30 * 1.6 = 48
      expect(health.current).toBeCloseTo(48, 5);
      expect(health.max).toBeCloseTo(48, 5);
    });
  });

  describe('mini-boss roll', () => {
    it('creates exactly one mini-boss when roll succeeds', () => {
      const world = new World();
      const zoneId = makeZone(world, {
        enemyTypes: [EnemyType.Rifleman],
        enemyCount: 4,
      });

      // First rng call: mini-boss roll = 0.05 (< 0.1, succeeds)
      // Second rng call: mini-boss index selection = 0.5 → floor(0.5 * 4) = 2
      // Remaining calls: enemy type selection (0) and positions (0.5)
      spawnSystem(world, 3, deterministicRng([0.05, 0.5, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      const miniCount = zone.spawnedEnemies.filter((id) => {
        const enemy = world.getComponent<Enemy>(id, 'Enemy')!;
        return enemy.isMini;
      }).length;
      expect(miniCount).toBe(1);

      const nonMiniCount = zone.spawnedEnemies.filter((id) => {
        const enemy = world.getComponent<Enemy>(id, 'Enemy')!;
        return !enemy.isMini;
      }).length;
      expect(nonMiniCount).toBe(3);
    });

    it('creates no mini-boss when roll fails', () => {
      const world = new World();
      const zoneId = makeZone(world, {
        enemyTypes: [EnemyType.Rifleman],
        enemyCount: 4,
      });

      spawnSystem(world, 3, deterministicRng([0.95, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      for (const id of zone.spawnedEnemies) {
        const enemy = world.getComponent<Enemy>(id, 'Enemy')!;
        expect(enemy.isMini).toBe(false);
      }
    });

    it('mini-boss has stats multiplied by miniBossStatMultiplier (2.5)', () => {
      const world = new World();
      const zoneId = makeZone(world, {
        enemyTypes: [EnemyType.KnifeRusher],
        enemyCount: 2,
      });

      // mini-boss roll succeeds, index = 0
      spawnSystem(world, 1, deterministicRng([0.05, 0, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      const miniId = zone.spawnedEnemies.find((id) => {
        return world.getComponent<Enemy>(id, 'Enemy')!.isMini;
      })!;
      const normalId = zone.spawnedEnemies.find((id) => {
        return !world.getComponent<Enemy>(id, 'Enemy')!.isMini;
      })!;

      const miniHealth = world.getComponent<Health>(miniId, 'Health')!;
      const normalHealth = world.getComponent<Health>(normalId, 'Health')!;
      // At depth 1: base=30, mini = 30 * 2.5 = 75, normal = 30
      expect(miniHealth.current).toBeCloseTo(75, 5);
      expect(normalHealth.current).toBeCloseTo(30, 5);
    });
  });

  describe('cleared flag', () => {
    it('sets cleared=true when all enemies die (health <= 0)', () => {
      const world = new World();
      const zoneId = makeZone(world, { enemyCount: 3 });

      spawnSystem(world, 1, deterministicRng([0.95, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      for (const id of zone.spawnedEnemies) {
        const health = world.getComponent<Health>(id, 'Health')!;
        health.current = 0;
      }

      spawnSystem(world, 1);
      expect(zone.cleared).toBe(true);
    });

    it('does NOT set cleared when some enemies alive', () => {
      const world = new World();
      const zoneId = makeZone(world, { enemyCount: 3 });

      spawnSystem(world, 1, deterministicRng([0.95, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      // Kill 2, leave 1 alive
      const health0 = world.getComponent<Health>(zone.spawnedEnemies[0], 'Health')!;
      health0.current = 0;
      const health1 = world.getComponent<Health>(zone.spawnedEnemies[1], 'Health')!;
      health1.current = 0;

      spawnSystem(world, 1);
      expect(zone.cleared).toBe(false);
    });

    it('sets cleared=true when enemies are destroyed from world', () => {
      const world = new World();
      const zoneId = makeZone(world, { enemyCount: 3 });

      spawnSystem(world, 1, deterministicRng([0.95, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      for (const id of zone.spawnedEnemies) {
        world.destroyEntity(id);
      }

      spawnSystem(world, 1);
      expect(zone.cleared).toBe(true);
    });
  });

  describe('spawn positions within bounds', () => {
    it('all enemy positions are within zone bounds (property-based)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: 1, max: 50, noNaN: true }),
          fc.float({ min: 1, max: 50, noNaN: true }),
          (cx, cz, w, h) => {
            const world = new World();
            const zoneId = makeZone(world, {
              x: cx,
              z: cz,
              width: w,
              height: h,
              enemyCount: 10,
              enemyTypes: [EnemyType.KnifeRusher],
            });

            spawnSystem(world, 1);

            const zone = getZone(world, zoneId);
            for (const id of zone.spawnedEnemies) {
              const pos = world.getComponent<Position>(id, 'Position')!;
              expect(pos.x).toBeGreaterThanOrEqual(cx - w / 2);
              expect(pos.x).toBeLessThanOrEqual(cx + w / 2);
              expect(pos.z).toBeGreaterThanOrEqual(cz - h / 2);
              expect(pos.z).toBeLessThanOrEqual(cz + h / 2);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('edge cases', () => {
    it('handles enemyCount=0 by immediately setting cleared', () => {
      const world = new World();
      const zoneId = makeZone(world, { enemyCount: 0 });

      spawnSystem(world, 1);

      const zone = getZone(world, zoneId);
      expect(zone.spawnedEnemies).toHaveLength(0);
      expect(zone.cleared).toBe(true);
    });

    it('single enemy type in enemyTypes', () => {
      const world = new World();
      const zoneId = makeZone(world, {
        enemyTypes: [EnemyType.SuicideBomber],
        enemyCount: 5,
      });

      spawnSystem(world, 1, deterministicRng([0.95, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      for (const id of zone.spawnedEnemies) {
        const enemy = world.getComponent<Enemy>(id, 'Enemy')!;
        expect(enemy.enemyType).toBe(EnemyType.SuicideBomber);
      }
    });

    it('non-activated zone is ignored', () => {
      const world = new World();
      const zoneId = makeZone(world, { activated: false, enemyCount: 5 });

      spawnSystem(world, 1);

      const zone = getZone(world, zoneId);
      expect(zone.spawnedEnemies).toHaveLength(0);
      expect(zone.cleared).toBe(false);
    });

    it('already cleared zone does not re-spawn', () => {
      const world = new World();
      const zoneId = makeZone(world, { cleared: true, enemyCount: 5 });

      spawnSystem(world, 1);

      const zone = getZone(world, zoneId);
      expect(zone.spawnedEnemies).toHaveLength(0);
    });

    it('very small bounds (width=1, height=1) does not crash', () => {
      const world = new World();
      const zoneId = makeZone(world, { width: 1, height: 1, enemyCount: 3 });

      spawnSystem(world, 1);

      const zone = getZone(world, zoneId);
      expect(zone.spawnedEnemies).toHaveLength(3);
      for (const id of zone.spawnedEnemies) {
        const pos = world.getComponent<Position>(id, 'Position')!;
        expect(isFinite(pos.x)).toBe(true);
        expect(isFinite(pos.z)).toBe(true);
      }
    });

    it('zone at world origin (0,0,0) handles negative offset positions', () => {
      const world = new World();
      const zoneId = makeZone(world, {
        x: 0,
        z: 0,
        width: 10,
        height: 10,
        enemyCount: 5,
      });

      spawnSystem(world, 1);

      const zone = getZone(world, zoneId);
      expect(zone.spawnedEnemies).toHaveLength(5);
      for (const id of zone.spawnedEnemies) {
        const pos = world.getComponent<Position>(id, 'Position')!;
        expect(pos.x).toBeGreaterThanOrEqual(-5);
        expect(pos.x).toBeLessThanOrEqual(5);
        expect(pos.z).toBeGreaterThanOrEqual(-5);
        expect(pos.z).toBeLessThanOrEqual(5);
      }
    });

    it('very high depth (100) scales smoothly', () => {
      const world = new World();
      const zoneId = makeZone(world, {
        enemyTypes: [EnemyType.KnifeRusher],
        enemyCount: 1,
      });

      spawnSystem(world, 100, deterministicRng([0.95, 0, 0.5, 0.5]));

      const zone = getZone(world, zoneId);
      const health = world.getComponent<Health>(zone.spawnedEnemies[0], 'Health')!;
      // 30 * (1 + 99 * 0.15) = 30 * 15.85 = 475.5
      expect(health.current).toBeCloseTo(475.5, 1);
    });
  });

  describe('multiple zones', () => {
    it('processes multiple zones independently', () => {
      const world = new World();
      const z1 = makeZone(world, { enemyCount: 2 });
      const z2 = makeZone(world, { enemyCount: 3, activated: false });

      spawnSystem(world, 1);

      expect(getZone(world, z1).spawnedEnemies).toHaveLength(2);
      expect(getZone(world, z2).spawnedEnemies).toHaveLength(0);
    });
  });
});
