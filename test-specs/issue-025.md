# Test Spec: TEMP-015 — ExpireModifiersSystem

## Properties (must ALWAYS hold)
- For every entity with a DamageOverTime component where `refreshed === false`: the DamageOverTime component is removed from that entity.
- For every entity with a SpeedModifier component where `refreshed === false`: the SpeedModifier component is removed from that entity.
- Components where `refreshed === true` are NEVER removed.
- The system does not modify the `refreshed` flag — it only reads it and acts on the `false` value.
- The system does not destroy entities — it only removes specific components.
- The system is idempotent: calling it twice with no intervening changes produces no additional effect (components already removed stay removed).
- The system handles entities that have both DamageOverTime and SpeedModifier (e.g., entity standing in fire AND water simultaneously).

## Adversarial Test Cases

### Case: DamageOverTime with refreshed=false is removed
- **Setup:** Entity with DamageOverTime `{damagePerSecond: 10, sourceType: Fire, refreshed: false}`.
- **Why this matters:** This is the basic happy path. If this fails, fire damage persists forever after leaving the hazard.
- **Expected behavior:** DamageOverTime component is removed from the entity. Entity still exists.

### Case: DamageOverTime with refreshed=true is kept
- **Setup:** Entity with DamageOverTime `{damagePerSecond: 10, sourceType: Fire, refreshed: true}`.
- **Why this matters:** If the system removes all DamageOverTime regardless of the flag, entities standing in fire take no damage because the component is removed before HazardSystem can process it next frame.
- **Expected behavior:** DamageOverTime component remains on the entity, completely unchanged.

### Case: SpeedModifier with refreshed=false is removed
- **Setup:** Entity with SpeedModifier `{multiplier: 0.5, refreshed: false}`.
- **Why this matters:** Same as DamageOverTime but for speed. If this fails, the player is permanently slowed after leaving water.
- **Expected behavior:** SpeedModifier component is removed. Entity still exists.

### Case: SpeedModifier with refreshed=true is kept
- **Setup:** Entity with SpeedModifier `{multiplier: 0.5, refreshed: true}`.
- **Why this matters:** If the system over-eagerly removes refreshed modifiers, entities in water move at full speed.
- **Expected behavior:** SpeedModifier component remains unchanged.

### Case: Entity has both DamageOverTime(refreshed=false) and SpeedModifier(refreshed=true)
- **Setup:** Entity with DamageOverTime `{refreshed: false}` AND SpeedModifier `{refreshed: true}`.
- **Why this matters:** Tests that the system handles the two component types independently. A developer might use a single query that requires BOTH components, missing entities that have only one. Or removing one component might interfere with the query for the other.
- **Expected behavior:** DamageOverTime is removed. SpeedModifier remains.

### Case: Entity has both DamageOverTime(refreshed=true) and SpeedModifier(refreshed=false)
- **Setup:** Entity with DamageOverTime `{refreshed: true}` AND SpeedModifier `{refreshed: false}`.
- **Why this matters:** Inverse of the above. Tests independence in the other direction.
- **Expected behavior:** SpeedModifier is removed. DamageOverTime remains.

### Case: Entity has both components, both refreshed=false
- **Setup:** Entity with DamageOverTime `{refreshed: false}` AND SpeedModifier `{refreshed: false}`.
- **Why this matters:** Both must be removed. If removing the first component invalidates the iterator or query result for the second, the second removal is skipped.
- **Expected behavior:** Both components are removed. Entity still exists (it is not destroyed).

### Case: Entity has both components, both refreshed=true
- **Setup:** Entity with DamageOverTime `{refreshed: true}` AND SpeedModifier `{refreshed: true}`.
- **Why this matters:** Neither should be removed. Verifies no false removals.
- **Expected behavior:** Both components remain unchanged.

### Case: Multiple entities with mixed states
- **Setup:** E1 has DamageOverTime(refreshed=false). E2 has SpeedModifier(refreshed=true). E3 has DamageOverTime(refreshed=true) and SpeedModifier(refreshed=false). E4 has neither component.
- **Why this matters:** Tests batch processing. Removing a component from E1 must not corrupt E2 or E3. E4 must be completely ignored.
- **Expected behavior:** E1: DamageOverTime removed. E2: SpeedModifier kept. E3: DamageOverTime kept, SpeedModifier removed. E4: unchanged.

