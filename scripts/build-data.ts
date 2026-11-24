import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDefinitionSchema } from '../src/data/schema';
import type { Entity, SetDefinition, SetIndex } from '../src/data/schema';
import { readEntities } from './data/entities';
import { mergeLandAreas, validateMap } from './data/map';
import type { DataIssues } from './data/issues';

interface BuiltSet {
  definition: SetDefinition;
  definitionJson: string;
  entities: Map<string, Entity>;
  mapJson: string;
}

interface BuildResult extends DataIssues {
  report: string[];
}

async function readUtf8(file: string): Promise<string> {
  return new TextDecoder('utf-8', { fatal: true }).decode(await readFile(file));
}

async function readSet(setsDirectory: string, id: string, issues: DataIssues): Promise<BuiltSet> {
  const source = join(setsDirectory, id);
  const definitionJson = await readUtf8(join(source, 'set.json'));
  const definition = setDefinitionSchema.parse(JSON.parse(definitionJson));
  if (definition.id !== id) {
    issues.errors.push(`Set-ID "${definition.id}" muss dem Ordnernamen "${id}" entsprechen.`);
  }

  const entities = readEntities(await readUtf8(join(source, 'entities.csv')), definition, issues);
  const mapJson = mergeLandAreas(await readUtf8(join(source, definition.map.file)), definition.map);
  validateMap(mapJson, definition.map, entities, issues);
  return { definition, definitionJson, entities, mapJson };
}

async function writeData(outputDirectory: string, sets: Map<string, BuiltSet>) {
  const parentDirectory = dirname(outputDirectory);
  await mkdir(parentDirectory, { recursive: true });
  const staging = await mkdtemp(join(parentDirectory, '.data-'));
  try {
    for (const [id, set] of sets) {
      const directory = join(staging, 'sets', id);
      await mkdir(directory, { recursive: true });
      await Promise.all([
        writeFile(join(directory, 'set.json'), set.definitionJson),
        writeFile(join(directory, 'entities.json'), encodeJson([...set.entities.values()])),
        writeFile(join(directory, set.definition.map.file), set.mapJson),
      ]);
    }
    const index: SetIndex = { sets: [...sets.keys()] };
    await writeFile(join(staging, 'index.json'), encodeJson(index));
    await rm(outputDirectory, { recursive: true, force: true });
    await rename(staging, outputDirectory);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

function encodeJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export async function buildData(setsDirectory: string, outputDirectory: string): Promise<BuildResult> {
  const result: BuildResult = { errors: [], warnings: [], report: [] };
  const entries = await readdir(setsDirectory, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (directories.length === 0) {
    result.errors.push('Keine Sets gefunden.');
  }

  const sets = new Map<string, BuiltSet>();
  for (const id of directories) {
    const issues: DataIssues = { errors: [], warnings: [] };
    try {
      sets.set(id, await readSet(setsDirectory, id, issues));
    } catch (error) {
      issues.errors.push(error instanceof Error ? error.message : String(error));
    }
    result.errors.push(...issues.errors.map((issue) => `[${id}] ${issue}`));
    result.warnings.push(...issues.warnings.map((issue) => `[${id}] ${issue}`));
  }

  for (const [id, { definition, entities }] of sets) {
    const parent = definition.parent;
    if (parent && (parent.set === id || !sets.get(parent.set)?.entities.has(parent.entity))) {
      result.errors.push(`[${id}] Ungültige Eltern-Entity "${parent.set}:${parent.entity}".`);
    }

    result.report.push(`[${id}] ${entities.size} ${definition.entityLabelPlural}`);
    for (const { key } of definition.attributes) {
      const populated = [...entities.values()].filter((entity) => entity[key] != null).length;
      result.report.push(`  ${key}: ${populated}/${entities.size}`);
    }
  }

  if (result.errors.length === 0) {
    await writeData(outputDirectory, sets);
  }
  return result;
}

async function main() {
  const setsDirectory = fileURLToPath(new URL('../data/sets', import.meta.url));
  const outputDirectory = fileURLToPath(new URL('../public/data', import.meta.url));
  const result = await buildData(setsDirectory, outputDirectory);
  for (const warning of result.warnings) console.warn(`Warnung: ${warning}`);
  for (const line of result.report) console.log(line);
  for (const error of result.errors) console.error(`Fehler: ${error}`);
  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
