import { AppState } from './ecs/components'
import type { GameLoop } from './gameloop/gameLoop'
import type { GameSession } from './gameSession'

export const CANVAS_STATES: ReadonlySet<AppState> = new Set([
  AppState.Gameplay,
  AppState.Paused,
  AppState.GunComparison,
  AppState.GunUpgrade,
  AppState.ForcedUpgrade,
  AppState.ShopBrowse,
])

export const FROZEN_STATES: ReadonlySet<AppState> = new Set([
  AppState.Paused,
  AppState.GunComparison,
  AppState.GunUpgrade,
  AppState.ForcedUpgrade,
  AppState.ShopBrowse,
])

// Module-level game loop reference for synchronous lifecycle management.
let activeGameLoop: GameLoop | null = null
let activeSession: GameSession | null = null

export function setActiveGameLoop(loop: GameLoop | null): void {
  activeGameLoop = loop
}

export function getActiveGameLoop(): GameLoop | null {
  return activeGameLoop
}

export function getActiveSession(): GameSession | null {
  return activeSession
}

export function setActiveSession(session: GameSession | null): void {
  activeSession = session
}

export function clearActiveSession(): void {
  activeGameLoop = null
  activeSession = null
}
