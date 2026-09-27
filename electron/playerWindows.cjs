const { BrowserWindow } = require('electron');

// Height of the strip left uncovered in windowed mode so the main window's
// drag region and caption buttons (titleBarOverlay) stay usable.
const TITLE_STRIP_HEIGHT = 32;

/**
 * Window stack while playing (owned windows always sit directly above their
 * owner, never above other applications):
 *
 *   mainWindow   - library UI (opaque)
 *   videoWindow  - transparent, click-through, mpv renders into it via --wid
 *   controlsWindow - transparent, renders the React player controls
 */
class PlayerWindows {
  constructor(mainWindow, { isDev, preloadPath, indexHtmlPath }) {
    this.mainWindow = mainWindow;
    this.isDev = isDev;
    this.preloadPath = preloadPath;
    this.indexHtmlPath = indexHtmlPath;
    this.videoWindow = null;
    this.controlsWindow = null;
    this.onControlsClosed = null;
    this.syncBounds = this.syncBounds.bind(this);
    this.handleMinimize = this.handleMinimize.bind(this);
    this.handleRestore = this.handleRestore.bind(this);
  }

  isOpen() {
    return Boolean(this.videoWindow && !this.videoWindow.isDestroyed());
  }

  getTargetBounds() {
    const bounds = this.mainWindow.getContentBounds();
    if (this.mainWindow.isFullScreen()) return bounds;
    return {
      x: bounds.x,
      y: bounds.y + TITLE_STRIP_HEIGHT,
      width: bounds.width,
      height: Math.max(1, bounds.height - TITLE_STRIP_HEIGHT),
    };
  }

  syncBounds() {
    if (!this.isOpen() || this.mainWindow.isDestroyed()) return;
    const bounds = this.getTargetBounds();
    this.videoWindow.setBounds(bounds);
    if (this.controlsWindow && !this.controlsWindow.isDestroyed()) {
      this.controlsWindow.setBounds(bounds);
      this.controlsWindow.webContents.send('player-fullscreen', this.mainWindow.isFullScreen());
    }
  }

  handleMinimize() {
    this.videoWindow?.hide();
    this.controlsWindow?.hide();
  }

  handleRestore() {
    if (!this.isOpen()) return;
    this.syncBounds();
    this.videoWindow.showInactive();
    this.controlsWindow?.show();
    this.controlsWindow?.focus();
  }

  open() {
    if (this.isOpen()) {
      this.syncBounds();
      return;
    }

    const bounds = this.getTargetBounds();

    this.videoWindow = new BrowserWindow({
      ...bounds,
      parent: this.mainWindow,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      focusable: false,
      skipTaskbar: true,
      show: false,
      hasShadow: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    this.videoWindow.setIgnoreMouseEvents(true);
    this.videoWindow.loadURL('about:blank');

    this.controlsWindow = new BrowserWindow({
      ...bounds,
      parent: this.videoWindow,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      show: false,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
      },
    });

    if (this.isDev) {
      this.controlsWindow.loadURL('http://localhost:5173/?player=1');
    } else {
      this.controlsWindow.loadFile(this.indexHtmlPath, { query: { player: '1' } });
    }

    this.controlsWindow.once('ready-to-show', () => {
      if (!this.isOpen()) return;
      this.syncBounds();
      this.videoWindow.showInactive();
      this.controlsWindow.show();
      this.controlsWindow.focus();
    });

    this.controlsWindow.on('closed', () => {
      this.controlsWindow = null;
      if (this.onControlsClosed) this.onControlsClosed();
    });

    this.mainWindow.on('resize', this.syncBounds);
    this.mainWindow.on('move', this.syncBounds);
    this.mainWindow.on('enter-full-screen', this.syncBounds);
    this.mainWindow.on('leave-full-screen', this.syncBounds);
    this.mainWindow.on('maximize', this.syncBounds);
    this.mainWindow.on('unmaximize', this.syncBounds);
    this.mainWindow.on('minimize', this.handleMinimize);
    this.mainWindow.on('restore', this.handleRestore);
  }

  getVideoHwnd() {
    if (!this.isOpen()) throw new Error('Video window is not open');
    const handle = this.videoWindow.getNativeWindowHandle();
    return handle.length >= 8 ? handle.readBigInt64LE(0).toString() : String(handle.readInt32LE(0));
  }

  sendToControls(channel, payload) {
    if (this.controlsWindow && !this.controlsWindow.isDestroyed()) {
      this.controlsWindow.webContents.send(channel, payload);
    }
  }

  setFullscreen(fullscreen) {
    if (this.mainWindow.isDestroyed()) return false;
    this.mainWindow.setFullScreen(fullscreen);
    return fullscreen;
  }

  close() {
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.removeListener('resize', this.syncBounds);
      this.mainWindow.removeListener('move', this.syncBounds);
      this.mainWindow.removeListener('enter-full-screen', this.syncBounds);
      this.mainWindow.removeListener('leave-full-screen', this.syncBounds);
      this.mainWindow.removeListener('maximize', this.syncBounds);
      this.mainWindow.removeListener('unmaximize', this.syncBounds);
      this.mainWindow.removeListener('minimize', this.handleMinimize);
      this.mainWindow.removeListener('restore', this.handleRestore);
      if (this.mainWindow.isFullScreen()) this.mainWindow.setFullScreen(false);
    }

    const controls = this.controlsWindow;
    const video = this.videoWindow;
    this.controlsWindow = null;
    this.videoWindow = null;

    if (controls && !controls.isDestroyed()) {
      controls.removeAllListeners('closed');
      controls.destroy();
    }
    if (video && !video.isDestroyed()) video.destroy();

    if (!this.mainWindow.isDestroyed()) this.mainWindow.focus();
  }
}

module.exports = { PlayerWindows, TITLE_STRIP_HEIGHT };
