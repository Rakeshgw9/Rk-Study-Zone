import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the build works on any host / sub-folder
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // Split big third-party libraries into long-lived chunks: faster first load, better browser caching.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'vendor-firebase'
          if (id.includes('/@codemirror/') || id.includes('/@uiw/') || id.includes('/@lezer/')) return 'vendor-editor'
          if (id.includes('/react-router') || id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react'
          return undefined
        },
      },
    },
  },
})
