import * as z from 'zod/mini';

export const roundSettingsSchema = z.object({
  categories: z.union([z.literal('all'), z.array(z.string()).check(z.minLength(1))]),
  direction: z.enum(['forward', 'reverse', 'mixed']),
  format: z.enum(['map', 'choice', 'typed']),
  order: z.enum(['mixed', 'country']),
  region: z.string(),
  difficulty: z.literal('all'),
  length: z.union([z.literal(10), z.literal(20), z.literal('all')]),
});

export const presetsSchema = z.object({
  defaults: roundSettingsSchema,
  presets: z.array(z.object({
    id: z.string().check(z.regex(/^[a-z0-9-]+$/)),
    label: z.string().check(z.minLength(1)),
    upcoming: z.optional(z.boolean()),
    settings: z.partial(roundSettingsSchema),
  })),
}).check(z.refine(({ presets }) => new Set(presets.map(({ id }) => id)).size === presets.length, 'Duplicate preset ID'));

export type RoundSettings = z.infer<typeof roundSettingsSchema>;
export type PresetLibrary = z.infer<typeof presetsSchema>;
export type Preset = PresetLibrary['presets'][number];
export type Direction = Exclude<RoundSettings['direction'], 'mixed'>;
export type AnswerFormat = RoundSettings['format'];
