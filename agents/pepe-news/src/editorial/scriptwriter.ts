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

  // Build article lookup
  const articleMap = new Map(articles.map((a) => [a.id, a]));

  // Build the selected stories with full details
  const selectedStories = plan.stories
    .sort((a, b) => a.rank - b.rank)
    .map((s) => {
      const article = articleMap.get(s.articleId);
      return {
        ...s,
        title: article?.title || 'Unknown',
        summary: article?.summary || '',
        source: article?.source || 'Unknown',
        category: article?.category || 'macro',
      };
    });

  const headlineArticle = articleMap.get(plan.headline.articleId);

  // Format ticker items from market data
  const tickerItems = [
    `BTC $${plan.marketSnapshot.btcPrice.toLocaleString()} ${plan.marketSnapshot.btcChange24h >= 0 ? '▲' : '▼'}${Math.abs(plan.marketSnapshot.btcChange24h).toFixed(1)}%`,
    `ETH $${plan.marketSnapshot.ethPrice.toLocaleString()} ${plan.marketSnapshot.ethChange24h >= 0 ? '▲' : '▼'}${Math.abs(plan.marketSnapshot.ethChange24h).toFixed(1)}%`,
    ...plan.marketSnapshot.topMovers.slice(0, 4).map(
      (m) => `${m.symbol} $${m.price.toLocaleString()} ${m.change >= 0 ? '▲' : '▼'}${Math.abs(m.change).toFixed(1)}%`,
    ),
  ];

  const episodeLabel = episodeNumber ? `\nEPISODE NUMBER: ${episodeNumber}\nCRITICAL: Larry MUST say "Episode ${episodeNumber}" in the intro. Do NOT invent a different number. The exact number is ${episodeNumber}.\n` : '';

  // Plan emotional arc before writing the script
  console.log('[ScriptWriter] Planning emotional arc...');
  let arc;
  try {
    arc = await planArcLLM(plan, articles.map(a => ({ id: a.id, title: a.title })));
  } catch {
    arc = planArcHeuristic(plan);
  }
  const arcDirective = formatArcForPrompt(arc, plan.stories);
  console.log(`[ScriptWriter] Arc planned: "${arc.shape}"`);

  const userPrompt = `Today: ${plan.date}${episodeLabel}

HEADLINE (main story):
Title: ${headlineArticle?.title || 'Unknown'}
Source: ${headlineArticle?.source || 'Unknown'}
Summary: ${headlineArticle?.summary || ''}
Teaser: ${plan.headline.teaser}

SELECTED STORIES (in order):
${selectedStories.map((s, i) => `${i + 1}. [${s.category}] ${s.title} (${s.source})
   Summary: ${s.summary}
   Angle: ${s.angle}
   Spice level: ${s.spiceLevel}/5`).join('\n\n')}

MARKET DATA:
BTC: $${plan.marketSnapshot.btcPrice.toLocaleString()} (${plan.marketSnapshot.btcChange24h > 0 ? '+' : ''}${plan.marketSnapshot.btcChange24h.toFixed(1)}%)
ETH: $${plan.marketSnapshot.ethPrice.toLocaleString()} (${plan.marketSnapshot.ethChange24h > 0 ? '+' : ''}${plan.marketSnapshot.ethChange24h.toFixed(1)}%)
Top movers: ${plan.marketSnapshot.topMovers.map((m) => `${m.name} (${m.symbol}): ${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%`).join(', ')}

TICKER ITEMS: ${JSON.stringify(tickerItems)}
${arcDirective}

Write the full PEPE NEWS episode script following the EMOTIONAL ARC PLAN above. Include:
1. Intro segment — follow the intro directive
2. Headline segment (main story, most detail) — follow its assigned beat
3. One segment per selected story — follow each story's assigned beat, energy, pacing, and transition
4. Market in a minute segment — rapid fire auctioneer mode
5. Closing segment — follow the closing directive

The emotional arc is MANDATORY. Each segment's energy and pacing must match its assigned beat.

Return valid JSON.`;

  const script = await chatCompletionJson<EpisodeScript>(
    SCRIPTWRITER_SYSTEM,
    userPrompt,
    'gpt-4o',
  );

  // Ensure ticker items are set
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
