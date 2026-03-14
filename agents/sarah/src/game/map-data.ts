const MAP_NAMES: Record<number, string> = {
  0: 'Pallet Town',
  1: 'Viridian City',
  2: 'Pewter City',
  3: 'Cerulean City',
  4: 'Lavender Town',
  5: 'Vermilion City',
  6: 'Celadon City',
  7: 'Fuchsia City',
  8: 'Cinnabar Island',
  9: 'Indigo Plateau',
  10: 'Saffron City',
  12: 'Route 1',
  13: 'Route 2',
  14: 'Route 3',
  15: 'Route 4',
  16: 'Route 5',
  17: 'Route 6',
  18: 'Route 7',
  19: 'Route 8',
  20: 'Route 9',
  21: 'Route 10',
  22: 'Route 11',
  23: 'Route 12',
  24: 'Route 13',
  25: 'Route 14',
  26: 'Route 15',
  27: 'Route 16',
  28: 'Route 17',
  29: 'Route 18',
  30: 'Route 19',
  31: 'Route 20',
  32: 'Route 21',
  33: 'Route 22',
  34: 'Route 23',
  35: 'Route 24',
  36: 'Route 25',
  37: "Red's House 1F",
  38: "Red's House 2F",
  39: "Blue's House",
  40: "Oak's Lab",
  // Viridian
  41: 'Viridian Pokecenter',
  42: 'Viridian Mart',
  43: 'Viridian School',
  44: 'Viridian House',
  45: 'Viridian Gym',
  // Pewter
  46: 'Pewter Museum 1F',
  47: 'Pewter Museum 2F',
  48: 'Pewter Gym',
  49: 'Pewter House',
  50: 'Pewter Mart',
  51: 'Pewter House 2',
  52: 'Pewter Pokecenter',
  // Cerulean
  54: 'Cerulean House 1',
  55: 'Cerulean House 2',
  56: 'Cerulean House 3',
  57: 'Cerulean Pokecenter',
  58: 'Cerulean Gym',
  59: 'Cerulean Mart',
  // Dungeons
  61: 'Mt. Moon 1F',
  62: 'Mt. Moon B1F',
  63: 'Mt. Moon B2F',
  // Vermilion
  89: 'Vermilion Pokecenter',
  90: 'Vermilion Gym',
  91: 'Vermilion House',
  92: 'Vermilion Mart',
  93: 'S.S. Anne',
  // Lavender
  142: 'Pokemon Tower 1F',
  143: 'Pokemon Tower 2F',
  144: 'Pokemon Tower 3F',
  145: 'Pokemon Tower 4F',
  146: 'Pokemon Tower 5F',
  147: 'Pokemon Tower 6F',
  148: 'Pokemon Tower 7F',
  // Celadon
  107: 'Celadon Dept Store 1F',
  108: 'Celadon Dept Store 2F',
  109: 'Celadon Dept Store 3F',
  110: 'Celadon Dept Store 4F',
  111: 'Celadon Dept Store 5F',
  112: 'Celadon Mansion 1F',
  113: 'Celadon Pokecenter',
  114: 'Celadon Gym',
  // Fuchsia
  153: 'Fuchsia Pokecenter',
  154: 'Fuchsia Mart',
  155: 'Fuchsia Gym',
  157: 'Safari Zone Gate',
  // Saffron
  178: 'Saffron Gym',
  181: 'Silph Co. 1F',
  182: 'Silph Co. 2F',
  183: 'Silph Co. 3F',
  184: 'Silph Co. 4F',
  185: 'Silph Co. 5F',
  186: 'Silph Co. 6F',
  187: 'Silph Co. 7F',
  188: 'Silph Co. 8F',
  189: 'Silph Co. 9F',
  190: 'Silph Co. 10F',
  191: 'Silph Co. 11F',
  // Cinnabar
  218: 'Cinnabar Gym',
  219: 'Cinnabar Lab',
  // Victory Road / E4
  194: 'Victory Road 2F',
  198: 'Victory Road 3F',
  245: 'Elite Four Room',
};

// Gym map IDs for detection
export const GYM_MAP_IDS = new Set([45, 48, 58, 90, 114, 155, 178, 218]);

// Pokemon Center map IDs
export const POKECENTER_MAP_IDS = new Set([41, 52, 57, 89, 113, 153]);

export function getMapName(mapId: number): string {
  return MAP_NAMES[mapId] || `Map#${mapId}`;
}

export function isGym(mapId: number): boolean {
  return GYM_MAP_IDS.has(mapId);
}

export function isPokecenter(mapId: number): boolean {
  return POKECENTER_MAP_IDS.has(mapId);
}
