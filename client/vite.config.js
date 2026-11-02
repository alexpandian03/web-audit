import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function getBackendTarget() {
  // 1. If VITE_API_BASE is explicitly set in environment, use it
  if (process.env.VITE_API_BASE) {
    return process.env.VITE_API_BASE.replace(/\/+$/, '');
  }

  // 2. Read server/.env to determine which port Express is running on (e.g. 10000 or 5000)
  try {
    const serverEnvPath = path.resolve(__dirname, '../server/.env');
    if (fs.existsSync(serverEnvPath)) {
      const content = fs.readFileSync(serverEnvPath, 'utf-8');
      const portMatch = content.match(/^PORT\s*=\s*(\d+)/m);
      if (portMatch) {
        return `http://localhost:${portMatch[1]}`;
      }
    }
  } catch {}

  // 3. Fallback to process.env.PORT or 5000
  const port = process.env.BACKEND_PORT || process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: getBackendTarget(),
        changeOrigin: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.warn(`[Vite Proxy] Target ${options.target} error: ${err.message}`);
          });
        },
      },
    },
  },
});
