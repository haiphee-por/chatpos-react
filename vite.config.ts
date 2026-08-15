import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { chatposDbPlugin } from './vite-plugin-db.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), chatposDbPlugin()],
  server: {
    proxy: {
      // Direct all other /api endpoints that are not /api/db to the remote server
      '^/api/(?!db)': {
        target: 'https://chatpos.biz',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
