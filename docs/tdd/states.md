# Application State Map

## Tech Context

Application state lives in a Zustand store. React renders the component tree for the current state. Transitions are validated — invalid transitions throw. State names are an enum.

## States

```
enum AppState {
  Loading,
  MainMenu,
  WeaponSelect,
  Gameplay,
  Paused,
  GunComparison,
  GunUpgrade,
  ForcedUpgrade,
  ShopBrowse,
  Death,
  Victory,
  Settings,
}
```

## Transition Map

```
Loading         → MainMenu
MainMenu        → WeaponSelect, Settings
WeaponSelect    → Gameplay, MainMenu
Gameplay        → Paused, GunComparison, GunUpgrade, ForcedUpgrade, ShopBrowse, Death, Victory
Paused          → Gameplay, Settings, MainMenu
GunComparison   → Gameplay
GunUpgrade      → Gameplay
ForcedUpgrade   → Gameplay
ShopBrowse      → Gameplay
Death           → MainMenu
Victory         → MainMenu
Settings        → (previousState only — see validation rule below)
```

**Settings transition validation:** `Settings → X` is only valid when `X === previousState`. The `transition()` function enforces this. This prevents invalid flows like `MainMenu → Settings → Paused`.

## State Definitions

### Loading

**Component tree:** `<LoadingScreen />`
- Shows loading indicator (text or spinner)

**Active systems:** None.

**Entry effects:** Load all JSON manifests (`design-params.json`, `sound-manifest.json`, `particle-manifest.json`). Pre-allocate placeholder assets (geometry, textures, generated audio). Initialize audio manager.

**Exit effects:** None.

**Transition:** Automatically transitions to `MainMenu` when all assets are loaded.

### MainMenu

**Component tree:** `<MainMenu />`
- New Game button → transition to `WeaponSelect`
- Continue button — **deferred/out of scope for v1.** The GDD mentions "Continue (if save exists)" but save/load is an open question (GDD Open Question 13). v1 has permadeath with no save system. The button is either hidden or shown as disabled in v1.
- Settings button → transition to `Settings`
- Quit button (Electron only, hidden in browser)

**Active systems:** None. No game loop running.

**Entry effects:** Stop game loop if running. Clear any existing game world state. Reset Zustand game state slice to defaults.

**Exit effects:** None.

### WeaponSelect

**Component tree:** `<WeaponSelect />`
- Displays 3 long arm options: Assault Rifle, SMG, Shotgun
- Each shows base stats and starting traits
- Click/select to choose → transition to `Gameplay`
- Back button → transition to `MainMenu`

**Active systems:** None.

**Entry effects:** None.

**Exit effects:** Store selected weapon in Zustand `selectedLongArm` field.

### Gameplay

**Component tree:** `<ThreeCanvas />` + `<GameplayHUD />`
- `<ThreeCanvas />` is the Three.js renderer (mounted only in gameplay-related states)
- `<GameplayHUD />` renders: health bar, armor bar (if > 0), shield bar (if > 0), active gun display, inactive gun display, ammo counter, upgrade available indicator, crosshair

**Active systems:** All game systems running in the fixed-timestep loop: Input, PlayerControl, DodgeRoll, AI, Projectile, EnemyWeapon, Movement, CollisionDetection, CollisionResponse, Damage, ShieldRegen, Hazard, Lifetime, Pickup, Chest, Shop, GunXP, Destructible, Door, Spawn, FloorTransition, Death, ExpireModifiers, Particle, AudioEvent. (GunStat runs on-demand after upgrades, not every frame.)

**Entry effects (from WeaponSelect):** Initialize game world — generate dungeon for depth 1, spawn player with pistol (sidearm) + selected long arm, place enemies per room layout, start game loop.

**Entry effects (from Paused/GunComparison/GunUpgrade/ForcedUpgrade):** Resume game loop (unfreeze timestep).

**Exit effects (to Paused/GunComparison/GunUpgrade/ForcedUpgrade):** Freeze game loop (timestep delta = 0, render loop continues for visual continuity).

**Exit effects (to Death):** Stop game loop. Record run stats (kills, depth, time, guns used).

**Exit effects (to Victory):** Stop game loop. Record run stats.

### Paused

**Component tree:** `<ThreeCanvas />` (frozen) + `<GameplayHUD />` (frozen) + `<PauseOverlay />`
- Resume button → transition to `Gameplay`
- Settings button → transition to `Settings`
- Quit to Menu button → transition to `MainMenu`

**Active systems:** None. Game loop frozen.

**Entry effects:** Freeze game loop.

**Exit effects (to Gameplay):** Resume game loop.

**Exit effects (to MainMenu):** Stop game loop. Destroy game world.

