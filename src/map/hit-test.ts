import { nearestWorldX } from './viewport';

export const markerRadiusPx = 5;
export const markerHitRadiusPx = 16;
export const boundaryTolerancePx = 6;

export function markerDistance(x: number, y: number, marker: [number, number], pixelsPerUnit: number): number {
  return Math.hypot(nearestWorldX(x, marker[0]) - marker[0], y - marker[1]) * pixelsPerUnit;
}

export function isNearMarker(x: number, y: number, marker: [number, number], pixelsPerUnit: number): boolean {
  return markerDistance(x, y, marker, pixelsPerUnit) <= markerHitRadiusPx + boundaryTolerancePx;
}

export function resolveCountryClick(
  clickedId: string | undefined,
  clickedMarker: boolean,
  targetId: string,
  targetHasMarker: boolean,
  isNearTarget: () => boolean,
): string | undefined {
  if (clickedId === targetId || clickedMarker) return clickedId;
  // A small country can sit inside another country's clickable polygon.
  if ((!clickedId || targetHasMarker) && isNearTarget()) return targetId;
  return clickedId;
}
