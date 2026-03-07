import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createTestWorld, createTestEntity } from './helpers';

describe('test framework', () => {
  it('vitest runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-check runs a property-based test', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
    );
  });

  it('creates a test world with entities', () => {
    const world = createTestWorld();
    expect(world.getEntityCount()).toBe(0);

    const entityId = createTestEntity(world, { health: 100 });
    expect(entityId).toBe(1);
    expect(world.hasComponent(entityId, 'health')).toBe(true);
    expect(world.getEntityCount()).toBe(1);

    const entityId2 = createTestEntity(world);
    expect(entityId2).toBe(2);
    expect(world.getEntityCount()).toBe(2);
  });
});
