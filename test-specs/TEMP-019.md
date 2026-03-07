# Test Spec: TEMP-019 — CollisionResponseSystem

## Properties (must ALWAYS hold)
- Every CollisionPair is handled exactly once per frame. No pair is skipped, no pair is processed twice.
- Pair ordering is deterministic (lower EntityId first). The system must handle both orderings (Player as entityA or entityB) or rely on the guaranteed ordering.
- Push-out for solid colliders resolves along the axis of minimum overlap. The corrected position separates the entities so they no longer overlap on that axis.
- Trigger colliders (isTrigger === true) never produce push-out corrections, only flag-setting or event emission.
- Invincible entities take no damage from any source (enemy contact, projectiles, hazards, explosions).
- Projectiles with piercingRemaining > 0 are NOT destroyed on enemy hit; piercingRemaining decrements and the hit entity is added to alreadyHit.
- Projectiles with bouncesRemaining > 0 reflect velocity on wall hit instead of being destroyed; bouncesRemaining decrements.
- Bouncing bullets hitting an enemy: deal damage, reflect velocity, decrement bounces, add to alreadyHit.
- Player is immune to own projectiles (PlayerProjectile + Player = no effect).
- Each collision type dispatches to the correct handler based on component composition, not entity ID ranges or string names.

## Adversarial Test Cases

### Case: Player + Wall push-out along minimum overlap axis
- **Setup:** Player at (5, 0, 5), Wall at (6, 0, 5). Overlap = (0.5, 0, 0.2). Minimum overlap axis = Z (0.2).
- **Why this matters:** If push-out uses the wrong axis, the player is ejected sideways instead of along the shortest escape path, causing visible teleportation.
- **Expected behavior:** Player position corrected along Z axis by 0.2 units. X position unchanged.

### Case: Player + Wall corner collision (equal overlap on both axes)
- **Setup:** Player overlaps a wall corner with overlapX = overlapY = 0.3.
- **Why this matters:** When overlaps are equal, the system must pick one axis deterministically (not randomly), or the player jitters at corners.
- **Expected behavior:** Push-out along one axis consistently (e.g., always X when tied).

### Case: Player + Enemy (KnifeRusher in Attack state, player not invincible)
- **Setup:** KnifeRusher with AIState.state = Attack, collision with non-Invincible player. Enemy baseDamage = 15.
- **Why this matters:** Contact damage should only happen when the enemy is in Attack state, not during Chase or Idle. If the state check is missing, enemies deal damage on every overlap frame.
- **Expected behavior:** DamageEvent emitted with amount = 15. Both entities pushed apart.

### Case: Player + Enemy (KnifeRusher in Chase state)
- **Setup:** Same as above but AIState.state = Chase.
- **Why this matters:** Verifies that non-Attack state enemies only push apart, no damage.
- **Expected behavior:** Push-apart correction applied. No DamageEvent emitted.

### Case: Player + Enemy while Player is Invincible (rolling)
- **Setup:** KnifeRusher in Attack state collides with player who has Invincible component.
- **Why this matters:** Invincibility must block ALL damage sources including melee.
- **Expected behavior:** Push-apart still happens (physics). No DamageEvent emitted.

### Case: Player + EnemyProjectile (not invincible)
- **Setup:** EnemyProjectile with damage = 12 collides with player.
- **Why this matters:** Core damage pathway. Projectile must be destroyed after dealing damage.
- **Expected behavior:** DamageEvent(player, 12) emitted. Projectile entity destroyed.

### Case: Player + EnemyProjectile (invincible)
- **Setup:** Same but player has Invincible component.
- **Why this matters:** Invincibility must negate projectile damage. But should the projectile still be destroyed?
- **Expected behavior:** No DamageEvent. Projectile is still destroyed (it contacted the player, just dealt no damage).

### Case: PlayerProjectile + Enemy (no shield)
- **Setup:** Player bullet with damage = 15, piercingRemaining = 0, bouncesRemaining = 0 hits an enemy.
- **Why this matters:** Standard damage path. Bullet must be destroyed after hit.
- **Expected behavior:** DamageEvent(enemy, 15) emitted. Knockback applied to enemy. Projectile destroyed.

### Case: PlayerProjectile + Enemy with EnemyShield (frontal hit)
- **Setup:** Bullet incoming from angle 0 (front). Shield facingAngle = 0, coverageArc = PI/4 (1.57 radians total). Angle between bullet direction and shield facing is within arc.
- **Why this matters:** Shield must block frontal damage. If angle calculation is wrong (e.g., unsigned vs signed, degrees vs radians), shields either block everything or nothing.
- **Expected behavior:** Damage goes to enemyShield.health, not enemy Health. Sparks particle emitted. EnemyHitArmor sound played.

