import { geoBounds, geoDistance, geoPath } from 'd3-geo';
import { geoMiller } from 'd3-geo-projection';
import type { Topology } from 'topojson-specification';
import { CORE_OUTLINE_OBJECT, getMapEntityId, polygonFeatures } from '../data/map';
import type { Coordinate } from '../data/map';
import type { SetDefinition } from '../data/schema';

export const CAPITAL_TOLERANCE_RATIO = .1;
export const CAPITAL_TOLERANCE_MIN_KM = 25;
export const CAPITAL_TOLERANCE_MAX_KM = 150;
export const CAPITAL_MAP_PADDING = .15;
export const MIN_CAPITAL_VIEW_SPAN_DEG = 12;
export const COUNTRY_SILHOUETTE_PADDING = .08;
const earthRadiusKm = 6371;

type Bounds = [Coordinate, Coordinate];

function longitudeSpan(west: number, east: number) {
  return east >= west ? east - west : east + 360 - west;
}

function midpointLongitude([[west], [east]]: Bounds) {
  return west + longitudeSpan(west, east) / 2;
}

export function assessCapital(guess: Coordinate, answer: Coordinate, [[west, south], [east, north]]: Bounds) {
  const across = west + Math.min(180, longitudeSpan(west, east));
  const diagonalKm = geoDistance([west, south], [across, north]) * earthRadiusKm;
  const toleranceKm = Math.max(CAPITAL_TOLERANCE_MIN_KM,
    Math.min(CAPITAL_TOLERANCE_MAX_KM, diagonalKm * CAPITAL_TOLERANCE_RATIO));
  const distanceKm = geoDistance(guess, answer) * earthRadiusKm;
  return { correct: distanceKm <= toleranceKm, distanceKm, toleranceKm };
}

export function createCountryMaps(topology: Topology, config: SetDefinition['map']) {
  const index = (key: string) => new Map(polygonFeatures(topology, key)
    .map((item) => [getMapEntityId(item, config.idProperty), item]));
  const countries = index(config.object);
  const core = index(CORE_OUTLINE_OBJECT);
  const land = polygonFeatures(topology, 'land');

  function get(id: string, mode: 'outline' | 'capital' = 'outline') {
    const country = countries.get(id);
    if (!country) return;
    const footprint = core.get(id) ?? country;
    const bounds = geoBounds(footprint);
    const projection = geoMiller().precision(0).rotate([-midpointLongitude(bounds), 0]).fitSize([1000, 1000], footprint);
    const path = geoPath(projection);
    const [[left, top], [right, bottom]] = path.bounds(footprint);
    const width = right - left;
    const height = bottom - top;
    const padding = mode === 'capital' ? CAPITAL_MAP_PADDING : COUNTRY_SILHOUETTE_PADDING;
    const minWidth = mode === 'capital' ? projection.scale() * MIN_CAPITAL_VIEW_SPAN_DEG * Math.PI / 180 : 0;
    const fitWidth = Math.max(width / (1 - 2 * padding), minWidth);
    const fitHeight = height / (1 - 2 * padding);
    const view: [number, number, number, number] = [(left + right - fitWidth) / 2,
      (top + bottom - fitHeight) / 2, fitWidth, fitHeight];
    const [x] = projection.translate();
    const halfWorld = projection.scale() * Math.PI;
    const north = projection([midpointLongitude(bounds), 85])![1];
    const south = projection([midpointLongitude(bounds), -60])![1];
    const world: Bounds = [[x - halfWorld, Math.min(north, view[1])], [x + halfWorld, Math.max(south, view[1] + fitHeight)]];
    return {
      view, bounds, world, aspect: width / height, outline: path(mode === 'capital' ? country : footprint) ?? '',
      project: (point: Coordinate) => projection(point)!,
      invert: (point: Coordinate) => projection.invert!(point)!,
      context: mode === 'capital' ? [...land, ...countries.values()].flatMap((other) => other === country ? [] : path(other) ?? []) : [],
    };
  }

  return { get };
}

export type CountryMap = NonNullable<ReturnType<ReturnType<typeof createCountryMaps>['get']>>;
