import type { QuizSet } from '../data/load';
import type { AttributeDefinition, Entity } from '../data/schema';
import { createAnswerLookup, normalizeAnswer } from '../match/answers';
import { shuffle } from './map-questions';

export type Direction = 'forward' | 'reverse';
export type AnswerFormat = 'choice' | 'typed' | 'map';

export interface AttributeRoundSettings {
  category?: string;
  direction?: Direction;
  format: AnswerFormat | 'mixed';
  region?: string;
  length: number;
}

export interface AttributeOption {
  id: string;
  name: string;
  flag?: string;
}

export interface AttributeQuestion {
  category: string;
  direction: Direction;
  prompt: string;
  format: AnswerFormat;
  answerLabel: string;
  answer: AttributeOption;
  options: AttributeOption[];
  flag?: string;
  acceptedIds: ReadonlySet<string>;
  match?: ReturnType<typeof createAnswerLookup>;
}

const directions: Direction[] = ['forward', 'reverse'];

export function attributeFormats(attribute: AttributeDefinition, direction: Direction): AnswerFormat[] {
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

function distinctOptions(options: AttributeOption[]): AttributeOption[] {
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

export function createAttributeEngine({ definition, entities }: QuizSet) {
  const nameMatch = createAnswerLookup(entities);
  const regions = [...new Set(entities.flatMap(({ continent }) => typeof continent === 'string' ? [continent] : []))]
    .sort((a, b) => a.localeCompare(b, 'de'));
  const categories = definition.attributes.flatMap((attribute) => {
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
    if (!groups.size || !directions.some((direction) => attributeFormats(attribute, direction).length)) return [];

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

  function createRound(settings: AttributeRoundSettings, random = Math.random): AttributeQuestion[] {
    const questions: AttributeQuestion[] = [];
    for (const { attribute, groups, values, valueMatch } of categories) {
      if (settings.category && settings.category !== attribute.key) continue;
      const populated = [...groups.values()].flatMap(({ members }) => members);
      for (const direction of directions) {
        if (settings.direction && settings.direction !== direction) continue;
        const formats = attributeFormats(attribute, direction)
          .filter((format) => settings.format === 'mixed' ? format !== 'map' : format === settings.format);
        if (!formats.length) continue;

        for (const [valueId, { value, members }] of groups) {
          const eligible = members.filter(({ continent }) => !settings.region || continent === settings.region);
          const targets = direction === 'forward' ? eligible : shuffle(eligible, random).slice(0, 1);
          for (const target of targets) {
            const reverse = direction === 'reverse';
            const flagQuestion = attribute.type === 'flag';
            const answer = reverse ? { id: target.id, name: target.name }
              : flagQuestion ? { id: target.id, name: target.name, flag: value }
                : { id: valueId, name: String(target[attribute.key]) };
            for (const format of shuffle(formats, random)) {
              let options: AttributeOption[] = [];
              if (format === 'choice') {
                if (reverse || flagQuestion) {
                  const preferred = list(target, 'flag_similar');
                  const neighbors = list(target, 'neighbors');
                  function priority(entity: Entity) {
                    if (flagQuestion && preferred.includes(entity.id)) return 0;
                    if (flagQuestion && neighbors.includes(entity.id)) return 1;
                    return entity.continent && entity.continent === target.continent ? 2 : 3;
                  }
                  const alternatives = shuffle(populated.filter((entity) =>
                    normalizeAnswer(String(entity[attribute.key])) !== valueId), random)
                    .sort((a, b) => priority(a) - priority(b));
                  options = distinctOptions([answer, ...alternatives.map(({ id, name, [attribute.key]: flag }) =>
                    ({ id, name, flag: reverse ? undefined : String(flag) }))]).slice(0, 4);
                } else {
                  const choices = attribute.type === 'text'
                    ? shuffle(values.filter(({ id }) => id !== valueId), random).sort((a, b) => {
                      const local = (id: string) => groups.get(id)?.members.some(({ continent }) => continent && continent === target.continent);
                      return Number(Boolean(local(b.id))) - Number(Boolean(local(a.id)));
                    })
                    : shuffle(values.filter(({ id }) => id !== valueId), random);
                  options = [answer, ...choices.slice(0, 3)];
                }
                const needed = !reverse && attribute.type === 'enum' ? Math.max(2, Math.min(4, values.length)) : 4;
                if (options.length < needed) continue;
                options = shuffle(options, random);
              }

              questions.push({
                category: attribute.key,
                direction,
                prompt: questionPrompt(attribute, target, value, direction, format),
                format,
                answerLabel: reverse ? definition.entityLabel : attribute.label,
                answer,
                options,
                flag: reverse && flagQuestion ? value : undefined,
                acceptedIds: new Set(reverse && format !== 'choice' ? members.map(({ id }) => id) : [answer.id]),
                match: format === 'typed' ? reverse ? nameMatch : valueMatch : undefined,
              });
              break;
            }
          }
        }
      }
    }
    return shuffle(questions, random).slice(0, settings.length);
  }

  return { categories: categories.map(({ attribute }) => attribute), regions, createRound };
}
