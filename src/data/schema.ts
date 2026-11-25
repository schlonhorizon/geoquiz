import { z } from 'zod';

const text = z.string().regex(/\S/, 'Expected a non-empty string');
const setId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const attributeFields = {
  key: text.refine((key) => key !== 'location', 'location is a built-in category'),
  label: text,
  aliasesColumn: text.optional(),
  point: z.object({ lat: text, lon: text }).optional(),
  prompts: z.record(z.string(), text).optional(),
  modes: z.array(text).optional(),
  emptyMeans: text.optional(),
  groupQuiz: z.boolean().optional(),
  quiz: z.boolean().optional(),
};

const attributeSchema = z.discriminatedUnion('type', [
  z.object({
    ...attributeFields,
    type: z.enum(['text', 'boolean', 'list', 'entityRefList', 'flag']),
  }),
  z.object({
    ...attributeFields,
    type: z.literal('enum'),
    values: z.array(text).min(1),
  }),
  z.object({
    ...attributeFields,
    type: z.literal('number'),
    year: z.number().int().optional(),
    source: text.optional(),
  }),
]);

export const setDefinitionSchema = z.object({
  id: setId,
  label: text,
  areaLabel: text.optional(),
  entityLabel: text,
  entityLabelPlural: text,
  parent: z.object({ set: setId, entity: text }).nullable(),
  map: z.object({
    file: z.string().regex(/^[\w.-]+\.topojson$/),
    object: text,
    idProperty: text,
    projection: text,
    mergeLand: z.record(text, z.array(text).min(1)).optional(),
    prompts: z.object({ find: text, name: text }).optional(),
  }),
  attributes: z.array(attributeSchema),
});

export type SetDefinition = z.infer<typeof setDefinitionSchema>;
export type AttributeDefinition = z.infer<typeof attributeSchema>;

export type EntityValue = string | string[] | number | boolean | null;

export interface Entity {
  id: string;
  name: string;
  name_aliases: string[];
  [column: string]: EntityValue;
}

export interface SetIndex {
  sets: string[];
}
