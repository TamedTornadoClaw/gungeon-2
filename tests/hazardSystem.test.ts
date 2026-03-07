import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { hazardSystem } from '../src/systems/hazardSystem';
import { EventType, HazardType } from '../src/ecs/components';
import type { DamageOverTime, Health, Position } from '../src/ecs/components';
import type { DamageEvent } from '../src/gameloop/events';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createEntityWithDotAndHealth(
  world: World,
  dps: number,
  hp: number,
  refreshed = true,
): number {
  const id = world.createEntity();
  world.addComponent<DamageOverTime>(id, 'DamageOverTime', {
    damagePerSecond: dps,
    sourceType: HazardType.Fire,
    refreshed,
  });
  world.addComponent<Health>(id, 'Health', {
    current: hp,
    max: hp,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<Position>(id, 'Position', { x: 5, y: 0, z: 3 });
  return id;
}

function consumeDamageEvents(eq: EventQueue): DamageEvent[] {
  return eq.consume<EventType.Damage>(EventType.Damage);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('hazardSystem', () => {
  it('emits one DamageEvent per entity with DamageOverTime + Health', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    const id = createEntityWithDotAndHealth(world, 10, 100);
    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events).toHaveLength(1);
    expect(events[0].target).toBe(id);
    expect(events[0].type).toBe(EventType.Damage);
  });

  it('DamageEvent.amount equals damagePerSecond * dt exactly', () => {
    const world = new World();
    const eq = new EventQueue();
    const dps = 30;
    const dt = 1 / 60;

    createEntityWithDotAndHealth(world, dps, 100);
    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events[0].amount).toBe(dps * dt);
  });

  it('sets refreshed = false after emitting', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    const id = createEntityWithDotAndHealth(world, 10, 100, true);
    hazardSystem(world, eq, dt);

    const dot = world.getComponent<DamageOverTime>(id, 'DamageOverTime')!;
    expect(dot.refreshed).toBe(false);
  });

  it('entity with refreshed=false still emits damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    createEntityWithDotAndHealth(world, 10, 100, false);
    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events).toHaveLength(1);
  });

  it('multiple entities get independent events', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    const id1 = createEntityWithDotAndHealth(world, 10, 100);
    const id2 = createEntityWithDotAndHealth(world, 20, 50);

    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events).toHaveLength(2);

    const targets = events.map((e) => e.target);
    expect(targets).toContain(id1);
    expect(targets).toContain(id2);

    const e1 = events.find((e) => e.target === id1)!;
    const e2 = events.find((e) => e.target === id2)!;
    expect(e1.amount).toBe(10 * dt);
    expect(e2.amount).toBe(20 * dt);
  });

  it('DamageEvent target references correct entity', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    const id = createEntityWithDotAndHealth(world, 5, 100);
    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events[0].target).toBe(id);
    expect(events[0].source).toBe(id);
  });

  it('very small dt produces tiny but nonzero damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 0.0001;

    createEntityWithDotAndHealth(world, 10, 100);
    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events[0].amount).toBe(10 * dt);
    expect(events[0].amount).toBeGreaterThan(0);
  });

  it('very large damagePerSecond with normal dt', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    createEntityWithDotAndHealth(world, 999999, 100);
    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events[0].amount).toBe(999999 * dt);
  });

  it('dt=0 emits DamageEvent with amount 0', () => {
    const world = new World();
    const eq = new EventQueue();

    createEntityWithDotAndHealth(world, 10, 100);
    hazardSystem(world, eq, 0);

    const events = consumeDamageEvents(eq);
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(0);
  });

  it('entity without Health but with DamageOverTime is not processed', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    const id = world.createEntity();
    world.addComponent<DamageOverTime>(id, 'DamageOverTime', {
      damagePerSecond: 10,
      sourceType: HazardType.Fire,
      refreshed: true,
    });
    // No Health component

    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events).toHaveLength(0);
  });

  it('system is idempotent per frame — running twice emits two events', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    createEntityWithDotAndHealth(world, 10, 100);

    hazardSystem(world, eq, dt);
    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events).toHaveLength(2);
    expect(events[0].amount).toBe(10 * dt);
    expect(events[1].amount).toBe(10 * dt);
  });

  it('does NOT remove DamageOverTime component', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    const id = createEntityWithDotAndHealth(world, 10, 100);
    hazardSystem(world, eq, dt);

    expect(world.hasComponent(id, 'DamageOverTime')).toBe(true);
  });

  it('does NOT modify Health', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    const id = createEntityWithDotAndHealth(world, 10, 100);
    hazardSystem(world, eq, dt);

    const health = world.getComponent<Health>(id, 'Health')!;
    expect(health.current).toBe(100);
  });

  it('uses entity position for impactPosition', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    const id = createEntityWithDotAndHealth(world, 10, 100);
    const pos = world.getComponent<Position>(id, 'Position')!;
    pos.x = 7;
    pos.y = 2;
    pos.z = 4;

    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events[0].impactPosition).toEqual({ x: 7, y: 2, z: 4 });
  });

  it('isCritical is always false for hazard damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const dt = 1 / 60;

    createEntityWithDotAndHealth(world, 10, 100);
    hazardSystem(world, eq, dt);

    const events = consumeDamageEvents(eq);
    expect(events[0].isCritical).toBe(false);
  });

  // ── Property-based tests ────────────────────────────────────────────────

  it('for any positive dt and dps, damage amount is always positive', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.0001), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(0.0001), max: Math.fround(10000), noNaN: true }),
        (dt, dps) => {
          const world = new World();
          const eq = new EventQueue();

          createEntityWithDotAndHealth(world, dps, 100);
          hazardSystem(world, eq, dt);

          const events = consumeDamageEvents(eq);
          expect(events).toHaveLength(1);
          expect(events[0].amount).toBeGreaterThan(0);
          expect(events[0].amount).toBe(dps * dt);
        },
      ),
    );
  });

  it('refreshed is always false after system runs', () => {
    fc.assert(
      fc.property(fc.boolean(), (initialRefreshed) => {
        const world = new World();
        const eq = new EventQueue();

        const id = createEntityWithDotAndHealth(world, 10, 100, initialRefreshed);
        hazardSystem(world, eq, 1 / 60);

        const dot = world.getComponent<DamageOverTime>(id, 'DamageOverTime')!;
        expect(dot.refreshed).toBe(false);
      }),
    );
  });

  it('number of events equals number of entities with both components', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 10 }),
        (withBoth, dotOnly) => {
          const world = new World();
          const eq = new EventQueue();

          for (let i = 0; i < withBoth; i++) {
            createEntityWithDotAndHealth(world, 10, 100);
          }
          for (let i = 0; i < dotOnly; i++) {
            const id = world.createEntity();
            world.addComponent<DamageOverTime>(id, 'DamageOverTime', {
              damagePerSecond: 10,
              sourceType: HazardType.Fire,
              refreshed: true,
            });
          }

          hazardSystem(world, eq, 1 / 60);

          const events = consumeDamageEvents(eq);
          expect(events).toHaveLength(withBoth);
        },
      ),
    );
  });
});
