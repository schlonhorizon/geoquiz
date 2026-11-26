import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { geoArea, geoContains } from 'd3-geo';
import { feature, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';

const sourceVersion = '5.1.2';
const sourceRoot = new URL(`../data/raw/natural-earth-${sourceVersion}/`, import.meta.url);
const world = new URL('../data/sets/world/', import.meta.url);
const earthRadiusKm = 6371;
const minLakeAreaKm2 = .01;
const names = {
  countries: 'ne_10m_admin_0_countries',
  atlasUnits: 'ne_10m_admin_0_map_units',
  lakes: 'ne_50m_lakes',
  rivers: 'ne_50m_rivers_lake_centerlines',
  detailLakes: 'ne_10m_lakes',
  detailRivers: 'ne_10m_rivers_lake_centerlines',
};

async function naturalEarth(name) {
  const file = new URL(`${name}.geojson`, sourceRoot);
  try {
    return JSON.parse(await readFile(file, 'utf8')).features;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v${sourceVersion}/geojson/${name}.geojson`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const data = await response.text();
  const features = JSON.parse(data).features;
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(file, data);
  return features;
}

function asCollection(features) {
  return { type: 'FeatureCollection', features };
}

function water(features) {
  return asCollection(features.filter(({ geometry }) => {
    if (!geometry?.coordinates.length) return false;
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return true;
    const area = geoArea(geometry);
    return area <= 2 * Math.PI && area * earthRadiusKm ** 2 >= minLakeAreaKm2;
  })
    .map(({ geometry }) => ({ type: 'Feature', geometry })));
}

const definition = JSON.parse(await readFile(new URL('set.json', world), 'utf8'));
const base = JSON.parse(await readFile(new URL(definition.map.file, world), 'utf8'));
const [countries, atlasUnits, lakes, rivers, detailLakes, detailRivers] = await Promise.all(Object.values(names).map(naturalEarth));
const byAdm = new Map(countries.map((item) => [item.properties.ADM0_A3, item]));
const byIso = new Map(countries.map((item) => [item.properties.ISO_A3, item]));
const entities = parse(await readFile(new URL('entities.csv', world), 'utf8'), { columns: true, delimiter: ';' });
const capitals = new Map(entities.filter(({ capital_lon, capital_lat }) => capital_lon && capital_lat)
  .map(({ id, capital_lon, capital_lat }) => [id, [Number(capital_lon), Number(capital_lat)]]));
const mapUnit = (code) => atlasUnits.find(({ properties }) => properties.GU_A3 === code);

// Finland and Åland are separate objects in the overview. Preserve the same split at 1:10m.
const mapUnits = new Map([['FIN', mapUnit('FIN')], ['ALA', mapUnit('ALD')]]);
for (const [id, unit] of mapUnits) {
  if (!unit) throw new Error(`Missing Natural Earth map unit for ${id}`);
}

function refine(key) {
  return asCollection(feature(base, base.objects[key]).features.map((overview) => {
    const { id } = overview;
    const detail = mapUnits.get(id) ?? byAdm.get(id === 'XKX' ? 'KOS' : id) ?? byIso.get(id);
    const capital = capitals.get(id);
    const validCapital = !capital || (detail && geoContains(detail, capital));
    if (!detail?.geometry || !validCapital) {
      console.log(`Overview fallback for ${id}${detail ? ' (capital on the detailed coastline)' : ''}`);
      return { type: 'Feature', id, geometry: overview.geometry };
    }
    return { type: 'Feature', id, geometry: detail.geometry };
  }));
}

function compact(objects, minimumArea) {
  const weighted = presimplify(topology(objects, 1e6));
  const countries = weighted.objects[definition.map.object];
  function preserve(geometry) {
    for (const ref of geometry.arcs.flat(Infinity)) {
      weighted.arcs[ref < 0 ? ~ref : ref].forEach((point) => { point[2] = Infinity; });
    }
  }
  // Keep tiny entities and short arcs intact through simplification and quantization.
  for (const arc of weighted.arcs) {
    if (arc.length < 8) arc.forEach((point) => { point[2] = Infinity; });
  }
  if (countries) {
    for (const geometry of countries.geometries) {
      if (geoArea(feature(weighted, geometry)) * earthRadiusKm ** 2 > 2000) continue;
      preserve(geometry);
    }
  }
  const finish = () => quantize(simplify(weighted, minimumArea), 1e6);
  const simplified = finish();
  let adjusted = false;
  for (const key of [definition.map.object, 'land', 'lakes']) {
    if (!simplified.objects[key]) continue;
    const features = feature(simplified, simplified.objects[key]).features;
    for (const [index, polygon] of features.entries()) {
      const capital = key === definition.map.object ? capitals.get(polygon.id) : undefined;
      // Very small rings can reverse during simplification and fill the outside of the polygon.
      if (geoArea(polygon) <= 2 * Math.PI && (!capital || geoContains(polygon, capital))) continue;
      console.log(`Preserving polygon in ${key}: ${polygon.id ?? index + 1}`);
      preserve(weighted.objects[key].geometries[index]);
      adjusted = true;
    }
  }
  return adjusted ? finish() : simplified;
}

const overviewWater = compact({
  lakes: water(lakes.filter(({ properties }) => properties.min_zoom <= 3)),
  rivers: water(rivers.filter(({ properties }) => properties.scalerank <= 4)),
}, .00004);
const details = compact({
  [definition.map.object]: refine(definition.map.object),
  land: refine('land'),
  lakes: water(detailLakes),
  rivers: water(detailRivers.filter(({ properties }) => properties.scalerank <= 6)),
  minorRivers: water(detailRivers.filter(({ properties }) => properties.scalerank > 6)),
}, .0002);

for (const [file, data] of [[definition.map.waterFile, overviewWater], [definition.map.detailFile, details]]) {
  const json = JSON.stringify(data);
  await writeFile(new URL(file, world), json + '\n');
  console.log(`${file}: ${Buffer.byteLength(json) + 1} bytes`);
}
