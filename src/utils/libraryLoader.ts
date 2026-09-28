import type { LocalFile } from '../components/NetflixUI';
import { applyMediaOverride } from './mediaOverrides';
import { resolveFileMeta } from './metadata';
import { generateVideoThumbnail } from './thumbnail';
import { runWithConcurrency } from './concurrency';
import { getCachedDuration } from './mediaCache';
import { getSeriesRoot } from './grouping';

const ENRICH_CONCURRENCY = 6;

type ScannedFile = {
  name: string;
  path: string;
  relativePath?: string;
  folderName?: string;
  localPoster?: string | null;
  localFanart?: string | null;
  localNfoContent?: string | null;
  mtimeMs?: number;
};

export function toBasicFile(file: ScannedFile, category: 'movie' | 'tv'): LocalFile {
  const cachedDuration = getCachedDuration(file.path) ?? 0;
  return applyMediaOverride({
    ...file,
    meta: resolveFileMeta(file),
    thumbnail: file.localFanart || file.localPoster || undefined,
    duration: cachedDuration,
    dateModified: file.mtimeMs ?? Date.now(),
    category,
  });
}

/** Movies: all files. TV: one representative per series + any priority paths (continue watching). */
export function buildOptimizedEnrichQueue(
  items: { file: ScannedFile; category: 'movie' | 'tv' }[],
  priorityPaths: Set<string> = new Set(),
  hydratedFiles: LocalFile[] = [],
) {
  const hydrated = new Map(hydratedFiles.map((f) => [f.path, f]));
  const needsEnrich = (path: string) => {
    const f = hydrated.get(path);
    return !f?.thumbnail || !f.duration;
  };

  const movies = items.filter((i) => i.category === 'movie' && needsEnrich(i.file.path));
  const tvPriority = items.filter(
    (i) => i.category === 'tv' && priorityPaths.has(i.file.path) && needsEnrich(i.file.path),
  );

  const tvRepresentatives = new Map<string, (typeof items)[0]>();
  const score = (f: ScannedFile) => (f.localFanart ? 2 : 0) + (f.localPoster ? 1 : 0);

  for (const item of items) {
    if (item.category !== 'tv' || priorityPaths.has(item.file.path) || !needsEnrich(item.file.path)) continue;
    const root = getSeriesRoot(item.file.relativePath) ?? item.file.path;
    const existing = tvRepresentatives.get(root);
    if (!existing || score(item.file) > score(existing.file)) {
      tvRepresentatives.set(root, item);
    }
  }

  const seen = new Set<string>();
  const result: typeof items = [];
  for (const item of [...movies, ...tvPriority, ...tvRepresentatives.values()]) {
    if (seen.has(item.file.path)) continue;
    seen.add(item.file.path);
    result.push(item);
  }
  return result;
}

async function enrichOne(file: ScannedFile, category: 'movie' | 'tv'): Promise<LocalFile> {
  const meta = resolveFileMeta(file);
  let thumbnail = file.localFanart || file.localPoster || meta.poster || undefined;
  const skipThumbnail = !!(file.localPoster || file.localFanart);

  const generated = await generateVideoThumbnail(file.path, skipThumbnail, file.mtimeMs);
  if (!thumbnail && generated.thumbnail) {
    thumbnail = generated.thumbnail;
  }

  return applyMediaOverride({
    ...file,
    meta,
    thumbnail,
    duration: generated.duration || getCachedDuration(file.path) || 0,
    dateModified: file.mtimeMs ?? Date.now(),
    category,
  });
}

/** Fill in durations/thumbnails in the background without blocking the UI. */
export async function enrichLibraryInBackground(
  items: { file: ScannedFile; category: 'movie' | 'tv' }[],
  onBatch: (enriched: LocalFile[]) => void
): Promise<void> {
  const batch: LocalFile[] = [];
  let batchTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (batch.length === 0) return;
    onBatch([...batch]);
    batch.length = 0;
  };

  const queueUpdate = (entry: LocalFile) => {
    batch.push(entry);
    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(() => {
      flush();
      batchTimer = null;
    }, 120);
  };

  await runWithConcurrency(items, ENRICH_CONCURRENCY, async (item) => {
    const enriched = await enrichOne(item.file, item.category);
    queueUpdate(enriched);
  });

  if (batchTimer) clearTimeout(batchTimer);
  flush();
}

export function mergeEnrichedFiles(prev: LocalFile[], enriched: LocalFile[]): LocalFile[] {
  if (enriched.length === 0) return prev;
  const updates = new Map(enriched.map(f => [f.path, f]));
  return prev.map(f => updates.get(f.path) ?? f);
}
