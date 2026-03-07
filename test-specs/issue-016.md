# Test Spec: TEMP-009 — InputSystem (Input Manager and Input Mapping)

## Properties (must ALWAYS hold)
- `moveX` is always in the range [-1, 1] inclusive, regardless of input source or combination.
- `moveY` is always in the range [-1, 1] inclusive, regardless of input source or combination.
- Diagonal movement is normalized: `sqrt(moveX^2 + moveY^2) <= 1.0` (with floating-point tolerance).
- Mouse screen-space coordinates are converted to world-space coordinates using the camera's projection matrix (raycasting onto the ground plane at y=0).
- Gamepad input and keyboard input produce identical InputState structure — downstream systems cannot distinguish input source.
- All boolean fields (`fireSidearm`, `fireLongArm`, `reload`, `dodgeRoll`, `interact`, `openUpgrade`, `pause`) are true booleans, never truthy non-boolean values.
- `inputSystem(inputManager)` returns a complete InputState with all fields defined (no undefined fields).
- Input mapping is data-driven: physical keys map to logical actions via configuration, not hardcoded switch statements.

## Adversarial Test Cases

### Case: Diagonal keyboard input is normalized to magnitude <= 1
- **Setup:** Both W and D keys pressed simultaneously (moveX=1, moveY=1 raw).
- **Why this matters:** Without normalization, diagonal movement has magnitude sqrt(2) ~= 1.414, making diagonal movement 41% faster than cardinal movement. This is a classic game dev bug that makes speedrunners hold diagonal constantly.
- **Expected behavior:** `sqrt(moveX^2 + moveY^2) <= 1.0`. Specifically, moveX and moveY should both be approximately 0.7071 (1/sqrt(2)).

### Case: All four directional keys pressed simultaneously
- **Setup:** W, A, S, D all pressed at once.
- **Why this matters:** Opposing keys cancel out. If the system adds all four (1 + -1 + 1 + -1 = 0), the result should be zero movement. If it processes them sequentially and clamps after each, the result depends on processing order — which is a bug.
- **Expected behavior:** moveX = 0, moveY = 0. No movement.

### Case: Three directional keys pressed (W + A + S)
- **Setup:** W (moveY=1), A (moveX=-1), S (moveY=-1) all pressed.
- **Why this matters:** W and S cancel on Y, leaving only A on X. The raw input is (-1, 0). No normalization needed for a single axis. But if the system normalizes BEFORE cancellation, it might produce wrong values.
- **Expected behavior:** moveX = -1, moveY = 0.

### Case: Gamepad stick at full deflection on both axes
- **Setup:** Gamepad left stick at (1.0, 1.0) — full diagonal.
- **Why this matters:** Some gamepad APIs report raw stick values outside [-1,1] (hardware noise) or report diagonal as (1,1) without normalizing. The system must clamp first, then normalize.
- **Expected behavior:** `sqrt(moveX^2 + moveY^2) <= 1.0`. Values clamped and normalized.

### Case: Gamepad stick slightly beyond [-1,1] range (hardware noise)
- **Setup:** Gamepad reports stick value of 1.02 on X axis, 0.0 on Y axis.
- **Why this matters:** Cheap gamepads and some drivers report values slightly outside the nominal [-1,1] range. If the system does not clamp, downstream systems (PlayerControlSystem multiplying by movementSpeed) produce faster-than-intended movement.
- **Expected behavior:** moveX = 1.0 (clamped), moveY = 0.0.

### Case: Gamepad dead zone handling
- **Setup:** Gamepad stick at (0.05, 0.03) — tiny deflection within typical dead zone.
- **Why this matters:** Without dead zone filtering, a drifting gamepad stick causes the player to slowly creep in one direction even when the player is not touching the controller. This makes the game unplayable on worn controllers.
- **Expected behavior:** moveX = 0, moveY = 0 (dead zone filters small inputs to zero).

### Case: Mouse at screen edge produces valid world coordinates
- **Setup:** Mouse at screen position (0, 0) — top-left corner. Camera at a specific position and angle.
- **Why this matters:** Screen-to-world raycasting at extreme screen positions can produce coordinates far from the player, or the ray might not intersect the ground plane at all (if the camera angle causes the ray to point above the horizon). The system must handle this gracefully.
- **Expected behavior:** `aimWorldX` and `aimWorldY` are finite numbers. No NaN, no Infinity.

### Case: Mouse position when camera is looking straight down
- **Setup:** Camera at angle=90 degrees (straight down), mouse at center of screen.
- **Why this matters:** At 90 degrees, the ray from the camera through the mouse position is nearly vertical. The ground-plane intersection is well-defined. But at other angles or with perspective distortion, the math can degenerate.
- **Expected behavior:** aimWorldX and aimWorldY correspond to the world position directly under the mouse cursor on the y=0 plane.

### Case: Keyboard and gamepad providing conflicting input simultaneously
- **Setup:** Keyboard W pressed (moveY=1) and gamepad left stick pushed down (moveY=-1) at the same time.
- **Why this matters:** The system must define a merge policy. Options: last-input-wins, sum-and-clamp, or one-source-takes-priority. Without a defined policy, behavior is unpredictable and may differ between frames.
- **Expected behavior:** Define and test the merge policy. Most common: last active input source wins, OR sum and clamp. The result must be deterministic and within [-1,1].

