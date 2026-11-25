import { geoArea, geoCentroid, geoGraticule, geoPath } from 'd3-geo';
import { geoMiller } from 'd3-geo-projection';
import type { Polygon, MultiPolygon } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { getMapEntityId } from '../data/map';
import type { SetDefinition } from '../data/schema';
import { worldWidth, wrapWorldX } from './viewport';

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
  if (config.projection !== 'miller') {
    throw new Error(`Unsupported map projection: ${config.projection}`);
  }
  const source = topology.objects[config.object];
  if (!source) throw new Error(`Missing map object: ${config.object}`);

  // Clip the background and all country paths at the same latitude south of Cape Horn.
  const projection = geoMiller().scale(worldWidth / (2 * Math.PI)).translate([worldWidth / 2, 0]);
  const [, north] = projection([0, 85])!;
  const [, south] = projection([0, -60])!;
  const height = south - north;
  projection.translate([worldWidth / 2, -north]).clipExtent([[0, 0], [worldWidth, height]]);
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
    // Measure around the country itself so a polygon split at 180° still has local bounds.
    const [longitude] = geoCentroid(main);
    const [referenceX] = projection([longitude, 0])!;
    const localPath = geoPath(geoMiller().scale(projection.scale())
      .rotate([-longitude, 0]).translate([referenceX, -north])
      .clipExtent([[referenceX - worldWidth / 2, 0], [referenceX + worldWidth / 2, height]]));
    const [[left, top], [right, bottom]] = localPath.bounds(geometry);
    const midpoint = (left + right) / 2;
    const offset = wrapWorldX(midpoint) - midpoint;
    let marker: Point | null = null;
    if (areaKm2 < smallCountryAreaKm2) {
      const [x, y] = localPath.centroid(main);
      marker = [wrapWorldX(x), y];
    }
    countries.push({
      id: getMapEntityId(country, config.idProperty),
      path: outline,
      bounds: [[left + offset, top], [right + offset, bottom]],
      marker,
    });
  }

  return {
    height,
    grid: path(geoGraticule().step([30, 20])()) ?? '',
    land: topology.objects.land ? path(feature(topology, topology.objects.land)) : null,
    countries,
  };
}

export function countryCenter([[left, top], [right, bottom]]: ProjectedCountry['bounds']): Point {
  return [(left + right) / 2, (top + bottom) / 2];
}
