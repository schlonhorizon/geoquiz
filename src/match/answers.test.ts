import { describe, expect, it } from 'vitest';
import { createAnswerMatcher, normalizeAnswer, typoTolerance } from './answers';
import { damerauLevenshtein } from './damerau-levenshtein';

const match = createAnswerMatcher([
  { id: 'DE-RP', name: 'Rheinland-Pfalz', name_aliases: [] },
  { id: 'NER', name: 'Niger', name_aliases: [] },
  { id: 'NGA', name: 'Nigeria', name_aliases: [] },
  { id: 'AUS', name: 'Australien', name_aliases: [] },
  { id: 'AUT', name: 'Österreich', name_aliases: ['Austria'] },
  { id: 'CIV', name: 'Elfenbeinküste', name_aliases: ["Côte d'Ivoire"] },
  { id: 'DE-MUC', name: 'München', name_aliases: [] },
  { id: 'ZAF', name: 'Südafrika', name_aliases: ['Pretoria', 'Kapstadt'] },
  { id: 'USA', name: 'Vereinigte Staaten von Amerika', name_aliases: ['USA'] },
]);

describe('typed answers', () => {
  it.each([
    ['rehinlant-plfaz', 'DE-RP', 'typo'],
    ['Rheinland Pfalz', 'DE-RP', 'exact'],
    ['rheinlandpfalz', 'DE-RP', 'exact'],
    ['Niger', 'NGA', 'incorrect'],
    ['Austria', 'AUS', 'incorrect'],
    ["Cote d'Ivoire", 'CIV', 'exact'],
    ['Côte d’Ivoire', 'CIV', 'exact'],
    ['Muenchen', 'DE-MUC', 'exact'],
    ['Pretoria', 'ZAF', 'exact'],
    ['Kapstadt', 'ZAF', 'exact'],
  ] as const)('matches %s against %s as %s', (input, id, result) => {
    expect(match(input, id)).toBe(result);
  });

  it('normalizes combining marks, German umlauts and punctuation', () => {
    expect(normalizeAnswer('  A\u0308. Ö–Ü Straßeʼ ')).toBe('aeoeuestrasse');
    expect(normalizeAnswer('Mu\u0308nchen')).toBe(normalizeAnswer('Muenchen'));
    expect(match(' – ', 'AUS')).toBe('incorrect');
  });

  it('implements the exact tolerance boundaries and keeps short aliases exact', () => {
    expect([4, 5, 7, 8, 11, 12, 15].map(typoTolerance)).toEqual([0, 1, 1, 2, 2, 4, 5]);
    expect(match('UAS', 'USA')).toBe('incorrect');
  });

  it('rejects Austria as too distant even without an exact competitor', () => {
    const onlyAustralia = createAnswerMatcher([{ id: 'AUS', name: 'Australien', name_aliases: [] }]);
    expect(onlyAustralia('Austria', 'AUS')).toBe('incorrect');
  });

  it('rejects an ambiguous closest answer across entities', () => {
    const ambiguous = createAnswerMatcher([
      { id: 'one', name: 'Finland', name_aliases: [] },
      { id: 'two', name: 'Vinland', name_aliases: [] },
    ]);
    expect(ambiguous('Dinland', 'one')).toBe('incorrect');
  });

  it('supports transpositions followed by another edit', () => {
    expect(damerauLevenshtein(['C', 'A'], ['A', 'B', 'C'])).toBe(2);
  });
});
