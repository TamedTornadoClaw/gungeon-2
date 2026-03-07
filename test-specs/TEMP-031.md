# Test Spec: TEMP-031 — DestructibleSystem

## Properties (must ALWAYS hold)
- Any entity with a Destructible component whose `health <= 0` is destroyed within the same system tick.
- Destroying a destructible emits exactly one ParticleEvent with the correct debris type mapped from MeshId: Crate -> DestructibleDebrisWood, Pillar -> DestructibleDebrisStone, Barrel -> DestructibleDebrisMetal.
- Destroying a destructible emits exactly one AudioEvent with the correct break sound mapped from MeshId: Crate -> DestructibleBreakWood, Pillar -> DestructibleBreakStone, Barrel -> DestructibleBreakMetal.
- The destroyed entity's collider is removed from the spatial hash so it no longer participates in collision detection.
- Destructibles with `health > 0` are never destroyed, never emit particles, never emit audio.
- The system is idempotent within a frame: running it twice on the same world state does not produce duplicate events or double-destroy errors.

## Adversarial Test Cases

### Case: Health exactly zero
- **Setup:** Create a Crate destructible with `health = 0`, `maxHealth = 30`. Insert its collider into the spatial hash. Run DestructibleSystem.
- **Why this matters:** Off-by-one on the `<= 0` check. If the implementation uses `< 0` instead, entities at exactly 0 survive as undead obstacles.
- **Expected behavior:** Entity destroyed. ParticleEvent(DestructibleDebrisWood) emitted. AudioEvent(DestructibleBreakWood) emitted. Collider removed from spatial hash.

### Case: Health negative (overkill damage)
- **Setup:** Create a Barrel destructible with `health = -50`, `maxHealth = 20`. Run DestructibleSystem.
- **Why this matters:** Damage from high-damage weapons can overshoot well past zero. The system must not choke on negative values or treat them differently from zero.
- **Expected behavior:** Entity destroyed normally. Correct Metal particle and audio events emitted.

### Case: Health exactly one (survival)
- **Setup:** Create a Pillar destructible with `health = 1`, `maxHealth = 60`. Run DestructibleSystem.
- **Why this matters:** Ensures the boundary between alive and dead is correct. Health = 1 must survive.
- **Expected behavior:** Entity NOT destroyed. No ParticleEvent. No AudioEvent. Collider remains in spatial hash.

### Case: Correct particle/audio mapping per MeshId
- **Setup:** Create three destructibles: one Crate (MeshId.Crate), one Pillar (MeshId.Pillar), one Barrel (MeshId.Barrel). Set all to `health = 0`. Run DestructibleSystem.
- **Why this matters:** The mapping from MeshId to particle/audio type is the core logic. A copy-paste error or wrong enum value silently produces incorrect feedback.
- **Expected behavior:** Three ParticleEvents emitted: DestructibleDebrisWood, DestructibleDebrisStone, DestructibleDebrisMetal respectively. Three AudioEvents emitted: DestructibleBreakWood, DestructibleBreakStone, DestructibleBreakMetal respectively.

### Case: Spatial hash collider removal
- **Setup:** Create a Crate destructible, insert its collider into the spatial hash. Verify a collision query at the destructible's position returns the collider. Set `health = 0`, run DestructibleSystem. Query the spatial hash at the same position again.
- **Why this matters:** If the collider is not removed from the spatial hash, destroyed crates become invisible walls that block bullets and player movement indefinitely. This is a severe gameplay bug.
- **Expected behavior:** Spatial hash query returns empty (or does not include the destroyed entity) after system runs.

### Case: Multiple destructibles in one frame
- **Setup:** Create 5 destructibles, 3 with `health <= 0` and 2 with `health > 0`. Run DestructibleSystem.
- **Why this matters:** The system must iterate correctly and not skip entities or corrupt state when processing multiple destructions in one tick.
- **Expected behavior:** Exactly 3 entities destroyed. Exactly 3 ParticleEvents and 3 AudioEvents emitted. The 2 surviving destructibles remain intact with their colliders in the spatial hash.

### Case: Destructible with unknown/unmapped MeshId
- **Setup:** Create a destructible entity and assign it a MeshId that is not Crate, Pillar, or Barrel (e.g., MeshId.Wall). Set `health = 0`. Run DestructibleSystem.
- **Why this matters:** The design only specifies three mappings. If a destructible gets created with an unexpected MeshId due to a factory bug, the system must handle it gracefully rather than crashing or emitting undefined events.
- **Expected behavior:** Entity is still destroyed (destruction is based on Destructible component health, not MeshId). The system either falls back to a default particle/audio type or handles the unmapped MeshId without throwing. No crash.

### Case: Entity already destroyed before system runs
- **Setup:** Destroy a destructible entity manually before running DestructibleSystem. Ensure the entity ID is no longer valid in the world.
- **Why this matters:** If DamageSystem or another system destroys the entity in the same frame before DestructibleSystem runs, iterating over stale entity IDs can cause null reference errors.
- **Expected behavior:** System skips the non-existent entity without crashing. No events emitted for it.

## Edge Cases
- Destructible at health = 0 on the exact frame it was created (spawned already dead): should still be destroyed and emit correct events.
- Two destructibles overlapping at the same position: both must be independently tracked and destroyed if both reach health <= 0.
- Destructible health set to `Number.MIN_SAFE_INTEGER`: system should still destroy it without overflow issues.

## Interaction Concerns
- **DamageSystem ordering:** DamageSystem (step 10) reduces health. DestructibleSystem (step 19) reads it. If a destructible takes lethal damage, there must be no intermediate system between steps 10 and 19 that relies on the destructible still existing.
- **CollisionResponseSystem:** Enemy bullets hit destructibles but deal no damage (design decision). Only player projectiles trigger DamageEvents for destructibles. Verify that enemy bullets colliding with a destructible at `health = 0` do not cause double-processing.
- **ParticleSystem / AudioEventSystem ordering:** ParticleSystem (step 25) and AudioEventSystem (step 26) run after DestructibleSystem (step 19). Events emitted by DestructibleSystem must be queued and survive entity destruction so downstream systems can process them.
- **Spatial hash consistency:** If MovementSystem or CollisionDetectionSystem has already cached spatial hash data for this frame, removing a collider mid-frame could cause stale references. Verify the removal is safe given the system execution order (DestructibleSystem runs at step 19, after CollisionDetection at step 8).
