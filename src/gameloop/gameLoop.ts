/**
 * Game loop orchestration — fixed-timestep update with variable-rate rendering.
 *
 * System execution order (fixed-timestep tick):
 *   1. inputSystem(inputManager)        — capture & normalize player input
 *   2. playerControlSystem              — apply input to player entity
 *   3. dodgeRollSystem                  — manage dodge roll state
 *   3.5 aiSystem                        — enemy AI decisions
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

// ── Stub integration point for dodgeRollSystem ─────────────────────────────
// dodgeRollSystem runs at position 3 in the system execution order.
// Once the game loop body is implemented, call it as:
//
//   import { dodgeRollSystem } from '../systems/dodgeRollSystem';
//   dodgeRollSystem(world, dt);
//
// It must run AFTER playerControlSystem and BEFORE movementSystem.
export { dodgeRollSystem } from '../systems/dodgeRollSystem';

// ── Stub integration point for aiSystem ─────────────────────────────────
// aiSystem runs at position 3.5 in the system execution order.
// Once the game loop body is implemented, call it as:
//
//   import { aiSystem } from '../systems/aiSystem';
//   aiSystem(world, dt, currentDepth);
//
// It must run AFTER dodgeRollSystem and BEFORE movementSystem.
export { aiSystem } from '../systems/aiSystem';

// ── Stub integration point for movementSystem ──────────────────────────────
// movementSystem runs at position 4 in the system execution order.
// Once the game loop body is implemented, call it as:
//
//   import { movementSystem } from '../systems/movementSystem';
//   movementSystem(world, dt);
//
// It must run AFTER aiSystem and BEFORE collisionSystem.
export { movementSystem } from '../systems/movementSystem';

// Stub integration point for collisionDetectionSystem.
// When the game loop body is implemented, call:
//   import { collisionDetectionSystem, rebuildStatics } from '../systems/collisionDetectionSystem';
//   const collisionEntities = world.query(['Position', 'Collider']).map(id => ({
//     id,
//     position: world.getComponent(id, 'Position'),
//     collider: world.getComponent(id, 'Collider'),
//   }));
//   const pairs = collisionDetectionSystem(collisionEntities);
//   // Pass pairs to CollisionResponseSystem
//
// Call rebuildStatics() once per room load with all static collider entities.

// ── Stub integration point for collisionResponseSystem ───────────────────
// collisionResponseSystem runs at position 5.5 (after collisionDetectionSystem,
// before damageSystem). When the game loop body is implemented, call:
//
//   import { collisionResponseSystem, updateSpikeCooldowns } from '../systems/collisionResponseSystem';
//   const pairs = collisionDetectionSystem(collisionEntities);
//   updateSpikeCooldowns(dt, world);
//   collisionResponseSystem(pairs, world, eventQueue);
//
export { collisionResponseSystem, updateSpikeCooldowns } from '../systems/collisionResponseSystem';

// ── Stub integration point for damageSystem ──────────────────────────────
// damageSystem runs at position 6 (after collisionResponseSystem, before lifetimeSystem).
// When the game loop body is implemented, call:
//
//   import { damageSystem } from '../systems/damageSystem';
//   damageSystem(world, eventQueue);
//
export { damageSystem } from '../systems/damageSystem';

// ── Stub integration point for deathSystem ──────────────────────────────
// deathSystem runs at position 7 (after damageSystem and lifetimeSystem, before pickupSystem).
// When the game loop body is implemented, call:
//
//   import { deathSystem } from '../systems/deathSystem';
//   deathSystem(world, eventQueue);
//
export { deathSystem } from '../systems/deathSystem';

// ── Stub integration point for hazardSystem ──────────────────────────────
// hazardSystem runs at position 12 (after shieldRegenSystem, before expireModifiersSystem).
// When the game loop body is implemented, call:
//
//   import { hazardSystem } from '../systems/hazardSystem';
//   hazardSystem(world, eventQueue, dt);
//
export { hazardSystem } from '../systems/hazardSystem';

// ── Stub integration point for gunStatSystem ──────────────────────────────
// gunStatSystem is called on-demand after trait upgrades, NOT every frame.
// When the upgrade UI modifies trait levels, call:
//
//   import { gunStatSystem } from '../systems/gunStatSystem';
//   gunStatSystem(world);
//
export { gunStatSystem } from '../systems/gunStatSystem';

// ── Stub integration point for projectileSystem ──────────────────────────
// projectileSystem runs at position 5 in the system execution order.
// Once the game loop body is implemented, call it as:
//
//   import { projectileSystem } from '../systems/projectileSystem';
//   projectileSystem(world, dt, eventQueue);
//
// It must run AFTER dodgeRollSystem and BEFORE movementSystem.
export { projectileSystem } from '../systems/projectileSystem';

// ── Stub integration point for doorSystem ──────────────────────────────
// doorSystem runs after collisionResponseSystem emits DoorInteract events.
// When the game loop body is implemented, call:
//
//   import { doorSystem } from '../systems/doorSystem';
//   doorSystem(world, eventQueue);
//
export { doorSystem } from '../systems/doorSystem';

// ── Stub integration point for destructibleSystem ──────────────────────────
// destructibleSystem runs at position 7.5 (after deathSystem, before pickupSystem).
// When the game loop body is implemented, call:
//
//   import { destructibleSystem } from '../systems/destructibleSystem';
//   destructibleSystem(world, eventQueue);
//
export { destructibleSystem } from '../systems/destructibleSystem';

// ── Stub integration point for enemyWeaponSystem ──────────────────────────
// enemyWeaponSystem runs at position 5.5 in the system execution order.
// Once the game loop body is implemented, call it as:
//
//   import { enemyWeaponSystem } from '../systems/enemyWeaponSystem';
//   enemyWeaponSystem(world, dt);
//
// It must run AFTER aiSystem and BEFORE movementSystem.
export { enemyWeaponSystem } from '../systems/enemyWeaponSystem';

// ── Stub integration point for pickupSystem ──────────────────────────
// pickupSystem runs at position 8 in the system execution order.
// Once the game loop body is implemented, call it as:
//
//   import { pickupSystem } from '../systems/pickupSystem';
//   pickupSystem(world, input, eventQueue, dt);
//
// It must run AFTER deathSystem and BEFORE spawnSystem.
export { pickupSystem } from '../systems/pickupSystem';

// ── Stub integration point for chestSystem ──────────────────────────
// chestSystem runs at position 15 (after pickupSystem, reads nearChest
// proximity flag set by collisionResponseSystem).
// When the game loop body is implemented, call:
//
//   import { chestSystem } from '../systems/chestSystem';
//   chestSystem(world, input, eventQueue);
//
export { chestSystem } from '../systems/chestSystem';
