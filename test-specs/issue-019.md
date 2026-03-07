# Test Spec: TEMP-047 — Audio Manager (Integration)

## Properties (must ALWAYS hold)
- `play(soundId)` triggers playback of the sound identified by `soundId` in the sound manifest.
- Effective volume for any sound = `masterVolume * sfxVolume * manifest[soundId].volume`. Changes to settings store volumes are reflected in subsequent play calls.
- Pitch for each play call is randomized uniformly within `[manifest[soundId].pitchMin, manifest[soundId].pitchMax]`.
- At most `manifest[soundId].maxInstances` simultaneous instances of a given soundId are playing at any time. Excess play requests are either dropped or evict the oldest instance.
- `playLoop(soundId)` starts a looping sound that plays continuously until `stopLoop(soundId)` is called.
- `stopLoop(soundId)` stops the looping sound. Calling `stopLoop` on a sound that is not playing is a no-op (no error).
- All sounds are loaded from the sound manifest JSON at initialization time. Missing manifest entries for a SoundId cause a warning, not a crash.
- The manager wraps Howler.js — no direct Howl construction occurs outside this module.

## Adversarial Test Cases / Scenarios

### Scenario: Volume calculation with both master and SFX at fractional values
- **Given:** `masterVolume = 0.5`, `sfxVolume = 0.8`, `manifest[PistolFire].volume = 0.7`.
- **Why this matters:** If the manager applies only one of the two volume controls (e.g., forgets sfxVolume), sounds are too loud or too quiet. If it adds instead of multiplies, the result exceeds 1.0.
- **Expected behavior:** The Howl instance plays at volume `0.5 * 0.8 * 0.7 = 0.28`. Verify the Howl's volume method is called with this value (within floating-point tolerance).

### Scenario: Volume changes mid-playback
- **Given:** A looping sound (FireAmbient) is playing. The player opens Settings and changes `masterVolume` from 1.0 to 0.0.
- **Why this matters:** If the manager only reads volume at play-time and does not subscribe to settings changes, the looping sound continues at full volume despite the slider being at zero. This is a top-reported audio bug in games.
- **Expected behavior:** The currently playing FireAmbient loop's volume updates to 0.0 in real-time (either via Howler's volume API on the playing instance or by muting the global Howler volume).

### Scenario: maxInstances enforcement — play N+1 of the same sound
- **Given:** `manifest[EnemyHitFlesh].maxInstances = 3`. Call `play(EnemyHitFlesh)` 5 times in the same frame.
- **Why this matters:** Without instance capping, 30 simultaneous hit sounds produce ear-splitting volume stacking and distortion. This is the primary reason maxInstances exists.
- **Expected behavior:** At most 3 Howl instances of EnemyHitFlesh are playing simultaneously. The 4th and 5th calls either (a) are silently dropped, or (b) stop the oldest playing instance and reuse it. No more than 3 concurrent playbacks at any point.

### Scenario: maxInstances = 1 (e.g., Explosion) — rapid retrigger
- **Given:** `manifest[Explosion].maxInstances = 1`. Two Explosion events arrive 50ms apart.
- **Why this matters:** If the first instance is not finished when the second arrives, the manager must decide: drop the second, or restart/overlap. With maxInstances=1, overlapping violates the contract.
- **Expected behavior:** Only 1 instance plays at a time. The second call either restarts the sound from the beginning (replacing the first) or is dropped. Never 2 simultaneous Explosion instances.

### Scenario: Pitch variation boundaries
- **Given:** `manifest[PistolFire].pitchMin = 0.9`, `manifest[PistolFire].pitchMax = 1.1`. Call `play(PistolFire)` 100 times.
- **Why this matters:** If pitch randomization uses exclusive bounds or an off-by-one, all 100 calls could cluster around 0.9 and never reach 1.1 (or vice versa), producing monotonous audio.
- **Expected behavior:** The Howl `rate()` value for each call falls within [0.9, 1.1]. Across 100 calls, the distribution covers the range (min observed <= 0.95, max observed >= 1.05 with high probability).

### Scenario: Pitch variation with pitchMin === pitchMax
- **Given:** `manifest[MenuClick].pitchMin = 1.0`, `manifest[MenuClick].pitchMax = 1.0`.
- **Why this matters:** If the randomization formula is `pitchMin + Math.random() * (pitchMax - pitchMin)` and the range is 0, the result should be exactly 1.0. But some implementations add a small epsilon or use `Math.random()` in a way that produces NaN when range is 0.
- **Expected behavior:** Howl `rate()` is called with exactly 1.0 every time. No NaN, no variation.

