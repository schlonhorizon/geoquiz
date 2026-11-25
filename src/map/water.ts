import type { GeoPath } from 'd3-geo';
import type { Feature, FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

export const WORLD_DETAIL_ZOOM = 3;
export const MINOR_RIVER_ZOOM = 7;
const layers = [['rivers', 'map-river'], ['minorRivers', 'map-river map-river-minor'], ['lakes', 'map-lake']] as const;
const cache = new WeakMap<Topology, [Feature | FeatureCollection, string][]>();

export function projectWater(topology: Topology | undefined, path: GeoPath) {
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
    const d = path(geometry);
    return d ? [{ name, d }] : [];
  });
}

export function appendWater(parent: SVGGElement, paths: ReturnType<typeof projectWater>) {
  const layer = document.createElementNS(parent.namespaceURI, 'g');
  layer.setAttribute('class', 'map-water');
  layer.setAttribute('aria-hidden', 'true');
  for (const { name, d } of paths) {
    const path = document.createElementNS(parent.namespaceURI, 'path');
    path.setAttribute('class', name);
    path.setAttribute('d', d);
    layer.append(path);
  }
  parent.append(layer);
}
