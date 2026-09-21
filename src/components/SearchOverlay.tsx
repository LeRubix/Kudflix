import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LocalFile } from './NetflixUI';

function getSearchText(file: LocalFile): string {
  return [
    file.meta?.title,
    file.name,
    file.meta?.genre,
    file.meta?.description,
    file.meta?.year,
    file.folderName,
    file.relativePath,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function SearchOverlay({
  files,
  onClose,
  onPlay,
  onInfo,
}: {
  files: LocalFile[];
  onClose: () => void;
  onInfo: (v: LocalFile) => void;
  onPlay: (v: LocalFile) => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files.slice(0, 40);
    return files.filter(f => getSearchText(f).includes(q)).slice(0, 60);
  }, [files, query]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[450] bg-[#141414]/98 flex flex-col pt-24"
      >
        <div className="px-10 pb-6">
          <div className="flex items-center gap-4 max-w-3xl">
            <Search className="w-6 h-6 text-white flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, genres, folders..."
              className="flex-1 bg-transparent text-white text-xl outline-none placeholder:text-gray-500 border-b border-gray-600 focus:border-white pb-2 transition"
            />
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-10 pb-10">
          {results.length === 0 ? (
            <p className="text-gray-500 text-lg mt-8">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {results.map((file) => (
                <button
                  key={file.path}
                  onClick={() => {
                    onClose();
                    if (file.isFolder) onInfo(file);
                    else onInfo(file);
                  }}
                  className="flex items-center gap-4 bg-[#181818] hover:bg-[#242424] rounded-lg p-3 text-left transition group"
                >
                  <div className="w-28 aspect-video rounded overflow-hidden bg-gray-800 flex-shrink-0 relative">
                    {file.thumbnail ? (
                      <img src={file.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 p-2 text-center">
                        {file.meta?.title || file.name}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate group-hover:text-accent transition">
                      {file.meta?.title || file.name}
                    </p>
                    {file.meta?.genre && (
                      <p className="text-gray-500 text-sm truncate">{file.meta.genre}</p>
                    )}
                    {file.meta?.year && (
                      <p className="text-gray-600 text-xs mt-0.5">{file.meta.year}</p>
                    )}
                  </div>
                  {!file.isFolder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onPlay(file);
                      }}
                      className="p-2 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition flex-shrink-0 opacity-0 group-hover:opacity-100"
                      aria-label="Play"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
