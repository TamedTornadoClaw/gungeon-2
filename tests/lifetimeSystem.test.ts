import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import type { Lifetime, Velocity } from '../src/ecs/components';
import { lifetimeSystem } from '../src/systems/lifetimeSystem';

function createEntityWithLifetime(world: World, remaining: number): number {
  const id = world.createEntity();
  world.addComponent<Lifetime>(id, 'Lifetime', { remaining });
  return id;
}

describe('lifetimeSystem', () => {
  it('destroys entity when remaining reaches exactly zero', () => {
    const world = new World();
    const id = createEntityWithLifetime(world, 0.5);

    lifetimeSystem(world, 0.5);

    expect(world.hasEntity(id)).toBe(false);
  });

  it('destroys entity when remaining goes deeply negative', () => {
    const world = new World();
    const id = createEntityWithLifetime(world, 0.001);

    lifetimeSystem(world, 0.1);

    expect(world.hasEntity(id)).toBe(false);
  });

  it('destroys entity that starts with remaining < 0', () => {
    const world = new World();
    const id = createEntityWithLifetime(world, -5);

    lifetimeSystem(world, 0.016);

    expect(world.hasEntity(id)).toBe(false);
  });

  it('destroys entity that starts with remaining = 0', () => {
    const world = new World();
    const id = createEntityWithLifetime(world, 0);

    lifetimeSystem(world, 0.016);

    expect(world.hasEntity(id)).toBe(false);
  });

  it('does not affect entity when dt = 0 (paused game)', () => {
    const world = new World();
    const id = createEntityWithLifetime(world, 1.0);

    lifetimeSystem(world, 0);

    expect(world.hasEntity(id)).toBe(true);
    const lifetime = world.getComponent<Lifetime>(id, 'Lifetime')!;
    expect(lifetime.remaining).toBe(1.0);
  });

  it('handles multiple entities with varying lifetimes — some die, some survive', () => {
    const world = new World();
    const dying1 = createEntityWithLifetime(world, 0.01);
    const dying2 = createEntityWithLifetime(world, 0.05);
    const surviving1 = createEntityWithLifetime(world, 1.0);
    const surviving2 = createEntityWithLifetime(world, 5.0);

    lifetimeSystem(world, 0.1);

    expect(world.hasEntity(dying1)).toBe(false);
    expect(world.hasEntity(dying2)).toBe(false);
    expect(world.hasEntity(surviving1)).toBe(true);
    expect(world.hasEntity(surviving2)).toBe(true);

    const s1 = world.getComponent<Lifetime>(surviving1, 'Lifetime')!;
    expect(s1.remaining).toBeCloseTo(0.9);
    const s2 = world.getComponent<Lifetime>(surviving2, 'Lifetime')!;
    expect(s2.remaining).toBeCloseTo(4.9);
  });

  it('destroying entity does not affect unrelated entities', () => {
    const world = new World();
    const dying = createEntityWithLifetime(world, 0.01);
    const unrelated = world.createEntity();
    world.addComponent(unrelated, 'Position', { x: 1, y: 2, z: 3 });

    lifetimeSystem(world, 0.1);

    expect(world.hasEntity(dying)).toBe(false);
    expect(world.hasEntity(unrelated)).toBe(true);
    expect(world.getComponent(unrelated, 'Position')).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('handles very large remaining value — decreases but entity survives', () => {
    const world = new World();
    const id = createEntityWithLifetime(world, 1e10);

    lifetimeSystem(world, 0.016);

    expect(world.hasEntity(id)).toBe(true);
    const lifetime = world.getComponent<Lifetime>(id, 'Lifetime')!;
    expect(lifetime.remaining).toBeCloseTo(1e10 - 0.016);
  });

  it('does not mutate Velocity component (system only touches Lifetime.remaining)', () => {
    const world = new World();
    const id = createEntityWithLifetime(world, 5.0);
    world.addComponent<Velocity>(id, 'Velocity', { x: 10, y: 20, z: 30 });

    lifetimeSystem(world, 0.016);

    const vel = world.getComponent<Velocity>(id, 'Velocity')!;
    expect(vel).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('does not affect entities without Lifetime component', () => {
    const world = new World();
    const noLifetime = world.createEntity();
    world.addComponent(noLifetime, 'Position', { x: 0, y: 0, z: 0 });
    world.addComponent(noLifetime, 'Velocity', { x: 1, y: 1, z: 1 });

    lifetimeSystem(world, 0.016);

    expect(world.hasEntity(noLifetime)).toBe(true);
    expect(world.getComponent(noLifetime, 'Position')).toEqual({ x: 0, y: 0, z: 0 });
    expect(world.getComponent(noLifetime, 'Velocity')).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('property-based: random remaining/dt → destroyed iff remaining-dt <= 0', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -100, max: 100, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (remaining, dt) => {
          const world = new World();
          const id = createEntityWithLifetime(world, remaining);

          lifetimeSystem(world, dt);

          const shouldBeDestroyed = remaining - dt <= 0;
          expect(world.hasEntity(id)).toBe(!shouldBeDestroyed);
        },
      ),
      { numRuns: 500 },
    );
  });
});
