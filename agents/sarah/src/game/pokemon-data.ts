// Pokemon Red species index -> name (Gen 1 internal IDs, NOT pokedex numbers)
// In Gen 1, species IDs in memory are internal index numbers, not National Dex numbers.
// This maps internal ID -> name.
const SPECIES_NAMES: Record<number, string> = {
  0x01: 'Rhydon', 0x02: 'Kangaskhan', 0x03: 'Nidoran M', 0x04: 'Clefairy',
  0x05: 'Spearow', 0x06: 'Voltorb', 0x07: 'Nidoking', 0x08: 'Slowbro',
  0x09: 'Ivysaur', 0x0A: 'Exeggutor', 0x0B: 'Lickitung', 0x0C: 'Exeggcute',
  0x0D: 'Grimer', 0x0E: 'Gengar', 0x0F: 'Nidoran F', 0x10: 'Nidoqueen',
  0x11: 'Cubone', 0x12: 'Rhyhorn', 0x13: 'Lapras', 0x14: 'Arcanine',
  0x15: 'Mew', 0x16: 'Gyarados', 0x17: 'Shellder', 0x18: 'Tentacool',
  0x19: 'Gastly', 0x1A: 'Scyther', 0x1B: 'Staryu', 0x1C: 'Blastoise',
  0x1D: 'Pinsir', 0x1E: 'Tangela', 0x21: 'Growlithe', 0x22: 'Onix',
  0x23: 'Fearow', 0x24: 'Pidgey', 0x25: 'Slowpoke', 0x26: 'Kadabra',
  0x27: 'Graveler', 0x28: 'Chansey', 0x29: 'Machoke', 0x2A: 'Mr. Mime',
  0x2B: 'Hitmonlee', 0x2C: 'Hitmonchan', 0x2D: 'Arbok', 0x2E: 'Parasect',
  0x2F: 'Psyduck', 0x30: 'Drowzee', 0x31: 'Golem', 0x33: 'Magmar',
  0x35: 'Electabuzz', 0x36: 'Magneton', 0x37: 'Koffing', 0x39: 'Mankey',
  0x3A: 'Seel', 0x3B: 'Diglett', 0x3C: 'Tauros', 0x40: "Farfetch'd",
  0x41: 'Venonat', 0x42: 'Dragonite', 0x46: 'Doduo', 0x47: 'Poliwag',
  0x48: 'Jynx', 0x49: 'Moltres', 0x4A: 'Articuno', 0x4B: 'Zapdos',
  0x4C: 'Ditto', 0x4D: 'Meowth', 0x4E: 'Krabby', 0x52: 'Vulpix',
  0x53: 'Ninetales', 0x54: 'Pikachu', 0x55: 'Raichu', 0x58: 'Dratini',
  0x59: 'Dragonair', 0x5A: 'Kabuto', 0x5B: 'Kabutops', 0x5C: 'Horsea',
  0x5D: 'Seadra', 0x60: 'Sandshrew', 0x61: 'Sandslash', 0x62: 'Omanyte',
  0x63: 'Omastar', 0x65: 'Jigglypuff', 0x66: 'Wigglytuff', 0x67: 'Eevee',
  0x68: 'Flareon', 0x69: 'Jolteon', 0x6A: 'Vaporeon', 0x6B: 'Machop',
  0x6C: 'Zubat', 0x6D: 'Ekans', 0x6E: 'Paras', 0x6F: 'Poliwhirl',
  0x70: 'Poliwrath', 0x71: 'Weedle', 0x72: 'Kakuna', 0x73: 'Beedrill',
  0x74: 'Dodrio', 0x75: 'Primeape', 0x76: 'Dugtrio', 0x77: 'Venomoth',
  0x78: 'Dewgong', 0x7B: 'Caterpie', 0x7C: 'Metapod', 0x7D: 'Butterfree',
  0x7E: 'Machamp', 0x80: 'Golduck', 0x81: 'Hypno', 0x82: 'Golbat',
  0x83: 'Mewtwo', 0x84: 'Snorlax', 0x85: 'Magikarp', 0x88: 'Muk',
  0x8A: 'Kingler', 0x8B: 'Cloyster', 0x8D: 'Electrode', 0x8E: 'Clefable',
  0x8F: 'Weezing', 0x90: 'Persian', 0x91: 'Marowak', 0x93: 'Haunter',
  0x94: 'Abra', 0x95: 'Alakazam', 0x96: 'Pidgeotto', 0x97: 'Pidgeot',
  0x98: 'Starmie', 0x99: 'Bulbasaur', 0x9A: 'Venusaur', 0x9B: 'Tentacruel',
  0x9D: 'Goldeen', 0x9E: 'Seaking', 0xA3: 'Ponyta', 0xA4: 'Rapidash',
  0xA5: 'Rattata', 0xA6: 'Raticate', 0xA7: 'Nidorino', 0xA8: 'Nidorina',
  0xA9: 'Geodude', 0xAA: 'Porygon', 0xAB: 'Aerodactyl', 0xAD: 'Magnemite',
  0xB0: 'Charmander', 0xB1: 'Squirtle', 0xB2: 'Charmeleon', 0xB3: 'Wartortle',
  0xB4: 'Charizard', 0xB9: 'Oddish', 0xBA: 'Gloom', 0xBB: 'Vileplume',
  0xBC: 'Bellsprout', 0xBD: 'Weepinbell', 0xBE: 'Victreebel',
};

