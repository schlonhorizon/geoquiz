import { geoArea, geoGraticule, geoPath } from 'd3-geo';
import type { Geometry, Polygon, Position } from 'geojson';
import { feature, transform } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { worldProjection } from '../../src/map/geometry';
import type { SetDefinition } from '../../src/data/schema';
import type { TerrainShape, TerrainTier } from '../../src/map/world-raster-types';
import { DETAIL_RENDER_ZOOMS } from '../../src/map/world-raster-types';
import { worldWidth } from '../../src/map/viewport';

// Projected error budgets shrink with the magnification of the next tier.
const detailTolerance = [.05, .025, .012, 0];
const overviewTolerance = .15;

function squaredDistance([x, y]: Position, [left, top]: Position, [right, bottom]: Position) {
  const dx = right - left, dy = bottom - top;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((x - left) * dx + (y - top) * dy) / length)) : 0;
  return (x - left - t * dx) ** 2 + (y - top - t * dy) ** 2;
}

function simplifyArc(arc: Position[], projected: Position[], tolerance: number) {
  if (!tolerance || arc.length <= 2) return arc;
  // Preserve arcs that cross the antimeridian. They are split by the map projection.
  if (projected.some(([x], i) => i > 0 && Math.abs(x - projected[i - 1][0]) > worldWidth / 2)) return arc;
  const keep = new Set([0, arc.length - 1]);
  const segments = [[0, arc.length - 1]];
  const squareTolerance = tolerance ** 2;
  while (segments.length) {
    const [left, right] = segments.pop()!;
    let furthest = -1;
    let maxDistance = squareTolerance;
    for (let i = left + 1; i < right; i++) {
      const distance = squaredDistance(projected[i], projected[left], projected[right]);
      if (distance <= maxDistance) continue;
      maxDistance = distance;
      furthest = i;
    }
    if (furthest >= 0) {
      keep.add(furthest);
      segments.push([left, furthest], [furthest, right]);
    }
  }
  return arc.filter((_, i) => keep.has(i));
}

function prepareArcs(source: Topology, projection: ReturnType<typeof worldProjection>['projection']) {
  const decode = source.transform ? transform(source.transform) : undefined;
  const arcs = source.arcs.map(arc => decode ? arc.map((point, i) => decode(point, i > 0)) : arc);
  const projected = arcs.map(arc => arc.map(([lon, lat]) => projection([lon, lat])!));
  return (tolerance: number): Topology => ({
    ...source, transform: undefined,
    arcs: arcs.map((arc, i) => simplifyArc(arc, projected[i], tolerance)),
  });
}

function features(topology: Topology, key: string) {
  const object = topology.objects[key];
  if (!object) return [];
  const result = feature(topology, object);
  return result.type === 'FeatureCollection' ? result.features : [result];
}

export function buildRenderLevels(
  map: SetDefinition['map'], mapJson: string, waterJson: string | undefined, detailed: boolean,
): TerrainTier[] {
  const source: Topology = JSON.parse(mapJson);
  const water: Topology | undefined = waterJson ? JSON.parse(waterJson) : undefined;
  const { projection } = worldProjection(map);
  const path = geoPath(projection).digits(2);
  const simplify = prepareArcs(source, projection);
  const simplifyWater = water ? prepareArcs(water, projection) : undefined;
  const zooms = detailed ? DETAIL_RENDER_ZOOMS : [0];
  return zooms.map((minZoom, index) => {
    const tolerance = detailed ? detailTolerance[index] : overviewTolerance;
    const stage = simplify(tolerance);
    const waterSource = water ?? source;
    const wet = simplifyWater?.(tolerance) ?? stage;
    const shapes: TerrainShape[] = [];
    function append(geometry: Geometry, name: string) {
      const d = path(geometry);
      const bounds = path.bounds(geometry);
      if (d && bounds.flat().every(Number.isFinite)) shapes.push({ name, d, bounds });
    }
    function add(data: Topology, original: Topology, key: string, name: string) {
      const originals = features(original, key);
      features(data, key).forEach(({ geometry }, index) => {
        const backup = originals[index]?.geometry;
        if (!geometry) return;
        if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
          const parts = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
          const originalParts = backup?.type === 'Polygon' ? [backup.coordinates]
            : backup?.type === 'MultiPolygon' ? backup.coordinates : [];
          parts.forEach((coordinates, part) => {
            const polygon: Polygon = { type: 'Polygon', coordinates };
            const area = geoArea(polygon);
            if (area > 0 && area < 2 * Math.PI) append(polygon, name);
            else if (originalParts[part]) {
              const fallback: Polygon = { type: 'Polygon', coordinates: originalParts[part] };
              // Keep tiny playable islands whose simplified rings collapse.
              if (name === 'map-country' || area >= 2 * Math.PI) append(fallback, name);
            }
          });
        } else if (geometry.type === 'MultiLineString') {
          for (const coordinates of geometry.coordinates) append({ type: 'LineString', coordinates }, name);
        } else append(geometry, name);
      });
    }
    const grid = geoGraticule().step([30, 20])();
    for (const coordinates of grid.coordinates) append({ type: 'LineString', coordinates }, 'map-grid');
    add(stage, source, 'land', 'map-land');
    add(stage, source, map.object, 'map-country');
    add(wet, waterSource, 'rivers', 'map-river');
    add(wet, waterSource, 'minorRivers', 'map-river-minor');
    add(wet, waterSource, 'lakes', 'map-lake');
    return { minZoom, shapes };
  });
}
