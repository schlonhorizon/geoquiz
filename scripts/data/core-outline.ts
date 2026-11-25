import { geoArea, geoContains } from 'd3-geo';
import type { Polygon as GeoPolygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, MultiPolygon, Polygon, Topology } from 'topojson-specification';
import { CORE_OUTLINE_OBJECT, getMapEntityId } from '../../src/data/map';
import type { SetDefinition } from '../../src/data/schema';
import type { DataIssues } from './issues';

export const CORE_DISTANCE_KM = 1500;
export const CORE_AREA_RATIO = .2;
const angle = CORE_DISTANCE_KM / 6371;
const minDot = Math.cos(angle);
const maxCross = Math.sin(angle);
type Vector = [number, number, number];

function unit([longitude, latitude]: number[]): Vector {
  const lon = longitude * Math.PI / 180;
  const lat = latitude * Math.PI / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

function dot([x, y, z]: Vector, [a, b, c]: Vector) {
  return x * a + y * b + z * c;
}

function cross([x, y, z]: Vector, [a, b, c]: Vector): Vector {
  return [y * c - z * b, z * a - x * c, x * b - y * a];
}

function boundary(polygon: GeoPolygon) {
  // The outer ring determines the distance between disjoint exterior parts.
  const vertices = polygon.coordinates[0].map(unit);
  const edges = vertices.slice(1).flatMap((end, index) => {
    const start = vertices[index];
    const normal = cross(start, end);
    const length = Math.hypot(...normal);
    if (length < 1e-12) return [];
    const axis: Vector = [normal[0] / length, normal[1] / length, normal[2] / length];
    return [{ start, end, axis, startTangent: cross(axis, start), endTangent: cross(end, axis) }];
  });
  return { vertices, edges };
}

function reaches(vertices: Vector[], edges: ReturnType<typeof boundary>['edges']) {
  return vertices.some((point) => edges.some(({ start, end, axis, startTangent, endTangent }) =>
    dot(point, start) >= minDot || dot(point, end) >= minDot
    || (Math.abs(dot(point, axis)) <= maxCross && dot(point, startTangent) >= 0 && dot(point, endTangent) >= 0)));
}

export function addCoreOutlines(content: string, { map, outline }: SetDefinition, issues: DataIssues) {
  const topology: Topology = JSON.parse(content);
  const source = topology.objects[map.object];
  const countries = source.type === 'GeometryCollection' ? source.geometries : [source];
  const core: GeometryCollection = { type: 'GeometryCollection', geometries: [] };
  const excluded = new Map<string, number[]>();
  const ids = new Set(countries.map((country) => getMapEntityId(country, map.idProperty)));
  for (const key of ['include', 'exclude'] as const) {
    for (const id of Object.keys(outline?.[key] ?? {})) {
      if (!ids.has(id)) issues.errors.push(`outline.${key}: Unbekannte Geometrie "${id}".`);
    }
  }

  for (const country of countries) {
    const id = getMapEntityId(country, map.idProperty);
    if (!id || (country.type !== 'Polygon' && country.type !== 'MultiPolygon')) continue;
    const decoded = feature(topology, country);
    if (decoded.type !== 'Feature' || (decoded.geometry.type !== 'Polygon' && decoded.geometry.type !== 'MultiPolygon')) continue;
    const { geometry } = decoded;
    const pieces: GeoPolygon[] = geometry.type === 'Polygon' ? [geometry]
      : geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));
    const areas = pieces.map((polygon) => geoArea(polygon));
    const largest = areas.indexOf(Math.max(...areas));
    const selected = (key: 'include' | 'exclude') => new Set((outline?.[key]?.[id] ?? []).flatMap((point) => {
      const matches = pieces.flatMap((piece, index) => geoContains(piece, point) ? [index] : []);
      if (matches.length === 1) return matches;
      issues.errors.push(`outline.${key} (${id}): Punkt ${point.join(', ')} muss genau in einer Teilfläche liegen.`);
      return [];
    }));
    const include = selected('include');
    const exclude = selected('exclude');
    for (const index of include) {
      if (exclude.has(index)) issues.errors.push(`outline (${id}): Teilfläche ${index + 1} steht in include und exclude.`);
    }

    if (pieces.length === 1 && !exclude.size) continue;
    const main = boundary(pieces[largest]);
    const removed: number[] = [];
    const kept = pieces.flatMap((piece, index) => {
      let omit = exclude.has(index);
      if (!omit && !include.has(index) && areas[index] < areas[largest] * CORE_AREA_RATIO) {
        const part = boundary(piece);
        omit = !reaches(part.vertices, main.edges) && !reaches(main.vertices, part.edges);
      }
      if (!omit) return [index];
      removed.push(index + 1);
      return [];
    });
    if (!removed.length) continue;
    if (!kept.length) {
      issues.errors.push(`outline (${id}): Das Kerngebiet darf nicht leer sein.`);
      continue;
    }

    const arcs = country.type === 'MultiPolygon' ? kept.map((index) => country.arcs[index]) : [country.arcs];
    const properties = country.properties ?? undefined;
    const shape: Polygon | MultiPolygon = arcs.length === 1
      ? { type: 'Polygon', id: country.id, properties, arcs: arcs[0] }
      : { type: 'MultiPolygon', id: country.id, properties, arcs };
    core.geometries.push(shape);
    excluded.set(id, removed);
  }
  topology.objects[CORE_OUTLINE_OBJECT] = core;
  return { mapJson: JSON.stringify(topology) + '\n', excluded };
}
