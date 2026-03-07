# Test Spec: TEMP-020 — DamageSystem

## Properties (must ALWAYS hold)
- For each DamageEvent, target's health.current is reduced. Final health.current is clamped at 0 (never negative).
- Damage routing order: Shield (if current > 0) absorbs first, then Armor absorbs remainder, then Health absorbs remainder.
- If shield absorbs any damage, timeSinceLastHit is reset to 0 (restarting regen delay).
- If shield.current === 0, shield is skipped entirely for damage routing (no timeSinceLastHit reset).
- Critical hits are pre-calculated by ProjectileSystem. DamageSystem applies event.amount as-is (no crit recalculation).
- If the DamageEvent's source entity has a Projectile component with isEnemyProjectile === false: write projectile.sourceGunSlot to target.health.lastDamageSourceGunSlot.
- ParticleEvent emitted at impact position (BloodSplat for enemies, Sparks for destructibles).
- AudioEvent emitted (EnemyHitFlesh if no shield/armor absorbed, EnemyHitArmor if shield or armor absorbed).
- DamageNumberEvent emitted with (amount, position, isCritical).
- Multiple DamageEvents targeting the same entity in one frame are all processed (not deduplicated).

## Adversarial Test Cases

### Case: Pure health damage (no shield, no armor)
- **Setup:** Target has Health { current: 100, max: 100 }, no Armor component, no Shield component. DamageEvent { amount: 30 }.
- **Why this matters:** Baseline case. If this fails, everything fails.
- **Expected behavior:** health.current = 70. ParticleEvent(BloodSplat) emitted. AudioEvent(EnemyHitFlesh) emitted. DamageNumberEvent(30, pos, false) emitted.

### Case: Damage exceeds remaining health
- **Setup:** Health { current: 10, max: 100 }. DamageEvent { amount: 50 }.
- **Why this matters:** Health must clamp at 0, not go to -40. Negative health could break DeathSystem's <= 0 check (it wouldn't, but -40 is still incorrect state).
- **Expected behavior:** health.current = 0. Not -40.

### Case: Shield absorbs partial damage
- **Setup:** Shield { current: 20, max: 50, timeSinceLastHit: 5.0 }. No Armor. Health { current: 100 }. DamageEvent { amount: 35 }.
- **Why this matters:** Shield absorbs 20, remainder (15) must pass to health. timeSinceLastHit must reset. If remainder is lost, shields are overpowered (absorb infinite damage).
- **Expected behavior:** shield.current = 0. health.current = 85. timeSinceLastHit = 0. AudioEvent(EnemyHitArmor) emitted.

### Case: Shield absorbs all damage
- **Setup:** Shield { current: 50, max: 50, timeSinceLastHit: 3.0 }. DamageEvent { amount: 30 }.
- **Why this matters:** No damage should reach health or armor.
- **Expected behavior:** shield.current = 20. health.current unchanged. timeSinceLastHit = 0.

### Case: Shield at zero is skipped
- **Setup:** Shield { current: 0, max: 50, timeSinceLastHit: 2.0 }. Health { current: 100 }. DamageEvent { amount: 25 }.
- **Why this matters:** If the system resets timeSinceLastHit when shield is at 0, it restarts the regen delay on every hit, preventing shield regeneration forever.
- **Expected behavior:** Shield skipped. health.current = 75. timeSinceLastHit remains 2.0 (NOT reset). AudioEvent(EnemyHitFlesh), not EnemyHitArmor.

### Case: Armor absorbs partial damage
- **Setup:** No Shield. Armor { current: 10, max: 20 }. Health { current: 100 }. DamageEvent { amount: 25 }.
- **Why this matters:** Armor absorbs 10, remainder (15) goes to health.
- **Expected behavior:** armor.current = 0. health.current = 85.

### Case: Armor absorbs all damage
- **Setup:** No Shield. Armor { current: 30, max: 30 }. Health { current: 100 }. DamageEvent { amount: 20 }.
- **Why this matters:** Health should not be touched.
- **Expected behavior:** armor.current = 10. health.current = 100.

### Case: Shield + Armor + Health cascade
- **Setup:** Shield { current: 10 }. Armor { current: 15 }. Health { current: 100 }. DamageEvent { amount: 50 }.
- **Why this matters:** Full cascade path. Shield absorbs 10 (remainder 40). Armor absorbs 15 (remainder 25). Health takes 25. If any layer swallows the remainder, damage is lost.
- **Expected behavior:** shield.current = 0. armor.current = 0. health.current = 75. timeSinceLastHit = 0.

### Case: Zero damage event
- **Setup:** DamageEvent { amount: 0 }. Health { current: 50 }.
- **Why this matters:** Could come from a degenerate gun config or hazard. Should not crash or produce negative values.
- **Expected behavior:** health.current = 50. DamageNumberEvent(0, pos, false) emitted (or skipped -- verify). No state change.

### Case: Multiple damage events same target same frame
- **Setup:** Two DamageEvents targeting the same entity: { amount: 20 } and { amount: 15 }. Health { current: 100 }.
- **Why this matters:** If events are deduplicated or only the last one applies, damage is lost. Shotgun pellets hitting the same enemy must all deal damage.
- **Expected behavior:** health.current = 65 (100 - 20 - 15). Two DamageNumberEvents emitted. Two ParticleEvents emitted.

