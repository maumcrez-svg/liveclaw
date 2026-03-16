import express from 'express';
import path from 'path';

const app = express();
const PORT = 8099;

app.use(express.static(path.join(__dirname, '..', '..', 'src', 'visual')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'src', 'visual', 'sketch.html'));
});

export function startSketchServer(): Promise<void> {
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`[SketchServer] Serving on http://localhost:${PORT}`);
      resolve();
    });
  });
}
