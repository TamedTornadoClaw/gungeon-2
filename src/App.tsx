import { useEffect, useRef } from 'react'
import { Crosshair } from './ui/Crosshair'
import { DeathScreen } from './ui/DeathScreen'
import { ForcedUpgradeScreen } from './ui/ForcedUpgradeScreen'
import { GameplayHUD } from './ui/GameplayHUD'
import { GunComparisonScreen } from './ui/GunComparisonScreen'
import { GunUpgradeMenu } from './ui/GunUpgradeMenu'
import { LoadingScreen } from './ui/LoadingScreen'
import { MainMenu } from './ui/MainMenu'
import { PauseOverlay } from './ui/PauseOverlay'
import { SettingsScreen } from './ui/SettingsScreen'
import { ShopUI } from './ui/ShopUI'
import { VictoryScreen } from './ui/VictoryScreen'
import { WeaponSelect } from './ui/WeaponSelect'
import { getAudioManager } from './audio/audioManager'
import { AppState } from './ecs/components'
import { useAppStore } from './store/appStore'
import { createGameSession } from './gameSession'
import {
  CANVAS_STATES,
  FROZEN_STATES,
  getActiveGameLoop,
  setActiveGameLoop,
  getActiveSession,
  setActiveSession,
} from './appState'

export function App() {
  const currentState = useAppStore((s) => s.currentState)
  const showCanvas = CANVAS_STATES.has(currentState)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const manager = getAudioManager()
    const resume = () => manager.resumeContext()
    document.addEventListener('click', resume, { once: true })
    document.addEventListener('keydown', resume, { once: true })
    return () => {
      document.removeEventListener('click', resume)
      document.removeEventListener('keydown', resume)
    }
  }, [])

  // Synchronous game loop lifecycle via Zustand subscribe.
  // freeze/resume/stop are called immediately on state change,
  // before React re-renders, to prevent extra simulation steps.
  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prevState) => {
      const current = state.currentState
      const prev = prevState.currentState
      if (current === prev) return

      const loop = getActiveGameLoop()

      if (current === AppState.Gameplay) {
        loop?.resume()
        // Re-lock pointer when resuming gameplay (e.g. from Paused)
        if (prev !== undefined) {
          getActiveSession()?.inputManager.requestPointerLock()
        }
      } else if (FROZEN_STATES.has(current)) {
        loop?.freeze()
        getActiveSession()?.inputManager.exitPointerLock()
      } else if (current === AppState.MainMenu) {
        loop?.stop()
        getActiveSession()?.cleanup()
        setActiveGameLoop(null)
        setActiveSession(null)
      } else if (current === AppState.Death || current === AppState.Victory) {
        loop?.stop()
        getActiveSession()?.inputManager.exitPointerLock()
        setActiveGameLoop(null)
      }
    })
    return unsub
  }, [])

  // Game session creation (needs DOM for canvas container).
  // Runs after React renders the canvas div.
  useEffect(() => {
    if (currentState === AppState.Gameplay && !getActiveGameLoop() && canvasRef.current) {
      const session = createGameSession(canvasRef.current)
      setActiveSession(session)
      setActiveGameLoop(session.gameLoop)
      session.gameLoop.start()
    }
  }, [currentState])

  return (
    <div id="app">
      {currentState === AppState.Loading && <LoadingScreen />}
      {currentState === AppState.MainMenu && <MainMenu />}
      {currentState === AppState.WeaponSelect && <WeaponSelect />}
      {showCanvas && <div id="three-canvas" data-testid="three-canvas" ref={canvasRef} />}
      {(currentState === AppState.Gameplay || currentState === AppState.Paused) && <GameplayHUD />}
      {currentState === AppState.Gameplay && <Crosshair />}
      {currentState === AppState.Paused && <PauseOverlay />}
      {currentState === AppState.GunComparison && <GunComparisonScreen />}
      {currentState === AppState.GunUpgrade && <GunUpgradeMenu />}
      {currentState === AppState.ForcedUpgrade && <ForcedUpgradeScreen />}
      {currentState === AppState.ShopBrowse && <ShopUI />}
      {currentState === AppState.Death && <DeathScreen />}
      {currentState === AppState.Victory && <VictoryScreen />}
      {currentState === AppState.Settings && <SettingsScreen />}
    </div>
  )
}
