# Test Spec: TEMP-062 — Game loop — fixed timestep orchestration

## Properties (must ALWAYS hold)
- The simulation timestep is exactly 0.01667s (60Hz). No frame ever advances simulation by a different dt.
- All 26 systems execute in the exact order specified: Input, PlayerControl, DodgeRoll, AI, Projectile, EnemyWeapon, Movement, CollisionDetection, CollisionResponse, Damage, ShieldRegen, Hazard, Lifetime, Pickup, Chest, Shop, GunXP, Destructible, Door, Spawn, FloorTransition, Death, ExpireModifiers, Particle, Audio.
- GunStatSystem is never called by the game loop. It is invoked on-demand only.
- Accumulated time exceeding maxFrameTime (0.1s) is discarded, not carried forward.
- The event queue is cleared at the end of each simulation step, before the next step begins.
- When frozen, zero simulation steps execute regardless of elapsed real time. The render loop continues.
- When stopped, neither simulation nor render loop executes.
- start/stop/freeze/resume are idempotent — calling start() twice does not create two loops.

## Scenarios

### Scenario: Single frame under budget
- **Given:** Game loop is running. Last frame completed. 0.018s of real time has elapsed (slightly more than one timestep).
- **When:** The next RAF callback fires.
- **Then:** Exactly 1 simulation step executes with dt=0.01667. Remaining 0.00133s is accumulated for the next frame. All 26 systems are called exactly once in order.
- **Why:** Catches off-by-one in accumulator logic where remainder is discarded or double-stepped.

### Scenario: Multiple steps per frame (catch-up)
- **Given:** Game loop is running. 0.05s of real time has elapsed since last frame (e.g., brief tab switch).
- **When:** The next RAF callback fires.
- **Then:** Exactly 2 simulation steps execute (0.05 / 0.01667 = 2.998, floored to 2 with ~0.0166s remainder carried). Each step calls all 26 systems in order. Remainder ~0.0166s is kept for the next frame.
- **Why:** Catches implementations that run only one step per frame or that round instead of floor the step count.

### Scenario: Spiral-of-death protection
- **Given:** Game loop is running. 0.5s of real time has elapsed (e.g., debugger pause, OS sleep).
- **When:** The next RAF callback fires.
- **Then:** Accumulated time is clamped to maxFrameTime (0.1s) before stepping. At most 6 simulation steps execute (floor(0.1 / 0.01667) = 5..6). The remaining 0.4s is discarded entirely — it does not bleed into subsequent frames.
- **Why:** Without the cap, the loop would try to run ~30 steps in one frame, causing a cascade of slow frames. The discard must happen before stepping, not after.

### Scenario: Spiral-of-death does not affect normal frames after recovery
- **Given:** A spiral-of-death frame just occurred (0.5s elapsed, clamped to 0.1s). On the very next frame, 0.018s of real time has elapsed.
- **When:** The next RAF callback fires.
- **Then:** Exactly 1 simulation step executes. The accumulator contains only the 0.018s plus any remainder from the capped frame — NOT the discarded 0.4s.
- **Why:** Catches implementations where the discard is deferred or where the accumulator leaks excess time across frames.

### Scenario: System execution order is enforced
- **Given:** Game loop is running. A spy/mock is attached to each of the 26 systems.
- **When:** One simulation step executes.
- **Then:** The call order matches the spec exactly: InputSystem is called first, AudioEventSystem is called last. No system is skipped. No system is called twice within a single step.
- **Why:** Incorrect ordering causes data dependency violations — e.g., MovementSystem running before PlayerControlSystem means velocity is stale. CollisionDetection running before Movement means collisions use last frame's positions.

### Scenario: GunStatSystem is excluded from the loop
- **Given:** Game loop is running. A spy is attached to GunStatSystem.
- **When:** 100 simulation steps execute.
- **Then:** GunStatSystem is never called.
- **Why:** GunStatSystem is on-demand only. Including it in the loop wastes cycles and could cause stat recalculation to interfere with mid-frame gun state.

### Scenario: Freeze stops simulation but not rendering
- **Given:** Game loop is running and has executed at least one step. A render callback spy is active.
- **When:** freeze() is called. 0.1s of real time elapses. The RAF callback fires.
- **Then:** Zero simulation steps execute. The render callback is still invoked (for visual continuity during pause overlays). Accumulated time does not grow while frozen.
- **Why:** If accumulated time grows while frozen, resuming causes a burst of catch-up steps. If rendering stops, the pause overlay shows a black canvas.

### Scenario: Resume after freeze
- **Given:** Game loop was frozen for 5 seconds.
- **When:** resume() is called. 0.018s of real time elapses. The RAF callback fires.
- **Then:** Exactly 1 simulation step executes. The 5 seconds of frozen time is not simulated.
- **Why:** Catches implementations that track wall-clock time instead of resetting the accumulator on resume.

### Scenario: Stop destroys the loop entirely
- **Given:** Game loop is running.
- **When:** stop() is called.
- **Then:** The RAF loop is cancelled. No further simulation steps or render callbacks fire. Calling stop() again is a no-op (no error thrown).
- **Why:** Leaked RAF loops cause ghost updates to a destroyed world, leading to null reference crashes.

### Scenario: Start is idempotent
- **Given:** Game loop is already running.
- **When:** start() is called again.
- **Then:** No second loop is created. Only one RAF callback chain is active. System call counts per frame remain unchanged.
- **Why:** Double-starting creates two competing loops that both mutate ECS state, causing double-speed simulation and race conditions.

### Scenario: Event queue cleared between steps
- **Given:** Game loop is running. DamageSystem emits a DamageEvent during step N.
- **When:** Step N+1 begins (within the same frame, during catch-up).
- **Then:** The DamageEvent from step N is not visible to step N+1. The event queue starts empty for each step.
- **Why:** Stale events cause double-processing — e.g., a DamageEvent processed twice deals double damage.

### Scenario: Zero elapsed time produces zero steps
- **Given:** Game loop is running. RAF fires with 0ms elapsed (can happen on some browsers).
- **When:** The callback executes.
- **Then:** Zero simulation steps execute. No systems are called. Render callback may still fire (rendering the same interpolated state).
- **Why:** Prevents division-by-zero or negative step counts from degenerate timing.

## Edge Cases
- RAF callback receives a timestamp that goes backward (browser bug or performance.now() wrap). The loop must not produce negative dt. Clamp elapsed time to 0 minimum.
- First frame after start() has no previous timestamp. The first dt must be 0 or one timestep — not a huge value from epoch.
- If all 26 systems collectively take longer than 16.67ms, the loop degrades gracefully (fewer steps next frame) rather than queueing unbounded work.
- Calling freeze() when already frozen is a no-op. Calling resume() when not frozen is a no-op.
- Calling stop() when already stopped is a no-op. Calling start() after stop() creates a fresh loop with a reset accumulator.

## Integration Warnings
- The game loop must not hold references to destroyed ECS worlds. After stop() + world destruction + start(), the loop must use the new world.
- The render interpolation alpha value (accumulator / timestep) must be passed to the render system. If alpha is not computed, rendering will stutter at sub-60fps display rates.
- The loop must handle the case where the browser throttles RAF to 30fps (background tab in some browsers) — this is a normal catch-up scenario, not a spiral-of-death, as long as elapsed time stays under maxFrameTime.
