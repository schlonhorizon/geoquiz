import type { QuizSet } from '../data/load';
import type { AttributeDefinition, Entity } from '../data/schema';
import { createAnswerLookup, normalizeAnswer } from '../match/answers';
import { shuffle } from './shuffle';
import type { AnswerFormat, Direction, RoundSettings } from './round-settings';

export interface AnswerOption {
  id: string;
  name: string;
  flag?: string;
}

export interface PracticeQuestion {
  entity: Entity;
  category: string;
  direction: Direction;
  prompt: string;
  format: AnswerFormat;
  answerLabel: string;
  answer: AnswerOption;
  options: AnswerOption[];
  flag?: string;
  acceptedIds: ReadonlySet<string>;
  match?: ReturnType<typeof createAnswerLookup>;
}

const directions: Direction[] = ['forward', 'reverse'];

export const locationCategory = { key: 'location', label: 'Lage', type: 'location' } as const;
type Category = AttributeDefinition | typeof locationCategory;

function categoryFormats(attribute: Category, direction: Direction): AnswerFormat[] {
  if (attribute.type === 'location') return direction === 'forward' ? ['map'] : ['choice', 'typed'];
  const formats: AnswerFormat[] = ['choice'];
  if (attribute.type !== 'flag' || direction === 'reverse') formats.push('typed');
  if (attribute.type === 'text' && direction === 'reverse') formats.push('map');
  return formats.filter((format) => !attribute.modes || attribute.modes.some((mode) =>
    mode === direction || mode === format || mode === `${direction}-${format}`));
}

function list(entity: Entity, key: string): string[] {
  const value = entity[key];
  return Array.isArray(value) ? value : [];
}

function distinctOptions(options: AnswerOption[]): AnswerOption[] {
  const names = new Set<string>();
  return options.filter(({ name }) => {
    const normalized = normalizeAnswer(name);
    if (names.has(normalized)) return false;
    names.add(normalized);
    return true;
  });
}

function questionPrompt(attribute: AttributeDefinition, entity: Entity, value: string, direction: Direction, format: AnswerFormat) {
  let template: string;
  if (attribute.type === 'flag') {
    template = direction === 'forward' ? 'Welche Flagge gehört zu {entity}?' : 'Welches Land ist das?';
  } else if (format === 'map') {
    const reverse = attribute.prompts?.reverse ?? `Welches Land hat „{value}“ als ${attribute.label}?`;
    template = attribute.prompts?.reverseMap ?? `${reverse} Markiere es auf der Karte.`;
  } else if (direction === 'forward') {
    template = `Was ist der Wert für „${attribute.label}“ bei {entity}?`;
  } else {
    template = `Welches Land hat „{value}“ als ${attribute.label}?`;
  }
  return (format === 'map' ? template : attribute.prompts?.[direction] ?? template)
    .replace(/\{(entity|value)\}/g, (_, field) => field === 'entity' ? entity.name : value);
}

