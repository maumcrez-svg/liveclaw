import { config } from '../config';
import { chatCompletion } from '../brain/llm-client';
import * as prompts from '../brain/prompts';
import { bus } from '../orchestrator/events';
import { GameState } from '../game/state';
import { speak } from '../voice/speech-queue';
import { sendChatMessage } from '../chat/chat-sender';
import { updateCommentary, addTickerMessage, updateObjective } from '../visual/bridge';
import { getObjectiveDescription } from '../engine/exploration/route-planner';
import { buildSarahPrompt, updateMoodFromEvent, addMemory, persistState } from '../idol-frame';

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

function buildSystemPrompt(eventType?: string): string {
  // Build dynamic prompt from Idol Frame (identity + mood + memory + rules)
  const base = buildSarahPrompt(eventType);

  if (recentMessages.length === 0) return base;

  const history = recentMessages.slice(-6).map((m, i) => `  ${i + 1}. "${m}"`).join('\n');
  return `${base}

YOUR RECENT MESSAGES (DO NOT REPEAT ANY OF THESE — say something completely different):
${history}`;
}

async function generateAndDeliver(prompt: string, tickerText: string, critical = false, eventType?: string): Promise<void> {
  if (!critical && !canComment()) return;
  lastCommentaryTime = Date.now();

  // Update mood from game event
  if (eventType) updateMoodFromEvent(eventType);

  try {
    const commentary = await chatCompletion(buildSystemPrompt(eventType), prompt);
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
      ticker, false, 'battle_start',
    );
  });

  bus.on('game:battle-end', (state: GameState) => {
    const won = !state.party.allFainted;
    const ticker = won ? 'Battle won!' : 'Battle lost...';
    const evt = won ? 'battle_end_win' : 'battle_end_loss';
    generateAndDeliver(prompts.battleEndPrompt(won, state.battle.enemyName || 'unknown'), ticker, false, evt);
    // Record notable battle
    if (won) addMemory('event', `Beat ${state.battle.enemyName} at ${state.position.mapName}`);
  });

  bus.on('game:pokemon-caught', (state: GameState) => {
    const newest = state.party.pokemon[state.party.count - 1];
    const name = newest?.name || 'a Pokemon';
    generateAndDeliver(
      prompts.pokemonCaughtPrompt(name, state.party.count),
      `Caught ${name}!`, true, 'pokemon_caught',
    );
    addMemory('event', `Caught ${name}! Party now ${state.party.count}/6`);
  });

  bus.on('game:pokemon-fainted', (monName: string, state: GameState) => {
    generateAndDeliver(
      prompts.pokemonFaintedPrompt(monName, state.battle.enemyName || 'unknown'),
      `${monName} fainted!`, false, 'pokemon_fainted',
    );
    addMemory('event', `${monName} fainted to ${state.battle.enemyName}`);
  });

  bus.on('game:pokemon-levelup', (monName: string, newLevel: number, _state: GameState) => {
    generateAndDeliver(
      prompts.levelUpPrompt(monName, newLevel),
      `${monName} grew to Lv${newLevel}!`, false, 'level_up',
    );
    addMemory('event', `${monName} reached Lv${newLevel}!`);
  });

  // Map change: just update objective silently, no commentary (LLM hallucinates about locations)
  bus.on('game:map-changed', (_newMap: string, _oldMap: string, state: GameState) => {
    updateObjective(getObjectiveDescription(state.badgeCount));
  });

  // Gym entered: keep this one — it's a big moment
  bus.on('game:gym-entered', (gymName: string, state: GameState) => {
    generateAndDeliver(
      prompts.gymEnteredPrompt(gymName, state.badgeCount),
      `Entering ${gymName}!`, true, 'gym_entered',
    );
  });

  // Blackout: keep — it's dramatic and real
  bus.on('game:blackout', (state: GameState) => {
    generateAndDeliver(
      prompts.blackoutPrompt(state.position.mapName),
      'BLACKED OUT!', true, 'blackout',
    );
  });

  // Stuck: disabled — FSM is off, stuck detection doesn't apply
  // bus.on('game:stuck', ...);

  bus.on('commentary:idle', (state: GameState) => {
    const partyInfo = state.party.pokemon.map((p) => `${p.name} Lv${p.level}`).join(', ');
    const objective = getObjectiveDescription(state.badgeCount);
    generateAndDeliver(
      prompts.idlePrompt(state.position.mapName, partyInfo, state.badgeCount, objective),
      '', false, 'idle',
    );
  });

  // Persist state periodically (every 5 min via scheduler handles it, but also on important events)
  bus.on('game:badge-earned', (_state: GameState) => {
    addMemory('event', `Earned a new badge!`);
    updateMoodFromEvent('badge_earned');
    persistState();
  });

  console.log('[Commentary] Listeners initialized');
}