export function getSpeciesName(id: number): string {
  return SPECIES_NAMES[id] || `Pokemon#${id}`;
}

// Gen 1 move index -> name (all 165 moves)
const MOVE_NAMES: Record<number, string> = {
  1: 'Pound', 2: 'Karate Chop', 3: 'Double Slap', 4: 'Comet Punch',
  5: 'Mega Punch', 6: 'Pay Day', 7: 'Fire Punch', 8: 'Ice Punch',
  9: 'Thunder Punch', 10: 'Scratch', 11: 'Vice Grip', 12: 'Guillotine',
  13: 'Razor Wind', 14: 'Swords Dance', 15: 'Cut', 16: 'Gust',
  17: 'Wing Attack', 18: 'Whirlwind', 19: 'Fly', 20: 'Bind',
  21: 'Slam', 22: 'Vine Whip', 23: 'Stomp', 24: 'Double Kick',
  25: 'Mega Kick', 26: 'Jump Kick', 27: 'Rolling Kick', 28: 'Sand Attack',
  29: 'Headbutt', 30: 'Horn Attack', 31: 'Fury Attack', 32: 'Horn Drill',
  33: 'Tackle', 34: 'Body Slam', 35: 'Wrap', 36: 'Take Down',
  37: 'Thrash', 38: 'Double-Edge', 39: 'Tail Whip', 40: 'Poison Sting',
  41: 'Twineedle', 42: 'Pin Missile', 43: 'Leer', 44: 'Bite',
  45: 'Growl', 46: 'Roar', 47: 'Sing', 48: 'Supersonic',
  49: 'Sonic Boom', 50: 'Disable', 51: 'Acid', 52: 'Ember',
  53: 'Flamethrower', 54: 'Mist', 55: 'Water Gun', 56: 'Hydro Pump',
  57: 'Surf', 58: 'Ice Beam', 59: 'Blizzard', 60: 'Psybeam',
  61: 'Bubble Beam', 62: 'Aurora Beam', 63: 'Hyper Beam', 64: 'Peck',
  65: 'Drill Peck', 66: 'Submission', 67: 'Low Kick', 68: 'Counter',
  69: 'Seismic Toss', 70: 'Strength', 71: 'Absorb', 72: 'Mega Drain',
  73: 'Leech Seed', 74: 'Growth', 75: 'Razor Leaf', 76: 'Solar Beam',
  77: 'Poison Powder', 78: 'Stun Spore', 79: 'Sleep Powder', 80: 'Petal Dance',
  81: 'String Shot', 82: 'Dragon Rage', 83: 'Fire Spin', 84: 'Thunder Shock',
  85: 'Thunderbolt', 86: 'Thunder Wave', 87: 'Thunder', 88: 'Rock Throw',
  89: 'Earthquake', 90: 'Fissure', 91: 'Dig', 92: 'Toxic',
  93: 'Confusion', 94: 'Psychic', 95: 'Hypnosis', 96: 'Meditate',
  97: 'Agility', 98: 'Quick Attack', 99: 'Rage', 100: 'Teleport',
  101: 'Night Shade', 102: 'Mimic', 103: 'Screech', 104: 'Double Team',
  105: 'Recover', 106: 'Harden', 107: 'Minimize', 108: 'Smokescreen',
  109: 'Confuse Ray', 110: 'Withdraw', 111: 'Defense Curl', 112: 'Barrier',
  113: 'Light Screen', 114: 'Haze', 115: 'Reflect', 116: 'Focus Energy',
  117: 'Bide', 118: 'Metronome', 119: 'Mirror Move', 120: 'Self-Destruct',
  121: 'Egg Bomb', 122: 'Lick', 123: 'Smog', 124: 'Sludge',
  125: 'Bone Club', 126: 'Fire Blast', 127: 'Waterfall', 128: 'Clamp',
  129: 'Swift', 130: 'Skull Bash', 131: 'Spike Cannon', 132: 'Constrict',
  133: 'Amnesia', 134: 'Kinesis', 135: 'Soft-Boiled', 136: 'High Jump Kick',
  137: 'Glare', 138: 'Dream Eater', 139: 'Poison Gas', 140: 'Barrage',
  141: 'Leech Life', 142: 'Lovely Kiss', 143: 'Sky Attack', 144: 'Transform',
  145: 'Bubble', 146: 'Dizzy Punch', 147: 'Spore', 148: 'Flash',
  149: 'Psywave', 150: 'Splash', 151: 'Acid Armor', 152: 'Crabhammer',
  153: 'Explosion', 154: 'Fury Swipes', 155: 'Bonemerang', 156: 'Rest',
  157: 'Rock Slide', 158: 'Hyper Fang', 159: 'Sharpen', 160: 'Conversion',
  161: 'Tri Attack', 162: 'Super Fang', 163: 'Slash', 164: 'Substitute',
  165: 'Struggle',
};