### Case: PlayerProjectile + Enemy with EnemyShield (flanking hit)
- **Setup:** Bullet incoming from angle PI (behind). Shield facingAngle = 0, coverageArc = PI/4. Angle difference = PI, well outside arc.
- **Why this matters:** Flanking shots must bypass the shield. If the arc check is inverted, the shield blocks rear attacks and passes frontal ones.
- **Expected behavior:** Damage goes to enemy Health component directly. BloodSplat particle. EnemyHitFlesh sound.

### Case: EnemyShield destroyed by damage
- **Setup:** Shield health = 5, bullet damage = 20.
- **Why this matters:** Overkill on the shield. Does remaining damage pass through to health? The spec says damage goes to shield health; it does not explicitly say overflow passes to entity health.
- **Expected behavior:** Shield health = 0 (clamped). EnemyShield component removed. Remaining 15 damage is NOT applied to entity health (damage went to shield health, not a pass-through in this frame). Verify spec intent.

### Case: PlayerProjectile with piercing hits enemy
- **Setup:** Bullet with piercingRemaining = 2 hits Enemy A.
- **Why this matters:** Bullet must survive and continue moving. alreadyHit must prevent re-hitting the same enemy next frame.
- **Expected behavior:** DamageEvent emitted. piercingRemaining = 1. Enemy A added to alreadyHit. Projectile NOT destroyed.

### Case: Piercing bullet re-encounters same enemy
- **Setup:** Bullet with piercingRemaining = 1, alreadyHit = [EnemyA]. Collision pair includes EnemyA again.
- **Why this matters:** Without alreadyHit checking, piercing bullets deal damage every frame they overlap an enemy.
- **Expected behavior:** No DamageEvent for EnemyA. Bullet continues unaffected. piercingRemaining unchanged.

### Case: Piercing bullet exhausts piercing count
- **Setup:** Bullet with piercingRemaining = 1 hits a new enemy (not in alreadyHit).
- **Why this matters:** When piercingRemaining reaches 0, the next enemy hit should destroy the bullet.
- **Expected behavior:** DamageEvent emitted. piercingRemaining = 0. On next enemy hit (new enemy), bullet is destroyed.

### Case: PlayerProjectile + Wall (no bouncing)
- **Setup:** Bullet with bouncesRemaining = 0 hits a wall.
- **Why this matters:** Standard wall collision. Bullet must be destroyed.
- **Expected behavior:** Projectile entity destroyed.

### Case: PlayerProjectile + Wall (with bouncing)
- **Setup:** Bullet with bouncesRemaining = 2 hits a wall. Velocity = (10, 0, 5). Wall normal along X.
- **Why this matters:** Velocity must be reflected correctly. If reflection formula is wrong, bullets go through walls or embed in them.
- **Expected behavior:** Velocity reflected along wall normal: (-10, 0, 5). bouncesRemaining = 1. Projectile NOT destroyed.

### Case: Bouncing bullet hits enemy
- **Setup:** Bullet with bouncesRemaining = 1 hits an enemy.
- **Why this matters:** Spec says bouncing bullets reflect away from enemy center on hit. This is different from wall reflection (which uses wall normal).
- **Expected behavior:** DamageEvent emitted. Velocity reflected away from enemy center. bouncesRemaining = 0. Enemy added to alreadyHit.

### Case: Player + Pickup (XPGem in collection range)
- **Setup:** XPGem entity with Pickup component collides with player. XPGem is within collection range.
- **Why this matters:** CollisionResponse only sets the flag, not the collection logic. Verify no premature XP addition.
- **Expected behavior:** xpGem.isFlying = true. No XP added yet (PickupSystem handles that).

### Case: Player + Hazard (Fire)
- **Setup:** Player overlaps a fire hazard. Player does not have DamageOverTime component yet.
- **Why this matters:** DamageOverTime must be applied/added, not just flagged.
- **Expected behavior:** DamageOverTime component added to player with damagePerSecond = 10, refreshed = true.

### Case: Player + Hazard (Fire) while already burning
- **Setup:** Player overlaps fire hazard. Player already has DamageOverTime from previous frame.
- **Why this matters:** Refreshing must reset the flag to true so ExpireModifiersSystem does not remove it. Must NOT stack damage (two DamageOverTime components).
- **Expected behavior:** DamageOverTime.refreshed = true. damagePerSecond remains 10, not doubled.

### Case: Player + Hazard (Water)
- **Setup:** Player overlaps water hazard.
- **Why this matters:** SpeedModifier must be applied with the correct multiplier (0.5).
- **Expected behavior:** SpeedModifier component added/refreshed with multiplier = 0.5, refreshed = true.

### Case: Player + Hazard (Spikes) respects cooldown
- **Setup:** Player overlaps spike hazard. Spike cooldown = 1.0. Last spike damage was 0.5s ago.
- **Why this matters:** Without cooldown tracking, spikes deal 20 damage every frame (1200 DPS at 60Hz), killing the player instantly.
- **Expected behavior:** No DamageEvent (cooldown not expired). After 0.5s more, next overlap emits DamageEvent(player, 20).

