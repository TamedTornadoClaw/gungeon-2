# Test Spec: TEMP-030 — GunStatSystem

## Properties (must ALWAYS hold)
- For each gun, computed stats are recalculated from base stats plus trait bonuses: `stat = baseStat + bonusPerLevel[trait][level - 1]` for traits the gun possesses at level >= 1.
- Stats not covered by any of the gun's 3 traits use the base value unchanged.
- `magazineSize` is rounded to the nearest integer after applying bonuses (standard rounding: 0.5 rounds up).
- `reloadTime` is clamped to a minimum of 0.2 seconds after applying bonuses (from `gunMechanics.minReloadTime`).
- The system is called on-demand after trait upgrades, NOT every frame.
- All bonus values come from the `traits.bonusPerLevel` arrays in design params. No hardcoded bonus values.
- Traits at level 0 contribute no bonus (base value used as-is).

## Adversarial Test Cases

### Case: All traits at level 0 (no bonuses)
- **Setup:** Create a Pistol with traits [Damage, CriticalChance, CriticalMultiplier], all at level 0. Base stats from config: damage=15, critChance=0.05, critMultiplier=2.0.
- **Why this matters:** Establishes the identity case. With no trait levels, computed stats must exactly equal base stats. Any deviation indicates the system is applying phantom bonuses.
- **Expected behavior:** `damage = 15`, `critChance = 0.05`, `critMultiplier = 2.0`. All other stats (fireRate, magazineSize, reloadTime, spread, projectileCount, projectileSpeed, knockback) equal their base values.

### Case: Single trait at level 1
- **Setup:** Pistol with traits [Damage, CriticalChance, CriticalMultiplier]. Trait levels: [1, 0, 0]. `bonusPerLevel.Damage[0] = 2`.
- **Why this matters:** Verifies the basic bonus addition formula and that only the upgraded trait's stat changes.
- **Expected behavior:** `damage = 15 + 2 = 17`. `critChance = 0.05` (level 0, no bonus). `critMultiplier = 2.0` (level 0, no bonus). All other stats unchanged.

### Case: Trait at max level (level 5)
- **Setup:** Pistol with Damage trait at level 5. `bonusPerLevel.Damage[4] = 16`.
- **Why this matters:** Ensures the system uses the correct array index (level - 1, so level 5 uses index 4). An off-by-one here would read index 5 (out of bounds) or index 3 (wrong value).
- **Expected behavior:** `damage = 15 + 16 = 31`.

### Case: MagazineSize rounding (fractional result)
- **Setup:** Create an SMG with traits [FireRate, MagazineSize, ProjectileSpeed]. MagazineSize trait at level 1. `baseMagazineSize = 40`, `bonusPerLevel.MagazineSize[0] = 3`. Result: 40 + 3 = 43 (integer, no rounding needed). Now test a scenario where the result would be fractional -- this requires a gun with a fractional base or bonus. Since design params show integer bonuses for MagazineSize, test with a hypothetical `baseMagazineSize = 40.5` or verify that the system rounds even when the result is already an integer.
- **Why this matters:** The spec says "rounded to nearest integer." If the implementation skips rounding because bonuses happen to be integers, a future config change with fractional bonuses will silently break.
- **Expected behavior:** `magazineSize` is always an integer. For 43.0, result is 43. For a hypothetical 43.4, result is 43. For 43.5, result is 44. Verify `Math.round` is used, not `Math.floor` or `Math.ceil`.

### Case: MagazineSize rounding at 0.5 boundary
- **Setup:** Construct a scenario where `baseMagazineSize + bonus = X.5` (e.g., base 7, bonus that would yield 7.5 if fractional bonuses existed). If design params only yield integers, mock the values.
- **Why this matters:** Rounding behavior at the .5 boundary differs between `Math.round` (rounds up) and banker's rounding (rounds to even). The spec says "rounded to nearest integer" which conventionally means `Math.round`.
- **Expected behavior:** X.5 rounds to X+1 (standard `Math.round` behavior).

### Case: ReloadTime clamped to minimum 0.2s
- **Setup:** Create a gun with `baseReloadTime = 1.0` and ReloadTime trait at level 5. `bonusPerLevel.ReloadTime[4] = -0.6`. Result: `1.0 + (-0.6) = 0.4`. This is above 0.2, so no clamp. Now test with a gun with `baseReloadTime = 0.5` and ReloadTime trait at level 5: `0.5 + (-0.6) = -0.1`.
- **Why this matters:** Without clamping, reload time could go to zero or negative, causing division-by-zero in ProjectileSystem (reload timer would never count down properly) or instant infinite reloading.
- **Expected behavior:** For the -0.1 case: `reloadTime` is clamped to 0.2. For the 0.4 case: `reloadTime = 0.4` (no clamp needed).

### Case: ReloadTime at exact minimum boundary
- **Setup:** Gun with base and bonus producing exactly `reloadTime = 0.2`.
- **Why this matters:** Boundary test. 0.2 is the minimum, so exactly 0.2 should NOT be clamped up. Verify the clamp uses `max(result, 0.2)`.
- **Expected behavior:** `reloadTime = 0.2` exactly.

### Case: ReloadTime just below minimum
- **Setup:** Gun with base and bonus producing `reloadTime = 0.19`.
- **Why this matters:** Just below the boundary. Must be clamped to 0.2.
- **Expected behavior:** `reloadTime = 0.2`.

