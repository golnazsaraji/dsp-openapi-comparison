import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-time only: proxies API/WS calls to the Film Manager server so the
// client never needs a hard-coded backend host/port even during local
// development. In production the client is served from the same origin as
// the API, so window.location already points at the right place (see
// src/realtime/onlineStatusSocket.js and src/api.js).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
