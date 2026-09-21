export {};

declare global {
  interface Window {
    electronAPI: {
      scanDirectory: (dirPath: string) => Promise<{name: string, path: string, relativePath?: string, folderName?: string, localPoster?: string | null, localFanart?: string | null, localNfoContent?: string | null}[]>;
      selectFolder: () => Promise<string | null>;
      selectFolders: () => Promise<string[]>;
      selectFile: () => Promise<string | null>;
      cacheProfileImage: () => Promise<string | null>;
      playInExternalPlayer: (playerPath: string, videoPath: string) => Promise<void>;
      probeMedia: (videoPath: string) => Promise<{ audioCodec: string | null; hasAudio: boolean | null }>;
    }
  }
}