export function getMoveName(id: number): string {
  return MOVE_NAMES[id] || `Move#${id}`;
}

// Gen 1 type IDs (as stored in pokemon data)
export enum PokemonType {
  NORMAL = 0x00,
  FIGHTING = 0x01,
  FLYING = 0x02,
  POISON = 0x03,
  GROUND = 0x04,
  ROCK = 0x05,
  BUG = 0x07,
  GHOST = 0x08,
  FIRE = 0x14,
  WATER = 0x15,
  GRASS = 0x16,
  ELECTRIC = 0x17,
  PSYCHIC = 0x18,
  ICE = 0x19,
  DRAGON = 0x1A,
}

// Move -> type mapping (covering important moves)
export const MOVE_TYPES: Record<number, PokemonType> = {
  1: PokemonType.NORMAL, 2: PokemonType.FIGHTING, 3: PokemonType.NORMAL,
  4: PokemonType.NORMAL, 5: PokemonType.NORMAL, 6: PokemonType.NORMAL,
  7: PokemonType.FIRE, 8: PokemonType.ICE, 9: PokemonType.ELECTRIC,
  10: PokemonType.NORMAL, 11: PokemonType.NORMAL, 12: PokemonType.NORMAL,
  13: PokemonType.NORMAL, 14: PokemonType.NORMAL, 15: PokemonType.NORMAL,
  16: PokemonType.NORMAL, 17: PokemonType.FLYING, 18: PokemonType.NORMAL,
  19: PokemonType.FLYING, 20: PokemonType.NORMAL, 21: PokemonType.NORMAL,
  22: PokemonType.GRASS, 23: PokemonType.NORMAL, 24: PokemonType.FIGHTING,
  25: PokemonType.NORMAL, 26: PokemonType.FIGHTING, 27: PokemonType.FIGHTING,
  28: PokemonType.GROUND, 29: PokemonType.NORMAL, 30: PokemonType.NORMAL,
  31: PokemonType.NORMAL, 32: PokemonType.NORMAL, 33: PokemonType.NORMAL,
  34: PokemonType.NORMAL, 35: PokemonType.NORMAL, 36: PokemonType.NORMAL,
  37: PokemonType.NORMAL, 38: PokemonType.NORMAL, 39: PokemonType.NORMAL,
  40: PokemonType.POISON, 41: PokemonType.BUG, 42: PokemonType.BUG,
  43: PokemonType.NORMAL, 44: PokemonType.NORMAL, 45: PokemonType.NORMAL,
  46: PokemonType.NORMAL, 47: PokemonType.NORMAL, 48: PokemonType.NORMAL,
  49: PokemonType.NORMAL, 50: PokemonType.NORMAL, 51: PokemonType.POISON,
  52: PokemonType.FIRE, 53: PokemonType.FIRE, 54: PokemonType.ICE,
  55: PokemonType.WATER, 56: PokemonType.WATER, 57: PokemonType.WATER,
  58: PokemonType.ICE, 59: PokemonType.ICE, 60: PokemonType.PSYCHIC,
  61: PokemonType.WATER, 62: PokemonType.ICE, 63: PokemonType.NORMAL,
  64: PokemonType.FLYING, 65: PokemonType.FLYING, 66: PokemonType.FIGHTING,
  67: PokemonType.FIGHTING, 68: PokemonType.FIGHTING, 69: PokemonType.FIGHTING,
  70: PokemonType.NORMAL, 71: PokemonType.GRASS, 72: PokemonType.GRASS,
  73: PokemonType.GRASS, 74: PokemonType.NORMAL, 75: PokemonType.GRASS,
  76: PokemonType.GRASS, 77: PokemonType.POISON, 78: PokemonType.GRASS,
  79: PokemonType.GRASS, 80: PokemonType.GRASS, 81: PokemonType.BUG,
  82: PokemonType.DRAGON, 83: PokemonType.FIRE, 84: PokemonType.ELECTRIC,
  85: PokemonType.ELECTRIC, 86: PokemonType.ELECTRIC, 87: PokemonType.ELECTRIC,
  88: PokemonType.ROCK, 89: PokemonType.GROUND, 90: PokemonType.GROUND,
  91: PokemonType.GROUND, 92: PokemonType.POISON, 93: PokemonType.PSYCHIC,
  94: PokemonType.PSYCHIC, 95: PokemonType.PSYCHIC, 96: PokemonType.PSYCHIC,
  97: PokemonType.PSYCHIC, 98: PokemonType.NORMAL, 99: PokemonType.NORMAL,
  100: PokemonType.PSYCHIC, 101: PokemonType.GHOST, 102: PokemonType.NORMAL,
  103: PokemonType.NORMAL, 104: PokemonType.NORMAL, 105: PokemonType.NORMAL,
  106: PokemonType.NORMAL, 107: PokemonType.NORMAL, 108: PokemonType.NORMAL,
  109: PokemonType.GHOST, 110: PokemonType.WATER, 111: PokemonType.NORMAL,
  112: PokemonType.PSYCHIC, 113: PokemonType.PSYCHIC, 114: PokemonType.ICE,
  115: PokemonType.PSYCHIC, 116: PokemonType.NORMAL, 117: PokemonType.NORMAL,
  118: PokemonType.NORMAL, 119: PokemonType.FLYING, 120: PokemonType.NORMAL,
  121: PokemonType.NORMAL, 122: PokemonType.GHOST, 123: PokemonType.POISON,
  124: PokemonType.POISON, 125: PokemonType.GROUND, 126: PokemonType.FIRE,
  127: PokemonType.WATER, 128: PokemonType.WATER, 129: PokemonType.NORMAL,
  130: PokemonType.NORMAL, 131: PokemonType.NORMAL, 132: PokemonType.NORMAL,
  133: PokemonType.PSYCHIC, 134: PokemonType.PSYCHIC, 135: PokemonType.NORMAL,
  136: PokemonType.FIGHTING, 137: PokemonType.NORMAL, 138: PokemonType.PSYCHIC,
  139: PokemonType.POISON, 140: PokemonType.NORMAL, 141: PokemonType.BUG,
  142: PokemonType.NORMAL, 143: PokemonType.FLYING, 144: PokemonType.NORMAL,
  145: PokemonType.WATER, 146: PokemonType.NORMAL, 147: PokemonType.GRASS,
  148: PokemonType.NORMAL, 149: PokemonType.PSYCHIC, 150: PokemonType.NORMAL,
  151: PokemonType.POISON, 152: PokemonType.WATER, 153: PokemonType.NORMAL,
  154: PokemonType.NORMAL, 155: PokemonType.GROUND, 156: PokemonType.PSYCHIC,
  157: PokemonType.ROCK, 158: PokemonType.NORMAL, 159: PokemonType.NORMAL,
  160: PokemonType.NORMAL, 161: PokemonType.NORMAL, 162: PokemonType.NORMAL,
  163: PokemonType.NORMAL, 164: PokemonType.NORMAL, 165: PokemonType.NORMAL,
};

