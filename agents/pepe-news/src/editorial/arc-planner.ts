// ---------------------------------------------------------------------------
// Emotional Arc Planner
//
// Sits between Ranker and Scriptwriter. Takes ranked stories with spiceLevels
// and plans the emotional trajectory of the entire episode.
//
// Without this: Larry might do 8 meltdowns in a row, or stay flat.
// With this: the episode has intentional pacing — build-up, peak, valley, climax, exhaustion.
// ---------------------------------------------------------------------------

import type { EpisodePlan } from '../models/types';
import { chatCompletionJson } from '../brain/llm-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmotionalBeat =
  | 'cold_open'        // controlled tension, hook the audience
  | 'escalation'       // building anxiety, things getting worse
  | 'meltdown'         // full freakout, peak energy
  | 'deadpan_valley'   // sudden calm, dry sarcasm, eerie composure
  | 'slow_burn'        // quiet dread, whispering, "this is actually bad"
  | 'comic_relief'     // absurdist break, Larry laughs at the chaos
  | 'rapid_fire'       // machine-gun delivery, no time to breathe
  | 'existential'      // steps back, questions everything, fourth wall
  | 'resigned'         // exhausted acceptance, "of course this happened"
  | 'finale_surge';    // second wind, one last burst before closing

export interface ArcAnnotation {
  storyIndex: number;       // which story in the ranked list
  beat: EmotionalBeat;      // the emotional beat for this segment
  energy: number;           // 1-10
  pacing: string;           // one-line pacing direction
  expression: string;       // avatar expression suggestion
  transition: string;       // how to bridge FROM the previous segment
}

export interface EmotionalArc {
  shape: string;            // one-line description of the arc shape
  annotations: ArcAnnotation[];
  introDirective: string;   // specific emotional direction for intro
  closingDirective: string; // specific emotional direction for closing
}

// ---------------------------------------------------------------------------
// Arc templates — heuristic fallback patterns
// ---------------------------------------------------------------------------

const ARC_PATTERNS: Array<{ name: string; beats: EmotionalBeat[] }> = [
  {
    name: 'classic_rollercoaster',
    beats: ['cold_open', 'meltdown', 'deadpan_valley', 'escalation', 'comic_relief', 'slow_burn', 'meltdown', 'rapid_fire', 'resigned'],
  },
  {
    name: 'slow_build_to_explosion',
    beats: ['cold_open', 'slow_burn', 'escalation', 'escalation', 'deadpan_valley', 'meltdown', 'meltdown', 'existential', 'resigned'],
  },
  {
    name: 'chaos_from_the_start',
    beats: ['meltdown', 'rapid_fire', 'deadpan_valley', 'comic_relief', 'escalation', 'slow_burn', 'meltdown', 'existential', 'resigned'],
  },
  {
    name: 'false_calm',
    beats: ['deadpan_valley', 'slow_burn', 'escalation', 'meltdown', 'comic_relief', 'rapid_fire', 'escalation', 'meltdown', 'resigned'],
  },
];

const BEAT_ENERGY: Record<EmotionalBeat, number> = {
  cold_open: 6,
  escalation: 7,
  meltdown: 10,
  deadpan_valley: 3,
  slow_burn: 5,
  comic_relief: 6,
  rapid_fire: 9,
  existential: 4,
  resigned: 3,
  finale_surge: 8,
};

const BEAT_EXPRESSION: Record<EmotionalBeat, string> = {
  cold_open: 'skeptical',
  escalation: 'surprised',
  meltdown: 'surprised',
  deadpan_valley: 'smirk',
  slow_burn: 'skeptical',
  comic_relief: 'smirk',
  rapid_fire: 'surprised',
  existential: 'neutral',
  resigned: 'smirk',
  finale_surge: 'surprised',
};

const BEAT_PACING: Record<EmotionalBeat, string> = {
  cold_open: 'Measured tension. Controlled delivery with ominous undertone.',
  escalation: 'Getting faster. Anxiety building. Sentences shortening.',
  meltdown: 'FULL SPEED. Stuttering. Gasping. Voice cracking. MAXIMUM LARRY.',
  deadpan_valley: 'Sudden eerie calm. Slow. Deliberate. Dead-eyed sarcasm.',
  slow_burn: 'Quiet dread. Almost whispering. "This is actually bad, folks."',
  comic_relief: 'Loose and absurd. Larry laughs at the chaos. Brief reprieve.',
  rapid_fire: 'Machine-gun delivery. Numbers flying. No pauses. Auctioneer mode.',
  existential: 'Steps back from the news. Breaks fourth wall. Questions life choices.',
  resigned: 'Exhausted acceptance. Trailing off. "Of course this happened."',
  finale_surge: 'Second wind. One last burst of energy before the lights go out.',
};

// ---------------------------------------------------------------------------
// Heuristic arc planner — fast, no LLM
// ---------------------------------------------------------------------------