### GunComparison

**Component tree:** `<ThreeCanvas />` (frozen) + `<GunComparisonScreen />`
- Shows side-by-side: current gun in the matching slot vs. found gun
- Displays: name, icon, base stats (damage, fire rate, magazine size, reload time, spread), levelable traits, current trait levels (for equipped gun)
- Swap button → swap guns, transition to `Gameplay`
- Cancel button → transition to `Gameplay`

**Active systems:** None. Game loop frozen.

**Entry effects:** Freeze game loop. Store `comparisonGunEntityId` (the found gun entity) in Zustand. Determine `comparisonSlot` from the found gun's `GunCategory` — if the gun is a `Sidearm`, compare against the player's sidearm slot; if `LongArm`, compare against the long arm slot.

**Exit effects:** If swapped: update player's weapon slot component, remove old gun entity, transfer found gun to player, emit AudioEvent(GunSwapConfirm). Clear comparison state. Resume game loop.

### GunUpgrade

**Component tree:** `<ThreeCanvas />` (frozen) + `<GunUpgradeMenu />`
- Shows current gun's XP pool, 3 traits with current levels and upgrade costs
- Click a trait to spend XP and level it up
- Close button → transition to `Gameplay`

**Active systems:** None. Game loop frozen.

**Entry effects:** Freeze game loop.

**Exit effects:** Resume game loop.

### ForcedUpgrade

**Component tree:** `<ThreeCanvas />` (frozen) + `<ForcedUpgradeScreen />`
- Same layout as GunUpgrade but cannot be dismissed without spending at least one upgrade
- Triggered automatically when gun XP >= most expensive trait upgrade cost
- After spending, close button appears → transition to `Gameplay`

**Active systems:** None. Game loop frozen.

**Entry effects:** Freeze game loop. Identify which gun triggered forced upgrade, store `forcedUpgradeGunSlot` in Zustand.

**Exit effects:** Resume game loop.

### ShopBrowse

**Component tree:** `<ThreeCanvas />` (frozen) + `<ShopUI />`
- Shows shop inventory: items with prices
- Click an item to purchase (if player has enough currency)
- Close button → transition to `Gameplay`

**Active systems:** None. Game loop frozen.

**Entry effects:** Freeze game loop. Store `activeShopEntityId` in Zustand (the shop the player interacted with).

**Exit effects:** Resume game loop. Clear `activeShopEntityId`.

### Death

**Component tree:** `<DeathScreen />`
- Shows run stats: kills, depth reached, time survived, guns used, traits leveled
- Restart button → transition to `MainMenu`

**Active systems:** None.

**Entry effects:** None (stats already recorded on exit from Gameplay).

**Exit effects:** Destroy game world. Clear all game state.

### Victory

**Component tree:** `<VictoryScreen />`
- Shows run stats (same as Death but with victory message)
- Return to Menu button → transition to `MainMenu`

**Active systems:** None.

**Entry effects:** None.

**Exit effects:** Destroy game world. Clear all game state.

### Settings

**Component tree:** `<SettingsScreen />`
- Volume controls (master, SFX)
- Input sensitivity (mouse sensitivity)
- Graphics options (if applicable)
- Back button → transition to `previousState`

**Active systems:** None.

**Entry effects:** Store `previousState` in Zustand (either `MainMenu` or `Paused`) so Back returns to the right place.

**Exit effects:** Persist settings to localStorage.

## Zustand Store Shape

```typescript
// App state machine — src/store/appStore.ts
interface AppStore {
  // State machine
  currentState: AppState;
  previousState: AppState | null;
  transition: (to: AppState) => void;

  // Per-state data
  selectedLongArm: GunType | null;
  comparisonGunEntityId: EntityId | null;
  comparisonSlot: WeaponSlot | null;
  forcedUpgradeGunSlot: WeaponSlot | null;
  activeShopEntityId: EntityId | null;
  runStats: RunStats | null;
}

interface RunStats {
  kills: number;           // incremented by DeathSystem on enemy death
  depthReached: number;    // tracked by FloorTransitionSystem
  timeSurvived: number;    // tracked by game loop (accumulated dt)
  gunsUsed: GunType[];     // tracked on weapon pickup/swap
  traitsLeveled: number;   // incremented on each trait upgrade
}

// Settings — src/store/settingsStore.ts (separate store, persisted to localStorage)
interface SettingsStore {
  masterVolume: number;
  sfxVolume: number;
  mouseSensitivity: number;
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMouseSensitivity: (v: number) => void;
}
```

The `transition()` action validates against the transition map. Invalid transitions throw an error with the attempted `from → to` pair. For `Settings`, it additionally validates that the target equals `previousState`.