// Move power table (0 = status move)
export const MOVE_POWER: Record<number, number> = {
  1: 40, 2: 50, 3: 15, 4: 18, 5: 80, 6: 40, 7: 75, 8: 75, 9: 75,
  10: 40, 11: 55, 12: 0, 13: 80, 14: 0, 15: 50, 16: 40, 17: 35,
  18: 0, 19: 70, 20: 15, 21: 80, 22: 35, 23: 65, 24: 30, 25: 120,
  26: 70, 27: 60, 28: 0, 29: 70, 30: 65, 31: 15, 32: 0, 33: 35,
  34: 85, 35: 15, 36: 90, 37: 90, 38: 100, 39: 0, 40: 15, 41: 25,
  42: 14, 43: 0, 44: 60, 45: 0, 46: 0, 47: 0, 48: 0, 49: 20,
  50: 0, 51: 40, 52: 40, 53: 95, 54: 0, 55: 40, 56: 120, 57: 95,
  58: 95, 59: 120, 60: 65, 61: 65, 62: 65, 63: 150, 64: 35, 65: 80,
  66: 80, 67: 50, 68: 0, 69: 0, 70: 80, 71: 20, 72: 40, 73: 0,
  74: 0, 75: 55, 76: 120, 77: 0, 78: 0, 79: 0, 80: 70, 81: 0,
  82: 40, 83: 15, 84: 40, 85: 95, 86: 0, 87: 120, 88: 50, 89: 100,
  90: 0, 91: 100, 92: 0, 93: 50, 94: 90, 95: 0, 96: 0, 97: 0,
  98: 40, 99: 20, 100: 0, 101: 0, 102: 0, 103: 0, 104: 0, 105: 0,
  106: 0, 107: 0, 108: 0, 109: 0, 110: 0, 111: 0, 112: 0, 113: 0,
  114: 0, 115: 0, 116: 0, 117: 0, 118: 0, 119: 0, 120: 130, 121: 100,
  122: 20, 123: 20, 124: 65, 125: 65, 126: 120, 127: 80, 128: 35,
  129: 60, 130: 100, 131: 20, 132: 10, 133: 0, 134: 0, 135: 0,
  136: 85, 137: 0, 138: 100, 139: 0, 140: 15, 141: 20, 142: 0,
  143: 140, 144: 0, 145: 20, 146: 70, 147: 0, 148: 0, 149: 0,
  150: 0, 151: 0, 152: 90, 153: 170, 154: 18, 155: 50, 156: 0,
  157: 75, 158: 80, 159: 0, 160: 0, 161: 80, 162: 0, 163: 70,
  164: 0, 165: 50,
};

