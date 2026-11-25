import type { QuizSet } from '../data/load';
import { attributePoint } from '../data/map';
import type { Coordinate } from '../data/map';
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
  alternativeAnswers?: AnswerOption[];
  noteColumn?: string;
  source?: string;
  flag?: string;
  acceptedIds: ReadonlySet<string>;
  countryForAnswer?: ReadonlyMap<string, string>;
  point?: Coordinate;
  match?: ReturnType<typeof createAnswerLookup>;
}

const directions: Direction[] = ['forward', 'reverse'];

export const locationCategory = { key: 'location', label: 'Lage', type: 'location' } as const;
type Category = AttributeDefinition | typeof locationCategory;

function categoryFormats(attribute: Category, direction: Direction): AnswerFormat[] {
  if (attribute.type === 'location') return direction === 'forward' ? ['map'] : ['choice', 'typed'];
  const formats: AnswerFormat[] = ['choice'];
  if (attribute.type !== 'flag' || direction === 'reverse') formats.push('typed');
  if (attribute.type === 'text' && (direction === 'reverse' || attribute.point)) formats.push('map');
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
    template = direction === 'forward'
      ? attribute.prompts?.mapPoint ?? `Markiere {value} auf der Karte von {entity}.`
      : attribute.prompts?.reverseMap ?? `${reverse} Markiere es auf der Karte.`;
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
    const groups = new Map<string, { value: string; primary: Entity[]; alternatives: Entity[] }>();
    const alternativeAnswers = new Map<string, AnswerOption[]>();
    const populated: Entity[] = [];

    function addMember(value: string, entity: Entity, role: 'primary' | 'alternatives'): AnswerOption {
      const id = normalizeAnswer(value);
      const group = groups.get(id) ?? { value, primary: [], alternatives: [] };
      groups.set(id, group);
      group[role].push(entity);
      return { id, name: value };
    }

    for (const entity of entities) {
      const value = entity[attribute.key];
      if (typeof value !== 'string' || !value.trim()) continue;
      populated.push(entity);
      addMember(value, entity, 'primary');
    }
    if ('alternativeValuesColumn' in attribute && attribute.alternativeValuesColumn) {
      for (const entity of populated) {
        const options = list(entity, attribute.alternativeValuesColumn).map((value) => addMember(value, entity, 'alternatives'));
        if (options.length) alternativeAnswers.set(entity.id, options);
      }
    }
    if (!groups.size || !directions.some((direction) => categoryFormats(attribute, direction).length)) return [];

    const candidates = [...groups].map(([id, { value, primary }]) => ({
      id,
      name: value,
      name_aliases: attribute.aliasesColumn ? primary.flatMap((entity) => list(entity, attribute.aliasesColumn!)) : [],
    }));
    const values = attribute.type === 'enum'
      ? distinctOptions(attribute.values.map((name) => ({ id: normalizeAnswer(name), name })))
      : candidates.map(({ id, name }) => ({ id, name }));
    const valueMatch = createAnswerLookup(attribute.type === 'enum'
      ? [...candidates, ...values.filter(({ id }) => !groups.has(id)).map((option) => ({ ...option, name_aliases: [] }))]
      : candidates);
    const countryForAnswer = new Map<string, string>();
    for (const [id, { primary, alternatives }] of groups) {
      const owners = [...primary, ...alternatives];
      if (owners.length === 1) countryForAnswer.set(id, owners[0].id);
    }
    return [{ attribute, groups, values, valueMatch, populated, alternativeAnswers, countryForAnswer }];
  });

  const categories = [locationCategory, ...attributes.map(({ attribute }) => attribute)];
  const selected = (key: string, settings: RoundSettings) =>
    settings.categories === 'all' || settings.categories.includes(key);
  const inRegion = (entity: Entity, settings: RoundSettings) => !settings.region || entity.continent === settings.region;
  const inDirection = (direction: Direction, settings: RoundSettings) =>
    settings.direction === 'mixed' || settings.direction === direction;

  function formatsFor(settings: RoundSettings) {
    const formats = new Set<AnswerFormat>();
    for (const category of categories) {
      if (!selected(category.key, settings)) continue;
      for (const direction of directions) {
        if (!inDirection(direction, settings)) continue;
        for (const format of categoryFormats(category, direction)) {
          if (format === 'map' && direction === 'forward' && category.type !== 'location'
            && !entities.some((entity) => inRegion(entity, settings)
              && typeof entity[category.key] === 'string' && attributePoint(entity, category))) continue;
          formats.add(format);
        }
      }
    }
    return formats;
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

  function buildQuestions(settings: RoundSettings, random: () => number, eligible: Entity[]): PracticeQuestion[] {
    const questions: PracticeQuestion[] = [];
    const eligibleIds = new Set(eligible.map(({ id }) => id));
    if (selected('location', settings)) {
      for (const direction of directions) {
        if (!inDirection(direction, settings) || !categoryFormats(locationCategory, direction).includes(settings.format)) continue;
        for (const entity of eligible) {
          const question = locationQuestion(entity, direction, settings.format, random);
          if (question) questions.push(question);
        }
      }
    }
    for (const { attribute, groups, values, valueMatch, populated, alternativeAnswers, countryForAnswer } of attributes) {
      if (!selected(attribute.key, settings)) continue;
      for (const direction of directions) {
        if (!inDirection(direction, settings) || !categoryFormats(attribute, direction).includes(settings.format)) continue;
        const reverse = direction === 'reverse';
        const flag = attribute.type === 'flag';
        const { format } = settings;
        for (const [valueId, { value, primary, alternatives }] of groups) {
          const matchingCountries = [...primary, ...alternatives];
          const local = (reverse ? matchingCountries : primary).filter(({ id }) => eligibleIds.has(id));
          const targets = reverse && settings.order === 'mixed' ? shuffle(local, random).slice(0, 1) : local;
          const countriesWithValue = new Set(matchingCountries.map(({ id }) => id));
          for (const entity of targets) {
            const point = !reverse && format === 'map' ? attributePoint(entity, attribute) : undefined;
            if (!reverse && format === 'map' && !point) continue;
            const answer = reverse ? { id: entity.id, name: entity.name }
              : flag ? { id: entity.id, name: entity.name, flag: value }
                : { id: valueId, name: String(entity[attribute.key]) };
            const otherAnswers = reverse ? undefined : alternativeAnswers.get(entity.id);
            const acceptedValues = new Set([answer.id, ...(otherAnswers?.map(({ id }) => id) ?? [])]);
            let options: AnswerOption[] = [];
            if (format === 'choice') {
              if (reverse || flag) {
                options = countryChoices(answer, entity, populated.filter(({ id }) => !countriesWithValue.has(id)), random,
                  flag ? attribute.key : undefined, flag && !reverse);
              } else {
                const choices = shuffle(values.filter(({ id }) => !acceptedValues.has(id)), random);
                if (attribute.type === 'text') {
                  const isLocal = (id: string) => groups.get(id)?.primary.some(({ continent }) => continent && continent === entity.continent);
                  choices.sort((a, b) => Number(Boolean(isLocal(b.id))) - Number(Boolean(isLocal(a.id))));
                }
                options = shuffle([answer, ...choices.slice(0, 3)], random);
              }
              const needed = !reverse && attribute.type === 'enum'
                ? Math.max(2, Math.min(4, values.length - (otherAnswers?.length ?? 0))) : 4;
              if (options.length < needed) continue;
            }

            questions.push({
              entity, category: attribute.key, direction, format, answer, options, point,
              alternativeAnswers: otherAnswers,
              noteColumn: attribute.atlasNoteOnly ? undefined : attribute.noteColumn,
              source: attribute.source,
              prompt: questionPrompt(attribute, entity, value, direction, format),
              answerLabel: reverse ? definition.entityLabel : attribute.label,
              flag: reverse && flag ? value : undefined,
              acceptedIds: reverse && format !== 'choice' ? countriesWithValue : acceptedValues,
              countryForAnswer: !reverse && !flag ? countryForAnswer : undefined,
              match: format === 'typed' ? reverse ? nameMatch : valueMatch : undefined,
            });
          }
        }
      }
    }
    return questions;
  }

  function createRound(settings: RoundSettings, random = Math.random): PracticeQuestion[] {
    const countryRound = settings.countryRound;
    if (countryRound) {
      const { selection, steps, countryId, count } = countryRound;
      const specific = selection === 'specific' ? entities.find(({ id }) => id === countryId) : undefined;
      if ((selection === 'specific' && !specific) || (selection === 'region' && !settings.region)) return [];
      const eligible = entities.filter((entity) => entity !== specific && (selection !== 'region' || inRegion(entity, settings)));
      const shuffled = shuffle(eligible, random);
      const ordered = specific ? [specific, ...shuffled] : shuffled;
      const groups: PracticeQuestion[][] = [];
      for (const entity of ordered) {
        const questions = steps.flatMap(({ category, format }) => buildQuestions({
          ...settings, categories: [category], direction: 'forward', format, order: 'country',
        }, random, [entity]));
        if (questions.length) groups.push(questions);
        else if (entity === specific) return [];
        if (groups.length === count) break;
      }
      return groups.flat();
    }

    const questions = buildQuestions(settings, random, entities.filter((entity) => inRegion(entity, settings)));
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

  return { categories, regions, countries: entities, formatsFor, createRound };
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
