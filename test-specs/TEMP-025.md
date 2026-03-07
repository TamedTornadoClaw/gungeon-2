# Test Spec: TEMP-025 — EnemyWeaponSystem

## Properties (must ALWAYS hold)
- `fireCooldown -= dt` for every enemy with an EnemyWeapon component, every frame, unconditionally.
- An enemy fires only when AIState.state === Attack AND fireCooldown <= 0.
- Shotgunner enemies spawn `projectileCount` bullets (5 from design params) with random spread within the `spread` angle (0.2 radians).
- Rifleman and ShieldGun enemies spawn exactly 1 bullet with minimal spread (Rifleman: 0.01 rad, ShieldGun: 0.03 rad).
- After firing, `fireCooldown` is reset to `1 / fireRate`.
- All spawned projectiles are created via `createEnemyBullet` and receive `EnemyProjectileTag`.
- Spawned projectiles originate from the enemy's position and travel in the enemy's facing direction (Rotation.y).
- Enemies in states other than Attack (Idle, Chase, Flee, Dead) never fire, regardless of cooldown.

## Adversarial Test Cases

### Case: Cooldown ticks down every frame regardless of AI state
- **Setup:** Enemy with EnemyWeapon { fireCooldown: 1.0, fireRate: 1.0 }, AIState { state: Chase }. dt = 1/60.
- **Why this matters:** fireCooldown must decrement even when not attacking. If the cooldown only ticks in Attack state, an enemy that enters Attack after chasing for 2 seconds would still wait the full cooldown before firing. This makes enemies feel unresponsive.
- **Expected behavior:** fireCooldown = 1.0 - 1/60 = 0.9833. No bullets spawned (state is Chase, not Attack).

### Case: Enemy fires immediately when entering Attack with cooldown <= 0
- **Setup:** Shotgunner with EnemyWeapon { fireCooldown: -0.5, fireRate: 0.5, projectileCount: 5, spread: 0.2, damage: 8, projectileSpeed: 18 }, AIState { state: Attack }, Position { x: 5, y: 0, z: 5 }, Rotation { y: 0 }. dt = 1/60.
- **Why this matters:** The enemy has been chasing with its cooldown ticking below zero. On the first frame of Attack, it should fire immediately. If the system checks cooldown before decrementing, the negative value might cause issues.
- **Expected behavior:** 5 bullets spawned. fireCooldown reset to 1/0.5 = 2.0. Bullets originate from (5, 0, 5) traveling in direction Rotation.y = 0.

### Case: Shotgunner spawns correct number of projectiles with spread
- **Setup:** Shotgunner with EnemyWeapon { fireCooldown: 0, fireRate: 0.5, projectileCount: 5, spread: 0.2 }, AIState { state: Attack }, Rotation { y: Math.PI/4 }. dt = 1/60.
- **Why this matters:** All 5 bullets must be spawned. Each bullet's direction must be within [-0.1, +0.1] radians of the enemy's facing direction (spread/2 each side, or spread total). If projectileCount is ignored and only 1 bullet is spawned, the shotgunner is indistinguishable from a rifleman.
- **Expected behavior:** Exactly 5 bullets created via createEnemyBullet. Each bullet's velocity direction is within 0.2 radians of Rotation.y = PI/4. Bullets have EnemyProjectileTag.

### Case: Rifleman spawns exactly 1 bullet with minimal spread
- **Setup:** Rifleman with EnemyWeapon { fireCooldown: 0, fireRate: 0.4, projectileCount: 1, spread: 0.01 }, AIState { state: Attack }, Rotation { y: 0 }. dt = 1/60.
- **Why this matters:** Rifleman fires a single accurate shot. If the system treats all enemies the same and spawns projectileCount bullets for everyone, this is correct. But if it hardcodes 1 for riflemen and ignores projectileCount, a future config change would break.
- **Expected behavior:** Exactly 1 bullet created. Bullet direction within 0.01 radians of Rotation.y = 0. fireCooldown reset to 1/0.4 = 2.5.

