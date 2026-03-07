# Test Spec: TEMP-010 — App State Machine

## Properties (must ALWAYS hold)
- Exactly 12 states exist in the AppState enum: Loading, MainMenu, WeaponSelect, Gameplay, Paused, GunComparison, GunUpgrade, ForcedUpgrade, ShopBrowse, Death, Victory, Settings.
- `transition(to)` succeeds if and only if `to` is in the valid transition set for `currentState` (per the transition map).
- `transition(to)` throws an error containing the string representation of `from` and `to` for any transition not in the map.
- `Settings -> X` is valid if and only if `X === previousState`. No other target is accepted from Settings.
- After every successful `transition(to)`, `currentState === to` and `previousState` equals the state that was current before the transition.
- `previousState` is `null` on initial store creation (before any transitions).
- The store shape includes all per-state data fields: `selectedLongArm`, `comparisonGunEntityId`, `comparisonSlot`, `forcedUpgradeGunSlot`, `activeShopEntityId`, `runStats`.
- `RunStats` interface has exactly the fields: `kills`, `depthReached`, `timeSurvived`, `gunsUsed`, `traitsLeveled`.
- `transition()` is synchronous — state is updated before the function returns.

## Adversarial Test Cases / Scenarios

### Scenario: Every valid transition succeeds
- **Given:** The complete transition map from states.md.
- **Why this matters:** If even one valid transition is missing from the implementation's map, an entire user flow breaks (e.g., player cannot pause, or cannot open shop).
- **Expected behavior:** For each of the following transitions, `transition(to)` succeeds and `currentState` updates:
  - Loading -> MainMenu
  - MainMenu -> WeaponSelect, MainMenu -> Settings
  - WeaponSelect -> Gameplay, WeaponSelect -> MainMenu
  - Gameplay -> Paused, Gameplay -> GunComparison, Gameplay -> GunUpgrade, Gameplay -> ForcedUpgrade, Gameplay -> ShopBrowse, Gameplay -> Death, Gameplay -> Victory
  - Paused -> Gameplay, Paused -> Settings, Paused -> MainMenu
  - GunComparison -> Gameplay
  - GunUpgrade -> Gameplay
  - ForcedUpgrade -> Gameplay
  - ShopBrowse -> Gameplay
  - Death -> MainMenu
  - Victory -> MainMenu
  - Settings -> previousState (from MainMenu), Settings -> previousState (from Paused)

### Scenario: Every invalid transition throws
- **Given:** All state pairs NOT in the transition map.
- **Why this matters:** If invalid transitions silently succeed, the app reaches impossible states (e.g., Loading -> Victory, Death -> Gameplay) that crash rendering or corrupt game state.
- **Expected behavior:** Each of the following (non-exhaustive sample) throws:
  - Loading -> Gameplay, Loading -> Settings, Loading -> Death
  - MainMenu -> Gameplay, MainMenu -> Paused, MainMenu -> Death, MainMenu -> Victory
  - WeaponSelect -> Paused, WeaponSelect -> Death, WeaponSelect -> Settings
  - Gameplay -> MainMenu, Gameplay -> WeaponSelect, Gameplay -> Loading
  - GunComparison -> MainMenu, GunComparison -> Death, GunComparison -> Paused
  - Death -> Gameplay, Death -> Death, Death -> Victory
  - Victory -> Gameplay, Victory -> Victory, Victory -> Death
  - Settings -> Loading, Settings -> Gameplay, Settings -> Death

### Scenario: Settings -> non-previousState throws even if target is otherwise valid
- **Given:** MainMenu -> Settings (previousState = MainMenu). Then attempt Settings -> Paused.
- **Why this matters:** Paused is a valid state in the enum, but Settings must ONLY return to the state it came from. Without this check, the player can navigate MainMenu -> Settings -> Paused (skipping WeaponSelect and game initialization), leaving the game world uninitialized.
- **Expected behavior:** `transition(AppState.Paused)` throws with a message indicating the invalid transition. Only `transition(AppState.MainMenu)` succeeds.

### Scenario: Settings -> previousState with Paused as origin
- **Given:** Gameplay -> Paused -> Settings (previousState = Paused). Then Settings -> Paused.
- **Why this matters:** This is the second valid entry point to Settings. The system must correctly store and recall that previousState is Paused, not MainMenu (which was the state before Paused).
- **Expected behavior:** `transition(AppState.Paused)` succeeds. `currentState === Paused`. The game loop remains frozen (Paused state behavior is preserved).

