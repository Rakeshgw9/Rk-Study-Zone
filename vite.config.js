import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the build works on any host / sub-folder
export default defineConfig({
  plugins: [react()],
  base: './',
})