### Case: ShieldGun spawns 1 bullet with its specific spread
- **Setup:** ShieldGun with EnemyWeapon { fireCooldown: 0, fireRate: 0.667, projectileCount: 1, spread: 0.03 }, AIState { state: Attack }, Rotation { y: Math.PI }. dt = 1/60.
- **Why this matters:** ShieldGun fires from behind its shield. The bullet must go in the correct direction (toward the player, which is Rotation.y). If the bullet spawns behind the shield in the wrong direction, it would hit the shield or fly away from the player.
- **Expected behavior:** 1 bullet created heading in direction ~Math.PI (with up to 0.03 rad deviation). fireCooldown reset to 1/0.667 = 1.5.

### Case: Enemy in Chase state does not fire even with cooldown <= 0
- **Setup:** Shotgunner with EnemyWeapon { fireCooldown: -1.0 }, AIState { state: Chase }. dt = 1/60.
- **Why this matters:** Only Attack state permits firing. If the system checks only the cooldown and not the state, enemies would fire while chasing, which is incorrect behavior and would make them overpowered.
- **Expected behavior:** No bullets spawned. fireCooldown = -1.0 - 1/60 (continues to tick down, going more negative).

### Case: Enemy in Idle state does not fire
- **Setup:** Rifleman with EnemyWeapon { fireCooldown: 0 }, AIState { state: Idle }. dt = 1/60.
- **Why this matters:** Idle enemies have not detected the player. Firing while idle would reveal enemy positions and deal unfair damage.
- **Expected behavior:** No bullets spawned. fireCooldown = 0 - 1/60 = -0.01667.

### Case: Enemy in Dead state does not fire
- **Setup:** Shotgunner with EnemyWeapon { fireCooldown: 0 }, AIState { state: Dead }. dt = 1/60.
- **Why this matters:** A dead enemy should not produce bullets. If the system only checks for Attack and doesn't exclude Dead, a dead enemy that had cooldown ready would fire a postmortem volley.
- **Expected behavior:** No bullets spawned.

### Case: fireCooldown reset value is exactly 1/fireRate
- **Setup:** Rifleman with EnemyWeapon { fireCooldown: 0, fireRate: 2.5 }, AIState { state: Attack }. dt = 1/60.
- **Why this matters:** After firing, fireCooldown must be 1/2.5 = 0.4 seconds. If the reset uses fireRate directly (2.5) instead of 1/fireRate, the cooldown would be far too long. If it uses a hardcoded value, different enemy types would all fire at the same rate.
- **Expected behavior:** After firing, fireCooldown = 0.4.

### Case: Multiple enemies fire independently in the same frame
- **Setup:** Rifleman A with EnemyWeapon { fireCooldown: 0 }, AIState { state: Attack }. Shotgunner B with EnemyWeapon { fireCooldown: 0 }, AIState { state: Attack }. Rifleman C with EnemyWeapon { fireCooldown: 0.5 }, AIState { state: Attack }. dt = 1/60.
- **Why this matters:** A and B should fire. C should not (cooldown > 0). If the system shares cooldown state or breaks after the first enemy fires, some enemies are skipped.
- **Expected behavior:** Rifleman A: 1 bullet. Shotgunner B: 5 bullets. Rifleman C: 0 bullets (cooldown ticks to 0.4833). Total bullets spawned: 6.

### Case: Projectile speed matches EnemyWeapon config
- **Setup:** Rifleman with EnemyWeapon { fireCooldown: 0, projectileSpeed: 22.0 }, AIState { state: Attack }, Rotation { y: 0 }. dt = 1/60.
- **Why this matters:** The spawned bullet's velocity magnitude must equal the EnemyWeapon's projectileSpeed. If it uses a hardcoded speed or the player projectile speed, enemy bullets would be too fast or too slow.
- **Expected behavior:** Spawned bullet velocity = (22.0, 0, 0) (direction from Rotation.y = 0, speed = 22.0).

### Case: Projectile damage matches EnemyWeapon config
- **Setup:** Shotgunner with EnemyWeapon { fireCooldown: 0, damage: 8 }, AIState { state: Attack }. dt = 1/60.
- **Why this matters:** Each spawned bullet must carry the EnemyWeapon.damage value. If it uses the enemy's baseDamage or some other field, damage would be wrong.
- **Expected behavior:** All 5 spawned bullets have Projectile.damage = 8.

