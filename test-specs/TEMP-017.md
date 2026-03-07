# Test Spec: TEMP-017 — DodgeRollSystem

## Properties (must ALWAYS hold)
- While isRolling === true: velocity is set to rollDirection * rollSpeed (12.0) every frame, overriding any other velocity.
- While isRolling === true: entity has an Invincible component attached.
- rollTimer decrements by dt each frame while isRolling === true.
- When rollTimer <= 0: isRolling is set to false, Invincible component is removed.
- cooldownRemaining decrements by dt each frame unconditionally (whether rolling or not).
- cooldownRemaining never goes below 0 (clamp or allow negative -- verify which; negative is functionally fine but sloppy).
- On roll start: cooldownRemaining = dodgeRollCooldown (1.0), rollTimer = dodgeRollDuration (0.3).
- Roll direction is captured from movement input at initiation time. If no movement input, roll direction = entity facing direction.
- Cannot initiate a roll while cooldownRemaining > 0.
- Cannot initiate a roll while isRolling === true.

## Adversarial Test Cases

### Case: Roll timer expires exactly at zero
- **Setup:** isRolling = true, rollTimer = 0.016667 (one frame at 60Hz), dt = 0.016667.
- **Why this matters:** Boundary condition. If the check is `rollTimer < 0` instead of `rollTimer <= 0`, the roll extends by one frame, giving an extra frame of invincibility.
- **Expected behavior:** rollTimer = 0 (or slightly negative). isRolling = false. Invincible component removed.

### Case: Roll timer expires mid-frame (negative remainder)
- **Setup:** isRolling = true, rollTimer = 0.005, dt = 0.016667.
- **Why this matters:** rollTimer goes to -0.011667. System must still end the roll, not carry negative time.
- **Expected behavior:** isRolling = false. Invincible removed. rollTimer is 0 or negative (either acceptable as long as roll ends).

### Case: Invincible component added on first frame of roll
- **Setup:** Initiate roll this frame. isRolling was false, now true. dt = 0.016667.
- **Why this matters:** If Invincible is only added on subsequent frames (after the first tick), there is a one-frame vulnerability window at roll start.
- **Expected behavior:** Invincible component exists on the entity after the system runs on the initiation frame.

### Case: Invincible component removed on the exact frame roll ends
- **Setup:** isRolling = true, rollTimer will hit <= 0 this frame.
- **Why this matters:** If Invincible lingers one frame after the roll ends, the player gets a free invincibility frame. If it is removed one frame early, the player is vulnerable during the last frame of the roll animation.
- **Expected behavior:** Invincible is removed in the same frame that isRolling becomes false.

### Case: Cooldown ticks during roll
- **Setup:** Start a roll. cooldownRemaining = 1.0. Roll lasts 0.3s.
- **Why this matters:** If cooldown does NOT tick during roll, the effective cooldown becomes duration + cooldown = 1.3s instead of 1.0s. The spec says cooldown decrements always.
- **Expected behavior:** After roll ends (0.3s later), cooldownRemaining = 0.7, not 1.0.

### Case: Cooldown prevents immediate re-roll
- **Setup:** Roll just ended. cooldownRemaining = 0.7. Player presses dodge again.
- **Why this matters:** If cooldown is checked before decrement, or if the initiation path skips the cooldown guard, the player can chain rolls for permanent invincibility.
- **Expected behavior:** Roll is not initiated. isRolling stays false.

### Case: Cooldown expires, allowing next roll
- **Setup:** isRolling = false, cooldownRemaining = 0.01, dt = 0.016667.
- **Why this matters:** After this frame, cooldownRemaining goes to ~-0.006. On the next frame, a roll request should succeed.
- **Expected behavior:** cooldownRemaining <= 0 after tick. Next roll request is accepted.

