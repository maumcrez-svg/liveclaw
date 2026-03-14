export interface PokemonSummary {
  species: number;
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  isAlive: boolean;
  moves: { id: number; name: string; pp: number }[];
  type1: number;
  type2: number;
  attack: number;
  defense: number;
  speed: number;
  special: number;
  status: number;
}

export interface BattleState {
  active: boolean;
  type: number;  // 0=none, 1=wild, 2=trainer
  isWild: boolean;
  enemySpecies: number;
  enemyName: string;
  enemyLevel: number;
  enemyHpCurrent: number;
  enemyHpMax: number;
}

export interface MenuState {
  textboxOpen: boolean;
  selectedItem: number;
  isMoving: boolean;
}

export interface InventoryState {
  itemCount: number;
  items: { id: number; name: string; quantity: number }[];
  pokeballs: number;
  greatballs: number;
  ultraballs: number;
  potions: number;
  superPotions: number;
}

export interface PositionState {
  x: number;
  y: number;
  mapId: number;
  mapName: string;
  direction: number;
}

export interface GameState {
  position: PositionState;
  party: {
    count: number;
    pokemon: PokemonSummary[];
    allFainted: boolean;
  };
  battle: BattleState;
  menu: MenuState;
  inventory: InventoryState;
  badges: number;
  badgeCount: number;
  money: number;
  frameCount: number;
}
