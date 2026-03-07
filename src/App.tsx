import { useEffect } from 'react'
import { Crosshair } from './ui/Crosshair'
import { PauseOverlay } from './ui/PauseOverlay'
import { getAudioManager } from './audio/audioManager'

export function App() {
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
      Gungeon
      <Crosshair />
      <PauseOverlay />
    </div>
  )
}
