import { GameState } from '../game/state';
import { bus } from '../orchestrator/events';
import { isGym } from '../game/map-data';

// Cooldown tracking
const cooldowns: Record<string, number> = {};

function canTrigger(event: string, cooldownMs: number): boolean {
  const now = Date.now();
  const last = cooldowns[event] || 0;
  if (now - last < cooldownMs) return false;
  cooldowns[event] = now;
  return true;
}

export function checkTriggers(prev: GameState, curr: GameState): void {
  // Battle started
  if (!prev.battle.active && curr.battle.active) {
    if (canTrigger('battle:start', 0)) {
      bus.emit('game:battle-start', curr);
    }
  }

  // Battle ended
  if (prev.battle.active && !curr.battle.active) {
    if (canTrigger('battle:end', 0)) {
      bus.emit('game:battle-end', curr);
    }
  }

  // Pokemon caught (party count increased)
  if (curr.party.count > prev.party.count) {
    if (canTrigger('pokemon:caught', 0)) {
      bus.emit('game:pokemon-caught', curr);
    }
  }

  // Pokemon fainted (any party mon went from alive to dead)
  for (let i = 0; i < Math.min(prev.party.count, curr.party.count); i++) {
    const prevMon = prev.party.pokemon[i];
    const currMon = curr.party.pokemon[i];
    if (prevMon && currMon && prevMon.isAlive && !currMon.isAlive) {
      if (canTrigger('pokemon:fainted', 10_000)) {
        bus.emit('game:pokemon-fainted', currMon.name, curr);
      }
    }
  }

  // Pokemon leveled up
  for (let i = 0; i < Math.min(prev.party.count, curr.party.count); i++) {
    const prevMon = prev.party.pokemon[i];
    const currMon = curr.party.pokemon[i];
    if (prevMon && currMon && currMon.level > prevMon.level) {
      if (canTrigger('pokemon:levelup', 5_000)) {
        bus.emit('game:pokemon-levelup', currMon.name, currMon.level, curr);
      }
    }
  }

  // Map changed
  if (prev.position.mapId !== curr.position.mapId) {
    if (canTrigger('map:changed', 30_000)) {
      bus.emit('game:map-changed', curr.position.mapName, prev.position.mapName, curr);
    }

    // Gym entered
    if (isGym(curr.position.mapId)) {
      if (canTrigger('gym:entered', 0)) {
        bus.emit('game:gym-entered', curr.position.mapName, curr);
      }
    }
  }

  // Blackout (all fainted)
  if (!prev.party.allFainted && curr.party.allFainted) {
    if (canTrigger('blackout', 0)) {
      bus.emit('game:blackout', curr);
    }
  }

  // Badge earned
  if (curr.badgeCount > prev.badgeCount) {
    if (canTrigger('badge:earned', 0)) {
      bus.emit('game:badge-earned', curr.badgeCount, curr);
    }
  }
}
