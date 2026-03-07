# Technical Design Document — Overview

## Game

**Gungeon** — Twin-stick roguelike dungeon crawler in the browser. Cell-shaded 3D.

## Tech Stack Preset

**browser-3d**

| Technology | Role |
|-----------|------|
| TypeScript | Primary language. Strict mode, no `any`, enum-driven identifiers. |
| Vite | Build tool and dev server. |
| Three.js | 3D rendering. Scene graph, meshes, instanced rendering, toon materials. |
| React | UI framework. HTML overlay for menus, HUD, overlays. |
| Zustand | State management. App state machine + shared game state. |
| Vitest | Test framework. Property-based testing with fast-check. |
| Howler.js | Audio. Sound effects with manifest-driven playback. |

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                   React App                      │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Zustand      │  │  React Component Trees   │ │
│  │  App Store    │  │  (per AppState)          │ │
│  │  - state FSM  │  │  - Loading               │ │
│  │  - game data  │  │  - MainMenu              │ │
│  │  - settings   │  │  - WeaponSelect          │ │
│  └──────┬───────┘  │  - GameplayHUD            │ │
│         │          │  - PauseOverlay           │ │
│         │          │  - GunComparison          │ │
│         │          │  - GunUpgrade             │ │
│         │          │  - ForcedUpgrade          │ │
│         │          │  - ShopBrowse             │ │
│         │          │  - DeathScreen            │ │
│         │          │  - VictoryScreen          │ │
│         │          │  - Settings               │ │
│         │          └──────────────────────────┘ │
└─────────┼───────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────┐
│   Game  │ Loop (fixed timestep 60Hz)            │
│         ▼                                        │
│  ┌─────────────┐                                │
│  │ ECS World   │  Entities + Components          │
│  └──────┬──────┘                                │
│         │                                        │
│  ┌──────▼──────────────────────────────────────┐│
│  │ Systems Pipeline                             ││
│  │ Input → PlayerControl → DodgeRoll → AI →     ││
│  │ EnemyWeapon → Movement → Collision →         ││
│  │ Response → Damage → Hazard → Projectile →   ││
│  │ Lifetime → Pickup → Chest → Shop →          ││
│  │ GunXP → Death → Spawn → FloorTransition →   ││
│  │ ExpireModifiers → Particle → Audio           ││
│  └──────┬──────────────────────────────────────┘│
│         │                                        │
│  ┌──────▼──────┐                                │
│  │ Render      │  Three.js (variable timestep)  │
│  │ System      │  Interpolated positions         │
│  └─────────────┘                                │
└─────────────────────────────────────────────────┘
```

## Module Structure

```
src/
├── main.tsx                    — App entry point, React root
├── App.tsx                     — Top-level React component, state-driven rendering
├── store/
│   ├── appStore.ts             — Zustand store: AppState FSM, transitions, per-state data
│   └── settingsStore.ts        — Zustand store: persisted settings (volume, sensitivity)
├── ecs/
│   ├── world.ts                — Entity storage, component maps, query functions
│   ├── components.ts           — All component interfaces and enums
│   └── factories.ts            — Entity factory functions (createPlayer, createEnemy, etc.)
├── systems/
│   ├── inputSystem.ts
│   ├── playerControlSystem.ts
│   ├── dodgeRollSystem.ts
│   ├── aiSystem.ts
│   ├── enemyWeaponSystem.ts
│   ├── movementSystem.ts
│   ├── collisionDetectionSystem.ts
│   ├── collisionResponseSystem.ts
│   ├── damageSystem.ts
│   ├── shieldRegenSystem.ts
│   ├── hazardSystem.ts
│   ├── projectileSystem.ts
│   ├── lifetimeSystem.ts
│   ├── pickupSystem.ts
│   ├── chestSystem.ts
│   ├── shopSystem.ts
│   ├── gunXPSystem.ts
│   ├── gunStatSystem.ts
│   ├── destructibleSystem.ts
│   ├── doorSystem.ts
│   ├── spawnSystem.ts
│   ├── floorTransitionSystem.ts
│   ├── deathSystem.ts
│   ├── expireModifiersSystem.ts
│   ├── particleSystem.ts
│   └── audioEventSystem.ts
├── gameloop/
│   ├── gameLoop.ts             — Fixed timestep loop, system orchestration
│   └── events.ts               — Event types and queue (DamageEvent, ParticleEvent, etc.)
├── input/
│   ├── inputManager.ts         — Raw input capture, keyboard/mouse/gamepad
│   └── inputMapping.ts         — Physical → logical action mapping (data-driven)
├── rendering/
│   ├── renderer.ts             — Three.js setup, render loop, interpolation
│   ├── sceneManager.ts         — Scene graph construction, object pool, MeshId mapping
│   ├── cameraController.ts     — Camera follow, smoothing, shake
│   ├── outlineMesh.ts          — Inverted-hull outline helper
│   ├── instancedRenderer.ts    — InstancedMesh management for bullets/enemies/pickups
│   ├── particleRenderer.ts     — Particle effect rendering
│   ├── damageNumbers.ts        — Floating damage number sprites
│   └── screenEffects.ts        — ScreenFX manager (shake, flash, vignette)
├── dungeon/
│   ├── generator.ts            — Procedural dungeon generation algorithm
│   ├── roomTemplates.ts        — Room shape templates
│   └── dungeonData.ts          — DungeonData types (rooms, corridors, spawn points)
├── audio/
│   ├── audioManager.ts         — Howler.js wrapper, sound manifest loader
│   └── sounds.ts               — SoundId enum (re-exported from components)
├── ui/
│   ├── LoadingScreen.tsx
│   ├── MainMenu.tsx
│   ├── WeaponSelect.tsx
│   ├── GameplayHUD.tsx
│   ├── PauseOverlay.tsx
│   ├── GunComparisonScreen.tsx
│   ├── GunUpgradeMenu.tsx
│   ├── ForcedUpgradeScreen.tsx
│   ├── DeathScreen.tsx
│   ├── VictoryScreen.tsx
│   ├── SettingsScreen.tsx
│   └── ShopUI.tsx
├── config/
│   └── designParams.ts         — Typed loader for design-params.json
└── types/
    └── index.ts                — Shared type definitions (Vec3, Vec2, EntityId, etc.)
