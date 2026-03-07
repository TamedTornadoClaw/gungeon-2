import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import type { Shield } from '../src/ecs/components';
import { shieldRegenSystem } from '../src/systems/shieldRegenSystem';

function addShieldEntity(world: World, shield: Shield): number {
  const id = world.createEntity();
  world.addComponent(id, 'Shield', { ...shield });
  return id;
}

function makeShield(overrides: Partial<Shield> = {}): Shield {
  return {
    current: 50,
    max: 100,
    regenRate: 10,
    regenDelay: 2.0,
    timeSinceLastHit: 0,
    ...overrides,
  };
}

describe('shieldRegenSystem', () => {
  // ── Property: timeSinceLastHit increases by exactly dt every frame ──
  it('timeSinceLastHit increases by exactly dt unconditionally', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 100 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 10 }),
        (initialTimer, dt) => {
          const world = new World();
          const id = addShieldEntity(world, makeShield({ timeSinceLastHit: initialTimer }));

          shieldRegenSystem(world, dt);

          const shield = world.getComponent<Shield>(id, 'Shield')!;
          expect(shield.timeSinceLastHit).toBeCloseTo(initialTimer + dt, 10);
        },
      ),
      { numRuns: 200 },
    );
  });

  // ── Property: current never exceeds max ──
  it('current never exceeds max', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 100 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1000 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 10 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 10 }),
        (max, regenRate, regenDelay, dt) => {
          // current <= max to be a valid starting state
          const current = max * 0.5;
          const world = new World();
          const id = addShieldEntity(
            world,
            makeShield({ current, max, regenRate, regenDelay, timeSinceLastHit: regenDelay + 1 }),
          );

          shieldRegenSystem(world, dt);

          const shield = world.getComponent<Shield>(id, 'Shield')!;
          expect(shield.current).toBeLessThanOrEqual(shield.max);
        },
      ),
      { numRuns: 200 },
    );
  });

  // ── Property: regen only when timeSinceLastHit >= regenDelay ──
  it('regeneration only occurs when timeSinceLastHit >= regenDelay', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 50 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 51, max: 100 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 1, max: 100 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: Math.fround(0.1) }),
        (current, max, regenRate, dt) => {
          // Timer well below delay — no regen should occur
          const regenDelay = 5.0;
          const timeSinceLastHit = 1.0; // well below delay even after adding dt
          const world = new World();
          const id = addShieldEntity(
            world,
            makeShield({ current, max, regenRate, regenDelay, timeSinceLastHit }),
          );

          shieldRegenSystem(world, dt);

          const shield = world.getComponent<Shield>(id, 'Shield')!;
          expect(shield.current).toBe(current);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Property: system never modifies max, regenRate, or regenDelay ──
  it('never modifies max, regenRate, or regenDelay', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 1, max: 100 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 1, max: 100 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 10 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1 }),
        (max, regenRate, regenDelay, dt) => {
          const world = new World();
          const id = addShieldEntity(
            world,
            makeShield({ max, regenRate, regenDelay, timeSinceLastHit: 100 }),
          );

          shieldRegenSystem(world, dt);

          const shield = world.getComponent<Shield>(id, 'Shield')!;
          expect(shield.max).toBe(max);
          expect(shield.regenRate).toBe(regenRate);
          expect(shield.regenDelay).toBe(regenDelay);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ── Property: if current === max, current is not mutated ──
  it('if current === max, current is not mutated', () => {
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 100, max: 100, timeSinceLastHit: 10 }),
    );

    shieldRegenSystem(world, 1 / 60);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.current).toBe(100);
  });

  // ── Property: system does not reset timeSinceLastHit ──
  it('system does not reset timeSinceLastHit', () => {
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ timeSinceLastHit: 100 }),
    );

    shieldRegenSystem(world, 1 / 60);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.timeSinceLastHit).toBeGreaterThan(100);
  });

  // ── Adversarial 1: Timer increments even when shield is full ──
  it('timer increments even when shield is full', () => {
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 100, max: 100, timeSinceLastHit: 5.0 }),
    );

    shieldRegenSystem(world, 1 / 60);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.timeSinceLastHit).toBeCloseTo(5.0 + 1 / 60, 10);
  });

  // ── Adversarial 2: Regen does not start one frame too early ──
  it('regen does not start one frame too early', () => {
    // timeSinceLastHit=1.98, dt=1/60, delay=2.0
    // After increment: 1.98 + 1/60 ≈ 1.9967 < 2.0 → no regen
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 50, max: 100, regenRate: 10, regenDelay: 2.0, timeSinceLastHit: 1.98 }),
    );

    shieldRegenSystem(world, 1 / 60);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.current).toBe(50);
  });

  // ── Adversarial 3: Regen starts exactly at the delay boundary ──
  it('regen starts exactly at the delay boundary', () => {
    // timeSinceLastHit=1.99, dt=0.01, delay=2.0
    // After increment: 1.99 + 0.01 = 2.0 >= 2.0 → regen activates
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 50, max: 100, regenRate: 10, regenDelay: 2.0, timeSinceLastHit: 1.99 }),
    );

    shieldRegenSystem(world, 0.01);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.current).toBeCloseTo(50 + 10 * 0.01, 10);
  });

  // ── Adversarial 4: Regen clamps at max and does not overshoot ──
  it('regen clamps at max and does not overshoot', () => {
    // current=49.5, regenRate=100, max=50, dt=1/60
    // Would add 100 * (1/60) ≈ 1.667 → 51.167 but clamped to 50
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 49.5, max: 50, regenRate: 100, regenDelay: 0, timeSinceLastHit: 0 }),
    );

    shieldRegenSystem(world, 1 / 60);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.current).toBe(50);
  });

  // ── Adversarial 5: Very large dt does not break the system ──
  it('very large dt does not break the system', () => {
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 0, max: 100, regenRate: 50, regenDelay: 0, timeSinceLastHit: 0 }),
    );

    shieldRegenSystem(world, 10.0);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    // 50 * 10 = 500, clamped to 100
    expect(shield.current).toBe(100);
  });

  // ── Adversarial 6: Zero regenRate means no regen even after delay ──
  it('zero regenRate means no regen even after delay', () => {
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 30, max: 100, regenRate: 0, regenDelay: 1.0, timeSinceLastHit: 5.0 }),
    );

    shieldRegenSystem(world, 1 / 60);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.current).toBe(30);
  });

  // ── Adversarial 7: Multiple entities processed independently ──
  it('multiple entities processed independently', () => {
    const world = new World();
    // Entity 1: past delay, should regen
    const id1 = addShieldEntity(
      world,
      makeShield({ current: 50, max: 100, regenRate: 10, regenDelay: 2.0, timeSinceLastHit: 3.0 }),
    );
    // Entity 2: not past delay, should not regen
    const id2 = addShieldEntity(
      world,
      makeShield({ current: 50, max: 100, regenRate: 10, regenDelay: 2.0, timeSinceLastHit: 0.5 }),
    );

    const dt = 1 / 60;
    shieldRegenSystem(world, dt);

    const s1 = world.getComponent<Shield>(id1, 'Shield')!;
    const s2 = world.getComponent<Shield>(id2, 'Shield')!;

    expect(s1.current).toBeCloseTo(50 + 10 * dt, 10);
    expect(s2.current).toBe(50);
    expect(s1.timeSinceLastHit).toBeCloseTo(3.0 + dt, 10);
    expect(s2.timeSinceLastHit).toBeCloseTo(0.5 + dt, 10);
  });

  // ── Adversarial 8: timeSinceLastHit is not reset by the system ──
  it('timeSinceLastHit is not reset by the system', () => {
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ timeSinceLastHit: 100 }),
    );

    shieldRegenSystem(world, 0.5);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.timeSinceLastHit).toBeCloseTo(100.5, 10);
  });

  // ── Adversarial 9: dt = 0 is a no-op for regen amount ──
  it('dt = 0 is a no-op for regen amount', () => {
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 50, max: 100, regenRate: 10, regenDelay: 1.0, timeSinceLastHit: 5.0 }),
    );

    shieldRegenSystem(world, 0);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.current).toBe(50);
  });

  // ── Edge case: Shield with current=0, max=0 ──
  it('shield with current=0 max=0 — no regen, no NaN', () => {
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 0, max: 0, regenRate: 10, regenDelay: 0, timeSinceLastHit: 5.0 }),
    );

    shieldRegenSystem(world, 1 / 60);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.current).toBe(0);
    expect(Number.isNaN(shield.current)).toBe(false);
  });

  // ── Edge case: regenDelay=0 means regen starts immediately ──
  it('regenDelay=0 means regen starts immediately', () => {
    const world = new World();
    const id = addShieldEntity(
      world,
      makeShield({ current: 50, max: 100, regenRate: 20, regenDelay: 0, timeSinceLastHit: 0 }),
    );

    const dt = 1 / 60;
    shieldRegenSystem(world, dt);

    const shield = world.getComponent<Shield>(id, 'Shield')!;
    expect(shield.current).toBeCloseTo(50 + 20 * dt, 10);
  });

  // ── Entities without Shield are untouched ──
  it('entities without Shield component are untouched', () => {
    const world = new World();
    const id = world.createEntity();
    world.addComponent(id, 'Health', { current: 50, max: 100, lastDamageSourceGunSlot: null });

    shieldRegenSystem(world, 1 / 60);

    // Health should be unchanged
    const health = world.getComponent<{ current: number }>(id, 'Health')!;
    expect(health.current).toBe(50);
    // No Shield component should exist
    expect(world.hasComponent(id, 'Shield')).toBe(false);
  });

  // ── Empty world does not throw ──
  it('empty world does not throw', () => {
    const world = new World();
    expect(() => shieldRegenSystem(world, 1 / 60)).not.toThrow();
  });

  // ── Property: while regenerating, current increases by exactly regenRate * dt ──
  it('while regenerating, current increases by exactly regenRate * dt per frame', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 50 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 51, max: 200 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: Math.fround(0.001), max: 50 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: Math.fround(0.001), max: 1 }),
        (current, max, regenRate, dt) => {
          // Ensure regen won't clamp (current + regenRate * dt < max)
          if (current + regenRate * dt >= max) return;

          const world = new World();
          const id = addShieldEntity(
            world,
            makeShield({ current, max, regenRate, regenDelay: 0, timeSinceLastHit: 0 }),
          );

          shieldRegenSystem(world, dt);

          const shield = world.getComponent<Shield>(id, 'Shield')!;
          expect(shield.current).toBeCloseTo(current + regenRate * dt, 5);
        },
      ),
      { numRuns: 200 },
    );
  });
});
