import { isBrowserSupportedAudio } from './audioCodecs';

const probeCache = new Map<string, string | null>();

export async function getAudioCodec(videoPath: string): Promise<string | null> {
  if (probeCache.has(videoPath)) {
    return probeCache.get(videoPath) ?? null;
  }

  if (!window.electronAPI?.probeMedia) {
    return null;
  }

  try {
    const result = await window.electronAPI.probeMedia(videoPath);
    const codec = result?.audioCodec ?? null;
    probeCache.set(videoPath, codec);
    return codec;
  } catch {
    return null;
  }
}

export async function needsExternalPlayerForAudio(videoPath: string): Promise<boolean> {
  const codec = await getAudioCodec(videoPath);
  if (!codec) return false;
  return !isBrowserSupportedAudio(codec);
}
