import type { Settings } from '../components/SettingsModal';

export const MAX_APP_NAME_LENGTH = 50;

export function truncateAppName(name: string): string {
  return name.slice(0, MAX_APP_NAME_LENGTH);
}

const DEFAULT_SETTINGS: Settings = {
  accentColor: '#E50914',
  wallpaperPath: '',
  overlayOpacity: 0.5,
  appName: 'Kudflix',
  uiScale: 1.0,
  useExternalPlayer: false,
  externalPlayerPath: '',
  movieFolders: [],
  tvFolders: [],
  skipProfilePicker: false,
  defaultProfileId: null,
  compactLibraryButton: false,
  appIcon: 'default' as const,
  autoSyncLibrary: true,
};

export function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem('netflix_settings');
    const legacyLibrary = localStorage.getItem('netflix_library');

    if (saved) {
      const parsed = JSON.parse(saved);
      const movieFolders = parsed.movieFolders?.length
        ? parsed.movieFolders
        : legacyLibrary ? [legacyLibrary] : [];

      const accentColor = parsed.accentColor ?? DEFAULT_SETTINGS.accentColor;

      return {
        accentColor: accentColor === '#cf3f4c' ? '#E50914' : accentColor,
        wallpaperPath: parsed.wallpaperPath ?? '',
        overlayOpacity: parsed.overlayOpacity ?? DEFAULT_SETTINGS.overlayOpacity,
        appName: truncateAppName(parsed.appName ?? DEFAULT_SETTINGS.appName),
        uiScale: parsed.uiScale ?? DEFAULT_SETTINGS.uiScale,
        useExternalPlayer: parsed.useExternalPlayer ?? false,
        externalPlayerPath: parsed.externalPlayerPath ?? '',
        movieFolders,
        tvFolders: parsed.tvFolders ?? [],
        skipProfilePicker: parsed.skipProfilePicker ?? false,
        defaultProfileId: parsed.defaultProfileId ?? null,
        compactLibraryButton: parsed.compactLibraryButton ?? DEFAULT_SETTINGS.compactLibraryButton,
        appIcon: parsed.appIcon === 'alternate' ? 'alternate' : 'default',
        autoSyncLibrary: parsed.autoSyncLibrary ?? DEFAULT_SETTINGS.autoSyncLibrary,
      };
    }

    if (legacyLibrary) {
      return { ...DEFAULT_SETTINGS, movieFolders: [legacyLibrary] };
    }
  } catch {
    // fall through to defaults
  }

  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  const json = JSON.stringify(settings);
  if (localStorage.getItem('netflix_settings') === json) return;
  localStorage.setItem('netflix_settings', json);
}