### Case: Stat without a matching trait uses base value
- **Setup:** Pistol traits are [Damage, CriticalChance, CriticalMultiplier]. None of these affect `fireRate`, `magazineSize`, `reloadTime`, `spread`, `projectileCount`, `projectileSpeed`, or `knockback`. All traits at level 5.
- **Why this matters:** Verifies that only the gun's assigned traits modify stats. If the system accidentally applies bonuses for traits the gun does not have, stats will be corrupted.
- **Expected behavior:** `fireRate = baseFireRate = 3.0`. `magazineSize = baseMagazineSize = 12`. `reloadTime = baseReloadTime = 1.0`. `spread = baseSpread = 0.02`. All untraited stats equal base values. Only damage, critChance, and critMultiplier are modified.

### Case: All three traits at different levels
- **Setup:** Shotgun with traits [ProjectileCount, Spread, Damage]. Levels: [2, 3, 1]. Bonuses: `ProjectileCount[1] = 1`, `Spread[2] = -0.03`, `Damage[0] = 2`. Base stats: projectileCount=6, spread=0.15, damage=8.
- **Why this matters:** Tests multiple simultaneous bonuses with different trait types, some additive (damage, projectileCount), some subtractive (spread).
- **Expected behavior:** `projectileCount = 6 + 1 = 7`. `spread = 0.15 + (-0.03) = 0.12`. `damage = 8 + 2 = 10`. All other stats at base.

### Case: Negative spread after bonuses
- **Setup:** Gun with `baseSpread = 0.02` and Spread trait at level 5. `bonusPerLevel.Spread[4] = -0.05`. Result: `0.02 + (-0.05) = -0.03`.
- **Why this matters:** Negative spread is physically meaningless. The spec does not mention clamping spread to zero, but negative spread could cause issues in ProjectileSystem (negative random angle range).
- **Expected behavior:** Document whether spread should be clamped to 0.0. If not clamped per spec, the test should verify the computed value is -0.03 and flag this as a potential design issue for review.

### Case: Piercing and Bouncing trait bonuses
- **Setup:** Gun with Piercing trait at level 3. `bonusPerLevel.Piercing[2] = 2`. Base piercing is 0 (from gun base stats, which don't include piercing as a base stat -- it comes entirely from traits).
- **Why this matters:** Piercing and Bouncing are special traits that add entirely new projectile behavior. Their base value is implicitly 0. If the system uses a non-zero base, projectiles would pierce/bounce without the trait.
- **Expected behavior:** Piercing computed stat = 0 + 2 = 2. Projectiles from this gun should have `piercingRemaining = 2`.

### Case: LMG with all traits at level 5 (max bonuses)
- **Setup:** LMG traits: [Damage, MagazineSize, Knockback], all at level 5. Base damage=12, baseMagazineSize=80, baseKnockback=1.0. Bonuses: Damage[4]=16, MagazineSize[4]=24, Knockback[4]=2.0.
- **Why this matters:** Maximum bonus test. Ensures no overflow or unexpected behavior at peak values.
- **Expected behavior:** `damage = 12 + 16 = 28`. `magazineSize = 80 + 24 = 104` (integer, no rounding needed). `knockback = 1.0 + 2.0 = 3.0`.

### Case: System called multiple times produces same result (idempotency)
- **Setup:** Set up a gun with specific trait levels. Call GunStatSystem. Record computed stats. Call GunStatSystem again without changing anything.
- **Why this matters:** Since the system recalculates from base + bonus (not incrementally), calling it twice should produce identical results. If the implementation accidentally accumulates bonuses (adding to computed stat instead of base stat), double-calling would double the bonuses.
- **Expected behavior:** Computed stats are identical after both calls. The system is idempotent.

### Case: System uses base stats, not previously computed stats
- **Setup:** Gun with Damage trait at level 1 (bonus = 2). Call GunStatSystem: damage = 15 + 2 = 17. Now upgrade Damage to level 2 (bonus = 4). Call GunStatSystem again.
- **Why this matters:** If the system computes `damage = currentDamage + bonus` instead of `damage = baseDamage + bonus`, the second call would yield 17 + 4 = 21 instead of the correct 15 + 4 = 19.
- **Expected behavior:** `damage = 15 + 4 = 19`, NOT `17 + 4 = 21`.

## Edge Cases
- Gun with no traits populated (empty traits array or all null): All computed stats should equal base stats. No crash.
- Trait level exceeds max level (level 6+ due to a bug): System should either clamp to max level or reject. Index `bonusPerLevel[5]` would be out of bounds.
- `baseStat` is 0 for a stat (e.g., base knockback for a theoretical zero-knockback gun): Adding trait bonus to 0 should work correctly.
- Gun entity exists but has no Gun component: System should skip it, not crash.
- Design params file is missing a trait's bonus array: System should fail loudly, not silently use 0.

## Interaction Concerns
- **Called by upgrade UI, not the game loop.** The upgrade UI action must call GunStatSystem after modifying trait levels. If it forgets to call, computed stats will be stale until something else triggers recalculation.
- **GunXPSystem (step 17) checks XP thresholds.** GunStatSystem (step 18 in execution order, but on-demand) recalculates stats. These are independent: GunXPSystem does not depend on recomputed stats, and GunStatSystem does not depend on XP values.
- **ProjectileSystem reads computed stats** (damage, fireRate, magazineSize, etc.) to create bullets. If GunStatSystem has not been called after a trait upgrade, ProjectileSystem uses stale stats. This is a critical ordering dependency.
- **currentAmmo interaction:** If `magazineSize` changes (increases) after a stat recalculation, `currentAmmo` may be less than the new magazine size. This is fine -- the player just has a partially loaded larger magazine. If `magazineSize` decreases below `currentAmmo`, should `currentAmmo` be clamped? The spec does not address this; flag for design review.
- **reloadTimer interaction:** If `reloadTime` changes while a reload is in progress (`isReloading = true`), the `reloadTimer` was set to the old `reloadTime`. The reload will complete at the old duration. This is acceptable but should be documented.
