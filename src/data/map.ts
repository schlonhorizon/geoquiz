import type { AttributeDefinition, Entity } from './schema';
import { feature } from 'topojson-client';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { Topology } from 'topojson-specification';

export const CORE_OUTLINE_OBJECT = 'core';

interface IdentifiableGeometry {
  id?: string | number;
  properties?: Record<string, unknown> | null;
}

export function getMapEntityId(geometry: IdentifiableGeometry, idProperty: string): string | undefined {
  const property = geometry.properties?.[idProperty];
  const id = idProperty === 'id' ? geometry.id ?? property : property;
  if (typeof id === 'number') return String(id);
  if (typeof id === 'string' && id.trim()) return id;
}

export function polygonFeatures(topology: Topology, key: string) {
  const object = topology.objects[key];
  if (!object) return [];
  const converted = feature(topology, object);
  const entries = converted.type === 'FeatureCollection' ? converted.features : [converted];
  return entries.filter((item): item is Feature<Polygon | MultiPolygon> =>
    item.geometry?.type === 'Polygon' || item.geometry?.type === 'MultiPolygon');
}

export type Coordinate = [longitude: number, latitude: number];

export function attributePoint(entity: Entity, { point }: AttributeDefinition): Coordinate | undefined {
  if (!point) return;
  const latitude = entity[point.lat];
  const longitude = entity[point.lon];
  if (typeof latitude === 'number' && typeof longitude === 'number'
    && Number.isFinite(latitude) && Number.isFinite(longitude)) return [longitude, latitude];
}
