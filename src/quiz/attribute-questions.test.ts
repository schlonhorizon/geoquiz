import { describe, expect, it } from 'vitest';
import type { QuizSet } from '../data/load';
import type { SetDefinition } from '../data/schema';
import { createAttributeEngine } from './attribute-questions';
import type { AttributeRoundSettings } from './attribute-questions';

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

const engine = createAttributeEngine(set);
const round = (settings: Omit<AttributeRoundSettings, 'length'>, source = engine) =>
  source.createRound({ length: Infinity, ...settings }, () => 0.99);

describe('attribute questions', () => {
  it('uses configured prompts and matches attribute aliases and typos against all values', () => {
    const questions = round({ category: 'capital', direction: 'forward', format: 'typed', region: 'Asien' });
    const tokio = questions.find(({ answer }) => answer.name === 'Tokio')!;
    expect(tokio.prompt).toBe('Was ist die Hauptstadt von Japan?');
    expect(tokio.match!('Tokyo')).toEqual({ id: tokio.answer.id, kind: 'exact' });
    expect(tokio.match!('Tokoi')).toEqual({ id: tokio.answer.id, kind: 'typo' });
    expect(tokio.acceptedIds.has(tokio.match!('Berlin')!.id)).toBe(false);
    expect(round({ category: 'capital', direction: 'forward', format: 'typed' })).toHaveLength(7);
  });

  it('uses all fixed enum options when there are at most four, and excludes other correct countries in reverse', () => {
    const forward = round({ category: 'continent', direction: 'forward', format: 'choice' });
    expect(forward.every(({ options }) => options.length === 3)).toBe(true);
    expect(new Set(forward[0].options.map(({ name }) => name))).toEqual(new Set(['Europa', 'Asien', 'Afrika']));
    const reverse = round({ category: 'continent', direction: 'reverse', format: 'choice', region: 'Europa' });
    expect(reverse).toHaveLength(1);
    expect(reverse[0].options).toHaveLength(4);
    const european = new Set(['AUT', 'DEU', 'FRA']);
    expect(reverse[0].options.filter(({ id }) => european.has(id))).toEqual([reverse[0].answer]);
  });

  it('accepts any correct country when typed or marked on the map for a shared value', () => {
    const enumQuestion = round({ category: 'continent', direction: 'reverse', format: 'typed', region: 'Europa' })[0];
    expect(enumQuestion.match!('Oesterreich')).toEqual({ id: 'AUT', kind: 'exact' });
    expect(enumQuestion.acceptedIds).toEqual(new Set(['AUT', 'DEU', 'FRA']));

    const shared = createAttributeEngine({
      ...set,
      entities: set.entities.map((entity) => entity.id === 'DEU' ? { ...entity, capital: 'Wien' } : entity),
    });
    const map = round({ category: 'capital', direction: 'reverse', format: 'map', region: 'Europa' }, shared)
      .find(({ prompt }) => prompt.includes('Wien'))!;
    expect(map.prompt).toBe('Wo ist Wien Hauptstadt? Markiere es auf der Karte.');
    expect(map.acceptedIds).toEqual(new Set(['AUT', 'DEU']));
  });

  it('prefers configured flag distractors and neighbors and supports both flag directions', () => {
    const forward = round({ category: 'flag', direction: 'forward', format: 'choice' }).find(({ answer }) => answer.id === 'AUT')!;
    expect(forward.prompt).toBe('Welche Flagge gehört zu Österreich?');
    expect(forward.options.map(({ flag }) => flag)).toEqual(expect.arrayContaining(['at', 'de', 'id']));
    expect(forward.options).toHaveLength(4);
    const reverse = round({ category: 'flag', direction: 'reverse', format: 'choice' }).find(({ flag }) => flag === 'at')!;
    expect(reverse.prompt).toBe('Welches Land ist das?');
    expect(reverse.options.every(({ flag }) => !flag)).toBe(true);
    expect(round({ category: 'flag', direction: 'forward', format: 'typed' })).toEqual([]);
  });

  it('mixes configured categories and directions, filters the region and limits the round', () => {
    expect(engine.categories.map(({ key }) => key)).toEqual(['capital', 'continent', 'flag']);
    let seed = 1;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const all = engine.createRound({ format: 'mixed', region: 'Asien', length: Infinity }, random);
    expect(new Set(all.map(({ direction }) => direction))).toEqual(new Set(['forward', 'reverse']));
    expect(new Set(all.map(({ category }) => category))).toEqual(new Set(['capital', 'continent', 'flag']));
    expect(new Set(all.map(({ format }) => format))).toEqual(new Set(['choice', 'typed']));
    expect(all.filter(({ direction }) => direction === 'reverse').every(({ answer }) => ['JPN', 'IDN'].includes(answer.id))).toBe(true);
    expect(engine.createRound({ format: 'mixed', region: 'Asien', length: 10 })).toHaveLength(10);
  });

  it('respects enabled variants from the attribute definition', () => {
    const filtered = createAttributeEngine({
      ...set,
      definition: {
        ...definition,
        attributes: [{ ...definition.attributes[0], modes: ['reverse-typed'] }],
      },
    });
    expect(round({ format: 'choice' }, filtered)).toEqual([]);
    const questions = round({ format: 'mixed' }, filtered);
    expect(questions).toHaveLength(7);
    expect(questions.every(({ direction, format }) => direction === 'reverse' && format === 'typed')).toBe(true);
  });
});
