import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on the mode (development, production)
  // process.cwd() gives the project root directory
  const env = loadEnv(mode, process.cwd(), ''); 

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy requests starting with /api/vision
        '/api/vision': {
          target: env.VITE_AZURE_COMPUTER_VISION_ENDPOINT, // Target the Azure endpoint from env var
          changeOrigin: true, // Needed for virtual hosted sites & CORS
          rewrite: (path) => path.replace(/^\/api\/vision/, ''), // Remove /api/vision prefix
          configure: (proxy, options) => {
            // Optional: Add headers if needed, though API key should be added by client
            // proxy.on('proxyReq', (proxyReq, req, res) => {
            //   console.log('Proxying request to:', options.target + proxyReq.path);
            // });
          },
        },
         // Optional: Add proxies for Translator and TTS if they also face CORS issues
         // '/api/translator': {
         //   target: env.VITE_AZURE_TRANSLATOR_ENDPOINT, 
         //   changeOrigin: true,
         //   rewrite: (path) => path.replace(/^\/api\/translator/, ''),
         // },
         // '/api/tts': {
         //   target: env.VITE_AZURE_TTS_ENDPOINT,
         //   changeOrigin: true,
         //   rewrite: (path) => path.replace(/^\/api\/tts/, ''), 
         // }
      }
    }
  }
})
