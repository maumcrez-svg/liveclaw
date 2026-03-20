// ---------------------------------------------------------------------------
// Editorial Flow Planner
//
// Sits between Ranker and Scriptwriter. Takes ranked stories with spiceLevels
// and plans the editorial flow of the entire episode.
//
// Unlike Larry's emotional rollercoaster, Base Pulse uses a structured
// progression: signal → context → analysis → outlook
// ---------------------------------------------------------------------------

import type { EpisodePlan } from '../models/types';
import { chatCompletionJson } from '../brain/llm-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorialBeat =
  | 'establishing'      // set the stage, orient the viewer
  | 'tweet_deep_read'   // focused deep read of one tweet — read it, unpack it
  | 'tweet_reaction'    // genuine first reaction to a tweet — slower, personal
  | 'builder_focus'     // genuine appreciation, slower delivery
  | 'data_driven'       // numbers, charts, onchain reality
  | 'pattern_connect'   // connecting dots across stories
  | 'discourse_read'    // reading the conversation — replies, quote tweets, threads
  | 'editorial_take'    // Vespolak's strong opinion
  | 'forward_look'      // what to watch next
  | 'clean_close';      // takeaway and sign-off

export interface ArcAnnotation {
  storyIndex: number;
  beat: EditorialBeat;
  energy: number;           // 1-10
  pacing: string;
  expression: string;
  transition: string;
}

export interface EmotionalArc {
  shape: string;
  annotations: ArcAnnotation[];
  introDirective: string;
  closingDirective: string;
}

// ---------------------------------------------------------------------------
// Arc templates — heuristic fallback patterns
// ---------------------------------------------------------------------------

const ARC_PATTERNS: Array<{ name: string; beats: EditorialBeat[] }> = [
  {
    name: 'tweet_cascade',
    beats: ['establishing', 'tweet_deep_read', 'tweet_reaction', 'builder_focus', 'data_driven', 'discourse_read', 'editorial_take', 'forward_look'],
  },
  {
    name: 'builder_first',
    beats: ['establishing', 'builder_focus', 'tweet_deep_read', 'data_driven', 'discourse_read', 'pattern_connect', 'editorial_take', 'forward_look'],
  },
  {
    name: 'data_to_insight',
    beats: ['establishing', 'data_driven', 'tweet_deep_read', 'pattern_connect', 'builder_focus', 'discourse_read', 'editorial_take', 'forward_look'],
  },
  {
    name: 'discourse_driven',
    beats: ['establishing', 'discourse_read', 'tweet_deep_read', 'tweet_reaction', 'data_driven', 'pattern_connect', 'editorial_take', 'forward_look'],
  },
];

const BEAT_ENERGY: Record<EditorialBeat, number> = {
  establishing: 5,
  tweet_deep_read: 6,
  tweet_reaction: 5,
  builder_focus: 5,
  data_driven: 5,
  pattern_connect: 6,
  discourse_read: 5,
  editorial_take: 8,
  forward_look: 6,
  clean_close: 4,
};

const BEAT_EXPRESSION: Record<EditorialBeat, string> = {
  establishing: 'neutral',
  tweet_deep_read: 'focused',
  tweet_reaction: 'impressed',
  builder_focus: 'impressed',
  data_driven: 'focused',
  pattern_connect: 'confident',
  discourse_read: 'neutral',
  editorial_take: 'confident',
  forward_look: 'confident',
  clean_close: 'neutral',
};

const BEAT_PACING: Record<EditorialBeat, string> = {
  establishing: 'Calm, conversational opening. Setting the frame for today\'s discourse.',
  tweet_deep_read: 'Deliberate reading. Take time with this tweet — read it, unpack it, explain why it matters.',
  tweet_reaction: 'Genuine first reaction. Slower, personal. Vespolak speaks as himself, not as a host.',
  builder_focus: 'Genuine appreciation. Slower, more deliberate. Highlighting real work.',
  data_driven: 'Grounding energy. Numbers as context for the conversation, not standalone data.',
  pattern_connect: 'Analytical energy. Connecting dots the audience hasn\'t seen yet.',
  discourse_read: 'Reading the conversation. Replies, quote tweets, threads — what people are actually saying.',
  editorial_take: 'Strongest delivery. This is Vespolak\'s clear editorial position.',
  forward_look: 'Forward-facing energy. What to watch, what\'s building.',
  clean_close: 'Reflective, measured sign-off. One thread from today\'s conversation to carry.',
};

// ---------------------------------------------------------------------------
// Heuristic arc planner
// ---------------------------------------------------------------------------

