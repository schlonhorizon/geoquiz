import type { Entity } from '../data/schema';

export type MapMode = 'find' | 'name';

export interface MapQuestion {
  target: Entity;
  options: Entity[];
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

export function createMapQuestion(
  entities: readonly Entity[],
  mode: MapMode,
  target: Entity,
  random: () => number = Math.random,
): MapQuestion {
  if (mode === 'find') return { target, options: [] };

  const alternatives = shuffle(entities.filter(({ id }) => id !== target.id), random);
  const sameContinent = alternatives.filter(({ continent }) => continent && continent === target.continent);
  const elsewhere = alternatives.filter((entity) => !sameContinent.includes(entity));
  const options = new Map([[target.name, target]]);
  for (const entity of [...sameContinent, ...elsewhere]) {
    if (!options.has(entity.name)) options.set(entity.name, entity);
    if (options.size === 4) break;
  }
  if (options.size < 4) throw new Error('Naming questions need four distinct country names');
  return { target, options: shuffle([...options.values()], random) };
}

export function createMapRound(
  entities: readonly Entity[],
  mode: MapMode,
  random: () => number = Math.random,
): MapQuestion[] {
  return shuffle(entities, random).slice(0, 20)
    .map((target) => createMapQuestion(entities, mode, target, random));
}
