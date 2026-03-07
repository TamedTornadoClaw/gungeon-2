/**
 * Game loop orchestration — fixed-timestep update with variable-rate rendering.
 *
 * System execution order (fixed-timestep tick):
 *   1. inputSystem(inputManager)        — capture & normalize player input
 *   2. playerControlSystem              — apply input to player entity
 *   3. aiSystem                         — enemy AI decisions
 *   4. movementSystem                   — integrate velocities
 *   5. collisionSystem                  — detect & resolve collisions
 *   6. damageSystem                     — apply damage from collisions/hazards
 *   6.5 lifetimeSystem                  — decrement lifetimes, destroy expired entities
 *   7. deathSystem                      — remove dead entities, spawn drops
 *   8. pickupSystem                     — collect pickups
 *   9. spawnSystem                      — spawn enemies/items
 *
 * TODO: Implement game loop body once all systems are available.
 */

// Stub integration point — lifetimeSystem is called here each tick
// once the game loop body is implemented.
export { lifetimeSystem } from '../systems/lifetimeSystem';

// ── Stub integration point for movementSystem ──────────────────────────────
// movementSystem runs at position 4 in the system execution order.
// Once the game loop body is implemented, call it as:
//
//   import { movementSystem } from '../systems/movementSystem';
//   movementSystem(world, dt);
//
// It must run AFTER aiSystem and BEFORE collisionSystem.
export { movementSystem } from '../systems/movementSystem';