export function planArcHeuristic(plan: EpisodePlan): EmotionalArc {
  const storyCount = plan.stories.length;

  const headlineStory = plan.stories.find(s => s.articleId === plan.headline.articleId);
  const headlineSpice = headlineStory?.spiceLevel ?? 3;

  let pattern: typeof ARC_PATTERNS[number];
  if (headlineSpice >= 4) {
    pattern = ARC_PATTERNS[0]; // signal_cascade
  } else if (headlineSpice <= 2) {
    pattern = ARC_PATTERNS[2]; // data_to_insight
  } else {
    pattern = plan.stories.length % 2 === 0 ? ARC_PATTERNS[1] : ARC_PATTERNS[3];
  }

  const annotations: ArcAnnotation[] = [];
  for (let i = 0; i < storyCount; i++) {
    const beat = pattern.beats[i % pattern.beats.length];
    annotations.push({
      storyIndex: i,
      beat,
      energy: BEAT_ENERGY[beat],
      pacing: BEAT_PACING[beat],
      expression: BEAT_EXPRESSION[beat],
      transition: i === 0
        ? 'Open direct — establish the pulse immediately.'
        : `Flow from ${pattern.beats[(i - 1) % pattern.beats.length]} to ${beat}.`,
    });
  }

  return {
    shape: `${pattern.name}: ${pattern.beats.slice(0, storyCount).join(' → ')}`,
    annotations,
    introDirective: headlineSpice >= 4
      ? 'Open with clear authority — there\'s a major signal today and Vespolak knows it.'
      : 'Open with confident overview — a day of building and signals worth tracking.',
    closingDirective: 'Clean, confident close. One specific takeaway. What to watch next.',
  };
}

// ---------------------------------------------------------------------------
// LLM arc planner
// ---------------------------------------------------------------------------

export async function planArcLLM(plan: EpisodePlan, articles: Array<{ id: string; title: string }>): Promise<EmotionalArc> {
  const articleMap = new Map(articles.map(a => [a.id, a.title]));

  const storySummary = plan.stories
    .sort((a, b) => a.rank - b.rank)
    .map((s, i) => `${i + 1}. "${articleMap.get(s.articleId) || 'Unknown'}" (spice: ${s.spiceLevel}/5, angle: ${s.angle})`)
    .join('\n');

  const headlineTitle = articleMap.get(plan.headline.articleId) || 'Unknown';

  const beatList = [
    'establishing', 'tweet_deep_read', 'tweet_reaction', 'builder_focus', 'data_driven',
    'pattern_connect', 'discourse_read', 'editorial_take', 'forward_look', 'clean_close',
  ].join(', ');

  const system = `You are an editorial flow planner for a Base L2 ecosystem show hosted by Vespolak, a confident curator.

Your job: take the ranked stories and plan the EDITORIAL FLOW of the episode. Design a progression that builds insight, not just lists stories.

Available editorial beats: ${beatList}

Rules:
- NEVER assign the same beat to 3+ consecutive stories
- editorial_take is precious — max 2 per episode, save them for the most significant signals
- Every episode needs at least one builder_focus or deep_signal segment
- The flow should feel like building understanding, not random information
- Consider how stories pair: onchain data followed by builder spotlight creates evidence → example flow
- Transitions should feel natural — describe how Vespolak shifts focus

Respond with JSON:
{
  "shape": "one-line description of the flow (e.g., 'signal cascade with builder spotlight at the center')",
  "annotations": [
    {
      "storyIndex": 0,
      "beat": "one of the editorial beats",
      "energy": 1-10,
      "pacing": "one-line pacing direction for this segment",
      "expression": "neutral|focused|confident|impressed",
      "transition": "how to bridge from previous segment"
    }
  ],
  "introDirective": "specific editorial direction for the opening",
  "closingDirective": "specific editorial direction for the closing"
}`;

  const user = `Headline: "${headlineTitle}" (teaser: ${plan.headline.teaser})

Stories in rank order:
${storySummary}

Plan the editorial flow for this ${plan.stories.length}-story episode.`;

  try {
    const result = await chatCompletionJson<EmotionalArc>(system, user, 'gpt-4o-mini');
    console.log(`[Arc Planner] LLM flow: "${result.shape}"`);
    return result;
  } catch (err) {
    console.error('[Arc Planner] LLM failed, using heuristic:', err);
    return planArcHeuristic(plan);
  }
}

// ---------------------------------------------------------------------------
// Format arc as injection for the scriptwriter prompt
// ---------------------------------------------------------------------------

export function formatArcForPrompt(arc: EmotionalArc, stories: EpisodePlan['stories']): string {
  const lines: string[] = [];

  lines.push(`\nEDITORIAL FLOW PLAN — "${arc.shape}":`);
  lines.push(`This episode has been pre-planned for editorial flow. Follow these directions per segment:\n`);

  lines.push(`OPENING: ${arc.introDirective}`);

  for (const ann of arc.annotations) {
    const story = stories[ann.storyIndex];
    const rank = story ? ann.storyIndex + 1 : '?';
    lines.push(`STORY ${rank} [${ann.beat.toUpperCase()}] energy:${ann.energy}/10`);
    lines.push(`  Pacing: ${ann.pacing}`);
    lines.push(`  Expression: ${ann.expression}`);
    lines.push(`  Transition: ${ann.transition}`);
  }

  lines.push(`\nCHAIN RADAR: data_driven — Vespolak reads the numbers. TVL, tokens, deployments.`);
  lines.push(`CLOSING: ${arc.closingDirective}`);

  lines.push(`\nIMPORTANT: The editorial beats above guide the flow. Follow the progression, not just the spice levels.`);

  return lines.join('\n');
}
