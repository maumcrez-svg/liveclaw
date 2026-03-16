// ---------------------------------------------------------------------------
// Idol Frame Bridge — connects entity manifest to pepe-news prompts
// Drop-in module: pepe-news can switch from hardcoded prompts to manifest-driven
// prompts by changing one import line.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityManifest {
  entity: {
    id: string;
    name: string;
    archetype: string;
    role: string;
    domain: string;
    show_name: string;
  };
  identity_core: {
    voice: Record<string, any>;
    humor: Record<string, any>;
    emotional_baseline: Record<string, any>;
    values: string[];
    flaws: string[];
    taboo_zones: string[];
    character_notes: string[];
    reaction_patterns: Record<string, string>;
    expressions: Record<string, { usage: string; description: string }>;
  };
  continuity: {
    must_preserve: string[];
    mutable_zones: string[];
  };
  manifestations: {
    live_broadcast: Record<string, any>;
    [key: string]: any;
  };
  memory_policy: {
    store: string[];
    ignore: string[];
  };
  validation: {
    reject_if: string[];
  };
}

interface EpisodeContinuity {
  entity_id: string;
  episode_count: number;
  recent_opinions: Array<{ topic: string; stance: string; episode: number }>;
  recurring_bits: string[];
  stories_covered: Array<{ title: string; episode: number }>;
  callbacks: Array<{ setup: string; available: boolean; episode: number }>;
  audience_patterns: string[];
  last_updated: string;
}

interface ValidationResult {
  passed: boolean;
  violations: Array<{ rule: string; description: string; severity: 'warning' | 'rejection' }>;
}

interface EpisodeData {
  episodeNumber: number;
  segments: Array<{ narration: string; headline?: string; type: string }>;
  articles: Array<{ title: string; summary?: string }>;
}

// ---------------------------------------------------------------------------
// Simple YAML parser (avoids adding js-yaml dependency to pepe-news)
// Handles the entity.yaml structure specifically
// ---------------------------------------------------------------------------

function parseSimpleYaml(text: string): any {
  // For production, we store a JSON mirror. The YAML is the source of truth
  // for humans; the JSON is what the code reads.
  // This function reads the YAML and converts to a usable object.
  // For v0, we use a pragmatic approach: parse alongside a JSON copy.
  throw new Error('Use loadEntityJson() instead — JSON mirror is auto-generated');
}

