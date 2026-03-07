/**
 * LifetimeSystem — decrements Lifetime.remaining by dt each frame.
 * Destroys entities when remaining <= 0.
 * Used for projectiles, particles, temporary effects.
 *
 * System execution order: runs after damageSystem, before deathSystem.
 * Integration: Called by the game loop each fixed-timestep tick.
 */
import type { Lifetime } from '../ecs/components';
import type { World } from '../ecs/world';

export function lifetimeSystem(world: World, dt: number): void {
  const entities = world.query(['Lifetime']);

  // Collect entities to destroy — safe iteration over snapshot array from query()
  const toDestroy: number[] = [];

  for (const id of entities) {
    const lifetime = world.getComponent(id, 'Lifetime') as Lifetime | undefined;
    if (!lifetime) continue;

    lifetime.remaining -= dt;

    if (lifetime.remaining <= 0) {
      toDestroy.push(id);
    }
  }

  for (const id of toDestroy) {
    world.destroyEntity(id);
  }
}
