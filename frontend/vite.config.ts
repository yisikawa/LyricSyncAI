import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [
    react(),
    mkcert({
      hosts: ['localhost', '192.168.111.10'],
    }),
  ],
  server: {
    https: {},
    host: '192.168.111.10',
    port: 5150,
  },
})
