import type { Settings } from '../components/SettingsModal';

const DEFAULT_SETTINGS: Settings = {
  accentColor: '#fdbce6',
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

      return {
        accentColor: parsed.accentColor ?? DEFAULT_SETTINGS.accentColor,
        wallpaperPath: parsed.wallpaperPath ?? '',
        overlayOpacity: parsed.overlayOpacity ?? DEFAULT_SETTINGS.overlayOpacity,
        appName: parsed.appName ?? DEFAULT_SETTINGS.appName,
        uiScale: parsed.uiScale ?? DEFAULT_SETTINGS.uiScale,
        useExternalPlayer: parsed.useExternalPlayer ?? false,
        externalPlayerPath: parsed.externalPlayerPath ?? '',
        movieFolders,
        tvFolders: parsed.tvFolders ?? [],
        skipProfilePicker: parsed.skipProfilePicker ?? false,
        defaultProfileId: parsed.defaultProfileId ?? null,
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
  localStorage.setItem('netflix_settings', JSON.stringify(settings));
}
