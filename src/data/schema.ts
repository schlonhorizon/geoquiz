import { z } from 'zod';

const text = z.string().regex(/\S/, 'Expected a non-empty string');
const setId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const attributeFields = {
  key: text.refine((key) => key !== 'location', 'location is a built-in category'),
  label: text,
  aliasesColumn: text.optional(),
  noteColumn: text.optional(),
  atlasNoteOnly: z.boolean().optional(),
  emptyValueColumn: text.optional(),
  source: text.optional(),
  point: z.object({ lat: text, lon: text, required: z.boolean().optional() }).optional(),
  prompts: z.record(z.string(), text).optional(),
  modes: z.array(text).optional(),
  emptyMeans: text.optional(),
  groupQuiz: z.boolean().optional(),
  quiz: z.boolean().optional(),
};

const attributeSchema = z.discriminatedUnion('type', [
  z.object({
    ...attributeFields,
    type: z.enum(['boolean', 'list', 'entityRefList', 'flag', 'color']),
  }),
  z.object({
    ...attributeFields,
    type: z.literal('text'),
    alternativeValuesColumn: text.optional(),
  }),
  z.object({
    ...attributeFields,
    type: z.literal('enum'),
    values: z.array(text).min(1),
    alternativeValuesColumn: text.optional(),
  }),
  z.object({
    ...attributeFields,
    type: z.literal('number'),
    year: z.number().int().optional(),
  }),
]);

export const setDefinitionSchema = z.object({
  id: setId,
  label: text,
  areaLabel: text.optional(),
  entityLabel: text,
  entityLabelPlural: text,
  parent: z.object({ set: setId, entity: text }).nullable(),
  outline: z.object({
    include: z.record(text, z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))).optional(),
    exclude: z.record(text, z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))).optional(),
  }).optional(),
  map: z.object({
    file: z.string().regex(/^[\w.-]+\.topojson$/),
    waterFile: z.string().regex(/^[\w.-]+\.topojson$/).optional(),
    detailFile: z.string().regex(/^[\w.-]+\.topojson$/).optional(),
    object: text,
    idProperty: text,
    projection: text,
    mergeLand: z.record(text, z.array(text).min(1)).optional(),
    prompts: z.object({ find: text, name: text }).optional(),
  }).refine(({ file, waterFile, detailFile }) => {
    const files = [file, waterFile, detailFile].filter((name) => name !== undefined);
    return new Set(files).size === files.length;
  }, 'Kartendateien müssen unterschiedliche Namen haben.'),
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
