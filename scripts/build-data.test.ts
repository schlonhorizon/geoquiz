import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SetDefinition } from '../src/data/schema';
import { buildData } from './build-data';

const attributes: SetDefinition['attributes'] = [
  { key: 'region', label: 'Region', type: 'enum', values: ['Europa'] },
  { key: 'neighbors', label: 'Nachbarn', type: 'entityRefList' },
];

const header = 'id;name;region;neighbors';
let root: string;
let sources: string;
let output: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'geoquiz-test-'));
  sources = join(root, 'sets');
  output = join(root, 'output');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function fixture(id: string, csv: string, geometryIds: string[], options: Partial<SetDefinition> = {}) {
  const path = join(sources, id);
  await mkdir(path, { recursive: true });
  const definition: SetDefinition = {
    id,
    label: id,
    entityLabel: 'Einheit',
    entityLabelPlural: 'Einheiten',
    parent: null,
    map: { file: 'map.topojson', object: 'areas', idProperty: 'id', projection: 'equalEarth' },
    attributes,
    ...options,
  };
  const map = {
    type: 'Topology',
    objects: {
      areas: {
        type: 'GeometryCollection',
        geometries: geometryIds.map((code) => ({
          type: 'Polygon',
          arcs: [[0]],
          ...(definition.map.idProperty === 'id' ? { id: code } : { properties: { code } }),
        })),
      },
    },
    arcs: [[[0, 0], [0, 1], [1, 0], [0, 0]]],
  };
  await Promise.all([
    writeFile(join(path, 'set.json'), JSON.stringify(definition)),
    writeFile(join(path, 'entities.csv'), csv),
    writeFile(join(path, 'map.topojson'), JSON.stringify(map)),
  ]);
}

async function emitted(file: string) {
  return JSON.parse(await readFile(join(output, file), 'utf8'));
}

describe('buildData', () => {
  it('builds all ten sample countries and preserves the data types and map', async () => {
    const sample = fileURLToPath(new URL('../data/sets', import.meta.url));
    const result = await buildData(sample, output);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.report).toContain('  seas: 9/10');
    expect(await emitted('index.json')).toEqual({ sets: ['world'] });
    const entities = await emitted('sets/world/entities.json');
    expect(entities).toHaveLength(10);
    expect(entities).toContainEqual(expect.objectContaining({
      id: 'CHE',
      capital: 'Bern',
      capital_lat: 46.9481,
      neighbors: ['DEU', 'FRA'],
      seas: null,
      un_member: true,
    }));
    expect(entities).toContainEqual(expect.objectContaining({
      id: 'BEL', capital_aliases: ['Bruxelles', 'Brussel'],
    }));
    expect(await readFile(join(output, 'sets/world/map.topojson'), 'utf8'))
      .toBe(await readFile(join(sample, 'world/map.topojson'), 'utf8'));
  });

  it('discovers a new set and attributes from data alone', async () => {
    await fixture('world', `${header}\nDEU;Deutschland;Europa;\n`, ['DEU']);
    await fixture('de', '\uFEFFid;name;description;flag;quantity\r\nDE-RP;Rheinland-Pfalz;"Text; mit Trennzeichen";false;0,5\r\n', ['DE-RP'], {
      parent: { set: 'world', entity: 'DEU' },
      map: { file: 'map.topojson', object: 'areas', idProperty: 'code', projection: 'equalEarth' },
      attributes: [
        { key: 'description', label: 'Beschreibung', type: 'text' },
        { key: 'flag', label: 'Merkmal', type: 'boolean' },
        { key: 'quantity', label: 'Anzahl', type: 'number' },
      ],
    });

    const result = await buildData(sources, output);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.report).toContain('  flag: 1/1');
    expect(await emitted('index.json')).toEqual({ sets: ['de', 'world'] });
    expect(await emitted('sets/de/entities.json')).toEqual([{
      id: 'DE-RP',
      name: 'Rheinland-Pfalz',
      name_aliases: [],
      description: 'Text; mit Trennzeichen',
      flag: false,
      quantity: 0.5,
    }]);

    await rm(join(sources, 'de'), { recursive: true });
    await buildData(sources, output);
    expect(await emitted('index.json')).toEqual({ sets: ['world'] });
    await expect(readFile(join(output, 'sets/de/set.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reports unmapped columns, asymmetric neighbors and extra geometries as warnings', async () => {
    const csv = `${header};note\nDEU;Deutschland;Europa;FRA;\nFRA;Frankreich;Europa;;\n`;
    await fixture('world', csv, ['DEU', 'FRA', 'BEL']);

    const result = await buildData(sources, output);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      '[world] CSV-Spalte "note" hat keine Attribut-Definition.',
      '[world] Nachbarschaft DEU → FRA ist nicht symmetrisch.',
      '[world] Geometrie "BEL" in "areas" hat keine Entity.',
    ]);
    expect(await readFile(join(sources, 'world/entities.csv'), 'utf8')).toBe(csv);
  });

  it('reports reference, enum, duplicate and geometry errors and keeps the previous build', async () => {
    await fixture('world', `${header}\nDEU;Deutschland;Europa;\n`, ['DEU']);
    await buildData(sources, output);
    const previous = await emitted('sets/world/entities.json');

    const invalid = 'id;name;region;neighbors\nDEU;Deutschland;Äquator;ABC\nDEU;Deutschland;Europa;\n';
    await fixture('world', invalid, ['FRA'], {
      attributes: [...attributes, { key: 'capital', label: 'Hauptstadt', type: 'text' }],
    });

    const result = await buildData(sources, output);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('CSV-Spalte "capital" fehlt'),
      expect.stringContaining('kein erlaubter Enum-Wert'),
      expect.stringContaining('Doppelte ID "DEU"'),
      expect.stringContaining('Unbekannte Entity-ID "ABC"'),
      expect.stringContaining('Entity "DEU" hat keine Geometrie'),
    ]));
    expect(await emitted('sets/world/entities.json')).toEqual(previous);
  });
});
