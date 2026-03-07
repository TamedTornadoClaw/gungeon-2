# Test Spec: TEMP-018 — ProjectileSystem

## Properties (must ALWAYS hold)
- fireCooldown decrements by dt each frame per gun, independently.
- fireCooldown cannot go below 0 (or if it does, firing is allowed when <= 0, so negative is functionally acceptable).
- fireRequested is unconditionally cleared (set to false) every frame for every gun, regardless of whether a shot was fired.
- fireRequested is consumed before clearing: if fireRequested was true AND fireCooldown <= 0 AND currentAmmo > 0 AND isReloading === false, the gun fires.
- On fire: fireCooldown = 1 / fireRate, currentAmmo -= 1.
- On fire: spawn exactly projectileCount bullet entities via createPlayerBullet.
- Each bullet gets: position at player position + gun offset, velocity = aimDirection * projectileSpeed with random spread within spread angle, damage from gun.damage (with crit roll), sourceGunSlot matching the firing gun's slot.
- Crit roll: if random() < critChance, damage *= critMultiplier and isCritical = true on the projectile.
- If currentAmmo <= 0 and fire was attempted (fireRequested was true): play EmptyClipClick sound, start reload (isReloading = true, reloadTimer = reloadTime).
- Reload: reloadTimer -= dt each frame per reloading gun. When reloadTimer <= 0: currentAmmo = magazineSize, isReloading = false.
- Both guns' reload timers tick simultaneously, even when the gun is not in the active slot.
- Piercing and bouncing values from gun traits are written onto spawned projectile components.

## Adversarial Test Cases

### Case: fireRequested cleared even when conditions not met
- **Setup:** Gun A: fireRequested = true, fireCooldown = 0.5 (cannot fire). Gun B: fireRequested = false.
- **Why this matters:** If fireRequested is only cleared on successful fire, a stale true value persists and the gun fires on the next frame when cooldown expires -- even if the player released the button.
- **Expected behavior:** Gun A's fireRequested = false after system runs. No shot fired.

### Case: fireRequested cleared even when no player exists
- **Setup:** Gun entity exists but no player entity in the world (edge case during transitions).
- **Why this matters:** If the system assumes a player always exists and crashes, it breaks state transitions.
- **Expected behavior:** fireRequested cleared, no crash, no bullets spawned.

### Case: Fire cooldown precision at high fire rate
- **Setup:** SMG fireRate = 12.0, so cooldown = 1/12 = 0.0833s. dt = 0.01667 (60Hz). Fire on frame 1.
- **Why this matters:** 0.0833 / 0.01667 = ~5 frames between shots. If cooldown is set to floor(cooldown/dt)*dt, rounding errors accumulate and the effective fire rate drifts.
- **Expected behavior:** fireCooldown is set to exactly 1/fireRate = 0.08333. Subsequent frames decrement by dt. Fire allowed once cooldown <= 0 (frame 6 at the latest).

### Case: Shotgun spawns correct number of projectiles
- **Setup:** Shotgun: projectileCount = 6, fireRequested = true, fireCooldown <= 0, ammo > 0, not reloading.
- **Why this matters:** Off-by-one in loop: spawning 5 or 7 bullets instead of 6.
- **Expected behavior:** Exactly 6 bullet entities created. Each has spread within the gun's spread angle.

### Case: Spread distribution within angle bounds
- **Setup:** Gun with spread = 0.15 radians, projectileCount = 6.
- **Why this matters:** If spread is applied as +/- spread instead of +/- spread/2, bullets fan out twice as wide as intended. Or if all bullets get the same random offset, they cluster.
- **Expected behavior:** Each bullet's velocity direction deviates from the aim direction by at most spread/2 radians (or spread radians total arc, depending on interpretation). Bullets should have distinct random offsets.

### Case: Crit roll independence per bullet
- **Setup:** Shotgun fires 6 bullets, critChance = 0.5.
- **Why this matters:** If crit is rolled once per shot (not per bullet), either all 6 crit or none do, which massively spikes damage variance.
- **Expected behavior:** Each bullet independently rolls crit. With critChance = 0.5, statistically ~3 of 6 should crit (but any count 0-6 is valid per roll).

### Case: Crit damage multiplication
- **Setup:** Gun damage = 10, critChance = 1.0 (forced crit), critMultiplier = 2.0.
- **Why this matters:** If crit adds multiplier instead of multiplying (10 + 2.0 instead of 10 * 2.0), damage is wrong.
- **Expected behavior:** Bullet damage = 20. isCritical = true.

