# Test Spec: TEMP-012 — MovementSystem

## Properties (must ALWAYS hold)
- PreviousPosition receives an exact copy of Position BEFORE any velocity integration occurs in that frame.
- For every entity with Position, PreviousPosition, and Velocity: `position.{x,y,z} += velocity.{x,y,z} * dt` after the system runs.
- Entities that have Position and PreviousPosition but lack a Velocity component are never modified by this system.
- The system never creates or destroys entities.
- The system never modifies Velocity — it is a read-only consumer of that component.
- The system is deterministic: identical inputs produce identical outputs regardless of call count or ordering history.

## Adversarial Test Cases

### Case: PreviousPosition must snapshot BEFORE integration, not after
- **Setup:** Entity with Position `{x:10, y:5, z:3}`, PreviousPosition `{x:0, y:0, z:0}`, Velocity `{x:1, y:0, z:0}`, dt=1.0.
- **Why this matters:** If a developer copies Position to PreviousPosition AFTER integration, the renderer's interpolation breaks — PreviousPosition and Position become identical, causing entities to appear frozen. This is the single most common implementation mistake for this pattern.
- **Expected behavior:** After system runs, PreviousPosition is `{x:10, y:5, z:3}` (the old position), Position is `{x:11, y:5, z:3}`.

### Case: Zero velocity must not corrupt PreviousPosition
- **Setup:** Entity with Position `{x:5, y:5, z:5}`, PreviousPosition `{x:3, y:3, z:3}`, Velocity `{x:0, y:0, z:0}`, dt=1.0.
- **Why this matters:** A naive implementation might skip PreviousPosition copy for zero-velocity entities as an "optimization," breaking interpolation for entities that just stopped moving. The contract says PreviousPosition is always copied.
- **Expected behavior:** PreviousPosition becomes `{x:5, y:5, z:5}`. Position remains `{x:5, y:5, z:5}`.

### Case: Negative velocity values
- **Setup:** Entity with Position `{x:0, y:0, z:0}`, PreviousPosition `{x:0, y:0, z:0}`, Velocity `{x:-10, y:-5, z:-3}`, dt=0.5.
- **Why this matters:** Sign errors in the integration formula (using subtraction instead of addition, or abs() on velocity) would break backward/downward movement.
- **Expected behavior:** Position is `{x:-5, y:-2.5, z:-1.5}`.

### Case: Very large dt (spiral-of-death catch-up frame)
- **Setup:** Entity with Position `{x:0, y:0, z:0}`, Velocity `{x:100, y:100, z:0}`, dt=0.1 (maxFrameTime from config).
- **Why this matters:** The game loop clamps dt at maxFrameTime (0.1s). An implementation that assumes dt is always ~0.01667 might overflow buffers, trigger NaN from downstream systems, or produce a position that teleports through walls. The MovementSystem itself must not clamp or reject large dt — that is the game loop's job.
- **Expected behavior:** Position is `{x:10, y:10, z:0}`. No clamping, no NaN, no special-casing.

### Case: Very small dt (sub-microsecond)
- **Setup:** Entity with Position `{x:1, y:1, z:1}`, Velocity `{x:1000, y:1000, z:1000}`, dt=0.000001.
- **Why this matters:** Floating-point precision. If dt is so small that `velocity * dt` underflows to zero, position would not change. This tests that the system does not introduce unnecessary rounding.
- **Expected behavior:** Position changes by `{0.001, 0.001, 0.001}`. Result is `{x:1.001, y:1.001, z:1.001}`.

### Case: Entity without Velocity is completely untouched
- **Setup:** Entity A has Position `{x:5, y:5, z:5}` and PreviousPosition `{x:3, y:3, z:3}` but NO Velocity component. Entity B has all three components.
- **Why this matters:** The query should only match entities with all three components (Position, PreviousPosition, Velocity). If the query is too broad (e.g., only filtering on Position), it would attempt to read undefined Velocity, causing a crash or NaN positions.
- **Expected behavior:** Entity A's Position and PreviousPosition are both completely unchanged after the system runs. Entity B is updated normally.

### Case: Multiple entities processed in one call
- **Setup:** Three entities: E1 at `{x:0,y:0,z:0}` with velocity `{x:1,y:0,z:0}`, E2 at `{x:10,y:10,z:10}` with velocity `{x:0,y:-1,z:0}`, E3 at `{x:-5,y:0,z:0}` with velocity `{x:0,y:0,z:1}`. dt=1.0.
- **Why this matters:** Catches iteration bugs where only the first or last entity is processed, or where one entity's update contaminates another (shared scratch vector not reset).
- **Expected behavior:** E1 Position=`{x:1,y:0,z:0}`, E2 Position=`{x:10,y:9,z:10}`, E3 Position=`{x:-5,y:0,z:1}`. Each PreviousPosition holds the respective original position.

### Case: dt = 0 (paused frame)
- **Setup:** Entity with Position `{x:5, y:5, z:5}`, Velocity `{x:10, y:10, z:10}`, dt=0.
- **Why this matters:** When the game is paused, dt may be passed as 0. Position must not change, but PreviousPosition must still be copied (the renderer still interpolates).
- **Expected behavior:** PreviousPosition becomes `{x:5, y:5, z:5}`. Position remains `{x:5, y:5, z:5}`.

### Case: Velocity is not mutated by the system
- **Setup:** Entity with Velocity `{x:7, y:-3, z:2}`, dt=0.5.
- **Why this matters:** If a developer accidentally writes `velocity.x *= dt` instead of `position.x += velocity.x * dt`, the velocity decays exponentially each frame, causing entities to slow down and eventually stop. This is an extremely subtle bug.
- **Expected behavior:** After the system runs, Velocity is still exactly `{x:7, y:-3, z:2}`.

### Case: NaN or Infinity in velocity
- **Setup:** Entity with Position `{x:0, y:0, z:0}`, Velocity `{x:NaN, y:Infinity, z:-Infinity}`, dt=1.0.
- **Why this matters:** Upstream bugs (division by zero in AI, bad normalization) can produce NaN/Infinity velocities. The movement system should either propagate these faithfully (making the bug visible for upstream to fix) or guard against them. Either way, the behavior must be defined, not undefined. If the system silently produces NaN positions, every downstream system (collision, rendering) breaks with no indication of the source.
- **Expected behavior:** Define the contract: either the system propagates NaN/Infinity into position (making upstream bugs visible), or it skips entities with non-finite velocity. Document and test whichever is chosen.

## Edge Cases
- Empty entity set: system called with zero matching entities. Must not throw.
- Entity with only Position (no PreviousPosition, no Velocity): must not be queried or modified.
- Entity with Position and Velocity but no PreviousPosition: must not be queried (requires all three components).
- Extremely large position values (near float limits, e.g., 1e30): integration must not overflow to Infinity.
- Negative dt: the system should not receive negative dt (game loop invariant), but if it does, behavior should be defined (position moves backward, not crash).

## Interaction Concerns
- PreviousPosition is consumed by the renderer for interpolation between physics frames. If MovementSystem does not update PreviousPosition, visual stutter results. This is silent — no crash, just bad visuals.
- CollisionDetectionSystem runs immediately after MovementSystem. If Position is not updated, no collisions are detected for moving entities — bullets pass through walls.
- If a developer adds a second system that also writes Position (e.g., a knockback system), execution order determines which write wins. MovementSystem must run at its defined slot (system 7) and not assume it is the only Position writer.
- PlayerControlSystem and AISystem write Velocity BEFORE MovementSystem reads it. If execution order is violated, entities move with stale velocity from the previous frame.
