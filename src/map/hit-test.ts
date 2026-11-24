export const markerRadiusPx = 5;
export const markerHitRadiusPx = 16;
export const boundaryTolerancePx = 6;

export function isNearMarker(x: number, y: number, marker: [number, number], pixelsPerUnit: number): boolean {
  return Math.hypot(x - marker[0], y - marker[1]) * pixelsPerUnit <= markerHitRadiusPx + boundaryTolerancePx;
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