### Scenario: play() with a SoundId not in the manifest
- **Given:** `play(SoundId.SomeNewSound)` where `SomeNewSound` exists in the enum but has no manifest entry.
- **Why this matters:** If the manager indexes into the manifest without a guard, it throws on `undefined.path`, crashing the AudioEventSystem and halting the game loop.
- **Expected behavior:** A warning is logged. The call returns without playing anything. No exception propagates.

### Scenario: Looping sound — stop before start
- **Given:** `stopLoop(SoundId.FireAmbient)` is called without a prior `playLoop(SoundId.FireAmbient)`.
- **Why this matters:** If the manager tries to call `.stop()` on a null/undefined Howl reference, it throws.
- **Expected behavior:** No-op. No error thrown. No warning necessary (this is a normal case when cleaning up on state transition).

### Scenario: Looping sound — double start
- **Given:** `playLoop(SoundId.FireAmbient)` called twice in succession without a stop.
- **Why this matters:** If each call creates a new Howl instance without stopping the previous one, two instances play simultaneously, doubling the volume and creating an echo.
- **Expected behavior:** The second call is a no-op (the loop is already playing). Only one Howl instance exists and plays. Alternatively, the manager checks `isPlaying` before starting.

### Scenario: Howler.js context suspension (browser autoplay policy)
- **Given:** The page loads and `play()` is called before the user has interacted with the page.
- **Why this matters:** Modern browsers block audio playback until a user gesture. If the manager does not handle Howler's `ctx.state === 'suspended'` case, all play calls silently fail and no audio ever plays even after interaction.
- **Expected behavior:** The manager either (a) queues play requests until the AudioContext is resumed, or (b) calls `Howler.ctx.resume()` on the first user interaction. After the context is active, sounds play normally.

### Scenario: Sound loading failure — corrupt or missing audio file
- **Given:** `manifest[DoorOpen].path` points to a file that does not exist or is corrupted.
- **Why this matters:** Howler fires an `onloaderror` event. If the manager does not handle this, subsequent `play(DoorOpen)` calls either throw or silently do nothing with no diagnostic info.
- **Expected behavior:** The manager logs a warning on load error identifying the SoundId and path. Subsequent `play(DoorOpen)` calls are no-ops (the sound is marked as failed). Other sounds are not affected.

### Scenario: Destroy/cleanup on game end
- **Given:** Player returns to MainMenu from Death screen. The game world is destroyed.
- **Why this matters:** If the manager retains references to Howl instances from the previous run, memory leaks accumulate. After 5+ runs, dozens of orphaned Howl objects may exist.
- **Expected behavior:** The manager exposes a `dispose()` or `stopAll()` method. When called, all playing sounds stop, all Howl instances are unloaded, and internal pools are cleared.

### Scenario: Settings store volume = 0 suppresses all audio
- **Given:** `masterVolume = 0`, `sfxVolume = 1.0`.
- **Why this matters:** If the volume calculation skips the multiply and uses `sfxVolume` alone, sounds still play at the manifest volume despite the master being muted.
- **Expected behavior:** All sounds play at volume 0.0. Howl instances are still created (so unmuting later works instantly) but produce no audible output.

## Edge Cases
- `masterVolume = 1.0`, `sfxVolume = 1.0`, `manifest.volume = 1.0`: effective volume is exactly 1.0 — no clipping above 1.0.
- `manifest.volume = 0`: the sound is intentionally silent in the manifest (placeholder). Must not error.
- Multiple looping sounds playing simultaneously (Fire + Water): each has independent volume and stop control.
- `play()` called thousands of times per second (stress test): the manager must not leak memory or crash. Old instances should be reclaimed.
- Sound manifest is an empty object `{}`: the manager initializes with zero sounds. All play calls are no-ops with warnings.

## Interaction Concerns / Integration Warnings
- **AudioEventSystem (TEMP-048) dependency:** AudioEventSystem calls `audioManager.play()`. If the manager's API signature differs from what AudioEventSystem expects (e.g., `play(soundId, position?)` vs `play({soundId, position})`), all audio silently fails.
- **Settings store reactivity:** The manager must subscribe to `settingsStore` changes for `masterVolume` and `sfxVolume`. If it reads settings only at construction time, volume sliders have no effect until page reload.
- **Howler.js version:** The manager must be tested against the specific Howler.js version in package.json. Howler's API has breaking changes between major versions (e.g., `Howl.volume()` getter/setter behavior).
- **Memory:** Each Howl instance holds decoded audio data in memory. Loading all ~37 SoundId entries at init is fine for short clips but could be problematic if any entries are long-duration tracks. Verify total audio memory budget.
- **Re-export requirement:** The ticket requires creating `src/audio/sounds.ts` that re-exports `SoundId` from `src/ecs/components.ts`. This file must exist and export the correct type.
