# Test Spec: TEMP-023 — DeathSystem

## Properties (must ALWAYS hold)
- Only entities with `health.current <= 0` are processed. Entities with health > 0 are never affected.
- Every dying enemy spawns exactly one XP gem attributed to the gun entity in the slot identified by `health.lastDamageSourceGunSlot`.
- Currency drops are rolled per `currencyDropChance` for the enemy's type from design params. When rolled, a currency pickup is spawned at the enemy's position with the correct `currencyDropAmount`.
- Health pickup drops are rolled per `healthPickupDropChance` (global design param, 0.05).
- Every dying enemy emits exactly one ParticleEvent and one AudioEvent before being destroyed.
- SuicideBomber death checks `enemy.hasExploded`: if false, triggers explosion (area damage query); if true, skips explosion. Both paths proceed with standard loot drops and entity destruction.
- Boss death (entity with BossTag and health <= 0) transitions the game to the Victory state.
- Player death (entity with PlayerTag and health <= 0) transitions the game to the Death state.
- Dead entities are destroyed (removed from the world) after all death processing is complete.
- The system does not process the same entity twice in a single frame.

## Adversarial Test Cases

### Case: XP gem is attributed to the correct gun slot
- **Setup:** Enemy with health.current = 0, health.lastDamageSourceGunSlot = WeaponSlot.LongArm. Player has sidearmSlot = entity 10 (Pistol), longArmSlot = entity 11 (Shotgun). Enemy type is KnifeRusher (xpDrop = 15). Run DeathSystem.
- **Why this matters:** The XP gem must reference gun entity 11 (the long arm), not entity 10 (the sidearm). If the system uses activeSlot instead of lastDamageSourceGunSlot, the wrong gun gets XP. This would break the core progression loop — kills with gun A give XP to gun B.
- **Expected behavior:** createXPGem called with sourceGunEntityId = 11, amount = 15.

### Case: lastDamageSourceGunSlot is null (killed by non-player source)
- **Setup:** Enemy with health.current = 0, health.lastDamageSourceGunSlot = null. This could happen if an enemy is killed by a SuicideBomber explosion (source is the bomber, not a player gun).
- **Why this matters:** If lastDamageSourceGunSlot is null, the system cannot attribute the XP gem to any gun. It must have a fallback — likely the player's currently active gun, or skip XP gem entirely. A null dereference crash here would be a showstopper.
- **Expected behavior:** System must not crash. Either spawn XP gem attributed to the active gun as fallback, or skip XP gem spawning. Document chosen behavior.

### Case: SuicideBomber killed by gunfire (hasExploded = false)
- **Setup:** SuicideBomber enemy with health.current = 0, enemy.hasExploded = false, position = (5, 0, 5). Other entities in the world: Player at (6, 0, 5) (distance 1.0, within explosionRadius 3.0), Enemy B at (20, 0, 20) (distance ~21.2, outside radius). Run DeathSystem.
- **Why this matters:** The bomber was killed by gunfire before it reached the player. It must still explode (area damage). The explosion must hit entities within explosionRadius=3.0 and miss those outside. If the system skips the explosion because the bomber is "dead," the bomber's explosive nature is lost.
- **Expected behavior:** Explosion triggered. DamageEvent emitted for Player (within radius). No DamageEvent for Enemy B (outside radius). ParticleEvent(Explosion) and AudioEvent(Explosion) emitted. Standard loot drops (XP gem, currency/health roll). Entity destroyed.

### Case: SuicideBomber contact explosion (hasExploded = true)
- **Setup:** SuicideBomber enemy with health.current = 0, enemy.hasExploded = true (already exploded via CollisionResponseSystem contact). Run DeathSystem.
- **Why this matters:** CollisionResponseSystem already handled the explosion and area damage. If DeathSystem also triggers an explosion, everything in range takes double damage. The hasExploded flag is the guard against this.
- **Expected behavior:** No explosion triggered. No additional DamageEvents for area damage. Standard loot drops still occur (XP gem, currency/health roll). ParticleEvent and AudioEvent for death (not a second explosion). Entity destroyed.

### Case: Boss death triggers Victory state
- **Setup:** Entity with BossTag, EnemyTag, Health { current: 0, max: 400 }, Enemy { enemyType: Rifleman }. Run DeathSystem.
- **Why this matters:** The boss is the win condition. If the system processes bosses as regular enemies and destroys them without transitioning to Victory, the game never ends. The BossTag check must occur before or alongside standard death processing.
- **Expected behavior:** Game state transitions to Victory. Standard enemy death processing also occurs (XP gem, loot drops, particles, audio, entity destruction).

### Case: Player death triggers Death state
- **Setup:** Player entity with PlayerTag, Health { current: 0, max: 100 }. Run DeathSystem.
- **Why this matters:** If the system only checks for EnemyTag entities, the player's death is never detected. The player must be checked separately. Also, the player should NOT be destroyed — the Death state screen needs the player entity to exist for UI display.
- **Expected behavior:** Game state transitions to Death. Player entity is NOT destroyed (unlike enemies). No loot drops for the player.

### Case: Player at exactly 0 health is dead
- **Setup:** Player entity with Health { current: 0, max: 100 }. Run DeathSystem.
- **Why this matters:** The contract says "health <= 0." If the check is "health < 0" (strict), a player at exactly 0 health survives, which would be a bug since DamageSystem clamps at 0.
- **Expected behavior:** Player is detected as dead. Death state transition occurs.

