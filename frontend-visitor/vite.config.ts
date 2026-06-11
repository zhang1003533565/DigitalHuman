import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // SSE 流式响应需要禁用缓冲
            if (req.url?.includes('/chat/stream')) {
              proxyRes.headers['cache-control'] = 'no-cache'
              proxyRes.headers['x-accel-buffering'] = 'no'
              delete proxyRes.headers['content-length']
              delete proxyRes.headers['content-encoding']
            }
          })
        },
      },
      '/edge-tts': {
        target: 'http://127.0.0.1:18755',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/edge-tts/, ''),
      },
    },
  },
})