// Item IDs
export const POKEBALL_IDS = {
  POKEBALL: 0x04,
  GREAT_BALL: 0x03,
  ULTRA_BALL: 0x02,
  MASTER_BALL: 0x01,
} as const;

export const POTION_IDS = {
  POTION: 0x14,
  SUPER_POTION: 0x13,
  HYPER_POTION: 0x12,
  MAX_POTION: 0x11,
  FULL_RESTORE: 0x10,
} as const;

const ITEM_NAMES: Record<number, string> = {
  0x01: 'Master Ball', 0x02: 'Ultra Ball', 0x03: 'Great Ball', 0x04: 'Poke Ball',
  0x05: 'Town Map', 0x06: 'Bicycle', 0x09: 'Moon Stone', 0x0A: 'Antidote',
  0x0B: 'Burn Heal', 0x0C: 'Ice Heal', 0x0D: 'Awakening', 0x0E: 'Parlyz Heal',
  0x0F: 'Full Restore', 0x10: 'Full Restore', 0x11: 'Max Potion',
  0x12: 'Hyper Potion', 0x13: 'Super Potion', 0x14: 'Potion',
  0x15: 'Boulderbadge', 0x16: 'Cascadebadge', 0x17: 'Thunderbadge',
  0x18: 'Rainbowbadge', 0x19: 'Soulbadge', 0x1A: 'Marshbadge',
  0x1B: 'Volcanobadge', 0x1C: 'Earthbadge',
  0x1D: 'Escape Rope', 0x1E: 'Repel', 0x1F: 'Old Amber',
  0x20: 'Fire Stone', 0x21: 'Thunder Stone', 0x22: 'Water Stone',
  0x23: 'HP Up', 0x24: 'Protein', 0x25: 'Iron', 0x26: 'Carbos',
  0x27: 'Calcium', 0x28: 'Rare Candy', 0x29: 'Dome Fossil', 0x2A: 'Helix Fossil',
  0x2B: 'Secret Key', 0x2C: 'Unused', 0x2D: 'Bike Voucher',
  0x2E: 'X Accuracy', 0x2F: 'Leaf Stone', 0x30: 'Card Key',
  0x31: 'Nugget', 0x32: 'PP Up', 0x33: "Poke Doll",
  0x34: 'Full Heal', 0x35: 'Revive', 0x36: 'Max Revive',
  0x37: 'Guard Spec.', 0x38: 'Super Repel', 0x39: 'Max Repel',
  0x3A: 'Dire Hit', 0x3B: 'Coin', 0x3C: 'Fresh Water',
  0x3D: 'Soda Pop', 0x3E: 'Lemonade', 0x3F: 'S.S. Ticket',
  0x40: 'Gold Teeth', 0x41: 'X Attack', 0x42: 'X Defend',
  0x43: 'X Speed', 0x44: 'X Special', 0x45: 'Coin Case',
  0x46: "Oak's Parcel", 0x47: 'Itemfinder', 0x48: 'Silph Scope',
  0x49: 'Poke Flute', 0x4A: 'Lift Key', 0x4B: 'Exp. All',
  0x4C: 'Old Rod', 0x4D: 'Good Rod', 0x4E: 'Super Rod',
  0x4F: 'PP Up', 0x50: 'Ether', 0x51: 'Max Ether',
  0x52: 'Elixir', 0x53: 'Max Elixir',
  0xC4: 'HM01', 0xC5: 'HM02', 0xC6: 'HM03', 0xC7: 'HM04', 0xC8: 'HM05',
  0xC9: 'TM01', 0xCA: 'TM02', 0xCB: 'TM03', 0xCC: 'TM04', 0xCD: 'TM05',
  0xCE: 'TM06', 0xCF: 'TM07', 0xD0: 'TM08', 0xD1: 'TM09', 0xD2: 'TM10',
  0xD3: 'TM11', 0xD4: 'TM12', 0xD5: 'TM13', 0xD6: 'TM14', 0xD7: 'TM15',
  0xD8: 'TM16', 0xD9: 'TM17', 0xDA: 'TM18', 0xDB: 'TM19', 0xDC: 'TM20',
  0xDD: 'TM21', 0xDE: 'TM22', 0xDF: 'TM23', 0xE0: 'TM24', 0xE1: 'TM25',
  0xE2: 'TM26', 0xE3: 'TM27', 0xE4: 'TM28', 0xE5: 'TM29', 0xE6: 'TM30',
  0xE7: 'TM31', 0xE8: 'TM32', 0xE9: 'TM33', 0xEA: 'TM34', 0xEB: 'TM35',
  0xEC: 'TM36', 0xED: 'TM37', 0xEE: 'TM38', 0xEF: 'TM39', 0xF0: 'TM40',
  0xF1: 'TM41', 0xF2: 'TM42', 0xF3: 'TM43', 0xF4: 'TM44', 0xF5: 'TM45',
  0xF6: 'TM46', 0xF7: 'TM47', 0xF8: 'TM48', 0xF9: 'TM49', 0xFA: 'TM50',
};

