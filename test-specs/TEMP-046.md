# Test Spec: TEMP-046 — ParticleSystem Logic

## Properties (must ALWAYS hold)
- Every ParticleEvent in the event queue results in exactly `manifest[effect].count` new particle entities being spawned.
- Each spawned particle's initial properties (lifetime, speed, spread, sizeStart, colorStart, gravity, emissive) match the corresponding manifest entry exactly.
- Active particles update position by `velocity * dt` each frame.
- Active particles interpolate size from `sizeStart` to `sizeEnd` linearly over their lifetime.
- Active particles interpolate opacity from 1.0 to 0.0 (or color from `colorStart` to `colorEnd`) over their lifetime.
- Particles with `gravity > 0` in the manifest accumulate downward velocity at `gravity` units/s^2 each frame.
- Particles are removed (destroyed) in the same frame their remaining lifetime reaches zero or below.
- Particles have zero gameplay impact: they never appear in collision queries, never emit DamageEvents, never modify Health/Velocity/Position of non-particle entities.
- The event queue is fully drained each frame — no ParticleEvent carries over to the next frame.

## Adversarial Test Cases / Scenarios

### Scenario: Zero-count manifest entry
- **Given:** A ParticleEvent for an effect whose manifest entry has `count: 0`.
- **Why this matters:** If the system does not guard against zero, it may still allocate a particle array, attempt to spawn with invalid indices, or leave a stale event in the queue.
- **Expected behavior:** No particles are spawned. No errors thrown. The event is consumed and discarded.

### Scenario: Multiple events in a single frame
- **Given:** 5 ParticleEvents queued in the same frame: 2x MuzzleFlash, 2x BloodSplat, 1x Explosion.
- **Why this matters:** If the system processes only the first event per frame (common bug with `shift()` inside a conditional instead of a loop), 4 events leak into the next frame, causing delayed visual effects.
- **Expected behavior:** All 5 events are processed in a single `particleSystem()` call. Total spawned particles = `2*manifest.MuzzleFlash.count + 2*manifest.BloodSplat.count + 1*manifest.Explosion.count`.

### Scenario: Particle lifetime expiry at exact boundary
- **Given:** A particle with `lifetime: 0.5` after receiving exactly 30 frames of dt=0.01667 (total elapsed = 0.5001s).
- **Why this matters:** Floating-point comparison `remaining <= 0` vs `remaining < 0` can cause particles to persist one extra frame, or conversely, to be removed one frame early if the check uses strict inequality and remaining is exactly 0.
- **Expected behavior:** The particle is removed on the frame where `remaining` first becomes <= 0. It must not persist beyond that frame.

### Scenario: Rapid-fire events causing particle count spike
- **Given:** 20 Explosion events in one frame (simulating a chain explosion scenario with multiple SuicideBombers).
- **Why this matters:** Peak particle budget is ~300. If each Explosion spawns 30 particles, this creates 600 particles — exceeding the performance budget. The system must either cap total particles or handle the spike gracefully without frame drops.
- **Expected behavior:** Either (a) all 600 particles are spawned and the system handles them (if within memory budget), or (b) the system enforces a max particle cap and oldest/lowest-priority particles are culled. The system must not crash, allocate unbounded memory, or corrupt the particle pool.

### Scenario: Spread angle of zero produces straight-line emission
- **Given:** A manifest entry with `spread: 0` (all particles fire in the same direction).
- **Why this matters:** If the spread calculation uses `randomInRange(-spread/2, spread/2)` and `spread=0`, the result must be exactly 0 radians offset. A faulty implementation might produce NaN or divide-by-zero if it normalizes by spread.
- **Expected behavior:** All spawned particles travel in the same direction (the emission direction). No NaN in velocity components.

### Scenario: Gravity accumulation over time
- **Given:** A particle with `gravity: 10`, `speed: 5` (upward), `lifetime: 2.0`.
- **Why this matters:** If gravity is applied as a position offset rather than a velocity delta, the particle follows a linear path instead of a parabolic arc. The visual difference is significant for debris effects.
- **Expected behavior:** Particle velocity.y decreases by `gravity * dt` each frame (velocity integration, not position hack). After 1 second, vertical velocity should be approximately `initialVelocity.y - 10.0`.

### Scenario: Size interpolation reaches exact endpoint
- **Given:** A particle with `sizeStart: 2.0`, `sizeEnd: 0.0`, `lifetime: 1.0`.
- **Why this matters:** If interpolation uses `t = elapsed / lifetime` and elapsed never exactly equals lifetime due to floating-point dt accumulation, the particle may never reach `sizeEnd` before being destroyed.
- **Expected behavior:** On the final frame before removal, the particle's rendered size is at or very near `sizeEnd` (within 0.01). The interpolation formula is `sizeStart + (sizeEnd - sizeStart) * clamp(elapsed / lifetime, 0, 1)`.

### Scenario: ParticleEvent with unknown/invalid effect enum
- **Given:** A ParticleEvent with an effect value not present in the manifest.
- **Why this matters:** If other systems emit a ParticleEffect enum value that was added to the enum but not to the manifest JSON, the system will crash on `manifest[effect].count` (undefined property access).
- **Expected behavior:** The system logs a warning and skips the event. No crash, no spawned particles.

### Scenario: dt = 0 (paused frame)
- **Given:** `particleSystem()` called with `dt = 0` (game loop frozen during Paused state with render loop still running).
- **Why this matters:** If the system still decrements lifetime by 0, particles never expire. If it skips updates entirely, newly queued events are lost.
- **Expected behavior:** Particles do not update position, size, or opacity (no change). Lifetime does not decrement. Events are still consumed and particles spawned (so returning from pause shows the effect). Alternatively, if the system is not called during pause, this is a non-issue — but the TDD says ParticleSystem runs in the game loop which freezes dt to 0.

## Edge Cases
- Particle spawned at world origin (0, 0, 0) with zero speed: remains stationary for its lifetime, then is removed.
- Particle with `sizeStart === sizeEnd`: size remains constant; no interpolation artifacts.
- Particle with `lifetime: 0.001` (sub-frame): spawned and immediately removed in the same or next frame.
- `colorStart === colorEnd`: no color interpolation needed; must not produce NaN in color channels.
- Empty event queue: system runs with no events, updates existing particles only, no errors.

## Interaction Concerns / Integration Warnings
- **LifetimeSystem overlap:** Particles may use the `Lifetime` component for expiry. If LifetimeSystem runs before ParticleSystem (it does — order 13 vs 25), it could destroy particle entities before ParticleSystem updates them. ParticleSystem should manage its own lifetime tracking, or particle entities must not use the generic `Lifetime` component.
- **Collision system:** Particle entities must NOT have `Collider` components. If they do, CollisionDetectionSystem will waste cycles checking ~300 extra entities per frame.
- **GC pressure:** Spawning/destroying entities every frame creates garbage. The system should use an object pool for particles, reusing destroyed particle slots rather than allocating new objects.
- **Render system:** Particles must be rendered via instanced mesh (1 draw call). If each particle creates a separate Three.js mesh, the draw call budget (50) is blown immediately.
