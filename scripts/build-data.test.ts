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
import { createCountryMaps, MIN_CAPITAL_VIEW_SPAN_DEG } from '../src/map/country-map';
import { addCoreOutlines } from './data/core-outline';
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
      '  capital: 194/197', '  capital_note: 16/197', '  capital_lat: 194/197', '  capital_lon: 194/197',
      '  continent_alt: 7/197', '  continent_note: 29/197', '  color: 197/197',
      '  currency: 196/197', '  currency_alt: 1/197', '  central_bank: 185/197', '  central_bank_note: 21/197',
      '  stock_index: 134/197', '  stock_index_status: 63/197', '  regime_type: 173/197', '  government_form: 197/197',
    ]));
    expect(entities.every(({ color }) => typeof color === 'string' && /^#[0-9A-F]{6}$/i.test(color))).toBe(true);
    expect(entities.find(({ id }) => id === 'XKX')?.flag).toBe('xk');
    expect(entities.filter(({ continent_alt }) => continent_alt).map(({ id }) => id))
      .toEqual(['AZE', 'CYP', 'EGY', 'GEO', 'KAZ', 'RUS', 'TUR']);
    expect(entities.find(({ id }) => id === 'FRA')?.continent_note).toContain('Französisch-Guayana');
    expect(entities.find(({ id }) => id === 'NLD')?.color).toBe('#FF4F00');
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
      capital_lat: expect.any(Number),
      capital_lon: expect.any(Number),
      neighbors: ['AUT', 'DEU', 'FRA', 'ITA', 'LIE'],
      seas: null,
      un_member: true,
    }));
    expect(entities).toContainEqual(expect.objectContaining({
      id: 'BEL', capital: 'Brüssel', capital_aliases: ['Brussels'],
    }));
    type WorldTopology = Topology<{ countries: GeometryCollection; land: GeometryCollection; core: GeometryCollection }>;
    const source: WorldTopology = JSON.parse(await readFile(join(sample, 'world/map.topojson'), 'utf8'));
    const topology: WorldTopology = await emitted('sets/world/map.topojson');
    const details: WorldTopology = await emitted('sets/world/map-detail.topojson');
    const water: Topology<{ lakes: GeometryCollection; rivers: GeometryCollection }> = await emitted('sets/world/water.topojson');
    expect(topology.objects.countries.geometries.map(({ id }) => id).sort())
      .toEqual(entities.map(({ id }) => id).sort());
    expect(details.objects.countries.geometries.map(({ id }) => id).sort())
      .toEqual(entities.map(({ id }) => id).sort());
    expect(details.objects).toHaveProperty('minorRivers');
    expect(water.objects.lakes.geometries.length).toBeGreaterThan(0);
    expect(water.objects.rivers.geometries.length).toBeGreaterThan(0);
    const countryFeatures = new Map(feature(topology, topology.objects.countries).features.map((country) => [country.id, country]));
    const coreFeatures = new Map(feature(topology, topology.objects.core).features.map((country) => [country.id, country]));
    for (const [id, point] of [
      ['FRA', [-53, 4]], ['FRA', [55.55, -21.1]], ['USA', [-155.5, 19.6]],
      ['USA', [172.96, 52.9]], ['USA', [-170.70, 52.63]],
      ['ECU', [-90.35, -.63]], ['CHL', [-109.35, -27.12]], ['NLD', [-68.27, 12.2]],
      ['ESP', [-16.54, 28.29]], ['NOR', [15.94, 78.56]], ['NOR', [-8.43, 71.02]],
      ['COL', [-81.70495, 12.54785]], ['COL', [-81.36701, 13.34627]],
    ] as const) {
      expect(geoContains(countryFeatures.get(id)!, [...point]), id).toBe(true);
      expect(geoContains(coreFeatures.get(id)!, [...point]), id).toBe(false);
    }
    for (const point of [[-149.9, 61.22], [-153.56, 57.44], [-169.83, 52.84], [-170.32, 63.4]] as const) {
      expect(geoContains(coreFeatures.get('USA')!, [...point]), `Alaska: ${point.join(', ')}`).toBe(true);
    }
    for (const { id, capital, capital_lat: latitude, capital_lon: longitude } of entities) {
      if (!capital) {
        expect([latitude, longitude]).toEqual([null, null]);
      } else {
        const point: [number, number] = [Number(longitude), Number(latitude)];
        expect(geoContains(countryFeatures.get(id)!, point), id).toBe(true);
        expect(geoContains(coreFeatures.get(id) ?? countryFeatures.get(id)!, point), id).toBe(true);
      }
    }
    const background = topology.objects.land.geometries.map(({ id }) => id);
    expect(background).toHaveLength(42);
    expect(background).toEqual(expect.arrayContaining(['ESH', 'GRL']));
    const merges = [
      { target: 'SOM', area: 'SOL', point: [44.06, 9.56] as [number, number] },
      { target: 'CYP', area: 'CYN', point: [33.44, 35.28] as [number, number] },
    ];
    for (const { target, area, point } of merges) {
      const originalArea = source.objects.land.geometries.find(({ id }) => id === area)!;
      const originalCountry = source.objects.countries.geometries.find(({ id }) => id === target)!;
      const mergedCountry = topology.objects.countries.geometries.find(({ id }) => id === target)!;
      const mergedDetail = details.objects.countries.geometries.find(({ id }) => id === target)!;
      expect(geoContains(feature(source, originalArea), point)).toBe(true);
      expect(geoContains(feature(source, originalCountry), point)).toBe(false);
      expect(geoContains(feature(topology, mergedCountry), point)).toBe(true);
      expect(geoContains(feature(details, mergedDetail), point)).toBe(true);
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
    for (const preset of library.presets.filter(({ upcoming, settings }) => !upcoming && !settings.countryRound)) {
      expect(engine.createRound({ ...library.defaults, ...preset.settings })).toHaveLength(20);
    }
    const countrySettings = library.presets.find(({ id }) => id === 'complete')!.settings.countryRound!;
    const fullCountry = { ...library.defaults, countryRound: { ...countrySettings, selection: 'specific' as const, countryId: 'DEU' } };
    const germany = engine.createRound(fullCountry, () => .99);
    expect(germany.map(({ category, format }) => [category, format])).toEqual([
      ['flag', 'choice'], ['capital', 'choice'], ['capital', 'map'], ['continent', 'choice'],
      ['currency', 'choice'], ['central_bank', 'choice'], ['stock_index', 'choice'],
      ['government_form', 'choice'], ['regime_type', 'choice'],
    ]);
    expect(germany.every(({ entity }) => entity.id === 'DEU')).toBe(true);
    expect(germany[2].prompt).toBe('Markiere Berlin auf der Karte von Deutschland.');
    const regionalTour = engine.createRound({
      ...library.defaults, region: 'Ozeanien', countryRound: { ...countrySettings, selection: 'region', count: 3 },
    });
    expect(new Set(regionalTour.map(({ entity }) => entity.id)).size).toBe(3);
    expect(regionalTour.every(({ entity }) => entity.continent === 'Ozeanien')).toBe(true);
    const nauru = engine.createRound({ ...fullCountry, countryRound: { ...fullCountry.countryRound, countryId: 'NRU' } });
    expect(nauru.map(({ category }) => category)).toEqual(['flag', 'continent', 'currency', 'government_form']);
    const capitalMap = { ...library.defaults, categories: ['capital'], direction: 'forward' as const, format: 'map' as const, length: 'all' as const };
    expect(engine.formatsFor(capitalMap)).toContain('map');
    const capitalQuestions = engine.createRound(capitalMap);
    expect(capitalQuestions).toHaveLength(194);
    const countryMaps = createCountryMaps(topology, definition.map);
    const luxembourg = countryMaps.get('LUX', 'capital')!;
    const [left, top, width] = luxembourg.view;
    expect(luxembourg.invert([left + width, top])[0] - luxembourg.invert([left, top])[0])
      .toBeCloseTo(MIN_CAPITAL_VIEW_SPAN_DEG);
    for (const { entity, point } of capitalQuestions) {
      const map = countryMaps.get(entity.id)!;
      const [left, top, width, height] = map.view;
      const [x, y] = map.project(point!);
      expect(x, entity.id).toBeGreaterThan(left);
      expect(x, entity.id).toBeLessThan(left + width);
      expect(y, entity.id).toBeGreaterThan(top);
      expect(y, entity.id).toBeLessThan(top + height);
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

    const allQuestions = { ...library.defaults, length: 'all' as const };
    const currency = engine.createRound({ ...allQuestions, categories: ['currency'], direction: 'forward', format: 'typed' });
    const bulgaria = currency.find(({ entity }) => entity.id === 'BGR')!;
    expect(bulgaria.answer.name).toBe('Euro');
    expect(bulgaria.match?.('EUR')).toEqual({ id: bulgaria.answer.id, kind: 'exact' });
    expect(bulgaria.match?.('BGN')).toBeUndefined();
    expect(currency.some(({ entity }) => entity.id === 'PSE')).toBe(false);
    const panama = currency.find(({ entity }) => entity.id === 'PAN')!;
    expect(panama.answer.name).toBe('Panamaischer Balboa');
    for (const name of ['Balboa', 'US-Dollar', 'USD']) {
      expect(panama.acceptedIds.has(panama.match!(name)!.id), name).toBe(true);
    }
    const reverseCurrency = engine.createRound({ ...allQuestions, categories: ['currency'], direction: 'reverse', format: 'map' });
    expect(reverseCurrency.find(({ prompt }) => prompt.includes('„US-Dollar“'))?.acceptedIds).toContain('PAN');
    const currencyChoices = engine.createRound({ ...allQuestions, categories: ['currency'], direction: 'forward', format: 'choice' });
    expect(currencyChoices.find(({ entity }) => entity.id === 'PAN')?.options.map(({ name }) => name)).not.toContain('US-Dollar');

    const continents = engine.createRound({ ...allQuestions, categories: ['continent'], direction: 'forward', format: 'typed' });
    const france = continents.find(({ entity }) => entity.id === 'FRA')!;
    expect(france.noteColumn).toBeUndefined();
    expect(france.acceptedIds.has(france.match!('Afrika')!.id)).toBe(false);

    const banks = engine.createRound({ ...allQuestions, categories: ['central_bank'], direction: 'forward', format: 'typed' });
    const bank = banks.find(({ entity }) => entity.id === 'ATG')!;
    expect(bank.match?.('ECCB')).toEqual({ id: bank.answer.id, kind: 'exact' });

    const indexes = { ...allQuestions, categories: ['stock_index'], direction: 'reverse' as const };
    const regionalMembers = ['BEN', 'BFA', 'CIV', 'GNB', 'MLI', 'NER', 'SEN', 'TGO'];
    const mapIndex = engine.createRound({ ...indexes, format: 'map' })
      .find(({ prompt }) => prompt.includes('BRVM Composite'))!;
    expect([...mapIndex.acceptedIds].sort()).toEqual(regionalMembers);
    const caribbeanIndex = engine.createRound({ ...indexes, format: 'map' })
      .find(({ prompt }) => prompt.includes('EC Share Index'))!;
    expect([...caribbeanIndex.acceptedIds].sort()).toEqual(['ATG', 'DMA', 'GRD', 'KNA', 'LCA', 'VCT']);
    const indexChoice = engine.createRound({ ...indexes, format: 'choice' })
      .find(({ prompt }) => prompt.includes('BRVM Composite'))!;
    expect(indexChoice.options.filter(({ id }) => regionalMembers.includes(id))).toEqual([indexChoice.answer]);
    for (const { stock_index, stock_index_status } of entities) {
      if (stock_index) expect(stock_index_status).toBeNull();
      else expect(['Keine Börse', 'Nicht belegt']).toContain(stock_index_status);
    }
    const stockQuestions = engine.createRound({ ...allQuestions, categories: ['stock_index'], direction: 'forward', format: 'typed' });
    expect(stockQuestions.length).toEqual(entities.filter(({ stock_index }) => stock_index).length);
    expect(stockQuestions.some(({ prompt }) => /Keine Börse|Nicht belegt/.test(prompt))).toBe(false);
    expect(stockQuestions.find(({ entity }) => entity.id === 'SRB')?.answer.name).toBe('BELEX15');

    const regimes = engine.createRound({ ...allQuestions, categories: ['regime_type'], direction: 'forward', format: 'choice' });
    const usa = regimes.find(({ entity }) => entity.id === 'USA')!;
    expect(usa.prompt).toContain('V-Dem');
    expect(usa.prompt).toContain('2025');
    expect(usa.source).toBe('nach V-Dem 2025');
    expect(usa.answer.name).toBe('Wahldemokratie');
    expect(regimes.some(({ entity }) => entity.id === 'PSE' || entity.id === 'SOM')).toBe(false);
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

  it('requires configured points for populated values and rejects points outside the entity', async () => {
    const settings: Partial<SetDefinition> = {
      attributes: [{ key: 'capital', label: 'Hauptstadt', type: 'text', point: { lat: 'lat', lon: 'lon', required: true } }],
    };
    const columns = 'id;name;capital;lat;lon\n';
    await fixture('world', columns + 'AAA;Ort;Stadt;0.25;0.25\n', ['AAA'], settings);
    expect((await buildData(sources, output)).errors).toEqual([]);
    await fixture('world', columns + 'AAA;Ort;Stadt;4;4\nBBB;Ort;Stadt;;\n', ['AAA', 'BBB'], settings);
    expect((await buildData(sources, output)).errors).toEqual([
      expect.stringContaining('Breiten- und Längengrad'),
      expect.stringContaining('Punkt für "capital" liegt außerhalb'),
    ]);
  });
});

