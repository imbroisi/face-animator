import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exportMovPlugin } from './server/exportMov.ts'

export default defineConfig({
  plugins: [react(), exportMovPlugin()],
})