### Scenario: previousState tracking through chained transitions
- **Given:** Loading -> MainMenu -> WeaponSelect -> Gameplay -> Paused.
- **Why this matters:** If `previousState` is not updated on every transition, it may be stale. For example, if it only updates on Settings entry, then `previousState` after Gameplay -> Paused would be wrong.
- **Expected behavior:** After each transition, `previousState` equals the state that was current immediately before: `null -> Loading -> MainMenu -> WeaponSelect -> Gameplay`.

### Scenario: Self-transition (same state)
- **Given:** `currentState = Gameplay`. Call `transition(AppState.Gameplay)`.
- **Why this matters:** Self-transitions are not in the transition map. If allowed, they could re-trigger entry effects (re-initializing the world, resetting the game loop) and destroy game state.
- **Expected behavior:** Throws. The transition map does not list any state as transitioning to itself.

### Scenario: Double transition in sequence — Gameplay -> Death -> MainMenu
- **Given:** Player dies. System calls `transition(Death)`, then UI calls `transition(MainMenu)`.
- **Why this matters:** If the first transition does not fully commit before the second is evaluated, race conditions or stale `currentState` checks cause the second transition to validate against the wrong source state.
- **Expected behavior:** After `transition(Death)`: `currentState === Death`, `previousState === Gameplay`. After `transition(MainMenu)`: `currentState === MainMenu`, `previousState === Death`. Both succeed, in order.

### Scenario: Initial state is Loading
- **Given:** Fresh store creation.
- **Why this matters:** If the initial state is undefined or defaults to MainMenu, the Loading screen is skipped and assets are not loaded.
- **Expected behavior:** `currentState === AppState.Loading`. `previousState === null`.

### Scenario: transition() error message format
- **Given:** `currentState = Death`. Call `transition(AppState.Gameplay)`.
- **Why this matters:** The acceptance criteria require the error message to contain the `from -> to` pair. Debugging is impossible without this information in logs.
- **Expected behavior:** The thrown error message contains both "Death" and "Gameplay" (or their enum equivalents). Example: `"Invalid transition: Death -> Gameplay"`.

### Scenario: Per-state data fields initialized to null
- **Given:** Fresh store creation.
- **Why this matters:** If fields like `comparisonGunEntityId` are initialized to `undefined` instead of `null`, strict equality checks (`=== null`) fail, and React conditional rendering behaves unexpectedly.
- **Expected behavior:** `selectedLongArm === null`, `comparisonGunEntityId === null`, `comparisonSlot === null`, `forcedUpgradeGunSlot === null`, `activeShopEntityId === null`, `runStats === null`.

### Scenario: Exhaustive invalid transition coverage for all 12 states
- **Given:** For each of the 12 states, compute the set of all 11 other states. Subtract the valid transitions. Attempt each remaining transition.
- **Why this matters:** Spot-checking a few invalid transitions is insufficient. A single missing entry in the validation map creates an exploitable hole.
- **Expected behavior:** Every transition in `allStates x allStates` minus the valid transition map throws. Total valid transitions: 22 (including the 2 Settings->previousState paths). Total possible transitions: 12*12 = 144. Total invalid: 144 - 22 - 12 (self-transitions, also invalid) = 110. All 122 non-valid pairs throw.

## Edge Cases
- `transition()` called with a value not in the AppState enum (e.g., `transition(999 as AppState)`): should throw.
- `transition()` called with `undefined` or `null`: should throw, not silently set `currentState` to undefined.
- Settings entered from MainMenu, then back to MainMenu, then MainMenu -> Settings again: `previousState` must correctly update to MainMenu again.
- Rapid sequential transitions (e.g., Gameplay -> Paused -> Gameplay -> Paused) must all succeed and update `previousState` correctly each time.

## Interaction Concerns / Integration Warnings
- **React re-renders:** Zustand store updates trigger React re-renders. If `transition()` sets `currentState` and `previousState` in separate `set()` calls, React may render an intermediate state where `currentState` is new but `previousState` is stale. Both must be set atomically in a single `set()` call.
- **Game loop coupling:** Gameplay entry/exit effects (start/stop game loop) are triggered by state transitions. If the store does not integrate with the game loop controller, transitions to/from Gameplay have no effect on simulation.
- **Settings persistence:** Settings exit effect persists to localStorage. If `transition()` does not trigger exit effects, settings changes are lost.
- **ForcedUpgrade auto-trigger:** GunXPSystem calls `transition(ForcedUpgrade)` during the game loop. If this throws because the current state is already ForcedUpgrade (self-transition), it crashes the game loop. The calling code must guard against redundant transitions.
