# Test Spec: TEMP-016 — PlayerControlSystem

## Properties (must ALWAYS hold)
- Velocity = normalized(moveX, moveY) * movementSpeed; diagonal input (1,1) must NOT produce speed > movementSpeed (5.0).
- If SpeedModifier is present, final velocity = base velocity * speedModifier.multiplier.
- Rotation.y = atan2(aimWorldX - position.x, aimWorldY - position.y) -- always faces aim point regardless of movement direction.
- fireSidearm sets activeSlot = Sidearm and fireRequested = true on sidearm gun ONLY when: gun has ammo > 0, isReloading === false, fireCooldown <= 0.
- fireLongArm sets activeSlot = LongArm and fireRequested = true on long arm gun under the same conditions.
- fireRequested is never set on the wrong gun slot (fireSidearm must not set fireRequested on long arm).
- reload starts reload on the currently active gun: isReloading = true, reloadTimer = gun.reloadTime.
- dodgeRoll input initiates roll only when cooldownRemaining <= 0 AND isRolling === false.
- While isRolling === true, velocity is overridden by rollDirection * rollSpeed (12.0), ignoring movement input.
- openUpgrade transitions to GunUpgrade state only if the active gun has sufficient XP for at least one trait upgrade.
- pause transitions to Paused state unconditionally.
- interact is NOT consumed by PlayerControlSystem; it passes through for downstream systems.

## Adversarial Test Cases

### Case: Diagonal movement normalization
- **Setup:** moveX = 1.0, moveY = 1.0, no SpeedModifier, movementSpeed = 5.0.
- **Why this matters:** If the system naively multiplies (1,1) * speed, diagonal movement is ~1.41x faster than cardinal, giving players an exploit by always moving diagonally.
- **Expected behavior:** Velocity magnitude = 5.0 exactly. velocity.x = velocity.y = 5.0 / sqrt(2) ~= 3.535.

### Case: Zero movement input produces zero velocity
- **Setup:** moveX = 0, moveY = 0, player is not rolling.
- **Why this matters:** Normalizing a zero vector causes division by zero. The system must guard against this.
- **Expected behavior:** Velocity = (0, 0, 0). No NaN, no Infinity.

### Case: Fire sidearm with empty magazine
- **Setup:** fireSidearm = true, sidearm.currentAmmo = 0, sidearm.isReloading = false, sidearm.fireCooldown = 0.
- **Why this matters:** PlayerControlSystem should NOT set fireRequested. The empty-click / auto-reload is handled by ProjectileSystem. If PlayerControlSystem sets fireRequested anyway, ProjectileSystem might consume it incorrectly.
- **Expected behavior:** fireRequested remains false on sidearm. activeSlot may or may not change (system should not set it since fire conditions not met).

### Case: Fire long arm while reloading
- **Setup:** fireLongArm = true, longArm.currentAmmo = 5, longArm.isReloading = true, longArm.fireCooldown = 0.
- **Why this matters:** Reloading must block firing. If the system only checks ammo and cooldown but forgets the isReloading guard, the player can fire mid-reload.
- **Expected behavior:** fireRequested stays false on long arm.

### Case: Fire sidearm while fire cooldown is positive
- **Setup:** fireSidearm = true, sidearm.currentAmmo = 12, sidearm.isReloading = false, sidearm.fireCooldown = 0.05.
- **Why this matters:** Bypassing fire cooldown means infinite fire rate.
- **Expected behavior:** fireRequested stays false.

### Case: Both fire inputs pressed simultaneously
- **Setup:** fireSidearm = true, fireLongArm = true, both guns have ammo, not reloading, cooldown <= 0.
- **Why this matters:** Dual-firing both guns in one frame would double DPS, breaking balance. The system must handle this — likely by giving precedence to one or processing them in order.
- **Expected behavior:** At most one gun has fireRequested = true. activeSlot is set to whichever gun was processed. The spec says each input independently sets its slot and fireRequested; verify both guns do NOT fire in the same frame (or document if they do).

### Case: Dodge roll while already rolling
- **Setup:** dodgeRoll = true, dodgeRoll.isRolling = true, dodgeRoll.cooldownRemaining = 0.
- **Why this matters:** Double-rolling would reset the roll timer, extending invincibility indefinitely.
- **Expected behavior:** No re-initiation. isRolling stays true, rollTimer is not reset.

