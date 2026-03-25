import type { RawArticle, NewsCategory } from '../models/types';
import { config } from '../config';
import crypto from 'crypto';

interface TwitterTweet {
  id: string;
  text: string;
  url: string;
  author: {
    userName: string;
    name: string;
    followers?: number;
    isBlueVerified?: boolean;
  };
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  isReply: boolean;
}

interface TwitterSearchResponse {
  tweets: TwitterTweet[];
  has_next_page?: boolean;
  next_cursor?: string;
}

const SEARCH_ENDPOINT = 'https://api.twitterapi.io/twitter/tweet/advanced_search';

// Seed accounts — Base ecosystem influencers & builders
const SEED_ACCOUNTS = [
  // Core ecosystem
  'base', 'coinbase', 'jessepollak', 'BuildOnBase',
  // Builders & devs
  'MLeeJr', 'QuigleyNFT', '0xvsr', 'Zer0H1ro', 'bbyron', 'tomosman',
  'JulioMCruz', '0xDeployer', 'mbarrbosa', 'igoryuzo', 'itsMeBennyB',
  'Mischa0X', 'KSimback', 'Austen', 'nateliason', 'russ_mcade',
  'david_tomu', 'HelloBenWhite', 'ethereumdegen', 'Truunik',
  'austingriffith', 'santisiri', 'prollynuthin', '0xm1kr',
  'HeresMyEth', 'AspynPalatnick', 'squirtle0x',
  // Community & culture
  'tradingtulips', 'DecentralBros_', 'LexSokolin',
  'CRYPT0forCHANGE', 'ccryptoji', 'smolemaru', 'Arlo_the_Intern',
  'reppo', 'gitlawb', 'otonix_tech', 'hashlink_me', 'dany',
  'sharafi_eth', '__iamcharis', '1CrypticPoet', 'iamveektoria_',
  'lucianodeangeIo',
];

// Intelligent polling — rotate through batches to avoid burning API
const BATCH_SIZE = 10;
let currentBatchIndex = 0;
let pollCount = 0;

function getNextQueries(): string[] {
  const queries: string[] = [];

  // Always run the general Base search (1 call)
  queries.push('"Base L2" OR "Base chain" OR "build on Base" OR "onchain Base" -is:retweet lang:en');

  // Rotate through seed account batches — 1 batch per poll (1 call)
  const start = currentBatchIndex * BATCH_SIZE;
  const batch = SEED_ACCOUNTS.slice(start, start + BATCH_SIZE);
  if (batch.length > 0) {
    queries.push(`(from:${batch.join(' OR from:')}) -is:retweet`);
  }

  // Advance to next batch for next poll
  currentBatchIndex++;
  if (currentBatchIndex * BATCH_SIZE >= SEED_ACCOUNTS.length) {
    currentBatchIndex = 0; // wrap around
  }

  pollCount++;
  console.log(`[Twitter] Poll #${pollCount}: general + batch ${currentBatchIndex}/${Math.ceil(SEED_ACCOUNTS.length / BATCH_SIZE)} (${batch.length} accounts) — 2 API calls`);

  return queries;
}

/**
 * Fetch Base-related tweets from twitterapi.io (GET endpoint)
 * Layer 5: attention layer + narrative velocity
 *
 * Smart polling: 2 API calls per poll cycle
 *   - 1 general "Base L2" search
 *   - 1 rotating batch of ~10 seed accounts
 * Full account coverage every ~5 poll cycles (~25 min)
 */
export async function fetchTwitterSignals(): Promise<RawArticle[]> {
  if (!config.twitterApiKey) {
    console.log('[Twitter] No TWITTERAPI_KEY set, skipping');
    return [];
  }

  const articles: RawArticle[] = [];
  const queries = getNextQueries();

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        query,
        queryType: 'Latest',
        cursor: '',
      });

      const res = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'X-API-Key': config.twitterApiKey,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.error(`[Twitter] Search returned ${res.status}`);
        continue;
      }

      const data = (await res.json()) as TwitterSearchResponse;
      const tweets = data.tweets || [];

      for (const tweet of tweets) {
        if (!tweet.text || tweet.text.length < 30) continue;
        if (tweet.isReply) continue;

        // Engagement filter — skip noise
        const engagement = (tweet.likeCount || 0) + (tweet.retweetCount || 0) * 2 + (tweet.replyCount || 0);
        if (engagement < 1 && (tweet.viewCount || 0) < 50) continue;

        const id = crypto.createHash('md5').update(tweet.id).digest('hex').slice(0, 12);
        const author = tweet.author?.userName || 'unknown';

        articles.push({
          id,
          title: `@${author}: ${tweet.text.slice(0, 120)}`,
          summary: tweet.text.slice(0, 300),
          url: tweet.url || `https://x.com/${author}/status/${tweet.id}`,
          source: `Twitter/@${author}`,
          publishedAt: new Date(tweet.createdAt).toISOString(),
          category: detectCategory(tweet.text, author),
          layer: 'social_twitter',
          signalType: detectSignalType(tweet.text),
        });
      }

      // Small delay between queries to be nice to the API
      if (queries.indexOf(query) < queries.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      console.error('[Twitter] Fetch failed:', err);
    }
  }

  console.log(`[Twitter] ${articles.length} signals found`);
  return articles;
}

function detectSignalType(text: string): 'builder' | 'launch' | 'narrative' | 'culture' {
  const lower = text.toLowerCase();
  if (/deploy|ship|launch|live on|mainnet|just dropped/.test(lower)) return 'launch';
  if (/build|dev|hack|grant|code|commit|pr merged/.test(lower)) return 'builder';
  if (/narrative|trend|alpha|signal|thesis/.test(lower)) return 'narrative';
  return 'culture';
}

function detectCategory(text: string, author: string): NewsCategory {
  const lower = text.toLowerCase();
  const coreAccounts = ['base', 'coinbase', 'jessepollak', 'buildonbase'];
  if (coreAccounts.includes(author.toLowerCase())) return 'base_ecosystem';
  if (/deploy|ship|launch|live on|mainnet/.test(lower)) return 'launch';
  if (/build|dev|hack|grant|code|commit/.test(lower)) return 'builder';
  if (/tvl|gas|block|transaction|onchain/.test(lower)) return 'onchain';
  if (/defi|swap|liquidity|pool|yield/.test(lower)) return 'defi';
  return 'culture';
}