### Case: Roll direction from movement input
- **Setup:** At roll initiation, moveX = 0.707, moveY = 0.707 (diagonal). Facing direction = (1, 0).
- **Why this matters:** Roll must go in movement direction, not facing direction, when movement is nonzero.
- **Expected behavior:** rollDirectionX ~= 0.707, rollDirectionY ~= 0.707 (normalized movement). Velocity = (0.707 * 12.0, 0.707 * 12.0) each frame while rolling.

### Case: Roll direction falls back to facing when no movement
- **Setup:** At roll initiation, moveX = 0, moveY = 0. Entity rotation.y = PI/2 (facing up).
- **Why this matters:** If the system uses raw zero movement as the direction, velocity is zero during the roll -- the player rolls in place, which is nonsensical.
- **Expected behavior:** rollDirection derived from facing direction. rollDirectionX = cos(PI/2) ~= 0, rollDirectionY = sin(PI/2) ~= 1. Velocity ~= (0, 12.0).

### Case: Roll direction is locked for entire roll duration
- **Setup:** Roll initiated moving right. During the roll, movement input changes to left.
- **Why this matters:** If direction is recalculated each frame, the player can steer during a roll, defeating its purpose as a committed action.
- **Expected behavior:** rollDirection stays (1, 0) for the entire roll duration. Velocity stays (12.0, 0).

### Case: Multiple entities with DodgeRoll component
- **Setup:** Two entities with DodgeRoll, Velocity, Position. Entity A is rolling, entity B is not.
- **Why this matters:** System must iterate all matching entities without cross-contamination. Entity B should not gain Invincible because Entity A is rolling.
- **Expected behavior:** Entity A has velocity overridden and Invincible. Entity B is unaffected.

### Case: Very large dt (lag spike)
- **Setup:** isRolling = true, rollTimer = 0.3, dt = 1.0 (massive lag spike, though capped at 0.1 by game loop).
- **Why this matters:** Even with maxFrameTime = 0.1, verify the system handles oversized dt gracefully. rollTimer goes deeply negative; cooldown also jumps.
- **Expected behavior:** Roll ends cleanly. isRolling = false. Invincible removed. No lingering state.

### Case: Invincible component not duplicated on already-rolling entity
- **Setup:** isRolling = true, Invincible already on entity. System runs another frame.
- **Why this matters:** If the system adds Invincible every frame without checking, it could stack or cause issues when removing (removing one copy leaves another).
- **Expected behavior:** Exactly one Invincible component on entity. Adding is idempotent or skipped if present.

## Edge Cases
- rollDirection is (0, 0) -- both movement and facing somehow produce zero: velocity should be zero, not NaN. Roll still ends normally.
- Entity gains Invincible from another source (e.g., a powerup) during a roll. When roll ends, only the roll's Invincible should be removed, not the powerup's. If Invincible is a single component, this is a conflict. Verify design intent.
- dt = 0: no state changes, no division by zero, system is a no-op.
- cooldownRemaining is already negative when roll is initiated (from floating point drift): should still set to dodgeRollCooldown (1.0) on initiation.

## Interaction Concerns
- PlayerControlSystem (order 2) initiates rolls by setting isRolling = true and rollDirection. DodgeRollSystem (order 3) then manages the state. If both systems set velocity, the last writer wins. DodgeRollSystem must be authoritative for velocity during rolls.
- CollisionResponseSystem checks Invincible to skip damage. The Invincible component must be present BEFORE CollisionResponseSystem runs (order 9). Since DodgeRollSystem is order 3, this is satisfied.
- If PlayerControlSystem also overrides velocity for rolling (as stated in its spec), there is a potential double-write conflict. Clarify: does PlayerControlSystem set roll velocity, or does DodgeRollSystem? Both specs claim this. The system running later (DodgeRollSystem, order 3) wins.
- ExpireModifiersSystem (order 24) does not manage Invincible -- only DamageOverTime and SpeedModifier. So DodgeRollSystem is solely responsible for Invincible lifecycle during rolls.
