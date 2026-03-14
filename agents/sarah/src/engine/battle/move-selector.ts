import { PokemonSummary, BattleState } from '../../game/state';
import { MOVE_TYPES, MOVE_POWER, getTypeEffectiveness, PokemonType } from '../../game/pokemon-data';

interface MoveScore {
  index: number;
  score: number;
  moveId: number;
}

export function selectBestMove(pokemon: PokemonSummary, battle: BattleState): number {
  if (pokemon.moves.length === 0) return 0;

  const scores: MoveScore[] = pokemon.moves.map((move, index) => {
    // No PP = can't use
    if (move.pp <= 0) return { index, score: -1, moveId: move.id };

    const power = MOVE_POWER[move.id] || 0;
    // Status moves get low base score
    if (power === 0) return { index, score: 5, moveId: move.id };

    const moveType = MOVE_TYPES[move.id];
    let score = power;

    // STAB bonus (Same Type Attack Bonus)
    if (moveType !== undefined) {
      if (moveType === pokemon.type1 || moveType === pokemon.type2) {
        score *= 1.5;
      }

      // Type effectiveness vs enemy (we don't always know enemy types from memory,
      // but we can try based on species)
      // For now, use base power + STAB as primary metric
    }

    return { index, score, moveId: move.id };
  });

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Return index of best move (with PP)
  const best = scores.find((s) => s.score > 0);
  return best?.index ?? 0;
}
