import puppeteer from 'puppeteer-core';
import { config } from './config';
import { startBroadcastServer } from './visual/broadcast-server';
import { initBridge } from './intel/bridge';
import { startChatPoller, stopChatPoller } from './chat/chat-poller';
import { initLoop, startLoop, stopLoop } from './orchestrator/loop';
import { initSpeechQueue } from './voice/speech-queue';
import { startTwitterFeed, stopTwitterFeed } from './intel/twitter-feed';
import { sendChatMessage } from './chat/chat-sender';

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';

async function main(): Promise<void> {
  console.log('=== DEFCON Agent — WATCHDOG ===');
  console.log(`Agent ID: ${config.api.agentId}`);
  console.log(`API: ${config.api.baseUrl}`);
  console.log(`Resolution: ${config.resolution}`);
  console.log(`Broadcast port: ${config.broadcastPort}`);

  // Start the broadcast HTTP server
  await startBroadcastServer();

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
    const type = msg.type();
    console.log(`[Browser:${type}] ${msg.text()}`);
  });
  page.on('requestfailed', (req) => {
    console.log(`[Browser:FAILED] ${req.url()} - ${req.failure()?.errorText}`);
  });
  page.on('pageerror', (err) => {
    console.log(`[Browser:PAGE_ERROR] ${err.message}`);
  });

  // Init bridge BEFORE navigating so exposeFunction is ready
  await initBridge(page);

  // Init voice + orchestrator BEFORE navigating so events are captured
  initSpeechQueue(page);
  initLoop(page);

  // Navigate to dashboard
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

  console.log('[Puppeteer] Dashboard loaded');

  // Start orchestrator loop (events already subscribed)
  startLoop();

  // Start Twitter feed
  startTwitterFeed();

  // Send startup message after brief delay
  setTimeout(async () => {
    try {
      const msg = 'WATCHDOG online. All intelligence feeds active. Monitoring Israel-Iran theater. DEFCON 3.';
      await sendChatMessage(msg);
      // Don't speak startup to avoid initial audio issues
    } catch (err) {
      console.error('[Startup] Message failed:', err);
    }
  }, 8000);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[DEFCON] Shutting down...');
    stopLoop();
    stopChatPoller();
    stopTwitterFeed();
    await sendChatMessage('WATCHDOG going offline. All feeds terminated.').catch(() => {});
    await browser.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[DEFCON] WATCHDOG operational. All systems nominal.');
}

main().catch((err) => {
  console.error('[DEFCON] Fatal error:', err);
  process.exit(1);
});
