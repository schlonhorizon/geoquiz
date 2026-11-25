import { geoContains } from 'd3-geo';
import { feature, mergeArcs } from 'topojson-client';
import type { GeometryObject, MultiPolygon, Polygon, Topology } from 'topojson-specification';
import { z } from 'zod';
import { getMapEntityId } from '../../src/data/map';
import type { Entity, SetDefinition } from '../../src/data/schema';
import type { DataIssues } from './issues';

const topologySchema = z.object({
  type: z.literal('Topology'),
  objects: z.record(z.string(), z.unknown()),
  arcs: z.array(z.unknown()),
});

const geometrySchema = z.object({
  type: z.string().nullable(),
  id: z.union([z.string(), z.number()]).optional(),
  properties: z.record(z.string(), z.unknown()).nullish(),
  arcs: z.unknown().optional(),
});

const ringSchema = z.array(z.number().int()).min(1);
const polygonSchema = z.array(ringSchema).min(1);
const multiPolygonSchema = z.array(polygonSchema).min(1);
const collectionSchema = z.object({ type: z.literal('GeometryCollection'), geometries: z.array(z.unknown()) });

export function mergeLandAreas(content: string, { object, idProperty, mergeLand }: SetDefinition['map']): string {
  if (!mergeLand) return content;

  const topology: Topology<Record<string, GeometryObject>> = JSON.parse(content);
  const countries = topology.objects?.[object];
  const land = topology.objects?.land;
  if (countries?.type !== 'GeometryCollection' || land?.type !== 'GeometryCollection') {
    throw new Error(`Zum Zusammenführen müssen "${object}" und "land" TopoJSON-Geometriesammlungen sein.`);
  }

  function findPolygon(geometries: GeometryObject[], id: string, collection: string) {
    const index = geometries.findIndex((geometry) => getMapEntityId(geometry, idProperty) === id);
    const geometry = geometries[index];
    if (geometry?.type !== 'Polygon' && geometry?.type !== 'MultiPolygon') {
      throw new Error(`Polygon "${id}" fehlt in "${collection}" oder ist ungültig.`);
    }
    return { index, geometry };
  }

  for (const [targetId, areas] of Object.entries(mergeLand)) {
    const target = findPolygon(countries.geometries, targetId, object);
    const polygons = [target.geometry];
    for (const area of areas) {
      const source = findPolygon(land.geometries, area, 'land');
      polygons.push(source.geometry);
      land.geometries.splice(source.index, 1);
    }
    const merged = mergeArcs(topology, polygons);
    if (!merged.arcs.length) throw new Error(`Zusammengeführte Geometrie "${targetId}" ist leer.`);
    const { id, properties } = target.geometry;
    countries.geometries[target.index] = { ...merged, id, properties };
  }

  return JSON.stringify(topology) + '\n';
}

export function validateMap(content: string, definition: SetDefinition, entities: Map<string, Entity>, issues: DataIssues) {
  const { map, attributes } = definition;
  const raw: Topology = JSON.parse(content);
  const topology = topologySchema.parse(raw);
  const pointAttributes = attributes.filter(({ point }) => point);
  if (!Object.hasOwn(topology.objects, map.object)) {
    issues.errors.push(`TopoJSON-Objekt "${map.object}" fehlt in ${map.file}.`);
    return;
  }

  const object = topology.objects[map.object];
  const collection = collectionSchema.safeParse(object);
  const geometries = collection.success ? collection.data.geometries : [object];
  const geometryIds = new Set<string>();
  for (const [index, entry] of geometries.entries()) {
    const geometry = geometrySchema.parse(entry);
    const idLabel = getMapEntityId(geometry, map.idProperty);
    if (!idLabel) {
      issues.warnings.push(`Geometrie ${index + 1} in "${map.object}" hat keine ID über "${map.idProperty}".`);
      continue;
    }

    const label = `Geometrie "${idLabel}" in "${map.object}"`;
    if (geometryIds.has(idLabel)) {
      issues.errors.push(`${label}: Doppelte Geometrie-ID.`);
    }
    if (!entities.has(idLabel)) {
      issues.warnings.push(`${label} hat keine Entity.`);
    }

    const polygon = polygonSchema.safeParse(geometry.arcs);
    const multiPolygon = multiPolygonSchema.safeParse(geometry.arcs);
    const arcs = geometry.type === 'Polygon' && polygon.success ? polygon.data.flat()
      : geometry.type === 'MultiPolygon' && multiPolygon.success ? multiPolygon.data.flat(2)
        : [];
    if (!arcs.length || arcs.some((arc) => {
      const reference = arc < 0 ? -arc - 1 : arc;
      return !Array.isArray(topology.arcs[reference]) || topology.arcs[reference].length < 2;
    })) {
      issues.errors.push(`${label}: Ungültige Polygongeometrie.`);
      continue;
    }
    geometryIds.add(idLabel);
    const entity = entities.get(idLabel);
    if (!entity) continue;
    for (const { key, point } of pointAttributes) {
      if (!point) continue;
      const latitude = entity[point.lat];
      const longitude = entity[point.lon];
      if (typeof latitude !== 'number' || typeof longitude !== 'number'
        || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      if (!geoContains(feature(raw, entry as Polygon | MultiPolygon), [longitude, latitude])) {
        issues.errors.push(`${label}: Der Punkt für "${key}" liegt außerhalb der Fläche.`);
      }
    }
  }

  for (const id of entities.keys()) {
    if (!geometryIds.has(id)) {
      issues.errors.push(`Entity "${id}" hat keine Geometrie in "${map.object}".`);
    }
  }
}
