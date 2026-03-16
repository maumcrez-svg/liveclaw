import { readByte, readWordBE } from '../emulator/adapter';
import * as addr from './addresses';
import { GameState, PokemonSummary, BattleState, MenuState, InventoryState, PositionState } from './state';
import { getSpeciesName } from './pokemon-data';
import { getMapName } from './map-data';
import { getMoveName } from './pokemon-data';
import { getItemName, POKEBALL_IDS, POTION_IDS } from './pokemon-data';

export function parseGameState(): GameState {
  const position = parsePosition();
  const party = parseParty();
  const battle = parseBattle();
  const menu = parseMenu();
  const inventory = parseInventory();
  const badges = readByte(addr.BADGES);
  const badgeCount = popcount(badges);
  const money = parseBCD(addr.MONEY, 3);
  const frameCount = readByte(addr.FRAME_COUNTER);

  return {
    position,
    party,
    battle,
    menu,
    inventory,
    badges,
    badgeCount,
    money,
    frameCount,
  };
}

function parsePosition(): PositionState {
  const y = readByte(addr.PLAYER_Y);
  const x = readByte(addr.PLAYER_X);
  const mapId = readByte(addr.CURRENT_MAP_ID);
  const direction = readByte(addr.PLAYER_DIRECTION);
  return { x, y, mapId, mapName: getMapName(mapId), direction };
}

function parseParty(): { count: number; pokemon: PokemonSummary[]; allFainted: boolean } {
  const count = Math.min(readByte(addr.PARTY_COUNT), 6);
  const pokemon: PokemonSummary[] = [];

  for (let i = 0; i < count; i++) {
    const base = addr.PARTY_DATA_START + i * addr.PARTY_MON_SIZE;
    const species = readByte(base + addr.MON_SPECIES);
    const currentHp = readWordBE(base + addr.MON_HP_CURRENT);
    const maxHp = readWordBE(base + addr.MON_HP_MAX);
    const level = readByte(base + addr.MON_LEVEL);

    const moves = [
      { id: readByte(base + addr.MON_MOVE1), name: '', pp: readByte(base + addr.MON_PP1) & 0x3f },
      { id: readByte(base + addr.MON_MOVE2), name: '', pp: readByte(base + addr.MON_PP2) & 0x3f },
      { id: readByte(base + addr.MON_MOVE3), name: '', pp: readByte(base + addr.MON_PP3) & 0x3f },
      { id: readByte(base + addr.MON_MOVE4), name: '', pp: readByte(base + addr.MON_PP4) & 0x3f },
    ].filter((m) => m.id !== 0).map((m) => ({ ...m, name: getMoveName(m.id) }));

    pokemon.push({
      species,
      name: getSpeciesName(species),
      level,
      currentHp,
      maxHp,
      isAlive: currentHp > 0,
      moves,
      type1: readByte(base + addr.MON_TYPE1),
      type2: readByte(base + addr.MON_TYPE2),
      attack: readWordBE(base + addr.MON_ATTACK),
      defense: readWordBE(base + addr.MON_DEFENSE),
      speed: readWordBE(base + addr.MON_SPEED),
      special: readWordBE(base + addr.MON_SPECIAL),
      status: readByte(base + addr.MON_STATUS),
    });
  }

  const allFainted = count > 0 && pokemon.every((p) => !p.isAlive);
  return { count, pokemon, allFainted };
}

function parseBattle(): BattleState {
  const type = readByte(addr.BATTLE_TYPE);
  const active = type !== 0;
  return {
    active,
    type,
    isWild: type === 1,
    enemySpecies: active ? readByte(addr.ENEMY_SPECIES) : 0,
    enemyName: active ? getSpeciesName(readByte(addr.ENEMY_SPECIES)) : '',
    enemyLevel: active ? readByte(addr.ENEMY_LEVEL) : 0,
    enemyHpCurrent: active ? readWordBE(addr.ENEMY_HP_CURRENT) : 0,
    enemyHpMax: active ? readWordBE(addr.ENEMY_HP_MAX) : 0,
  };
}

function parseMenu(): MenuState {
  const joyIgnore = readByte(addr.JOY_IGNORE);
  return {
    textboxOpen: readByte(addr.TEXTBOX_ID) !== 0,
    joyIgnore,
    inCutscene: joyIgnore !== 0,
    selectedItem: readByte(addr.MENU_ITEM_ID),
    isMoving: (readByte(addr.MOVEMENT_FLAGS) & 1) !== 0,
    walkCounter: readByte(addr.WALK_COUNTER),
  };
}

function parseInventory(): InventoryState {
  const itemCount = Math.min(readByte(addr.BAG_ITEM_COUNT), 20);
  const items: { id: number; name: string; quantity: number }[] = [];
  let pokeballs = 0;
  let greatballs = 0;
  let ultraballs = 0;
  let potions = 0;
  let superPotions = 0;

  for (let i = 0; i < itemCount; i++) {
    const id = readByte(addr.BAG_ITEMS_START + i * 2);
    const qty = readByte(addr.BAG_ITEMS_START + i * 2 + 1);
    items.push({ id, name: getItemName(id), quantity: qty });

    if (id === POKEBALL_IDS.POKEBALL) pokeballs = qty;
    if (id === POKEBALL_IDS.GREAT_BALL) greatballs = qty;
    if (id === POKEBALL_IDS.ULTRA_BALL) ultraballs = qty;
    if (id === POTION_IDS.POTION) potions = qty;
    if (id === POTION_IDS.SUPER_POTION) superPotions = qty;
  }

  return { itemCount, items, pokeballs, greatballs, ultraballs, potions, superPotions };
}

function popcount(n: number): number {
  let count = 0;
  let v = n;
  while (v) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}

function parseBCD(address: number, bytes: number): number {
  let result = 0;
  for (let i = 0; i < bytes; i++) {
    const byte = readByte(address + i);
    result = result * 100 + ((byte >> 4) * 10 + (byte & 0x0f));
  }
  return result;
}