### Case: lastDamageSourceGunSlot written for player projectile
- **Setup:** DamageEvent { source: bulletEntityId }. Bullet entity has Projectile { isEnemyProjectile: false, sourceGunSlot: WeaponSlot.LongArm }. Target is an enemy.
- **Why this matters:** DeathSystem reads lastDamageSourceGunSlot to attribute kills for XP gem spawning. If this is not written, XP goes to the wrong gun or is lost.
- **Expected behavior:** target.health.lastDamageSourceGunSlot = WeaponSlot.LongArm.

### Case: lastDamageSourceGunSlot NOT written for enemy projectile
- **Setup:** DamageEvent { source: enemyBulletId }. Bullet has Projectile { isEnemyProjectile: true }. Target is the player.
- **Why this matters:** Player's lastDamageSourceGunSlot should not be overwritten by enemy attacks (it tracks which gun killed enemies, not which gun last hurt the player).
- **Expected behavior:** target.health.lastDamageSourceGunSlot unchanged from previous value.

### Case: lastDamageSourceGunSlot NOT written for non-projectile damage
- **Setup:** DamageEvent from melee contact (source entity is a KnifeRusher, no Projectile component).
- **Why this matters:** If the system blindly reads sourceGunSlot from any source entity, it crashes or writes garbage.
- **Expected behavior:** lastDamageSourceGunSlot unchanged. No crash.

### Case: lastDamageSourceGunSlot survives projectile destruction
- **Setup:** Bullet deals damage and is destroyed in the same frame (by CollisionResponseSystem). DamageSystem reads the bullet's sourceGunSlot.
- **Why this matters:** If the bullet entity is destroyed BEFORE DamageSystem reads it, the Projectile component is gone. The spec says this survives destruction -- DamageSystem must read it before or the data is written to the target.
- **Expected behavior:** lastDamageSourceGunSlot correctly written. System order (CollisionResponse at 9, Damage at 10) means DamageSystem runs after destruction. The sourceGunSlot must be embedded in the DamageEvent itself, or the bullet must not be destroyed until after DamageSystem runs.

### Case: Correct particle type for enemy vs destructible
- **Setup:** DamageEvent targeting an enemy entity. Separate DamageEvent targeting a destructible entity.
- **Why this matters:** BloodSplat on crates and Sparks on enemies would be visually wrong.
- **Expected behavior:** Enemy hit emits ParticleEvent(BloodSplat). Destructible hit emits ParticleEvent(Sparks).

### Case: Audio event selection based on what absorbed
- **Setup:** Case A: Enemy with shield absorbs damage. Case B: Enemy with armor absorbs damage. Case C: Enemy with only health takes damage.
- **Why this matters:** The sound feedback tells the player whether their shots are effective. Wrong sound = misleading feedback.
- **Expected behavior:** Case A: EnemyHitArmor. Case B: EnemyHitArmor. Case C: EnemyHitFlesh.

### Case: Critical hit DamageNumberEvent
- **Setup:** DamageEvent { amount: 40, isCritical: true }.
- **Why this matters:** Crit damage numbers display differently (scaled up). If isCritical is dropped, crits are invisible to the player.
- **Expected behavior:** DamageNumberEvent { amount: 40, isCritical: true }.

### Case: Damage to entity that already has health = 0
- **Setup:** Entity health.current = 0. DamageEvent { amount: 10 }.
- **Why this matters:** Overkill damage on a dead entity should not cause negative health or double death processing.
- **Expected behavior:** health.current stays 0. Events still emitted (or skipped -- verify). DeathSystem handles the death once, regardless of how many damage events land.

## Edge Cases
- DamageEvent with a source entity that no longer exists (destroyed earlier this frame): system must not crash when looking up source entity's Projectile component. Gracefully skip lastDamageSourceGunSlot write.
- DamageEvent targeting an entity without a Health component (shouldn't happen, but defensive): skip gracefully.
- Shield.current is fractional (e.g., 0.001 from regen): system must still route through shield and reset timeSinceLastHit. The "current > 0" check must not use integer comparison.
- Armor.current is fractional: same concern.
- Very large damage (999999): health clamps at 0, shield and armor clamp at 0, no integer overflow.
- DamageEvent where source === target (self-damage, e.g., bomber explosion): should process normally.

## Interaction Concerns
- CollisionResponseSystem (order 9) emits DamageEvents. DamageSystem (order 10) consumes them. Events must be queued, not processed inline during collision response.
- ShieldRegenSystem (order 11) increments timeSinceLastHit. DamageSystem (order 10) resets it to 0. Since DamageSystem runs first, regen correctly pauses on the frame damage is taken. If order were reversed, the reset would be overwritten by the increment.
- DeathSystem (order 23) reads health.current after DamageSystem has processed all events. Multiple damage events reducing health to 0 must all be applied before DeathSystem checks.
- The sourceGunSlot data flow is critical: ProjectileSystem writes sourceGunSlot on the bullet -> CollisionResponseSystem emits DamageEvent with source = bullet entity -> DamageSystem reads bullet's Projectile.sourceGunSlot and writes to target.health.lastDamageSourceGunSlot -> DeathSystem reads lastDamageSourceGunSlot. If CollisionResponseSystem destroys the bullet before DamageSystem reads it, the chain breaks. The DamageEvent must carry enough info, or destruction must be deferred.
- HazardSystem (order 12) also emits DamageEvents (for DamageOverTime). These events go through DamageSystem in the SAME frame or the NEXT frame depending on event queue semantics. If same frame, DamageSystem must process them. If next frame, there is a one-frame delay on fire damage. Verify which.
