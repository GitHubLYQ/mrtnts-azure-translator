import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()]
  // The server.proxy configuration is removed as it's not needed for Vercel deployment
})
