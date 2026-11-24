import type { Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import { getCountryFocus, maxZoom, projectWorldMap } from './geometry';
import { isNearMarker, resolveCountryClick } from './hit-test';

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
  },
  arcs: [
    [[7.41, 43.73], [7.41, 43.75], [7.45, 43.75], [7.45, 43.73], [7.41, 43.73]],
    [[0, 43], [0, 49], [8, 49], [8, 43], [0, 43]],
  ],
};

describe('country projection', () => {
  it('adds a marker for a small country and bounds the focus zoom', () => {
    const map = projectWorldMap(topology, {
      file: 'map.topojson',
      object: 'countries',
      idProperty: 'code',
      projection: 'equalEarth',
    });
    const [small, large] = map.countries;
    expect(map.ocean).toMatch(/^M/);
    expect(small.id).toBe('MCO');
    expect(small.marker?.every(Number.isFinite)).toBe(true);
    expect(getCountryFocus(small.bounds).scale).toBe(maxZoom);
    expect(large.marker).toBeNull();
  });
});

describe('map clicks', () => {
  it('keeps the marker tolerance in screen pixels when zooming', () => {
    expect(isNearMarker(10, 0, [0, 0], 2)).toBe(true);
    expect(isNearMarker(5, 0, [0, 0], 4)).toBe(true);
    expect(isNearMarker(10, 0, [0, 0], 4)).toBe(false);
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
