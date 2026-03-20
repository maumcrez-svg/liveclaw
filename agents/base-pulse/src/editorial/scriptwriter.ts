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

  const tickerItems = [
    `ETH $${plan.marketSnapshot.ethPrice.toLocaleString()} ${plan.marketSnapshot.ethChange24h >= 0 ? '▲' : '▼'}${Math.abs(plan.marketSnapshot.ethChange24h).toFixed(1)}%`,
    ...plan.marketSnapshot.topMovers.slice(0, 5).map(
      (m) => `${m.symbol} $${m.price.toLocaleString()} ${m.change >= 0 ? '▲' : '▼'}${Math.abs(m.change).toFixed(1)}%`,
    ),
  ];

  // Add Base TVL to ticker if available
  if (plan.marketSnapshot.baseTvl) {
    tickerItems.unshift(`BASE TVL $${(plan.marketSnapshot.baseTvl / 1e9).toFixed(2)}B ${(plan.marketSnapshot.baseTvlChange24h || 0) >= 0 ? '▲' : '▼'}${Math.abs(plan.marketSnapshot.baseTvlChange24h || 0).toFixed(1)}%`);
  }

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

MARKET DATA:
BTC: $${plan.marketSnapshot.btcPrice.toLocaleString()} (${plan.marketSnapshot.btcChange24h > 0 ? '+' : ''}${plan.marketSnapshot.btcChange24h.toFixed(1)}%)
ETH: $${plan.marketSnapshot.ethPrice.toLocaleString()} (${plan.marketSnapshot.ethChange24h > 0 ? '+' : ''}${plan.marketSnapshot.ethChange24h.toFixed(1)}%)${baseTvlLine}
Top movers: ${plan.marketSnapshot.topMovers.map((m) => `${m.name} (${m.symbol}): ${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%`).join(', ')}

TICKER ITEMS: ${JSON.stringify(tickerItems)}
${arcDirective}

Write the full BASE PULSE episode script following the EDITORIAL FLOW PLAN above. Include:
1. Opening segment — Vespolak sets the tone for today's pulse
2. Pulse check segment — rapid scan of 3-5 quick signals
3. Builder spotlight segment — deep look at 1-2 builders/projects
4. Signal analysis segment — connect dots, identify patterns
5. Chain radar segment — onchain data: TVL, tokens, deployments
6. Social pulse segment — Twitter/X and Farcaster attention layer
7. Closing segment — key takeaway + what to watch next

The editorial flow is MANDATORY. Each segment's energy and pacing must match its assigned beat.

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
