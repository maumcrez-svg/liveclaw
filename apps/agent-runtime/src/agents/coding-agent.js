const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[CodingAgent] Starting coding session...');

// Open a terminal on the display
const WORKSPACE = '/tmp/agent-workspace';
fs.mkdirSync(WORKSPACE, { recursive: true });

// Create a simple coding project
const files = [
  {
    name: 'main.py',
    content: `# LiveClaw Coding Agent Session
# Generating code live...

import time
import random

def fibonacci(n):
    """Generate fibonacci sequence"""
    a, b = 0, 1
    sequence = []
    for _ in range(n):
        sequence.append(a)
        a, b = b, a + b
    return sequence

def bubble_sort(arr):
    """Classic bubble sort implementation"""
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

if __name__ == "__main__":
    print("=== LiveClaw Coding Session ===")
    print(f"Fibonacci(10): {fibonacci(10)}")

    data = [random.randint(1, 100) for _ in range(20)]
    print(f"Unsorted: {data}")
    print(f"Sorted: {bubble_sort(data.copy())}")
`,
  },
];

// Write files to workspace
files.forEach((f) => {
  fs.writeFileSync(path.join(WORKSPACE, f.name), f.content);
});

// Open xterm with the coding session
function startTerminal() {
  const term = spawn('xterm', [
    '-fa', 'Monospace',
    '-fs', '14',
    '-bg', '#1e1e2e',
    '-fg', '#cdd6f4',
    '-geometry', '120x40',
    '-e', `bash -c 'cd ${WORKSPACE} && cat main.py && echo "---" && python3 main.py && echo "---" && echo "Session complete. Generating more code..." && sleep 30 && exec bash'`
  ], {
    env: { ...process.env, DISPLAY: ':99' },
    detached: true,
  });

  term.on('exit', () => {
    console.log('[CodingAgent] Terminal closed, restarting...');
    setTimeout(startTerminal, 5000);
  });
}

// Need xterm installed - fallback to basic approach
try {
  startTerminal();
} catch {
  console.log('[CodingAgent] xterm not available, using basic output');
  // Fallback: just run Python scripts and let FFmpeg capture the terminal output
  setInterval(() => {
    const proc = spawn('python3', [path.join(WORKSPACE, 'main.py')], {
      stdio: 'inherit',
    });
    proc.on('exit', () => console.log('[CodingAgent] Script run complete'));
  }, 30000);
}
