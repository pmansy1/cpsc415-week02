import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_OPENROUTER_API_KEY': JSON.stringify(
      process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '',
    ),
  },
})