### Case: Dodge roll during cooldown
- **Setup:** dodgeRoll = true, isRolling = false, cooldownRemaining = 0.5.
- **Why this matters:** Cooldown bypass allows dodge spam, making the player nearly permanently invincible.
- **Expected behavior:** Roll is not initiated. isRolling stays false.

### Case: Velocity override during roll ignores movement input
- **Setup:** isRolling = true, moveX = -1.0, moveY = 0, rollDirectionX = 1.0, rollDirectionY = 0.
- **Why this matters:** If movement input bleeds through during a roll, the player can steer mid-roll, which contradicts the locked-direction design.
- **Expected behavior:** Velocity = (rollSpeed, 0, 0) = (12.0, 0, 0), not affected by moveX = -1.

### Case: SpeedModifier applied correctly
- **Setup:** moveX = 1.0, moveY = 0, SpeedModifier.multiplier = 0.5 (water).
- **Why this matters:** If the multiplier is added instead of multiplied, or applied to the wrong axis, speed reduction is wrong.
- **Expected behavior:** Velocity.x = 5.0 * 0.5 = 2.5, velocity.y = 0.

### Case: SpeedModifier does NOT affect roll speed
- **Setup:** isRolling = true, SpeedModifier.multiplier = 0.5, rollSpeed = 12.0.
- **Why this matters:** If water slows dodge rolls, it undermines the escape mechanic. Rolls should use rollSpeed directly.
- **Expected behavior:** Velocity magnitude = 12.0, not 6.0.

### Case: Rotation faces aim point independent of movement
- **Setup:** Player at position (5, 0, 5). aimWorldX = 10, aimWorldY = 5. moveX = -1.
- **Why this matters:** If rotation follows movement direction instead of aim, the twin-stick aiming model is broken.
- **Expected behavior:** Rotation.y = atan2(5 - 5, 10 - 5) = atan2(0, 5) = 0 radians (facing right).

### Case: openUpgrade with insufficient XP
- **Setup:** openUpgrade = true, active gun has xp = 10, cheapest trait upgrade costs 50.
- **Why this matters:** If the XP check is missing, the upgrade screen opens with nothing to buy, soft-locking the player.
- **Expected behavior:** No state transition. Game continues in Playing state.

### Case: openUpgrade with exactly enough XP
- **Setup:** openUpgrade = true, active gun has xp = 50, trait at level 0 costs 50.
- **Why this matters:** Off-by-one on >= vs > comparison.
- **Expected behavior:** Transition to GunUpgrade state.

### Case: Reload on already-reloading gun is a no-op
- **Setup:** reload = true, active gun isReloading = true, reloadTimer = 1.0.
- **Why this matters:** Re-triggering reload would reset the timer, extending reload time.
- **Expected behavior:** reloadTimer stays at 1.0, not reset to gun.reloadTime.

## Edge Cases
- moveX = 0.0001, moveY = 0 (near-zero but nonzero input): should produce a very small but valid velocity, not amplified by normalization errors.
- All inputs true simultaneously (fire, reload, dodge, interact, openUpgrade, pause): system must handle without crashes; priority/ordering must be deterministic.
- Player entity missing SpeedModifier component: velocity is base speed, no null reference error.
- Player entity missing DodgeRoll component (shouldn't happen, but defensive): no crash.

## Interaction Concerns
- PlayerControlSystem sets fireRequested; ProjectileSystem clears it. If ProjectileSystem runs before PlayerControlSystem, the signal is lost. Execution order (PlayerControlSystem at 2, ProjectileSystem at 5) must be maintained.
- DodgeRollSystem (order 3) reads isRolling set by PlayerControlSystem (order 2). If PlayerControlSystem initiates a roll, DodgeRollSystem must see it in the same frame.
- Rolling velocity override in PlayerControlSystem must match what DodgeRollSystem expects. Both systems reference rollDirection and rollSpeed -- they must not conflict.
- SpeedModifier is applied/removed by CollisionResponseSystem and ExpireModifiersSystem. PlayerControlSystem reads it. Stale SpeedModifier from a previous frame should still be valid since ExpireModifiers runs after PlayerControl.
