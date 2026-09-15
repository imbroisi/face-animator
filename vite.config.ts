import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import { exportMovPlugin } from './server/exportMov.ts';

function ffmpegCoreAssets(): Plugin {
  const esm = join(fileURLToPath(new URL('.', import.meta.url)), 'node_modules/@ffmpeg/core/dist/esm');
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (path === '/ffmpeg/ffmpeg-core.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(readFileSync(join(esm, 'ffmpeg-core.js')));
      return;
    }
    if (path === '/ffmpeg/ffmpeg-core.wasm') {
      res.setHeader('Content-Type', 'application/wasm');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(readFileSync(join(esm, 'ffmpeg-core.wasm')));
      return;
    }
    next();
  };
  return {
    name: 'ffmpeg-core-assets',
    configureServer(server) {
      server.middlewares.use(serve);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve);
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'ffmpeg/ffmpeg-core.js',
        source: readFileSync(join(esm, 'ffmpeg-core.js')),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'ffmpeg/ffmpeg-core.wasm',
        source: readFileSync(join(esm, 'ffmpeg-core.wasm')),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), exportMovPlugin(), ffmpegCoreAssets()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  worker: {
    format: 'es',
  },
});
