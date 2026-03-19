import { Post } from '../types';

type InterestState = Record<
  string,
  {
    count: number;
    lastViewedAt: number;
  }
>;

const STORAGE_PREFIX = 'wco:categoryInterest:';

function storageKey(userId?: string | null): string {
  return `${STORAGE_PREFIX}${userId || 'anon'}`;
}

function safeParse(json: string | null): InterestState {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as InterestState;
  } catch {
    return {};
  }
}

export function recordCategoryInterest(category: string, userId?: string | null): void {
  const cat = (category || '').trim();
  if (!cat) return;

  const key = storageKey(userId);
  const current = safeParse(localStorage.getItem(key));
  const prev = current[cat];

  current[cat] = {
    count: Math.min(10_000, (prev?.count ?? 0) + 1),
    lastViewedAt: Date.now(),
  };

  localStorage.setItem(key, JSON.stringify(current));
}

export function getCategoryInterestScores(userId?: string | null): Record<string, number> {
  const current = safeParse(localStorage.getItem(storageKey(userId)));
  const now = Date.now();

  // Decay: interest slowly fades as it gets older (half-life ~14 days)
  const halfLifeMs = 14 * 24 * 60 * 60 * 1000;

  const scores: Record<string, number> = {};
  for (const [cat, data] of Object.entries(current)) {
    const ageMs = Math.max(0, now - (data.lastViewedAt || 0));
    const decay = Math.pow(0.5, ageMs / halfLifeMs);
    scores[cat] = (data.count || 0) * decay;
  }
  return scores;
}

function toTime(value: Post['createdAt']): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const sec = (value as any).seconds;
    return typeof sec === 'number' ? sec * 1000 : 0;
  }
  return 0;
}

export function rankPostsByCategoryInterest(
  posts: Post[],
  scores: Record<string, number>
): Post[] {
  if (!posts.length) return posts;
  const hasAnyScore = Object.values(scores).some((v) => v > 0);
  if (!hasAnyScore) return posts;

  // Weighted sort: interest score first, then recency.
  // Keep it deterministic and stable-ish across refreshes.
  return [...posts].sort((a, b) => {
    const sa = scores[a.category] ?? 0;
    const sb = scores[b.category] ?? 0;
    if (sa !== sb) return sb - sa;
    return toTime(b.createdAt) - toTime(a.createdAt);
  });
}

