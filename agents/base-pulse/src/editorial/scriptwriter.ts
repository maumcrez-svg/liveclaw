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
NOTE: Onchain data is displayed as a persistent overlay on screen. Do NOT create a chain_radar segment. Use this data only as context when reacting to tweets.
DO NOT mention BTC, ETH, or SOL prices. This show is about Base ecosystem ONLY.

TICKER ITEMS: ${JSON.stringify(tickerItems)}
${arcDirective}

Write the full BASE PULSE episode as a DELIBERATE, SUBSTANTIVE SHOW (~8-12 minutes).

STRUCTURE — 10 segments. This is a CONVERSATION DESK, not a newsroom:

1. OPENING (opening) — 20-30s. Set the conversational frame. What caught Vespolak's eye on the timeline today. No rushing.
   "The Base timeline has been interesting today. There's a conversation I want to pull into."

2. TWEET #1 (social_pulse) — 50-70s. THE MAIN TWEET. Read it. Say who posted it. React genuinely. Unpack it.

3. TWEET #2 (social_pulse) — 40-60s. Second voice. Different person, different angle. Connect or contrast with tweet #1.

4. TWEET #3 (social_pulse) — 15-60s. Could be serious (full treatment) or playful (quick one-liner). Varies.

5. TWEET #4 (social_pulse) — 15-60s. Different energy from #3. If #3 was serious, this one can be quick. Mix it up.

6. TWEET #5 (social_pulse) — 40-60s. Mid-episode anchor tweet. Something substantive — a builder, a take, a thread.

7. TWEET #6 (social_pulse) — 15-60s. Keep the flow. Serious or playful depending on the content.

8. TWEET #7 (social_pulse) — 15-60s. Different voice, different corner of the ecosystem.

9. TWEET #8 (social_pulse) — 30-50s. Last tweet. Something that ties back to the episode's theme or opens a new thread.

10. CLOSING (closing) — 20-30s. What the conversation today tells us. One thread to carry. Clean exit.

CRITICAL RULES:
- 8 tweets MINIMUM per episode. More is better. Cover the timeline broadly.
- ALL social_pulse segments MUST reference a specific tweet with @username and the tweet text.
- NO onchain data commentary. Onchain metrics are displayed on-screen automatically.
- Total: ~480-720 seconds (8-12 minutes). Cover the timeline.

EVERY TWEET SEGMENT MUST HAVE 3 PARTS — THIS IS MANDATORY:
  PART 1 — INTRODUCE: "So @username just posted something." or "There's a tweet from @username I want to read."
  PART 2 — READ: "Quote: '[the actual tweet text]'. End quote."
  PART 3 — COMMENT: Vespolak's PERSONAL reaction. This is the most important part. He agrees, disagrees, adds context, connects it to something, gives his take. This is NOT optional. Every single tweet MUST have Vespolak's commentary after reading it.

NEVER just read a tweet and move on. NEVER. Vespolak ALWAYS has something to say about every tweet he reads. Even playful tweets get a reaction.

EXAMPLE — SERIOUS TWEET (40-70s):
"@jessepollak posted something today. Let me read this. Quote: 'The next thousand builders on Base will look nothing like the first thousand.' End quote. That's a big statement. And honestly — I think he's right. The first wave was DeFi natives. What's coming next is different. Mobile-first builders. AI teams. People who've never touched Solidity. That's the shift he's pointing at. And the chain is ready for it."

EXAMPLE — PLAYFUL TWEET (15-25s):
"@smolemaru tweeted — quote: 'Base chain so fast my transactions arrive before I click send.' End quote. Fair. Can't argue with that. The timeline is undefeated today."

EXAMPLE — BUILDER TWEET (50-70s):
"I want to read something from @0xDeployer. Quote: 'Just shipped V2. No announcement thread. Just code.' End quote. This is the kind of thing I live for on this desk. No hype. No countdown. Just deployed. I've been tracking this builder since episode thirty-something. Quiet. Consistent. And now V2 is live. That's real building."

BAD — NEVER DO THIS:
"@jessepollak posted about builders. @smolemaru tweeted about speed. @0xDeployer shipped V2."
That's headline reading. That's a news anchor. Vespolak comments on EVERY tweet.

TWEET TONE — SERIOUS vs PLAYFUL (mix both for pacing):
- SERIOUS tweets: Full treatment. Introduce, read, comment deeply. 40-70 seconds.
- PLAYFUL/MEME tweets: Introduce, read, quick one-liner reaction — Jesse Pollak energy. 15-25 seconds.
- Mix ~4-5 serious + ~3-4 playful per episode.

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
