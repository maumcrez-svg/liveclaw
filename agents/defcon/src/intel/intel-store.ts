export interface IntelItem {
  id: string;
  title: string;
  source: string;
  url: string;
  timestamp: number;
  narrated: boolean;
  type: 'rss' | 'tweet' | 'osint' | 'gdelt';
}

const MAX_ITEMS = 200;
const items: IntelItem[] = [];
let defconLevel = 3;
let flightCount = 0;
let seismicCount = 0;
let militaryFlightCount = 0;

export function addItem(item: Omit<IntelItem, 'narrated'>): boolean {
  // Dedup by id
  if (items.some(i => i.id === item.id)) return false;
  // Dedup by title (fuzzy — same title from different sources)
  if (items.some(i => i.title === item.title)) return false;

  items.unshift({ ...item, narrated: false });
  if (items.length > MAX_ITEMS) items.pop();
  return true;
}

export function markNarrated(id: string): void {
  const item = items.find(i => i.id === id);
  if (item) item.narrated = true;
}

export function getUnnarrated(): IntelItem[] {
  return items.filter(i => !i.narrated);
}

export function getRecent(count = 10): IntelItem[] {
  return items.slice(0, count);
}

export function getRecentSummary(count = 5): string {
  return items
    .slice(0, count)
    .map(i => `- [${i.source}] ${i.title}`)
    .join('\n') || 'No recent intelligence.';
}

export function setDefconLevel(level: number): number {
  const old = defconLevel;
  defconLevel = level;
  return old;
}

export function getDefconLevel(): number {
  return defconLevel;
}

export function setFlightCount(count: number): void {
  flightCount = count;
}

export function getFlightCount(): number {
  return flightCount;
}

export function setSeismicCount(count: number): void {
  seismicCount = count;
}

export function getSeismicCount(): number {
  return seismicCount;
}

export function setMilitaryFlightCount(count: number): void {
  militaryFlightCount = count;
}

export function getMilitaryFlightCount(): number {
  return militaryFlightCount;
}

export function getItemCount(): number {
  return items.length;
}
