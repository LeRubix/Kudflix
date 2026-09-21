import { getCachedDuration, setCachedDuration } from './mediaCache';

const MAX_THUMB_WIDTH = 320;
const THUMB_TIMEOUT_MS = 12000;

export async function generateVideoThumbnail(
  videoPath: string,
  skipThumbnail: boolean = false
): Promise<{ thumbnail: string | null; duration: number }> {
  const cachedDuration = getCachedDuration(videoPath);
  if (skipThumbnail && cachedDuration) {
    return { thumbnail: null, duration: cachedDuration };
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.style.display = 'none';
    video.preload = 'metadata';
    video.src = `file:///${videoPath.replace(/\\/g, '/')}`;

    let settled = false;
    const finish = (result: { thumbnail: string | null; duration: number }) => {
      if (settled) return;
      settled = true;
      video.src = '';
      video.load();
      if (result.duration > 0) setCachedDuration(videoPath, result.duration);
      resolve(result);
    };

    const timeout = window.setTimeout(() => {
      finish({ thumbnail: null, duration: cachedDuration ?? 0 });
    }, THUMB_TIMEOUT_MS);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const duration = video.duration || cachedDuration || 0;

      if (skipThumbnail) {
        finish({ thumbnail: null, duration });
        return;
      }

      if (video.duration) {
        video.currentTime = Math.min(5, video.duration * 0.1);
      } else {
        finish({ thumbnail: null, duration: 0 });
      }
    };

    video.onseeked = () => {
      try {
        const scale = video.videoWidth > MAX_THUMB_WIDTH ? MAX_THUMB_WIDTH / video.videoWidth : 1;
        const w = Math.max(1, Math.round(video.videoWidth * scale));
        const h = Math.max(1, Math.round(video.videoHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          finish({ thumbnail: canvas.toDataURL('image/jpeg', 0.55), duration: video.duration || 0 });
        } else {
          finish({ thumbnail: null, duration: video.duration || 0 });
        }
      } catch {
        finish({ thumbnail: null, duration: video.duration || 0 });
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      finish({ thumbnail: null, duration: cachedDuration ?? 0 });
    };
  });
}
