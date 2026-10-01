import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Filter, Clock, Eye, Calendar, Tag, Film } from 'lucide-react';
import {
  type CatalogFilters,
  type WatchedFilter,
  type MediaTypeFilter,
  countActiveFilters,
  DEFAULT_CATALOG_FILTERS,
  LENGTH_SLIDER_MAX,
  LENGTH_SLIDER_STEP,
  RELEASE_DECADES,
} from '../utils/catalogFilters';

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 bg-[#242424] border rounded px-3 py-2.5 text-sm font-semibold text-white outline-none transition disabled:opacity-50 ${
          open ? 'border-white' : 'border-gray-600 hover:border-gray-400'
        }`}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[200] bg-[#242424] border border-gray-600 rounded shadow-[0_4px_20px_rgba(0,0,0,0.5)] max-h-52 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition ${
                opt.value === value
                  ? 'text-white bg-white/10'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapseButton({ onClick, direction }: { onClick: () => void; direction: 'expand' | 'collapse' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded text-gray-500 hover:text-white transition"
      title={direction === 'expand' ? 'Expand filters' : 'Collapse filters'}
    >
      {direction === 'expand' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
    </button>
  );
}

const MEDIA_TYPE_OPTIONS: { value: MediaTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV Shows' },
];

const WATCHED_OPTIONS: { value: WatchedFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unwatched', label: 'Unwatched' },
  { value: 'partial', label: 'Partially Watched' },
  { value: 'watched', label: 'Watched' },
];

export function SearchFilterSidebar({
  filters,
  onChange,
  genres,
}: {
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  genres: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveFilters(filters);

  const toggleGenre = (genre: string) => {
    const next = filters.genres.includes(genre)
      ? filters.genres.filter((g) => g !== genre)
      : [...filters.genres, genre];
    onChange({ ...filters, genres: next });
  };

  const resetFilters = () => onChange(DEFAULT_CATALOG_FILTERS);

  if (!expanded) {
    return (
      <div className="relative flex flex-col items-center py-4 px-2 bg-[#181818] border-r border-gray-800 shrink-0 w-14 gap-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
          title="Expand filters"
        >
          <Filter className="w-5 h-5" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setExpanded(true)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition" title="Media type">
          <Film className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setExpanded(true)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition" title="Watched">
          <Eye className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setExpanded(true)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition" title="Genre">
          <Tag className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setExpanded(true)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition" title="Length">
          <Clock className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setExpanded(true)} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition" title="Release date">
          <Calendar className="w-4 h-4" />
        </button>
        <div className="mt-auto">
          <CollapseButton onClick={() => setExpanded(true)} direction="expand" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col bg-[#181818] border-r border-gray-800 shrink-0 w-64 min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <span className="text-sm font-bold text-white flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filters
          {activeCount > 0 && (
            <span className="text-xs bg-accent text-white px-1.5 py-0.5 rounded-full">{activeCount}</span>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-visible px-4 py-4 space-y-5 min-h-0">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Film className="w-3.5 h-3.5" /> Media type
          </label>
          <FilterSelect
            value={filters.mediaType}
            onChange={(v) => onChange({ ...filters, mediaType: v })}
            options={MEDIA_TYPE_OPTIONS}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Eye className="w-3.5 h-3.5" /> Watched
          </label>
          <FilterSelect
            value={filters.watched}
            onChange={(v) => onChange({ ...filters, watched: v })}
            options={WATCHED_OPTIONS}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Tag className="w-3.5 h-3.5" /> Genre
          </label>
          {genres.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No genres in library</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {genres.map((genre) => {
                const selected = filters.genres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenre(genre)}
                    className={`text-xs px-2 py-1 rounded-full border transition ${
                      selected
                        ? 'bg-accent border-accent text-white'
                        : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5" /> Length
          </label>
          <p className="text-xs text-gray-500 mb-2">
            {filters.lengthMin > 0 || filters.lengthMax < LENGTH_SLIDER_MAX
              ? `${filters.lengthMin}–${filters.lengthMax === LENGTH_SLIDER_MAX ? `${LENGTH_SLIDER_MAX}+` : filters.lengthMax} min`
              : 'Any length'}
            <span className="text-gray-600"> · TV uses avg. episode length</span>
          </p>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Min</span>
                <span>{filters.lengthMin} min</span>
              </div>
              <input
                type="range"
                min={0}
                max={LENGTH_SLIDER_MAX}
                step={LENGTH_SLIDER_STEP}
                value={filters.lengthMin}
                onChange={(e) => {
                  const min = parseInt(e.target.value, 10);
                  onChange({
                    ...filters,
                    lengthMin: Math.min(min, filters.lengthMax),
                  });
                }}
                className="w-full accent-accent"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Max</span>
                <span>{filters.lengthMax >= LENGTH_SLIDER_MAX ? `${LENGTH_SLIDER_MAX}+` : `${filters.lengthMax} min`}</span>
              </div>
              <input
                type="range"
                min={0}
                max={LENGTH_SLIDER_MAX}
                step={LENGTH_SLIDER_STEP}
                value={filters.lengthMax}
                onChange={(e) => {
                  const max = parseInt(e.target.value, 10);
                  onChange({
                    ...filters,
                    lengthMax: Math.max(max, filters.lengthMin),
                  });
                }}
                className="w-full accent-accent"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5" /> Release date
          </label>
          <FilterSelect
            value={filters.decade}
            onChange={(v) => onChange({ ...filters, decade: v, customYear: '' })}
            options={RELEASE_DECADES}
            disabled={!!filters.customYear.trim()}
          />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={filters.customYear}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
              onChange({ ...filters, customYear: val, decade: val ? 'any' : filters.decade });
            }}
            placeholder="Or type a year (e.g. 1999)"
            className="w-full mt-2 bg-[#242424] border border-gray-600 rounded px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-white hover:border-gray-400 transition placeholder:text-gray-500 placeholder:font-normal"
          />
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="w-full text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg py-2 transition"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="shrink-0 flex justify-center py-3 border-t border-gray-800">
        <CollapseButton onClick={() => setExpanded(false)} direction="collapse" />
      </div>
    </div>
  );
}
