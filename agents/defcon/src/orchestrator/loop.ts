import type { Page } from 'puppeteer-core';
import { config } from '../config';
import { bus, type ChatMessageEvent, type IntelArticle } from './events';
import { onChatMessage, startChatPoller } from '../chat/chat-poller';
import { sendChatMessage } from '../chat/chat-sender';
import { speak, isSpeaking } from '../voice/speech-queue';
import { chatCompletion } from '../brain/llm-client';
import {
  SYSTEM_PERSONA,
  NARRATION_PROMPT,
  TWEET_NARRATION_PROMPT,
  DEFCON_ALERT_PROMPT,
  CHAT_RESPONSE_PROMPT,
  STATUS_PROMPT,
  MILITARY_FLIGHT_PROMPT,
  fillTemplate,
} from '../brain/prompts';
import * as store from '../intel/intel-store';
import { updateCommsPanel, triggerAlert, addIntelEntry } from '../intel/bridge';
import { startScheduler, stopScheduler } from './scheduler';
import { shouldNarrateType, markNarrated as markNarratedType } from '../intel/detector';

let page: Page;
let loopTimer: ReturnType<typeof setInterval> | null = null;
const pendingChatMessages: ChatMessageEvent[] = [];
const startTime = Date.now();

export function initLoop(puppeteerPage: Page): void {
  page = puppeteerPage;

  // Wire up chat messages
  onChatMessage((msg) => {
    const content = msg.content.trim();
    if (content.startsWith('!')) {
      const spaceIdx = content.indexOf(' ');
      const command = spaceIdx > 0 ? content.substring(1, spaceIdx).toLowerCase() : content.substring(1).toLowerCase();
      const args = spaceIdx > 0 ? content.substring(spaceIdx + 1).trim() : '';
      bus.emit('chat:command', { command, args, username: msg.username, rawMessage: msg });
    } else {
      pendingChatMessages.push(msg);
    }
  });

  // Intel event handlers
  bus.on('intel:new-article', handleNewArticle);
  bus.on('intel:new-tweet', handleNewTweet);
  bus.on('intel:defcon-change', handleDefconChange);
  bus.on('intel:military-flight', handleMilitaryFlight);

  // Command handlers
  bus.on('chat:command', handleCommand);
}

export function startLoop(): void {
  if (loopTimer) return;
  console.log(`[Loop] Starting tick every ${config.tickInterval}ms`);
  loopTimer = setInterval(tick, config.tickInterval);
  startChatPoller();
  startScheduler();
}

export function stopLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  stopScheduler();
}

async function tick(): Promise<void> {
  // Process one pending chat message per tick (avoid flooding)
  if (pendingChatMessages.length > 0 && !isSpeaking()) {
    const msg = pendingChatMessages.shift()!;
    await handleChatMessage(msg);
  }
}

async function handleNewArticle(article: IntelArticle): Promise<void> {
  console.log(`[Loop] Narrating article: ${article.title.substring(0, 60)}...`);
  await updateCommsPanel('NARRATING', article.title);
  await addIntelEntry(article.source, article.title, 'RSS');

  try {
    const narration = await chatCompletion(
      SYSTEM_PERSONA,
      fillTemplate(NARRATION_PROMPT, { title: article.title, source: article.source }),
    );

    if (narration) {
      await speak(narration);
      await sendChatMessage(narration);
    }
  } catch (err) {
    console.error('[Loop] Narration failed:', err);
  }

  await updateCommsPanel('IDLE', '');
}

async function handleNewTweet(tweet: IntelArticle): Promise<void> {
  console.log(`[Loop] Narrating tweet: ${tweet.title.substring(0, 60)}...`);
  await updateCommsPanel('NARRATING', tweet.title);
  await addIntelEntry(tweet.source, tweet.title, 'X/OSINT');

  try {
    const narration = await chatCompletion(
      SYSTEM_PERSONA,
      fillTemplate(TWEET_NARRATION_PROMPT, { title: tweet.title }),
    );

    if (narration) {
      await speak(narration);
      await sendChatMessage(narration);
    }
  } catch (err) {
    console.error('[Loop] Tweet narration failed:', err);
  }

  await updateCommsPanel('IDLE', '');
}

