const DURATION_KEY = 'netflix_duration_cache_v1';

type DurationCache = Record<string, number>;

function readDurations(): DurationCache {
  try {
    return JSON.parse(localStorage.getItem(DURATION_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getCachedDuration(path: string): number | undefined {
  const d = readDurations()[path];
  return d && d > 0 ? d : undefined;
}

export function setCachedDuration(path: string, duration: number): void {
  if (!duration || duration <= 0) return;
  const cache = readDurations();
  cache[path] = duration;
  localStorage.setItem(DURATION_KEY, JSON.stringify(cache));
}
