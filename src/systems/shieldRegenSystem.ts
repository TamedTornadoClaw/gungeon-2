/**
 * ShieldRegenSystem — increments timeSinceLastHit, then regenerates shield
 * if enough time has passed since the last hit.
 *
 * System execution order: 11 (after DamageSystem at pos 10).
 *
 * Integration: Called by the game loop each fixed-timestep tick.
 * DamageSystem resets timeSinceLastHit to 0 on shield hits, so if damage
 * occurs this frame, timeSinceLastHit will be 0 + dt after this system runs.
 */
import type { Shield } from '../ecs/components';
import type { World } from '../ecs/world';

export function shieldRegenSystem(world: World, dt: number): void {
  const entities = world.query(['Shield']);

  for (const id of entities) {
    const shield = world.getComponent<Shield>(id, 'Shield')!;

    // Always increment timer
    shield.timeSinceLastHit += dt;

    // Regenerate if delay has elapsed and shield is not full
    if (shield.timeSinceLastHit >= shield.regenDelay && shield.current < shield.max) {
      shield.current = Math.min(shield.current + shield.regenRate * dt, shield.max);
    }
  }
}
