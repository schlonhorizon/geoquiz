import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { parse } from 'csv-parse/sync';
import { flagCode, flagDirectory } from './data/flags';

const nearWhite = 225;

export function dominantFlagColor(pixels: Uint8Array): string | undefined {
  const area = new Map<number, number>();
  for (let index = 0; index < pixels.length; index += 4) {
    const [red, green, blue, alpha] = pixels.subarray(index, index + 4);
    if (alpha < 128 || Math.min(red, green, blue) >= nearWhite) continue;
    const rgb = (red << 16) | (green << 8) | blue;
    area.set(rgb, (area.get(rgb) ?? 0) + alpha);
  }
  let winner: number | undefined;
  let largest = 0;
  for (const [rgb, size] of area) {
    if (size > largest) {
      winner = rgb;
      largest = size;
    }
  }
  return winner === undefined ? undefined : `#${winner.toString(16).padStart(6, '0').toUpperCase()}`;
}

function serializeCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => /[;"\r\n]/.test(cell)
    ? `"${cell.replaceAll('"', '""')}"` : cell).join(';')).join('\n') + '\n';
}

async function main() {
  const world = fileURLToPath(new URL('../data/sets/world/', import.meta.url));
  const csv = await readFile(join(world, 'entities.csv'), 'utf8');
  const [header, ...rows]: string[][] = parse(csv, { bom: true, delimiter: ';', skip_empty_lines: true });
  const idColumn = header?.indexOf('id') ?? -1;
  if (idColumn < 0) throw new Error('Die CSV benötigt eine ID-Spalte.');
  const colorColumn = header.includes('color') ? header.indexOf('color') : header.push('color') - 1;
  let seeded = 0;
  for (const row of rows) {
    if (row[colorColumn]?.trim()) continue;
    const id = row[idColumn];
    const code = flagCode(id);
    if (!code) throw new Error(`${id}: Kein Flaggen-Code verfügbar.`);
    const svg = await readFile(join(flagDirectory, `${code}.svg`));
    const image = new Resvg(svg, { fitTo: { mode: 'width', value: 144 }, font: { loadSystemFonts: false } }).render();
    const color = dominantFlagColor(image.pixels);
    if (!color) throw new Error(`${id}: Keine geeignete Flaggenfarbe gefunden.`);
    row[colorColumn] = color;
    seeded++;
  }
  await writeFile(join(world, 'entities.seed.csv'), serializeCsv([header, ...rows]));
  console.log(`${seeded} Flaggenfarben ergänzt. Ausgabe: data/sets/world/entities.seed.csv`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
