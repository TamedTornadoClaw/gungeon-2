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
    expect(world.entities).toHaveLength(0);

    const entity = createTestEntity(world, { health: 100 });
    expect(entity.id).toBe(1);
    expect(entity.components.get('health')).toBe(100);
    expect(world.entities).toHaveLength(1);

    const entity2 = createTestEntity(world);
    expect(entity2.id).toBe(2);
    expect(world.entities).toHaveLength(2);
  });
});