```

## CLAUDE.md Specification

The scaffolding ticket generates this file in the repo root:

```markdown
# Gungeon

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build
- `npm test` — Run Vitest tests
- `npm run test:watch` — Run Vitest in watch mode
- `npm run lint` — Run ESLint
- `npm run typecheck` — Run tsc --noEmit

## Code Rules

- TypeScript strict mode. No `any` unless forced by third-party types.
- All categorical identifiers use enums or `as const` objects. Never raw string literals for state names, entity types, sound IDs, particle effects, mesh IDs, etc.
- Components are plain data objects (interfaces). No methods on components.
- Systems are pure functions: take entities + dt, modify component data. No side effects beyond component mutation and event emission.
- Design parameters come from `config/design-params.json` via the typed loader in `src/config/designParams.ts`. No magic numbers in source code.
- All sounds referenced by `SoundId` enum. All particles by `ParticleEffect` enum. All meshes by `MeshId` enum. All states by `AppState` enum.
- Application state transitions are validated. Invalid transitions throw.
- React components handle UI only. No game logic in React components.
- Three.js handles rendering only. The render system reads state, never modifies it.
- Game loop runs at fixed timestep (60Hz). Rendering runs at variable timestep with interpolation.
- Test files: `tests/<systemName>.test.ts`. Use Vitest + fast-check for property-based tests.
- All game enums are defined in `src/ecs/components.ts` and re-exported as needed. Import enums from `src/ecs/components.ts`, not from system files.
- The typed config loader (`src/config/designParams.ts`) validates all enum-like string values in JSON against their TypeScript enums at load time, throwing on mismatch.

## Project Structure

- `src/ecs/` — Entity storage, component definitions, factory functions
- `src/systems/` — All game systems (one file per system)
- `src/gameloop/` — Game loop orchestration and event queue
- `src/input/` — Input capture and mapping
- `src/rendering/` — Three.js renderer, scene management, effects
- `src/dungeon/` — Procedural generation
- `src/audio/` — Audio manager and sound definitions
- `src/ui/` — React components (one per screen/overlay)
- `src/store/` — Zustand stores
- `src/config/` — Design parameter loader
- `config/` — JSON config files (design-params, sound manifest, particle manifest)
- `tests/` — Vitest test files (`*.test.ts`)
- `test-specs/` — Adversarial test specifications
- `asset-specs/` — Asset validation specs (format, dimensions, etc.)

## Integration Rules

Every system you create must be imported and called from somewhere. If you build a collision system, show me where the game loop calls it every frame. If you build a gun system, show me where player input triggers it. A system that passes its unit tests but isn't wired into the game is not done. Your ticket is not complete until: the system is imported in the game loop or the appropriate parent system, the game compiles, the game runs, and you can observe your system's effect by playing. If your system depends on another system that doesn't exist yet, create a minimal stub interface and document the expected integration point. Do not build in isolation and assume someone else will connect it later — that someone doesn't exist.

## Ownership

If you encounter a problem during your work — a linting error, a broken import, a failing test, a missing file — you fix it. You do not determine whose fault it is. You do not explain that it's pre-existing. You do not scope your work to only the files in your ticket. If you see it and it's broken, it's yours. Do not run git stash, git blame, git log, or any other command to determine if an error predates your work. It does not matter. Fix it. The codebase must be better after your ticket than before it.
```
