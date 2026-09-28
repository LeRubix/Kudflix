import type { LocalFile } from '../components/NetflixUI';
import { cleanTitle, parseSeriesFolderName } from './metadata';
import { isTmdbDisabled } from './mediaOverrides';
import { runWithConcurrency } from './concurrency';
import { getActiveTmdbApiKey } from './settings';

const CACHE_KEY = 'tmdb_metadata_cache_v6';
const EP_CACHE_KEY = 'tmdb_episodes_cache_v2';

export interface TMDBEpisodeMeta {
  name: string | null;
  synopsis: string | null;
}

/** TMDB allows ~40 requests per 10 seconds */
const MAX_REQUESTS_PER_WINDOW = 35;
const RATE_WINDOW_MS = 10_000;
const PREFETCH_CONCURRENCY = 2;
const DEFAULT_PREFETCH_LIMIT = 80;
const DEFAULT_EPISODE_PREFETCH_LIMIT = 24;

export interface TMDBResult {
  synopsis: string;
  poster: string | null;
  backdrop: string | null;
  genres: string[];
  rating: number;
  year: string | null;
  tvId?: number;
  movieId?: number;
  director?: string;
  creators?: string[];
  cast?: string[];
  runtimeMinutes?: number;
  seasons?: number;
  detailsFetched?: boolean;
}

export interface TMDBLookupOptions {
  title: string;
  year?: string;
  mediaType?: 'movie' | 'tv';
}

const inflight = new Map<string, Promise<TMDBResult | null>>();
const detailsInflight = new Map<string, Promise<TMDBResult | null>>();
const episodeInflight = new Map<string, Promise<TMDBEpisodeMeta | null>>();
const episodeRetryQueue: { tvId: number; season: number; episode: number }[] = [];
const retryListeners = new Set<() => void>();
const rateTimestamps: number[] = [];
let prefetchGen = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

class TmdbTransientError extends Error {
  constructor() {
    super('TMDB rate limited');
    this.name = 'TmdbTransientError';
  }
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status === 503;
}

function checkTransientResponse(res: Response): void {
  if (isTransientStatus(res.status)) throw new TmdbTransientError();
}

function queueEpisodeRetry(tvId: number, season: number, episode: number): void {
  const key = episodeCacheKey(tvId, season, episode);
  if (episodeRetryQueue.some((e) => episodeCacheKey(e.tvId, e.season, e.episode) === key)) return;
  episodeRetryQueue.push({ tvId, season, episode });
  scheduleTmdbRetries();
}

function notifyRetryListeners(): void {
  retryListeners.forEach((fn) => fn());
}

export function onTmdbEpisodeRetry(listener: () => void): () => void {
  retryListeners.add(listener);
  return () => retryListeners.delete(listener);
}

export function scheduleTmdbRetries(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    const batch = episodeRetryQueue.splice(0, episodeRetryQueue.length);
    if (batch.length === 0) return;

    await runWithConcurrency(batch, PREFETCH_CONCURRENCY, async (item) => {
      await fetchEpisodeMeta(item.tvId, item.season, item.episode);
    });

    notifyRetryListeners();
    if (episodeRetryQueue.length > 0) scheduleTmdbRetries();
  }, RATE_WINDOW_MS + 500);
}

function apiKey(): string {
  return getActiveTmdbApiKey();
}

function hasTmdbApiKey(): boolean {
  return !!apiKey().trim();
}

export function episodeCacheKey(tvId: number, season: number, episode: number): string {
  return `${tvId}_S${season}E${episode}`;
}

