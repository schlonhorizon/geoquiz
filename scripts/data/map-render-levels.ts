import { geoArea, geoGraticule, geoPath } from 'd3-geo';
import type { Geometry, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import { presimplify, quantile, simplify } from 'topojson-simplify';
import type { Objects, Topology } from 'topojson-specification';
import { worldProjection } from '../../src/map/geometry';
import type { SetDefinition } from '../../src/data/schema';
import type { TerrainShape, TerrainTier } from '../../src/map/world-raster-types';
import { DETAIL_RENDER_ZOOMS } from '../../src/map/world-raster-types';

// The fractions below describe how many weighted interior points to remove.
const detailWeights = [.94, .79, .52, 0];

function features(topology: Topology, key: string) {
  const object = topology.objects[key];
  if (!object) return [];
  const result = feature(topology, object);
  return result.type === 'FeatureCollection' ? result.features : [result];
}

export function buildRenderLevels(
  map: SetDefinition['map'], mapJson: string, waterJson: string | undefined, detailed: boolean,
): TerrainTier[] {
  const source: Topology<Objects<object>> = JSON.parse(mapJson);
  const water: Topology<Objects<object>> | undefined = waterJson ? JSON.parse(waterJson) : undefined;
  const weighted = presimplify(source);
  const weightedWater = water ? presimplify(water) : undefined;
  const { projection } = worldProjection(map);
  const path = geoPath(projection).digits(2);
  const threshold = (data: ReturnType<typeof presimplify>, weight: number) => weight ? quantile(data, 1 - weight) ?? 0 : 0;
  const zooms = detailed ? DETAIL_RENDER_ZOOMS : [0];
  return zooms.map((minZoom, index) => {
    const weight = detailed ? detailWeights[index] : .87;
    const stage = simplify(weighted, threshold(weighted, weight));
    const waterSource = water ?? source;
    const wet = weightedWater ? simplify(weightedWater, threshold(weightedWater, weight)) : stage;
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
