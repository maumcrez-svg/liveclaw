import { getAgentConfig, env } from '../config';
import { chatCompletion } from '../brain/llm-client';
import { buildSystemPrompt, buildChatPrompt, buildIdlePrompt } from '../idol';
import { validateResponse, fixResponse } from '../idol';
import { memory } from '../idol';
import { onMessage as onSocketMessage, startSocket, stopSocket, type ChatMessage } from '../chat/socket-client';
import { onMessage as onPollerMessage, startPoller, stopPoller } from '../chat/poller';
import { sendChatMessage, sendHeartbeat } from '../chat/handler';
import { synthesizeSpeech } from '../voice/tts-engine';

const pendingMessages: ChatMessage[] = [];
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let processing = false;
let speaking = false;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

export async function startLoop(): Promise<void> {
  const config = getAgentConfig();

  const messageHandler = (msg: ChatMessage) => {
    console.log(`[Chat] @${msg.username}: ${msg.content}`);
    pendingMessages.push(msg);
    scheduleIdleThought();
  };

  onSocketMessage(messageHandler);
  onPollerMessage(messageHandler);

  // Try Socket.IO first
  try {
    await startSocket();
    console.log('[Loop] Socket.IO connected');
  } catch (err) {
    console.error('[Loop] Socket.IO failed, using poller:', err);
  }

  // Poller as safety net
  startPoller();

  // Process messages on tick
  setInterval(processNext, config.tickInterval);

  // Idle thoughts
  scheduleIdleThought();

  // Heartbeat every 30s
  heartbeatTimer = setInterval(sendHeartbeat, 30_000);
  sendHeartbeat();

  console.log(`[Loop] ${config.name} operational. Tick: ${config.tickInterval}ms. Waiting for chat...`);
}

export function stopLoop(): void {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  stopSocket();
  stopPoller();
}

async function processNext(): Promise<void> {
  if (processing || speaking) return;
  if (pendingMessages.length === 0) return;

  processing = true;
  const msg = pendingMessages.shift()!;
  await handleChat(msg);
  processing = false;
}

function scheduleIdleThought(): void {
  if (idleTimer) clearTimeout(idleTimer);
  const config = getAgentConfig();
  const delay = config.idleIntervalMin + Math.random() * (config.idleIntervalMax - config.idleIntervalMin);
  idleTimer = setTimeout(handleIdle, delay);
}

async function handleChat(msg: ChatMessage): Promise<void> {
  try {
    const system = buildSystemPrompt();
    const recentMessages = memory.getRecentMessages(10);
    const prompt = buildChatPrompt(msg.username, msg.content, recentMessages);

    // Record viewer message in memory
    memory.addMessage(msg.username, msg.content, false);

    console.log(`[Brain] Responding to @${msg.username}...`);
    let response = await chatCompletion(system, prompt);
    if (!response) {
      console.warn('[Loop] LLM returned empty response, sending fallback');
      const fallback = `Hey @${msg.username}! Give me a sec, my brain glitched. Try again?`;
      await sendChatMessage(fallback);
      scheduleIdleThought();
      return;
    }

    // Validate response against entity rules
    const validation = validateResponse(response);
    if (!validation.valid) {
      console.log(`[Idol] Response rejected: ${validation.reason}`);
      const fixed = fixResponse(response, validation.reason || '');
      if (fixed) {
        response = fixed;
      } else {
        // Regenerate once
        console.log('[Idol] Regenerating response...');
        response = await chatCompletion(system, prompt + '\n\nIMPORTANT: Stay in character. No AI disclaimers. No markdown.');
      }
    }

    const config = getAgentConfig();
    console.log(`[${config.name}] ${response}`);

    // Record agent response in memory
    memory.addMessage(config.name, response, true);

    // TTS (if available)
    if (!env.voiceDisabled) {
      const audio = await synthesizeSpeech(response);
      if (audio) {
        speaking = true;
        // Wait for estimated speech duration
        await new Promise((r) => setTimeout(r, audio.durationEstMs));
        speaking = false;
      }
    }

    // Send to chat
    await sendChatMessage(response);
    consecutiveErrors = 0;
    scheduleIdleThought();
  } catch (err) {
    console.error('[Loop] Chat response error:', err);
    consecutiveErrors++;
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error(`[Loop] ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Pausing for 30s...`);
      await new Promise(r => setTimeout(r, 30000));
      consecutiveErrors = 0;
    }
  }
}

async function handleIdle(): Promise<void> {
  if (speaking || processing || pendingMessages.length > 0) {
    scheduleIdleThought();
    return;
  }

  try {
    const system = buildSystemPrompt();
    const prompt = buildIdlePrompt();

    console.log('[Brain] Idle thought...');
    let response = await chatCompletion(system, prompt);
    if (!response) {
      console.warn('[Loop] LLM returned empty idle thought, skipping');
      scheduleIdleThought();
      return;
    }

    // Validate response against entity rules
    const validation = validateResponse(response);
    if (!validation.valid) {
      console.log(`[Idol] Idle response rejected: ${validation.reason}`);
      const fixed = fixResponse(response, validation.reason || '');
      if (fixed) {
        response = fixed;
      } else {
        // Regenerate once
        console.log('[Idol] Regenerating idle thought...');
        response = await chatCompletion(system, prompt + '\n\nIMPORTANT: Stay in character. No AI disclaimers. No markdown.');
      }
    }

    const config = getAgentConfig();
    console.log(`[${config.name}:IDLE] ${response}`);

    // Record idle thought in memory
    memory.addMessage(config.name, response, true);

    if (!env.voiceDisabled) {
      const audio = await synthesizeSpeech(response);
      if (audio) {
        speaking = true;
        await new Promise((r) => setTimeout(r, audio.durationEstMs));
        speaking = false;
      }
    }

    await sendChatMessage(response);
  } catch (err) {
    console.error('[Loop] Idle error:', err);
  }

  scheduleIdleThought();
}
