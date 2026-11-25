import { geoBounds, geoDistance, geoPath } from 'd3-geo';
import { geoMiller } from 'd3-geo-projection';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { getMapEntityId } from '../data/map';
import type { Coordinate } from '../data/map';
import type { SetDefinition } from '../data/schema';

export const CAPITAL_TOLERANCE_RATIO = .1;
export const CAPITAL_TOLERANCE_MIN_KM = 25;
export const CAPITAL_TOLERANCE_MAX_KM = 150;
export const COUNTRY_MAP_PADDING = .1;
const earthRadiusKm = 6371;

type Bounds = [Coordinate, Coordinate];
type CountryFeature = Feature<Polygon | MultiPolygon>;

function longitudeSpan(west: number, east: number) {
  return east >= west ? east - west : east + 360 - west;
}

function midpointLongitude([[west], [east]]: Bounds) {
  return west + longitudeSpan(west, east) / 2;
}

function overlapsRegion(region: Bounds, other: Bounds) {
  const [[west, south], [east, north]] = region;
  const [[farWest, farSouth], [farEast, farNorth]] = other;
  const lonWidth = longitudeSpan(west, east);
  const latHeight = north - south;
  const margin = Math.max(lonWidth, latHeight) / 2;
  const longitudesApart = Math.abs((midpointLongitude(region) - midpointLongitude(other) + 540) % 360 - 180);
  return south - margin <= farNorth && north + margin >= farSouth
    && longitudesApart <= (lonWidth + longitudeSpan(farWest, farEast)) / 2 + margin;
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
  const source = topology.objects[config.object];
  const converted = source && feature(topology, source);
  const features = converted?.type === 'FeatureCollection' ? converted.features : converted ? [converted] : [];
  const countries = new Map<string, { shape: CountryFeature; bounds: Bounds }>();
  for (const item of features) {
    const id = getMapEntityId(item, config.idProperty);
    if (id && (item.geometry?.type === 'Polygon' || item.geometry?.type === 'MultiPolygon')) {
      const shape = { ...item, geometry: item.geometry };
      countries.set(id, { shape, bounds: geoBounds(shape) });
    }
  }

  function get(id: string, nearby?: readonly string[]) {
    const country = countries.get(id);
    if (!country) return;
    const { shape, bounds } = country;
    const projection = geoMiller().rotate([-midpointLongitude(bounds), 0]).fitSize([1000, 1000], shape);
    const path = geoPath(projection);
    const [[left, top], [right, bottom]] = path.bounds(shape);
    const width = right - left;
    const height = bottom - top;
    const padding = COUNTRY_MAP_PADDING / (1 - 2 * COUNTRY_MAP_PADDING);
    const view: [number, number, number, number] = [
      left - width * padding, top - height * padding,
      width * (1 + 2 * padding), height * (1 + 2 * padding),
    ];
    return {
      view, bounds, outline: path(shape) ?? '',
      project: (point: Coordinate) => projection(point)!,
      invert: (point: Coordinate) => projection.invert!(point)!,
      context: nearby ? [...countries].flatMap(([otherId, other]) =>
        otherId !== id && (nearby.includes(otherId) || overlapsRegion(bounds, other.bounds)) ? path(other.shape) ?? [] : []) : [],
    };
  }

  return { get };
}

export type CountryMap = NonNullable<ReturnType<ReturnType<typeof createCountryMaps>['get']>>;
