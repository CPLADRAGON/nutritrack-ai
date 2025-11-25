import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Fix: Declare process manually as @types/node might be missing in the environment
declare const process: { env: Record<string, string | undefined> };

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 1. Load env from .env file (if developing locally)
  const env = loadEnv(mode, '.', '');

  // 2. Prioritize the Environment Variable from the System (GitHub Actions)
  const apiKey = process.env.API_KEY || env.API_KEY;
  const clientId = process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID;

  return {
    plugins: [react()],
    define: {
      // Inject the keys into the code during build
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(clientId)
    },
    // Use relative paths so the app works on any domain/subdirectory
    base: './',
    build: {
      outDir: 'dist',
    }
  }
})