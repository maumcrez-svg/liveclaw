export interface RssSource {
  name: string;
  url: string;
  priority: number;
  layer: 'official' | 'news';
}

// Layer 1: RSS/Blogs — announcements + official narrative
export const BASE_RSS_SOURCES: RssSource[] = [
  { name: 'Base Blog', url: 'https://base.mirror.xyz/feed/atom', priority: 1, layer: 'official' },
  { name: 'Coinbase Blog', url: 'https://www.coinbase.com/blog/rss', priority: 2, layer: 'official' },
  { name: 'CoinTelegraph Base', url: 'https://cointelegraph.com/rss/tag/base', priority: 2, layer: 'news' },
  { name: 'The Block', url: 'https://www.theblock.co/rss.xml', priority: 3, layer: 'news' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed', priority: 3, layer: 'news' },
];

// Layer 4: CoinGecko — market layer filtered to Base tokens
export const COINGECKO = {
  // Base ecosystem tokens
  prices: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,aerodrome-finance,brett,degen-base,toshi,virtual-protocol,higher,coinbase-wrapped-btc&vs_currencies=usd&include_24hr_change=true',
  trending: 'https://api.coingecko.com/api/v3/search/trending',
};

// Layer 2: BaseScan + DeFiLlama — onchain reality
export const BASESCAN = {
  gasOracle: 'https://api.basescan.org/api?module=gastracker&action=gasoracle',
  // Additional endpoints require API key, set at runtime
};

export const DEFILLAMA = {
  baseTvl: 'https://api.llama.fi/v2/historicalChainTvl/Base',
  protocols: 'https://api.llama.fi/protocols',
};

// Layer 3: Farcaster (Neynar) — builder-native conversation
export const FARCASTER = {
  trendingChannels: 'https://api.neynar.com/v2/farcaster/channel/trending',
  channelFeed: 'https://api.neynar.com/v2/farcaster/feed/channels',
  // Channels to monitor
  channels: ['base', 'build', 'onchain'],
};

// Layer 5: Twitter/X (twitterapi.io) — attention layer
export const TWITTER = {
  searchEndpoint: 'https://api.twitterapi.io/twitter/tweet/advanced_search',
  // Seed accounts to track
  seedAccounts: [
    'base', 'coinbase', 'jessepollak',
    'AeurodromeFinance', 'BuildOnBase',
    'zaborek_', 'nickyarb',
  ],
};
