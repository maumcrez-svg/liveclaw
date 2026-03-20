import fs from 'fs';
import path from 'path';
import type { RawArticle, MarketSnapshot, EpisodePlan } from '../models/types';
import { chatCompletionJson } from '../brain/llm-client';
import { RANKER_SYSTEM } from './prompts-idol-frame';

interface RankerOutput {
  headline: { articleId: string; teaser: string };
  stories: Array<{
    articleId: string;
    rank: number;
    spiceLevel: 1 | 2 | 3 | 4 | 5;
    angle: string;
  }>;
}

export async function rankNews(
  articles: RawArticle[],
  market: MarketSnapshot,
): Promise<EpisodePlan> {
  console.log(`[Ranker] Ranking ${articles.length} articles...`);

  const topArticles = articles.slice(0, 50);
  const articleList = topArticles
    .map(
      (a) =>
        `[${a.id}] (${a.source}) [${a.category}] [${a.layer || 'unknown'}] ${a.title}\n   ${a.summary.slice(0, 150)}`,
    )
    .join('\n\n');

  const baseTvlLine = market.baseTvl
    ? `Base TVL: $${(market.baseTvl / 1e9).toFixed(2)}B (${(market.baseTvlChange24h || 0) >= 0 ? '+' : ''}${(market.baseTvlChange24h || 0).toFixed(1)}%)`
    : 'Base TVL: unavailable';

  const baseMovers = market.topMovers.filter(m => !['BTC', 'ETH', 'SOL'].includes(m.symbol));
  const marketSummary = `Base ecosystem:
${baseTvlLine}
Base gas: ${market.baseGasGwei !== undefined ? (market.baseGasGwei < 0.01 ? '< 0.01 gwei' : market.baseGasGwei.toFixed(4) + ' gwei') : 'unavailable'}
Base tokens: ${baseMovers.map((m) => `${m.symbol} ${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%`).join(', ') || 'no data'}`;

  const userPrompt = `Today's date: ${new Date().toISOString().slice(0, 10)}

${marketSummary}

ARTICLES (tweets + onchain signals):
${articleList}

Select 3-5 stories for today's BASE PULSE episode. These are ALL tweets and onchain signals — pick the most interesting, spicy, and substantive ones. Prioritize tweets from builders, ecosystem figures, and anyone with real takes.

TWEET CONTEXT — PRESERVE:
- When selecting tweets, note if they are part of a reply thread or quote tweet chain.
- Preserve the original tweet author's @username in the angle field.
- If a tweet has notable replies or quote tweets, mention them in the angle.

Return JSON.`;

  const result = await chatCompletionJson<RankerOutput>(
    RANKER_SYSTEM,
    userPrompt,
    'gpt-4o-mini',
  );

  const plan: EpisodePlan = {
    date: new Date().toISOString().slice(0, 10),
    headline: result.headline,
    stories: result.stories,
    marketSnapshot: market,
  };

  console.log(`[Ranker] Selected ${plan.stories.length} stories, headline: "${plan.headline.teaser}"`);
  return plan;
}

// CLI entry point
if (require.main === module) {
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(__dirname, '..', '..', 'output', date);

  const articlesPath = path.join(dir, 'raw_articles.json');
  const marketPath = path.join(dir, 'market_snapshot.json');

  if (!fs.existsSync(articlesPath)) {
    console.error(`[Ranker] No articles found. Run ingest first: pnpm ingest`);
    process.exit(1);
  }

  const articles: RawArticle[] = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
  const market: MarketSnapshot = fs.existsSync(marketPath)
    ? JSON.parse(fs.readFileSync(marketPath, 'utf-8'))
    : { btcPrice: 0, btcChange24h: 0, ethPrice: 0, ethChange24h: 0, topMovers: [] };

  rankNews(articles, market)
    .then((plan) => {
      fs.writeFileSync(path.join(dir, 'episode_plan.json'), JSON.stringify(plan, null, 2));
      console.log(`[Ranker] Saved episode_plan.json`);
    })
    .catch((err) => {
      console.error('[Ranker] Fatal:', err);
      process.exit(1);
    });
}
