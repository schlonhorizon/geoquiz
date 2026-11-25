import type { Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import { countryCenter, projectWorldMap } from './geometry';
import { assessCapital, createCountryMaps } from './country-map';
import { isNearMarker, resolveCountryClick } from './hit-test';
import { clampMapY, nearestWorldX, wrapWorldX } from './viewport';

const topology: Topology = {
  type: 'Topology',
  objects: {
    countries: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', properties: { code: 'MCO' }, arcs: [[0]] },
        { type: 'Polygon', properties: { code: 'FRA' }, arcs: [[1]] },
      ],
    },
    land: { type: 'Polygon', arcs: [[2]] },
  },
  arcs: [
    [[7.41, 43.73], [7.41, 43.75], [7.45, 43.75], [7.45, 43.73], [7.41, 43.73]],
    [[0, 43], [0, 49], [8, 49], [8, 43], [0, 43]],
    [[0, -75], [0, -65], [12, -65], [12, -75], [0, -75]],
  ],
};

describe('country projection', () => {
  it('adds a marker for a small country and clips Antarctica out of the background', () => {
    const map = projectWorldMap(topology, {
      file: 'map.topojson',
      object: 'countries',
      idProperty: 'code',
      projection: 'miller',
    });
    const [small, large] = map.countries;
    expect(map.height).toBeGreaterThan(0);
    expect(map.land).toBeNull();
    expect(small.id).toBe('MCO');
    expect(small.marker?.every(Number.isFinite)).toBe(true);
    expect(countryCenter(small.bounds).every(Number.isFinite)).toBe(true);
    expect(large.marker).toBeNull();
  });

  it('keeps focus bounds local for a country crossing the antimeridian', () => {
    const split: Topology = {
      type: 'Topology',
      objects: { countries: { type: 'Polygon', id: 'TEST', arcs: [[0]] } },
      arcs: [[[178, -17], [178, -15], [-178, -15], [-178, -17], [178, -17]]],
    };
    const { countries: [country] } = projectWorldMap(split, {
      file: 'map.topojson',
      object: 'countries',
      idProperty: 'id',
      projection: 'miller',
    });
    expect(country.bounds[1][0] - country.bounds[0][0]).toBeLessThan(20);
    const [x] = countryCenter(country.bounds);
    expect(Math.min(x, 960 - x)).toBeLessThan(5);
    const local = createCountryMaps(split, {
      file: 'map.topojson', object: 'countries', idProperty: 'id', projection: 'miller',
    }).get('TEST')!;
    const [west, south] = local.project([179, -16]);
    const [east] = local.project([-179, -16]);
    expect(Math.abs(east - west)).toBeLessThan(local.view[2] * .45);
    expect(local.invert([west, south])[0]).toBeCloseTo(179, 8);
    expect(local.invert([east, south])[0]).toBeCloseTo(-179, 8);
  });
});

it('uses great-circle distance and clamps the capital tolerance to 25–150 km', () => {
  expect(assessCapital([.2, 0], [0, 0], [[0, 0], [.1, .1]])).toMatchObject({ toleranceKm: 25, correct: true });
  expect(assessCapital([.3, 0], [0, 0], [[0, 0], [.1, .1]])).toMatchObject({ toleranceKm: 25, correct: false });
  const regional = assessCapital([0, 0], [0, 0], [[0, 0], [6, 8]]);
  expect(regional.toleranceKm).toBeCloseTo(111, 0);
  expect(regional.distanceKm).toBe(0);
  expect(assessCapital([179.9, 0], [-179.9, 0], [[170, 0], [-170, 5]])).toMatchObject({
    toleranceKm: 150, correct: true,
  });
});

describe('the repeating viewport', () => {
  it('wraps in both directions at an exact world width', () => {
    expect(wrapWorldX(-12)).toBe(948);
    expect(wrapWorldX(2 * 960 + 12)).toBe(12);
    expect(wrapWorldX(960)).toBe(0);
  });

  it('chooses the closest target across either seam or multiple previous turns', () => {
    expect(nearestWorldX(20, 940)).toBe(980);
    expect(nearestWorldX(940, 20)).toBe(-20);
    expect(nearestWorldX(20, -1910)).toBe(-1900);
  });

  it('centers a short map and clamps north and south on a taller one', () => {
    expect(clampMapY(-500, 400, 800)).toBe(200);
    expect(clampMapY(500, 900, 800)).toBe(0);
    expect(clampMapY(-500, 900, 800)).toBe(-100);
    expect(clampMapY(-40, 900, 800)).toBe(-40);
  });
});

describe('map clicks', () => {
  it('keeps the marker tolerance in screen pixels when zooming', () => {
    expect(isNearMarker(10, 0, [0, 0], 2)).toBe(true);
    expect(isNearMarker(5, 0, [0, 0], 4)).toBe(true);
    expect(isNearMarker(10, 0, [0, 0], 4)).toBe(false);
    expect(isNearMarker(958, 0, [2, 0], 4)).toBe(true);
  });

  it('accepts near misses and gives direct clicks on other markers priority', () => {
    const near = () => true;
    expect(resolveCountryClick(undefined, false, 'MCO', true, near)).toBe('MCO');
    expect(resolveCountryClick('FRA', false, 'MCO', true, near)).toBe('MCO');
    expect(resolveCountryClick('VAT', true, 'MCO', true, near)).toBe('VAT');
    expect(resolveCountryClick('BEL', false, 'FRA', false, near)).toBe('BEL');
    expect(resolveCountryClick(undefined, false, 'FRA', false, near)).toBe('FRA');
    expect(resolveCountryClick(undefined, false, 'FRA', false, () => false)).toBeUndefined();
  });
});

it('keeps detached parts inside the fit bounds of a country', () => {
  const archipelago: Topology = {
    type: 'Topology',
    objects: { countries: { type: 'MultiPolygon', id: 'TEST', arcs: [[[0]], [[1]]] } },
    arcs: [
      [[0, 43], [0, 49], [8, 49], [8, 43], [0, 43]],
      [[21, 42], [21, 43], [22, 43], [22, 42], [21, 42]],
    ],
  };
  const { countries: [country] } = projectWorldMap(archipelago, {
    file: 'map.topojson', object: 'countries', idProperty: 'id', projection: 'miller',
  });
  expect(country.bounds[1][0] - country.bounds[0][0]).toBeCloseTo(22 * 960 / 360);
});
