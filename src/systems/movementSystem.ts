/**
 * MovementSystem — copies Position to PreviousPosition, then integrates
 * Velocity into Position.
 *
 * System execution order: 4 (after aiSystem, before collisionSystem).
 *
 * Integration: Called by the game loop each fixed-timestep tick.
 */
import type { Position, PreviousPosition, Velocity } from '../ecs/components';
import type { World } from '../ecs/world';

export function movementSystem(world: World, dt: number): void {
  const entities = world.query(['Position', 'PreviousPosition', 'Velocity']);

  for (const id of entities) {
    const pos = world.getComponent<Position>(id, 'Position')!;
    const prev = world.getComponent<PreviousPosition>(id, 'PreviousPosition')!;
    const vel = world.getComponent<Velocity>(id, 'Velocity')!;

    // Snapshot current position BEFORE integration
    prev.x = pos.x;
    prev.y = pos.y;
    prev.z = pos.z;

    // Integrate velocity
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    pos.z += vel.z * dt;
  }
}
