export const worldWidth = 960;
export const MIN_VIEW_SPAN_DEG = 50;
const countryMargin = 0.15;

export function wrapWorldX(x: number): number {
  return ((x % worldWidth) + worldWidth) % worldWidth;
}

export function nearestWorldX(x: number, reference: number): number {
  return x + worldWidth * Math.round((reference - x) / worldWidth);
}

export function clampMapY(y: number, scaledHeight: number, viewportHeight: number): number {
  const verticalSpace = viewportHeight - scaledHeight;
  return verticalSpace >= 0 ? verticalSpace / 2 : Math.max(verticalSpace, Math.min(0, y));
}

export type Bounds = [[number, number], [number, number]];

export interface MapFrame {
  top: number;
  bottom: number;
}

export function insetCountryFrame({ top, bottom }: MapFrame): MapFrame {
  const margin = (bottom - top) * countryMargin;
  return { top: top + margin, bottom: bottom - margin };
}

export function fitCountryBounds(countries: readonly Bounds[], width: number, frame: MapFrame, maximum: number) {
  const [[firstLeft], [firstRight]] = countries[0];
  const reference = (firstLeft + firstRight) / 2;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const [[x0, y0], [x1, y1]] of countries) {
    const center = (x0 + x1) / 2;
    const offset = nearestWorldX(center, reference) - center;
    left = Math.min(left, x0 + offset);
    right = Math.max(right, x1 + offset);
    top = Math.min(top, y0);
    bottom = Math.max(bottom, y1);
  }
  const band = insetCountryFrame(frame);
  const regionSpan = worldWidth * MIN_VIEW_SPAN_DEG / 360;
  const scale = Math.min(width / regionSpan, width * (1 - 2 * countryMargin) / (right - left),
    (band.bottom - band.top) / (bottom - top), maximum);
  return {
    center: [(left + right) / 2, (top + bottom) / 2] as [number, number],
    scale,
    bounds: [[left, top], [right, bottom]] as Bounds,
  };
}

type ZoomView = [number, number, number];

export function flightDuration(distance: number) {
  return 700 + 700 * Math.min(1, distance / (worldWidth / 3));
}

export function interpolateFlight(from: ZoomView, to: ZoomView, peakSpan: number | undefined) {
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (t: number): ZoomView => {
    const apex = 0.45;
    const span = peakSpan === undefined ? mix(from[2], to[2], t)
      : t < apex ? mix(from[2], peakSpan, smooth(t / apex))
        : mix(peakSpan, to[2], smooth((t - apex) / (1 - apex)));
    return [mix(from[0], to[0], t), mix(from[1], to[1], t), span];
  };
}