### Case: Empty magazine triggers auto-reload
- **Setup:** fireRequested = true, currentAmmo = 0, isReloading = false, fireCooldown = 0.
- **Why this matters:** Player clicks fire with empty mag. If reload is not triggered, the player must manually reload, which contradicts the auto-reload-on-empty spec.
- **Expected behavior:** EmptyClipClick sound emitted. isReloading = true. reloadTimer = gun.reloadTime. No bullet spawned.

### Case: Empty magazine while already reloading does not restart reload
- **Setup:** fireRequested = true, currentAmmo = 0, isReloading = true, reloadTimer = 0.5.
- **Why this matters:** Re-triggering reload would reset the timer, making reload take longer.
- **Expected behavior:** reloadTimer stays at 0.5 (decremented by dt only). No EmptyClipClick sound (player is already reloading). No restart.

### Case: Reload timer completes
- **Setup:** isReloading = true, reloadTimer = 0.01, dt = 0.016667, magazineSize = 12.
- **Why this matters:** Reload must complete on the frame the timer expires.
- **Expected behavior:** reloadTimer <= 0. currentAmmo = 12. isReloading = false.

### Case: Both guns reload simultaneously
- **Setup:** Sidearm: isReloading = true, reloadTimer = 1.0. Long arm: isReloading = true, reloadTimer = 2.0. dt = 0.016667.
- **Why this matters:** If only the active gun's reload timer ticks, the inactive gun never reloads, breaking the "switching to sidearm is faster than reloading" design.
- **Expected behavior:** After 1.0s of frames, sidearm finishes reloading. Long arm's reloadTimer is at ~1.0 (still reloading). Both ticked independently.

### Case: sourceGunSlot attribution
- **Setup:** Player fires sidearm (WeaponSlot.Sidearm).
- **Why this matters:** If sourceGunSlot is not set on the bullet, DeathSystem cannot attribute the kill to the correct gun for XP gem spawning.
- **Expected behavior:** Every spawned bullet has sourceGunSlot = WeaponSlot.Sidearm.

### Case: Firing last bullet
- **Setup:** currentAmmo = 1, fireRequested = true, conditions met.
- **Why this matters:** After firing, ammo = 0. The system should NOT auto-reload on the same frame as firing. The auto-reload triggers on the NEXT fire attempt with empty mag.
- **Expected behavior:** Bullet spawned. currentAmmo = 0. isReloading stays false (no auto-reload until next fire attempt).

### Case: Fire during reload is rejected
- **Setup:** fireRequested = true, currentAmmo = 5 (partially loaded from a previous incomplete state?), isReloading = true.
- **Why this matters:** If the system checks ammo before checking isReloading, it might fire during reload.
- **Expected behavior:** No shot fired. fireRequested cleared.

### Case: Piercing and bouncing values from traits
- **Setup:** Gun with Piercing trait at level 3 (piercingRemaining = 2 from bonusPerLevel table). Fire a bullet.
- **Why this matters:** If piercing is read from base stats (0) instead of computed trait bonus, bullets never pierce.
- **Expected behavior:** Spawned bullet's piercingRemaining = 2. bouncesRemaining = 0 (no bouncing trait).

## Edge Cases
- fireRate = 0 or very small: 1/fireRate = Infinity. System must guard against this (though design params guarantee fireRate > 0, defensive code matters).
- magazineSize = 0 (degenerate gun config): reload finishes with 0 ammo, creating an infinite empty-click loop. Guard or document.
- projectileCount = 0: no bullets spawned, but ammo still decrements and cooldown still set. Verify no crash.
- Crit chance = 0: no bullet should ever be critical. Crit chance = 1: every bullet must be critical.
- Gun entity destroyed during firing (race condition during gun swap): should not crash.

## Interaction Concerns
- PlayerControlSystem (order 2) sets fireRequested. ProjectileSystem (order 5) reads and clears it. If a system between them (DodgeRollSystem, AISystem) somehow clears fireRequested, the shot is lost.
- ProjectileSystem runs BEFORE MovementSystem (order 7), so bullets spawned this frame get their Position set but are not yet moved. CollisionDetectionSystem (order 8) checks them. If bullets spawn at the player's position, they overlap the player -- CollisionResponseSystem must handle PlayerProjectile+Player as no-op.
- createPlayerBullet factory (TEMP-008) must accept all parameters ProjectileSystem passes. Interface mismatch will cause runtime errors.
- GunStatSystem recalculates computed stats on demand. If ProjectileSystem reads stale computed stats after a trait upgrade but before GunStatSystem runs, fire rate / damage may be wrong for one frame. Since GunStatSystem is called by upgrade UI (not in the loop), this should not happen during gameplay.
