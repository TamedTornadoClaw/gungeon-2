/**
 * ECS test helpers.
 *
 * Provides factory functions for creating minimal test worlds and entities.
 * These will be fleshed out once the ECS World implementation exists.
 */

export interface Entity {
  id: number;
  components: Map<string, unknown>;
}

export interface World {
  entities: Entity[];
  nextId: number;
}

/** Create an empty ECS world for testing. */
export function createTestWorld(): World {
  return {
    entities: [],
    nextId: 1,
  };
}

/** Add a bare entity to a test world and return it. */
export function createTestEntity(world: World, components?: Record<string, unknown>): Entity {
  const entity: Entity = {
    id: world.nextId++,
    components: new Map(Object.entries(components ?? {})),
  };
  world.entities.push(entity);
  return entity;
}