export function planArcHeuristic(plan: EpisodePlan): EmotionalArc {
  const storyCount = plan.stories.length;

  // Pick arc pattern based on headline spice
  const headlineStory = plan.stories.find(s => s.articleId === plan.headline.articleId);
  const headlineSpice = headlineStory?.spiceLevel ?? 3;

  let pattern: typeof ARC_PATTERNS[number];
  if (headlineSpice >= 4) {
    pattern = ARC_PATTERNS[2]; // chaos_from_the_start
  } else if (headlineSpice <= 2) {
    pattern = ARC_PATTERNS[1]; // slow_build
  } else {
    // Alternate between classic and false_calm
    pattern = plan.stories.length % 2 === 0 ? ARC_PATTERNS[0] : ARC_PATTERNS[3];
  }

  // Map beats to stories (trim or extend pattern to fit)
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
        ? 'Open cold — no warmup, straight into it.'
        : `Shift from ${pattern.beats[(i - 1) % pattern.beats.length]} to ${beat}.`,
    });
  }

  return {
    shape: `${pattern.name}: ${pattern.beats.slice(0, storyCount).join(' → ')}`,
    annotations,
    introDirective: headlineSpice >= 4
      ? 'Open MANIC — Larry is already losing it before the first story.'
      : 'Open with controlled tension — Larry knows something bad is coming.',
    closingDirective: 'Larry is spent. Exhausted but wired. Questions why he does this.',
  };
}

// ---------------------------------------------------------------------------
// LLM arc planner — smarter, considers story content
// ---------------------------------------------------------------------------

export async function planArcLLM(plan: EpisodePlan, articles: Array<{ id: string; title: string }>): Promise<EmotionalArc> {
  const articleMap = new Map(articles.map(a => [a.id, a.title]));

  const storySummary = plan.stories
    .sort((a, b) => a.rank - b.rank)
    .map((s, i) => `${i + 1}. "${articleMap.get(s.articleId) || 'Unknown'}" (spice: ${s.spiceLevel}/5, angle: ${s.angle})`)
    .join('\n');

  const headlineTitle = articleMap.get(plan.headline.articleId) || 'Unknown';

  const beatList = [
    'cold_open', 'escalation', 'meltdown', 'deadpan_valley', 'slow_burn',
    'comic_relief', 'rapid_fire', 'existential', 'resigned', 'finale_surge',
  ].join(', ');

  const system = `You are an emotional arc planner for a crypto news show hosted by Larry, an anxious anchor.

Your job: take the ranked stories and plan the EMOTIONAL TRAJECTORY of the episode. Not just "play them in order" — design a pacing arc that keeps the audience hooked.

Available emotional beats: ${beatList}

Rules:
- NEVER assign the same beat to 3+ consecutive stories
- Meltdowns are precious — max 2 per episode, save them for the most impactful moments
- Every episode needs at least one valley (deadpan_valley, existential, or resigned)
- The arc should feel like a ride, not a flat line
- Consider how stories pair: a hack story followed by a regulation story creates ironic contrast
- The transition between beats matters — describe how Larry shifts

Respond with JSON:
{
  "shape": "one-line description of the arc (e.g., 'slow build to double meltdown with sarcastic valley')",
  "annotations": [
    {
      "storyIndex": 0,
      "beat": "one of the emotional beats",
      "energy": 1-10,
      "pacing": "one-line pacing direction for this segment",
      "expression": "smirk|surprised|skeptical|neutral",
      "transition": "how to bridge from previous segment"
    }
  ],
  "introDirective": "specific emotional direction for the intro",
  "closingDirective": "specific emotional direction for the closing"
}`;

  const user = `Headline: "${headlineTitle}" (teaser: ${plan.headline.teaser})

Stories in rank order:
${storySummary}

Plan the emotional arc for this ${plan.stories.length}-story episode.`;

  try {
    const result = await chatCompletionJson<EmotionalArc>(system, user, 'gpt-4o-mini');
    console.log(`[Arc Planner] LLM arc: "${result.shape}"`);
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

  lines.push(`\nEMOTIONAL ARC PLAN — "${arc.shape}":`);
  lines.push(`This episode has been pre-planned for pacing. Follow these emotional directions per segment:\n`);

  lines.push(`INTRO: ${arc.introDirective}`);

  for (const ann of arc.annotations) {
    const story = stories[ann.storyIndex];
    const rank = story ? ann.storyIndex + 1 : '?';
    lines.push(`STORY ${rank} [${ann.beat.toUpperCase()}] energy:${ann.energy}/10`);
    lines.push(`  Pacing: ${ann.pacing}`);
    lines.push(`  Expression: ${ann.expression}`);
    lines.push(`  Transition: ${ann.transition}`);
  }

  lines.push(`\nMARKET: rapid_fire — Larry speed-reads numbers, auctioneer mode.`);
  lines.push(`CLOSING: ${arc.closingDirective}`);

  lines.push(`\nIMPORTANT: The emotional beats above override the default energy levels. Follow the arc, not the spice levels alone.`);

  return lines.join('\n');
}
