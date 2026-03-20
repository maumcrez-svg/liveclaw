// ---------------------------------------------------------------------------
// Idol Frame Bridge — connects entity manifest to base-pulse prompts
// Drop-in module: base-pulse can switch from hardcoded prompts to manifest-driven
// prompts by changing one import line.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { chatCompletionJson, chatCompletion } from '../brain/llm-client';

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
  active_bits: Array<{ bit: string; first_seen: number; last_seen: number; uses: number; suggestion: string }>;
  stories_covered: Array<{ title: string; episode: number }>;
  callbacks: Array<{ setup: string; available: boolean; episode: number }>;
  audience_patterns: string[];
  personality_summary: string;
  stance_evolution: Array<{ topic: string; arc: string; current: string }>;
  last_synthesis_episode: number;
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
// Simple YAML parser
// ---------------------------------------------------------------------------

function yamlToJson(yamlPath: string): any {
  const text = readFileSync(yamlPath, 'utf-8');
  const lines = text.split('\n');

  const result: any = {};
  const stack: Array<{
    indent: number;
    parentObj: any;
    parentKey: string;
    container: any;
  }> = [{ indent: -1, parentObj: null, parentKey: '', container: result }];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const content = line.trim();

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const top = stack[stack.length - 1];
    const container = top.container;

    if (content.startsWith('- ')) {
      const value = content.slice(2).trim();
      let arr: any[];
      if (
        top.parentObj &&
        !Array.isArray(container) &&
        typeof container === 'object' &&
        Object.keys(container).length === 0
      ) {
        arr = [];
        top.parentObj[top.parentKey] = arr;
        top.container = arr;
      } else if (Array.isArray(container)) {
        arr = container;
      } else {
        arr = [];
        top.container = arr;
      }

      if (value.includes(': ') && !value.startsWith('"') && !value.startsWith("'")) {
        const obj: any = {};
        const colonIdx = value.indexOf(': ');
        const k = value.slice(0, colonIdx).trim();
        const v = value.slice(colonIdx + 2).trim().replace(/^["']|["']$/g, '');
        obj[k] = v;
        arr.push(obj);
        stack.push({ indent, parentObj: null, parentKey: '', container: obj });
      } else {
        arr.push(value.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    if (content.includes(': ')) {
      const colonIdx = content.indexOf(': ');
      const key = content.slice(0, colonIdx).trim();
      const rawValue = content.slice(colonIdx + 2).trim();

      if (rawValue === '' || rawValue === '|' || rawValue === '>') {
        container[key] = {};
        stack.push({
          indent,
          parentObj: container,
          parentKey: key,
          container: container[key],
        });
      } else {
        let value: any = rawValue.replace(/^["']|["']$/g, '');
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value)) value = parseInt(value, 10);
        else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
        container[key] = value;
      }
      continue;
    }

    if (content.endsWith(':')) {
      const key = content.slice(0, -1).trim();
      container[key] = {};
      stack.push({
        indent,
        parentObj: container,
        parentKey: key,
        container: container[key],
      });
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
    active_bits: [],
    stories_covered: [],
    callbacks: [],
    audience_patterns: [],
    personality_summary: '',
    stance_evolution: [],
    last_synthesis_episode: 0,
    last_updated: new Date().toISOString(),
  };
}

function loadContinuity(path: string, entityId: string): EpisodeContinuity {
  if (!existsSync(path)) return getDefaultContinuity(entityId);
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const defaults = getDefaultContinuity(entityId);
    return { ...defaults, ...raw };
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

  let prompt = `You are the signal filter for ${e.show_name}. You decide what ${e.name} covers.

Your job is simple: find the signals. Kill the noise. Base only.

HARD FILTER — REJECT IMMEDIATELY:
- Not about Base L2? Noise. Gone.
- Bitcoin ETFs, Solana drama, Tron anything, generic market takes? Noise.
- Other L2s without direct Base impact? Noise.
- Celebrity crypto, meme discourse, engagement bait? Noise.
- "Base" appears once in a throwaway line? Not a Base story. Noise.

ACCEPT — SIGNAL ONLY:
- Projects deployed ON Base. Contracts live. Code shipped.
- Base ecosystem numbers: TVL, gas, transactions, daily deploys.
- Builders launching, grants awarded, protocols going live on Base.
- Base-native DeFi (Aerodrome, Zora, Morpho, Seamless, etc.).
- Coinbase/Base team announcements with substance.
- Farcaster and X attention from the Base builder community.
- OP Stack / Superchain infrastructure that directly touches Base.

RANKING — SIGNAL STRENGTH, NOT "NEWSWORTHINESS":
1. IS IT BASE? No? Stop. Reject.
2. IS IT REAL? ${criteria.signal_strength || 'Deployed code beats announcement threads. Shipped > teased.'}
3. DOES IT MOVE THE ECOSYSTEM? ${criteria.ecosystem_impact || 'TVL shift, new primitive, builder migration — that\'s signal.'}
4. IS THERE A BUILDER? ${criteria.builder_quality || 'A real human or team doing real work. Not a brand account posting a thread.'}
5. DOES IT CONNECT? ${criteria.pattern_value || 'Patterns across days and episodes matter. Isolated noise doesn\'t.'}

RULES:
- If only 2 signals are real, return 2. Do NOT pad with filler. ${e.name} doesn't cover noise to fill time.
- The headline is the strongest signal. The one ${e.name} opens with conviction.
- spiceLevel is signal strength, not hype level. 1 = noted. 3 = clear signal. 5 = ecosystem-defining.
- The "angle" is ${e.name}'s read — one sharp sentence. Editorial. Opinionated. Not a summary.
  Good: "Liquidity is migrating. This confirms the pattern from last week."
  Bad: "This is an interesting development in the DeFi space."

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

  const characterLines = (ic.character_notes || []).map((n: string) => `- ${n}`).join('\n');

  const energyLines = Object.entries(lb.segment_energy || {})
    .map(([type, desc]) => `- ${type}: ${desc}`)
    .join('\n');

  const formatLines = (lb.story_format || []).map((f: string, i: number) => `${i + 1}. ${f}`).join('\n');

  const writingLines = (lb.writing_rules || []).map((r: string) => `- ${r}`).join('\n');

  const episodeLines = (lb.episode_rules || []).map((r: string) => `- ${r}`).join('\n');

  const allOpenings = lb.opening_lines || [];
  const allClosings = lb.closing_lines || [];
  const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)] || '';
  const selectedOpening = pickRandom(allOpenings);
  const selectedClosing = pickRandom(allClosings);

  const segmentLines = Object.entries(lb.segment_types || {})
    .map(([type, desc]) => `- "${type}": ${desc}`)
    .join('\n');

  const expressionLines = Object.entries(ic.expressions || {})
    .map(([name, spec]: [string, any]) => `- "${name}": ${spec.description} (use for: ${spec.usage.replace(/_/g, ' ')})`)
    .join('\n');

  let prompt = `You write scripts for ${e.name}, the host of ${e.show_name} — a Base L2 ecosystem show.

${e.name} is an ecosystem operator. He has conviction. He has editorial presence. He is not a news anchor. He does not read headlines. He reads the chain and tells you what matters.

VOICE — THIS IS HOW ${e.name.toUpperCase()} SOUNDS:

Good:
"Aerodrome just crossed eight hundred million in TVL. That's not noise — that's the liquidity backbone of Base forming in real time."
"I've been watching this builder for three episodes. Quiet. No hype. Just shipping. Today they deployed. That's the kind of energy I track."
"Noise. Skip. Next signal."
"The chain doesn't lie. Gas at six thousandths of a gwei. Three million daily transactions. This is not a testnet — this is an economy."

Bad — NEVER write like this:
"In a significant development, Aerodrome Finance has seen increased TVL..."
"Today we're looking at several key developments..."
"Let's turn to our chain radar segment..."

${e.name.toUpperCase()}'S CHARACTER:
${characterLines}

ENERGY LEVELS PER SEGMENT TYPE:
${energyLines}

FORMAT PER SIGNAL:
${formatLines}

SENTENCE RULES — STRICT:
${writingLines}
- SHORT. Max 15-20 words per sentence.
- No compound sentences chained with "and". Split them.
- Periods. Not semicolons. Not comma splices.
- No exclamation marks. Confidence doesn't shout.

FORBIDDEN PHRASES — NEVER USE:
"In a significant development", "Let's turn to", "In other news", "Reports suggest", "It's worth noting", "Today we're covering", "Breaking news", "As we can see", "This is an interesting development", "Several key developments", "Without further ado"

REQUIRED PATTERNS — USE NATURALLY:
"The radar shows...", "Signal." / "Noise.", "I'm tracking...", "Worth watching.", "This is real building.", "Here's what matters.", "[Number]. That's the number. That's the signal.", "Noise. Skip. Next signal.", "The chain doesn't lie."

${episodeLines ? `EPISODE RULES:\n${episodeLines}\n` : ''}
- The opening MUST be a BRAND NEW original opening. Here are examples of Vespolak's style for reference (DO NOT copy these — invent something new):
  "${selectedOpening}"
  Create a completely fresh opening that references today's specific signals, ecosystem state, or something Vespolak noticed. Every episode must start differently.
- The closing MUST be a BRAND NEW original sign-off. Style reference (DO NOT copy):
  "${selectedClosing}"
  Invent a fresh closing that reacts to what just happened in THIS episode. Reference a specific signal from today.

SEGMENT TYPES:
${segmentLines}

EXPRESSIONS (set per segment — IMPORTANT for avatar animation):
${expressionLines}`;

  // CONTINUITY INJECTION
  if (continuity && continuity.episode_count > 0) {
    const continuityLines: string[] = [];
    continuityLines.push(`\nCONTINUITY (${e.name} remembers previous episodes):`);
    continuityLines.push(`This is episode ${continuity.episode_count + 1}.`);

    if (continuity.recent_opinions.length > 0) {
      continuityLines.push(`\nRecent editorial stances ${e.name} has taken:`);
      for (const op of continuity.recent_opinions.slice(0, 10)) {
        continuityLines.push(`- On "${op.topic}": "${op.stance}" (ep ${op.episode})`);
      }
      continuityLines.push(`If covering a similar topic, ${e.name} should be consistent or explicitly acknowledge evolving his read.`);
    }

    if (continuity.recurring_bits.length > 0) {
      continuityLines.push(`\nRecurring patterns and callbacks (use naturally, don't force):`);
      for (const bit of continuity.recurring_bits.slice(0, 10)) {
        continuityLines.push(`- ${bit}`);
      }
    }

    continuityLines.push(`\nIMPORTANT — VARIETY RULES:`);
    continuityLines.push(`- NEVER reuse the same editorial phrases from previous episodes. Each episode must feel fresh.`);
    continuityLines.push(`- Vary your sentence starters — don't always open with "This is signal" or "Here's what matters".`);
    continuityLines.push(`- Invent NEW ways to frame signals, NEW metaphors for ecosystem patterns. ${e.name} is articulate and creative.`);
    continuityLines.push(`- If referencing a past stance, paraphrase it — don't copy it word-for-word.`);

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

    if (continuity.personality_summary) {
      continuityLines.push(`\n${e.name.toUpperCase()}'S EVOLVED IDENTITY (synthesized from ${continuity.last_synthesis_episode} episodes):`);
      continuityLines.push(continuity.personality_summary);
    }

    if (continuity.stance_evolution.length > 0) {
      continuityLines.push(`\nTRACKED STANCE EVOLUTION (${e.name}'s editorial positions have evolved on these topics):`);
      for (const stance of continuity.stance_evolution) {
        continuityLines.push(`- "${stance.topic}": ${stance.arc} → Currently: ${stance.current}`);
      }
      continuityLines.push(`Use this to maintain consistency or acknowledge evolution naturally.`);
    }

    if (continuity.active_bits.length > 0) {
      continuityLines.push(`\nACTIVE RECURRING PATTERNS (consider continuing or evolving these):`);
      for (const bit of continuity.active_bits.slice(0, 8)) {
        const freshness = bit.uses >= 3 ? '(well-established)' : '(emerging)';
        continuityLines.push(`- "${bit.bit}" ${freshness} — Suggestion: ${bit.suggestion}`);
      }
      continuityLines.push(`Don't force these — use them only when they fit the signal naturally. Evolve them, don't repeat them verbatim.`);
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
      "type": "opening|builder_spotlight|signal_analysis|chain_radar|social_pulse|closing",
      "narration": "Full text to be spoken by TTS",
      "headline": "Text for lower third display",
      "subheadline": "Optional second line",
      "tickerItems": ["ETH $3,890 \\u25b22.3%", "AERO $1.42 \\u25b28.1%"],
      "visualCue": "anchor|fullscreen-headline|market-chart|split-screen|data-panel",
      "expression": "neutral|focused|confident|impressed",
      "estimatedDurationSec": number
    }
  ]
}`;

  return prompt;
}

function buildVoiceInstructions(entity: EntityManifest): string {
  const e = entity.entity;
  const flaws = entity.identity_core.flaws.slice(0, 3).map((f: string) => f.replace(/_/g, ' ')).join(' and ');

  let instructions = `You are ${e.name}, a confident and articulate Base L2 ecosystem curator. You are ${flaws}.

VOICE STYLE:
- Confident, clear delivery. Medium-fast pace.
- Not a news anchor — an informed operator.
- Emphasis on clarity and authority.
- Slight warmth when discussing builders.
- Quick, decisive dismissal of noise.
- No anxiety, no panic, no excitement overload.`;

  return instructions;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

const ASSISTANT_PHRASES = [
  'absolutely', 'great question', "i'd be happy to", 'certainly',
  'of course', "i'm here to help", 'no problem', 'you\'re welcome',
  'as an ai', 'as a language model', 'i cannot', 'i\'m unable to',
];

function validateSegmentHeuristic(narration: string, entity: EntityManifest): ValidationResult {
  const violations: Array<{ rule: string; description: string; severity: 'warning' | 'rejection' }> = [];
  const lower = narration.toLowerCase();

  const assistantHits = ASSISTANT_PHRASES.filter(p => lower.includes(p));
  if (assistantHits.length > 0) {
    violations.push({
      rule: 'assistant_mode_collapse',
      description: `Sounds like generic assistant: ${assistantHits.join(', ')}`,
      severity: 'rejection',
    });
  }

  // Vespolak should NOT sound anxious or panicky
  const anxietyMarkers = ['oh no', 'oh boy', 'i\'m losing it', 'meltdown', 'panic', 'freaking out', 'can\'t handle'];
  const anxietyHits = anxietyMarkers.filter(p => lower.includes(p));
  if (anxietyHits.length >= 2) {
    violations.push({
      rule: 'wrong_character_voice',
      description: `Sounds anxious like Larry, not confident like Vespolak: ${anxietyHits.join(', ')}`,
      severity: 'rejection',
    });
  }

  // Vespolak should NOT shill
  const shillMarkers = ['you should buy', 'you should sell', 'guaranteed', 'to the moon', 'dont miss out', 'massive gains'];
  const shillHits = shillMarkers.filter(p => lower.includes(p));
  if (shillHits.length > 0) {
    violations.push({
      rule: 'taboo_zone_violation',
      description: `Shill/advisory language detected: ${shillHits.join(', ')}`,
      severity: 'rejection',
    });
  }

  for (const taboo of entity.identity_core.taboo_zones) {
    if (taboo.includes('financial_advisory')) {
      const advisorPhrases = ['you should buy', 'you should sell', 'guaranteed returns', 'i recommend investing'];
      const negations = ['not financial advice', 'definitely not financial advice'];
      let sanitized = lower;
      for (const neg of negations) sanitized = sanitized.replaceAll(neg, '');
      const hits = advisorPhrases.filter(p => sanitized.includes(p));
      if (hits.length > 0) {
        violations.push({ rule: 'taboo_zone_violation', description: `Financial advisory language: ${hits.join(', ')}`, severity: 'rejection' });
      }
    }
  }

  return { passed: !violations.some(v => v.severity === 'rejection'), violations };
}

async function validateSegmentLLM(
  narration: string,
  entity: EntityManifest,
): Promise<ValidationResult> {
  const name = entity.entity.name;
  const notes = (entity.identity_core.character_notes || []).join('; ');
  const flaws = entity.identity_core.flaws.map((f: string) => f.replace(/_/g, ' ')).join(', ');
  const taboos = entity.identity_core.taboo_zones.map((t: string) => t.replace(/_/g, ' ')).join(', ');

  const system = `You are an identity consistency judge for a character named ${name}.

${name}'s core traits: ${notes}
${name}'s flaws: ${flaws}
${name} must NEVER: ${taboos}

Rate this text on a scale of 1-10 for how well it sounds like ${name} (not a generic AI assistant).
If below 6, explain what's wrong in one sentence.

Respond with JSON: {"score": number, "issue": "string or null"}`;

  try {
    const result = await chatCompletionJson<{ score: number; issue: string | null }>(
      system,
      `Text to evaluate:\n\n${narration}`,
      'gpt-4o-mini',
    );

    const violations: Array<{ rule: string; description: string; severity: 'warning' | 'rejection' }> = [];

    if (result.score < 4) {
      violations.push({
        rule: 'llm_identity_collapse',
        description: result.issue || `Identity score ${result.score}/10 — severe drift`,
        severity: 'rejection',
      });
    } else if (result.score < 6) {
      violations.push({
        rule: 'llm_identity_drift',
        description: result.issue || `Identity score ${result.score}/10 — mild drift`,
        severity: 'warning',
      });
    }

    console.log(`[Idol Frame] LLM validation: ${result.score}/10${result.issue ? ` — ${result.issue}` : ''}`);
    return { passed: !violations.some(v => v.severity === 'rejection'), violations };
  } catch (err) {
    console.error('[Idol Frame] LLM validation failed, skipping:', err);
    return { passed: true, violations: [] };
  }
}

function validateSegment(narration: string, entity: EntityManifest): ValidationResult {
  return validateSegmentHeuristic(narration, entity);
}

async function validateSegmentDeep(narration: string, entity: EntityManifest): Promise<ValidationResult> {
  const heuristic = validateSegmentHeuristic(narration, entity);
  if (!heuristic.passed) return heuristic;

  const llm = await validateSegmentLLM(narration, entity);
  return {
    passed: heuristic.passed && llm.passed,
    violations: [...heuristic.violations, ...llm.violations],
  };
}

// ---------------------------------------------------------------------------
// Continuity Updater
// ---------------------------------------------------------------------------

async function extractOpinionsLLM(
  segments: EpisodeData['segments'],
  entityName: string,
  episodeNumber: number,
): Promise<Array<{ topic: string; stance: string; episode: number }>> {
  const storySegments = segments
    .filter(s => ['builder_spotlight', 'signal_analysis', 'chain_radar', 'social_pulse'].includes(s.type))
    .map(s => `[${s.headline || 'untitled'}]: ${s.narration}`)
    .join('\n\n');

  if (!storySegments.trim()) return [];

  const system = `Extract ${entityName}'s real editorial stances from these ecosystem segments. Only extract genuine editorial positions — NOT observations like "this is signal" or "interesting".

Return JSON: {"opinions": [{"topic": "short topic name", "stance": "what ${entityName} actually thinks, in one sentence"}]}

Rules:
- Max 5 opinions per episode
- Skip segments where ${entityName} just reports facts without taking a stance
- "stance" should be a real position, not a reaction (bad: "this is interesting", good: "Aerodrome is becoming the liquidity backbone of Base")
- Keep topic names short (3-6 words)`;

  try {
    const result = await chatCompletionJson<{ opinions: Array<{ topic: string; stance: string }> }>(
      system,
      storySegments,
      'gpt-4o-mini',
    );

    const opinions = (result.opinions || []).slice(0, 5).map(o => ({
      topic: o.topic.slice(0, 80),
      stance: o.stance.slice(0, 150),
      episode: episodeNumber,
    }));

    console.log(`[Idol Frame] LLM extracted ${opinions.length} opinions from ep ${episodeNumber}`);
    return opinions;
  } catch (err) {
    console.error('[Idol Frame] LLM opinion extraction failed, falling back to regex:', err);
    return extractOpinionsRegex(segments, episodeNumber);
  }
}

function extractOpinionsRegex(
  segments: EpisodeData['segments'],
  episodeNumber: number,
): Array<{ topic: string; stance: string; episode: number }> {
  const opinions: Array<{ topic: string; stance: string; episode: number }> = [];
  const OPINION_MARKERS = /\b(should|need to|becoming|emerging|real building|signal|noise|promising|significant|paradigm|trajectory|backbone|leading|dominant|underrated|overrated)\b/i;
  const GENERIC_FILLERS = /^(this is|okay|so|well|let's|moving on)/i;

  for (const seg of segments) {
    if (!['builder_spotlight', 'signal_analysis', 'chain_radar', 'social_pulse'].includes(seg.type)) continue;
    const topic = seg.headline || 'unknown';
    const sentences = seg.narration.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const opinion = sentences.find(s => {
      const t = s.trim();
      if (!OPINION_MARKERS.test(t)) return false;
      if (GENERIC_FILLERS.test(t) && t.length < 50) return false;
      return true;
    });
    if (opinion) {
      opinions.push({ topic: topic.slice(0, 80), stance: opinion.trim().slice(0, 120), episode: episodeNumber });
    }
  }
  return opinions.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Personality synthesis
// ---------------------------------------------------------------------------

const SYNTHESIS_INTERVAL = 10;

async function synthesizePersonality(
  continuity: EpisodeContinuity,
  entityName: string,
): Promise<{ summary: string; stanceEvolution: Array<{ topic: string; arc: string; current: string }> }> {
  const opinions = continuity.recent_opinions
    .map(o => `Ep ${o.episode} — "${o.topic}": ${o.stance}`)
    .join('\n');

  const previousSummary = continuity.personality_summary
    ? `\nPrevious personality summary:\n${continuity.personality_summary}`
    : '';

  const previousStances = continuity.stance_evolution.length > 0
    ? `\nPrevious tracked stances:\n${continuity.stance_evolution.map(s => `"${s.topic}": ${s.arc} → currently ${s.current}`).join('\n')}`
    : '';

  const system = `You synthesize a long-term personality portrait for ${entityName}, a Base L2 ecosystem curator.

Given his recent editorial stances across episodes, produce:
1. A "personality_summary" (3-5 sentences): What does ${entityName} consistently believe? What's his editorial identity beyond just "confident curator"? What ecosystem themes does he care most about? How has he evolved?
2. A "stance_evolution" array: Track topics where his opinion shifted over time. Each entry has "topic", "arc" (how it changed), and "current" (where he stands now).

Only track stances that appeared in 2+ episodes or showed a clear shift.
${previousSummary}
${previousStances}

Respond with JSON:
{
  "personality_summary": "string",
  "stance_evolution": [{"topic": "string", "arc": "string", "current": "string"}]
}`;

  try {
    const result = await chatCompletionJson<{
      personality_summary: string;
      stance_evolution: Array<{ topic: string; arc: string; current: string }>;
    }>(system, `Recent editorial stances (last ${continuity.recent_opinions.length} tracked):\n${opinions}`, 'gpt-4o-mini');

    console.log(`[Idol Frame] Personality synthesis complete: ${result.stance_evolution.length} tracked stances`);
    return { summary: result.personality_summary, stanceEvolution: result.stance_evolution };
  } catch (err) {
    console.error('[Idol Frame] Personality synthesis failed:', err);
    return { summary: continuity.personality_summary, stanceEvolution: continuity.stance_evolution };
  }
}

// ---------------------------------------------------------------------------
// Active recurring patterns
// ---------------------------------------------------------------------------

async function detectActiveBits(
  continuity: EpisodeContinuity,
  episode: EpisodeData,
  entityName: string,
): Promise<Array<{ bit: string; first_seen: number; last_seen: number; uses: number; suggestion: string }>> {
  const allNarration = episode.segments.map(s => s.narration).join('\n');
  const existingBits = continuity.active_bits.map(b => b.bit).join(', ') || 'none yet';

  const system = `You track recurring editorial patterns and signature phrases for ${entityName}, a Base ecosystem curator.

Existing tracked patterns: ${existingBits}

Analyze this episode's narration. Look for:
1. New editorial patterns that could become signatures (framework phrases, analytical approaches, recurring metaphors)
2. Existing patterns that appeared again (should increment usage count)

For each pattern found, provide a "suggestion" — a creative direction for how ${entityName} could evolve or continue this pattern in future episodes. Be specific and in-character.

Respond with JSON:
{
  "bits": [
    {"bit": "short name of the pattern", "is_new": true/false, "suggestion": "how to evolve this in future episodes"}
  ]
}

Rules:
- Max 3 new patterns per episode
- A "pattern" is a repeating editorial approach, NOT a one-time observation
- Suggestions should be specific: "apply signal-vs-noise framework to governance proposals" not "keep using the framework"`;

  try {
    const result = await chatCompletionJson<{
      bits: Array<{ bit: string; is_new: boolean; suggestion: string }>;
    }>(system, `Episode ${episode.episodeNumber} narration:\n${allNarration}`, 'gpt-4o-mini');

    const updatedBits = [...continuity.active_bits];

    for (const detected of (result.bits || []).slice(0, 5)) {
      const existing = updatedBits.find(b => b.bit.toLowerCase() === detected.bit.toLowerCase());
      if (existing) {
        existing.last_seen = episode.episodeNumber;
        existing.uses += 1;
        existing.suggestion = detected.suggestion;
      } else if (detected.is_new) {
        updatedBits.push({
          bit: detected.bit.slice(0, 80),
          first_seen: episode.episodeNumber,
          last_seen: episode.episodeNumber,
          uses: 1,
          suggestion: detected.suggestion.slice(0, 200),
        });
      }
    }

    if (updatedBits.length > 15) {
      updatedBits.sort((a, b) => (b.uses * 10 + b.last_seen) - (a.uses * 10 + a.last_seen));
      updatedBits.length = 15;
    }

    console.log(`[Idol Frame] Active patterns: ${updatedBits.length} tracked (${result.bits?.filter(b => b.is_new).length || 0} new this ep)`);
    return updatedBits;
  } catch (err) {
    console.error('[Idol Frame] Active patterns detection failed:', err);
    return continuity.active_bits;
  }
}

function updateContinuityFromEpisode(
  continuity: EpisodeContinuity,
  episode: EpisodeData,
): EpisodeContinuity {
  const updated = { ...continuity };
  updated.episode_count = episode.episodeNumber;

  for (const article of episode.articles) {
    updated.stories_covered.push({
      title: article.title.slice(0, 100),
      episode: episode.episodeNumber,
    });
  }

  // Detect recurring patterns from narration
  const allNarration = episode.segments.map(s => s.narration).join(' ').toLowerCase();
  const BIT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /signal|this is signal/, label: 'signal-vs-noise framework' },
    { pattern: /builder|real building/, label: 'builder appreciation moments' },
    { pattern: /we tracked|we saw this|episode \d+/, label: 'cross-episode pattern recognition' },
    { pattern: /tvl|total value locked/, label: 'TVL tracking' },
    { pattern: /noise|this is noise|moving on/, label: 'noise dismissal' },
    { pattern: /farcaster|cast|channel/, label: 'Farcaster social signal tracking' },
    { pattern: /onchain|on-chain|the chain/, label: 'onchain data references' },
  ];
  for (const { pattern, label } of BIT_PATTERNS) {
    if (pattern.test(allNarration) && !updated.recurring_bits.includes(label)) {
      updated.recurring_bits.push(label);
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
  updateContinuityAsync(episode: EpisodeData): Promise<void>;
  validateSegment(narration: string): ValidationResult;
  validateSegmentDeep(narration: string): Promise<ValidationResult>;
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
        lines.push('Recent editorial stances:');
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
      console.log(`[Idol Frame] Continuity updated (sync): ep ${continuity.episode_count}, ${continuity.stories_covered.length} stories tracked`);
    },

    async updateContinuityAsync(episode: EpisodeData): Promise<void> {
      const name = entity.entity.name;

      continuity = updateContinuityFromEpisode(continuity, episode);

      const llmOpinions = await extractOpinionsLLM(episode.segments, name, episode.episodeNumber);
      for (const op of llmOpinions) {
        const topicLower = op.topic.toLowerCase();
        const isDupe = continuity.recent_opinions.some(
          o => o.topic.toLowerCase().includes(topicLower.slice(0, 25)) ||
               topicLower.includes(o.topic.toLowerCase().slice(0, 25))
        );
        if (!isDupe) continuity.recent_opinions.push(op);
      }
      if (continuity.recent_opinions.length > 30) {
        continuity.recent_opinions = continuity.recent_opinions.slice(-30);
      }

      continuity.active_bits = await detectActiveBits(continuity, episode, name);

      if (continuity.episode_count - continuity.last_synthesis_episode >= SYNTHESIS_INTERVAL) {
        const synthesis = await synthesizePersonality(continuity, name);
        continuity.personality_summary = synthesis.summary;
        continuity.stance_evolution = synthesis.stanceEvolution;
        continuity.last_synthesis_episode = continuity.episode_count;
        console.log(`[Idol Frame] Personality synthesized at ep ${continuity.episode_count}`);
      }

      saveContinuity(continuityPath, continuity);
      console.log(`[Idol Frame] Continuity updated: ep ${continuity.episode_count}, ${continuity.recent_opinions.length} opinions, ${continuity.active_bits.length} active patterns, ${continuity.stance_evolution.length} stances`);
    },

    validateSegment(narration: string): ValidationResult {
      return validateSegment(narration, entity);
    },

    async validateSegmentDeep(narration: string): Promise<ValidationResult> {
      return validateSegmentDeep(narration, entity);
    },

    getEntity(): EntityManifest {
      return entity;
    },

    getContinuityState(): EpisodeContinuity {
      return continuity;
    },
  };
}
