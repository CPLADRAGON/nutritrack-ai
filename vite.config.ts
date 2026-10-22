import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const apiKey = process.env.VITE_API_KEY || env.VITE_API_KEY || process.env.API_KEY || env.API_KEY || '';

  return {
    plugins: [react()],
    define: {
      'process.env.VITE_API_KEY': JSON.stringify(apiKey)
    },
    base: './',
    build: {
      outDir: 'dist',
    }
  }
})