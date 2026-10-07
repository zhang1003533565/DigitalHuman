import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 本地后端地址可用环境变量覆盖，默认仍为 8080，不影响其他开发者。
const apiTarget = process.env.DH_API_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  envPrefix: ['VITE_'],
  plugins: [react()],
  server: {
    port: 30001,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
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
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/edge-tts/, ''),
      },
    },
  },
})