### Case: Enemy with negative health (overkill)
- **Setup:** Enemy with Health { current: -50, max: 100 }. This shouldn't happen if DamageSystem clamps to 0, but defensive code should handle it. Run DeathSystem.
- **Why this matters:** If DamageSystem has a bug and doesn't clamp, or if multiple DamageEvents are processed in one frame, health could go negative. DeathSystem must still detect and process death.
- **Expected behavior:** Enemy is processed as dead. Standard death handling. No issues from negative health value.

### Case: Currency drop roll with deterministic RNG
- **Setup:** KnifeRusher enemy (currencyDropChance = 0.3, currencyDropAmount = 5) with health.current = 0. Seed RNG so random() returns 0.29 (just under threshold). Run DeathSystem.
- **Why this matters:** Tests the boundary of the probability roll. At 0.29 < 0.3, currency should drop. At 0.31 >= 0.3, it should not. Off-by-one in the comparison (`<` vs `<=`) matters for fairness.
- **Expected behavior:** Currency pickup spawned with amount = 5.

### Case: Currency drop roll fails
- **Setup:** Same enemy type. Seed RNG so random() returns 0.5 (above threshold 0.3). Run DeathSystem.
- **Why this matters:** Verifies the negative path — no currency spawned when the roll fails.
- **Expected behavior:** No currency pickup spawned. XP gem still spawned (always drops).

### Case: Health pickup drop roll
- **Setup:** Any enemy with health.current = 0. Seed RNG so random() returns 0.04 (just under healthPickupDropChance = 0.05). Run DeathSystem.
- **Why this matters:** Health pickups are rare (5% chance). Verifying the roll uses the correct global param, not the enemy-specific currencyDropChance.
- **Expected behavior:** Health pickup spawned at enemy position.

### Case: Multiple enemies die in the same frame
- **Setup:** Three enemies all with health.current = 0, at different positions. Run DeathSystem.
- **Why this matters:** All three must be processed. If the system breaks out of its loop after the first death, or if entity destruction mid-iteration corrupts the iterator, deaths are lost. Enemies would become invisible immortal ghosts.
- **Expected behavior:** Three XP gems spawned (one per enemy). Three sets of particle/audio events. All three entities destroyed. No crashes from concurrent destruction.

### Case: Mini-boss enemy death uses scaled XP
- **Setup:** KnifeRusher with enemy.isMini = true, health.current = 0. Base xpDrop = 15, miniBossXPMultiplier = 3.0.
- **Why this matters:** Mini-bosses should drop 15 * 3.0 = 45 XP, not the base 15. If the system ignores the isMini flag, mini-boss kills are undervalued.
- **Expected behavior:** XP gem spawned with amount = 45.

### Case: Explosion radius query includes bomber itself
- **Setup:** SuicideBomber at position (5, 0, 5), hasExploded = false, health.current = 0. Run DeathSystem.
- **Why this matters:** The bomber is at distance 0 from its own explosion center, which is within explosionRadius=3.0. Should the bomber damage itself? It's already dead (health <= 0). If the system emits a DamageEvent targeting the bomber, DamageSystem would reduce already-zero health further (harmless but wasteful). More critically, if DeathSystem processes the bomber again due to the self-damage event, it could cause infinite recursion or double loot.
- **Expected behavior:** The explosion radius query should either exclude the bomber entity or the DamageEvent targeting a dead entity should be harmless. No double processing, no duplicate loot.

## Edge Cases
- Enemy with no Enemy component but health <= 0 (e.g., a Destructible at 0 health): DeathSystem queries Health+Position. If it processes Destructibles, it would try to spawn XP gems for them, which is wrong. DeathSystem should query for EnemyTag, PlayerTag, or BossTag specifically, or DestructibleSystem handles destructible death separately.
- lastDamageSourceGunSlot refers to a gun that was swapped out: the gun entity ID in that slot changed. The XP gem stores sourceGunEntityId, not the slot. DeathSystem must read the slot to find the current gun entity in that slot. If the gun was swapped, the XP goes to the new gun in that slot (per PickupSystem fallback logic for gems). Verify DeathSystem reads the correct entity.
- Enemy dies on the same frame it spawns: if health is initialized to 0 by mistake, DeathSystem would process it immediately. Factory functions must initialize health > 0.
- Boss that is also a SuicideBomber type: if the boss has SuicideBomber behavior, it needs both the explosion check and the Victory transition. Verify both paths execute.

## Interaction Concerns
- **DamageSystem (order 10) runs before DeathSystem (order 23).** All damage is applied before death is checked. Multiple DamageEvents in one frame can reduce health well below 0. DeathSystem must handle this gracefully.
- **SpawnSystem (order 21) checks `spawnedEnemies` for dead entities.** SpawnSystem runs before DeathSystem. It checks if entities are dead (health <= 0) but they haven't been destroyed yet. After DeathSystem runs, those entities are destroyed. SpawnSystem should detect death by health <= 0, not by entity existence.
- **CollisionResponseSystem (order 9) sets hasExploded on SuicideBomber contact.** This runs well before DeathSystem (order 23). The flag is guaranteed to be set before DeathSystem reads it.
- **ParticleSystem (order 25) and AudioEventSystem (order 26) run after DeathSystem (order 23).** Events emitted by DeathSystem are consumed in the same frame. No cross-frame buffering needed for these.
- **ExpireModifiersSystem (order 24) runs after DeathSystem (order 23).** Dead entities are destroyed by DeathSystem before ExpireModifiersSystem runs. If ExpireModifiersSystem tries to access destroyed entities, it could crash. Ensure entity destruction is deferred or the iteration is safe.
