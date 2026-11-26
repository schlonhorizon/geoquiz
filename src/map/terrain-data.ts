import type { TerrainTier } from './world-raster-types';

export async function loadTerrainTier(url: string): Promise<TerrainTier> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${url}`);
  // Vite serves the precompressed file with Content-Encoding. Static hosts may serve it as an archive.
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(bytes));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}