### Case: Removing component during iteration does not skip next entity
- **Setup:** 100 entities, alternating DamageOverTime(refreshed=false) and DamageOverTime(refreshed=true).
- **Why this matters:** Classic iteration invalidation. If the ECS uses a packed array and removing a component swaps the last element into the removed slot, the iteration index advances past the swapped element, skipping it. Every other entity would be skipped.
- **Expected behavior:** Exactly 50 entities have DamageOverTime removed. The other 50 retain theirs.

### Case: refreshed is checked with strict equality (===), not truthiness
- **Setup:** Entity with DamageOverTime where `refreshed` is `0` (a falsy non-boolean value), not `false`.
- **Why this matters:** In JavaScript, `0 === false` is `false`, but `!0` is `true`. If the implementation checks `!refreshed` instead of `refreshed === false`, it would incorrectly remove components with `refreshed = 0`. The component type defines `refreshed` as boolean, but a distracted developer might assign a number.
- **Expected behavior:** Define the contract: if `refreshed` must be boolean, the system should only act on `refreshed === false`. If a non-boolean value sneaks in, the system should not remove the component (fail safe rather than fail dangerous).

### Case: System runs on an entity with no Health component
- **Setup:** Entity with DamageOverTime(refreshed=false) but no Health component.
- **Why this matters:** ExpireModifiersSystem only cares about DamageOverTime and SpeedModifier. It should not require Health. However, a developer might copy logic from HazardSystem (which queries Health) and add an unnecessary component requirement.
- **Expected behavior:** DamageOverTime is still removed regardless of whether the entity has Health.

### Case: Entity is the player
- **Setup:** Player entity with DamageOverTime(refreshed=false) from leaving a fire hazard, and SpeedModifier(refreshed=false) from leaving a water hazard.
- **Why this matters:** The player is the primary consumer of these modifiers. If the system fails for the player entity specifically (e.g., the player has special-case handling that interferes), the player remains permanently debuffed.
- **Expected behavior:** Both modifiers removed from the player. Player returns to normal movement speed and stops taking fire damage.

## Edge Cases
- Zero entities with either component: system does nothing, does not throw.
- Entity has DamageOverTime but `refreshed` field is missing/undefined: system must not crash. Define behavior (skip? treat as false?).
- Entity is destroyed by another system earlier in the frame (e.g., DeathSystem): if the entity no longer exists in the world, the query should not return it. If it does, removing a component from a destroyed entity must not crash.
- The `refreshed` flag is set to `true` by CollisionResponseSystem (position 9) and reset to `false` by HazardSystem (position 12). ExpireModifiersSystem runs at position 24. By the time it runs, only entities that were NOT refreshed by CollisionResponse will have `refreshed=false`. Test the full frame lifecycle.

## Interaction Concerns
- CollisionResponseSystem (position 9) sets `refreshed = true` while the entity overlaps the hazard. HazardSystem (position 12) reads DamageOverTime and then sets `refreshed = false` after emitting the damage event. ExpireModifiersSystem (position 24) removes un-refreshed modifiers. This three-system dance means: (1) entity in hazard -> refreshed=true by collision -> refreshed=false by hazard -> but NOT removed because... wait. This lifecycle is subtle. If HazardSystem sets refreshed=false AFTER CollisionResponse sets it true, then ExpireModifiersSystem would always remove the component. Re-reading the docs: HazardSystem sets refreshed=false each frame AFTER emitting the event. CollisionResponseSystem sets refreshed=true while overlapping. So the sequence per frame is: CollisionResponse sets true (if overlapping) -> HazardSystem sets false -> ExpireModifiers removes if false. This means the modifier is removed every frame, and only re-applied by CollisionResponse next frame if still overlapping. The test must verify this lifecycle works correctly and that the one-frame gap does not cause a visible stutter in damage application.
- PlayerControlSystem reads SpeedModifier to adjust player velocity. If ExpireModifiersSystem runs after PlayerControlSystem (it does — position 24 vs position 2), the SpeedModifier is still present when the player's velocity is calculated. This is correct. If execution order changes, the player would get one frame of normal speed before the modifier is removed.
- If an entity gains both DamageOverTime and SpeedModifier from the same hazard source (hypothetical future hazard), removal of one must not affect the other.
