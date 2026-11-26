import { geoGraticule, geoPath, geoStream } from 'd3-geo';
import type { GeoStream } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Position, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import type { Topology } from 'topojson-specification';
import { getMapEntityId } from '../../src/data/map';
import type { SetDefinition } from '../../src/data/schema';
import { worldProjection } from '../../src/map/geometry';
import { DETAIL_RENDER_ZOOMS } from '../../src/map/world-raster-types';
import type { TerrainShape, TerrainTier } from '../../src/map/world-raster-types';

// Projected error budgets shrink with the magnification of the next tier.
const detailTolerance = [.05, .025, .012, 0];
const overviewTolerance = .15;
const plane = geoPath().digits(2);

function squaredDistance([x, y]: Position, [left, top]: Position, [right, bottom]: Position) {
  const dx = right - left, dy = bottom - top;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((x - left) * dx + (y - top) * dy) / length)) : 0;
  return (x - left - t * dx) ** 2 + (y - top - t * dy) ** 2;
}

function simplifyArc(arc: Position[], tolerance: number) {
  if (!tolerance || arc.length <= 2) return arc;
  const keep = new Set([0, arc.length - 1]);
  const segments = [[0, arc.length - 1]];
  const squareTolerance = tolerance ** 2;
  while (segments.length) {
    const [left, right] = segments.pop()!;
    let furthest = -1;
    let maxDistance = squareTolerance;
    for (let i = left + 1; i < right; i++) {
      const distance = squaredDistance(arc[i], arc[left], arc[right]);
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

function signedArea(ring: Position[]) {
  // Translate to a local origin to keep the area of tiny rings accurate.
  const [ox, oy] = ring[0];
  let area = 0;
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = ring[i - 1];
    const [nx, ny] = ring[i];
    area += (x - ox) * (ny - oy) - (nx - ox) * (y - oy);
  }
  return area;
}

function projectGeometry(geometry: Geometry, projection: ReturnType<typeof worldProjection>['projection']): Geometry | undefined {
  const polygons: Position[][][] = [];
  const lines: Position[][] = [];
  let rings: Position[][] | undefined;
  let line: Position[];
  // Clip at the world limits before simplifying. No spherical projection follows this step.
  const sink: GeoStream = {
    point(x, y) { line.push([Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]); },
    lineStart() { line = []; },
    lineEnd() {
      if (rings && line.length >= 3) rings.push([...line, line[0]]);
      if (!rings && line.length >= 2) lines.push(line);
    },
    polygonStart() { rings = []; },
    polygonEnd() {
      if (rings?.length) polygons.push(rings);
      rings = undefined;
    },
  };
  geoStream(geometry, projection.stream(sink));
  if (polygons.length) return { type: 'MultiPolygon', coordinates: polygons };
  if (lines.length) return { type: 'MultiLineString', coordinates: lines };
}

function features(source: Topology, key: string) {
  const object = source.objects[key];
  if (!object) return [];
  const result = feature(source, object);
  return result.type === 'FeatureCollection' ? result.features : [result];
}

export function buildRenderLevels(
  map: SetDefinition['map'], mapJson: string, waterJson: string | undefined, detailed: boolean,
): TerrainTier[] {
  const source: Topology = JSON.parse(mapJson);
  const water: Topology = waterJson ? JSON.parse(waterJson) : source;
  const { projection } = worldProjection(map);
  const groups = new Map<string, FeatureCollection>();
  function add(name: string, entries: Feature[]) {
    groups.set(name, { type: 'FeatureCollection', features: entries.flatMap((entry) => {
      if (!entry.geometry) return [];
      const geometry = projectGeometry(entry.geometry, projection);
      const id = name === 'map-country' ? getMapEntityId(entry, map.idProperty) : undefined;
      return geometry ? [{ type: 'Feature', geometry, id, properties: null }] : [];
    }) });
  }
  add('map-grid', [{ type: 'Feature', geometry: geoGraticule().step([30, 20])(), properties: null }]);
  add('map-land', features(source, 'land'));
  add('map-country', features(source, map.object));
  add('map-river', features(water, 'rivers'));
  add('map-river-minor', features(water, 'minorRivers'));
  add('map-lake', features(water, 'lakes'));
  // Rebuild topology in Miller coordinates so adjacent countries simplify their shared edges once.
  const projected = topology(Object.fromEntries(groups));
  const originals = new Map([...groups.keys()].map(name => [name, features(projected, name)]));
  const zooms = detailed ? DETAIL_RENDER_ZOOMS : [0];
  return zooms.map((minZoom, index) => {
    const tolerance = detailed ? detailTolerance[index] : overviewTolerance;
    const stage = { ...projected, arcs: projected.arcs.map(arc => simplifyArc(arc, tolerance)) };
    const shapes: TerrainShape[] = [];
    function append(geometry: Geometry, name: string, id?: string) {
      const d = plane(geometry);
      const bounds = plane.bounds(geometry);
      if (!d || !bounds.flat().every(Number.isFinite)) return;
      const area = id ? plane.area(geometry) : 0;
      shapes.push({ name: name === 'map-country' && !id ? 'map-land' : name, d, bounds, id,
        ...(area > 0 && { area, anchor: plane.centroid(geometry) }) });
    }
    for (const [name, entries] of originals) {
      features(stage, name).forEach(({ geometry, id }, i) => {
        if (!geometry) return;
        if (geometry.type === 'MultiPolygon') {
          const before = entries[i].geometry as typeof geometry;
          geometry.coordinates.forEach((part, j) => {
            const coordinates = part.map((ring, k) => Math.sign(signedArea(ring)) === Math.sign(signedArea(before.coordinates[j][k]))
              ? ring : before.coordinates[j][k]);
            append({ type: 'Polygon', coordinates } satisfies Polygon, name, id === undefined ? undefined : String(id));
          });
        } else if (geometry.type === 'MultiLineString') {
          for (const coordinates of geometry.coordinates) append({ type: 'LineString', coordinates }, name);
        }
      });
    }
    return { minZoom, shapes };
  });
}
