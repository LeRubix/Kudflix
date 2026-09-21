import type { LocalFile } from '../components/NetflixUI';
import { applyMediaOverride } from './mediaOverrides';
import { resolveFileMeta } from './metadata';
import { generateVideoThumbnail } from './thumbnail';
import { runWithConcurrency } from './concurrency';

const ENRICH_CONCURRENCY = 6;

type ScannedFile = {
  name: string;
  path: string;
  relativePath?: string;
  folderName?: string;
  localPoster?: string | null;
  localFanart?: string | null;
  localNfoContent?: string | null;
};

export function toBasicFile(file: ScannedFile, category: 'movie' | 'tv'): LocalFile {
  return applyMediaOverride({
    ...file,
    meta: resolveFileMeta(file),
    thumbnail: file.localFanart || file.localPoster || undefined,
    duration: 0,
    dateModified: Date.now(),
    category,
  });
}

async function enrichOne(file: ScannedFile, category: 'movie' | 'tv'): Promise<LocalFile> {
  const meta = resolveFileMeta(file);
  let thumbnail = file.localFanart || file.localPoster || meta.poster || undefined;
  const skipThumbnail = !!(file.localPoster || file.localFanart);

  const generated = await generateVideoThumbnail(file.path, skipThumbnail);
  if (!thumbnail && generated.thumbnail) {
    thumbnail = generated.thumbnail;
  }

  return applyMediaOverride({
    ...file,
    meta,
    thumbnail,
    duration: generated.duration,
    dateModified: Date.now(),
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
