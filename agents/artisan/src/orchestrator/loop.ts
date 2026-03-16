import type { Page } from 'puppeteer-core';
import { bus, type ChatMessageEvent, type CommandEvent } from './events';
import { tickScheduler, setCurrentMode, setCurrentPalette } from './scheduler';
import { chatCompletion } from '../brain/llm-client';
import { generateImage } from '../brain/image-client';
import { buildSystemPrompt, buildChatPrompt, buildDallePrompt } from '../brain/prompt-templates';
import { getCurrentMood, setMood, recordChatActivity, MOOD_EMOJI, type Mood } from '../personality/mood';
import { recordViewer, recordArt } from '../personality/memory';
import { addPendingMessage, flushPending, recordResponse } from '../personality/engagement';
import { sendChatMessage } from '../chat/chat-sender';
import { speak } from '../voice/speech-queue';
import { setAvatarExpression, avatarReact } from '../avatar/avatar-controller';
import { updateVisualParams } from '../visual/modes/transition';
import { transitionToMode } from '../visual/modes/transition';
import { PALETTES, getMoodPalette, getMoodSpeed, MODE_CONFIGS } from '../visual/modes/generative';
import { startDalleReveal, randomRevealType } from '../visual/modes/dalle-reveal';
import { config } from '../config';

let page: Page;
let currentMode = 'flow-field';
let currentPaletteName = 'default';
let tickTimer: ReturnType<typeof setInterval> | null = null;

/** Send a message to chat AND speak it aloud */
async function sayAndSend(text: string): Promise<void> {
  await sendChatMessage(text);
  speak(text).catch(() => {}); // fire-and-forget, don't block chat
}

export function initLoop(puppeteerPage: Page): void {
  page = puppeteerPage;
  setupEventHandlers();
}

export function startLoop(): void {
  if (tickTimer) return;
  console.log(`[Loop] Starting tick every ${config.tickInterval}ms`);
  tickTimer = setInterval(tick, config.tickInterval);
}

export function stopLoop(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

function setupEventHandlers(): void {
  bus.on('chat:message', (msg: ChatMessageEvent) => {
    recordChatActivity();
    recordViewer(msg.username, msg.content);
    addPendingMessage(msg);
  });

  bus.on('chat:command', handleCommand);

  bus.on('mood:change', async (mood: string) => {
    const palette = getMoodPalette(mood);
    const speed = getMoodSpeed(mood);
    await updateVisualParams(page, {
      mood,
      palette,
      speed,
      hudMood: mood,
      hudMoodEmoji: MOOD_EMOJI[mood as Mood] || '',
    });
    await setAvatarExpression(mood as Mood);
  });

  bus.on('visual:mode', async (mode: string) => {
    currentMode = mode;
    setCurrentMode(mode);
    await transitionToMode(page, mode);
  });

  bus.on('visual:palette', async (palette: string[]) => {
    await updateVisualParams(page, { palette });
  });

  bus.on('dalle:complete', async (imageBase64: string, prompt: string) => {
    await startDalleReveal(page, imageBase64, randomRevealType());
    await updateVisualParams(page, {
      hudMode: `Painting: ${prompt.slice(0, 40)}...`,
    });
  });
}

async function handleCommand(cmd: CommandEvent): Promise<void> {
  const { command, args, username } = cmd;

  switch (command) {
    case 'palette': {
      const name = args.toLowerCase();
      if (PALETTES[name]) {
        currentPaletteName = name;
        setCurrentPalette(name);
        await updateVisualParams(page, { palette: PALETTES[name] });
        await sayAndSend(`Nice choice, ${username}! Switching to the ${name} palette`);
      } else {
        const available = Object.keys(PALETTES).join(', ');
        await sayAndSend(`Hmm, I don't have that palette. Try: ${available}`);
      }
      break;
    }
    case 'mood': {
      const mood = args.toLowerCase() as Mood;
      const validMoods: Mood[] = ['serene', 'excited', 'contemplative', 'playful', 'melancholic'];
      if (validMoods.includes(mood)) {
        const prev = setMood(mood);
        bus.emit('mood:change', mood, prev);
        await sayAndSend(`${username} shifted the vibe... feeling ${mood} now.`);
      } else {
        await sayAndSend(`Try one of: ${validMoods.join(', ')}`);
      }
      break;
    }
    case 'draw': {
      if (!args) {
        await sayAndSend('Give me something to paint! Try: !draw sunset over mountains');
        return;
      }
      bus.emit('dalle:start', args);
      await sayAndSend(`Ooh, "${args}"... let me paint that for you, ${username}`);
      await avatarReact('happy');

      const mood = getCurrentMood();
      const prompt = buildDallePrompt(args, mood);
      const imageBase64 = await generateImage(prompt);
      if (imageBase64) {
        bus.emit('dalle:complete', imageBase64, args);
        recordArt(currentMode, currentPaletteName, args);
        await sayAndSend('And there it is... hope you like it!');
      } else {
        await sayAndSend('Hmm, the paint dried up on that one. Try again in a bit?');
      }
      break;
    }
    case 'style': {
      const modeMap: Record<string, string> = {
        flow: 'flow-field',
        particles: 'particles',
        fractals: 'fractals',
        watercolor: 'watercolor',
        geometric: 'geometric',
      };
      const mode = modeMap[args.toLowerCase()];
      if (mode) {
        bus.emit('visual:mode', mode);
        await sayAndSend(`Switching to ${args}... new canvas, new vibes`);
      } else {
        await sayAndSend('Available styles: flow, particles, fractals, watercolor, geometric');
      }
      break;
    }
    case 'speed': {
      const speedMap: Record<string, number> = { slow: 0.4, normal: 1.0, fast: 1.8 };
      const speed = speedMap[args.toLowerCase()];
      if (speed !== undefined) {
        await updateVisualParams(page, { speed });
        await sayAndSend(`Speed set to ${args}. ${speed > 1 ? 'Let\'s go!' : 'Taking it easy...'}`);
      } else {
        await sayAndSend('Try: !speed slow, !speed normal, or !speed fast');
      }
      break;
    }
    case 'info': {
      const mood = getCurrentMood();
      const system = buildSystemPrompt(mood, currentMode, currentPaletteName);
      const response = await chatCompletion(
        system,
        `A viewer asked !info. Briefly describe what you're currently creating and how you're feeling (1-2 sentences).`,
      );
      if (response) await sayAndSend(response);
      break;
    }
  }
}

async function tick(): Promise<void> {
  try {
    // Process pending chat messages
    const decision = flushPending();
    if (decision.shouldRespond && decision.messages.length > 0) {
      const mood = getCurrentMood();
      const system = buildSystemPrompt(mood, currentMode, currentPaletteName);
      const userPrompt = buildChatPrompt(
        decision.messages.map((m) => ({ username: m.username, content: m.content })),
        decision.isGroup,
      );
      const response = await chatCompletion(system, userPrompt);
      if (response) {
        await sayAndSend(response);
        recordResponse();
        await avatarReact('nod');

        // Show last message as bubble
        const lastMsg = decision.messages[decision.messages.length - 1];
        await updateVisualParams(page, {
          chatBubbleUser: lastMsg.username,
          chatBubbleText: lastMsg.content,
          chatBubbleShow: true,
        });
        setTimeout(async () => {
          await updateVisualParams(page, { chatBubbleShow: false }).catch(() => {});
        }, 8000);
      }
    }

    // Tick scheduler for autonomous events
    tickScheduler();
  } catch (err) {
    console.error('[Loop] Tick error:', err);
  }
}
