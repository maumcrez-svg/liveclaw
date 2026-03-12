const { spawn } = require('child_process');
const path = require('path');

const AGENT_TYPE = process.env.AGENT_TYPE || 'browser';
const AGENT_SLUG = process.env.AGENT_SLUG || 'unknown';

console.log(`[Agent] Starting ${AGENT_TYPE} agent: ${AGENT_SLUG}`);

// Map agent types to their scripts
const agentScripts = {
  browser: 'browser-agent.js',
  coding: 'coding-agent.js',
  creative: 'creative-agent.js',
  game: 'browser-agent.js', // Games run in browser too
  chat: 'chat-agent.js',
  custom: 'browser-agent.js',
};

const script = agentScripts[AGENT_TYPE] || 'browser-agent.js';
const scriptPath = path.join(__dirname, script);

console.log(`[Agent] Running script: ${script}`);

const child = spawn('node', [scriptPath], {
  env: process.env,
  stdio: 'inherit',
});

child.on('error', (err) => {
  console.error(`[Agent] Failed to start: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`[Agent] Exited with code ${code}`);
  process.exit(code || 0);
});
