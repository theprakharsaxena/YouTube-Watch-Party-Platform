import { describe, expect, it } from 'vitest';
import { enhanceColor, extractColorsFromImage } from './useAmbientLighting.js';

describe('useAmbientLighting color utilities', () => {
  it('enhances color saturation while keeping luminance balanced', () => {
    // Pure green (dimmed slightly for subtle ambient glow)
    const green = enhanceColor(0, 180, 0);
    expect(green[1]).toBeGreaterThanOrEqual(130);
    expect(green[0]).toBeLessThanOrEqual(50);
    expect(green[1]).toBeGreaterThan(green[0]);
    expect(green[1]).toBeGreaterThan(green[2]);

    // Deep blue
    const blue = enhanceColor(20, 40, 160);
    expect(blue[2]).toBeGreaterThan(blue[0]);
    expect(blue[2]).toBeGreaterThan(blue[1]);
  });

  it('safely handles environments where canvas is not supported or mock image has no context', () => {
    const fakeImg = {};
    const result = extractColorsFromImage(fakeImg);
    // In node/jsdom without canvas mock or with invalid image, gracefully returns null
    expect(result === null || typeof result === 'object').toBe(true);
  });
});
