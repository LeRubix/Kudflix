import type { LocalFile } from '../components/NetflixUI';
import { applyMediaOverride } from './mediaOverrides';

export function getSeriesRoot(relativePath?: string): string | null {
  if (!relativePath) return null;
  const parts = relativePath.split('/');
  return parts.length > 1 ? parts[0] : null;
}

function bestThumbnail(episodes: LocalFile[]): string | undefined {
  for (const ep of episodes) {
    if (ep.localFanart) return ep.localFanart;
  }
  for (const ep of episodes) {
    if (ep.localPoster) return ep.localPoster;
  }
  for (const ep of episodes) {
    if (ep.thumbnail) return ep.thumbnail;
  }
  return undefined;
}

export function buildSeriesFolders(shows: LocalFile[]): LocalFile[] {
  const rootFolders = new Map<string, LocalFile[]>();

  shows.forEach((f) => {
    const root = getSeriesRoot(f.relativePath);
    if (!root) return;
    if (!rootFolders.has(root)) rootFolders.set(root, []);
    rootFolders.get(root)!.push(f);
  });

  return Array.from(rootFolders.entries()).map(([root, fList]) => {
    const sorted = [...fList].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    const fanart = sorted.find((ep) => ep.localFanart)?.localFanart ?? null;
    const poster = sorted.find((ep) => ep.localPoster)?.localPoster ?? null;
    const folder: LocalFile = {
      name: root,
      path: `folder://${root}`,
      isFolder: true,
      category: 'tv',
      folderFiles: sorted,
      thumbnail: bestThumbnail(sorted),
      localFanart: fanart,
      localPoster: poster,
      meta: {
        title: root,
        description: `A collection of ${sorted.length} video files inside the ${root} folder.`,
      },
      dateModified: Date.now(),
    };
    return applyMediaOverride(folder);
  });
}

export function isInProgress(file: LocalFile, progresses: Record<string, number>): boolean {
  const pos = progresses[file.path];
  if (!pos || pos <= 5) return false;
  if (file.duration && pos >= file.duration - 30) return false;
  return true;
}

export function buildContinueWatchingMovies(
  movies: LocalFile[],
  progresses: Record<string, number>,
): LocalFile[] {
  return movies.filter((f) => isInProgress(f, progresses));
}

export function buildContinueWatchingSeries(
  shows: LocalFile[],
  progresses: Record<string, number>,
  seriesFolders: LocalFile[],
): LocalFile[] {
  const inProgress = shows.filter((f) => isInProgress(f, progresses));
  const byRoot = new Map<string, LocalFile>();

  for (const ep of inProgress) {
    const root = getSeriesRoot(ep.relativePath);
    if (!root) continue;
    const existing = byRoot.get(root);
    const existingPos = existing ? (progresses[existing.path] ?? 0) : -1;
    const epPos = progresses[ep.path] ?? 0;
    if (!existing || epPos > existingPos) {
      byRoot.set(root, ep);
    }
  }

  return Array.from(byRoot.entries()).map(([root, resumeEpisode]) => {
    const folder = seriesFolders.find((f) => f.path === `folder://${root}`);
    if (!folder) {
      return { ...resumeEpisode, resumeEpisode };
    }
    return { ...folder, resumeEpisode };
  });
}

export function buildContinueWatchingAll(
  movies: LocalFile[],
  shows: LocalFile[],
  progresses: Record<string, number>,
  seriesFolders: LocalFile[],
): LocalFile[] {
  const movieItems = buildContinueWatchingMovies(movies, progresses);
  const seriesItems = buildContinueWatchingSeries(shows, progresses, seriesFolders);
  return [...movieItems, ...seriesItems];
}

export function buildTop10(
  movies: LocalFile[],
  shows: LocalFile[],
  playCounts: Record<string, number>,
  seriesFolders: LocalFile[],
): LocalFile[] {
  type Scored = { item: LocalFile; count: number };

  const scored: Scored[] = [];

  for (const movie of movies) {
    const count = playCounts[movie.path] ?? 0;
    if (count > 0) scored.push({ item: movie, count });
  }

  const seriesCounts = new Map<string, number>();
  for (const ep of shows) {
    const root = getSeriesRoot(ep.relativePath);
    if (!root) continue;
    const count = playCounts[ep.path] ?? 0;
    if (count <= 0) continue;
    seriesCounts.set(root, (seriesCounts.get(root) ?? 0) + count);
  }

  for (const [root, count] of seriesCounts) {
    const folder = seriesFolders.find((f) => f.path === `folder://${root}`);
    if (folder) scored.push({ item: folder, count });
  }

  return scored
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((s) => s.item);
}

export function buildSearchCatalog(movies: LocalFile[], seriesFolders: LocalFile[]): LocalFile[] {
  return [...movies, ...seriesFolders];
}

export function buildHeroCatalog(movies: LocalFile[], seriesFolders: LocalFile[]): LocalFile[] {
  return [...movies, ...seriesFolders];
}

/** Episode to play from a series folder card (resume or first). */
export function resolvePlayTarget(video: LocalFile): LocalFile {
  if (video.resumeEpisode) return video.resumeEpisode;
  if (video.isFolder && video.folderFiles?.length) return video.folderFiles[0];
  return video;
}

/** Progress fraction for a card (handles resumeEpisode). */
export function cardProgress(
  video: LocalFile,
  progresses: Record<string, number>,
): number | undefined {
  const src = video.resumeEpisode ?? video;
  const pos = progresses[src.path];
  if (pos === undefined || !src.duration) return undefined;
  return pos / src.duration;
}

export function buildCollections(movies: LocalFile[]) {
  const genreMap = new Map<string, LocalFile[]>();
  const folderMap = new Map<string, LocalFile[]>();

  movies.forEach((m) => {
    const g = m.meta?.genre;
    if (g && g !== 'Movie' && g !== 'Local Media') {
      const primary = g.split(',')[0].trim();
      if (!genreMap.has(primary)) genreMap.set(primary, []);
      genreMap.get(primary)!.push(m);
    }

    if (m.folderName) {
      if (!folderMap.has(m.folderName)) folderMap.set(m.folderName, []);
      folderMap.get(m.folderName)!.push(m);
    }
  });

  const collections = Array.from(genreMap.entries())
    .filter(([, v]) => v.length >= 2)
    .map(([k, v]) => ({ title: `${k} Movies`, videos: v }));

  const franchises = Array.from(folderMap.entries())
    .filter(([, v]) => v.length >= 2)
    .map(([k, v]) => ({ title: `${k} Collection`, videos: v }));

  return [...franchises, ...collections];
}
