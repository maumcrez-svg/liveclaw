export type NewsCategory =
  | 'bitcoin'
  | 'ethereum'
  | 'altcoins'
  | 'defi'
  | 'regulation'
  | 'exchange'
  | 'hack'
  | 'memecoins'
  | 'macro';

export interface RawArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  category: NewsCategory;
}

export interface MarketSnapshot {
  btcPrice: number;
  btcChange24h: number;
  ethPrice: number;
  ethChange24h: number;
  topMovers: Array<{ symbol: string; name: string; change: number; price: number }>;
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

export type SegmentType = 'intro' | 'headline' | 'story' | 'market' | 'closing';
export type VisualCue = 'anchor' | 'fullscreen-headline' | 'market-chart' | 'split-screen';
export type AvatarExpression = 'neutral' | 'smirk' | 'surprised' | 'skeptical';

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
