import type { TerrainColors, TerrainRequest, TerrainResponse, TerrainShape, TerrainTier, TerrainView } from './world-raster-types';
import { worldWidth } from './viewport';
import { loadTerrainTier } from './terrain-data';

const cellSize = 32;
const columns = Math.ceil(worldWidth / cellSize) + 2;
type Shape = TerrainShape & { path?: Path2D };
type Tier = { minZoom: number; cells: Map<number, Shape[]> };
const tiers = new Map<number, { tier: Tier; colors: TerrainColors }>();
const scope = self as unknown as {
  onmessage: (event: MessageEvent<TerrainRequest>) => void;
  postMessage(response: TerrainResponse, transfer?: Transferable[]): void;
};
const canvas = new OffscreenCanvas(1, 1);
const context = canvas.getContext('2d', { alpha: false })!;

function index({ minZoom, shapes }: TerrainTier): Tier {
  const cells = new Map<number, Shape[]>();
  for (const shape of shapes) {
    const [[left, top], [right, bottom]] = shape.bounds;
    for (let row = Math.floor(top / cellSize); row <= Math.floor(bottom / cellSize); row++) {
      for (let column = Math.floor(left / cellSize); column <= Math.floor(right / cellSize); column++) {
        const key = row * columns + column;
        const cell = cells.get(key);
        if (cell) cell.push(shape);
        else cells.set(key, [shape]);
      }
    }
  }
  return { minZoom, cells };
}

function draw(tier: Tier, { pixelRatio, k, x, y, width, height }: TerrainView, colors: TerrainColors, water: boolean, minor: boolean) {
  const wide = Math.round(width * pixelRatio);
  const tall = Math.round(height * pixelRatio);
  if (canvas.width !== wide) canvas.width = wide;
  if (canvas.height !== tall) canvas.height = tall;
  const ctx = context;
  ctx.resetTransform();
  ctx.fillStyle = colors.sea;
  ctx.fillRect(0, 0, wide, tall);
  ctx.lineJoin = 'round';

  const tileWidth = k * worldWidth;
  const top = (-y - 2) / k;
  const bottom = (height - y + 2) / k;
  const first = Math.floor(-x / tileWidth);
  const last = Math.ceil((width - x) / tileWidth);
  for (let tile = first; tile < last; tile++) {
    const origin = x + tile * tileWidth;
    const left = Math.max(0, (-origin - 2) / k);
    const right = Math.min(worldWidth, (width - origin + 2) / k);
    const shapes = new Set<Shape>();
    for (let row = Math.max(0, Math.floor(top / cellSize)); row <= Math.floor(bottom / cellSize); row++) {
      for (let column = Math.floor(left / cellSize); column <= Math.floor(right / cellSize); column++) {
        for (const shape of tier.cells.get(row * columns + column) ?? []) shapes.add(shape);
      }
    }

    const paths = new Map<string, Path2D>();
    for (const shape of shapes) {
      const { name, bounds: [[l, t], [r, b]] } = shape;
      if ((l > right || r < left || t > bottom || b < top)
        || (!water && (name === 'map-lake' || name.startsWith('map-river')))
        || (!minor && name === 'map-river-minor')) continue;
      const key = name === 'map-river-minor' ? 'map-river' : name;
      let batch = paths.get(key);
      if (!batch) paths.set(key, batch = new Path2D());
      batch.addPath(shape.path ??= new Path2D(shape.d));
    }
    ctx.setTransform(k * pixelRatio, 0, 0, k * pixelRatio, origin * pixelRatio, y * pixelRatio);
    function paint(name: string, stroke: string, width: number, fill?: string) {
      const path = paths.get(name);
      if (!path) return;
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill(path);
      }
      ctx.lineWidth = width / k;
      ctx.strokeStyle = stroke;
      ctx.stroke(path);
    }
    paint('map-grid', colors.grid, 1);
    paint('map-land', colors.ink, .8, colors['land-off']);
    paint('map-country', colors.ink, .8, colors.paper);
    paint('map-river', colors.river, .6);
    paint('map-lake', colors.ink, .8, colors.sea);
  }
  return canvas.transferToImageBitmap();
}

scope.onmessage = ({ data }) => {
  if (data.type === 'load') {
    void loadTerrainTier(data.url).then(tier => {
      tiers.set(data.minZoom, { tier: index(tier), colors: data.colors });
      scope.postMessage({ type: 'ready', minZoom: data.minZoom });
    }).catch((error: unknown) => {
      scope.postMessage({ type: 'error', minZoom: data.minZoom, message: String(error) });
    });
    return;
  }
  const { tier, colors } = tiers.get(data.minZoom)!;
  const base = draw(tier, data.view, colors, data.water, data.minor);
  scope.postMessage({ type: 'view', id: data.id, base, minZoom: tier.minZoom }, [base]);
};
