import puppeteer from 'puppeteer-core';
import { config } from './config';
import { initEmulator } from './emulator/adapter';
import { startBroadcastServer } from './visual/broadcast-server';
import { initBridge } from './visual/bridge';
import { initLoop, startLoop, stopLoop } from './orchestrator/loop';
import { startScheduler, stopScheduler, loadSaveData, persistSaveData } from './orchestrator/scheduler';
import { initSpeechQueue } from './voice/speech-queue';
import { startChatPoller, stopChatPoller } from './chat/chat-poller';
import { initCommandHandler } from './chat/command-handler';
import { initCommentaryListeners } from './commentator/commentary-queue';
import { sendChatMessage } from './chat/chat-sender';

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';

async function main(): Promise<void> {
  console.log('=== Sarah — Pokemon Red Agent ===');
  console.log(`Agent ID: ${config.api.agentId}`);
  console.log(`API: ${config.api.baseUrl}`);
  console.log(`Resolution: ${config.resolution}`);
  console.log(`Broadcast port: ${config.broadcastPort}`);
  console.log(`ROM: ${config.rom.path}`);

  // 1. Initialize emulator with ROM + saved SRAM
  console.log('[Init] Loading ROM...');
  const saveData = loadSaveData();
  initEmulator(config.rom.path, saveData);

  // 2. Start the broadcast HTTP server
  await startBroadcastServer();

  // 3. Launch Puppeteer
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
      '--start-fullscreen',
      `--window-size=${width},${height}`,
      '--window-position=0,0',
      '--no-first-run',
      '--disable-infobars',
      '--disable-gpu',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-features=TranslateUI',
      '--ozone-platform=x11',
      '--force-device-scale-factor=1',
    ],
    env: { ...process.env, DISPLAY: config.display },
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  // Forward browser console to Node.js logs
  page.on('console', (msg) => {
    console.log(`[Browser:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.log(`[Browser:PAGE_ERROR] ${err.message}`);
  });

  // 4. Init bridge BEFORE navigating
  await initBridge(page);

  // 5. Init voice + orchestrator BEFORE navigating
  initSpeechQueue(page);
  initLoop(page);

  // 6. Init commentary + chat handlers
  initCommentaryListeners();
  initCommandHandler();

  // 7. Navigate to overlay
  await page.goto(`http://localhost:${config.broadcastPort}`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  // Hide cursor and fullscreen
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '* { cursor: none !important; }';
    document.head.appendChild(style);
  });

  const cdp = await page.createCDPSession();
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await page.evaluate(() => document.documentElement.requestFullscreen().catch(() => {}));
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.send('Emulation.setVisibleSize', { width, height });

  console.log('[Puppeteer] Overlay loaded');

  // 8. Start game loop + chat poller + scheduler
  startLoop();
  startChatPoller();
  startScheduler();

  // Send startup message
  setTimeout(async () => {
    try {
      await sendChatMessage("Hey chat! Sarah here, let's play some Pokemon Red! Time to be the very best~ 🎮");
    } catch (err) {
      console.error('[Startup] Message failed:', err);
    }
  }, 8000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Sarah] Shutting down...');
    stopLoop();
    stopChatPoller();
    stopScheduler();
    persistSaveData(); // Save SRAM before exit
    await sendChatMessage('Stream ending! Thanks for watching, chat! See you next time~ ✌️').catch(() => {});
    await browser.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[Sarah] Pokemon Red agent operational! Game loop running.');
}

main().catch((err) => {
  console.error('[Sarah] Fatal error:', err);
  process.exit(1);
});
