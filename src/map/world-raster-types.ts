import type { Bounds } from './viewport';

export interface TerrainShape {
  name: string;
  d: string;
  bounds: Bounds;
  id?: string;
  area?: number;
  anchor?: [number, number];
}

export interface TerrainCountry {
  id: string;
  d: string;
  bounds: Bounds;
  anchor?: [number, number];
}

export interface TerrainTier {
  minZoom: number;
  shapes: TerrainShape[];
}

export type TerrainLevel = 'overview' | 'detail';
export const DETAIL_RENDER_ZOOMS = [3, 6, 12, 24] as const;
export type TerrainColors = Record<'ink' | 'paper' | 'sea' | 'land-off' | 'grid' | 'river', string>;

export interface TerrainView {
  x: number;
  y: number;
  k: number;
  width: number;
  height: number;
  pixelRatio: number;
}

export type TerrainRequest =
  | { type: 'load'; minZoom: number; url: string; colors: TerrainColors }
  | { type: 'view'; minZoom: number; water: boolean; minor: boolean; view: TerrainView; id: number };

export type TerrainResponse =
  | { type: 'ready'; minZoom: number; countries: TerrainCountry[] }
  | { type: 'error'; minZoom: number; message: string }
  | { type: 'view'; id: number; base: ImageBitmap; minZoom: number };
