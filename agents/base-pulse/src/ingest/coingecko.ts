import type { MarketSnapshot } from '../models/types';
import { COINGECKO } from './sources';

interface CoinGeckoPrices {
  [id: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

interface CoinGeckoTrending {
  coins: Array<{
    item: {
      id: string;
      symbol: string;
      name: string;
      data?: {
        price?: number;
        price_change_percentage_24h?: { usd?: number };
      };
    };
  }>;
}

// Map CoinGecko IDs to display symbols for Base tokens
const BASE_TOKEN_SYMBOLS: Record<string, string> = {
  'aerodrome-finance': 'AERO',
  'brett': 'BRETT',
  'degen-base': 'DEGEN',
  'toshi': 'TOSHI',
  'virtual-protocol': 'VIRTUAL',
  'higher': 'HIGHER',
  'coinbase-wrapped-btc': 'cbBTC',
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
};

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const snapshot: MarketSnapshot = {
    btcPrice: 0,
    btcChange24h: 0,
    ethPrice: 0,
    ethChange24h: 0,
    topMovers: [],
  };

  try {
    const priceRes = await fetch(COINGECKO.prices, {
      signal: AbortSignal.timeout(10000),
    });

    if (priceRes.ok) {
      const prices = (await priceRes.json()) as CoinGeckoPrices;

      if (prices.bitcoin) {
        snapshot.btcPrice = prices.bitcoin.usd;
        snapshot.btcChange24h = prices.bitcoin.usd_24h_change ?? 0;
      }
      if (prices.ethereum) {
        snapshot.ethPrice = prices.ethereum.usd;
        snapshot.ethChange24h = prices.ethereum.usd_24h_change ?? 0;
      }

      for (const [id, data] of Object.entries(prices)) {
        if (id !== 'bitcoin' && id !== 'ethereum') {
          snapshot.topMovers.push({
            symbol: BASE_TOKEN_SYMBOLS[id] || id.toUpperCase().slice(0, 6),
            name: id,
            change: data.usd_24h_change ?? 0,
            price: data.usd,
          });
        }
      }
    }
  } catch (err) {
    console.error('[CoinGecko] Prices fetch failed:', err);
  }

  try {
    const trendRes = await fetch(COINGECKO.trending, {
      signal: AbortSignal.timeout(10000),
    });

    if (trendRes.ok) {
      const trending = (await trendRes.json()) as CoinGeckoTrending;
      const trendingMovers = trending.coins.slice(0, 5).map((c) => ({
        symbol: c.item.symbol.toUpperCase(),
        name: c.item.name,
        change: c.item.data?.price_change_percentage_24h?.usd ?? 0,
        price: c.item.data?.price ?? 0,
      }));

      for (const mover of trendingMovers) {
        if (!snapshot.topMovers.find((m) => m.symbol === mover.symbol)) {
          snapshot.topMovers.push(mover);
        }
      }
    }
  } catch (err) {
    console.error('[CoinGecko] Trending fetch failed:', err);
  }

  // Sort movers by absolute change
  snapshot.topMovers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  snapshot.topMovers = snapshot.topMovers.slice(0, 8);

  console.log(`[CoinGecko] BTC: $${snapshot.btcPrice.toLocaleString()} (${snapshot.btcChange24h > 0 ? '+' : ''}${snapshot.btcChange24h.toFixed(1)}%)`);
  return snapshot;
}
