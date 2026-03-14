import { GameState } from '../../game/state';

// Species that are rare/valuable and worth catching
const RARE_SPECIES_IDS = new Set([
  0x15, // Mew
  0x83, // Mewtwo
  0x49, // Moltres
  0x4A, // Articuno
  0x4B, // Zapdos
  0x84, // Snorlax
  0x13, // Lapras
  0x94, // Abra
  0x54, // Pikachu
  0x14, // Arcanine
  0x0E, // Gengar
  0x42, // Dragonite
  0x58, // Dratini
  0x59, // Dragonair
  0x67, // Eevee
  0x1A, // Scyther
  0x1D, // Pinsir
  0x3C, // Tauros
  0x28, // Chansey
  0xAA, // Porygon
  0xAB, // Aerodactyl
  0x85, // Magikarp (for the memes)
]);

export function shouldCatch(state: GameState): boolean {
  if (!state.battle.isWild) return false;

  const totalBalls = state.inventory.pokeballs + state.inventory.greatballs + state.inventory.ultraballs;
  if (totalBalls <= 0) return false;

  // Party not full? Catch almost anything
  if (state.party.count < 6) {
    return true;
  }

  // Party full — only catch rare/valuable pokemon
  if (RARE_SPECIES_IDS.has(state.battle.enemySpecies)) {
    return true;
  }

  // Low enemy HP makes catching easier — try if we have lots of balls
  if (totalBalls > 10 && state.battle.enemyHpCurrent < state.battle.enemyHpMax * 0.3) {
    return Math.random() < 0.3; // 30% chance to try
  }

  return false;
}
