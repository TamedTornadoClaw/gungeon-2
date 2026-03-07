/**
 * DodgeRollSystem — manages dodge roll state: rolling timer, cooldown,
 * velocity override, and invincibility.
 *
 * System execution order: 3 (after playerControlSystem, before movementSystem).
 *
 * PlayerControlSystem (pos 2) initiates rolls by setting isRolling=true and
 * rollDirection. This system then manages the ongoing state.
 *
 * Integration: Called by the game loop each fixed-timestep tick.
 */
import type { DodgeRoll, Velocity, Rotation } from '../ecs/components';
import type { World } from '../ecs/world';
import { getDesignParams } from '../config/designParams';

export function dodgeRollSystem(world: World, dt: number): void {
  const params = getDesignParams().player.dodgeRoll;
  const entities = world.query(['DodgeRoll', 'Velocity']);

  for (const id of entities) {
    const dodge = world.getComponent<DodgeRoll>(id, 'DodgeRoll')!;
    const vel = world.getComponent<Velocity>(id, 'Velocity')!;

    // Decrement cooldown unconditionally
    if (dodge.cooldownRemaining > 0) {
      dodge.cooldownRemaining -= dt;
    }

    if (dodge.isRolling) {
      // First frame of roll: detect by rollTimer being 0 (just initiated)
      if (dodge.rollTimer <= 0) {
        // Roll was just initiated by PlayerControlSystem — set timers
        dodge.rollTimer = params.duration;
        dodge.cooldownRemaining = params.cooldown;

        // Resolve roll direction: if no movement input, fall back to facing
        if (dodge.rollDirectionX === 0 && dodge.rollDirectionY === 0) {
          const rotation = world.getComponent<Rotation>(id, 'Rotation');
          if (rotation) {
            dodge.rollDirectionX = -Math.sin(rotation.y);
            dodge.rollDirectionY = Math.cos(rotation.y);
          }
        }

        // Add Invincible if not already present
        if (!world.hasComponent(id, 'Invincible')) {
          world.addComponent(id, 'Invincible', { remaining: params.iFrameDuration });
        }
      }

      // Decrement roll timer
      dodge.rollTimer -= dt;

      if (dodge.rollTimer <= 0) {
        // Roll ended
        dodge.isRolling = false;
        dodge.rollTimer = 0;
        vel.x = 0;
        vel.z = 0;
        world.removeComponent(id, 'Invincible');
      } else {
        // Override velocity with roll direction * speed
        vel.x = dodge.rollDirectionX * params.speed;
        vel.z = dodge.rollDirectionY * params.speed;

        // Update Invincible timer
        const invincible = world.getComponent<{ remaining: number }>(id, 'Invincible');
        if (invincible) {
          invincible.remaining = dodge.rollTimer;
        }
      }
    }
  }
}
