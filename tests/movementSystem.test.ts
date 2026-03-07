import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import type { Position, PreviousPosition, Velocity } from '../src/ecs/components';
import { movementSystem } from '../src/systems/movementSystem';

function addMovable(
  world: World,
  pos: Position,
  vel: Velocity,
  prevPos?: PreviousPosition,
) {
  const id = world.createEntity();
  world.addComponent(id, 'Position', { ...pos });
  world.addComponent(id, 'PreviousPosition', prevPos ? { ...prevPos } : { x: 0, y: 0, z: 0 });
  world.addComponent(id, 'Velocity', { ...vel });
  return id;
}

describe('movementSystem', () => {
  it('snapshots PreviousPosition BEFORE integration', () => {
    const world = new World();
    const id = addMovable(world, { x: 10, y: 5, z: 3 }, { x: 1, y: 0, z: 0 });

    movementSystem(world, 1);

    const prev = world.getComponent<PreviousPosition>(id, 'PreviousPosition')!;
    const pos = world.getComponent<Position>(id, 'Position')!;
    expect(prev).toEqual({ x: 10, y: 5, z: 3 });
    expect(pos).toEqual({ x: 11, y: 5, z: 3 });
  });

  it('zero velocity does not corrupt PreviousPosition', () => {
    const world = new World();
    const id = addMovable(world, { x: 5, y: 5, z: 5 }, { x: 0, y: 0, z: 0 });

    movementSystem(world, 1);

    const prev = world.getComponent<PreviousPosition>(id, 'PreviousPosition')!;
    const pos = world.getComponent<Position>(id, 'Position')!;
    expect(prev).toEqual({ x: 5, y: 5, z: 5 });
    expect(pos).toEqual({ x: 5, y: 5, z: 5 });
  });

  it('handles negative velocity values', () => {
    const world = new World();
    const id = addMovable(world, { x: 10, y: 10, z: 10 }, { x: -3, y: -2, z: -1 });

    movementSystem(world, 1);

    const pos = world.getComponent<Position>(id, 'Position')!;
    expect(pos).toEqual({ x: 7, y: 8, z: 9 });
  });

  it('handles very large dt (0.1)', () => {
    const world = new World();
    const id = addMovable(world, { x: 0, y: 0, z: 0 }, { x: 100, y: 200, z: 300 });

    movementSystem(world, 0.1);

    const pos = world.getComponent<Position>(id, 'Position')!;
    expect(pos.x).toBeCloseTo(10);
    expect(pos.y).toBeCloseTo(20);
    expect(pos.z).toBeCloseTo(30);
  });

  it('handles very small dt (0.000001)', () => {
    const world = new World();
    const id = addMovable(world, { x: 1, y: 1, z: 1 }, { x: 1000, y: 1000, z: 1000 });

    movementSystem(world, 0.000001);

    const pos = world.getComponent<Position>(id, 'Position')!;
    expect(pos.x).toBeCloseTo(1.001, 6);
    expect(pos.y).toBeCloseTo(1.001, 6);
    expect(pos.z).toBeCloseTo(1.001, 6);
  });

  it('entity without Velocity is completely untouched', () => {
    const world = new World();
    const id = world.createEntity();
    world.addComponent(id, 'Position', { x: 5, y: 5, z: 5 });
    world.addComponent(id, 'PreviousPosition', { x: 0, y: 0, z: 0 });

    movementSystem(world, 1);

    const pos = world.getComponent<Position>(id, 'Position')!;
    const prev = world.getComponent<PreviousPosition>(id, 'PreviousPosition')!;
    expect(pos).toEqual({ x: 5, y: 5, z: 5 });
    expect(prev).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('processes multiple entities in one call', () => {
    const world = new World();
    const id1 = addMovable(world, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    const id2 = addMovable(world, { x: 10, y: 10, z: 10 }, { x: 0, y: -1, z: 0 });
    const id3 = addMovable(world, { x: -5, y: 3, z: 7 }, { x: 2, y: 2, z: 2 });

    movementSystem(world, 1);

    expect(world.getComponent<Position>(id1, 'Position')).toEqual({ x: 1, y: 0, z: 0 });
    expect(world.getComponent<Position>(id2, 'Position')).toEqual({ x: 10, y: 9, z: 10 });
    expect(world.getComponent<Position>(id3, 'Position')).toEqual({ x: -3, y: 5, z: 9 });
  });

  it('dt = 0 (paused frame) — PreviousPosition still copied', () => {
    const world = new World();
    const id = addMovable(
      world,
      { x: 7, y: 8, z: 9 },
      { x: 100, y: 200, z: 300 },
      { x: 0, y: 0, z: 0 },
    );

    movementSystem(world, 0);

    const prev = world.getComponent<PreviousPosition>(id, 'PreviousPosition')!;
    const pos = world.getComponent<Position>(id, 'Position')!;
    expect(prev).toEqual({ x: 7, y: 8, z: 9 });
    expect(pos).toEqual({ x: 7, y: 8, z: 9 });
  });

  it('does not mutate Velocity', () => {
    const world = new World();
    const id = addMovable(world, { x: 0, y: 0, z: 0 }, { x: 5, y: -3, z: 7 });

    movementSystem(world, 0.5);

    const vel = world.getComponent<Velocity>(id, 'Velocity')!;
    expect(vel).toEqual({ x: 5, y: -3, z: 7 });
  });

  it('propagates NaN in velocity to position (does not silently swallow)', () => {
    const world = new World();
    const id = addMovable(world, { x: 1, y: 1, z: 1 }, { x: NaN, y: 0, z: Infinity });

    movementSystem(world, 1);

    const pos = world.getComponent<Position>(id, 'Position')!;
    expect(pos.x).toBeNaN();
    expect(pos.y).toBe(1);
    expect(pos.z).toBe(Infinity);
  });

  it('empty entity set does not throw', () => {
    const world = new World();
    expect(() => movementSystem(world, 1)).not.toThrow();
  });

  it('never creates or destroys entities', () => {
    const world = new World();
    addMovable(world, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    // Entity without velocity — should remain
    const staticId = world.createEntity();
    world.addComponent(staticId, 'Position', { x: 5, y: 5, z: 5 });

    const countBefore = world.getEntityCount();
    movementSystem(world, 1);
    const countAfter = world.getEntityCount();

    expect(countAfter).toBe(countBefore);
  });

  it('property-based: position === old + vel * dt', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1 }),
        (px, py, pz, vx, vy, vz, dt) => {
          const world = new World();
          const id = addMovable(world, { x: px, y: py, z: pz }, { x: vx, y: vy, z: vz });

          movementSystem(world, dt);

          const pos = world.getComponent<Position>(id, 'Position')!;
          const prev = world.getComponent<PreviousPosition>(id, 'PreviousPosition')!;

          // PreviousPosition should be old position
          expect(prev.x).toBe(px);
          expect(prev.y).toBe(py);
          expect(prev.z).toBe(pz);

          // Position should be old + vel * dt
          expect(pos.x).toBeCloseTo(px + vx * dt, 2);
          expect(pos.y).toBeCloseTo(py + vy * dt, 2);
          expect(pos.z).toBeCloseTo(pz + vz * dt, 2);
        },
      ),
      { numRuns: 200 },
    );
  });
});
