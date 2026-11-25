import { geoContains } from 'd3-geo';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Entity, SetDefinition } from '../src/data/schema';
import { projectWorldMap } from '../src/map/geometry';
import { createPracticeEngine } from '../src/quiz/practice';
import type { PresetLibrary } from '../src/quiz/round-settings';
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
  it('builds the complete world set and joins quiz countries to their geometries', async () => {
    const sample = fileURLToPath(new URL('../data/sets', import.meta.url));
    const presetsFile = fileURLToPath(new URL('../data/presets.json', import.meta.url));
    const result = await buildData(sample, output, presetsFile);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.report).toContain('  seas: 0/197');
    expect(await emitted('index.json')).toEqual({ sets: ['world'] });
    const entities: Entity[] = await emitted('sets/world/entities.json');
    expect(entities).toHaveLength(197);
    expect(result.report).toContain('  flag: 197/197');
    expect(result.report).toEqual(expect.arrayContaining([
      '  capital: 194/197', '  capital_note: 16/197', '  continent_alt: 19/197', '  color: 197/197',
    ]));
    expect(entities.every(({ color }) => typeof color === 'string' && /^#[0-9A-F]{6}$/i.test(color))).toBe(true);
    expect(entities.find(({ id }) => id === 'XKX')?.flag).toBe('xk');
    expect(entities.find(({ id }) => id === 'FRA')?.continent_alt).toEqual(['Afrika', 'Nordamerika', 'Südamerika']);
    expect(entities.find(({ id }) => id === 'GNQ')?.capital).toBe('Ciudad de la Paz');
    expect(entities.find(({ id }) => id === 'NRU')).toMatchObject({ capital: null, capital_note: expect.stringContaining('Yaren') });
    await Promise.all(entities.map(async ({ flag }) => {
      expect(await readFile(join(output, 'flags', `${flag}.svg`), 'utf8')).toContain('<svg');
    }));
    expect(entities.filter(({ un_member }) => un_member === false).map(({ id }) => id))
      .toEqual(['PSE', 'TWN', 'VAT', 'XKX']);
    expect(entities).toContainEqual(expect.objectContaining({
      id: 'CHE',
      capital: 'Bern',
      capital_lat: null,
      neighbors: ['AUT', 'DEU', 'FRA', 'ITA', 'LIE'],
      seas: null,
      un_member: true,
    }));
    expect(entities).toContainEqual(expect.objectContaining({
      id: 'BEL', capital: 'Brüssel', capital_aliases: ['Brussels'],
    }));
    type WorldTopology = Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
    const source: WorldTopology = JSON.parse(await readFile(join(sample, 'world/map.topojson'), 'utf8'));
    const topology: WorldTopology = await emitted('sets/world/map.topojson');
    expect(topology.objects.countries.geometries.map(({ id }) => id).sort())
      .toEqual(entities.map(({ id }) => id).sort());
    const background = topology.objects.land.geometries.map(({ id }) => id);
    expect(background).toHaveLength(42);
    expect(background).toEqual(expect.arrayContaining(['ESH', 'GRL']));
    const merges = [
      { target: 'SOM', area: 'SOL', point: [44.06, 9.56] as [number, number] },
      { target: 'CYP', area: 'CYN', point: [33.32, 35.34] as [number, number] },
    ];
    for (const { target, area, point } of merges) {
      const originalArea = source.objects.land.geometries.find(({ id }) => id === area)!;
      const originalCountry = source.objects.countries.geometries.find(({ id }) => id === target)!;
      const mergedCountry = topology.objects.countries.geometries.find(({ id }) => id === target)!;
      expect(geoContains(feature(source, originalArea), point)).toBe(true);
      expect(geoContains(feature(source, originalCountry), point)).toBe(false);
      expect(geoContains(feature(topology, mergedCountry), point)).toBe(true);
      expect(mergedCountry).toMatchObject({ type: 'MultiPolygon', arcs: [expect.any(Array)] });
      expect(background).not.toContain(area);
    }

    const definition: SetDefinition = await emitted('sets/world/set.json');
    const projected = projectWorldMap(topology, definition.map);
    expect(projected.countries).toHaveLength(197);
    for (const country of projected.countries) {
      expect(country.bounds.flat().every(Number.isFinite)).toBe(true);
    }
    const marked = projected.countries.filter(({ marker }) => marker?.every(Number.isFinite)).map(({ id }) => id);
    expect(marked).toEqual(expect.arrayContaining([
      'AND', 'LIE', 'MCO', 'SMR', 'VAT',
      'ATG', 'BRB', 'DMA', 'GRD', 'KNA', 'LCA', 'VCT',
      'FSM', 'KIR', 'MHL', 'NRU', 'PLW', 'TON', 'TUV',
    ]));

    const library: PresetLibrary = await emitted('presets.json');
    const engine = createPracticeEngine({ definition, entities });
    for (const preset of library.presets.filter(({ upcoming }) => !upcoming)) {
      expect(engine.createRound({ ...library.defaults, ...preset.settings })).toHaveLength(20);
    }
    const location = { ...library.defaults, categories: ['location'], length: 'all' as const };
    const find = engine.createRound({ ...location, direction: 'forward', format: 'map' });
    const name = engine.createRound({ ...location, direction: 'reverse', format: 'choice' });
    expect(new Set(find.map(({ entity }) => entity.id))).toEqual(new Set(entities.map(({ id }) => id)));
    expect(name).toHaveLength(197);
    for (const { options, entity } of name) {
      expect(new Set(options.map(({ name }) => name)).size).toBe(4);
      expect(options.filter(({ id }) => id === entity.id)).toHaveLength(1);
    }
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

  it('reads optional flag distractors and validates their country IDs', async () => {
    const csv = 'id;name;flag_similar\nDEU;Deutschland;FRA|BEL\nFRA;Frankreich;\nBEL;Belgien;\n';
    const options: Partial<SetDefinition> = { attributes: [{ key: 'flag', label: 'Flagge', type: 'flag' }] };
    await fixture('world', csv, ['DEU', 'FRA', 'BEL'], options);
    const result = await buildData(sources, output);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect((await emitted('sets/world/entities.json'))[0]).toMatchObject({ flag: 'de', flag_similar: ['FRA', 'BEL'] });

    await fixture('world', csv.replace('FRA|BEL', 'FRA|AAA'), ['DEU', 'FRA', 'BEL'], options);
    expect((await buildData(sources, output)).errors).toEqual([
      '[world] DEU, Spalte "flag_similar": Ungültige Entity-ID "AAA".',
    ]);
  });

  it('validates alternative enum values and hex colors and keeps notes as text', async () => {
    const settings: Partial<SetDefinition> = {
      attributes: [
        { key: 'region', label: 'Region', type: 'enum', values: ['Europa', 'Asien', 'Afrika'], alternativeValuesColumn: 'region_alt' },
        { key: 'capital', label: 'Hauptstadt', type: 'text', noteColumn: 'capital_note' },
        { key: 'color', label: 'Hauptfarbe', type: 'color', quiz: false },
      ],
    };
    const metaHeader = 'id;name;region;region_alt;capital;capital_note;color';
    await fixture('world', `${metaHeader}\nDEU;Deutschland;Europa;Asien|Afrika;Berlin;"Ein Hinweis; mit Trennzeichen";#273846\n`, ['DEU'], settings);
    expect((await buildData(sources, output)).errors).toEqual([]);
    expect((await emitted('sets/world/entities.json'))[0]).toMatchObject({
      region_alt: ['Asien', 'Afrika'],
      capital_note: 'Ein Hinweis; mit Trennzeichen',
      color: '#273846',
    });

    const invalid = `${metaHeader}\nDEU;Deutschland;Europa;Europa|Atlantis;Berlin;;#123\nFRA;Frankreich;;Afrika;Paris;;#001122\n`;
    await fixture('world', invalid, ['DEU', 'FRA'], settings);
    expect((await buildData(sources, output)).errors).toEqual(expect.arrayContaining([
      expect.stringContaining('eine Hex-Farbe im Format #RRGGBB'),
      expect.stringContaining('Hauptwert und Alternativen müssen verschieden sein'),
      expect.stringContaining('"Atlantis" ist kein erlaubter Enum-Wert'),
      expect.stringContaining('Der Hauptwert in "region" fehlt'),
    ]));
    expect((await emitted('sets/world/entities.json'))[0].color).toBe('#273846');
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
