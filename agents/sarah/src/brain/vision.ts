import * as zlib from 'zlib';
import { getOpenAI } from './llm-client';
import { getScreenPixels } from '../emulator/adapter';
import { GameState } from '../game/state';
import { getObjectiveDescription } from '../engine/exploration/route-planner';

const WIDTH = 160;
const HEIGHT = 144;

/**
 * Encode raw RGBA pixels (160x144) into a minimal valid PNG.
 */
function rgbaToPngBase64(pixels: Uint8Array): string {
  // Build raw scanlines with filter byte (0 = None) prepended to each row
  const rawData = Buffer.alloc(HEIGHT * (1 + WIDTH * 4));
  for (let y = 0; y < HEIGHT; y++) {
    const rowOffset = y * (1 + WIDTH * 4);
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < WIDTH; x++) {
      const srcIdx = (y * WIDTH + x) * 4;
      const dstIdx = rowOffset + 1 + x * 4;
      rawData[dstIdx + 0] = pixels[srcIdx + 0]; // R
      rawData[dstIdx + 1] = pixels[srcIdx + 1]; // G
      rawData[dstIdx + 2] = pixels[srcIdx + 2]; // B
      rawData[dstIdx + 3] = pixels[srcIdx + 3]; // A
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(WIDTH, 0);
  ihdrData.writeUInt32BE(HEIGHT, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT
  const idat = makeChunk('IDAT', compressed);

  // IEND
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]).toString('base64');
}

function makeChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBytes, data, crcBuf]);
}

// CRC-32 (PNG spec)
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

export interface VisionDecision {
  action: 'move' | 'interact' | 'navigate_menu' | 'wait' | 'sequence';
  direction?: 'up' | 'down' | 'left' | 'right';
  buttons?: string[];
  reasoning: string;
  repeat?: number;
}

let lastVisionCall = 0;
const VISION_COOLDOWN_MS = 5000;

export function canCallVision(): boolean {
  return Date.now() - lastVisionCall >= VISION_COOLDOWN_MS;
}

export async function getVisionDecision(state: GameState): Promise<VisionDecision | null> {
  if (!canCallVision()) return null;
  lastVisionCall = Date.now();

  try {
    const pixels = getScreenPixels();
    const imageBase64 = rgbaToPngBase64(pixels);

    const objective = getObjectiveDescription(state.badgeCount);
    const partyInfo = state.party.pokemon
      .map((p) => `${p.name} Lv${p.level} ${p.currentHp}/${p.maxHp}HP`)
      .join(', ');

    const context = `Current game state:
- Location: ${state.position.mapName} (x:${state.position.x}, y:${state.position.y})
- Badges: ${state.badgeCount}/8
- Party: ${partyInfo || 'No pokemon yet'}
- In battle: ${state.battle.active ? `Yes, vs ${state.battle.enemyName} Lv${state.battle.enemyLevel}` : 'No'}
- Dialog/textbox open: ${state.menu.textboxOpen}
- Current objective: ${objective}
- Items: ${state.inventory.pokeballs} pokeballs, ${state.inventory.potions} potions`;

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are the brain of an AI playing Pokemon Red on Game Boy. You see the game screen and decide the next action.

RESPOND WITH ONLY VALID JSON:
{
  "action": "move" | "interact" | "navigate_menu" | "wait" | "sequence",
  "direction": "up" | "down" | "left" | "right",
  "buttons": ["A", "B", "START", "UP", "DOWN", "LEFT", "RIGHT"],
  "reasoning": "brief explanation",
  "repeat": number
}

GAME KNOWLEDGE:
- Title screen: press START then A
- Exit buildings: walk DOWN to door/stairs
- Talk to NPCs: face them + press A
- Oak's Lab: south of your house in Pallet Town
- Get starter from Prof. Oak, then go north to Route 1
- Progression: Pallet Town → Route 1 → Viridian → Route 2 → Viridian Forest → Pewter → Brock

PRIORITIES:
1. Dialog/textbox open → press A to advance
2. In a menu → navigate or B to exit
3. In a building → head DOWN to exit
4. Overworld → move toward objective
5. Always make progress toward next badge`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: context },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const decision = JSON.parse(jsonStr) as VisionDecision;

    console.log(`[Vision] ${decision.action}: ${decision.reasoning}`);
    return decision;
  } catch (err: any) {
    console.error('[Vision] Error:', err?.message || err);
    return null;
  }
}