async function handleMilitaryFlight(flight: { callsign: string; type: string; lat: number; lon: number; alt: number; heading: number }): Promise<void> {
  if (!shouldNarrateType('flight')) return;

  console.log(`[Loop] Military flight alert: ${flight.callsign}`);
  await updateCommsPanel('SIGINT', `Military aircraft: ${flight.callsign}`);

  try {
    const narration = await chatCompletion(
      SYSTEM_PERSONA,
      fillTemplate(MILITARY_FLIGHT_PROMPT, {
        callsign: flight.callsign,
        type: flight.type || 'UNKNOWN',
        altitude: flight.alt || 0,
        heading: flight.heading || 0,
        lat: flight.lat,
        lon: flight.lon,
      }),
    );

    if (narration) {
      markNarratedType('flight');
      await speak(narration);
      await sendChatMessage(narration);
    }
  } catch (err) {
    console.error('[Loop] Military flight narration failed:', err);
  }

  await updateCommsPanel('IDLE', '');
}

async function handleDefconChange(newLevel: number, oldLevel: number): Promise<void> {
  console.log(`[Loop] DEFCON CHANGE: ${oldLevel} → ${newLevel}`);
  await updateCommsPanel('ALERT', `DEFCON ${oldLevel} → DEFCON ${newLevel}`);
  await triggerAlert();

  try {
    const narration = await chatCompletion(
      SYSTEM_PERSONA,
      fillTemplate(DEFCON_ALERT_PROMPT, {
        oldLevel,
        newLevel,
        context: store.getRecentSummary(5),
      }),
    );

    if (narration) {
      await sendChatMessage(`⚠️ FLASH TRAFFIC — DEFCON ${newLevel}`);
      await speak(narration);
      await sendChatMessage(narration);
    }
  } catch (err) {
    console.error('[Loop] DEFCON alert narration failed:', err);
  }

  await updateCommsPanel('IDLE', '');
}

async function handleChatMessage(msg: ChatMessageEvent): Promise<void> {
  console.log(`[Loop] Chat from ${msg.username}: ${msg.content}`);
  await updateCommsPanel('RESPONDING', msg.content);

  try {
    const response = await chatCompletion(
      SYSTEM_PERSONA,
      fillTemplate(CHAT_RESPONSE_PROMPT, {
        defconLevel: store.getDefconLevel(),
        recentIntel: store.getRecentSummary(3),
        username: msg.username,
        message: msg.content,
      }),
    );

    if (response) {
      await speak(response);
      await sendChatMessage(response);
    }
  } catch (err) {
    console.error('[Loop] Chat response failed:', err);
  }

  await updateCommsPanel('IDLE', '');
}

async function handleCommand(cmd: { command: string; args: string; username: string }): Promise<void> {
  console.log(`[Loop] Command !${cmd.command} from ${cmd.username}`);

  switch (cmd.command) {
    case 'sitrep':
      bus.emit('sitrep:request');
      break;

    case 'defcon': {
      const level = store.getDefconLevel();
      const msg = `Current threat level: DEFCON ${level}. All monitoring systems operational.`;
      await sendChatMessage(msg);
      await speak(msg);
      break;
    }

    case 'status': {
      const uptime = Math.round((Date.now() - startTime) / 60_000);
      const response = await chatCompletion(
        SYSTEM_PERSONA,
        fillTemplate(STATUS_PROMPT, {
          defconLevel: store.getDefconLevel(),
          feedStatus: 'RSS/GDELT/ADS-B/AIS',
          articleCount: store.getItemCount(),
          uptime: `${uptime} minutes`,
        }),
      );
      if (response) {
        await sendChatMessage(response);
        await speak(response);
      }
      break;
    }

    case 'intel': {
      const recent = store.getRecent(5);
      if (recent.length === 0) {
        await sendChatMessage('No intelligence items logged yet. Feeds initializing.');
      } else {
        const summary = recent
          .map(i => `[${i.source}] ${i.title.substring(0, 80)}`)
          .join(' | ');
        await sendChatMessage(`Recent intel: ${summary}`);
      }
      break;
    }

    default:
      await sendChatMessage(`Unknown directive: !${cmd.command}. Available: !sitrep !defcon !status !intel`);
  }
}
