/**
 * ECS test helpers.
 *
 * Provides factory functions for creating test worlds and entities
 * using the real World implementation.
 */

import { World } from '../src/ecs/world';

/** Create an empty ECS world for testing. */
export function createTestWorld(): World {
  return new World();
}

/** Create an entity in a test world with optional components. */
export function createTestEntity(world: World, components?: Record<string, unknown>): number {
  const id = world.createEntity();
  if (components) {
    for (const [name, data] of Object.entries(components)) {
      world.addComponent(id, name, { value: data });
    }
  }
  return id;
}
