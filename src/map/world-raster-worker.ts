import type { TerrainColors, TerrainLevel, TerrainRequest, TerrainResponse, TerrainShape, TerrainView } from './world-raster-types';
import { worldWidth } from './viewport';

type Path = Omit<TerrainShape, 'd'> & { path: Path2D };
const layers = new Map<TerrainLevel, { paths: Path[]; colors: TerrainColors }>();
const scope = self as unknown as {
  onmessage: (event: MessageEvent<TerrainRequest>) => void;
  postMessage(response: TerrainResponse, transfer?: Transferable[]): void;
};

function draw(level: TerrainLevel, view: TerrainView, water: boolean, minor = false, rivers = false) {
  const { paths, colors } = layers.get(level)!;
  const { pixelRatio, k, x, y, width, height } = view;
  const canvas = new OffscreenCanvas(Math.ceil(width * pixelRatio), Math.ceil(height * pixelRatio));
  const ctx = canvas.getContext('2d')!;
  if (!rivers) {
    ctx.fillStyle = colors.sea;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.lineJoin = 'round';
  const tileWidth = k * worldWidth;
  const first = Math.floor(-x / tileWidth);
  const last = Math.ceil((width - x) / tileWidth);
  for (let tile = first; tile < last; tile++) {
    const origin = x + tile * tileWidth;
    const left = -origin / k, right = (width - origin) / k, top = -y / k, bottom = (height - y) / k;
    ctx.setTransform(k * pixelRatio, 0, 0, k * pixelRatio, origin * pixelRatio, y * pixelRatio);
    for (const { name, path, bounds } of paths) {
      const lake = name === 'map-lake';
      const river = name.startsWith('map-river');
      if ((!water && (lake || river))
        || (river && (!rivers || (name.includes('minor') && !minor))) || (rivers && !river && !lake)) continue;
      if (bounds && (bounds[0][0] > right || bounds[1][0] < left || bounds[0][1] > bottom || bounds[1][1] < top)) continue;
      if (lake && rivers) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fill(path);
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (name !== 'map-grid' && !river) {
        ctx.fillStyle = lake ? colors.sea : name === 'map-land' ? colors['land-off'] : colors.paper;
        ctx.fill(path);
      }
      ctx.strokeStyle = river ? colors.river : name === 'map-grid' ? colors.grid : colors.ink;
      ctx.lineWidth = (river ? .6 : name === 'map-grid' ? 1 : .8) / k;
      ctx.stroke(path);
    }
  }
  return canvas;
}

scope.onmessage = ({ data }) => {
  switch (data.type) {
    case 'load':
      layers.set(data.level, { colors: data.colors,
        paths: data.shapes.map(({ d, ...shape }) => ({ ...shape, path: new Path2D(d) })) });
      break;
    case 'global': {
      const canvas = draw(data.level, { x: 0, y: 0, width: worldWidth, height: data.height, k: 1, pixelRatio: 2 }, data.water);
      void canvas.convertToBlob().then(image => scope.postMessage({ type: 'global', key: data.key, image }));
      break;
    }
    case 'view': {
      const base = draw(data.level, data.view, data.water).transferToImageBitmap();
      const rivers = data.water ? draw(data.level, data.view, true, data.minor, true).transferToImageBitmap() : undefined;
      scope.postMessage({ type: 'view', id: data.id, base, rivers }, rivers ? [base, rivers] : [base]);
      break;
    }
  }
};
