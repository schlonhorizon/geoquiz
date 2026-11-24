import type { Entity, SetDefinition, SetIndex } from './schema';

export interface QuizSet {
  definition: SetDefinition;
  entities: Entity[];
}

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading ${file}`);
  }
  return response.json();
}

export async function loadSets(): Promise<QuizSet[]> {
  const index = await fetchJson<SetIndex>('index.json');
  return Promise.all(index.sets.map(async (id) => {
    const directory = `sets/${id}`;
    const [definition, entities] = await Promise.all([
      fetchJson<SetDefinition>(`${directory}/set.json`),
      fetchJson<Entity[]>(`${directory}/entities.json`),
    ]);
    return { definition, entities };
  }));
}
