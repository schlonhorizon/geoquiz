export const worldWidth = 960;

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

type Bounds = [[number, number], [number, number]];

export interface MapFrame {
  top: number;
  bottom: number;
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
  const height = frame.bottom - frame.top;
  const fit = Math.min(width * 0.76 / (right - left), height * 0.76 / (bottom - top), maximum);
  return {
    center: [(left + right) / 2, (top + bottom) / 2] as [number, number],
    scale: Math.max(width / (2 * worldWidth), fit),
  };
}
