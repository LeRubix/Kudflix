import type { LocalFile } from '../components/NetflixUI';

export interface MediaOverride {
  title?: string;
  description?: string;
  genre?: string;
  year?: string;
}

const STORAGE_KEY = 'netflix_media_overrides';

function loadAll(): Record<string, MediaOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getMediaOverride(path: string): MediaOverride | undefined {
  return loadAll()[path];
}

export function saveMediaOverride(path: string, override: MediaOverride): void {
  const all = loadAll();
  all[path] = { ...all[path], ...override };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function applyMediaOverride(file: LocalFile): LocalFile {
  const override = getMediaOverride(file.path);
  if (!override) return file;

  return {
    ...file,
    meta: {
      ...file.meta,
      title: override.title ?? file.meta?.title,
      description: override.description ?? file.meta?.description,
      genre: override.genre ?? file.meta?.genre,
      year: override.year ?? file.meta?.year,
    },
  };
}

export function mergeOverrideIntoMeta(
  meta: { title: string; description: string; poster: string | null; year: string; genre: string },
  path: string
) {
  const override = getMediaOverride(path);
  if (!override) return meta;

  return {
    ...meta,
    title: override.title ?? meta.title,
    description: override.description ?? meta.description,
    genre: override.genre ?? meta.genre,
    year: override.year ?? meta.year,
  };
}
