import { worldWidth } from './geometry';

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
