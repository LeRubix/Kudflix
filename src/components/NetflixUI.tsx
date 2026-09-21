import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, Plus, ChevronLeft, ChevronRight, X, Edit2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTMDBMetadata, type TMDBResult } from '../utils/tmdb';
import type { MediaOverride } from '../utils/mediaOverrides';
import { useImageBrightness } from '../hooks/useImageBrightness';
import { EpisodeRow } from './EpisodeRow';

// --- Types ---
export interface LocalFile {
  name: string;
  path: string;
  relativePath?: string;
  category?: 'movie' | 'tv';
  meta?: { title?: string; description?: string; poster?: string | null; year?: string; genre?: string; };
  thumbnail?: string;
  duration?: number;
  dateModified?: number;
  localPoster?: string | null;
  localFanart?: string | null;
  localNfoContent?: string | null;
  folderName?: string;
  isFolder?: boolean;
  folderFiles?: LocalFile[];
}

function getDisplayTitle(video: LocalFile) {
  return video.meta?.title || video.name;
}

// --- Thumbnail title with Bebas Neue + adaptive contrast ---
function ThumbnailTitle({ title, imageSrc, className = '' }: { title: string; imageSrc?: string; className?: string }) {
  const brightness = useImageBrightness(imageSrc);
  const isLight = brightness === 'light';

  return (
    <>
      <div
        className={`absolute bottom-0 left-0 right-0 h-14 pointer-events-none ${
          isLight ? 'bg-gradient-to-t from-white/80 via-white/30 to-transparent' : 'bg-gradient-to-t from-black/80 via-black/30 to-transparent'
        }`}
      />
      <div
        className={`absolute bottom-2 left-2 right-2 truncate font-bebas tracking-wide text-base leading-tight z-10 ${
          isLight ? 'text-black' : 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]'
        } ${className}`}
      >
        {title}
      </div>
    </>
  );
}

