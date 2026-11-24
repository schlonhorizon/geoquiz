import { describe, expect, it } from 'vitest';
import type { Entity } from '../data/schema';
import { createMapQuestion } from './map-questions';

const countries: Entity[] = [
  { id: 'DEU', name: 'Deutschland', name_aliases: [], continent: 'Europa' },
  { id: 'FRA', name: 'Frankreich', name_aliases: [], continent: 'Europa' },
  { id: 'BEL', name: 'Belgien', name_aliases: [], continent: 'Europa' },
  { id: 'CHE', name: 'Schweiz', name_aliases: [], continent: 'Europa' },
  { id: 'BRA', name: 'Brasilien', name_aliases: [], continent: 'Südamerika' },
];

describe('world map questions', () => {
  it('asks for another country on the next turn and leaves Find options empty', () => {
    const question = createMapQuestion(countries, 'find', 'DEU', () => 0);
    expect(question.target.id).toBe('FRA');
    expect(question.options).toEqual([]);
  });

  it('gives four different choices with one correct answer and prefers the same continent', () => {
    const question = createMapQuestion(countries, 'name', undefined, () => 0);
    expect(question.target.id).toBe('DEU');
    expect(question.options).toHaveLength(4);
    expect(new Set(question.options.map(({ name }) => name)).size).toBe(4);
    expect(question.options.filter(({ id }) => id === 'DEU')).toHaveLength(1);
    expect(question.options.every(({ continent }) => continent === 'Europa')).toBe(true);
  });

  it('fills the remaining choices from elsewhere when the continent has few countries', () => {
    const question = createMapQuestion(countries, 'name', undefined, () => 0.99);
    expect(question.target.id).toBe('BRA');
    expect(question.options).toHaveLength(4);
    expect(question.options.filter(({ id }) => id === 'BRA')).toHaveLength(1);
  });
});
