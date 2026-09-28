import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Play } from 'lucide-react';
import type { LocalFile } from './NetflixUI';
import { getEpisodeDisplayTitle } from '../utils/metadata';
import {
  getTMDBEpisodeMeta,
  parseSeasonEpisode,
  type TMDBEpisodeMeta,
} from '../utils/tmdb';

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const checkOverflow = () => {
      if (expanded) return;
      setCanExpand(el.scrollHeight > el.clientHeight + 1);
    };

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="text-sm text-gray-400">
      <p ref={textRef} className={expanded ? '' : 'line-clamp-2'}>
        {text}
      </p>
      {(canExpand || expanded) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-1 text-xs text-gray-500 hover:text-gray-300 transition"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  );
}

export function EpisodeRow({
  ep,
  index,
  seriesTvId,
  episodeMeta,
  seriesThumbnail,
  onPlay,
}: {
  ep: LocalFile;
  index: number;
  seriesTvId?: number;
  episodeMeta?: TMDBEpisodeMeta | null;
  seriesThumbnail?: string;
  onPlay: (ep: LocalFile) => void;
}) {
  const [synopsis, setSynopsis] = useState<string | null>(episodeMeta?.synopsis ?? null);
  const [tmdbEpisodeName, setTmdbEpisodeName] = useState<string | null>(episodeMeta?.name ?? null);

  useEffect(() => {
    if (episodeMeta) {
      setSynopsis(episodeMeta.synopsis);
      setTmdbEpisodeName(episodeMeta.name);
      return;
    }

    if (!seriesTvId) return;

    const parsed = parseSeasonEpisode(ep.name) || parseSeasonEpisode(ep.relativePath || '');
    if (!parsed) return;

    let cancelled = false;
    getTMDBEpisodeMeta(seriesTvId, parsed.season, parsed.episode).then((res) => {
      if (cancelled || !res) return;
      if (res.synopsis) setSynopsis(res.synopsis);
      if (res.name) setTmdbEpisodeName(res.name);
    });

    return () => {
      cancelled = true;
    };
  }, [seriesTvId, ep.path, ep.name, ep.relativePath, episodeMeta]);

  const description = synopsis || ep.meta?.description || 'A video file from your local library.';
  const thumbSrc = ep.thumbnail || ep.localFanart || ep.localPoster || seriesThumbnail;

  return (
    <div
      className="flex items-center gap-4 p-4 rounded hover:bg-[#2b2b2b] transition cursor-pointer group border-b border-gray-800/50"
      onClick={() => onPlay(ep)}
    >
      <div className="text-gray-400 font-bold w-6 text-xl">{index + 1}</div>
      <div className="relative w-32 aspect-video bg-gray-800 rounded overflow-hidden flex-shrink-0">
        {thumbSrc ? (
          <img src={thumbSrc} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-600 p-2 text-center">
            No Image
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
          <Play className="w-8 h-8 text-white fill-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-bold mb-1">{getEpisodeDisplayTitle(ep, tmdbEpisodeName)}</h4>
        <ExpandableDescription text={description} />
      </div>
      <div className="text-gray-500 text-sm flex-shrink-0">
        {ep.duration && ep.duration > 0 ? (
          `${Math.floor(ep.duration / 60)}m`
        ) : (
          <span className="italic">Null</span>
        )}
      </div>
    </div>
  );
}
