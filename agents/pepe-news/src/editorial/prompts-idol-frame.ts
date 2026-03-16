// ---------------------------------------------------------------------------
// Drop-in replacement for prompts.ts using Idol Frame entity manifest.
//
// To switch:
//   import { RANKER_SYSTEM, SCRIPTWRITER_SYSTEM } from './prompts-idol-frame.js'
//
// To revert:
//   import { RANKER_SYSTEM, SCRIPTWRITER_SYSTEM } from './prompts.js'
//
// The original prompts.ts is NOT modified and remains as fallback.
// ---------------------------------------------------------------------------

import { createBridge } from '../idol-frame/index.js';

const bridge = createBridge();

// These produce output equivalent to the hardcoded prompts in prompts.ts,
// but derived from the entity YAML manifest + continuity memory.
// The key addition: continuity context is injected into SCRIPTWRITER_SYSTEM,
// so Larry remembers opinions, stories, and callbacks from previous episodes.

export const RANKER_SYSTEM = bridge.getRankerPrompt();
export const SCRIPTWRITER_SYSTEM = bridge.getScriptwriterPrompt();

// Voice instructions for TTS — exported for use in tts-engine.ts
export const VOICE_INSTRUCTIONS = bridge.getVoiceInstructions();

// The bridge itself, for direct access to continuity and validation
export { bridge };
