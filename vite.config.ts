import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 1. Load env from .env file (if developing locally)
  const env = loadEnv(mode, '.', '');
  
  // 2. Prioritize the Environment Variable from the System (GitHub Actions)
  // If process.env.API_KEY is set (by CI), use it. Otherwise use the one from .env file.
  const apiKey = process.env.API_KEY || env.API_KEY;

  return {
    plugins: [react()],
    define: {
      // Inject the key into the code during build
      'process.env.API_KEY': JSON.stringify(apiKey)
    },
    // Use relative paths so the app works on any domain/subdirectory (e.g. /repo-name/)
    base: './', 
    build: {
      outDir: 'dist',
    }
  }
})