import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// In dev the API/WebSocket server is proxied so the client code never needs a server URL.
// In production set VITE_SERVER_URL to the deployed backend origin (see .env.example).
const DEV_SERVER = process.env.DEV_SERVER_ORIGIN || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: 'automatic' },
  server: {
    port: 5173,
    proxy: {
      '/api': DEV_SERVER,
      '/socket.io': { target: DEV_SERVER, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
  },
});
