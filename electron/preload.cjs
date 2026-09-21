const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  scanDirectory: (dirPath) => ipcRenderer.invoke('scan-directory', dirPath),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFolders: () => ipcRenderer.invoke('select-folders'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  cacheProfileImage: () => ipcRenderer.invoke('cache-profile-image'),
  playInExternalPlayer: (playerPath, videoPath) => ipcRenderer.invoke('play-in-external-player', playerPath, videoPath),
  probeMedia: (videoPath) => ipcRenderer.invoke('probe-media', videoPath)
});
