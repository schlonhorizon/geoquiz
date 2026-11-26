import type { GeoPath } from 'd3-geo';
import type { Feature, FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { Bounds } from './viewport';

export const WORLD_DETAIL_ZOOM = 3;
export const MINOR_RIVER_ZOOM = 7;
const layers = [['rivers', 'map-river'], ['minorRivers', 'map-river map-river-minor'], ['lakes', 'map-lake']] as const;
const cache = new WeakMap<Topology, [Feature | FeatureCollection, string][]>();

export function projectWater(topology: Topology | undefined, path: GeoPath, spatial = false): { name: string; d: string; bounds?: Bounds }[] {
  if (!topology) return [];
  let geometries = cache.get(topology);
  if (!geometries) {
    geometries = layers.flatMap(([key, name]) => {
      const object = topology.objects[key];
      return object ? [[feature(topology, object), name]] : [];
    });
    cache.set(topology, geometries);
  }
  return geometries.flatMap(([geometry, name]) => {
    if (spatial && geometry.type === 'FeatureCollection') {
      const chunks = new Map<string, { name: string; d: string; bounds: Bounds }>();
      for (const item of geometry.features) {
        const d = path(item);
        if (!d) continue;
        const bounds = path.bounds(item);
        const [[left, top], [right, bottom]] = bounds;
        const key = `${Math.floor((left + right) / 144)}:${Math.floor((top + bottom) / 144)}`;
        const chunk = chunks.get(key);
        if (!chunk) chunks.set(key, { name, d, bounds });
        else {
          chunk.d += d;
          chunk.bounds = [[Math.min(left, chunk.bounds[0][0]), Math.min(top, chunk.bounds[0][1])],
            [Math.max(right, chunk.bounds[1][0]), Math.max(bottom, chunk.bounds[1][1])]];
        }
      }
      return [...chunks.values()];
    }
    const d = path(geometry);
    return d ? [{ name, d }] : [];
  });
}

export function appendWater(parent: SVGGElement, paths: ReturnType<typeof projectWater>) {
  const layer = document.createElementNS(parent.namespaceURI, 'g');
  layer.setAttribute('class', 'map-water');
  layer.setAttribute('aria-hidden', 'true');
  const shapes = paths.map(({ name, d, bounds }) => {
    const path = document.createElementNS(parent.namespaceURI, 'path');
    path.setAttribute('class', name);
    path.setAttribute('d', d);
    layer.append(path);
    return { shape: path as SVGPathElement, bounds };
  });
  parent.append(layer);
  return shapes;
}
