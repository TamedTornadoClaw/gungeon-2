# Test Spec: TEMP-065 — Wire UI to app state machine

## Properties (must ALWAYS hold)
- For every value of AppState, exactly one correct component tree is rendered. No state renders an empty tree or the wrong component.
- The Three.js canvas is mounted (present in the DOM) only during gameplay-related states: Gameplay, Paused, GunComparison, GunUpgrade, ForcedUpgrade, ShopBrowse.
- The Three.js canvas is unmounted (absent from the DOM) during: Loading, MainMenu, WeaponSelect, Death, Victory, Settings.
- Invalid state transitions throw an error. The UI never silently swallows a bad transition.
- The `transition()` function enforces the transition map. No component can bypass it by setting `currentState` directly.
- When the game loop is frozen (Paused, overlays), the canvas displays the last rendered frame — not a black screen, not a stale buffer from a previous run.
- Settings always returns to `previousState`, never to an arbitrary state.

## Scenarios

### Scenario: Full happy path — Loading through Death
- **Given:** App starts in Loading state.
- **When:** Assets finish loading. User clicks New Game. User selects Assault Rifle. Player dies in Gameplay. User clicks Return to Menu.
- **Then:** State transitions: Loading -> MainMenu -> WeaponSelect -> Gameplay -> Death -> MainMenu. Each state renders the correct component. Game loop starts on Gameplay entry, stops on Death transition.
- **Why:** End-to-end flow validation. Catches any broken link in the chain.

### Scenario: Full happy path — Victory
- **Given:** Player reaches boss floor and kills the boss.
- **When:** DeathSystem detects boss with BossTag at health <= 0.
- **Then:** State transitions to Victory. VictoryScreen renders. Game loop stops. Run stats are displayed.
- **Why:** Victory is a less-tested path than Death. If the transition is missing, killing the boss does nothing.

### Scenario: Correct component tree per state
- **Given:** The app is running.
- **When:** Each AppState value is set as currentState (via valid transitions).
- **Then:** The following component trees are rendered:
  - Loading: `<LoadingScreen />`
  - MainMenu: `<MainMenu />`
  - WeaponSelect: `<WeaponSelect />`
  - Gameplay: `<ThreeCanvas />` + `<GameplayHUD />`
  - Paused: `<ThreeCanvas />` (frozen) + `<GameplayHUD />` (frozen) + `<PauseOverlay />`
  - GunComparison: `<ThreeCanvas />` (frozen) + `<GunComparisonScreen />`
  - GunUpgrade: `<ThreeCanvas />` (frozen) + `<GunUpgradeMenu />`
  - ForcedUpgrade: `<ThreeCanvas />` (frozen) + `<ForcedUpgradeScreen />`
  - ShopBrowse: `<ThreeCanvas />` (frozen) + `<ShopUI />`
  - Death: `<DeathScreen />`
  - Victory: `<VictoryScreen />`
  - Settings: `<SettingsScreen />`
- **Why:** A missing overlay means the player cannot interact with the pause menu, shop, etc. A missing canvas during overlays means the player loses visual context.

### Scenario: Canvas mounted/unmounted correctly
- **Given:** App is in MainMenu (no canvas).
- **When:** User navigates to WeaponSelect -> Gameplay.
- **Then:** Canvas is NOT mounted during WeaponSelect. Canvas IS mounted when entering Gameplay.
- **When:** User pauses (Gameplay -> Paused) then quits to menu (Paused -> MainMenu).
- **Then:** Canvas remains mounted during Paused. Canvas is unmounted on MainMenu entry.
- **Why:** Mounting canvas during WeaponSelect wastes GPU resources. Unmounting during Paused destroys the frozen scene. Not unmounting on MainMenu leaks the WebGL context.

### Scenario: Game loop lifecycle across transitions
- **Given:** App is in WeaponSelect. User selects a weapon.
- **When:** Transition to Gameplay occurs.
- **Then:** Game world is initialized (dungeon generated, player spawned). Game loop starts. Systems execute.
- **When:** Transition to Paused occurs.
- **Then:** Game loop freezes. Zero simulation steps. Render loop continues.
- **When:** Transition back to Gameplay.
- **Then:** Game loop resumes. Simulation steps resume from where they left off (no catch-up for paused time).
- **When:** Transition to Death occurs.
- **Then:** Game loop stops entirely.
- **Why:** Each transition has different loop lifecycle semantics. Getting any one wrong causes freezes, time skips, or ghost loops.

### Scenario: Invalid transition rejected
- **Given:** App is in MainMenu.
- **When:** Code attempts transition to Gameplay (skipping WeaponSelect).
- **Then:** transition() throws an error with message indicating "MainMenu -> Gameplay" is invalid.
- **Why:** If invalid transitions are silent, bugs in UI code cause impossible state combinations (e.g., Gameplay with no selected weapon).

### Scenario: Settings returns to correct previous state
- **Given:** App is in Paused. User opens Settings.
- **When:** User clicks Back in Settings.
- **Then:** State transitions to Paused (the previousState), NOT to MainMenu.
- **Why:** If Settings always returns to MainMenu, opening settings during gameplay destroys the run.

### Scenario: Settings from MainMenu returns to MainMenu
- **Given:** App is in MainMenu. User opens Settings.
- **When:** User clicks Back in Settings.
- **Then:** State transitions to MainMenu.
- **Why:** Validates that previousState is correctly stored per entry, not hardcoded.

### Scenario: Settings rejects transition to non-previous state
- **Given:** App entered Settings from Paused (previousState = Paused).
- **When:** Code attempts transition from Settings to MainMenu.
- **Then:** transition() throws an error because MainMenu != previousState (Paused).
- **Why:** Prevents Settings from being used as a backdoor to skip states.

