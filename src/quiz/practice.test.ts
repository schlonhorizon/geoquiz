import { describe, expect, it } from 'vitest';
import type { QuizSet } from '../data/load';
import type { SetDefinition } from '../data/schema';
import { createPracticeEngine } from './practice';
import type { RoundSettings } from './round-settings';

const definition: SetDefinition = {
  id: 'world',
  label: 'Welt',
  entityLabel: 'Land',
  entityLabelPlural: 'Länder',
  parent: null,
  map: { file: 'map.topojson', object: 'countries', idProperty: 'id', projection: 'miller' },
  attributes: [
    {
      key: 'capital',
      label: 'Hauptstadt',
      type: 'text',
      aliasesColumn: 'capital_aliases',
      prompts: { forward: 'Was ist die Hauptstadt von {entity}?', reverse: 'Wo ist {value} Hauptstadt?' },
    },
    { key: 'continent', label: 'Kontinent', type: 'enum', values: ['Europa', 'Asien', 'Afrika'] },
    { key: 'flag', label: 'Flagge', type: 'flag' },
    { key: 'currency', label: 'Währung', type: 'text' },
    { key: 'hidden', label: 'Intern', type: 'text', quiz: false },
  ],
};

const set: QuizSet = {
  definition,
  entities: [
    { id: 'AUT', name: 'Österreich', name_aliases: [], capital: 'Wien', continent: 'Europa', flag: 'at', flag_similar: ['IDN'], neighbors: ['DEU'], hidden: 'intern' },
    { id: 'DEU', name: 'Deutschland', name_aliases: [], capital: 'Berlin', continent: 'Europa', flag: 'de' },
    { id: 'FRA', name: 'Frankreich', name_aliases: [], capital: 'Paris', continent: 'Europa', flag: 'fr' },
    { id: 'JPN', name: 'Japan', name_aliases: [], capital: 'Tokio', capital_aliases: ['Tokyo'], continent: 'Asien', flag: 'jp' },
    { id: 'IDN', name: 'Indonesien', name_aliases: [], capital: 'Jakarta', continent: 'Asien', flag: 'id' },
    { id: 'EGY', name: 'Ägypten', name_aliases: [], capital: 'Kairo', continent: 'Afrika', flag: 'eg' },
    { id: 'NGA', name: 'Nigeria', name_aliases: [], capital: 'Abuja', continent: 'Afrika', flag: 'ng' },
    { id: 'ZAF', name: 'Südafrika', name_aliases: [], capital: null, continent: 'Afrika', flag: 'za' },
  ],
};

const engine = createPracticeEngine(set);
const defaults: RoundSettings = {
  categories: 'all', direction: 'mixed', format: 'choice', order: 'mixed', region: '', difficulty: 'all', length: 'all',
};
const round = (settings: Partial<RoundSettings>, source = engine) =>
  source.createRound({ ...defaults, ...settings }, () => 0.99);

