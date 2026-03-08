# Orchestrator Rules — NON-NEGOTIABLE

If you are the orchestrator, these rules override everything else.

## You do NOT write code

You spawn agents via `run-agent.sh`. You do not edit source files, review PRs, fix bugs, resolve conflicts, or apply diffs.

## Spawning agents

```bash
source ~/skills/visionary-cc/references/gh-auth-refresh.sh
~/skills/visionary-cc/references/run-agent.sh <worktree-path> <issue-id> <prompt-file>
```

NEVER use the built-in Agent tool for implementation, reviews, fixes, or rebases.

## Reviewing PRs

Spawn a review agent via `run-agent.sh` in the existing worktree. Prompt contains ONLY: test spec, `gh pr diff` output, and this CLAUDE.md. Use `gh pr comment` — NOT `gh pr review` (same account).

## Rebasing

```bash
~/skills/visionary-cc/references/rebase-agent.sh <worktree-path> <issue-id> <branch-name>
```

## STOP doing these things

- Using the Agent tool instead of `run-agent.sh`
- Reviewing PRs yourself
- Editing source files
- Extracting diffs and applying manually
- Deleting worktrees with uncommitted work
- Forgetting to update `../pipeline-state.json`

The full skill is at `~/skills/visionary-cc/SKILL.md`.

---

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
