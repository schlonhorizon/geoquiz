import { geoArea, geoEqualEarth, geoPath } from 'd3-geo';
import type { Polygon, MultiPolygon } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { getMapEntityId } from '../data/map';
import type { SetDefinition } from '../data/schema';

export const worldWidth = 960;
export const worldHeight = 510;
export const maxZoom = 24;

const earthRadiusKm = 6371;
const smallCountryAreaKm2 = 2_000;

type Point = [number, number];

export interface ProjectedCountry {
  id: string | undefined;
  path: string;
  bounds: [Point, Point];
  marker: Point | null;
}

function largestPolygon(geometry: Polygon | MultiPolygon): Polygon {
  if (geometry.type === 'Polygon') return geometry;

  const [first, ...remaining] = geometry.coordinates;
  let main: Polygon = { type: 'Polygon', coordinates: first ?? [] };
  let largest = geoArea(main);
  for (const coordinates of remaining) {
    const polygon: Polygon = { type: 'Polygon', coordinates };
    const area = geoArea(polygon);
    if (area > largest) {
      largest = area;
      main = polygon;
    }
  }
  return main;
}

export function projectWorldMap(topology: Topology, config: SetDefinition['map']) {
  if (config.projection !== 'equalEarth') {
    throw new Error(`Unsupported map projection: ${config.projection}`);
  }
  const source = topology.objects[config.object];
  if (!source) throw new Error(`Missing map object: ${config.object}`);

  const sphere = { type: 'Sphere' } as const;
  const projection = geoEqualEarth().fitExtent([[12, 12], [worldWidth - 12, worldHeight - 12]], sphere);
  const path = geoPath(projection);
  const converted = feature(topology, source);
  const features = converted.type === 'FeatureCollection' ? converted.features : [converted];
  const countries: ProjectedCountry[] = [];

  for (const country of features) {
    const { geometry } = country;
    if (geometry?.type !== 'Polygon' && geometry?.type !== 'MultiPolygon') continue;
    const outline = path(geometry);
    if (!outline) continue;

    const main = largestPolygon(geometry);
    const areaKm2 = geoArea(geometry) * earthRadiusKm ** 2;
    countries.push({
      id: getMapEntityId(country, config.idProperty),
      path: outline,
      bounds: path.bounds(main),
      marker: areaKm2 < smallCountryAreaKm2 ? path.centroid(main) : null,
    });
  }

  return {
    ocean: path(sphere) ?? '',
    land: topology.objects.land ? path(feature(topology, topology.objects.land)) : null,
    countries,
  };
}

export function getCountryFocus([[left, top], [right, bottom]]: ProjectedCountry['bounds']) {
  const scale = Math.min((worldWidth * 0.64) / (right - left), (worldHeight * 0.64) / (bottom - top));
  return {
    center: [(left + right) / 2, (top + bottom) / 2] as Point,
    scale: Math.min(maxZoom, Math.max(1.3, scale)),
  };
}
