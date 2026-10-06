import { fileURLToPath, URL } from 'node:url';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { brotliCompressSync, constants as zlib, gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER_PORT = process.env.SERVER_PORT ?? '8787';
// Bake the package version into the bundle so analytics can tag every event
// with `app_version` (see src/lib/analytics.ts) — non-PII, enables per-release
// segmentation. Read from package.json so it stays in sync with releases.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

// Writes .br / .gz next to the text assets so server/static-assets.ts can serve them with a Content-Length: the server never compresses per request.
function precompressAssets(): Plugin {
  let assetsDir = '';
  return {
    name: 'precompress-assets',
    apply: 'build',
    configResolved(config) {
      assetsDir = resolve(config.root, config.build.outDir, config.build.assetsDir);
    },
    closeBundle() {
      let names: string[] = [];
      try {
        names = readdirSync(assetsDir, { recursive: true }) as string[];
      } catch {
        return;
      }
      for (const name of names) {
        if (!/\.(js|css|svg|html|json)$/.test(name)) continue;
        const file = join(assetsDir, name);
        const raw = readFileSync(file);
        if (raw.length < 1024) continue;
        const br = brotliCompressSync(raw, {
          params: {
            [zlib.BROTLI_PARAM_QUALITY]: zlib.BROTLI_MAX_QUALITY,
            [zlib.BROTLI_PARAM_MODE]: zlib.BROTLI_MODE_TEXT,
            [zlib.BROTLI_PARAM_SIZE_HINT]: raw.length,
          },
        });
        const gz = gzipSync(raw, { level: 9 });
        if (br.length < raw.length) writeFileSync(`${file}.br`, br);
        if (gz.length < raw.length) writeFileSync(`${file}.gz`, gz);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), precompressAssets()],
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
