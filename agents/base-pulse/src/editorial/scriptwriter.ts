import fs from 'fs';
import path from 'path';
import type { RawArticle, EpisodePlan, EpisodeScript } from '../models/types';
import { chatCompletionJson } from '../brain/llm-client';
import { SCRIPTWRITER_SYSTEM } from './prompts-idol-frame';
import { planArcLLM, planArcHeuristic, formatArcForPrompt } from './arc-planner';

export async function writeScript(
  plan: EpisodePlan,
  articles: RawArticle[],
  episodeNumber?: number,
): Promise<EpisodeScript> {
  console.log('[ScriptWriter] Generating episode script...');

  const articleMap = new Map(articles.map((a) => [a.id, a]));

  const selectedStories = plan.stories
    .sort((a, b) => a.rank - b.rank)
    .map((s) => {
      const article = articleMap.get(s.articleId);
      return {
        ...s,
        title: article?.title || 'Unknown',
        summary: article?.summary || '',
        source: article?.source || 'Unknown',
        category: article?.category || 'base_ecosystem',
        layer: article?.layer || 'unknown',
      };
    });

  const headlineArticle = articleMap.get(plan.headline.articleId);

  // Base-only ticker — no BTC/ETH/SOL noise
  const baseMovers = plan.marketSnapshot.topMovers.filter(m => !['BTC', 'ETH', 'SOL'].includes(m.symbol));
  const tickerItems = [
    ...(plan.marketSnapshot.baseTvl ? [`BASE TVL $${(plan.marketSnapshot.baseTvl / 1e9).toFixed(2)}B ${(plan.marketSnapshot.baseTvlChange24h || 0) >= 0 ? '▲' : '▼'}${Math.abs(plan.marketSnapshot.baseTvlChange24h || 0).toFixed(1)}%`] : []),
    ...baseMovers.slice(0, 6).map(
      (m) => `${m.symbol} $${m.price.toLocaleString()} ${m.change >= 0 ? '▲' : '▼'}${Math.abs(m.change).toFixed(1)}%`,
    ),
  ];

  const episodeLabel = episodeNumber ? `\nEPISODE NUMBER: ${episodeNumber}\nCRITICAL: Vespolak MUST say "Episode ${episodeNumber}" in the opening. Do NOT invent a different number. The exact number is ${episodeNumber}.\n` : '';

  // Plan editorial flow
  console.log('[ScriptWriter] Planning editorial flow...');
  let arc;
  try {
    arc = await planArcLLM(plan, articles.map(a => ({ id: a.id, title: a.title })));
  } catch {
    arc = planArcHeuristic(plan);
  }
  const arcDirective = formatArcForPrompt(arc, plan.stories);
  console.log(`[ScriptWriter] Flow planned: "${arc.shape}"`);

  const baseTvlLine = plan.marketSnapshot.baseTvl
    ? `\nBase TVL: $${(plan.marketSnapshot.baseTvl / 1e9).toFixed(2)}B (${(plan.marketSnapshot.baseTvlChange24h || 0) >= 0 ? '+' : ''}${(plan.marketSnapshot.baseTvlChange24h || 0).toFixed(1)}%)`
    : '';

  const userPrompt = `Today: ${plan.date}${episodeLabel}

HEADLINE (main signal):
Title: ${headlineArticle?.title || 'Unknown'}
Source: ${headlineArticle?.source || 'Unknown'}
Layer: ${headlineArticle?.layer || 'unknown'}
Summary: ${headlineArticle?.summary || ''}
Teaser: ${plan.headline.teaser}

SELECTED STORIES (in order):
${selectedStories.map((s, i) => `${i + 1}. [${s.category}] [${s.layer}] ${s.title} (${s.source})
   Summary: ${s.summary}
   Angle: ${s.angle}
   Spice level: ${s.spiceLevel}/5`).join('\n\n')}

BASE ECOSYSTEM DATA:
${baseTvlLine}
Gas: ${plan.marketSnapshot.baseGasGwei !== undefined ? (plan.marketSnapshot.baseGasGwei < 0.01 ? '< 0.01 gwei' : plan.marketSnapshot.baseGasGwei.toFixed(4) + ' gwei') : 'unavailable'}
Base tokens: ${baseMovers.map((m) => `${m.name} (${m.symbol}): ${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%`).join(', ') || 'no data'}
DO NOT mention BTC, ETH, or SOL prices. This show is about Base ecosystem ONLY.

TICKER ITEMS: ${JSON.stringify(tickerItems)}
${arcDirective}

Write the full BASE PULSE episode as a DELIBERATE, SUBSTANTIVE SHOW (~6-8 minutes).

STRUCTURE — 6 segments. This is a CONVERSATION DESK, not a newsroom:

1. OPENING (opening) — 20-30s. Set the conversational frame. What caught Vespolak's eye on the timeline today. No rushing.
   "The Base timeline has been interesting today. There's a conversation I want to pull into."

2. TWEET #1 (social_pulse) — 60-80s. THE MAIN TWEET. Read it. Say who posted it. React genuinely. Unpack it. If there are replies or quotes, bring them in. This tweet gets its FULL moment.

3. TWEET #2 (social_pulse) — 50-70s. Second voice. Different person, different angle. Connect or contrast with tweet #1. Read it, react, interpret.

4. ONCHAIN READ (chain_radar) — 40-50s. Numbers as CONTEXT. Connect the data to what the tweets are saying. "The conversation says X. The chain confirms it."

5. TWEET #3 (social_pulse) — 50-70s. Third tweet. Could be a builder, a caller, an emerging voice. Vespolak lingers here. Connects to the earlier conversation.

6. CLOSING (closing) — 20-30s. What the conversation today tells us. One thread to carry. Clean exit.

CRITICAL RULES:
- Read tweet text IN the narration. Use "quote" and "end quote" framing.
- After reading a tweet, PAUSE. React as Vespolak. Don't jump to the next thing.
- Each social_pulse is ONE tweet and its surrounding discourse. Not a headline.
- NEVER rush. Vespolak is PRESENT with each tweet. He's reading the conversation, not racing through headlines.
- 6 segments. No padding. No filler. If there are only 2 good tweets, cover 2 tweets well.
- ALL social_pulse segments MUST reference a specific tweet with @username and the tweet text.
- NO BTC or ETH price mentions unless directly affecting Base.
- Total: ~360-480 seconds (6-8 minutes). Let the conversation breathe.

Return valid JSON.`;

  const script = await chatCompletionJson<EpisodeScript>(
    SCRIPTWRITER_SYSTEM,
    userPrompt,
    'gpt-4o',
  );

  for (const seg of script.segments) {
    if (!seg.tickerItems || seg.tickerItems.length === 0) {
      seg.tickerItems = tickerItems;
    }
  }

  console.log(
    `[ScriptWriter] Generated ${script.segments.length} segments, ~${script.totalEstimatedDurationSec}s total`,
  );
  return script;
}

// CLI entry point
if (require.main === module) {
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(__dirname, '..', '..', 'output', date);

  const planPath = path.join(dir, 'episode_plan.json');
  const articlesPath = path.join(dir, 'raw_articles.json');

  if (!fs.existsSync(planPath)) {
    console.error(`[ScriptWriter] No plan found. Run ranker first: pnpm editorial`);
    process.exit(1);
  }

  const plan: EpisodePlan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
  const articles: RawArticle[] = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));

  writeScript(plan, articles)
    .then((script) => {
      fs.writeFileSync(path.join(dir, 'episode_script.json'), JSON.stringify(script, null, 2));
      console.log(`[ScriptWriter] Saved episode_script.json`);
      console.log('\n--- EPISODE PREVIEW ---');
      for (const seg of script.segments) {
        console.log(`\n[${seg.type.toUpperCase()}] ${seg.headline}`);
        console.log(`  ${seg.narration.slice(0, 120)}...`);
      }
    })
    .catch((err) => {
      console.error('[ScriptWriter] Fatal:', err);
      process.exit(1);
    });
}
