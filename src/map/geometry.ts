import { geoArea, geoCentroid, geoGraticule, geoPath } from 'd3-geo';
import { geoMiller } from 'd3-geo-projection';
import type { Polygon, MultiPolygon } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { CORE_OUTLINE_OBJECT, getMapEntityId, polygonFeatures } from '../data/map';
import type { SetDefinition } from '../data/schema';
import { worldWidth, wrapWorldX } from './viewport';
import { projectWater } from './water';

const earthRadiusKm = 6371;
const smallCountryAreaKm2 = 2_000;

type Point = [number, number];

export interface ProjectedCountry {
  id: string | undefined;
  path: string;
  bounds: [Point, Point];
  outlineBounds: [Point, Point];
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

export function worldProjection(config: SetDefinition['map']) {
  if (config.projection !== 'miller') {
    throw new Error(`Unsupported map projection: ${config.projection}`);
  }
  // Clip the background and all country paths at the same latitude south of Cape Horn.
  const projection = geoMiller().precision(0).scale(worldWidth / (2 * Math.PI)).translate([worldWidth / 2, 0]);
  const [, north] = projection([0, 85])!;
  const [, south] = projection([0, -60])!;
  const height = south - north;
  projection.translate([worldWidth / 2, -north]).clipExtent([[0, 0], [worldWidth, height]]);
  return { projection, north, height };
}

export function projectMapDetails(topology: Topology, config: SetDefinition['map']) {
  const path = geoPath(worldProjection(config).projection);
  const project = (key: string) => polygonFeatures(topology, key).flatMap((country) => {
    const d = path(country);
    return d ? [{ id: getMapEntityId(country, config.idProperty), d, bounds: path.bounds(country) }] : [];
  });
  return {
    land: project('land'),
    countries: new Map(project(config.object).map((country) => [country.id, country])),
    water: projectWater(topology, path, true),
  };
}

export function projectWorldMap(topology: Topology, config: SetDefinition['map'], water?: Topology) {
  if (!topology.objects[config.object]) throw new Error(`Missing map object: ${config.object}`);
  const { projection, north, height } = worldProjection(config);
  const path = geoPath(projection);
  const core = new Map(polygonFeatures(topology, CORE_OUTLINE_OBJECT)
    .map((item) => [getMapEntityId(item, config.idProperty), item.geometry]));
  const countries: ProjectedCountry[] = [];

  for (const country of polygonFeatures(topology, config.object)) {
    const { geometry } = country;
    const outline = path(geometry);
    if (!outline) continue;

    const id = getMapEntityId(country, config.idProperty);
    const footprint = core.get(id) ?? geometry;
    const main = largestPolygon(footprint);
    const areaKm2 = geoArea(geometry) * earthRadiusKm ** 2;
    // Measure around the country itself so a polygon split at 180° still has local bounds.
    const [longitude] = geoCentroid(main);
    const [referenceX] = projection([longitude, 0])!;
    const localPath = geoPath(geoMiller().precision(0).scale(projection.scale())
      .rotate([-longitude, 0]).translate([referenceX, -north])
      .clipExtent([[referenceX - worldWidth / 2, 0], [referenceX + worldWidth / 2, height]]));
    const [[left, top], [right, bottom]] = localPath.bounds(footprint);
    const midpoint = (left + right) / 2;
    const offset = wrapWorldX(midpoint) - midpoint;
    let marker: Point | null = null;
    if (areaKm2 < smallCountryAreaKm2) {
      const [x, y] = localPath.centroid(main);
      marker = [wrapWorldX(x), y];
    }
    countries.push({
      id,
      path: outline,
      bounds: [[left + offset, top], [right + offset, bottom]],
      outlineBounds: path.bounds(geometry),
      marker,
    });
  }

  return {
    height,
    grid: path(geoGraticule().step([30, 20])()) ?? '',
    land: topology.objects.land ? path(feature(topology, topology.objects.land)) : null,
    water: projectWater(water, path),
    countries,
    project: projection,
  };
}

export function countryCenter([[left, top], [right, bottom]]: ProjectedCountry['bounds']): Point {
  return [(left + right) / 2, (top + bottom) / 2];
}
