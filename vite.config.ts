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
        // Split the third-party libs out of the entry chunk; pages are code-split by React.lazy in src/routes.tsx.
        // A listed package takes its dependencies with it unless they are listed too: clsx sits in `ui` because
        // recharts also depends on it and would otherwise pull the chart library into the first load.
        manualChunks: {
          react: ['react', 'react/jsx-runtime', 'react-dom', 'react-router-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
            'cmdk',
            'clsx',
            'class-variance-authority',
            'tailwind-merge',
          ],
          recharts: ['recharts'],
          posthog: ['posthog-js', '@posthog/react'],
        },
      },
    },
  },
  server: {
    port: 5180,
    proxy: {
      // 127.0.0.1, not localhost (avoids Node resolving to ::1); changeOrigin: false keeps the browser's Host header so the backend's Host check enforces it — the string shorthand would set changeOrigin: true and defeat that check.
      '/api': { target: `http://127.0.0.1:${SERVER_PORT}`, changeOrigin: false },
    },
  },
});
