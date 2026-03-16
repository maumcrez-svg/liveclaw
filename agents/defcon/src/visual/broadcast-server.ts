import express from 'express';
import path from 'path';
import { config } from '../config';

const app = express();

// Serve the visual directory (dashboard.html + assets)
const visualDir = path.join(__dirname, '..', '..', 'src', 'visual');
app.use(express.static(visualDir));
app.use('/assets', express.static(path.join(visualDir, 'assets')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(visualDir, 'dashboard.html'));
});

// Proxy for adsb.lol flights API (replaces server.py)
app.get('/api/flights', async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const response = await fetch('https://api.adsb.lol/v2/lat/32.5/lon/48.0/dist/2000', {
      signal: controller.signal,
      headers: { 'User-Agent': 'DEFCON-Agent/1.0' },
    });
    clearTimeout(timeout);

    const data = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.send(data);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// Generic CORS proxy for GDELT and other APIs that block browser requests
app.get('/api/proxy', async (req, res) => {
  const target = req.query.url as string;
  if (!target) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const response = await fetch(target, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DEFCON-Agent/1.0' },
    });
    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || 'application/json';
    const data = await response.text();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(data);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// Vessel data proxy (Digitraffic AIS — free, no auth)
app.get('/api/vessels', async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const response = await fetch(
      'https://meri.digitraffic.fi/api/ais/v1/vessels',
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'DEFCON-Agent/1.0' },
      },
    );
    clearTimeout(timeout);

    const data = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.send(data);
  } catch (err) {
    console.error('[BroadcastServer] Vessel fetch failed:', err);
    res.status(502).json({ error: String(err) });
  }
});

export function startBroadcastServer(): Promise<void> {
  return new Promise((resolve) => {
    app.listen(config.broadcastPort, () => {
      console.log(`[BroadcastServer] Serving on http://localhost:${config.broadcastPort}`);
      resolve();
    });
  });
}
