import { useEffect } from 'react'
import { Crosshair } from './ui/Crosshair'
import { DeathScreen } from './ui/DeathScreen'
import { GameplayHUD } from './ui/GameplayHUD'
import { LoadingScreen } from './ui/LoadingScreen'
import { MainMenu } from './ui/MainMenu'
import { PauseOverlay } from './ui/PauseOverlay'
import { VictoryScreen } from './ui/VictoryScreen'
import { WeaponSelect } from './ui/WeaponSelect'
import { getAudioManager } from './audio/audioManager'
import { AppState } from './ecs/components'
import { useAppStore } from './store/appStore'

export function App() {
  const currentState = useAppStore((s) => s.currentState)

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

  return (
    <div id="app">
      <LoadingScreen />
      {currentState === AppState.MainMenu && <MainMenu />}
      {currentState === AppState.WeaponSelect && <WeaponSelect />}
      {currentState === AppState.Gameplay && <GameplayHUD />}
      {currentState === AppState.Gameplay && <Crosshair />}
      {currentState === AppState.Victory && <VictoryScreen />}
      <PauseOverlay />
      <DeathScreen />
    </div>
  )
}