export function clearTmdbCaches(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(EP_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function invalidateTmdbSession(): void {
  inflight.clear();
  detailsInflight.clear();
  episodeInflight.clear();
  prefetchGen++;
}

export function cacheKey(opts: TMDBLookupOptions): string {
  const type = opts.mediaType ?? 'any';
  const year = opts.year?.trim() || '';
  return `${type}:${year}:${opts.title.toLowerCase()}`;
}

export function getTMDBLookupOptions(video: LocalFile): TMDBLookupOptions {
  if (video.isFolder) {
    const root = video.name || video.relativePath?.split('/')[0] || video.meta?.title || '';
    const { title, year } = parseSeriesFolderName(root);
    return { title, year: year || video.meta?.year, mediaType: 'tv' };
  }

  if (video.relativePath && video.category === 'tv') {
    const root = video.relativePath.split('/')[0];
    const { title, year } = parseSeriesFolderName(root);
    return {
      title,
      year: year || video.meta?.year,
      mediaType: 'tv',
    };
  }

  const title = cleanTitle(video.meta?.title || video.name);
  const year = video.meta?.year?.trim() || undefined;
  return {
    title,
    year,
    mediaType: video.category === 'tv' ? 'tv' : 'movie',
  };
}

export function getCachedLookup(opts: TMDBLookupOptions): TMDBResult | null | undefined {
  const cache = getFullCache();
  const key = cacheKey(opts);
  if (key in cache) return cache[key];
  return undefined;
}

export function getCachedForVideo(video: LocalFile): TMDBResult | null | undefined {
  return getCachedLookup(getTMDBLookupOptions(video));
}

/** @deprecated Use getCachedForVideo or getCachedLookup */
export function getCached(title: string): TMDBResult | null {
  const cache = getFullCache();
  for (const [key, value] of Object.entries(cache)) {
    if (key.endsWith(`:${title.toLowerCase()}`)) return value;
  }
  return null;
}

export async function getTMDBMetadataForVideo(video: LocalFile): Promise<TMDBResult | null> {
  if (isTmdbDisabled(video)) return null;
  return getTMDBMetadata(getTMDBLookupOptions(video));
}

/** Lazy details fetch for modal, search first, then details + credits. */
export async function fetchTMDBDetailsForVideo(video: LocalFile): Promise<TMDBResult | null> {
  if (isTmdbDisabled(video)) return null;

  const lookup = getTMDBLookupOptions(video);
  const key = cacheKey(lookup);

  let base = getCachedLookup(lookup);
  if (base === undefined) {
    base = await getTMDBMetadata(lookup);
  }
  if (!base) return null;
  if (base.detailsFetched) return base;

  const pending = detailsInflight.get(key);
  if (pending) return pending;

  const promise = enrichWithDetails(lookup, base);
  detailsInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    detailsInflight.delete(key);
  }
}

export async function getTMDBMetadata(opts: TMDBLookupOptions | string): Promise<TMDBResult | null> {
  const lookup: TMDBLookupOptions =
    typeof opts === 'string' ? { title: opts } : opts;

  if (!lookup.title.trim() || !hasTmdbApiKey()) return null;

  if (!navigator.onLine) {
    const cached = getCachedLookup(lookup);
    return cached === undefined ? null : cached;
  }

  const key = cacheKey(lookup);
  const cache = getFullCache();
  if (key in cache) return cache[key];

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = fetchAndCache(lookup, key, cache);
  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

async function fetchAndCache(
  lookup: TMDBLookupOptions,
  key: string,
  cache: Record<string, TMDBResult | null>,
): Promise<TMDBResult | null> {
  try {
    await waitForRateSlot();
    const result = await searchTMDB(lookup);
    cache[key] = result;
    saveCache(cache);
    return result;
  } catch (err) {
    if (err instanceof TmdbTransientError) return null;
    console.error('TMDB fetch error:', err);
    return null;
  }
}

async function enrichWithDetails(
  lookup: TMDBLookupOptions,
  base: TMDBResult,
): Promise<TMDBResult> {
  const id = base.movieId ?? base.tvId;
  const mediaType: 'movie' | 'tv' | null = base.movieId
    ? 'movie'
    : base.tvId
      ? 'tv'
      : null;

  if (!id || !mediaType || !navigator.onLine || !hasTmdbApiKey()) {
    return { ...base, detailsFetched: true };
  }

  try {
    await waitForRateSlot();
    const key = apiKey();
    const url =
      mediaType === 'movie'
        ? `https://api.themoviedb.org/3/movie/${id}?api_key=${key}&language=en-US&append_to_response=credits`
        : `https://api.themoviedb.org/3/tv/${id}?api_key=${key}&language=en-US&append_to_response=credits`;

    const res = await fetch(url);
    if (!res.ok) {
      if (isTransientStatus(res.status)) {
        return base;
      }
      const failed = { ...base, detailsFetched: true };
      persistLookupResult(lookup, failed);
      return failed;
    }

    const data = await res.json();
    const enriched = parseDetailsResponse(data, base, mediaType);
    persistLookupResult(lookup, enriched);
    return enriched;
  } catch (err) {
    console.error('TMDB details fetch error:', err);
    return { ...base, detailsFetched: true };
  }
}

function parseDetailsResponse(
  data: {
    overview?: string;
    genres?: { name: string }[];
    runtime?: number;
    number_of_seasons?: number;
    created_by?: { name: string }[];
    credits?: {
      cast?: { name: string }[];
      crew?: { job: string; name: string }[];
    };
    poster_path?: string | null;
    backdrop_path?: string | null;
  },
  base: TMDBResult,
  mediaType: 'movie' | 'tv',
): TMDBResult {
  const genres = (data.genres ?? []).map((g) => g.name).filter(Boolean);
  const cast = (data.credits?.cast ?? []).slice(0, 5).map((c) => c.name).filter(Boolean);

  let director: string | undefined;
  let creators: string[] | undefined;

  if (mediaType === 'movie') {
    director = data.credits?.crew?.find((c) => c.job === 'Director')?.name;
  } else {
    creators = (data.created_by ?? []).map((c) => c.name).filter(Boolean);
  }

  return {
    ...base,
    synopsis: data.overview || base.synopsis,
    poster: base.poster ?? (data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null),
    backdrop: base.backdrop ?? (data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null),
    genres,
    cast,
    director,
    creators: creators?.length ? creators : undefined,
    runtimeMinutes: mediaType === 'movie' && data.runtime ? data.runtime : base.runtimeMinutes,
    seasons: mediaType === 'tv' && data.number_of_seasons ? data.number_of_seasons : base.seasons,
    detailsFetched: true,
  };
}

function persistLookupResult(lookup: TMDBLookupOptions, result: TMDBResult) {
  const key = cacheKey(lookup);
  const cache = getFullCache();
  cache[key] = result;
  saveCache(cache);
}

async function waitForRateSlot(): Promise<void> {
  while (true) {
    const now = Date.now();
    while (rateTimestamps.length > 0 && now - rateTimestamps[0] >= RATE_WINDOW_MS) {
      rateTimestamps.shift();
    }
    if (rateTimestamps.length < MAX_REQUESTS_PER_WINDOW) {
      rateTimestamps.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getResultYear(item: { release_date?: string; first_air_date?: string }): string | null {
  const d = item.release_date || item.first_air_date;
  return d ? d.substring(0, 4) : null;
}

function scoreSearchResult(
  query: string,
  queryYear: string | undefined,
  item: { title?: string; name?: string; release_date?: string; first_air_date?: string },
): number {
  const resultTitle = item.title || item.name || '';
  const q = normalizeTitle(query);
  const t = normalizeTitle(resultTitle);
  if (!q || !t) return -1000;

  let score = 0;
  if (q === t) score += 200;

  const qWords = q.split(' ');
  const tWords = t.split(' ');
  if (qWords.length === tWords.length && qWords.every((w, i) => w === tWords[i])) {
    score += 150;
  }

  const ry = getResultYear(item);
  if (queryYear && ry === queryYear) score += 40;
  if (queryYear && ry && ry !== queryYear) score -= 15;

  if (t !== q && t.endsWith(` ${q}`)) score -= 50;
  if (t !== q && t.includes(` ${q} `)) score -= 30;
  if (t.includes(q) && t.length > q.length + 3) score -= t.length - q.length;
  if (tWords.length > qWords.length) score -= 12 * (tWords.length - qWords.length);

  return score;
}

type SearchHit = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  media_type?: string;
};

function pickBestResult(results: SearchHit[], query: string, year?: string): SearchHit | null {
  if (!results?.length) return null;
  let best = results[0];
  let bestScore = -Infinity;
  for (const r of results.slice(0, 10)) {
    const s = scoreSearchResult(query, year, r);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

async function searchTMDB(lookup: TMDBLookupOptions): Promise<TMDBResult | null> {
  const { title, year, mediaType } = lookup;
  const encoded = encodeURIComponent(title);
  const key = apiKey();

  if (mediaType === 'movie') {
    const yearParam = year ? `&year=${encodeURIComponent(year)}` : '';
    const movieRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encoded}${yearParam}&language=en-US&page=1`,
    );
    checkTransientResponse(movieRes);
    if (movieRes.ok) {
      const data = await movieRes.json();
      const hit = pickBestResult(data.results ?? [], title, year);
      if (hit) return mapResult(hit, 'movie');
    }
  }

  if (mediaType === 'tv') {
    const tvRes = await fetch(
      `https://api.themoviedb.org/3/search/tv?api_key=${key}&query=${encoded}&language=en-US&page=1`,
    );
    checkTransientResponse(tvRes);
    if (tvRes.ok) {
      const data = await tvRes.json();
      const hit = pickBestResult(data.results ?? [], title, year);
      if (hit) return mapResult(hit, 'tv');
    }
  }

  const multiRes = await fetch(
    `https://api.themoviedb.org/3/search/multi?api_key=${key}&query=${encoded}&language=en-US&page=1`,
  );
  checkTransientResponse(multiRes);
  if (!multiRes.ok) return null;

  const data = await multiRes.json();
  if (!data.results?.length) return null;

  const filtered = (data.results as SearchHit[]).filter((r) =>
    mediaType ? r.media_type === mediaType : r.media_type === 'movie' || r.media_type === 'tv',
  );
  const pool = filtered.length ? filtered : (data.results as SearchHit[]);
  const preferred = pickBestResult(pool, title, year) ?? pool[0];

  const type = preferred.media_type === 'tv' ? 'tv' : 'movie';
  return mapResult(preferred, type);
}

function mapResult(
  item: {
    id: number;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    vote_average?: number;
    release_date?: string;
    first_air_date?: string;
  },
  mediaType: 'movie' | 'tv',
): TMDBResult {
  const year = item.release_date
    ? item.release_date.substring(0, 4)
    : item.first_air_date
      ? item.first_air_date.substring(0, 4)
      : null;

  return {
    synopsis: item.overview || '',
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
    genres: [],
    rating: item.vote_average || 0,
    year,
    tvId: mediaType === 'tv' ? item.id : undefined,
    movieId: mediaType === 'movie' ? item.id : undefined,
    detailsFetched: false,
  };
}

/** Background prefetch: priority items first, capped per session, deduped + rate-limited. */
export function prefetchTMDBCatalog(
  catalog: LocalFile[],
  priority: LocalFile[] = [],
  limit = DEFAULT_PREFETCH_LIMIT,
): void {
  if (!navigator.onLine || !hasTmdbApiKey() || catalog.length === 0) return;

  const gen = ++prefetchGen;
  const priorityKeys = new Set(priority.map((v) => cacheKey(getTMDBLookupOptions(v))));
  const seen = new Set<string>();
  const queue: TMDBLookupOptions[] = [];

  for (const item of [...priority, ...catalog]) {
    if (isTmdbDisabled(item)) continue;
    const opts = getTMDBLookupOptions(item);
    const key = cacheKey(opts);
    if (seen.has(key)) continue;
    seen.add(key);
    if (getCachedLookup(opts) !== undefined) continue;
    queue.push(opts);
  }

  queue.sort((a, b) => {
    const aPri = priorityKeys.has(cacheKey(a)) ? 0 : 1;
    const bPri = priorityKeys.has(cacheKey(b)) ? 0 : 1;
    return aPri - bPri;
  });

  const batch = queue.slice(0, limit);
  if (batch.length === 0) return;

  runWithConcurrency(batch, PREFETCH_CONCURRENCY, async (opts) => {
    if (gen !== prefetchGen) return;
    await getTMDBMetadata(opts);
  }).catch((err) => console.error('TMDB prefetch failed:', err));
}

/** Background details prefetch so genre rows can use cached TMDB genres. */
export async function prefetchTMDBDetailsCatalog(
  catalog: LocalFile[],
  priority: LocalFile[] = [],
  limit = 40,
): Promise<void> {
  if (!navigator.onLine || !hasTmdbApiKey() || catalog.length === 0) return;

  const priorityPaths = new Set(priority.map((v) => v.path));
  const seen = new Set<string>();
  const queue: LocalFile[] = [];

  for (const item of [...priority, ...catalog]) {
    if (isTmdbDisabled(item)) continue;
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    const cached = getCachedForVideo(item);
    if (!cached || cached.detailsFetched) continue;
    queue.push(item);
  }

  queue.sort((a, b) => {
    const aPri = priorityPaths.has(a.path) ? 0 : 1;
    const bPri = priorityPaths.has(b.path) ? 0 : 1;
    return aPri - bPri;
  });

  const batch = queue.slice(0, limit);
  if (batch.length === 0) return;

  await runWithConcurrency(batch, PREFETCH_CONCURRENCY, async (video) => {
    await fetchTMDBDetailsForVideo(video);
  });
}

function getEpisodeCache(): Record<string, TMDBEpisodeMeta | null> {
  try {
    const data = localStorage.getItem(EP_CACHE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveEpisodeCache(cache: Record<string, TMDBEpisodeMeta | null>) {
  try {
    localStorage.setItem(EP_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

export function getCachedEpisodeMeta(
  tvId: number,
  season: number,
  episode: number,
): TMDBEpisodeMeta | null | undefined {
  const key = episodeCacheKey(tvId, season, episode);
  const cache = getEpisodeCache();
  if (key in cache) return cache[key];
  return undefined;
}

async function fetchEpisodeMeta(
  tvId: number,
  season: number,
  episode: number,
): Promise<TMDBEpisodeMeta | null> {
  const key = episodeCacheKey(tvId, season, episode);
  const cache = getEpisodeCache();
  if (key in cache) return cache[key];

  if (!navigator.onLine || !hasTmdbApiKey()) return null;

  try {
    await waitForRateSlot();
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${season}/episode/${episode}?api_key=${apiKey()}&language=en-US`,
    );
    if (!res.ok) {
      if (isTransientStatus(res.status)) {
        queueEpisodeRetry(tvId, season, episode);
        return null;
      }
      if (res.status === 404) {
        cache[key] = null;
        saveEpisodeCache(cache);
      }
      return null;
    }
    const data = await res.json();
    const meta: TMDBEpisodeMeta = {
      name: data.name || null,
      synopsis: data.overview || null,
    };
    cache[key] = meta;
    saveEpisodeCache(cache);
    return meta;
  } catch {
    return null;
  }
}

export async function getTMDBEpisodeMeta(
  tvId: number,
  season: number,
  episode: number,
): Promise<TMDBEpisodeMeta | null> {
  const key = episodeCacheKey(tvId, season, episode);
  const cached = getCachedEpisodeMeta(tvId, season, episode);
  if (cached !== undefined) return cached;

  const pending = episodeInflight.get(key);
  if (pending) return pending;

  const promise = fetchEpisodeMeta(tvId, season, episode);
  episodeInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    episodeInflight.delete(key);
  }
}

/** Batch-fetch episode metadata for a series modal, rate-limited and deduped. */
export async function prefetchEpisodeMetaBatch(
  tvId: number,
  episodes: { season: number; episode: number }[],
  limit = DEFAULT_EPISODE_PREFETCH_LIMIT,
): Promise<void> {
  if (!navigator.onLine || !hasTmdbApiKey() || episodes.length === 0) return;

  const uncached = episodes.filter((ep) => {
    return getCachedEpisodeMeta(tvId, ep.season, ep.episode) === undefined;
  });

  const batch = uncached.slice(0, limit);
  if (batch.length === 0) return;

  await runWithConcurrency(batch, PREFETCH_CONCURRENCY, async (ep) => {
    await getTMDBEpisodeMeta(tvId, ep.season, ep.episode);
  });
}

export async function getTMDBEpisode(tvId: number, season: number, episode: number): Promise<string | null> {
  const meta = await getTMDBEpisodeMeta(tvId, season, episode);
  return meta?.synopsis ?? null;
}

export function parseSeasonEpisode(filename: string): { season: number; episode: number } | null {
  const m1 = filename.match(/s(\d+)\s*e(\d+)/i);
  if (m1) return { season: parseInt(m1[1], 10), episode: parseInt(m1[2], 10) };

  const m2 = filename.match(/season\s*(\d+)\s*episode\s*(\d+)/i);
  if (m2) return { season: parseInt(m2[1], 10), episode: parseInt(m2[2], 10) };

  const m3 = filename.match(/(?:^|\s)(\d+)x(\d+)(?:\s|$)/i);
  if (m3) return { season: parseInt(m3[1], 10), episode: parseInt(m3[2], 10) };

  return null;
}

export function tmdbArtwork(
  tmdb: TMDBResult | null | undefined,
  video: Pick<LocalFile, 'thumbnail' | 'localFanart' | 'localPoster'>,
): string | undefined {
  return (
    tmdb?.backdrop ||
    tmdb?.poster ||
    video.localFanart ||
    video.localPoster ||
    video.thumbnail ||
    undefined
  );
}

export function tmdbMatchLabel(tmdb: TMDBResult | null | undefined): string {
  return tmdb?.rating ? `${Math.round(tmdb.rating * 10)}% Match` : '98% Match';
}

export function formatTmdbGenres(tmdb: TMDBResult | null | undefined, localGenre?: string): string | null {
  if (tmdb?.genres?.length) return tmdb.genres.join(' · ');
  if (localGenre && localGenre !== 'Local Media' && localGenre !== 'Movie' && localGenre !== 'Series') {
    return localGenre;
  }
  return null;
}

function getFullCache(): Record<string, TMDBResult | null> {
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, TMDBResult | null>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save TMDB cache. Possibly full.', e);
  }
}
