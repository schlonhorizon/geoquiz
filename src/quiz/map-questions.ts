import type { Entity } from '../data/schema';

export type MapMode = 'find' | 'name';

export interface MapQuestion {
  target: Entity;
  options: Entity[];
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
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
  previousId?: string,
  random: () => number = Math.random,
): MapQuestion {
  const eligible = entities.length > 1 ? entities.filter(({ id }) => id !== previousId) : entities;
  const target = eligible[Math.floor(random() * eligible.length)];
  if (!target) throw new Error('The map quiz needs at least one entity');
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
