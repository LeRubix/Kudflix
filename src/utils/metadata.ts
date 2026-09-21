export interface MovieMeta {
  title: string;
  poster: string | null;
  description: string;
  year: string;
  genre: string;
}

function cleanTitle(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/\./g, " ")
    .replace(/\b(19|20)\d{2}\b.*$/, "")
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .trim();
}

/** Instant local metadata, no network. Used during library scan. */
export function getLocalMeta(filename: string): MovieMeta {
  return {
    title: cleanTitle(filename),
    poster: null,
    description: 'A video file from your local library.',
    year: '',
    genre: 'Local Media',
  };
}

function parseNfoMeta(nfo: string, fallbackTitle: string): MovieMeta {
  const meta = getLocalMeta(fallbackTitle);
  const titleMatch = nfo.match(/<title>(.*?)<\/title>/i);
  const plotMatch = nfo.match(/<plot>(.*?)<\/plot>/i);
  const yearMatch = nfo.match(/<year>(.*?)<\/year>/i);
  const genreMatch = nfo.match(/<genre>(.*?)<\/genre>/i);
  if (titleMatch) meta.title = titleMatch[1];
  if (plotMatch) meta.description = plotMatch[1];
  if (yearMatch) meta.year = yearMatch[1];
  if (genreMatch) meta.genre = genreMatch[1];
  return meta;
}

export function resolveFileMeta(file: { name: string; localNfoContent?: string | null }): MovieMeta {
  if (file.localNfoContent) return parseNfoMeta(file.localNfoContent, file.name);
  return getLocalMeta(file.name);
}

export async function fetchMetadata(filename: string): Promise<MovieMeta> {
  const clean = cleanTitle(filename);

  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=movie&limit=1`);
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
      const movie = data.results[0];
      return {
        title: movie.trackName || clean,
        poster: movie.artworkUrl100?.replace('100x100bb', '600x600bb') || null,
        description: movie.longDescription || movie.shortDescription || 'No description available.',
        year: movie.releaseDate ? movie.releaseDate.substring(0, 4) : 'Unknown',
        genre: movie.primaryGenreName || 'Movie'
      };
    }
  } catch (error) {
    console.error("Failed to fetch metadata for", clean);
  }

  return {
    title: clean,
    poster: null,
    description: 'A video file from your local library.',
    year: '',
    genre: 'Local Media'
  };
}
