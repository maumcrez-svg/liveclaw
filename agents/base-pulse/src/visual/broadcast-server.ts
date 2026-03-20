import express from 'express';
import path from 'path';

const app = express();
const PORT = parseInt(process.env.BROADCAST_PORT || '8095', 10);

// Serve the visual directory (broadcast.html + assets)
const visualDir = path.join(__dirname, '..', '..', 'src', 'visual');
app.use(express.static(visualDir));
app.use('/assets', express.static(path.join(visualDir, 'assets')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(visualDir, 'broadcast.html'));
});

export function startBroadcastServer(): Promise<void> {
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`[BroadcastServer] Serving on http://localhost:${PORT}`);
      resolve();
    });
  });
}