### Scenario: HUD reads ECS data via Zustand
- **Given:** App is in Gameplay. Player has health=75/100, sidearm with currentAmmo=5/12.
- **When:** DamageSystem reduces player health to 50.
- **Then:** The GameplayHUD health bar updates to reflect 50/100. The update happens within the same render cycle (not delayed by one frame).
- **Why:** If the HUD reads directly from ECS without Zustand sync, React never re-renders. If sync is delayed, the HUD shows stale health during critical moments.

### Scenario: HUD ammo counter updates on fire
- **Given:** Player fires sidearm. currentAmmo goes from 12 to 11.
- **When:** The next render frame occurs.
- **Then:** The ammo counter in GameplayHUD shows 11/12.
- **Why:** Stale ammo display causes the player to miscount shots and not reload in time.

### Scenario: Overlay states show frozen canvas underneath
- **Given:** App is in Gameplay. Player is mid-combat with enemies visible. A gun pickup triggers GunComparison.
- **When:** GunComparisonScreen renders.
- **Then:** The Three.js canvas remains visible behind the overlay, showing the frozen game scene. Enemies, bullets, and the player are visible at their last positions.
- **Why:** A black background behind overlays removes spatial context. The player forgets where they are in the dungeon.

### Scenario: Pause triggered by input
- **Given:** App is in Gameplay. Player presses the pause key.
- **When:** InputSystem sets input.pause=true. PlayerControlSystem reads it.
- **Then:** AppState transitions to Paused. PauseOverlay renders. Game loop freezes.
- **Why:** If the pause input is not wired through to the state machine, the pause key does nothing.

### Scenario: ForcedUpgrade triggered by GunXPSystem
- **Given:** App is in Gameplay. Player's gun accumulates XP >= the max trait upgrade cost.
- **When:** GunXPSystem detects the threshold and sets forcedUpgradeTriggered=true.
- **Then:** AppState transitions to ForcedUpgrade. ForcedUpgradeScreen renders with the correct gun's data. Game loop freezes.
- **Why:** If the ForcedUpgrade trigger is not wired, the player accumulates infinite XP without upgrading, breaking the progression curve.

### Scenario: ForcedUpgrade requires spending before dismiss
- **Given:** App is in ForcedUpgrade.
- **When:** User attempts to close without spending any XP.
- **Then:** The close button is disabled or not visible. The user must spend at least one upgrade.
- **When:** User spends one upgrade.
- **Then:** The close button becomes enabled. User can transition back to Gameplay.
- **Why:** ForcedUpgrade exists to prevent XP hoarding. If dismissible without spending, it fails its purpose.

### Scenario: GunComparison swap updates player weapon
- **Given:** App is in GunComparison. Player has Pistol in sidearm slot. Found gun is also a Sidearm category gun.
- **When:** User clicks Swap.
- **Then:** Player's sidearm slot now references the new gun entity. The old gun entity is removed. AudioEvent(GunSwapConfirm) is emitted. State transitions to Gameplay. Game loop resumes.
- **Why:** If the swap logic doesn't update the player component, the player still holds the old gun despite the UI saying otherwise.

### Scenario: Death screen shows run stats
- **Given:** Player dies after killing 15 enemies on depth 3, surviving 120 seconds, using Pistol and AssaultRifle, leveling 4 traits.
- **When:** DeathScreen renders.
- **Then:** RunStats display: kills=15, depthReached=3, timeSurvived=120, gunsUsed=[Pistol, AssaultRifle], traitsLeveled=4.
- **Why:** If run stats are not recorded on Gameplay exit (before world destruction), they are lost.

### Scenario: MainMenu entry clears game state
- **Given:** App transitions to MainMenu from Death.
- **When:** MainMenu renders.
- **Then:** Game world is destroyed. Zustand game state slice is reset (selectedLongArm=null, comparisonGunEntityId=null, etc.). Starting a new game begins from a clean state.
- **Why:** Leftover state from a previous run causes ghost entities, incorrect initial stats, or crashes on re-initialization.

## Edge Cases
- Rapid state transitions: Gameplay -> Paused -> Gameplay -> Paused in quick succession. Each freeze/resume must pair correctly. No accumulated time leak.
- Transition to Settings from Paused, then back to Paused, then resume to Gameplay. Three transitions, each must work correctly.
- ShopBrowse entered when shop has zero unpurchased items (all sold=true). The UI must render an empty shop, not crash.
- GunComparison entered with a LongArm pickup when the player already has the same GunType. The comparison still shows both guns (they may have different trait levels in post-v1).
- Multiple overlay transitions without returning to Gameplay (e.g., GunComparison -> Gameplay -> ForcedUpgrade in the same frame if XP threshold is met on gun swap). Each must freeze/resume correctly.
- The Loading state auto-transitions to MainMenu. If asset loading fails, the app must not silently sit on the loading screen forever — it should display an error.

## Integration Warnings
- The Zustand store must be the single source of truth for currentState. React components must subscribe to `currentState` and conditionally render. Direct DOM manipulation to show/hide components will desync from the store.
- The game loop freeze/resume must be called from state transition effects, not from React component mount/unmount lifecycle. Component lifecycle timing is unpredictable (React batching, Suspense) and may cause the loop to freeze after one extra simulation step.
- The Three.js renderer must not be initialized until the canvas is mounted. Attempting to create a WebGLRenderer with no canvas element causes a crash.
- Run stats (kills, depth, time) must be synced from ECS to Zustand during Gameplay, not computed on Death entry. By the time Death state is entered, the world may already be partially destroyed.
