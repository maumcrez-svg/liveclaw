import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { startBroadcastServer } from './visual/broadcast-server';
import { initSpeechQueue } from './voice/speech-queue';
import { initAvatar } from './avatar/avatar-controller';
import { runEpisode } from './orchestrator/episode-runner';
import { ingestNews } from './ingest/aggregator';
import { rankNews } from './editorial/ranker';
import { writeScript } from './editorial/scriptwriter';
import { synthesizeAllSegments } from './voice/tts-engine';
import { startChatPoller, stopChatPoller, onChatMessage } from './chat/chat-poller';
import { sendChatMessage } from './chat/chat-sender';
import { NewsAccumulator } from './accumulator/news-accumulator';
import { EpisodeCoordinator } from './coordinator/episode-coordinator';
import type { GeneratedEpisode } from './models/types';

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';

function getOutputDir(): string {
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(__dirname, '..', 'output', date);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function generateEpisode(): Promise<GeneratedEpisode> {
  const outputDir = getOutputDir();
  const date = new Date().toISOString().slice(0, 10);

  // Step 1: Ingest news
  console.log('\n=== PHASE 1: News Ingestion ===');
  const { articles, market } = await ingestNews();
  fs.writeFileSync(path.join(outputDir, 'raw_articles.json'), JSON.stringify(articles, null, 2));
  fs.writeFileSync(path.join(outputDir, 'market_snapshot.json'), JSON.stringify(market, null, 2));

  if (articles.length === 0) {
    throw new Error('No articles found — cannot generate episode');
  }

  // Step 2: Rank and select stories
  console.log('\n=== PHASE 2: News Ranking ===');
  const plan = await rankNews(articles, market);
  fs.writeFileSync(path.join(outputDir, 'episode_plan.json'), JSON.stringify(plan, null, 2));

  // Step 3: Write script
  console.log('\n=== PHASE 3: Script Writing ===');
  const script = await writeScript(plan, articles);
  fs.writeFileSync(path.join(outputDir, 'episode_script.json'), JSON.stringify(script, null, 2));

  // Step 4: Generate TTS audio
  console.log('\n=== PHASE 4: Voice Synthesis ===');
  const audioSegments = await synthesizeAllSegments(
    script.segments.map((s) => ({ id: s.id, narration: s.narration })),
  );

  // Save audio files
  const audioDir = path.join(outputDir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  for (const seg of audioSegments) {
    fs.writeFileSync(
      path.join(audioDir, `${seg.segmentId}.mp3`),
      Buffer.from(seg.audioBase64, 'base64'),
    );
  }

  console.log(`\n=== Episode generated: ${date} ===`);
  console.log(`Articles: ${articles.length}, Stories: ${plan.stories.length}, Segments: ${script.segments.length}`);
  console.log(`Audio: ${audioSegments.length} segments`);

  return { date, episodeNumber: 0, articles, plan, script, audioSegments };
}

async function broadcast(episode: GeneratedEpisode): Promise<void> {
  console.log('\n=== PHASE 5: Broadcast ===');

  const { page } = await launchBroadcastPage();

  // Start chat (optional — responds to viewers during the show)
  onChatMessage(async (msg) => {
    console.log(`[Chat] ${msg.username}: ${msg.content}`);
  });
  startChatPoller();

  // Send "going live" message
  await sendChatMessage("Crypto News is going live. Today's episode is starting now.");

  // Run the episode
  await runEpisode(page, episode);

  // Cleanup
  console.log('[Broadcast] Episode finished, shutting down...');
  stopChatPoller();
  await sendChatMessage("That's a wrap. Crypto News signing off. See you next time.");
  const browser = page.browser();
  if (browser) await browser.close();
}

async function launchBroadcastPage() {
  // Start the broadcast HTML server
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

  // Forward browser console
  page.on('console', (msg) => {
    console.log(`[Browser:${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    console.log(`[Browser:ERROR] ${err.message}`);
  });

  const broadcastPort = process.env.BROADCAST_PORT || '8098';
  await page.goto(`http://localhost:${broadcastPort}`, { waitUntil: 'networkidle0', timeout: 15000 });

  // Hide cursor
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '* { cursor: none !important; }';
    document.head.appendChild(style);
  });

  // Fullscreen
  const cdp = await page.createCDPSession();
  await cdp.send('Page.setWebLifecycleState', { state: 'active' });
  await page.evaluate(() => document.documentElement.requestFullscreen().catch(() => {}));
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.send('Emulation.setVisibleSize', { width, height });

  console.log('[Puppeteer] Broadcast page loaded');

  // Init subsystems
  initSpeechQueue(page);
  initAvatar(page);

  return { page, browser };
}

async function main(): Promise<void> {
  console.log('=== CRYPTO NEWS ===');
  console.log(`Agent ID: ${config.api.agentId}`);
  console.log(`Resolution: ${config.resolution}`);

  const mode = process.argv[2] || 'run';

  switch (mode) {
    case 'generate': {
      await generateEpisode();
      break;
    }
    case 'broadcast': {
      // Load most recent episode
      const date = new Date().toISOString().slice(0, 10);
      const dir = path.join(__dirname, '..', 'output', date);
      const scriptPath = path.join(dir, 'episode_script.json');

      if (!fs.existsSync(scriptPath)) {
        console.error('No episode found for today. Run with "generate" first.');
        process.exit(1);
      }

      const script = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));
      const articles = JSON.parse(fs.readFileSync(path.join(dir, 'raw_articles.json'), 'utf-8'));
      const plan = JSON.parse(fs.readFileSync(path.join(dir, 'episode_plan.json'), 'utf-8'));

      // Load audio segments
      const audioDir = path.join(dir, 'audio');
      const audioSegments = script.segments
        .map((seg: any) => {
          const audioPath = path.join(audioDir, `${seg.id}.mp3`);
          if (fs.existsSync(audioPath)) {
            return {
              segmentId: seg.id,
              audioBase64: fs.readFileSync(audioPath).toString('base64'),
              format: 'mp3' as const,
              durationEstMs: seg.estimatedDurationSec * 1000,
            };
          }
          return null;
        })
        .filter(Boolean);

      await broadcast({ date, episodeNumber: 0, articles, plan, script, audioSegments });
      break;
    }
    case 'run':
    default: {
      // 24/7 continuous streaming: accumulate news → generate → replay loop
      const { page } = await launchBroadcastPage();

      // Heartbeat — mark agent as live and keep alive every 60s
      const sendHeartbeat = async () => {
        try {
          await fetch(`${config.api.baseUrl}/agents/${config.api.agentId}/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.api.apiKey}`,
            },
            body: JSON.stringify({ status: 'live' }),
          });
        } catch {}
      };
      await sendHeartbeat();
      setInterval(sendHeartbeat, 60_000);

      // Start chat
      onChatMessage(async (msg) => {
        console.log(`[Chat] ${msg.username}: ${msg.content}`);
      });
      startChatPoller();
      await sendChatMessage("Crypto News is going live. 24/7 coverage starting now.");

      // Create accumulator and coordinator
      const accumulator = new NewsAccumulator();
      const coordinator = new EpisodeCoordinator(accumulator);

      // Run forever — coordinator handles replay loop + background episode generation
      await coordinator.run(page);
    }
  }
}

main().catch((err) => {
  console.error('[CRYPTO NEWS] Fatal error:', err);
  process.exit(1);
});
