import type { Entity } from '../data/schema';
import { damerauLevenshtein } from './damerau-levenshtein';

type Candidate = Pick<Entity, 'id' | 'name' | 'name_aliases'>;

export function normalizeAnswer(text: string): string {
  return text.normalize('NFC').toLowerCase()
    .replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss')
    .normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[\s\p{Dash_Punctuation}'‘’ʼ.]/gu, '');
}

export function typoTolerance(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  if (length <= 11) return 2;
  return Math.round(length * 0.3);
}

export function createAnswerMatcher(entities: readonly Candidate[]) {
  const bySpelling = new Map<string, Set<string>>();
  for (const { id, name, name_aliases } of entities) {
    for (const spelling of [name, ...name_aliases]) {
      const normalized = normalizeAnswer(spelling);
      if (!normalized) continue;
      let ids = bySpelling.get(normalized);
      if (!ids) {
        ids = new Set();
        bySpelling.set(normalized, ids);
      }
      ids.add(id);
    }
  }

  const spellings = [...bySpelling].map(([spelling, ids]) => ({ letters: Array.from(spelling), ids }));
  const maxLength = spellings.reduce((length, { letters }) => Math.max(length, letters.length), 0);

  return (input: string, correctId: string): 'exact' | 'typo' | 'incorrect' => {
    const normalized = normalizeAnswer(input);
    if (!normalized) return 'incorrect';
    const exact = bySpelling.get(normalized);
    if (exact) return exact.size === 1 && exact.has(correctId) ? 'exact' : 'incorrect';

    const letters = Array.from(normalized);
    if (letters.length > maxLength + typoTolerance(maxLength)) return 'incorrect';
    let bestDistance = Number.POSITIVE_INFINITY;
    const bestIds = new Set<string>();
    let withinTolerance = false;
    for (const spelling of spellings) {
      if (Math.abs(spelling.letters.length - letters.length) > bestDistance) continue;
      const distance = damerauLevenshtein(letters, spelling.letters);
      if (distance > bestDistance) continue;

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIds.clear();
        withinTolerance = false;
      }
      for (const id of spelling.ids) bestIds.add(id);
      if (spelling.ids.has(correctId) && distance <= typoTolerance(spelling.letters.length)) {
        withinTolerance = true;
      }
    }

    return bestIds.size === 1 && bestIds.has(correctId) && withinTolerance ? 'typo' : 'incorrect';
  };
}
