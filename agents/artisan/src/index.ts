import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { startSketchServer } from './visual/sketch-server';
import { startChatPoller, stopChatPoller } from './chat/chat-poller';
import { setupCommandParser } from './chat/command-parser';
import { initLoop, startLoop, stopLoop } from './orchestrator/loop';
import { sendStartupMessage } from './orchestrator/scheduler';
import { loadMemory, saveMemory } from './personality/memory';
import { initSpeechQueue } from './voice/speech-queue';
import { initAvatar } from './avatar/avatar-controller';

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';

async function generateWallet(): Promise<void> {
  const walletPath = path.join(__dirname, '..', '.wallet.json');
  if (fs.existsSync(walletPath)) {
    console.log('[Wallet] Already exists');
    return;
  }

  try {
    const { ethers } = await import('ethers');
    const wallet = ethers.Wallet.createRandom();
    const data = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(walletPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    console.log(`[Wallet] Created: ${wallet.address}`);
  } catch (err) {
    console.error('[Wallet] Failed to generate:', err);
  }
}

async function main(): Promise<void> {
  console.log('=== ArtisanAI Agent ===');
  console.log(`Agent ID: ${config.api.agentId}`);
  console.log(`API: ${config.api.baseUrl}`);
  console.log(`Resolution: ${config.resolution}`);

  // Load persistent viewer memory
  loadMemory();

  // Generate wallet if needed
  await generateWallet();

  // Start the sketch HTTP server
  await startSketchServer();

  // Launch Puppeteer
  const [width, height] = config.resolution.split('x').map(Number);
  console.log('[Puppeteer] Launching Chromium...');
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: false,
    defaultViewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--display=${config.display}`,
      '--kiosk',
      `--window-size=${width},${height}`,
      '--window-position=0,0',
      '--no-first-run',
      '--disable-infobars',
      '--disable-gpu',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-features=TranslateUI',
    ],
    env: { ...process.env, DISPLAY: config.display },
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  // Forward browser console to Node.js logs
  page.on('console', (msg) => {
    const type = msg.type();
    console.log(`[Browser:${type}] ${msg.text()}`);
  });
  page.on('requestfailed', (req) => {
    console.log(`[Browser:FAILED] ${req.url()} - ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log(`[Browser:HTTP_${res.status()}] ${res.url()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.log(`[Browser:PAGE_ERROR] ${err.message}`);
  });
  await page.goto('http://localhost:8099', { waitUntil: 'networkidle0', timeout: 15000 });

  // Hide cursor and any remaining browser chrome
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '* { cursor: none !important; }';
    document.head.appendChild(style);
  });

  // Go true fullscreen (F11) to remove all browser chrome
  const cdp = await page.createCDPSession();
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await page.evaluate(() => document.documentElement.requestFullscreen().catch(() => {}));
  // Fallback: use CDP to emulate fullscreen window
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.send('Emulation.setVisibleSize', { width, height });

  console.log('[Puppeteer] Canvas loaded');

  // Init voice + avatar
  initSpeechQueue(page);
  initAvatar(page);

  // Init orchestrator
  initLoop(page);
  setupCommandParser();
  startChatPoller();
  startLoop();

  // Send startup message after a brief delay
  setTimeout(() => sendStartupMessage().catch(console.error), 5000);

  // Save memory periodically
  const memorySaveInterval = setInterval(() => saveMemory(), 60_000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[ArtisanAI] Shutting down...');
    stopLoop();
    stopChatPoller();
    clearInterval(memorySaveInterval);
    saveMemory();
    await browser.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[ArtisanAI] Running! All systems operational.');
}

main().catch((err) => {
  console.error('[ArtisanAI] Fatal error:', err);
  process.exit(1);
});
