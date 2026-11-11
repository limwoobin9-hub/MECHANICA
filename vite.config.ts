import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  base: './',
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
});
