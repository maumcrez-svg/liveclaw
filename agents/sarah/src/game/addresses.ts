/** Pokemon Red (US) RAM Address Map
 *  Reference: pret/pokered disassembly (WRAM)
 */

// Player position
export const PLAYER_Y = 0xd361;
export const PLAYER_X = 0xd362;
export const CURRENT_MAP_ID = 0xd35e;
export const PLAYER_DIRECTION = 0xd52a;

// Battle
export const BATTLE_TYPE = 0xd057;  // 0=none, 1=wild, 2=trainer
export const ENEMY_SPECIES = 0xcfd8;
export const ENEMY_LEVEL = 0xcfe8;
export const ENEMY_HP_CURRENT = 0xcfe6;  // 2 bytes big-endian
export const ENEMY_HP_MAX = 0xcff4;      // 2 bytes big-endian
export const IS_IN_BATTLE = 0xd057;

// Battle menu
export const BATTLE_MENU_CURSOR = 0xcc2d;
export const MOVE_MENU_CURSOR = 0xcc2e;
export const SELECTED_MOVE = 0xccdc;

// Player party
export const PARTY_COUNT = 0xd163;
export const PARTY_SPECIES_START = 0xd164; // 6 bytes, species IDs
export const PARTY_DATA_START = 0xd16b;    // 44 bytes per pokemon
export const PARTY_MON_SIZE = 44;

// Party pokemon offsets (from start of each mon's data block)
export const MON_SPECIES = 0x00;
export const MON_HP_CURRENT = 0x01;  // 2 bytes big-endian
export const MON_LEVEL = 0x21;       // offset 33
export const MON_HP_MAX = 0x22;      // 2 bytes big-endian, offset 34
export const MON_MOVE1 = 0x08;
export const MON_MOVE2 = 0x09;
export const MON_MOVE3 = 0x0a;
export const MON_MOVE4 = 0x0b;
export const MON_PP1 = 0x1d;
export const MON_PP2 = 0x1e;
export const MON_PP3 = 0x1f;
export const MON_PP4 = 0x20;
export const MON_STATUS = 0x04;
export const MON_TYPE1 = 0x05;
export const MON_TYPE2 = 0x06;
export const MON_ATTACK = 0x24;  // 2 bytes
export const MON_DEFENSE = 0x26; // 2 bytes
export const MON_SPEED = 0x28;   // 2 bytes
export const MON_SPECIAL = 0x2a; // 2 bytes

// Inventory
export const BAG_ITEM_COUNT = 0xd31d;
export const BAG_ITEMS_START = 0xd31e; // pairs of (itemId, quantity)

// Progress
export const BADGES = 0xd356;  // bitmask
export const MONEY = 0xd347;   // 3 bytes BCD

// Menu / dialog state
// 0xD125 = wAutoTextBoxDrawingControl — NOT a reliable dialog indicator!
// It stays non-zero during transitions, animations, and other non-dialog events.
// For detecting actual dialog/cutscene: use wJoyIgnore instead.
export const TEXTBOX_ID = 0xd125;          // wAutoTextBoxDrawingControl (unreliable)
export const MENU_ITEM_ID = 0xcc26;        // wCurrentMenuItem
export const MOVEMENT_FLAGS = 0xd730;      // bit 0 = player is moving

// Joypad ignore flag — when non-zero, the game ignores joypad input.
// This is the BEST indicator that a dialog, cutscene, or menu is active.
export const JOY_IGNORE = 0xcd6b;          // wJoyIgnore

// Walk counter — non-zero when player is mid-step (walking between tiles)
export const WALK_COUNTER = 0xcfc5;        // wWalkCounter

// Audio / misc
export const CURRENT_MUSIC = 0xc0ee;
export const FRAME_COUNTER = 0xda45;

// Pokedex
export const POKEDEX_OWNED = 0xd2f7;  // bitfield, 19 bytes
export const POKEDEX_SEEN = 0xd30a;   // bitfield, 19 bytes
