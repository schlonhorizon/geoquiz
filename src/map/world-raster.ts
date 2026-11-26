import type { ZoomTransform } from 'd3-zoom';
import type { TerrainColors, TerrainLevel, TerrainRequest, TerrainResponse, TerrainShape, TerrainView } from './world-raster-types';
import { worldWidth } from './viewport';

type Size = { width: number; height: number };
type Capture = { id: number; level: TerrainLevel; water: boolean; minor: boolean; view: TerrainView };
const maxSurfacePixels = 2_500_000;

export function createWorldRaster(svg: SVGSVGElement, worldHeight: number, onActive: (active: boolean) => void) {
  if (!('Worker' in window) || !('OffscreenCanvas' in window)) return;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./world-raster-worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return;
  }
  const host = document.createElement('div');
  host.className = 'world-raster';
  host.setAttribute('aria-hidden', 'true');
  const global = document.createElement('div');
  global.className = 'world-raster-global';
  const tiles: HTMLImageElement[] = [];
  host.append(global);
  svg.before(host);

  const style = getComputedStyle(svg);
  const tokens = ['ink', 'paper', 'sea', 'land-off', 'grid', 'river'] as const;
  const colors = Object.fromEntries(tokens.map(token => [token, style.getPropertyValue(`--${token}`).trim()])) as TerrainColors;
  const globals = new Map<string, string>();
  const requested = new Set<string>();
  const levels = new Set<TerrainLevel>();
  let current: ReturnType<typeof createSurface> | undefined;
  let departing: ReturnType<typeof createSurface> | undefined;
  let pending: Capture | undefined;
  let camera: { transform: ZoomTransform; viewport: Size } | undefined;
  let level: TerrainLevel = 'overview';
  let water = true;
  let sequence = 0;
  let moving = false;
  let failed = false;
  let background = '';
  let transition = 0;

  const post = (request: TerrainRequest) => worker.postMessage(request);
  const keyFor = (level: TerrainLevel) => `${level}:${water}`;
  function requestGlobal(level: TerrainLevel) {
    const key = keyFor(level);
    if (requested.has(key) || !levels.has(level)) return;
    requested.add(key);
    post({ type: 'global', level, water, height: worldHeight, key });
  }

  function createSurface(capture: Capture, base: ImageBitmap, rivers?: ImageBitmap) {
    const layer = document.createElement('div');
    layer.className = 'world-raster-view';
    layer.style.width = `${capture.view.width}px`;
    layer.style.height = `${capture.view.height}px`;
    const append = (image: ImageBitmap, marker: string) => {
      const canvas = document.createElement('canvas');
      canvas.className = marker;
      canvas.width = image.width;
      canvas.height = image.height;
      const renderer = canvas.getContext('bitmaprenderer');
      if (renderer) renderer.transferFromImageBitmap(image);
      else {
        canvas.getContext('2d')!.drawImage(image, 0, 0);
        image.close();
      }
      layer.append(canvas);
    };
    append(base, 'world-raster-base');
    if (rivers) {
      // Let the compositor present the new ground image before uploading the river layer.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (layer.isConnected) append(rivers, 'world-raster-rivers');
        else rivers.close();
      }));
    }
    return { capture, layer };
  }

  function draw(transform: ZoomTransform, viewport: Size) {
    camera = { transform, viewport };
    if (failed || !svg.hasAttribute('data-canvas-map')) return;
    const option = globals.get(keyFor(current?.capture.level ?? level)) ?? globals.get(keyFor(level))
      ?? globals.get(keyFor('overview')) ?? globals.values().next().value;
    let covered = false;
    for (const surface of [departing, current]) {
      if (!surface) continue;
      const { view } = surface.capture;
      const scale = transform.k / view.k;
      const left = transform.x - view.x * scale;
      const top = transform.y - view.y * scale;
      const right = left + view.width * scale;
      const bottom = top + view.height * scale;
      const intersects = right > 0 && left < viewport.width && bottom > 0 && top < viewport.height;
      const coversViewport = left <= 0 && top <= 0 && right >= viewport.width && bottom >= viewport.height;
      // Use one terrain image during motion so the browser does not blend a partial second surface.
      const visible = intersects && (!moving || coversViewport || !option || Boolean(departing));
      surface.layer.hidden = !visible;
      if (visible) surface.layer.style.transform = `translate3d(${left}px,${top}px,0) scale(${scale})`;
      covered ||= coversViewport;
    }
    global.hidden = covered && !departing;
    if (global.hidden) return;
    if (!option) return;
    const tile = transform.k * worldWidth;
    const x = transform.x - Math.ceil(transform.x / tile) * tile;
    const count = Math.ceil((viewport.width - x) / tile);
    while (tiles.length < count) {
      const image = document.createElement('img');
      image.alt = '';
      image.width = worldWidth;
      image.style.height = `${worldHeight}px`;
      image.style.left = `${tiles.length * worldWidth}px`;
      image.src = option;
      tiles.push(image);
      global.append(image);
    }
    tiles.forEach((image, index) => {
      image.hidden = index >= count;
      if (option !== background) image.src = option;
    });
    background = option;
    global.style.transform = `translate3d(${x}px,${transform.y}px,0) scale(${transform.k})`;
  }

  function settle(transform: ZoomTransform, viewport: Size, nextLevel: TerrainLevel, minor: boolean) {
    if (failed || !viewport.width || !viewport.height || !levels.has(nextLevel)) return;
    level = nextLevel;
    requestGlobal(level);
    const old = pending ?? current?.capture;
    if (old?.level === level && old.water === water && old.minor === minor && old.view.pixelRatio === devicePixelRatio) {
      const scale = transform.k / old.view.k;
      const left = transform.x - old.view.x * scale;
      const top = transform.y - old.view.y * scale;
      if (scale > .93 && scale < 1.07 && left <= 0 && top <= 0
        && left + old.view.width * scale >= viewport.width && top + old.view.height * scale >= viewport.height) return;
    }
    const ratio = devicePixelRatio || 1;
    // Keep the screen at native DPR, using available memory for extra coverage around it.
    const overscan = Math.max(1, Math.min(1.6, Math.sqrt(maxSurfacePixels / (viewport.width * viewport.height * ratio ** 2))));
    const width = Math.ceil(viewport.width * overscan);
    const height = Math.ceil(viewport.height * overscan);
    const x = transform.x + (width - viewport.width) / 2;
    const y = transform.y + (height - viewport.height) / 2;
    if (old?.level === level && old.water === water && old.minor === minor
      && old.view.k === transform.k && old.view.width === width && old.view.height === height
      && Math.abs(x - old.view.x) < .5 && Math.abs(y - old.view.y) < .5) return;
    const view = { x, y, k: transform.k, width, height, pixelRatio: ratio };
    pending = { level, minor, water, view, id: ++sequence };
    post({ type: 'view', ...pending });
  }

  function setMoving(active: boolean) {
    moving = active;
    host.toggleAttribute('data-map-moving', active);
  }

  worker.onmessage = ({ data }: MessageEvent<TerrainResponse>) => {
    if (data.type === 'global') {
      globals.set(data.key, URL.createObjectURL(data.image));
      if (camera) draw(camera.transform, camera.viewport);
      return;
    }
    if (!pending || pending.id !== data.id || moving) {
      if (pending?.id === data.id) pending = undefined;
      data.base.close();
      data.rivers?.close();
      return;
    }
    const next = createSurface(pending, data.base, data.rivers);
    pending = undefined;
    window.clearTimeout(transition);
    departing?.layer.remove();
    departing = undefined;
    const previous = current;
    current = next;
    host.append(next.layer);
    host.dataset.rasterLevel = next.capture.level;
    host.toggleAttribute('data-raster-water', next.capture.water);
    host.toggleAttribute('data-raster-minor', next.capture.minor);
    if (!svg.hasAttribute('data-canvas-map')) {
      svg.setAttribute('data-canvas-map', '');
      onActive(true);
    }
    if (previous && previous.capture.level !== next.capture.level
      && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      departing = previous;
      next.layer.classList.add('world-raster-fade');
      transition = window.setTimeout(() => {
        previous.layer.remove();
        if (departing === previous) departing = undefined;
        if (camera) draw(camera.transform, camera.viewport);
      }, 200);
    } else previous?.layer.remove();
    if (camera) draw(camera.transform, camera.viewport);
  };
  worker.onerror = () => {
    failed = true;
    host.remove();
    svg.removeAttribute('data-canvas-map');
    onActive(false);
    worker.terminate();
  };

  return {
    draw, settle, setMoving,
    load(level: TerrainLevel, shapes: TerrainShape[]) {
      if (failed) return;
      levels.add(level);
      post({ type: 'load', level, shapes, colors });
    },
    setWaterVisible(show: boolean) {
      water = show;
      host.toggleAttribute('data-water-hidden', !show);
      if (camera) settle(camera.transform, camera.viewport, level, (pending ?? current?.capture)?.minor ?? false);
    },
  };
}
