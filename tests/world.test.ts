import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';

describe('World', () => {
  // ── createEntity ──────────────────────────────────────────────────────

  it('returns unique EntityIds', () => {
    const world = new World();
    const ids = new Set<number>();
    for (let i = 0; i < 100; i++) {
      ids.add(world.createEntity());
    }
    expect(ids.size).toBe(100);
  });

  it('property: all created entity IDs are unique', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (count) => {
        const world = new World();
        const ids = new Set<number>();
        for (let i = 0; i < count; i++) {
          ids.add(world.createEntity());
        }
        return ids.size === count;
      }),
    );
  });

  // ── addComponent / getComponent ───────────────────────────────────────

  it('getComponent returns data after addComponent', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, 'Position', { x: 1, y: 2, z: 3 });
    expect(world.getComponent(e, 'Position')).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('getComponent returns undefined for missing component', () => {
    const world = new World();
    const e = world.createEntity();
    expect(world.getComponent(e, 'Position')).toBeUndefined();
  });

  it('getComponent returns undefined for nonexistent entity', () => {
    const world = new World();
    expect(world.getComponent(9999, 'Position')).toBeUndefined();
  });

  it('addComponent is a no-op for nonexistent entity', () => {
    const world = new World();
    world.addComponent(9999, 'Position', { x: 0, y: 0, z: 0 });
    expect(world.getComponent(9999, 'Position')).toBeUndefined();
  });

  it('addComponent overwrites existing component data', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, 'Position', { x: 1, y: 2, z: 3 });
    world.addComponent(e, 'Position', { x: 10, y: 20, z: 30 });
    expect(world.getComponent(e, 'Position')).toEqual({ x: 10, y: 20, z: 30 });
  });

  // ── hasComponent ──────────────────────────────────────────────────────

  it('hasComponent returns true when component exists', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, 'Health', { current: 100, max: 100 });
    expect(world.hasComponent(e, 'Health')).toBe(true);
  });

  it('hasComponent returns false when component missing', () => {
    const world = new World();
    const e = world.createEntity();
    expect(world.hasComponent(e, 'Health')).toBe(false);
  });

  it('hasComponent returns false for nonexistent entity', () => {
    const world = new World();
    expect(world.hasComponent(9999, 'Health')).toBe(false);
  });

  // ── removeComponent ───────────────────────────────────────────────────

  it('removeComponent detaches component', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, 'Position', { x: 0, y: 0, z: 0 });
    world.removeComponent(e, 'Position');
    expect(world.hasComponent(e, 'Position')).toBe(false);
    expect(world.getComponent(e, 'Position')).toBeUndefined();
  });

  it('removeComponent is safe on missing component', () => {
    const world = new World();
    const e = world.createEntity();
    expect(() => world.removeComponent(e, 'Position')).not.toThrow();
  });

  // ── destroyEntity ────────────────────────────────────────────────────

  it('destroyEntity removes all components for that entity', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, 'Position', { x: 0, y: 0, z: 0 });
    world.addComponent(e, 'Health', { current: 50, max: 100 });
    world.addComponent(e, 'Velocity', { x: 1, y: 0, z: 0 });
    world.destroyEntity(e);
    expect(world.hasComponent(e, 'Position')).toBe(false);
    expect(world.hasComponent(e, 'Health')).toBe(false);
    expect(world.hasComponent(e, 'Velocity')).toBe(false);
    expect(world.hasEntity(e)).toBe(false);
  });

  it('destroyEntity is safe on nonexistent entity', () => {
    const world = new World();
    expect(() => world.destroyEntity(9999)).not.toThrow();
  });

  it('destroyed entity does not appear in queries', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    world.addComponent(e1, 'Position', { x: 0, y: 0, z: 0 });
    world.addComponent(e2, 'Position', { x: 1, y: 1, z: 1 });
    world.destroyEntity(e1);
    const result = world.query(['Position']);
    expect(result).toEqual([e2]);
  });

  // ── query ─────────────────────────────────────────────────────────────

  it('query returns entities with ALL listed components', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const e3 = world.createEntity();

    world.addComponent(e1, 'Position', { x: 0, y: 0, z: 0 });
    world.addComponent(e1, 'Velocity', { x: 1, y: 0, z: 0 });

    world.addComponent(e2, 'Position', { x: 1, y: 0, z: 0 });
    // e2 has no Velocity

    world.addComponent(e3, 'Position', { x: 2, y: 0, z: 0 });
    world.addComponent(e3, 'Velocity', { x: 0, y: 1, z: 0 });

    const result = world.query(['Position', 'Velocity']);
    expect(result.sort()).toEqual([e1, e3].sort());
  });

  it('query with empty array returns all entities', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const result = world.query([]);
    expect(result.sort()).toEqual([e1, e2].sort());
  });

  it('query returns empty array when no entities match', () => {
    const world = new World();
    world.createEntity();
    expect(world.query(['Position'])).toEqual([]);
  });

  it('query with nonexistent component returns empty', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, 'Position', { x: 0, y: 0, z: 0 });
    expect(world.query(['Position', 'NonExistent'])).toEqual([]);
  });

  it('query returns only entities with ALL requested components (not partial)', () => {
    const world = new World();
    const entities: number[] = [];
    for (let i = 0; i < 10; i++) {
      const e = world.createEntity();
      entities.push(e);
      world.addComponent(e, 'Position', { x: i, y: 0, z: 0 });
      if (i % 2 === 0) {
        world.addComponent(e, 'Velocity', { x: 0, y: 0, z: 0 });
      }
      if (i % 3 === 0) {
        world.addComponent(e, 'Health', { current: 100, max: 100 });
      }
    }

    const result = world.query(['Position', 'Velocity', 'Health']);
    // Must have all three: i%2===0 AND i%3===0 → i%6===0 → i=0, 6
    const expected = entities.filter((_, i) => i % 6 === 0);
    expect(result.sort()).toEqual(expected.sort());
  });

  // ── Property-based: query correctness ─────────────────────────────────

  it('property: query returns exactly the correct entities', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 3 }),
        (entityCount, queryComponentIndex) => {
          const components = ['A', 'B', 'C', 'D'];
          const world = new World();
          const entityComponents = new Map<number, Set<string>>();

          for (let i = 0; i < entityCount; i++) {
            const e = world.createEntity();
            const comps = new Set<string>();
            // Deterministically assign components based on entity index
            for (let c = 0; c < components.length; c++) {
              if ((i >> c) & 1) {
                world.addComponent(e, components[c], { value: i });
                comps.add(components[c]);
              }
            }
            entityComponents.set(e, comps);
          }

          const queryComps = components.slice(0, queryComponentIndex + 1);
          const result = new Set(world.query(queryComps));

          for (const [id, comps] of entityComponents) {
            const shouldMatch = queryComps.every((c) => comps.has(c));
            if (shouldMatch) {
              if (!result.has(id)) return false;
            } else {
              if (result.has(id)) return false;
            }
          }
          return true;
        },
      ),
    );
  });

  // ── Performance: ~700 entities ────────────────────────────────────────

  it('handles 700 entities without performance issues', () => {
    const world = new World();
    const ids: number[] = [];

    for (let i = 0; i < 700; i++) {
      const e = world.createEntity();
      ids.push(e);
      world.addComponent(e, 'Position', { x: i, y: 0, z: 0 });
      world.addComponent(e, 'Velocity', { x: 0, y: 0, z: 0 });
      if (i % 2 === 0) {
        world.addComponent(e, 'Health', { current: 100, max: 100 });
      }
    }

    expect(world.getEntityCount()).toBe(700);

    const start = performance.now();
    const withHealth = world.query(['Position', 'Velocity', 'Health']);
    const elapsed = performance.now() - start;

    expect(withHealth.length).toBe(350);
    // Should complete well under 10ms
    expect(elapsed).toBeLessThan(10);

    // Destroy half and query again
    for (let i = 0; i < 350; i++) {
      world.destroyEntity(ids[i]);
    }
    expect(world.getEntityCount()).toBe(350);

    const remaining = world.query(['Position', 'Velocity']);
    expect(remaining.length).toBe(350);
  });

  // ── getEntityCount / hasEntity ────────────────────────────────────────

  it('getEntityCount tracks entities', () => {
    const world = new World();
    expect(world.getEntityCount()).toBe(0);
    const e1 = world.createEntity();
    expect(world.getEntityCount()).toBe(1);
    world.createEntity();
    expect(world.getEntityCount()).toBe(2);
    world.destroyEntity(e1);
    expect(world.getEntityCount()).toBe(1);
  });

  it('hasEntity returns correct status', () => {
    const world = new World();
    const e = world.createEntity();
    expect(world.hasEntity(e)).toBe(true);
    world.destroyEntity(e);
    expect(world.hasEntity(e)).toBe(false);
  });
});
