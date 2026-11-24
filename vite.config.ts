import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const apiPort = process.env.API_PORT ?? '3210';
// 默认绑到 0.0.0.0，让手机等局域网设备能访问；MV2_LOCAL=1 退回只监听本机
const expose = process.env.MV2_LOCAL !== '1';
// 用 127.0.0.1 而不是 localhost：避免 ::1 与 IPv4 解析不一致导致代理偶发失败
const apiTarget = { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    host: expose ? true : undefined,
    port: 5180,
    strictPort: true,
    proxy: { '/api': apiTarget },
  },
  preview: {
    host: expose ? true : undefined,
    port: 5181,
    proxy: { '/api': apiTarget },
  },
  build: {
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
