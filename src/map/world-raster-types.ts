import type { Bounds } from './viewport';

export interface TerrainShape {
  name: string;
  d: string;
  bounds?: Bounds;
}

export type TerrainLevel = 'overview' | 'detail';
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
  | { type: 'load'; level: TerrainLevel; shapes: TerrainShape[]; colors: TerrainColors }
  | { type: 'global'; level: TerrainLevel; water: boolean; height: number; key: string }
  | { type: 'view'; level: TerrainLevel; water: boolean; minor: boolean; view: TerrainView; id: number };

export type TerrainResponse =
  | { type: 'global'; key: string; image: Blob }
  | { type: 'view'; id: number; base: ImageBitmap; rivers?: ImageBitmap };
