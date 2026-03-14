import express from 'express';
import * as path from 'path';
import { config } from '../config';

// Resolve overlay.html from src/visual/ regardless of whether we're running
// from dist/ (compiled) or src/ (tsx dev mode)
function resolveOverlayDir(): string {
  // __dirname is dist/visual or src/visual
  const srcVisual = path.resolve(__dirname, '..', '..', 'src', 'visual');
  const overlayInSrc = path.join(srcVisual, 'overlay.html');
  if (require('fs').existsSync(overlayInSrc)) return srcVisual;
  // Fallback: overlay.html next to this file (dev mode)
  return __dirname;
}

export async function startBroadcastServer(): Promise<void> {
  const app = express();
  const overlayDir = resolveOverlayDir();
  app.use(express.static(overlayDir));

  // Serve overlay.html at root
  app.get('/', (_req, res) => {
    res.sendFile(path.join(overlayDir, 'overlay.html'));
  });

  return new Promise((resolve) => {
    app.listen(config.broadcastPort, () => {
      console.log(`[Broadcast] Server on port ${config.broadcastPort}`);
      resolve();
    });
  });
}
