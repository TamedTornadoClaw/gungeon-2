# Test Spec: TEMP-048 — AudioEventSystem

## Properties (must ALWAYS hold)
- Every AudioEvent in the event queue results in exactly one `audioManager.play(soundId)` call (for non-looping sounds).
- The event queue is fully drained each invocation — no AudioEvent carries over to subsequent frames.
- Looping sounds (FireAmbient, WaterAmbient) are started via `audioManager.playLoop(soundId)` when the player enters proximity, and stopped via `audioManager.stopLoop(soundId)` when the player leaves proximity.
- Looping sounds are NOT re-triggered every frame while the player remains in proximity.
- AudioEvents with an optional `position` field pass that position to `audioManager.play()` for spatial audio (if supported).
- The system never throws on a valid SoundId enum value, even if the audioManager fails internally.

## Adversarial Test Cases / Scenarios

### Scenario: Multiple identical sound events in one frame
- **Given:** 10 AudioEvents all with `SoundId.EnemyHitFlesh` queued in a single frame (e.g., shotgun hitting 10 enemies simultaneously).
- **Why this matters:** If the system naively calls `audioManager.play()` 10 times, it exceeds `maxInstances` (handled by audioManager) but the system must still call play for all of them and let the audioManager enforce pooling. If the system itself tries to deduplicate, legitimate simultaneous sounds are lost.
- **Expected behavior:** `audioManager.play(SoundId.EnemyHitFlesh)` is called exactly 10 times. The audioManager's `maxInstances` cap is responsible for limiting actual playback, not the AudioEventSystem.

### Scenario: Looping sound started but never stopped
- **Given:** Player walks over a fire hazard (FireAmbient should start), then the player dies (transition to Death state). No explicit "leave proximity" event fires.
- **Why this matters:** If the system only stops looping sounds on an explicit "leave proximity" signal, the fire ambient sound plays forever through the Death screen. This is a common audio leak bug.
- **Expected behavior:** When the game state transitions away from Gameplay (or when the game world is destroyed), all active looping sounds are stopped. The system should expose a `stopAllLoops()` method or respond to a cleanup signal.

### Scenario: Looping sound proximity toggle — rapid enter/leave
- **Given:** Player oscillates in and out of fire hazard range every frame for 10 frames.
- **Why this matters:** If start/stop are called every frame, the sound restarts from the beginning each time, creating an audible stutter. The system must track which loops are active and only call start on the transition from "not playing" to "playing."
- **Expected behavior:** `audioManager.playLoop(FireAmbient)` is called once on the first enter-proximity frame. `audioManager.stopLoop(FireAmbient)` is called once on the first leave-proximity frame. Subsequent enter/leave frames trigger the corresponding start/stop only if the current state differs from the requested state.

### Scenario: Two looping sounds simultaneously
- **Given:** Player stands at the intersection of a fire hazard and a water hazard.
- **Why this matters:** If the system tracks looping state with a single boolean (e.g., `isLoopPlaying`), only one ambient sound plays at a time.
- **Expected behavior:** Both `FireAmbient` and `WaterAmbient` are playing simultaneously. Each looping SoundId has independent active/inactive tracking.

### Scenario: Empty event queue
- **Given:** A frame with zero AudioEvents (e.g., player standing still in an empty room).
- **Why this matters:** If the system assumes at least one event and indexes into an empty array, it throws. Edge case for initialization and quiet moments.
- **Expected behavior:** System runs with no errors, makes zero `audioManager.play()` calls, and does not modify looping sound state.

### Scenario: AudioEvent with unknown SoundId
- **Given:** An AudioEvent with a SoundId value that exists in the enum but has no corresponding entry in the sound manifest (manifest was not updated after a new SoundId was added to the enum).
- **Why this matters:** The audioManager may throw or return undefined when looking up a missing sound. The AudioEventSystem must not crash the game loop.
- **Expected behavior:** `audioManager.play()` is called (the system does not validate against the manifest — that is the audioManager's responsibility). If the audioManager throws, the system catches the error, logs a warning, and continues processing remaining events.

### Scenario: Position passed to audioManager for spatial sounds
- **Given:** An AudioEvent with `sound: SoundId.EnemyDeath` and `position: { x: 10, y: 0, z: 5 }`.
- **Why this matters:** If the system ignores the position field, all sounds play at full volume regardless of distance, breaking spatial audio immersion.
- **Expected behavior:** `audioManager.play(SoundId.EnemyDeath, { x: 10, y: 0, z: 5 })` is called with the position argument intact.

### Scenario: Non-looping sound with loop=true in manifest
- **Given:** An AudioEvent for a SoundId whose manifest entry has `loop: true` (e.g., FireAmbient) but it arrives as a one-shot AudioEvent rather than through the proximity system.
- **Why this matters:** If the system always calls `play()` for AudioEvents regardless of the loop flag, it starts an ambient loop that never stops. The system must distinguish between looping sounds (managed by proximity) and one-shot sounds (managed by events).
- **Expected behavior:** The system recognizes that looping sounds should not be triggered by one-shot AudioEvents. Either: (a) the event is ignored with a warning, or (b) the system routes it to the looping manager which checks if it is already playing.

### Scenario: audioManager.play() throws mid-queue
- **Given:** A queue of 5 AudioEvents. The audioManager throws on the 3rd call.
- **Why this matters:** If the system does not catch errors per-event, events 4 and 5 are never processed. Missing audio is a minor issue; an uncaught exception crashing the entire system pipeline (breaking DamageSystem, DeathSystem, etc. that run earlier and depend on the game loop continuing) is critical.
- **Expected behavior:** Events 1, 2, 4, and 5 are played successfully. Event 3's error is caught and logged. The queue is fully drained.

## Edge Cases
- AudioEvent with `position: undefined` (no spatial data): `audioManager.play(soundId)` called without position argument.
- Frame with 100+ AudioEvents (chain explosion scenario): all events processed, no truncation.
- Looping sound for a hazard type that is destroyed mid-loop (destructible barrel containing fire): loop must be stopped when the source entity no longer exists.
- Game paused (dt = 0): AudioEventSystem should not process events during pause (game loop is frozen), but any events queued before pause should not be lost — they should play when resumed.

## Interaction Concerns / Integration Warnings
- **AudioManager (TEMP-047) dependency:** AudioEventSystem is a thin dispatcher. All pooling, volume, pitch logic lives in the audioManager. If the audioManager's `play()` signature changes (e.g., adding a priority parameter), this system must be updated.
- **Event queue ownership:** Multiple systems emit AudioEvents (DamageSystem, DeathSystem, DestructibleSystem, CollisionResponseSystem, ChestSystem, DoorSystem, PickupSystem, ProjectileSystem). The event queue must support multiple writers. If the queue is a plain array, concurrent pushes during the same frame are fine (single-threaded JS), but clearing must happen after AudioEventSystem runs, not before.
- **System execution order:** AudioEventSystem is last in the pipeline (order 26). Events emitted by systems 1-25 in the current frame are available. Events emitted by AudioEventSystem itself (if any) would be lost — but it should never emit events.
- **State transitions:** When transitioning from Gameplay to Paused/Death/Victory, lingering AudioEvents in the queue may play sounds after the transition. The system should either flush or discard the queue on state change.
