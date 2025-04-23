import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on the mode (development, production)
  // process.cwd() gives the project root directory
  const env = loadEnv(mode, process.cwd(), ''); 

  return {
    plugins: [react()]
    // The server.proxy configuration is removed as it's not needed for Vercel deployment
  }
})
