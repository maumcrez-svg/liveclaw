import type { RawArticle } from '../models/types';
import { config } from '../config';
import { FARCASTER } from './sources';
import crypto from 'crypto';

interface NeynarCast {
  hash: string;
  text: string;
  author: {
    username: string;
    display_name?: string;
    fid: number;
  };
  timestamp: string;
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
  replies: {
    count: number;
  };
  channel?: {
    id: string;
    name?: string;
  };
}

interface NeynarFeedResponse {
  casts?: NeynarCast[];
  next?: { cursor?: string };
}

/**
 * Fetch Base-related casts from Farcaster via Neynar API
 * Layer 3: builder-native conversation
 */
export async function fetchFarcasterSignals(): Promise<RawArticle[]> {
  if (!config.neynarApiKey) {
    console.log('[Farcaster] No NEYNAR_API_KEY set, skipping');
    return [];
  }

  const articles: RawArticle[] = [];

  for (const channelId of FARCASTER.channels) {
    try {
      const url = `${FARCASTER.channelFeed}?channel_ids=${channelId}&with_recasts=false&limit=25`;
      const res = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'x-api-key': config.neynarApiKey,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`[Farcaster] Channel /${channelId} returned ${res.status}`);
        continue;
      }

      const data = (await res.json()) as NeynarFeedResponse;
      const casts = data.casts || [];

      for (const cast of casts) {
        if (!cast.text || cast.text.length < 30) continue;

        // Only include casts with meaningful engagement
        const engagement = cast.reactions.likes_count + cast.reactions.recasts_count * 2 + cast.replies.count;
        if (engagement < 3) continue;

        const id = crypto.createHash('md5').update(cast.hash).digest('hex').slice(0, 12);

        articles.push({
          id,
          title: `@${cast.author.username} in /${channelId}: ${cast.text.slice(0, 120)}`,
          summary: cast.text.slice(0, 300),
          url: `https://warpcast.com/${cast.author.username}/${cast.hash.slice(0, 10)}`,
          source: `Farcaster/${channelId}`,
          publishedAt: cast.timestamp || new Date().toISOString(),
          category: detectFarcasterCategory(cast.text),
          layer: 'social_farcaster',
          signalType: detectFarcasterSignalType(cast.text),
        });
      }

      console.log(`[Farcaster] /${channelId}: ${casts.length} casts, ${articles.length} with signal`);
    } catch (err) {
      console.error(`[Farcaster] /${channelId} fetch failed:`, err);
    }
  }

  console.log(`[Farcaster] ${articles.length} total signals`);
  return articles;
}

function detectFarcasterCategory(text: string): 'builder' | 'culture' | 'defi' | 'base_ecosystem' {
  const lower = text.toLowerCase();
  if (/deploy|ship|launch|build|dev|hack|grant|code/.test(lower)) return 'builder';
  if (/defi|tvl|liquidity|swap|yield/.test(lower)) return 'defi';
  if (/meme|community|gm|based|degen/.test(lower)) return 'culture';
  return 'base_ecosystem';
}

function detectFarcasterSignalType(text: string): 'builder' | 'launch' | 'narrative' | 'culture' {
  const lower = text.toLowerCase();
  if (/deploy|ship|launch|live/.test(lower)) return 'launch';
  if (/build|dev|hack|grant|code/.test(lower)) return 'builder';
  if (/narrative|trend|signal|alpha/.test(lower)) return 'narrative';
  return 'culture';
}
