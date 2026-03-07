# Test Spec: TEMP-014 — LifetimeSystem

## Properties (must ALWAYS hold)
- For every entity with a Lifetime component: `remaining -= dt` each frame.
- When `remaining <= 0` after decrement: the entity is destroyed via `world.destroy(entityId)`.
- Entities without a Lifetime component are never affected.
- The system must not skip entities whose `remaining` is already negative (they must still be destroyed).
- Destruction must happen within the same system call that causes `remaining` to cross zero — not deferred to a later frame.
- The system never modifies any component other than Lifetime.remaining.

## Adversarial Test Cases

### Case: Lifetime reaches exactly zero
- **Setup:** Entity with `remaining = 0.5`, dt = 0.5.
- **Why this matters:** Off-by-one on the destruction condition. If the check is `< 0` instead of `<= 0`, entities with exactly zero remaining survive one extra frame. Over that frame, a projectile could deal damage it should not, or a particle lingers visibly.
- **Expected behavior:** Entity is destroyed. `remaining` is 0 (or entity no longer exists to query).

### Case: Lifetime goes deeply negative in one step
- **Setup:** Entity with `remaining = 0.001`, dt = 0.1 (a large fixed timestep or catch-up frame).
- **Why this matters:** Tests that the system does not assume `remaining` decrements in small steps. After a lag spike, dt can be large enough to skip past zero by a wide margin. The entity must still be destroyed.
- **Expected behavior:** Entity is destroyed. `remaining` would be -0.099 but the entity no longer exists.

### Case: Entity starts with remaining already <= 0
- **Setup:** Entity with `remaining = -5.0`, dt = 0.01667.
- **Why this matters:** A cosmic ray, a bad factory call, or a deserialization bug could create a Lifetime component with negative remaining. The system must handle this gracefully — destroy on the first frame it sees it, not ignore it because it was never "alive."
- **Expected behavior:** Entity is destroyed immediately on the first system call.

### Case: Entity starts with remaining = 0
- **Setup:** Entity with `remaining = 0.0`, dt = 0.01667.
- **Why this matters:** Same as above but for exact zero. If destruction only triggers when remaining transitions from positive to non-positive, a spawn-with-zero-lifetime entity lives forever.
- **Expected behavior:** Entity is destroyed immediately.

### Case: dt = 0 (paused game)
- **Setup:** Entity with `remaining = 1.0`, dt = 0.
- **Why this matters:** When paused, dt is 0. Lifetime must not decrement and entity must not be destroyed. If the check is `remaining <= 0` without decrementing first, and remaining was already 0, it would incorrectly destroy.
- **Expected behavior:** Entity survives. `remaining` is still 1.0.

### Case: Multiple entities with varying lifetimes
- **Setup:** E1 with `remaining = 0.01`, E2 with `remaining = 1.0`, E3 with `remaining = 0.02`, dt = 0.01667.
- **Why this matters:** Catches bugs where destroying one entity during iteration invalidates the iterator, causing subsequent entities to be skipped or double-processed. This is the classic "mutating a collection while iterating" bug.
- **Expected behavior:** E1 and E3 are destroyed. E2 survives with `remaining` approximately 0.983.

### Case: Destroying entity does not affect unrelated entities
- **Setup:** Entity A with Lifetime `remaining = 0.01`. Entity B with Position but no Lifetime. dt = 0.01667.
- **Why this matters:** If `world.destroy()` is implemented with a swap-and-pop on a dense array, destroying entity A might move entity B's data, causing the system to skip or double-process B. The system must be resilient to world mutations during iteration.
- **Expected behavior:** Entity A is destroyed. Entity B is completely unaffected (all its components unchanged).

### Case: Very large remaining value
- **Setup:** Entity with `remaining = 1e15`, dt = 0.01667.
- **Why this matters:** Floating-point precision. At very large values, subtracting a small dt may not change the value at all due to precision loss. The entity would live forever. This is unlikely in practice but tests the system's numerical behavior.
- **Expected behavior:** `remaining` decreases (even if by a tiny amount). Entity is not destroyed.

### Case: Negative dt
- **Setup:** Entity with `remaining = 0.5`, dt = -0.01667.
- **Why this matters:** The game loop should never produce negative dt, but a bug in the spiral-of-death protection or time accumulator could. If negative dt is subtracted, remaining increases, and the entity lives longer than intended.
- **Expected behavior:** Define the contract: either reject/clamp negative dt, or accept that remaining increases. Document whichever is chosen. The system should at minimum not crash.

### Case: Entity with Lifetime is also used by other systems
- **Setup:** A bullet entity with Lifetime, Position, Velocity, Projectile, Collider. Lifetime expires this frame.
- **Why this matters:** When LifetimeSystem destroys the entity, all its components are removed. If LifetimeSystem runs before CollisionResponseSystem processes a collision involving this entity, the collision references a destroyed entity. The execution order (LifetimeSystem at position 13, after CollisionResponseSystem at position 9) should prevent this, but the test documents the dependency.
- **Expected behavior:** Entity is destroyed. No crash from downstream systems referencing the destroyed entity (they should not see it in their queries).

## Edge Cases
- Zero entities with Lifetime: system does nothing, does not throw.
- Entity gains Lifetime component mid-frame (added by another system earlier in the frame): LifetimeSystem should process it if the query picks it up.
- Entity has Lifetime.remaining = Number.POSITIVE_INFINITY: subtracting dt still yields Infinity, entity never dies. Is this intended? (Could be used for "permanent" entities that also want the component for other reasons.)
- Entity has Lifetime.remaining = NaN: `NaN - dt` is NaN. `NaN <= 0` is false. Entity lives forever. This is a silent bug; the system should guard against NaN or at least document the behavior.
- dt = Number.POSITIVE_INFINITY: all entities die immediately. Unlikely but worth documenting.

## Interaction Concerns
- LifetimeSystem runs at position 13 in the execution order, AFTER CollisionDetectionSystem (8) and CollisionResponseSystem (9). This means projectiles get their final frame of collision checking before being destroyed by lifetime expiry. If someone reorders the systems, projectiles could be destroyed before their collision is processed, causing them to pass through targets on their last frame.
- Particles and temporary effects also use Lifetime. If LifetimeSystem has a bug that skips entities, particles accumulate forever, causing a memory leak and rendering slowdown.
- DeathSystem (position 23) also destroys entities (when health <= 0). An entity could be destroyed by both LifetimeSystem and DeathSystem in the same frame if it has both Lifetime and Health components. The world.destroy() call must be idempotent, or the second call will crash.
- SpawnSystem creates entities with Lifetime. If the factory sets `remaining` incorrectly (e.g., 0 or negative), the entity is immediately destroyed by LifetimeSystem, appearing to never spawn.