### Case: SuicideBomber contact explosion
- **Setup:** SuicideBomber (alive, in Attack state) collides with player. ExplosionRadius = 3.0. Two other entities with Health within 3.0 units of bomber, one entity at 4.0 units (outside radius).
- **Why this matters:** Explosion must use radius query, not just damage the player. Other enemies can be caught in the blast. The bomber must be marked hasExploded = true so DeathSystem does not double-explode.
- **Expected behavior:** DamageEvent emitted for player and both in-range entities (if not Invincible). ParticleEvent(Explosion) and AudioEvent(Explosion) emitted. Bomber health.current = 0. enemy.hasExploded = true. Entity at 4.0 units NOT damaged.

### Case: SuicideBomber explosion does not damage Invincible entities
- **Setup:** Bomber explodes. Player within radius but has Invincible. Another enemy within radius, no Invincible.
- **Why this matters:** Invincibility must apply to area damage, not just direct hits.
- **Expected behavior:** No DamageEvent for player. DamageEvent emitted for the other enemy.

### Case: Player + own bouncing bullet (PlayerProjectile + Player)
- **Setup:** Player's bouncing bullet reflects off a wall and collides with the player.
- **Why this matters:** Self-damage from bouncing bullets would make bouncing a downgrade instead of an upgrade.
- **Expected behavior:** No effect. No DamageEvent. Bullet continues moving.

### Case: EnemyProjectile + Wall
- **Setup:** Enemy bullet hits a wall.
- **Why this matters:** Enemy bullets should be destroyed, not bounce (only player bullets can bounce).
- **Expected behavior:** Projectile destroyed. No bounce, no damage to wall.

### Case: EnemyProjectile + Destructible
- **Setup:** Enemy bullet hits a destructible crate.
- **Why this matters:** Spec says destructibles block enemy bullets but take no damage from them. Only player can destroy cover.
- **Expected behavior:** Projectile destroyed. No DamageEvent for destructible. Destructible health unchanged.

### Case: Enemy + Enemy collision
- **Setup:** Two enemies overlap.
- **Why this matters:** Must push apart (pathfinding collision) but no friendly fire damage.
- **Expected behavior:** Both entities pushed apart. No DamageEvent.

### Case: Player + Door
- **Setup:** Player collides with a Door entity.
- **Why this matters:** Must emit DoorInteractEvent, not handle door logic inline.
- **Expected behavior:** DoorInteractEvent emitted with the door's entity ID.

### Case: Duplicate collision pair prevention
- **Setup:** CollisionDetectionSystem produces pair (A, B). System processes it. No pair (B, A) exists due to ordering guarantee.
- **Why this matters:** If the system does not rely on ordering and processes both (A,B) and (B,A), effects are applied twice: double damage, double push-out.
- **Expected behavior:** Pair processed exactly once. Effects applied once.

## Edge Cases
- Collision pair where both entities have been destroyed earlier in the same frame (by a previous pair's response): system must skip gracefully.
- Collision pair with zero overlap (overlapX = 0, overlapY = 0): no push-out, but flags/events may still apply if it is a trigger collision.
- Player collides with multiple hazards of different types simultaneously (fire + water): both DamageOverTime and SpeedModifier applied. No conflict.
- Piercing bullet with piercingRemaining = 0 hitting an enemy it already hit (in alreadyHit): should be destroyed, not skip due to alreadyHit check executing before piercing check.
- Bouncing bullet with bouncesRemaining = 0 hitting a wall: destroyed, not reflected.
- ShieldGun enemy with shield health = 0 (shield already broken, component removed): bullet should deal damage to health directly.

## Interaction Concerns
- CollisionDetectionSystem (order 8) produces pairs. CollisionResponseSystem (order 9) consumes them. Pairs must not be stale from a previous frame.
- DamageSystem (order 10) reads DamageEvents emitted by CollisionResponseSystem. Events must be in the queue before DamageSystem runs.
- HazardSystem (order 12) reads DamageOverTime applied by CollisionResponseSystem. The component must be attached before HazardSystem iterates.
- ExpireModifiersSystem (order 24) checks refreshed flags. CollisionResponseSystem must set refreshed = true for active overlaps so they survive until the next frame.
- PickupSystem, ChestSystem, ShopSystem, FloorTransitionSystem read nearPickup/nearChest/nearShop/nearStairs flags. These flags must be reset each frame before CollisionResponseSystem sets them (or CollisionResponseSystem must clear them at start for non-colliding entities). Otherwise, stale flags from last frame persist.
- DeathSystem (order 23) checks hasExploded on dead SuicideBombers. CollisionResponseSystem sets this. If the bomber dies from gunfire (health reaches 0 via DamageSystem), DeathSystem handles explosion. Both paths must not conflict.
