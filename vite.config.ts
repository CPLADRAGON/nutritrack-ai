import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const apiKey = process.env.VITE_API_KEY || env.VITE_API_KEY || process.env.API_KEY || env.API_KEY || '';
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || '';

  return {
    plugins: [react()],
    define: {
      'process.env.VITE_API_KEY': JSON.stringify(apiKey),
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(clientId)
    },
    base: './',
    build: {
      outDir: 'dist',
    }
  }
})