import { expect, it } from 'vitest';
import { fitCountryBounds } from './viewport';

it('frames both countries using their neighboring world copies across the antimeridian', () => {
  const frame = { top: 150, bottom: 430 };
  const view = fitCountryBounds([
    [[930, 70], [950, 110]],
    [[5, 170], [35, 195]],
  ], 390, frame, 9.75);

  expect(view.center).toEqual([962.5, 132.5]);
  expect(view.scale).toBeCloseTo((frame.bottom - frame.top) * 0.76 / 125);
});

it('uses the zoom limit for a tiny country rather than zooming past it', () => {
  const view = fitCountryBounds([[[410, 320], [410.01, 320.02]]], 390, { top: 160, bottom: 440 }, 9.75);
  expect(view.scale).toBe(9.75);
});
