export interface RssSource {
  name: string;
  url: string;
  priority: number;
}

export const RSS_SOURCES: RssSource[] = [
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss', priority: 1 },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', priority: 1 },
  { name: 'The Block', url: 'https://www.theblock.co/rss.xml', priority: 2 },
  { name: 'Decrypt', url: 'https://decrypt.co/feed', priority: 2 },
  { name: 'Reddit Crypto', url: 'https://www.reddit.com/r/cryptocurrency/.rss', priority: 3 },
];

export const COINGECKO = {
  prices: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin,cardano&vs_currencies=usd&include_24hr_change=true',
  trending: 'https://api.coingecko.com/api/v3/search/trending',
};
