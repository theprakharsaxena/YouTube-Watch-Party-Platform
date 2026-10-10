import { useEffect, useRef, useState } from 'react';

// In-memory cache for extracted colors by `${videoId}:${frame}`
const colorCache = new Map();

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    let val = t;
    if (val < 0) val += 1;
    if (val > 1) val -= 1;
    if (val < 1 / 6) return p + (q - p) * 6 * val;
    if (val < 1 / 2) return q;
    if (val < 2 / 3) return p + (q - p) * (2 / 3 - val) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}

export function enhanceColor(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  const boostedS = s > 0.05 ? Math.min(1, s * 1.35) : s;
  const clampedL = Math.max(0.28, Math.min(0.66, l));
  return hslToRgb(h, boostedS, clampedL);
}

/**
 * Samples 16x9 grid from image and extracts quadrant & center colors
 */
export function extractColorsFromImage(img) {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 9;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, 16, 9);
    const imgData = ctx.getImageData(0, 0, 16, 9);
    const { data } = imgData;

    const sampleRect = (x0, y0, x1, y1) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * 16 + x) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
      }
      if (count === 0) return [120, 120, 120];
      return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
    };

    const tl = enhanceColor(...sampleRect(0, 0, 8, 4));
    const tr = enhanceColor(...sampleRect(8, 0, 16, 4));
    const bl = enhanceColor(...sampleRect(0, 5, 8, 9));
    const br = enhanceColor(...sampleRect(8, 5, 16, 9));
    const c = enhanceColor(...sampleRect(4, 2, 12, 7));

    return {
      tl: `rgb(${tl[0]}, ${tl[1]}, ${tl[2]})`,
      tr: `rgb(${tr[0]}, ${tr[1]}, ${tr[2]})`,
      bl: `rgb(${bl[0]}, ${bl[1]}, ${bl[2]})`,
      br: `rgb(${br[0]}, ${br[1]}, ${br[2]})`,
      c: `rgb(${c[0]}, ${c[1]}, ${c[2]})`,
    };
  } catch {
    return null;
  }
}

function getInitialColors(videoId) {
  if (!videoId) {
    return {
      tl: 'transparent',
      tr: 'transparent',
      bl: 'transparent',
      br: 'transparent',
      c: 'transparent',
    };
  }
  return {
    tl: 'rgba(255, 255, 255, 0.08)',
    tr: 'rgba(255, 255, 255, 0.08)',
    bl: 'rgba(255, 255, 255, 0.08)',
    br: 'rgba(255, 255, 255, 0.08)',
    c: 'rgba(255, 255, 255, 0.1)',
  };
}

/**
 * Hook to dynamically load video frame and extract real video colors.
 */
export default function useAmbientLighting({ videoId, position = 0, duration = 0, enabled = true }) {
  const [colors, setColors] = useState(() => getInitialColors(videoId));
  const [imageUrl, setImageUrl] = useState(() =>
    videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null
  );

  // Determine frame snapshot (defaults to mqdefault, or uses storyboard snapshots as video progresses)
  let frame = 'mqdefault';
  if (duration > 15 && position > 0) {
    const fraction = position / duration;
    if (fraction < 0.35) frame = '1';
    else if (fraction < 0.7) frame = '2';
    else frame = '3';
  }

  const targetUrl = videoId
    ? frame === 'mqdefault'
      ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      : `https://img.youtube.com/vi/${videoId}/${frame}.jpg`
    : null;

  useEffect(() => {
    if (!enabled || !videoId || !targetUrl) return;

    setImageUrl(targetUrl);

    const cacheKey = `${videoId}:${frame}`;
    if (colorCache.has(cacheKey)) {
      setColors(colorCache.get(cacheKey));
      return;
    }

    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!active) return;
      const extracted = extractColorsFromImage(img);
      if (extracted) {
        colorCache.set(cacheKey, extracted);
        setColors(extracted);
      }
    };
    img.onerror = () => {
      // If storyboard snapshot fails, fallback to mqdefault
      if (frame !== 'mqdefault') {
        const fallbackUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        const fallbackImg = new Image();
        fallbackImg.crossOrigin = 'anonymous';
        fallbackImg.onload = () => {
          if (!active) return;
          const extracted = extractColorsFromImage(fallbackImg);
          if (extracted) {
            colorCache.set(cacheKey, extracted);
            setColors(extracted);
          }
        };
        fallbackImg.src = fallbackUrl;
      }
    };
    img.src = targetUrl;

    return () => {
      active = false;
    };
  }, [enabled, videoId, frame, targetUrl]);

  const style = {
    '--ambient-tl': colors.tl,
    '--ambient-tr': colors.tr,
    '--ambient-bl': colors.bl,
    '--ambient-br': colors.br,
    '--ambient-c': colors.c,
  };

  return { colors, imageUrl, style };
}