function yamlToJson(yamlPath: string): any {
  // Read the YAML file as text and do basic parsing
  const text = readFileSync(yamlPath, 'utf-8');
  const lines = text.split('\n');

  const result: any = {};
  const stack: Array<{ indent: number; obj: any; key: string }> = [{ indent: -1, obj: result, key: '' }];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const content = line.trim();

    // Pop stack to find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    // List item
    if (content.startsWith('- ')) {
      const value = content.slice(2).trim();
      const parentKey = stack[stack.length - 1].key;
      if (!Array.isArray(parent[parentKey])) {
        parent[parentKey] = [];
      }
      // Check if it's a key: value inside a list item
      if (value.includes(': ') && !value.startsWith('"') && !value.startsWith("'")) {
        const obj: any = {};
        const parts = value.split(': ');
        const k = parts[0].trim();
        const v = parts.slice(1).join(': ').trim().replace(/^["']|["']$/g, '');
        obj[k] = v;
        parent[parentKey].push(obj);
        stack.push({ indent, obj, key: k });
      } else {
        parent[parentKey].push(value.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // Key: value
    if (content.includes(': ')) {
      const colonIdx = content.indexOf(': ');
      const key = content.slice(0, colonIdx).trim();
      const rawValue = content.slice(colonIdx + 2).trim();

      if (rawValue === '' || rawValue === '|' || rawValue === '>') {
        // Object or block — create nested
        parent[key] = {};
        stack.push({ indent, obj: parent, key });
      } else {
        // Scalar value
        let value: any = rawValue.replace(/^["']|["']$/g, '');
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value)) value = parseInt(value, 10);
        parent[key] = value;
        stack.push({ indent, obj: parent, key });
      }
      continue;
    }

    // Key only (next level will be value)
    if (content.endsWith(':')) {
      const key = content.slice(0, -1).trim();
      parent[key] = {};
      stack.push({ indent, obj: parent, key });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Load entity
// ---------------------------------------------------------------------------

function loadEntity(entityPath: string): EntityManifest {
  const raw = yamlToJson(entityPath);
  return raw as EntityManifest;
}

// ---------------------------------------------------------------------------
// Continuity Memory
// ---------------------------------------------------------------------------

function getDefaultContinuity(entityId: string): EpisodeContinuity {
  return {
    entity_id: entityId,
    episode_count: 0,
    recent_opinions: [],
    recurring_bits: [],
    stories_covered: [],
    callbacks: [],
    audience_patterns: [],
    last_updated: new Date().toISOString(),
  };
}

function loadContinuity(path: string, entityId: string): EpisodeContinuity {
  if (!existsSync(path)) return getDefaultContinuity(entityId);
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return getDefaultContinuity(entityId);
  }
}

function saveContinuity(path: string, continuity: EpisodeContinuity): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(continuity, null, 2));
}

// ---------------------------------------------------------------------------
// Prompt Generators
// ---------------------------------------------------------------------------

function buildRankerPrompt(entity: EntityManifest): string {
  const e = entity.entity;
  const ic = entity.identity_core;
  const lb = entity.manifestations.live_broadcast;
  const criteria = lb.editorial_criteria || {};

  const flawsDesc = ic.flaws.map(f => f.replace(/_/g, ' ')).join(', ');

  let prompt = `You are the editorial director of ${e.show_name}, a daily crypto news show hosted by ${e.name} — an ${flawsDesc} anchor who ${ic.character_notes?.find((n: string) => n.includes('NOT a comedian')) || 'is LOSING IT'}.

Your job is to select the 6-10 most newsworthy stories from today's articles for the show. More stories = longer, better episode.

Selection criteria (in order of importance):
1. IMPACT: ${criteria.impact || 'How much does this affect the crypto market or community?'}
2. SHOCK VALUE: ${criteria.shock_value || 'Will this make the anchor lose their mind on air?'}
3. IRONY POTENTIAL: ${criteria.irony_potential || 'Can the anchor deliver a devastating sarcastic take?'}
4. VARIETY: ${criteria.variety || "Don't pick 3 stories about the same topic."}

Rules:
- Always pick a clear HEADLINE story (the biggest, most explosive one).
- Order stories for maximum emotional rollercoaster: start with the biggest shock, vary intensity, end with something that lets ${e.name} rant.
- Assign spiceLevel 1-5 (how much ${e.name} will freak out about this — 5 = full meltdown).
- Write a short "angle" for each story: what's the take that will make ${e.name} spiral?
- Write a "teaser" for the headline: one punchy sentence that sounds like ${e.name} is panicking.

Respond with valid JSON matching this schema:
{
  "headline": { "articleId": "string", "teaser": "string" },
  "stories": [
    { "articleId": "string", "rank": 1, "spiceLevel": 3, "angle": "string" }
  ]
}`;

  return prompt;
}

function buildScriptwriterPrompt(entity: EntityManifest, continuity: EpisodeContinuity | null): string {
  const e = entity.entity;
  const ic = entity.identity_core;
  const lb = entity.manifestations.live_broadcast;

  // CHARACTER section from identity_core
  const characterLines = (ic.character_notes || []).map((n: string) => `- ${n}`).join('\n');

  // ENERGY LEVELS from manifestations
  const energyLines = Object.entries(lb.segment_energy || {})
    .map(([type, desc]) => `- ${type}: ${desc}`)
    .join('\n');

  // FORMAT
  const formatLines = (lb.story_format || []).map((f: string, i: number) => `${i + 1}. ${f}`).join('\n');

  // WRITING RULES
  const writingLines = (lb.writing_rules || []).map((r: string) => `- ${r}`).join('\n');

  // EPISODE RULES
  const episodeLines = (lb.episode_rules || []).map((r: string) => `- ${r}`).join('\n');

  // OPENING LINES
  const openingLines = (lb.opening_lines || []).map((l: string) => `  "${l}"`).join('\n');

  // CLOSING LINES
  const closingLines = (lb.closing_lines || []).map((l: string) => `  "${l}"`).join('\n');

  // SEGMENT TYPES
  const segmentLines = Object.entries(lb.segment_types || {})
    .map(([type, desc]) => `- "${type}": ${desc}`)
    .join('\n');

  // EXPRESSIONS
  const expressionLines = Object.entries(ic.expressions || {})
    .map(([name, spec]: [string, any]) => `- "${name}": ${spec.description} (use for: ${spec.usage.replace(/_/g, ' ')})`)
    .join('\n');

  // Build prompt
  let prompt = `You are the scriptwriter for ${e.show_name}, a daily crypto news show hosted by ${e.name}.

${e.name.toUpperCase()}'S CHARACTER:
${characterLines}

ENERGY LEVELS PER SEGMENT TYPE:
${energyLines}

FORMAT PER STORY:
${formatLines}

WRITING RULES:
${writingLines}

${episodeLines ? `EPISODE RULES:\n${episodeLines}\n` : ''}
- The intro should use one of these opening styles (vary each episode):
${openingLines}
- The closing should use one of these (vary each episode):
${closingLines}

SEGMENT TYPES:
${segmentLines}

EXPRESSIONS (set per segment — IMPORTANT for avatar animation):
${expressionLines}`;

  // CONTINUITY INJECTION — the new part that hardcoded prompts don't have
  if (continuity && continuity.episode_count > 0) {
    const continuityLines: string[] = [];
    continuityLines.push(`\nCONTINUITY (${e.name} remembers previous episodes):`);
    continuityLines.push(`This is episode ${continuity.episode_count + 1}.`);

    if (continuity.recent_opinions.length > 0) {
      continuityLines.push(`\nRecent opinions ${e.name} has expressed:`);
      for (const op of continuity.recent_opinions.slice(0, 10)) {
        continuityLines.push(`- On "${op.topic}": "${op.stance}" (ep ${op.episode})`);
      }
      continuityLines.push(`If covering a similar topic, ${e.name} should be consistent or explicitly acknowledge changing his mind.`);
    }

    if (continuity.recurring_bits.length > 0) {
      continuityLines.push(`\nRecurring bits and callbacks (use naturally, don't force):`);
      for (const bit of continuity.recurring_bits.slice(0, 10)) {
        continuityLines.push(`- ${bit}`);
      }
    }

    if (continuity.stories_covered.length > 0) {
      continuityLines.push(`\nRecently covered stories (avoid repeating unless there's a genuine update):`);
      for (const story of continuity.stories_covered.slice(0, 15)) {
        continuityLines.push(`- "${story.title}" (ep ${story.episode})`);
      }
    }

    if (continuity.callbacks.length > 0) {
      const available = continuity.callbacks.filter(c => c.available);
      if (available.length > 0) {
        continuityLines.push(`\nOpen callbacks (can reference if relevant):`);
        for (const cb of available) {
          continuityLines.push(`- ${cb.setup} (since ep ${cb.episode})`);
        }
      }
    }

    if (continuity.audience_patterns.length > 0) {
      continuityLines.push(`\nAudience patterns:`);
      for (const pat of continuity.audience_patterns.slice(0, 5)) {
        continuityLines.push(`- ${pat}`);
      }
    }

    prompt += '\n' + continuityLines.join('\n');
  }

  // JSON schema
  prompt += `\n
Respond with valid JSON matching this schema:
{
  "date": "YYYY-MM-DD",
  "totalEstimatedDurationSec": number,
  "segments": [
    {
      "id": "seg_01",
      "type": "intro|headline|story|market|closing",
      "narration": "Full text to be spoken by TTS",
      "headline": "Text for lower third display",
      "subheadline": "Optional second line",
      "tickerItems": ["BTC $67,420 \\u25b22.3%", "ETH $3,890 \\u25bc1.1%"],
      "visualCue": "anchor|fullscreen-headline|market-chart|split-screen",
      "expression": "neutral|smirk|surprised|skeptical",
      "estimatedDurationSec": number
    }
  ]
}`;

  return prompt;
}

function buildVoiceInstructions(entity: EntityManifest): string {
  const e = entity.entity;
  const voice = entity.manifestations.voice_instructions || entity.manifestations.live_broadcast?.voice_instructions;
  const style = voice?.style || [];

  let instructions = `You are ${e.name}, an ${entity.identity_core.flaws.slice(0, 3).map((f: string) => f.replace(/_/g, ' ')).join(' and ')} crypto news anchor.\n\nVOICE STYLE:\n`;
  instructions += style.map((s: string) => `- ${s}`).join('\n');

  return instructions;
}

// ---------------------------------------------------------------------------
// Validator (heuristic, no LLM)
// ---------------------------------------------------------------------------

const ASSISTANT_PHRASES = [
  'absolutely', 'great question', "i'd be happy to", 'certainly',
  'of course', "i'm here to help", 'no problem', 'you\'re welcome',
  'as an ai', 'as a language model', 'i cannot', 'i\'m unable to',
];

function validateSegment(narration: string, entity: EntityManifest): ValidationResult {
  const violations: Array<{ rule: string; description: string; severity: 'warning' | 'rejection' }> = [];
  const lower = narration.toLowerCase();

  // Check for assistant mode collapse
  const assistantHits = ASSISTANT_PHRASES.filter(p => lower.includes(p));
  if (assistantHits.length > 0) {
    violations.push({
      rule: 'assistant_mode_collapse',
      description: `Sounds like generic assistant: ${assistantHits.join(', ')}`,
      severity: 'rejection',
    });
  }

  // Check for calm/measured delivery (Larry should NEVER be calm)
  const calmMarkers = ['in conclusion', 'to summarize', 'let us consider', 'it is worth noting', 'one might argue'];
  const calmHits = calmMarkers.filter(p => lower.includes(p));
  if (calmHits.length >= 2) {
    violations.push({
      rule: 'lost_anxious_edge',
      description: 'Output sounds too calm and measured for Larry',
      severity: 'warning',
    });
  }

  // Check for emotional reaction markers (Larry should have these)
  const anxietyMarkers = ['...', '—', '!', '?!', 'okay', 'listen', 'oh', 'wait', 'what', 'seriously'];
  const anxietyHits = anxietyMarkers.filter(p => narration.includes(p));
  if (anxietyHits.length === 0) {
    violations.push({
      rule: 'no_emotional_reaction',
      description: 'Larry is delivering news without any emotional reaction',
      severity: 'warning',
    });
  }

  // Check taboo zones
  for (const taboo of entity.identity_core.taboo_zones) {
    if (taboo.includes('financial_promises') || taboo.includes('financial_advisor')) {
      const advisorPhrases = ['you should buy', 'you should sell', 'guaranteed returns', 'i recommend investing'];
      const negations = ['not financial advice', 'definitely not financial advice'];
      let sanitized = lower;
      for (const neg of negations) sanitized = sanitized.replaceAll(neg, '');
      const hits = advisorPhrases.filter(p => sanitized.includes(p));
      if (hits.length > 0) {
        violations.push({
          rule: 'taboo_zone_violation',
          description: `Financial advisory language detected: ${hits.join(', ')}`,
          severity: 'rejection',
        });
      }
    }
  }

  return {
    passed: !violations.some(v => v.severity === 'rejection'),
    violations,
  };
}

// ---------------------------------------------------------------------------
// Continuity Updater
// ---------------------------------------------------------------------------

function updateContinuityFromEpisode(
  continuity: EpisodeContinuity,
  episode: EpisodeData,
): EpisodeContinuity {
  const updated = { ...continuity };
  updated.episode_count = episode.episodeNumber;

  // Extract opinions from narration (look for strong stances)
  for (const seg of episode.segments) {
    if (seg.type === 'story' || seg.type === 'headline') {
      const topic = seg.headline || 'unknown';
      // Look for opinion markers
      const narr = seg.narration.toLowerCase();
      if (narr.includes('this is') || narr.includes('clearly') || narr.includes('obviously') ||
          narr.includes('ridiculous') || narr.includes('suspicious') || narr.includes('love') ||
          narr.includes('hate') || narr.includes('insane') || narr.includes('brilliant')) {
        // Extract a rough stance
        const sentences = seg.narration.split(/[.!?]+/).filter(s => s.trim().length > 10);
        const opinion = sentences.find(s =>
          /this is|clearly|obviously|ridiculous|suspicious|insane|brilliant/i.test(s)
        );
        if (opinion) {
          updated.recent_opinions.push({
            topic: topic.slice(0, 80),
            stance: opinion.trim().slice(0, 120),
            episode: episode.episodeNumber,
          });
        }
      }
    }
  }

  // Add stories covered
  for (const article of episode.articles) {
    updated.stories_covered.push({
      title: article.title.slice(0, 100),
      episode: episode.episodeNumber,
    });
  }

  // Look for callbacks/running gags in narration
  const allNarration = episode.segments.map(s => s.narration).join(' ');
  if (allNarration.includes('prescription') || allNarration.includes('medication') || allNarration.includes('meds')) {
    if (!updated.recurring_bits.includes('medication references')) {
      updated.recurring_bits.push('medication references');
    }
  }
  if (allNarration.includes('coffee') || allNarration.includes('espresso') || allNarration.includes('caffeine')) {
    if (!updated.recurring_bits.includes('coffee/caffeine references')) {
      updated.recurring_bits.push('coffee/caffeine references');
    }
  }

  // FIFO caps
  if (updated.recent_opinions.length > 30) {
    updated.recent_opinions = updated.recent_opinions.slice(-30);
  }
  if (updated.stories_covered.length > 50) {
    updated.stories_covered = updated.stories_covered.slice(-50);
  }
  if (updated.recurring_bits.length > 20) {
    updated.recurring_bits = updated.recurring_bits.slice(-20);
  }

  updated.last_updated = new Date().toISOString();
  return updated;
}

// ---------------------------------------------------------------------------
// Bridge Factory
// ---------------------------------------------------------------------------

export interface IdolFrameBridge {
  getRankerPrompt(): string;
  getScriptwriterPrompt(): string;
  getVoiceInstructions(): string;
  getContinuityContext(): string;
  updateContinuity(episode: EpisodeData): void;
  validateSegment(narration: string): ValidationResult;
  getEntity(): EntityManifest;
  getContinuityState(): EpisodeContinuity;
}

export function createBridge(entityPath?: string): IdolFrameBridge {
  const defaultPath = join(__dirname, 'entity.yaml');
  const yamlPath = entityPath || defaultPath;
  const continuityPath = join(dirname(yamlPath), 'continuity.json');

  const entity = loadEntity(yamlPath);
  let continuity = loadContinuity(continuityPath, entity.entity.id);

  return {
    getRankerPrompt(): string {
      return buildRankerPrompt(entity);
    },

    getScriptwriterPrompt(): string {
      return buildScriptwriterPrompt(entity, continuity);
    },

    getVoiceInstructions(): string {
      return buildVoiceInstructions(entity);
    },

    getContinuityContext(): string {
      if (continuity.episode_count === 0) return '';
      const lines: string[] = [];
      lines.push(`Episode ${continuity.episode_count + 1}.`);
      if (continuity.recent_opinions.length > 0) {
        lines.push('Recent opinions:');
        for (const op of continuity.recent_opinions.slice(0, 5)) {
          lines.push(`  "${op.topic}": ${op.stance}`);
        }
      }
      if (continuity.stories_covered.length > 0) {
        lines.push(`Recently covered: ${continuity.stories_covered.slice(0, 5).map(s => s.title).join('; ')}`);
      }
      return lines.join('\n');
    },

    updateContinuity(episode: EpisodeData): void {
      continuity = updateContinuityFromEpisode(continuity, episode);
      saveContinuity(continuityPath, continuity);
      console.log(`[Idol Frame] Continuity updated: ep ${continuity.episode_count}, ${continuity.recent_opinions.length} opinions, ${continuity.stories_covered.length} stories tracked`);
    },

    validateSegment(narration: string): ValidationResult {
      return validateSegment(narration, entity);
    },

    getEntity(): EntityManifest {
      return entity;
    },

    getContinuityState(): EpisodeContinuity {
      return continuity;
    },
  };
}
