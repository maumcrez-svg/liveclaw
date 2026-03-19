export interface QuickCreatePayload {
  name: string;
  slug: string;
  description: string;
  agentType: string;
  streamingMode: 'external';
  instructions: string;
  defaultTags: string[];
  avatarUrl: string;
  defaultCategoryId?: string;
}

interface CategoryMapping {
  keywords: string[];
  agentType: string;
  category: string;
  tags: string[];
}

const CATEGORY_MAPPINGS: CategoryMapping[] = [
  {
    keywords: ['game', 'gaming', 'play', 'player', 'minecraft', 'pokemon', 'retro', 'arcade', 'puzzle'],
    agentType: 'game',
    category: 'gaming',
    tags: ['gaming', 'games', 'entertainment'],
  },
  {
    keywords: ['code', 'coding', 'program', 'develop', 'build', 'software', 'debug', 'engineer'],
    agentType: 'coding',
    category: 'coding-build',
    tags: ['coding', 'programming', 'development'],
  },
  {
    keywords: ['crypto', 'trade', 'trading', 'bitcoin', 'ethereum', 'defi', 'token', 'market', 'stock', 'finance'],
    agentType: 'browser',
    category: 'crypto-trading',
    tags: ['crypto', 'trading', 'markets'],
  },
  {
    keywords: ['chat', 'talk', 'conversation', 'discuss', 'social', 'companion', 'friend'],
    agentType: 'chat',
    category: 'ai-chat',
    tags: ['chat', 'conversational', 'interactive'],
  },
  {
    keywords: ['art', 'draw', 'paint', 'design', 'creative', 'music', 'compose', 'write', 'story', 'pixel'],
    agentType: 'creative',
    category: 'creative',
    tags: ['art', 'creative', 'design'],
  },
  {
    keywords: ['news', 'headline', 'journalist', 'report', 'current event'],
    agentType: 'browser',
    category: 'science-tech',
    tags: ['news', 'current-events', 'journalism'],
  },
  {
    keywords: ['browse', 'web', 'research', 'explore', 'search', 'internet', 'wiki'],
    agentType: 'browser',
    category: 'science-tech',
    tags: ['browser', 'research', 'exploration'],
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function matchCategory(description: string): CategoryMapping | null {
  const lower = description.toLowerCase();
  let bestMatch: CategoryMapping | null = null;
  let bestScore = 0;

  for (const mapping of CATEGORY_MAPPINGS) {
    const score = mapping.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = mapping;
    }
  }

  return bestMatch;
}

function extractTags(description: string): string[] {
  const words = description.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each',
    'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
    'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
    'about', 'up', 'out', 'if', 'then', 'that', 'this', 'it', 'its',
    'my', 'your', 'his', 'her', 'our', 'their', 'what', 'which', 'who',
    'whom', 'when', 'where', 'why', 'how', 'i', 'me', 'we', 'us', 'you',
    'he', 'she', 'they', 'them', 'ai', 'agent', 'stream', 'live',
  ]);

  const meaningful = words.filter((w) => w.length > 2 && !stopWords.has(w));
  // Deduplicate and take top 5
  return [...new Set(meaningful)].slice(0, 5);
}

export function agentFromPrompt(
  description: string,
  name?: string,
  categories?: { id: string; slug: string }[],
): QuickCreatePayload {
  const trimmed = description.trim();

  // Generate name from first few words if not provided
  const autoName = name?.trim() ||
    trimmed.split(/[\s,.:;!?]+/).slice(0, 3).join(' ').slice(0, 30) || 'My Agent';

  const slug = slugify(autoName);

  // Match category/type from description
  const match = matchCategory(trimmed);
  const agentType = match?.agentType || 'custom';
  const categorySlug = match?.category || 'experimental';

  // Build tags from match + extracted keywords
  const matchTags = match?.tags || [];
  const extractedTags = extractTags(trimmed);
  const allTags = [...new Set([...matchTags, ...extractedTags])].slice(0, 6);

  // Resolve category ID if categories are available
  const categoryId = categories?.find((c) => c.slug === categorySlug)?.id;

  // DiceBear avatar
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(slug)}`;

  return {
    name: autoName,
    slug,
    description: trimmed,
    agentType,
    streamingMode: 'external',
    instructions: trimmed,
    defaultTags: allTags,
    avatarUrl,
    ...(categoryId ? { defaultCategoryId: categoryId } : {}),
  };
}
