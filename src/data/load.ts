import type { Topology } from 'topojson-specification';
import type { PresetLibrary } from '../quiz/round-settings';
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

export function loadMap({ id, map }: SetDefinition): Promise<Topology> {
  return fetchJson(`sets/${id}/${map.file}`);
}

export interface MapResources {
  water?: Topology;
  loadDetail?: () => Promise<Topology>;
  renderUrl?: (level: 'overview' | 'detail') => string | undefined;
}

export async function loadMapResources({ id, map }: SetDefinition): Promise<MapResources> {
  const water = map.waterFile ? await fetchJson<Topology>(`sets/${id}/${map.waterFile}`).catch((error: unknown) => {
    console.warn('Die Gewässerübersicht konnte nicht geladen werden.', error);
    return undefined;
  }) : undefined;
  const detailFile = map.detailFile;
  let detail: Promise<Topology> | undefined;
  return {
    water,
    renderUrl: (level) => {
      if (map.projection !== 'miller') return;
      const file = level === 'overview' ? map.file : detailFile;
      return file ? new URL(`${import.meta.env.BASE_URL}data/sets/${id}/${file}`, window.location.href).href : undefined;
    },
    loadDetail: detailFile ? () => detail ??= fetchJson<Topology>(`sets/${id}/${detailFile}`).catch((error: unknown) => {
      detail = undefined;
      throw error;
    }) : undefined,
  };
}

export function loadPresets(): Promise<PresetLibrary> {
  return fetchJson('presets.json');
}
