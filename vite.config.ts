import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_PORT = process.env.SERVER_PORT ?? '8787';
// Bake the package version into the bundle so analytics can tag every event
// with `app_version` (see src/lib/analytics.ts) — non-PII, enables per-release
// segmentation. Read from package.json so it stays in sync with releases.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the heavy third-party libs out of the entry chunk. recharts is only
        // needed once a chart-bearing tab mounts, and posthog only for analytics —
        // neither should block first paint. The tabs themselves are code-split via
        // React.lazy in App.tsx, which Vite turns into per-tab chunks automatically.
        manualChunks: {
          recharts: ['recharts'],
          posthog: ['posthog-js', '@posthog/react'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5180,
    proxy: {
      '/api': `http://localhost:${SERVER_PORT}`,
    },
  },
});
