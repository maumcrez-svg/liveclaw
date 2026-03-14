import * as path from 'path';
import * as fs from 'fs';

// serverboy exports "Interface" constructor
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Serverboy = require('serverboy');

export enum Button {
  A = 'A',
  B = 'B',
  START = 'START',
  SELECT = 'SELECT',
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

// Serverboy KEYMAP: RIGHT=0, LEFT=1, UP=2, DOWN=3, A=4, B=5, SELECT=6, START=7
// But pressKey() accepts strings directly, so we can just pass the enum value.

let gameboy: any = null;

export function initEmulator(romPath: string, saveData?: any[]): void {
  const absPath = path.resolve(romPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`ROM not found: ${absPath}`);
  }

  const romBuffer = fs.readFileSync(absPath);
  gameboy = new Serverboy();
  gameboy.loadRom(romBuffer, saveData);
  console.log(`[Emulator] ROM loaded: ${absPath} (${romBuffer.length} bytes)`);
  console.log(`[Emulator] KEYMAP: ${JSON.stringify(Serverboy.KEYMAP)}`);
}

/**
 * Press buttons for the NEXT frame. Must be called BEFORE doFrame().
 * Serverboy's doFrame() reads pressed keys at the start, then releases all at the end.
 * pressKey() accepts strings: "UP", "DOWN", "A", etc.
 */
export function pressButton(button: Button): void {
  if (!gameboy) return;
  gameboy.pressKey(button); // pressKey accepts string directly!
}

export function pressButtons(buttons: Button[]): void {
  for (const b of buttons) {
    pressButton(b);
  }
}

/**
 * Advance one frame. Keys must be pressed BEFORE calling this.
 * doFrame() will: apply pressed keys → run frame → release all keys.
 */
export function doFrame(): void {
  if (!gameboy) throw new Error('Emulator not initialized');
  gameboy.doFrame();
}

/**
 * Read a single byte from emulator memory.
 * getMemory() returns the raw memory array (JS array, ~65536 elements).
 */
export function readByte(address: number): number {
  if (!gameboy) throw new Error('Emulator not initialized');
  const mem = gameboy.getMemory();
  return mem[address] ?? 0;
}

/**
 * Read a 16-bit word. Game Boy is LITTLE-ENDIAN:
 * low byte at address, high byte at address+1.
 */
export function readWordLE(address: number): number {
  const lo = readByte(address);
  const hi = readByte(address + 1);
  return (hi << 8) | lo;
}

/**
 * Read a 16-bit word in big-endian (some Pokemon Red fields use this).
 */
export function readWordBE(address: number): number {
  const hi = readByte(address);
  const lo = readByte(address + 1);
  return (hi << 8) | lo;
}

/**
 * Get the current screen pixels (160x144 RGBA).
 */
export function getScreenPixels(): Uint8Array {
  if (!gameboy) throw new Error('Emulator not initialized');
  return gameboy.getScreen();
}

/**
 * Get SRAM save data (for persistence between sessions).
 */
export function getSaveData(): any[] | null {
  if (!gameboy) return null;
  try {
    return gameboy.getSaveData();
  } catch {
    return null;
  }
}

/**
 * Get which keys are currently pressed (for debug).
 */
export function getKeysState(): boolean[] {
  if (!gameboy) return [];
  return gameboy.getKeys();
}
