import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * Force full page reload for non-React game logic modules.
 * HMR can't safely hot-swap modules captured in closures by
 * the running game loop, renderer, or ECS world.
 */
function gameReloadPlugin(): Plugin {
  return {
    name: 'game-full-reload',
    handleHotUpdate({ file, server }) {
      // React components (.tsx) are handled by Fast Refresh — let them through
      if (file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.json')) {
        return
      }
      // All .ts game logic files: force full page reload
      if (file.endsWith('.ts')) {
        server.ws.send({ type: 'full-reload' })
        return []
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gameReloadPlugin()],
})