### Case: Cooldown does not go below a large negative value (no underflow concern)
- **Setup:** Enemy with EnemyWeapon { fireCooldown: 0 }, AIState { state: Chase }. Run system for 10000 frames at dt = 1/60 without entering Attack.
- **Why this matters:** fireCooldown would reach approximately -166.67. In JavaScript, this is fine (no integer underflow), but if there's a clamp at 0 for non-Attack states, it changes behavior when the enemy finally enters Attack. The spec says fireCooldown decrements unconditionally, so negative values should accumulate.
- **Expected behavior:** fireCooldown is a large negative number. When the enemy enters Attack, it fires immediately on the first frame. Cooldown resets to 1/fireRate.

### Case: Enemy without EnemyWeapon component is not processed
- **Setup:** KnifeRusher enemy with AIState { state: Attack } but NO EnemyWeapon component (KnifeRushers are melee-only). dt = 1/60.
- **Why this matters:** The system queries for entities with EnemyWeapon. A KnifeRusher has no EnemyWeapon. If the system iterates all enemies regardless, it would crash on missing fields.
- **Expected behavior:** KnifeRusher is not processed by EnemyWeaponSystem. No bullets spawned. No errors.

### Case: Bullet spawn position is enemy's current position
- **Setup:** Shotgunner at Position { x: 10, y: 0, z: -5 }, EnemyWeapon { fireCooldown: 0 }, AIState { state: Attack }. dt = 1/60.
- **Why this matters:** Bullets must originate from the enemy's position, not from a cached position, a default origin, or the player's position. Wrong spawn position would make bullets appear from nowhere.
- **Expected behavior:** All spawned bullets have Position { x: 10, y: 0, z: -5 } (or offset slightly for muzzle, if implemented).

## Edge Cases
- EnemyWeapon with fireRate = 0: fireCooldown reset would be 1/0 = Infinity. The enemy would never fire again. System should guard against zero fireRate or it should be validated at entity creation.
- EnemyWeapon with fireRate very high (e.g., 1000): fireCooldown = 0.001 seconds. Enemy fires almost every frame. Verify this doesn't cause performance issues with bullet spawning.
- EnemyWeapon with projectileCount = 0: no bullets should be spawned. Cooldown should still reset. This is a degenerate config that should be caught by validation.
- EnemyWeapon with spread = 0: all bullets in a shotgunner volley go in the exact same direction. Technically valid but gameplay-questionable.
- EnemyWeapon with negative fireCooldown at the start of the frame and dt is very large: fireCooldown goes further negative, enemy fires once, cooldown resets. Should not fire multiple times to "catch up" — exactly one volley per firing opportunity.

## Interaction Concerns
- **AISystem (order 4) runs before EnemyWeaponSystem (order 6).** AIState.state is set by AISystem before EnemyWeaponSystem reads it. If an enemy transitions to Attack this frame, EnemyWeaponSystem can fire on the same frame. This is correct and intended.
- **EnemyWeaponSystem (order 6) runs before MovementSystem (order 7).** Spawned bullets exist before MovementSystem integrates velocity. They get one frame of movement in the same tick. This matches the PlayerProjectileSystem pattern.
- **CollisionDetectionSystem (order 8) picks up spawned bullets.** Bullets spawned by EnemyWeaponSystem are in the world before collision detection. They can collide with the player on the same frame they were fired. This is correct.
- **createEnemyBullet factory:** Must set `isEnemyProjectile = true` on the Projectile component, add EnemyProjectileTag, and set Lifetime to `enemyBulletLifetime` (2.0 from design params). The system is responsible for calling the factory with correct parameters; the factory handles component setup.
- **No friendly fire:** Enemy bullets should not damage other enemies. This is enforced by CollisionResponseSystem (EnemyProjectile + Enemy = no response), not by EnemyWeaponSystem. But the EnemyProjectileTag is critical for this — missing the tag would cause enemy bullets to be treated as player bullets.
