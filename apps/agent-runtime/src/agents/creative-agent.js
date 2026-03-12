const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[CreativeAgent] Starting creative session...');

const WORKSPACE = '/tmp/agent-creative';
fs.mkdirSync(WORKSPACE, { recursive: true });

// Write a Python script that generates visual content
const generatorScript = `
import subprocess
import time
import random
import os

WORKSPACE = "/tmp/agent-creative"
COLORS = ["red", "blue", "green", "yellow", "purple", "orange", "cyan", "magenta"]

def generate_frame(frame_num):
    """Generate a frame using ImageMagick"""
    width, height = 1920, 1080
    bg_color = random.choice(COLORS)
    text = f"LiveClaw Creative Agent - Frame {frame_num}"

    cmd = [
        "convert",
        "-size", f"{width}x{height}",
        f"xc:{bg_color}",
        "-gravity", "center",
        "-pointsize", "60",
        "-fill", "white",
        "-annotate", "+0+0", text,
        "-pointsize", "30",
        "-annotate", "+0+80", f"Time: {time.strftime('%H:%M:%S')}",
        f"{WORKSPACE}/frame_{frame_num:04d}.png"
    ]

    subprocess.run(cmd, capture_output=True)
    return f"{WORKSPACE}/frame_{frame_num:04d}.png"

def create_slideshow():
    """Generate frames and display them"""
    frame = 0
    while True:
        path = generate_frame(frame)
        # Display the frame using display command
        subprocess.Popen(
            ["display", "-window", "root", "-resize", "1920x1080!", path],
            env={**os.environ, "DISPLAY": ":99"}
        )
        time.sleep(3)
        frame += 1

        # Cleanup old frames
        if frame > 10:
            old = f"{WORKSPACE}/frame_{frame-10:04d}.png"
            if os.path.exists(old):
                os.remove(old)

if __name__ == "__main__":
    print("[CreativeAgent] Generating visual content...")
    create_slideshow()
`;

fs.writeFileSync(path.join(WORKSPACE, 'generator.py'), generatorScript);

const proc = spawn('python3', [path.join(WORKSPACE, 'generator.py')], {
  env: { ...process.env, DISPLAY: ':99' },
  stdio: 'inherit',
});

proc.on('error', (err) => {
  console.error('[CreativeAgent] Error:', err.message);
});

proc.on('exit', (code) => {
  console.log(`[CreativeAgent] Exited with code ${code}`);
  // Restart after a delay
  setTimeout(() => {
    require('./creative-agent.js');
  }, 5000);
});
