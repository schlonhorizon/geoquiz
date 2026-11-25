import { expect, it } from 'vitest';
import { MIN_VIEW_SPAN_DEG, fitCountryBounds, flightDuration, interpolateFlight, worldWidth } from './viewport';

it('frames both countries using their neighboring world copies across the antimeridian', () => {
  const frame = { top: 150, bottom: 430 };
  const view = fitCountryBounds([
    [[930, 70], [950, 110]],
    [[5, 170], [35, 195]],
  ], 390, frame, 9.75);

  expect(view.center).toEqual([962.5, 132.5]);
  expect(view.scale).toBeCloseTo((frame.bottom - frame.top) * 0.70 / 125);
});

it('keeps at least 50 degrees of the region visible around a tiny country', () => {
  const width = 390;
  const view = fitCountryBounds([[[410, 320], [410.01, 320.02]]], width, { top: 160, bottom: 440 }, 9.75);
  expect(360 * width / (view.scale * worldWidth)).toBeCloseTo(MIN_VIEW_SPAN_DEG);
});

it('gives the complete country 15 percent of padding on each limiting side, even in a narrow band', () => {
  const height = 92;
  const view = fitCountryBounds([[[532, 21], [987, 196]]], 1440, { top: 460, bottom: 460 + height }, 36);
  expect((196 - 21) * view.scale).toBeCloseTo(height * 0.70);
  const wide = fitCountryBounds([[[532, 21], [987, 196]]], 1440, { top: 0, bottom: 800 }, 36);
  expect((987 - 532) * wide.scale).toBeCloseTo(1440 * 0.70);
});

it('flies by zooming out then back in over a bounded duration and holds scale for a pan', () => {
  const flight = interpolateFlight([60, 40, 120], [180, 80, 130], 150);
  expect(flight(0)).toEqual([60, 40, 120]);
  expect(flight(.45)[2]).toBe(150);
  expect(flight(1)).toEqual([180, 80, 130]);
  const pan = interpolateFlight([60, 40, 120], [80, 60, 120], undefined);
  expect(pan(.5)).toEqual([70, 50, 120]);
  expect(flightDuration(0)).toBe(700);
  expect(flightDuration(160)).toBe(1050);
  expect(flightDuration(900)).toBe(1400);
});
