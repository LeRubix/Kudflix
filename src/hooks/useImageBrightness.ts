import { useState, useEffect } from 'react';

export type BrightnessRegion = 'top' | 'bottom';

/** Returns whether the sampled strip of an image is light (use dark text) or dark (use light text). */
export function useImageBrightness(
  src: string | undefined,
  region: BrightnessRegion = 'bottom',
): 'light' | 'dark' {
  const [brightness, setBrightness] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (!src) {
      setBrightness('dark');
      return;
    }

    let cancelled = false;
    const img = new Image();

    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const sampleH = Math.max(1, Math.min(56, img.height));
        const sampleW = Math.max(1, Math.min(img.width, 320));
        canvas.width = sampleW;
        canvas.height = sampleH;

        const srcY = region === 'top' ? 0 : Math.max(0, img.height - sampleH);
        ctx.drawImage(img, 0, srcY, img.width, sampleH, 0, 0, sampleW, sampleH);

        const { data } = ctx.getImageData(0, 0, sampleW, sampleH);
        let total = 0;
        const pixels = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        setBrightness(total / pixels > 140 ? 'light' : 'dark');
      } catch {
        setBrightness('dark');
      }
    };

    img.onerror = () => {
      if (!cancelled) setBrightness('dark');
    };

    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, region]);

  return brightness;
}
