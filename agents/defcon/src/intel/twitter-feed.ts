import { processNewArticle } from './detector';

const RSSHUB_INSTANCES = [
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rsshub.moeyy.cn',
];

const TWITTER_ACCOUNTS = [
  'AMK_Mapping_',
  'IntelCrab',
  'sentdefender',
  'Faytuks',
];

const POLL_INTERVAL_MS = 120_000; // 2 minutes
const seenTweetIds = new Set<string>();

let pollTimer: ReturnType<typeof setInterval> | null = null;
let instanceIndex = 0;
let accountIndex = 0;

export function startTwitterFeed(): void {
  if (pollTimer) return;
  console.log(`[TwitterFeed] Starting RSSHub poll every ${POLL_INTERVAL_MS / 1000}s, ${TWITTER_ACCOUNTS.length} accounts`);
  pollTimer = setInterval(pollTwitter, POLL_INTERVAL_MS);
  setTimeout(pollTwitter, 10_000);
}

export function stopTwitterFeed(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollTwitter(): Promise<void> {
  const account = TWITTER_ACCOUNTS[accountIndex % TWITTER_ACCOUNTS.length];
  accountIndex++;

  for (let attempt = 0; attempt < RSSHUB_INSTANCES.length; attempt++) {
    const instance = RSSHUB_INSTANCES[(instanceIndex + attempt) % RSSHUB_INSTANCES.length];
    const url = `${instance}/twitter/user/${account}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'DEFCON-Agent/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const text = await res.text();
      const tweets = parseRSSHubFeed(text, account);

      if (tweets.length > 0) {
        instanceIndex = (instanceIndex + attempt) % RSSHUB_INSTANCES.length;
        let newCount = 0;
        for (const tweet of tweets) {
          if (!seenTweetIds.has(tweet.id)) {
            seenTweetIds.add(tweet.id);
            newCount++;
            processNewArticle({
              id: tweet.id,
              title: tweet.text,
              source: `@${account} (X/OSINT)`,
              url: tweet.url,
              timestamp: tweet.timestamp,
            });
          }
        }
        if (newCount > 0) {
          console.log(`[TwitterFeed] ${newCount} new tweets from @${account} via ${instance}`);
        }
        return;
      }
    } catch (err) {
      continue;
    }
  }

  console.log(`[TwitterFeed] All RSSHub instances failed for @${account}, skipping this cycle`);
}

interface ParsedTweet {
  id: string;
  text: string;
  url: string;
  timestamp: number;
}

function parseRSSHubFeed(xml: string, account: string): ParsedTweet[] {
  const tweets: ParsedTweet[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const guid = extractTag(itemXml, 'guid');
    const description = extractTag(itemXml, 'description');

    let text = description || title || '';
    text = text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();

    if (!text) continue;

    const idMatch = (guid || link || '').match(/status\/(\d+)/);
    const id = idMatch ? `tweet-${account}-${idMatch[1]}` : `tweet-${account}-${Date.now()}-${tweets.length}`;

    tweets.push({
      id,
      text: text.substring(0, 300),
      url: link || `https://twitter.com/${account}`,
      timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
    });
  }

  return tweets.slice(0, 10);
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? (match[1] || match[2] || '').trim() : '';
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
