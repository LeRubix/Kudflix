# PR Changes

Personal changes on this branch for maintainer review. Grouped by area and each item has a short description and file locations. I understand not every change is desired so I've made sure to include where each change is located, but personally I believe all of these are good changes, feel free to remove whatever you want.

---

## Bug fixes

- **Fixed Profile avatar upload doing nothing** : Profile images are copied into app userData so avatars survive if the original file moves or is deleted.  
  `electron/main.cjs` (`cache-profile-image`), `electron/preload.cjs`, `src/components/ProfilesScreen.tsx`, `src/components/SettingsModal.tsx`

- **Library folders persist on restart** : Movie/TV folder lists no longer wipe on launch due to an async settings load race.  
  `src/utils/settings.ts` (`loadSettings()`), `src/App.tsx`

- **Detail modal close hit area**
  `src/components/NetflixUI.tsx` (`DetailModal`)

- **AC3/DTS no audio in built-in player** : ffprobe detects unsupported audio codecs; shows an in-player banner with optional external-player button. Issue currently open in main repo for this issue, this fix just detects it and notifies the user.
  `electron/main.cjs` (`probe-media`), `electron/preload.cjs`, `src/utils/audioCodecs.ts`, `src/utils/mediaProbe.ts`, `src/App.tsx`, `src/types.d.ts`

- **External player respects setting** : PotPlayer/VLC only auto-launch when “Use External Video Player” is enabled; when disabled, playback stays internal and the AC3/DTS banner offers a manual fallback.  
  `src/App.tsx` (`handlePlayVideo`)

- **Splash freeze** : Startup animation (~1.8s) no longer blocks on a full library scan; scanning starts after profile selection.  
  `src/components/StartupScreen.tsx`, `src/index.css` (`animate-startup-logo`), `src/App.tsx`

- **Thumbnails on profile switch** : Library rescan runs once per folder configuration, not on every profile change (avoids thumbnail reload flicker).  
  `src/App.tsx` (`loadedLibraryKeyRef`)



## Library & performance

- **Multi-folder library** : Separate movie and TV source folders; items are categorized by source folder, not file duration.  
  `src/utils/settings.ts` (`movieFolders`, `tvFolders`), `src/components/SettingsModal.tsx` (Library tab), `src/App.tsx`, `electron/main.cjs` / `preload.cjs` (`select-folders`)

- **Settings module** : App settings extracted into a shared load/save module used on startup and in the settings modal.  
  `src/utils/settings.ts`, `src/App.tsx`, `src/components/SettingsModal.tsx`

- **Progressive library load** : File list appears first; thumbnails and metadata load in the background with bounded concurrency.  
  `src/utils/libraryLoader.ts`, `src/utils/concurrency.ts`, `src/utils/mediaCache.ts`, `src/App.tsx`

- **Local metadata during scan** : Instant titles from filenames and `.nfo` sidecars without waiting on network lookups.  
  `src/utils/metadata.ts` (`getLocalMeta`, `resolveFileMeta`, `parseNfoMeta`)

- **Faster thumbnail generation** : Smaller JPEG output, duration cache, 12s timeout, and skip-thumbnail path for list-first loading.  
  `src/utils/thumbnail.ts`, `src/utils/mediaCache.ts`


## UI & UX

- **Grid view from row headers** : Click a row title on Home / TV / Movies to open a full-screen grid of that row’s content.  
  `src/components/NetflixUI.tsx` (`ContentRow`, `GridViewModal`), `src/App.tsx`

- **Search overlay** : Search the library from the navbar.  
  `src/components/SearchOverlay.tsx`, `src/App.tsx`

- **Editable media metadata** : Edit title, description, genre, and year from the detail modal; overrides persist per file path in localStorage.  
  `src/utils/mediaOverrides.ts`, `src/components/NetflixUI.tsx` (`DetailModal`), `src/App.tsx` (`handleUpdateVideo`)

- **Bebas Neue thumbnail titles** : Card titles use Bebas Neue with light/dark text chosen depending on thumbnail brightness. More similar to Netflix's font than the previous choice 
  `package.json` (`@fontsource/bebas-neue`), `src/main.tsx`, `src/index.css` (`.font-bebas`), `src/hooks/useImageBrightness.ts`, `src/components/NetflixUI.tsx` (`ThumbnailTitle`)

- **Player title on hover** : Netflix-style title overlay when hovering the built-in video player.  
  `src/components/NetflixUI.tsx`

- **Header nav zoom** : Navbar scaled to 115% without affecting the rest of the layout.  
  `src/App.tsx` (`zoom: 1.15` on `<nav>`)

- **Detail modal year** : Release year shown from saved metadata when available.  
  `src/components/NetflixUI.tsx` (`DetailModal`, `video.meta?.year`)

- **Top 10 row** : Netflix-style rank numbers behind thumbnails; row lists most-played titles only.  
  `src/components/NetflixUI.tsx` (`Top10RankNumber`, `ContentRow`), `src/App.tsx` (play-count selection)

- **Home row expandable hover** : “Home” row title uses the same hover/chevron/grid behaviour as TV and Movies tab rows.  
  `src/App.tsx`, `src/components/NetflixUI.tsx` (`ContentRow` `expandable`)


## Profiles & settings

- **Default profile / skip picker** : Optional auto sign-in on launch; clicking the profile avatar in the navbar still opens the picker.  Set the default profile in profile settings or on the manage profiles screen.
  `src/utils/settings.ts` (`skipProfilePicker`, `defaultProfileId`), `src/components/ProfilesScreen.tsx`, `src/components/SettingsModal.tsx` (Profiles tab), `src/App.tsx`


## Electron IPC (new / updated)

| Handler | Purpose |
|---------|---------|
| `select-folders` | Multi-select folder picker for library setup |
| `cache-profile-image` | Pick image and copy to userData avatars dir |
| `probe-media` | ffprobe audio codec for AC3/DTS detection |
| `play-in-external-player` | Returns a promise; PotPlayer/VLC launch args unchanged |

Files: `electron/main.cjs`, `electron/preload.cjs`, `src/types.d.ts`

---

## Notes for reviewers

- **Title years:** Filename cleaning strips years by design (`src/utils/metadata.ts` → `cleanTitle`). Set year via Edit if needed.
- **Top 10:** Only items with at least one play on the active profile appear; fewer than 10 is expected on a fresh profile.
- **External player:** Path can stay configured while the toggle is off : it is used only when the toggle is on or via the manual banner button.
- **Restart required** after merge for Electron IPC changes.