### Case: No input at all (idle state)
- **Setup:** No keys pressed, no mouse movement, no gamepad input.
- **Why this matters:** The system must produce a valid InputState with all fields at their default/zero values. If the system only updates fields when input is detected, stale values from previous frames persist (e.g., fireSidearm remains true from last frame).
- **Expected behavior:** moveX=0, moveY=0, all booleans are false. aimWorldX/aimWorldY hold the last known mouse position (mouse position is persistent, not per-frame).

### Case: Rapid key press and release within one frame
- **Setup:** Player presses and releases the fire key between two system calls (within one 16.67ms frame).
- **Why this matters:** If the InputManager only samples current key state (is-down), the press is missed entirely. For one-shot actions like dodge roll or interact, the InputManager must track key-down EVENTS, not just key state, or buffer presses between frames.
- **Expected behavior:** The action fires. `dodgeRoll` (or whichever button) is true for that frame even if the key is no longer held when the system runs.

### Case: Fire buttons are independent
- **Setup:** Both LMB (fireSidearm) and RMB (fireLongArm) pressed simultaneously.
- **Why this matters:** If the system uses mutually exclusive logic (if-else instead of independent checks), only one fire button registers per frame. The contracts say both fields exist independently.
- **Expected behavior:** `fireSidearm = true` AND `fireLongArm = true` simultaneously.

### Case: InputState fields are all present (no undefined)
- **Setup:** Call `inputSystem(inputManager)` with fresh/idle InputManager.
- **Why this matters:** If any field is undefined, downstream systems that read it (e.g., `if (input.dodgeRoll)`) behave differently than if the field is `false`. In JavaScript, `undefined` is falsy but `=== false` is false. A missing field causes type errors in strict mode.
- **Expected behavior:** Every field of InputState is defined and of the correct type: numbers for moveX/moveY/aimWorldX/aimWorldY, booleans for all action fields.

### Case: Input mapping is data-driven — remapping works
- **Setup:** Change the input mapping to bind "Space" to "fireSidearm" instead of "dodgeRoll". Press Space.
- **Why this matters:** If input mapping is hardcoded, the data-driven requirement is not met. The test verifies that changing the mapping configuration changes the output without code modification.
- **Expected behavior:** Pressing Space produces `fireSidearm = true`, NOT `dodgeRoll = true`.

### Case: Normalization with only one axis active
- **Setup:** Only W pressed (moveX=0, moveY=1).
- **Why this matters:** Normalization of a single-axis vector should not reduce its magnitude. The vector (0,1) has magnitude 1 and should remain (0,1) after normalization. A naive implementation that always divides by magnitude would handle this correctly, but one that only normalizes when magnitude > 1 must also not reduce single-axis values.
- **Expected behavior:** moveX=0, moveY=1 (unchanged, magnitude is already 1).

### Case: Normalization never produces NaN
- **Setup:** moveX=0, moveY=0 (no input). Attempt to normalize.
- **Why this matters:** Normalizing a zero vector involves dividing by zero magnitude, producing NaN. The system must check for zero magnitude before normalizing.
- **Expected behavior:** moveX=0, moveY=0. No NaN.

## Edge Cases
- Gamepad connected mid-game: InputManager must detect and incorporate gamepad input without crashing or requiring restart.
- Gamepad disconnected mid-game: InputManager must fall back to keyboard/mouse without producing undefined values.
- Multiple gamepads connected: system should use the first active one (or a configurable one), not merge inputs from all gamepads.
- Browser tab loses focus: keyup events may not fire, causing stuck keys. The system must clear key state on blur.
- Mouse leaves the browser window: aimWorldX/aimWorldY should hold the last valid position, not jump to (0,0) or produce NaN.
- Very high-DPI mouse: mouse position values can be non-integer. The system must handle floating-point screen coordinates.
- Touch input (mobile): out of scope for v1 but the system should not crash if touch events fire.

## Interaction Concerns
- PlayerControlSystem is the primary consumer of InputState. It runs at position 2, immediately after InputSystem at position 1. If InputSystem produces stale or incomplete InputState, all player actions fail.
- Multiple systems read InputState: PlayerControlSystem, PickupSystem, ChestSystem, ShopSystem, FloorTransitionSystem. They all share the same InputState object. If one system mutates InputState (e.g., setting `interact = false` after handling it), other systems miss the input. InputState should be treated as immutable after creation, or each system should receive a fresh copy.
- The camera reference held by InputManager is used for screen-to-world conversion. If the camera moves (it follows the player with smoothing), the conversion must use the camera's position at the time of the input sample, not at render time. A stale camera reference causes aim offset.
- InputSystem runs at 60Hz (fixed timestep). Mouse events fire at the browser's event rate (typically higher). The InputManager must accumulate or sample mouse position between system calls. If it only reads the latest position, intermediate mouse movement is lost (relevant for fast flick-aiming).
