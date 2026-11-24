import { describe, expect, it } from 'vitest';
import type { Entity } from '../data/schema';
import { createMapQuestion, createMapRound } from './map-questions';

const countries: Entity[] = [
  { id: 'DEU', name: 'Deutschland', name_aliases: [], continent: 'Europa' },
  { id: 'FRA', name: 'Frankreich', name_aliases: [], continent: 'Europa' },
  { id: 'BEL', name: 'Belgien', name_aliases: [], continent: 'Europa' },
  { id: 'CHE', name: 'Schweiz', name_aliases: [], continent: 'Europa' },
  { id: 'BRA', name: 'Brasilien', name_aliases: [], continent: 'Südamerika' },
];

describe('world map questions', () => {
  it('selects 20 distinct countries in Find and leaves the options empty', () => {
    const pool = Array.from({ length: 25 }, (_, index) => ({ ...countries[0], id: String(index) }));
    const questions = createMapRound(pool, 'find', () => 0);
    expect(questions).toHaveLength(20);
    expect(new Set(questions.map(({ target }) => target.id)).size).toBe(20);
    expect(questions.every(({ options }) => options.length === 0)).toBe(true);
  });

  it('gives four different choices with one correct answer and prefers the same continent', () => {
    const question = createMapQuestion(countries, 'name', countries[0], () => 0);
    expect(question.target.id).toBe('DEU');
    expect(question.options).toHaveLength(4);
    expect(new Set(question.options.map(({ name }) => name)).size).toBe(4);
    expect(question.options.filter(({ id }) => id === 'DEU')).toHaveLength(1);
    expect(question.options.every(({ continent }) => continent === 'Europa')).toBe(true);
  });

  it('fills the remaining choices from elsewhere when the continent has few countries', () => {
    const question = createMapQuestion(countries, 'name', countries[4], () => 0.99);
    expect(question.target.id).toBe('BRA');
    expect(question.options).toHaveLength(4);
    expect(question.options.filter(({ id }) => id === 'BRA')).toHaveLength(1);
  });

  it('keeps using the full pool for the final naming question in a small set', () => {
    const round = createMapRound(countries, 'name', () => 0);
    expect(round).toHaveLength(countries.length);
    expect(round.at(-1)?.options).toHaveLength(4);
  });
});
