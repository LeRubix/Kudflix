/** Audio codecs Chromium/Electron can decode in the built-in player. */
const BROWSER_SUPPORTED = new Set([
  'aac',
  'mp3',
  'opus',
  'vorbis',
  'flac',
  'alac',
  'pcm_s16le',
  'pcm_s16be',
  'pcm_s24le',
  'pcm_f32le',
  'pcm_s32le',
]);

export function isBrowserSupportedAudio(codec: string | null | undefined): boolean {
  if (!codec) return true;
  const base = codec.toLowerCase().split('.')[0].trim();
  return BROWSER_SUPPORTED.has(base);
}
