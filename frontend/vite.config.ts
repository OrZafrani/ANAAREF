import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:4000';

const config: UserConfig & { test: { globals: boolean; environment: string; setupFiles: string } } = {
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_PORT) || 5173,
    proxy: {
      '/health': apiTarget,
      '/api': apiTarget,
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts'
  }
};

export default defineConfig(config);
