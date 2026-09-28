/**
 * Pre-package guard, ensures mpv is bundled before building the Windows installer.
 */
const fs = require('fs');
const path = require('path');

const mpvExe = path.join(__dirname, '..', 'electron', 'bin', 'mpv', 'mpv.exe');

if (!fs.existsSync(mpvExe)) {
  console.error('\n[prepackage] mpv.exe not found at electron/bin/mpv/mpv.exe');
  console.error('[prepackage] Run: npm run setup-mpv\n');
  process.exit(1);
}

console.log('[prepackage] mpv binary found, ready to package.');
