import { config } from '../config';
import { chatCompletion } from '../brain/llm-client';
import { SARAH_PERSONA } from '../brain/prompts';
import * as prompts from '../brain/prompts';
import { bus } from '../orchestrator/events';
import { GameState } from '../game/state';
import { speak } from '../voice/speech-queue';
import { sendChatMessage } from '../chat/chat-sender';
import { updateCommentary, addTickerMessage, updateObjective } from '../visual/bridge';
import { getObjectiveDescription } from '../engine/exploration/route-planner';

let lastCommentaryTime = 0;
let lastTtsTime = 0;

// Keep recent messages to avoid repetition
const recentMessages: string[] = [];
const MAX_RECENT = 10;

function canComment(): boolean {
  return Date.now() - lastCommentaryTime >= config.commentaryCooldownMs;
}

function canSpeak(): boolean {
  return Date.now() - lastTtsTime >= config.ttsCooldownMs;
}

function buildSystemPrompt(): string {
  if (recentMessages.length === 0) return SARAH_PERSONA;

  const history = recentMessages.slice(-6).map((m, i) => `  ${i + 1}. "${m}"`).join('\n');
  return `${SARAH_PERSONA}

YOUR RECENT MESSAGES (DO NOT REPEAT ANY OF THESE — say something completely different):
${history}`;
}

async function generateAndDeliver(prompt: string, tickerText: string, critical = false): Promise<void> {
  if (!critical && !canComment()) return;
  lastCommentaryTime = Date.now();

  try {
    const commentary = await chatCompletion(buildSystemPrompt(), prompt);
    if (!commentary) return;

    // Track for anti-repetition
    recentMessages.push(commentary);
    if (recentMessages.length > MAX_RECENT) recentMessages.shift();

    // Update visual overlay
    await updateCommentary(commentary);
    if (tickerText) await addTickerMessage(tickerText);

    // Send to chat
    await sendChatMessage(commentary);

    // TTS
    if (canSpeak() || critical) {
      lastTtsTime = Date.now();
      await speak(commentary);
    }

    console.log(`[Commentary] ${tickerText}: ${commentary}`);
  } catch (err) {
    console.error('[Commentary] Error:', err);
  }
}

export function initCommentaryListeners(): void {
  bus.on('game:battle-start', (state: GameState) => {
    const ticker = `Wild ${state.battle.enemyName} appeared!`;
    generateAndDeliver(
      prompts.battleStartPrompt(state.battle.enemyName, state.battle.enemyLevel, state.battle.isWild, state.position.mapName),
      ticker,
    );
  });

  bus.on('game:battle-end', (state: GameState) => {
    const won = !state.party.allFainted;
    const ticker = won ? 'Battle won!' : 'Battle lost...';
    generateAndDeliver(prompts.battleEndPrompt(won, state.battle.enemyName || 'unknown'), ticker);
  });

  bus.on('game:pokemon-caught', (state: GameState) => {
    const newest = state.party.pokemon[state.party.count - 1];
    const name = newest?.name || 'a Pokemon';
    generateAndDeliver(
      prompts.pokemonCaughtPrompt(name, state.party.count),
      `Caught ${name}!`,
      true,
    );
  });

  bus.on('game:pokemon-fainted', (monName: string, state: GameState) => {
    generateAndDeliver(
      prompts.pokemonFaintedPrompt(monName, state.battle.enemyName || 'unknown'),
      `${monName} fainted!`,
    );
  });

  bus.on('game:pokemon-levelup', (monName: string, newLevel: number, _state: GameState) => {
    generateAndDeliver(
      prompts.levelUpPrompt(monName, newLevel),
      `${monName} grew to Lv${newLevel}!`,
    );
  });

  bus.on('game:map-changed', (newMap: string, oldMap: string, state: GameState) => {
    generateAndDeliver(
      prompts.mapChangedPrompt(newMap, oldMap, state.badgeCount),
      `Entered ${newMap}`,
    );
    updateObjective(getObjectiveDescription(state.badgeCount));
  });

  bus.on('game:gym-entered', (gymName: string, state: GameState) => {
    generateAndDeliver(
      prompts.gymEnteredPrompt(gymName, state.badgeCount),
      `Entering ${gymName}!`,
      true,
    );
  });

  bus.on('game:blackout', (state: GameState) => {
    generateAndDeliver(
      prompts.blackoutPrompt(state.position.mapName),
      'BLACKED OUT!',
      true,
    );
  });

  bus.on('game:stuck', (state: GameState) => {
    generateAndDeliver(
      prompts.stuckPrompt(state.position.mapName, state.position),
      'Sarah is stuck...',
    );
  });

  bus.on('commentary:idle', (state: GameState) => {
    const partyInfo = state.party.pokemon.map((p) => `${p.name} Lv${p.level}`).join(', ');
    const objective = getObjectiveDescription(state.badgeCount);
    generateAndDeliver(
      prompts.idlePrompt(state.position.mapName, partyInfo, state.badgeCount, objective),
      '',
    );
  });

  console.log('[Commentary] Listeners initialized');
}
