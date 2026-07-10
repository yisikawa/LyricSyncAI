import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const lanHost = env.VITE_LAN_HOST || '192.168.111.10'
  return {
    plugins: [
      react(),
      mkcert({
        hosts: ['localhost', lanHost],
      }),
    ],
    server: {
      https: {},
      host: true,
      port: 5150,
    },
  }
})