export function createPracticeEngine({ definition, entities }: QuizSet) {
  const nameMatch = createAnswerLookup(entities);
  const regions = [...new Set(entities.flatMap(({ continent }) => typeof continent === 'string' ? [continent] : []))]
    .sort((a, b) => a.localeCompare(b, 'de'));
  const attributes = definition.attributes.flatMap((attribute) => {
    if (attribute.quiz === false || !['text', 'enum', 'flag'].includes(attribute.type)) return [];
    const groups = new Map<string, { value: string; members: Entity[] }>();
    for (const entity of entities) {
      const value = entity[attribute.key];
      if (typeof value !== 'string' || !value.trim()) continue;
      const id = normalizeAnswer(value);
      const group = groups.get(id);
      if (group) group.members.push(entity);
      else groups.set(id, { value, members: [entity] });
    }
    if (!groups.size || !directions.some((direction) => categoryFormats(attribute, direction).length)) return [];

    const candidates = [...groups].map(([id, { value, members }]) => ({
      id,
      name: value,
      name_aliases: attribute.aliasesColumn ? members.flatMap((entity) => list(entity, attribute.aliasesColumn!)) : [],
    }));
    const values = attribute.type === 'enum'
      ? distinctOptions(attribute.values.map((name) => ({ id: normalizeAnswer(name), name })))
      : candidates.map(({ id, name }) => ({ id, name }));
    const valueMatch = createAnswerLookup(attribute.type === 'enum'
      ? [...candidates, ...values.filter(({ id }) => !groups.has(id)).map((option) => ({ ...option, name_aliases: [] }))]
      : candidates);
    return [{ attribute, groups, values, valueMatch }];
  });

  const categories = [locationCategory, ...attributes.map(({ attribute }) => attribute)];
  const selected = (key: string, settings: RoundSettings) =>
    settings.categories === 'all' || settings.categories.includes(key);
  const inRegion = (entity: Entity, settings: RoundSettings) => !settings.region || entity.continent === settings.region;
  const inDirection = (direction: Direction, settings: RoundSettings) =>
    settings.direction === 'mixed' || settings.direction === direction;

  function formatsFor(settings: RoundSettings) {
    return new Set(categories.filter(({ key }) => selected(key, settings))
      .flatMap((category) => directions.filter((direction) => inDirection(direction, settings))
        .flatMap((direction) => categoryFormats(category, direction))));
  }

  function locationQuestion(entity: Entity, direction: Direction, format: AnswerFormat, random: () => number): PracticeQuestion | undefined {
    const answer = { id: entity.id, name: entity.name };
    const choices = format === 'choice'
      ? countryChoices(answer, entity, entities.filter(({ id }) => id !== entity.id), random)
      : [];
    if (format === 'choice' && choices.length < 4) return;
    const map = definition.map.prompts;
    return {
      entity, category: 'location', direction, format, answer,
      prompt: direction === 'forward'
        ? (map?.find ?? 'Wo liegt {entity}?').replace('{entity}', () => entity.name)
        : map?.name ?? 'Wie heißt das hervorgehobene Gebiet?',
      answerLabel: definition.entityLabel,
      options: choices,
      acceptedIds: new Set([entity.id]),
      match: format === 'typed' ? nameMatch : undefined,
    };
  }

  function createRound(settings: RoundSettings, random = Math.random): PracticeQuestion[] {
    const questions: PracticeQuestion[] = [];
    const eligible = entities.filter((entity) => inRegion(entity, settings));
    if (selected('location', settings)) {
      for (const direction of directions) {
        if (!inDirection(direction, settings) || !categoryFormats(locationCategory, direction).includes(settings.format)) continue;
        for (const entity of eligible) {
          const question = locationQuestion(entity, direction, settings.format, random);
          if (question) questions.push(question);
        }
      }
    }
    for (const { attribute, groups, values, valueMatch } of attributes) {
      if (!selected(attribute.key, settings)) continue;
      const populated = [...groups.values()].flatMap(({ members }) => members);
      for (const direction of directions) {
        if (!inDirection(direction, settings) || !categoryFormats(attribute, direction).includes(settings.format)) continue;
        const reverse = direction === 'reverse';
        const flag = attribute.type === 'flag';
        const { format } = settings;
        for (const [valueId, { value, members }] of groups) {
          const local = members.filter((entity) => inRegion(entity, settings));
          const targets = reverse && settings.order === 'mixed' ? shuffle(local, random).slice(0, 1) : local;
          for (const entity of targets) {
            const answer = reverse ? { id: entity.id, name: entity.name }
              : flag ? { id: entity.id, name: entity.name, flag: value }
                : { id: valueId, name: String(entity[attribute.key]) };
            let options: AnswerOption[] = [];
            if (format === 'choice') {
              if (reverse || flag) {
                const sameValue = new Set(members.map(({ id }) => id));
                options = countryChoices(answer, entity, populated.filter(({ id }) => !sameValue.has(id)), random,
                  flag ? attribute.key : undefined, flag && !reverse);
              } else {
                const choices = shuffle(values.filter(({ id }) => id !== valueId), random);
                if (attribute.type === 'text') {
                  const isLocal = (id: string) => groups.get(id)?.members.some(({ continent }) => continent && continent === entity.continent);
                  choices.sort((a, b) => Number(Boolean(isLocal(b.id))) - Number(Boolean(isLocal(a.id))));
                }
                options = shuffle([answer, ...choices.slice(0, 3)], random);
              }
              const needed = !reverse && attribute.type === 'enum' ? Math.max(2, Math.min(4, values.length)) : 4;
              if (options.length < needed) continue;
            }

            questions.push({
              entity, category: attribute.key, direction, format, answer, options,
              prompt: questionPrompt(attribute, entity, value, direction, format),
              answerLabel: reverse ? definition.entityLabel : attribute.label,
              flag: reverse && flag ? value : undefined,
              acceptedIds: new Set(reverse && format !== 'choice' ? members.map(({ id }) => id) : [answer.id]),
              match: format === 'typed' ? reverse ? nameMatch : valueMatch : undefined,
            });
          }
        }
      }
    }

    let ordered = shuffle(questions, random);
    if (settings.order === 'country') {
      const byCountry = new Map<string, PracticeQuestion[]>();
      for (const question of ordered) {
        const group = byCountry.get(question.entity.id) ?? [];
        group.push(question);
        byCountry.set(question.entity.id, group);
      }
      ordered = [...byCountry.values()].flat();
    }
    return settings.length === 'all' ? ordered : ordered.slice(0, settings.length);
  }

  return { categories, regions, formatsFor, createRound };
}

function countryChoices(
  answer: AnswerOption,
  entity: Entity,
  alternatives: Entity[],
  random: () => number,
  flagKey?: string,
  showFlags = false,
) {
  const preferred = flagKey ? list(entity, 'flag_similar') : [];
  const neighbors = flagKey ? list(entity, 'neighbors') : [];
  function priority(candidate: Entity) {
    if (preferred.includes(candidate.id)) return 0;
    if (neighbors.includes(candidate.id)) return 1;
    return candidate.continent && candidate.continent === entity.continent ? 2 : 3;
  }

  const ranked = shuffle(alternatives, random).sort((a, b) => priority(a) - priority(b));
  const options = distinctOptions([answer, ...ranked.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    flag: flagKey && showFlags ? String(candidate[flagKey]) : undefined,
  }))]);
  return shuffle(options.slice(0, 4), random);
}
