# Test Spec: TEMP-024 — AISystem

## Properties (must ALWAYS hold)
- Every enemy with an AIState component receives exactly one state update per frame. No enemy is skipped, no enemy is processed twice.
- AISystem sets Velocity on enemies. It never modifies Position directly. MovementSystem integrates velocity into position.
- No AI decision targets a dead entity (health.current <= 0). If the player is dead, enemies must not chase or attack.
- AI state transitions are deterministic given the same inputs (enemy position, player position, enemy type, current state, dt). No hidden mutable state beyond what is in the components.
- `attackCooldown` decrements by `dt` each frame. An enemy cannot enter or remain in Attack state while attackCooldown > 0 (for melee attackers). Ranged attackers can be in Attack state with cooldown > 0 (they just don't fire — EnemyWeaponSystem handles that).
- Detection range, attack range, and movement speed are per-type values from design params, scaled by depth.
- Enemies ignore hazards — they walk through fire and water unaffected.

## Adversarial Test Cases

### Case: KnifeRusher transitions Idle -> Chase when player enters detection range
- **Setup:** KnifeRusher at (0, 0, 0), AIState { state: Idle, target: null, attackCooldown: 0 }. Player at (11, 0, 0) (distance 11, within detectionRange 12.0). dt = 1/60.
- **Why this matters:** The boundary between Idle and Chase is the detection range. At distance 11 < 12, the enemy must transition. If the check uses `>` instead of `<` for "in range," or if it compares squared distances incorrectly, the transition fails.
- **Expected behavior:** AIState.state = Chase. Velocity set toward player (positive x). target = player entity id.

### Case: KnifeRusher stays Idle when player is outside detection range
- **Setup:** KnifeRusher at (0, 0, 0), AIState { state: Idle }. Player at (13, 0, 0) (distance 13, outside detectionRange 12.0).
- **Why this matters:** Enemy must not chase a player it hasn't detected. If detection range is compared as `<=` and the player is at exactly 12.0, verify whether that counts as "in range."
- **Expected behavior:** AIState.state remains Idle. Velocity = (0, 0, 0).

### Case: KnifeRusher transitions Chase -> Attack at melee range
- **Setup:** KnifeRusher at (0, 0, 0), AIState { state: Chase, attackCooldown: 0 }. Player at (1.0, 0, 0) (distance 1.0, within attackRange 1.5).
- **Why this matters:** The enemy is close enough to attack. It must stop chasing and start dealing contact damage. If the system continues to set chase velocity when it should be attacking, the enemy slides past the player.
- **Expected behavior:** AIState.state = Attack. Velocity may be zero or reduced (melee attack stance). attackCooldown set to 0.8 (KnifeRusher attackCooldown from design params).

### Case: KnifeRusher transitions Attack -> Chase when player moves away
- **Setup:** KnifeRusher at (0, 0, 0), AIState { state: Attack, attackCooldown: 0 }. Player at (5, 0, 0) (distance 5, outside attackRange 1.5 but inside detectionRange 12.0).
- **Why this matters:** The player dodged away. The enemy must re-enter Chase, not stay in Attack swinging at air. If the system doesn't re-evaluate range each frame, the enemy gets stuck.
- **Expected behavior:** AIState.state = Chase. Velocity set toward player.

### Case: ShieldGun stops moving in Attack state
- **Setup:** ShieldGun at (0, 0, 0), AIState { state: Attack }. Player at (8, 0, 0) (within attackRange 10.0).
- **Why this matters:** The spec says ShieldGun stops moving to fire from behind its shield. If velocity is nonzero during Attack, the shield positioning relative to the player becomes unreliable, and the enemy advances when it should hold position.
- **Expected behavior:** Velocity = (0, 0, 0). Enemy remains stationary while in Attack state. Rotation faces player.

### Case: Shotgunner retreats if player is too close
- **Setup:** Shotgunner at (0, 0, 0), AIState { state: Attack }. Player at (1, 0, 0) (distance 1.0, well inside attackRange 6.0 — too close).
- **Why this matters:** The spec says Shotgunners "may retreat if player too close." This defensive behavior prevents shotgunners from being easily melee'd. If the system doesn't implement retreat, the shotgunner stands still and dies.
- **Expected behavior:** Velocity set away from player (negative x direction). AIState may transition to Flee or remain Attack with retreat velocity.

### Case: Rifleman maintains distance
- **Setup:** Rifleman at (0, 0, 0), AIState { state: Attack }. Player at (5, 0, 0) (distance 5, inside attackRange 15.0 but close).
- **Why this matters:** Riflemen "stay at distance." If the rifleman keeps advancing once in Attack, it walks into melee range and loses its advantage. The system should set velocity to maintain or increase distance.
- **Expected behavior:** Velocity set to maintain range or move away from player. AIState remains Attack.

### Case: SuicideBomber always chases once detected
- **Setup:** SuicideBomber at (0, 0, 0), AIState { state: Chase }. Player at (1, 0, 0) (very close). dt = 1/60.
- **Why this matters:** The spec says SuicideBomber is "Chase always, once player detected." It does not transition to Attack — collision handling triggers the explosion, not the AI. If the system transitions to Attack, it might stop the bomber's movement, preventing the contact explosion.
- **Expected behavior:** AIState.state remains Chase. Velocity set toward player at high speed (baseSpeed 7.0 from design params). No Attack transition.

### Case: SuicideBomber sprint speed is correct
- **Setup:** SuicideBomber at (0, 0, 0), AIState { state: Chase }. Player at (10, 0, 0). Depth = 1 (no scaling).
- **Why this matters:** SuicideBomber baseSpeed is 7.0, faster than all other enemy types. The velocity magnitude must equal this speed. If the system uses a generic enemy speed, the bomber is too slow to threaten.
- **Expected behavior:** Velocity magnitude = 7.0 (normalized direction * speed). Velocity.x = 7.0, velocity.z = 0.

### Case: Dead player is not targeted
- **Setup:** KnifeRusher at (0, 0, 0), AIState { state: Chase, target: playerEntityId }. Player Health { current: 0 }. Player at (5, 0, 0).
- **Why this matters:** "No AI decision targets a dead entity." If the system continues chasing a dead player, enemies swarm the corpse, which looks broken and could interfere with the Death state screen.
- **Expected behavior:** AIState transitions to Idle (or remains Chase with velocity zero). target set to null. Enemy stops moving.

### Case: attackCooldown prevents re-attack
- **Setup:** KnifeRusher at (0, 0, 0), AIState { state: Attack, attackCooldown: 0.5 }. Player at (1.0, 0, 0) (in melee range). dt = 1/60.
- **Why this matters:** Even though the enemy is in range, it cannot attack again until cooldown expires. The cooldown must tick down by dt. If the system ignores the cooldown and allows attacks every frame, the KnifeRusher deals 15 * 60 = 900 DPS instead of the intended ~18.75 DPS.
- **Expected behavior:** attackCooldown = 0.5 - 1/60 = 0.4833. No attack triggered this frame. Enemy stays in Attack state (or reverts to Chase depending on implementation).

### Case: attackCooldown reaches zero and allows next attack
- **Setup:** KnifeRusher at (0, 0, 0), AIState { state: Attack, attackCooldown: 0.01 }. Player at (1.0, 0, 0). dt = 1/60.
- **Why this matters:** After decrementing, cooldown = 0.01 - 0.01667 = -0.00667 (<= 0). The enemy should be able to attack. Verify the cooldown is reset after attack.
- **Expected behavior:** Attack occurs. attackCooldown reset to 0.8.

### Case: Depth scaling affects detection range and speed
- **Setup:** KnifeRusher at (0, 0, 0) on depth 5. Base detectionRange = 12.0, baseSpeed = 6.0. speedMultiplierPerDepth = 0.03. Player at (13, 0, 0).
- **Why this matters:** At depth 5, speed = 6.0 * (1 + 0.03 * 5) = 6.9. If detection range is also scaled, the enemy might detect the player at distance 13. Without scaling, it would be Idle. The test verifies depth scaling is applied to the correct stats.
- **Expected behavior:** Speed is scaled to 6.9. Detection range scaling behavior must be consistent with design params (verify whether detection range scales with depth).

### Case: Determinism — same inputs produce same outputs
- **Setup:** KnifeRusher at (5, 0, 3), AIState { state: Chase, attackCooldown: 0.2 }. Player at (10, 0, 7). dt = 1/60. Run system twice with identical inputs.
- **Why this matters:** The spec requires determinism. If the system uses random number generation for movement jitter or target selection, outputs would differ. AI must be pure given the same component state.
- **Expected behavior:** Both runs produce identical Velocity, AIState, and attackCooldown values.

### Case: Enemy with health > 0 is processed; entity with health = 1 is alive
- **Setup:** KnifeRusher with Health { current: 1, max: 100 }, AIState { state: Chase }. Player at (5, 0, 0).
- **Why this matters:** An enemy at 1 HP is alive and must still act. If the system has a threshold check like health < someValue, low-HP enemies might be incorrectly treated as dead.
- **Expected behavior:** Enemy is processed normally. Velocity set toward player. AIState updated.

### Case: Boss uses same state machine as base enemy type
- **Setup:** Boss entity with BossTag, Enemy { enemyType: Rifleman }, AIState { state: Idle }. Player at (16, 0, 0) (within rifleman detectionRange 18.0). Depth = 10 (boss floor). bossStatMultiplier = 4.0.
- **Why this matters:** Boss should behave like a rifleman with scaled stats. If the system has special boss logic that overrides the state machine, behavior might differ from spec. If it ignores the boss multiplier, the boss is too weak.
- **Expected behavior:** AIState transitions to Chase. Speed = Rifleman baseSpeed * bossStatMultiplier * depth scaling. Detection uses scaled range.

## Edge Cases
- Enemy at exactly detection range boundary (distance = detectionRange): specify whether this is "in range" or "out of range." The spec says "player in detection range" which implies `<=`.
- Enemy and player at the same position (distance = 0): velocity direction is undefined (0/0 normalization). System must handle zero-length direction vectors without NaN. Use a fallback direction or zero velocity.
- Multiple enemies targeting the same player: each enemy operates independently. No coordination or collision avoidance between enemies (they push apart via CollisionResponseSystem, not AI).
- Enemy with AIState.state = Dead: the system should skip this enemy. If it processes Dead-state enemies, it might try to chase/attack despite being dead.
- stateTimer usage: the AIState component has a `stateTimer` field. Verify it is decremented and used for timed state transitions (e.g., brief attack cooldown after a melee hit).

## Interaction Concerns
- **AISystem (order 4) runs before MovementSystem (order 7).** Velocity set by AI is integrated into position by MovementSystem in the same frame. No one-frame lag.
- **AISystem (order 4) runs before EnemyWeaponSystem (order 6).** EnemyWeaponSystem reads AIState.state to decide whether to fire. If AISystem sets state to Attack, EnemyWeaponSystem fires in the same frame. The ordering is correct.
- **AISystem reads player position but does not read player Health.** To check if the player is dead, it needs access to the player's Health component. Verify the system queries this or that a "player is dead" flag is available.
- **CollisionResponseSystem (order 9) handles SuicideBomber contact.** AISystem just sets velocity toward the player. The collision and explosion are handled later in the frame. AISystem never triggers explosions.
- **Enemies push apart via CollisionResponseSystem (order 9).** Enemy-enemy collisions resolve after movement. AISystem does not account for other enemies' positions. This can cause clumping, but it's correct per spec.
