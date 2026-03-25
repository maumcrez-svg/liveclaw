import { processNewArticle } from './detector';
import { bus } from '../orchestrator/events';

// ─── twitterapi.io Configuration ───
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || 'new1_3885f5f64e984cb2b45d5d8e0bb0899c';
const TWITTER_API_BASE = 'https://api.twitterapi.io/twitter/tweet/advanced_search';

// Search query: high-relevance conflict keywords, minimum engagement to filter noise
const SEARCH_QUERY = '(Iran OR Israel OR Tehran OR IDF OR IRGC OR Hezbollah) (missile OR strike OR drone OR attack OR defense OR intercept OR casualties OR ceasefire) min_faves:50';

// Poll every 60 seconds — uses since_id so each poll returns only NEW tweets (minimal API cost)
const POLL_INTERVAL_MS = 60_000;
const MAX_TWEETS_PER_POLL = 10;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastSeenId: string | null = null;
const seenTweetIds = new Set<string>();

export function startTwitterFeed(): void {
  if (pollTimer) return;
  console.log(`[TwitterFeed] Starting twitterapi.io search poll every ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`[TwitterFeed] Query: ${SEARCH_QUERY}`);
  pollTimer = setInterval(pollTwitterSearch, POLL_INTERVAL_MS);
  // First poll after 8s (let other systems init)
  setTimeout(pollTwitterSearch, 8_000);
}

export function stopTwitterFeed(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollTwitterSearch(): Promise<void> {
  try {
    let query = SEARCH_QUERY;
    // Append since_id for incremental polling (only new tweets)
    if (lastSeenId) {
      query += ` since_id:${lastSeenId}`;
    }

    const url = `${TWITTER_API_BASE}?query=${encodeURIComponent(query)}&count=${MAX_TWEETS_PER_POLL}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-API-Key': TWITTER_API_KEY,
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[TwitterFeed] API error: ${res.status} ${res.statusText}`);
      return;
    }

    const data = await res.json() as TwitterSearchResponse;
    const tweets = data.tweets || [];

    if (tweets.length === 0) return;

    // Update since_id to newest tweet (first in array)
    if (tweets[0]?.id) {
      lastSeenId = tweets[0].id;
    }

    let newCount = 0;
    // Process in reverse chronological order (oldest first)
    for (const tweet of tweets.reverse()) {
      if (seenTweetIds.has(tweet.id)) continue;
      seenTweetIds.add(tweet.id);

      // Skip retweets, replies, and low-quality
      if (tweet.retweeted_tweet) continue;
      if (tweet.isReply && !isHighValueReply(tweet)) continue;

      const author = tweet.author;
      const username = author?.userName || 'unknown';
      const followers = author?.followers || 0;

      // Prefer accounts with decent following for credibility
      if (followers < 1000 && !author?.isBlueVerified) continue;

      newCount++;

      // Extract media URLs (photos/videos) for dashboard
      const mediaUrls = extractMedia(tweet);

      // Build rich article for the detector
      processNewArticle({
        id: `tw-${tweet.id}`,
        title: cleanTweetText(tweet.text),
        source: `@${username} (X/OSINT)`,
        url: tweet.url || `https://x.com/${username}/status/${tweet.id}`,
        timestamp: new Date(tweet.createdAt).getTime() || Date.now(),
      });

      // Emit media if available (for dashboard image display)
      if (mediaUrls.length > 0) {
        bus.emit('intel:tweet-media' as any, {
          tweetId: tweet.id,
          username,
          mediaUrls,
          text: cleanTweetText(tweet.text).substring(0, 200),
        });
      }
    }

    if (newCount > 0) {
      console.log(`[TwitterFeed] ${newCount} new tweets from search (${tweets.length} total fetched)`);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[TwitterFeed] Request timed out');
    } else {
      console.error('[TwitterFeed] Poll error:', err.message || err);
    }
  }
}

function cleanTweetText(text: string): string {
  return text
    .replace(/https?:\/\/t\.co\/\w+/g, '')  // Remove t.co links
    .replace(/\n+/g, ' ')                    // Collapse newlines
    .replace(/\s+/g, ' ')                    // Collapse spaces
    .replace(/^RT @\w+: /, '')               // Remove RT prefix
    .trim()
    .substring(0, 400);
}

function isHighValueReply(tweet: TwitterTweet): boolean {
  // Allow replies from high-follower verified accounts
  const author = tweet.author;
  if (!author) return false;
  return (author.followers || 0) > 50_000 || author.isBlueVerified === true;
}

function extractMedia(tweet: TwitterTweet): string[] {
  const urls: string[] = [];
  const media = tweet.extendedEntities?.media || [];
  for (const m of media) {
    if (m.type === 'photo' && m.media_url_https) {
      urls.push(m.media_url_https);
    } else if ((m.type === 'video' || m.type === 'animated_gif') && m.video_info?.variants) {
      // Get highest quality mp4
      const mp4s = m.video_info.variants
        .filter((v: any) => v.content_type === 'video/mp4')
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      if (mp4s.length > 0) urls.push(mp4s[0].url);
      // Also get thumbnail
      if (m.media_url_https) urls.push(m.media_url_https);
    }
  }
  return urls;
}

// ─── Types ───
interface TwitterSearchResponse {
  tweets: TwitterTweet[];
  has_next_page?: boolean;
  next_cursor?: string;
}

interface TwitterTweet {
  type: string;
  id: string;
  url: string;
  twitterUrl: string;
  text: string;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  viewCount: number;
  createdAt: string;
  lang: string;
  isReply: boolean;
  inReplyToId?: string;
  conversationId: string;
  author: TwitterAuthor;
  extendedEntities?: {
    media?: TwitterMedia[];
  };
  retweeted_tweet?: any;
  quoted_tweet?: any;
}

interface TwitterAuthor {
  userName: string;
  name: string;
  id: string;
  isVerified: boolean;
  isBlueVerified: boolean;
  profilePicture: string;
  followers: number;
  following: number;
}

interface TwitterMedia {
  type: string;
  media_url_https: string;
  video_info?: {
    variants: Array<{
      content_type: string;
      url: string;
      bitrate?: number;
    }>;
  };
}

// Keep seen set from growing unbounded
setInterval(() => {
  if (seenTweetIds.size > 500) {
    const arr = Array.from(seenTweetIds);
    arr.splice(0, arr.length - 200);
    seenTweetIds.clear();
    arr.forEach(id => seenTweetIds.add(id));
  }
}, 300_000);
