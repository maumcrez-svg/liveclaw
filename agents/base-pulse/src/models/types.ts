export type SignalLayer = 'official' | 'onchain' | 'social_farcaster' | 'social_twitter' | 'market';
export type SignalType = 'builder' | 'launch' | 'metric' | 'narrative' | 'culture' | 'controversy';

export type NewsCategory =
  | 'base_ecosystem'
  | 'defi'
  | 'nft'
  | 'builder'
  | 'launch'
  | 'onchain'
  | 'governance'
  | 'culture'
  | 'market'
  | 'infrastructure';

export interface RawArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  category: NewsCategory;
  layer?: SignalLayer;
  signalType?: SignalType;
}

export interface MarketSnapshot {
  btcPrice: number;
  btcChange24h: number;
  ethPrice: number;
  ethChange24h: number;
  topMovers: Array<{ symbol: string; name: string; change: number; price: number }>;
  baseTvl?: number;
  baseTvlChange24h?: number;
  baseGasGwei?: number;
  baseBlockNumber?: number;
  fearGreedIndex?: number;
}

export interface EpisodePlan {
  date: string;
  headline: { articleId: string; teaser: string };
  stories: Array<{
    articleId: string;
    rank: number;
    spiceLevel: 1 | 2 | 3 | 4 | 5;
    angle: string;
  }>;
  marketSnapshot: MarketSnapshot;
}

export type SegmentType =
  | 'opening'
  | 'builder_spotlight'
  | 'signal_analysis'
  | 'social_pulse'
  | 'closing';

export type VisualCue = 'anchor' | 'fullscreen-headline' | 'market-chart' | 'split-screen' | 'data-panel';
export type AvatarExpression = 'neutral' | 'focused' | 'confident' | 'impressed';

export interface Segment {
  id: string;
  type: SegmentType;
  narration: string;
  headline: string;
  subheadline?: string;
  tickerItems?: string[];
  visualCue: VisualCue;
  expression: AvatarExpression;
  estimatedDurationSec: number;
  cardData?: Record<string, string>;
}

export interface EpisodeScript {
  date: string;
  totalEstimatedDurationSec: number;
  segments: Segment[];
}

export interface GeneratedEpisode {
  date: string;
  episodeNumber: number;
  articles: RawArticle[];
  plan: EpisodePlan;
  script: EpisodeScript;
  audioSegments: Array<{
    segmentId: string;
    audioBase64: string;
    format: 'mp3';
    durationEstMs: number;
  }>;
}