export function getItemName(id: number): string {
  return ITEM_NAMES[id] || `Item#${id}`;
}

// Gen 1 type effectiveness chart
// Rows = attacking type, Cols = defending type
// Order: Normal, Fighting, Flying, Poison, Ground, Rock, Bug, Ghost, Fire, Water, Grass, Electric, Psychic, Ice, Dragon
// 0 = immune, 0.5 = not very effective, 1 = normal, 2 = super effective

// Map PokemonType enum values to chart indices
const TYPE_TO_INDEX: Record<number, number> = {
  [PokemonType.NORMAL]: 0, [PokemonType.FIGHTING]: 1, [PokemonType.FLYING]: 2,
  [PokemonType.POISON]: 3, [PokemonType.GROUND]: 4, [PokemonType.ROCK]: 5,
  [PokemonType.BUG]: 6, [PokemonType.GHOST]: 7, [PokemonType.FIRE]: 8,
  [PokemonType.WATER]: 9, [PokemonType.GRASS]: 10, [PokemonType.ELECTRIC]: 11,
  [PokemonType.PSYCHIC]: 12, [PokemonType.ICE]: 13, [PokemonType.DRAGON]: 14,
};

//                          NOR FIG FLY POI GRO ROC BUG GHO FIR WAT GRA ELE PSY ICE DRA
const EFFECTIVENESS: number[][] = [
  /* NORMAL   */ [1,   1,   1,   1,   1,  .5,  1,   0,  1,   1,   1,   1,   1,   1,   1],
  /* FIGHTING */ [2,   1,  .5,  .5,   1,   2,  .5,   0,  1,   1,   1,   1,  .5,   2,   1],
  /* FLYING   */ [1,   2,   1,   1,   1,  .5,   2,   1,  1,   1,   2,  .5,   1,   1,   1],
  /* POISON   */ [1,   1,   1,  .5,  .5,  .5,   2,  .5,  1,   1,   2,   1,   1,   1,   1],
  /* GROUND   */ [1,   1,   0,   2,   1,   2,  .5,   1,  2,   1,  .5,   2,   1,   1,   1],
  /* ROCK     */ [1,  .5,   2,   1,  .5,   1,   2,   1,  2,   1,   1,   1,   1,   2,   1],
  /* BUG      */ [1,  .5,  .5,   2,   1,   1,   1,  .5,  .5,  1,   2,   1,   2,   1,   1],
  /* GHOST    */ [0,   1,   1,   1,   1,   1,   1,   2,  1,   1,   1,   1,   0,   1,   1],
  /* FIRE     */ [1,   1,   1,   1,   1,  .5,   2,   1,  .5,  .5,  2,   1,   1,   2,  .5],
  /* WATER    */ [1,   1,   1,   1,   2,   2,   1,   1,  2,  .5,  .5,  1,   1,   1,  .5],
  /* GRASS    */ [1,   1,  .5,  .5,   2,   2,  .5,   1,  .5,  2,  .5,  1,   1,   1,  .5],
  /* ELECTRIC */ [1,   1,   2,   1,   0,   1,   1,   1,  1,   2,  .5,  .5,  1,   1,  .5],
  /* PSYCHIC  */ [1,   2,   1,   2,   1,   1,   1,   1,  1,   1,   1,   1,  .5,  1,   1],
  /* ICE      */ [1,   1,   2,   1,   2,   1,   1,   1,  1,  .5,  2,   1,   1,  .5,  2],
  /* DRAGON   */ [1,   1,   1,   1,   1,   1,   1,   1,  1,   1,   1,   1,   1,   1,   2],
];