describe('attribute questions', () => {
  it('uses configured prompts and matches attribute aliases and typos against all values', () => {
    const questions = round({ categories: ['capital'], direction: 'forward', format: 'typed', region: 'Asien' });
    const tokio = questions.find(({ answer }) => answer.name === 'Tokio')!;
    expect(tokio.prompt).toBe('Was ist die Hauptstadt von Japan?');
    expect(tokio.match!('Tokyo')).toEqual({ id: tokio.answer.id, kind: 'exact' });
    expect(tokio.match!('Tokoi')).toEqual({ id: tokio.answer.id, kind: 'typo' });
    expect(tokio.acceptedIds.has(tokio.match!('Berlin')!.id)).toBe(false);
    expect(round({ categories: ['capital'], direction: 'forward', format: 'typed' })).toHaveLength(7);
  });

  it('uses all fixed enum options when there are at most four, and excludes other correct countries in reverse', () => {
    const forward = round({ categories: ['continent'], direction: 'forward', format: 'choice' });
    expect(forward.every(({ options }) => options.length === 3)).toBe(true);
    expect(new Set(forward[0].options.map(({ name }) => name))).toEqual(new Set(['Europa', 'Asien', 'Afrika']));
    const reverse = round({ categories: ['continent'], direction: 'reverse', format: 'choice', region: 'Europa' });
    expect(reverse).toHaveLength(1);
    expect(reverse[0].options).toHaveLength(4);
    const european = new Set(['AUT', 'DEU', 'FRA']);
    expect(reverse[0].options.filter(({ id }) => european.has(id))).toEqual([reverse[0].answer]);
  });

  it('accepts any correct country when typed or marked on the map for a shared value', () => {
    const enumQuestion = round({ categories: ['continent'], direction: 'reverse', format: 'typed', region: 'Europa' })[0];
    expect(enumQuestion.match!('Oesterreich')).toEqual({ id: 'AUT', kind: 'exact' });
    expect(enumQuestion.acceptedIds).toEqual(new Set(['AUT', 'DEU', 'FRA']));

    const shared = createPracticeEngine({
      ...set,
      entities: set.entities.map((entity) => entity.id === 'DEU' ? { ...entity, capital: 'Wien' } : entity),
    });
    const map = round({ categories: ['capital'], direction: 'reverse', format: 'map', region: 'Europa' }, shared)
      .find(({ prompt }) => prompt.includes('Wien'))!;
    expect(map.prompt).toBe('Wo ist Wien Hauptstadt? Markiere es auf der Karte.');
    expect(map.acceptedIds).toEqual(new Set(['AUT', 'DEU']));
  });

  it('prefers configured flag distractors and neighbors and supports both flag directions', () => {
    const forward = round({ categories: ['flag'], direction: 'forward', format: 'choice' }).find(({ answer }) => answer.id === 'AUT')!;
    expect(forward.prompt).toBe('Welche Flagge gehört zu Österreich?');
    expect(forward.options.map(({ flag }) => flag)).toEqual(expect.arrayContaining(['at', 'de', 'id']));
    expect(forward.options).toHaveLength(4);
    const reverse = round({ categories: ['flag'], direction: 'reverse', format: 'choice' }).find(({ flag }) => flag === 'at')!;
    expect(reverse.prompt).toBe('Welches Land ist das?');
    expect(reverse.options.every(({ flag }) => !flag)).toBe(true);
    expect(round({ categories: ['flag'], direction: 'forward', format: 'typed' })).toEqual([]);
  });

  it('mixes selected categories and directions with one answer format and region', () => {
    expect(engine.categories.map(({ key }) => key)).toEqual(['location', 'capital', 'continent', 'flag']);
    const questions = round({ categories: ['capital', 'location'], region: 'Asien' });
    expect(new Set(questions.map(({ direction }) => direction))).toEqual(new Set(['forward', 'reverse']));
    expect(new Set(questions.map(({ category }) => category))).toEqual(new Set(['location', 'capital']));
    expect(questions.every(({ entity, format }) => entity.continent === 'Asien' && format === 'choice')).toBe(true);
    expect(round({ length: 10 })).toHaveLength(10);
  });

  it('groups questions consecutively for each country before applying the round length', () => {
    const questions = round({ categories: ['capital', 'continent'], order: 'country', length: 10 });
    const runs = questions.map(({ entity }) => entity.id).filter((id, index, ids) => id !== ids[index - 1]);
    expect(new Set(runs).size).toBe(runs.length);
    expect(runs.length).toBeLessThan(questions.length);
    expect(questions).toHaveLength(10);
  });

  it('provides map picking and country naming through the same location category', () => {
    const find = { ...defaults, categories: ['location'], direction: 'forward', format: 'map' } satisfies RoundSettings;
    expect(engine.formatsFor(find)).toEqual(new Set(['map']));
    const countries = Array.from({ length: 25 }, (_, index) => ({ ...set.entities[0], id: String(index) }));
    const questions = round({ ...find, length: 20 }, createPracticeEngine({ ...set, entities: countries }));
    expect(questions).toHaveLength(20);
    expect(new Set(questions.map(({ entity }) => entity.id)).size).toBe(20);
    expect(questions.every(({ options }) => !options.length)).toBe(true);
    expect(questions[0].prompt).toContain(questions[0].entity.name);

    const name = { ...find, direction: 'reverse', format: 'choice' } satisfies RoundSettings;
    expect(engine.formatsFor(name)).toEqual(new Set(['choice', 'typed']));
    const all = round(name);
    expect(all).toHaveLength(set.entities.length);
    expect(all.every(({ options, answer }) => options.length === 4 && options.filter(({ id }) => id === answer.id).length === 1)).toBe(true);
    const european = all.find(({ entity }) => entity.id === 'AUT')!;
    const countriesById = new Map(set.entities.map((entity) => [entity.id, entity]));
    expect(european.options.filter(({ id }) => countriesById.get(id)?.continent === 'Europa')).toHaveLength(3);
    const typing = round({ ...name, format: 'typed' }).find(({ entity }) => entity.id === 'AUT')!;
    expect(typing.match?.('Oesterreich')).toEqual({ id: 'AUT', kind: 'exact' });
  });

  it('respects enabled variants from the attribute definition', () => {
    const filtered = createPracticeEngine({
      ...set,
      definition: {
        ...definition,
        attributes: [{ ...definition.attributes[0], modes: ['reverse-typed'] }],
      },
    });
    expect(round({ categories: ['capital'], format: 'choice' }, filtered)).toEqual([]);
    const questions = round({ categories: ['capital'], format: 'typed' }, filtered);
    expect(questions).toHaveLength(7);
    expect(questions.every(({ direction, format }) => direction === 'reverse' && format === 'typed')).toBe(true);
  });
});