it('uses the nearest coastline for automatic outlines and applies per-part overrides', () => {
  const block = (left: number, right: number, high: number) =>
    [[left, 0], [left, high], [right, high], [right, 0], [left, 0]];
  const topology = {
    type: 'Topology',
    objects: { areas: { type: 'MultiPolygon', id: 'AAA', arcs: [[[0]], [[1]], [[2]], [[3]]] } },
    arcs: [block(-30, 0, 10), block(10, 11, 1), block(28, 29, 1), block(70, 80, 10)],
  };
  const definition: SetDefinition = {
    id: 'test', label: 'Test', attributes: [], entityLabel: 'Land', entityLabelPlural: 'Länder', parent: null,
    map: { file: 'map.topojson', object: 'areas', idProperty: 'id', projection: 'miller' },
  };
  const issues = { errors: [], warnings: [] };
  const automatic = addCoreOutlines(JSON.stringify(topology), definition, issues);
  expect(automatic.excluded.get('AAA')).toEqual([3]);
  const manual = addCoreOutlines(JSON.stringify(topology), {
    ...definition, outline: { include: { AAA: [[28.5, .5]] }, exclude: { AAA: [[10.5, .5]] } },
  }, issues);
  expect(manual.excluded.get('AAA')).toEqual([2]);
  expect(issues.errors).toEqual([]);
});
