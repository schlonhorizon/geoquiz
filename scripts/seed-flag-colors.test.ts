import { expect, it } from 'vitest';
import { dominantFlagColor } from './seed-flag-colors';

it('selects the largest non-white visible area in a flag', () => {
  const pixels = Uint8Array.from([
    255, 255, 255, 255,
    230, 236, 229, 255,
    230, 236, 229, 255,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 71, 255, 255,
    0, 71, 255, 255,
    227, 0, 15, 255,
  ]);
  expect(dominantFlagColor(pixels)).toBe('#0047FF');
});

it('can select saturated yellow and leaves a white flag without a candidate', () => {
  expect(dominantFlagColor(Uint8Array.from([255, 224, 0, 255]))).toBe('#FFE000');
  expect(dominantFlagColor(Uint8Array.from([255, 255, 255, 255]))).toBeUndefined();
});
