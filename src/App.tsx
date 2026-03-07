import { useEffect } from 'react'
import { Crosshair } from './ui/Crosshair'
import { MainMenu } from './ui/MainMenu'
import { PauseOverlay } from './ui/PauseOverlay'
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
      {currentState === AppState.MainMenu && <MainMenu />}
      {currentState === AppState.Gameplay && <Crosshair />}
      <PauseOverlay />
    </div>
  )
}