// --- Grid View Modal ---
export function GridViewModal({
  title,
  videos,
  onClose,
  onPlay,
  onInfo,
  progresses = {},
}: {
  title: string;
  videos: LocalFile[];
  onClose: () => void;
  onPlay: (v: LocalFile) => void;
  onInfo: (v: LocalFile) => void;
  progresses?: Record<string, number>;
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] bg-[#141414] flex flex-col pt-24"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="flex flex-col flex-1 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-10 pb-6 shrink-0">
            <h2 className="text-3xl md:text-4xl font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 bg-[#181818]/80 rounded-full hover:bg-white hover:text-black transition text-white border border-white/20"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-10 pb-10">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {videos.map((video, i) => (
                <VideoCard
                  key={`${video.path}-${i}`}
                  video={video}
                  onPlay={(v) => { onClose(); onPlay(v); }}
                  onInfo={(v) => { onClose(); onInfo(v); }}
                  variant="grid"
                  progress={progresses[video.path] !== undefined && video.duration ? progresses[video.path] / video.duration : 0}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// --- Detail Modal ---
export function DetailModal({
  video,
  onClose,
  onPlay,
  onUpdate,
}: {
  video: LocalFile;
  onClose: () => void;
  onPlay: (v: LocalFile) => void;
  onUpdate?: (path: string, override: MediaOverride) => void;
}) {
  const [tmdb, setTmdb] = useState<TMDBResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: video.meta?.title || video.name,
    description: video.meta?.description || '',
    genre: video.meta?.genre || '',
    year: video.meta?.year || '',
  });

  useEffect(() => {
    setEditForm({
      title: video.meta?.title || video.name,
      description: video.meta?.description || '',
      genre: video.meta?.genre || '',
      year: video.meta?.year || '',
    });
    setIsEditing(false);
  }, [video.path, video.meta?.title, video.meta?.description, video.meta?.genre, video.meta?.year, video.name]);

  const handleSaveEdits = () => {
    if (video.isFolder) return;
    const override: MediaOverride = {
      title: editForm.title.trim() || undefined,
      description: editForm.description.trim() || undefined,
      genre: editForm.genre.trim() || undefined,
      year: editForm.year.trim() || undefined,
    };
    onUpdate?.(video.path, override);
    setIsEditing(false);
  };

  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    // Fetch TMDB
    let title = video.meta?.title || video.name;
    if (video.relativePath) {
      // Use the root folder name for series if it's nested
      title = video.relativePath.split('/')[0];
    }
    
    getTMDBMetadata(title).then(res => {
      if (res) setTmdb(res);
    });

    return () => { document.body.style.overflow = 'auto'; };
  }, [video]);

  const [selectedSubfolder, setSelectedSubfolder] = useState<string>('');

  const subfolders = useState(() => {
    if (!video.isFolder || !video.folderFiles) return {};
    const groups: Record<string, LocalFile[]> = {};
    video.folderFiles.forEach(f => {
      const parts = f.relativePath ? f.relativePath.split('/') : [];
      let sub = 'Episodes';
      if (parts.length > 2) {
        sub = parts[1];
      }
      if (!groups[sub]) groups[sub] = [];
      groups[sub].push(f);
    });
    return groups;
  })[0];

  const subfolderNames = Object.keys(subfolders).sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
  
  useEffect(() => {
    if (subfolderNames.length > 0 && !selectedSubfolder) {
      setSelectedSubfolder(subfolderNames[0]);
    }
  }, [subfolderNames, selectedSubfolder]);

  const episodesToRender = subfolders[selectedSubfolder] || [];

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center pt-10 px-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div 
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          className="bg-[#181818] w-full max-w-4xl rounded-lg shadow-2xl overflow-hidden relative mb-10 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 right-0 z-[100] p-3 pointer-events-none">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="pointer-events-auto flex items-center justify-center w-12 h-12 min-w-[3rem] min-h-[3rem] rounded-full bg-black/80 hover:bg-white hover:text-black text-white border border-white/40 transition cursor-pointer shadow-lg"
              aria-label="Close"
            >
              <X size={24} strokeWidth={2.5} aria-hidden />
            </button>
          </div>

          {/* Hero Image */}
          <div className="relative w-full aspect-[16/7]">
            {video.isFolder && tmdb?.backdrop ? (
              <img src={tmdb.backdrop} alt="Backdrop" className="w-full h-full object-cover" />
            ) : video.thumbnail ? (
              <img src={video.thumbnail} alt={video.meta?.title || video.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/20 to-transparent" />
            <div className="absolute bottom-6 left-10 max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-md mb-6">{getDisplayTitle(video)}</h2>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    if (video.isFolder && video.folderFiles && video.folderFiles.length > 0) {
                      onPlay(episodesToRender[0] || video.folderFiles[0]);
                    } else {
                      onPlay(video);
                    }
                  }}
                  className="flex items-center gap-2 bg-white text-black px-8 py-2 rounded font-bold hover:bg-white/80 transition"
                >
                  <Play className="w-6 h-6 fill-black" /> Play
                </button>
                {!video.isFolder && onUpdate && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-2 bg-gray-600/80 text-white px-6 py-2 rounded font-bold hover:bg-gray-500/80 transition"
                  >
                    <Edit2 className="w-5 h-5" /> {isEditing ? 'Cancel Edit' : 'Edit'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="p-10 flex flex-col md:flex-row gap-12">
            <div className="flex-1">
              <div className="flex items-center gap-3 text-sm text-gray-400 font-semibold mb-6">
                <span className="text-green-400">{tmdb?.rating ? `${Math.round(tmdb.rating * 10)}% Match` : '98% Match'}</span>
                {(video.meta?.year || tmdb?.year) && (
                  <span>{video.meta?.year || tmdb?.year}</span>
                )}
                <span className="border border-gray-600 px-1.5 py-0.5 rounded text-xs">HD</span>
              </div>
              {isEditing ? (
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-white transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={4}
                      className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-white transition resize-none"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Genre</label>
                      <input
                        type="text"
                        value={editForm.genre}
                        onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                        placeholder="e.g. Action, Drama"
                        className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-white transition"
                      />
                    </div>
                    <div className="w-28">
                      <label className="text-xs font-semibold text-gray-500 block mb-1">Year</label>
                      <input
                        type="text"
                        value={editForm.year}
                        onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                        placeholder="1985"
                        className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-2 text-white outline-none focus:border-white transition"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveEdits}
                    className="flex items-center gap-2 bg-accent text-white px-6 py-2 rounded font-bold hover:opacity-90 transition"
                  >
                    <Save className="w-4 h-4" /> Save Changes
                  </button>
                </div>
              ) : (
                <p className="text-gray-200 leading-relaxed text-lg mb-8">
                  {tmdb?.synopsis || video.meta?.description || 'No description available for this local file. This file was automatically indexed from your local folders.'}
                </p>
              )}

              {video.isFolder && subfolderNames.length > 0 && (
                <div className="mt-8 border-t border-gray-800 pt-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-white">Episodes</h3>
                    {subfolderNames.length > 1 && (
                      <select 
                        value={selectedSubfolder}
                        onChange={(e) => setSelectedSubfolder(e.target.value)}
                        className="bg-[#242424] text-white border border-gray-600 rounded px-4 py-2 font-semibold outline-none focus:border-white transition"
                      >
                        {subfolderNames.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                      {episodesToRender.map((ep, i) => (
                        <EpisodeRow key={ep.path} ep={ep} index={i} seriesTvId={tmdb?.tvId} onPlay={onPlay} />
                      ))}
                    </div>
                </div>
              )}
            </div>
            
            <div className="w-full md:w-1/3 text-sm text-gray-400 space-y-6">
              <div>
                <span className="text-gray-500 block mb-1">File Path:</span> 
                <div className="text-gray-300 break-all font-mono text-xs bg-black/20 p-2 rounded">{video.path}</div>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Genres:</span>
                <span className="text-gray-300">
                  {video.meta?.genre || (video.isFolder ? 'Series' : 'Local Media')}
                </span>
              </div>
              {video.meta?.year && (
                <div>
                  <span className="text-gray-500 block mb-1">Year:</span>
                  <span className="text-gray-300">{video.meta.year}</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// --- Video Card (Hover Jawlet) ---
export function VideoCard({
  video,
  onPlay,
  onInfo,
  progress,
  variant = 'carousel',
}: {
  video: LocalFile;
  onPlay: (v: LocalFile) => void;
  onInfo: (v: LocalFile) => void;
  progress?: number;
  variant?: 'carousel' | 'grid';
}) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [tmdb, setTmdb] = useState<TMDBResult | null>(null);

  useEffect(() => {
    let title = video.meta?.title || video.name;
    if (video.relativePath) {
      title = video.relativePath.split('/')[0];
    }
    getTMDBMetadata(title).then(res => {
      if (res) setTmdb(res);
    });
  }, [video]);

  const isGrid = variant === 'grid';
  const cardImageSrc =
    video.isFolder && tmdb?.backdrop
      ? tmdb.backdrop
      : video.thumbnail || video.localFanart || video.localPoster || undefined;

  const handleMouseEnter = () => {
    if (video.isFolder || isGrid) return;
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (video.isFolder || isGrid) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  };

  return (
    <div 
      className={`relative rounded-md cursor-pointer transition-transform duration-300 ${isGrid ? 'w-full aspect-video' : 'flex-none w-64 aspect-video hover:z-50'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => {
        if (video.isFolder) {
          onInfo(video);
        } else if (!isHovered) {
          onPlay(video); // Quick click = play
        }
      }}
    >
      {/* Base Card (Underneath) */}
      <div className="w-full h-full bg-gray-800 rounded-md overflow-hidden relative">
        {video.isFolder && tmdb?.backdrop ? (
          <img src={tmdb.backdrop} alt="Backdrop" className="w-full h-full object-cover" />
        ) : video.thumbnail ? (
          <img src={video.thumbnail} alt={video.meta?.title || video.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center p-4 text-center font-bebas text-gray-300">
            {getDisplayTitle(video)}
          </div>
        )}
        <ThumbnailTitle title={getDisplayTitle(video)} imageSrc={cardImageSrc} />
        {/* Progress Bar */}
        {progress !== undefined && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
            <div className="h-full bg-red-600" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>

      {/* Expanded Hover Card (Jawlet), carousel only */}
      <AnimatePresence>
        {!isGrid && isHovered && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1.3 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[25%] w-full bg-[#181818] rounded-md shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[100] overflow-hidden border border-gray-700/50"
            style={{ transformOrigin: 'bottom center' }}
          >
            <div className="w-full aspect-video relative cursor-pointer" onClick={(e) => { e.stopPropagation(); onPlay(video); }}>
              <video 
                src={`file:///${video.path.replace(/\\/g, '/')}`} 
                autoPlay 
                muted 
                loop 
                className="w-full h-full object-cover"
                onLoadedMetadata={(e) => {
                  const v = e.target as HTMLVideoElement;
                  if (video.duration) v.currentTime = Math.floor(video.duration / 2); // Start playing from the middle!
                }}
              />
              {/* Play Overlay */}
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                <Play className="w-10 h-10 text-white fill-white drop-shadow-lg" />
              </div>
            </div>
            
            <div className="p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); onPlay(video); }} className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-200 transition">
                    <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                  </button>
                  <button className="w-8 h-8 bg-transparent border-2 border-gray-500 rounded-full flex items-center justify-center hover:border-white transition text-white">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onInfo(video); }} className="w-8 h-8 bg-transparent border-2 border-gray-500 rounded-full flex items-center justify-center hover:border-white transition text-white">
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-white font-semibold">
                <span className="text-green-400">98% Match</span>
                <span className="border border-gray-600 px-1 rounded text-gray-400">HD</span>
              </div>
              <div className="text-xs text-white font-bold line-clamp-2">
                {video.meta?.title || video.name}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Top10RankNumber({ rank }: { rank: number }) {
  const isOne = rank === 1;
  const isTen = rank >= 10;

  return (
    <div
      aria-hidden
      className="absolute inset-y-0 z-0 flex items-end pointer-events-none select-none"
      style={{ left: isOne ? -14 : isTen ? -18 : 0 }}
    >
      <span
        className="font-bebas tracking-tighter block"
        style={{
          marginBottom: 4,
          fontSize: isTen ? '6.75rem' : '7.25rem',
          lineHeight: 0.78,
          letterSpacing: isTen ? '-0.06em' : undefined,
          color: '#141414',
          WebkitTextStroke: '2px #737373',
          paintOrder: 'stroke fill',
        }}
      >
        {rank}
      </span>
    </div>
  );
}

/** Left inset for the poster so the rank peeks out to the left (Netflix-style overlap). */
function top10CardInset(rank: number): number {
  if (rank === 1) return 28;
  if (rank >= 10) return 58;
  return 40;
}

// --- Content Row (Carousel) ---
export function ContentRow({
  title,
  videos,
  onPlay,
  onInfo,
  progresses = {},
  isTop10 = false,
  expandable = false,
}: {
  title: string;
  videos: LocalFile[];
  onPlay: (v: LocalFile) => void;
  onInfo: (v: LocalFile) => void;
  progresses?: Record<string, number>;
  isTop10?: boolean;
  expandable?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  const handleScroll = () => {
    if (rowRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5); // 5px buffer
    }
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [videos]);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = direction === 'left' ? scrollLeft - clientWidth * 0.75 : scrollLeft + clientWidth * 0.75;
      rowRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (videos.length === 0) return null;

  return (
    <div className="mb-8 relative group z-20 hover:z-50">
      <h2
        className={`text-xl md:text-2xl font-bold text-gray-200 mb-2 px-10 transition flex items-center gap-2 ${expandable ? 'hover:text-white cursor-pointer' : ''}`}
        onClick={() => expandable && setShowGrid(true)}
      >
        {title}
        {expandable && (
          <ChevronRight className="w-5 h-5 text-transparent group-hover:text-white transition-all translate-x-[-10px] group-hover:translate-x-0" />
        )}
      </h2>

      {showGrid && (
        <GridViewModal
          title={title}
          videos={videos}
          onClose={() => setShowGrid(false)}
          onPlay={(v) => { setShowGrid(false); onPlay(v); }}
          onInfo={(v) => { setShowGrid(false); onInfo(v); }}
          progresses={progresses}
        />
      )}
      
      {/* Left Arrow */}
      {showLeftArrow && (
        <div 
          className="absolute left-0 top-[10%] bottom-[10%] w-10 md:w-12 bg-black/50 z-40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition hover:bg-black/80 rounded-r-md"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="w-8 h-8 text-white hover:scale-125 transition-transform" />
        </div>
      )}

      {/* Right Arrow */}
      {showRightArrow && (
        <div 
          className="absolute right-0 top-[10%] bottom-[10%] w-10 md:w-12 bg-black/50 z-40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition hover:bg-black/80 rounded-l-md"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="w-8 h-8 text-white hover:scale-125 transition-transform" />
        </div>
      )}

      <div 
        ref={rowRef}
        onScroll={handleScroll}
        className={`flex overflow-x-auto overflow-y-hidden px-10 py-32 -my-28 hide-scrollbar scroll-smooth ${isTop10 ? 'gap-5' : 'gap-2'}`}
      >
        {videos.map((video, i) => {
          const rank = i + 1;
          return (
            <div
              key={`${video.path}-${i}`}
              className="relative flex items-end flex-shrink-0 hover:z-50"
            >
              {isTop10 && <Top10RankNumber rank={rank} />}
              <div
                className={isTop10 ? 'relative z-10 flex-shrink-0' : ''}
                style={isTop10 ? { marginLeft: top10CardInset(rank) } : undefined}
              >
                <VideoCard video={video} onPlay={onPlay} onInfo={onInfo} progress={progresses[video.path] !== undefined && video.duration ? progresses[video.path] / video.duration : 0} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
