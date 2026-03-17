import { bus, CommandEvent } from '../orchestrator/events';
import { parseGameState } from '../game/state-parser';
import { sendChatMessage } from './chat-sender';
import { getEarnedBadges } from '../game/pokemon-data';
import { getObjectiveDescription } from '../engine/exploration/route-planner';
import { chatCompletion } from '../brain/llm-client';
import { SARAH_PERSONA, chatResponsePrompt } from '../brain/prompts';
import { speak } from '../voice/speech-queue';
import { updateCommentary } from '../visual/bridge';
import { GameState } from '../game/state';
import { sendInput } from '../emulator/input';
import { Button } from '../emulator/adapter';

// Viewer input: maps chat commands to gameboy buttons
const INPUT_COMMANDS: Record<string, Button> = {
  up: Button.UP,
  down: Button.DOWN,
  left: Button.LEFT,
  right: Button.RIGHT,
  a: Button.A,
  b: Button.B,
  start: Button.START,
  select: Button.SELECT,
};

// Rate limit viewer inputs: 1 input per user per 2 seconds
const lastInputTime = new Map<string, number>();
const INPUT_COOLDOWN_MS = 2000;

export function initCommandHandler(): void {
  bus.on('chat:command', async (cmd: CommandEvent) => {
    const state = parseGameState();

    switch (cmd.command) {
      case 'party':
        handleParty(state);
        break;
      case 'badges':
        handleBadges(state);
        break;
      case 'where':
        handleWhere(state);
        break;
      case 'bag':
        handleBag(state);
        break;
      case 'objective':
        handleObjective(state);
        break;
      case 'help':
      case 'commands':
        sendChatMessage('Commands: !up !down !left !right !a !b !start !select — control the game! Also: !party !badges !where !bag !objective');
        break;
      default:
        // Check if it's a gamepad input command
        if (cmd.command in INPUT_COMMANDS) {
          handleViewerInput(cmd.command, cmd.username, cmd.args);
        }
        break;
    }
  });

  bus.on('chat:message', async (msg) => {
    // Respond to regular chat messages occasionally
    try {
      const state = parseGameState();
      const context = `At ${state.position.mapName}, ${state.badgeCount}/8 badges, ${state.battle.active ? 'in battle' : 'exploring'}`;
      const response = await chatCompletion(
        SARAH_PERSONA,
        chatResponsePrompt(msg.username, msg.content, context),
      );
      if (response) {
        await sendChatMessage(response);
        await updateCommentary(response);
        await speak(response);
      }
    } catch (err) {
      console.error('[CommandHandler] Chat response error:', err);
    }
  });

  console.log('[CommandHandler] Initialized');
}

function handleParty(state: GameState): void {
  if (state.party.count === 0) {
    sendChatMessage('No Pokemon in party yet!');
    return;
  }

  const lines = state.party.pokemon.map((p) => {
    const hpPct = p.maxHp > 0 ? Math.round((p.currentHp / p.maxHp) * 100) : 0;
    return `${p.name} Lv${p.level} ${p.currentHp}/${p.maxHp}HP (${hpPct}%)`;
  });
  sendChatMessage(`Party: ${lines.join(' | ')}`);
}

function handleBadges(state: GameState): void {
  const badges = getEarnedBadges(state.badges);
  if (badges.length === 0) {
    sendChatMessage('No badges yet! Still just starting out.');
  } else {
    sendChatMessage(`Badges: ${state.badgeCount}/8 — ${badges.join(', ')}`);
  }
}

function handleWhere(state: GameState): void {
  sendChatMessage(`Location: ${state.position.mapName} (${state.position.x}, ${state.position.y})`);
}

function handleBag(state: GameState): void {
  const balls = state.inventory.pokeballs + state.inventory.greatballs + state.inventory.ultraballs;
  const heals = state.inventory.potions + state.inventory.superPotions;
  sendChatMessage(`Bag: ${balls} Pokeballs, ${heals} Potions, ${state.inventory.itemCount} total items`);
}

function handleObjective(state: GameState): void {
  const obj = getObjectiveDescription(state.badgeCount);
  sendChatMessage(`Current objective: ${obj}`);
}

function handleViewerInput(command: string, username: string, args: string): void {
  const button = INPUT_COMMANDS[command];
  if (!button) return;

  // Rate limit per user
  const now = Date.now();
  const lastTime = lastInputTime.get(username) || 0;
  if (now - lastTime < INPUT_COOLDOWN_MS) return;
  lastInputTime.set(username, now);

  // Parse repeat count: "!up 3" = press up 3 times
  const repeatStr = args.trim();
  let repeat = 1;
  if (repeatStr) {
    const parsed = parseInt(repeatStr, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 9) {
      repeat = parsed;
    }
  }

  // Queue the inputs
  for (let i = 0; i < repeat; i++) {
    sendInput(button, 8);
  }

  console.log(`[Viewer Input] ${username}: !${command}${repeat > 1 ? ` x${repeat}` : ''}`);
}