export function getTypeEffectiveness(attackType: number, defType1: number, defType2: number): number {
  const atkIdx = TYPE_TO_INDEX[attackType];
  const def1Idx = TYPE_TO_INDEX[defType1];
  const def2Idx = TYPE_TO_INDEX[defType2];

  if (atkIdx === undefined) return 1;

  let multiplier = 1;
  if (def1Idx !== undefined) {
    multiplier *= EFFECTIVENESS[atkIdx][def1Idx];
  }
  if (def2Idx !== undefined && defType2 !== defType1) {
    multiplier *= EFFECTIVENESS[atkIdx][def2Idx];
  }
  return multiplier;
}

// Gym leader info for badge tracking
export const GYM_BADGES: string[] = [
  'Boulder Badge',   // Brock
  'Cascade Badge',   // Misty
  'Thunder Badge',   // Lt. Surge
  'Rainbow Badge',   // Erika
  'Soul Badge',      // Koga
  'Marsh Badge',     // Sabrina
  'Volcano Badge',   // Blaine
  'Earth Badge',     // Giovanni
];

export function getEarnedBadges(bitmask: number): string[] {
  const earned: string[] = [];
  for (let i = 0; i < 8; i++) {
    if (bitmask & (1 << i)) {
      earned.push(GYM_BADGES[i]);
    }
  }
  return earned;
}
