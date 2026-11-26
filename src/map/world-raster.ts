import type { ZoomTransform } from 'd3-zoom';
import type { TerrainColors, TerrainCountry, TerrainLevel, TerrainRequest, TerrainResponse, TerrainView } from './world-raster-types';
import { DETAIL_RENDER_ZOOMS } from './world-raster-types';

type Size = { width: number; height: number };
type Camera = { transform: ZoomTransform; viewport: Size; zoom: number; detail: boolean; minor: boolean; revision: number };
type Frame = Camera & { id: number; view: TerrainView; tier: number; water: boolean };
const bridgeFrames = 2;
const cacheMargin = .25;

export function createWorldRaster(
  svg: SVGSVGElement,
  onActive: (active: boolean) => void,
  onTierReady: (tier: number, countries: TerrainCountry[]) => void,
  onPresent: (transform: ZoomTransform, tier?: number, minor?: boolean) => void,
) {
  if (!('Worker' in window) || !('OffscreenCanvas' in window) || !('DecompressionStream' in window)) return;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./world-raster-worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return;
  }

  const host = document.createElement('div');
  host.className = 'world-raster';
  host.setAttribute('aria-hidden', 'true');
  svg.before(host);
  const style = getComputedStyle(svg);
  const tokens = ['ink', 'paper', 'sea', 'land-off', 'grid', 'river'] as const;
  const colors = Object.fromEntries(tokens.map(token => [token, style.getPropertyValue(`--${token}`).trim()])) as TerrainColors;
  const urls = new Map<TerrainLevel, string>();
  const tiers = new Map<number, 'pending' | 'ready' | 'failed'>();
  const front = makeSurface();
  let presented: Frame | undefined;
  let pending: Frame | undefined;
  let camera: Camera | undefined;
  let water = true;
  let moving = false;
  let alive = true;
  let sequence = 0;

  function makeSurface() {
    const canvas = document.createElement('canvas');
    canvas.className = 'world-raster-base';
    const bitmap = canvas.getContext('bitmaprenderer', { alpha: false });
    const context = bitmap ? undefined : canvas.getContext('2d', { alpha: false });
    function paint(base: ImageBitmap, view: TerrainView) {
      if (canvas.width !== base.width || canvas.height !== base.height) {
        canvas.width = base.width;
        canvas.height = base.height;
      }
      if (parseFloat(canvas.style.width) !== view.width) canvas.style.width = `${view.width}px`;
      if (parseFloat(canvas.style.height) !== view.height) canvas.style.height = `${view.height}px`;
      if (bitmap) bitmap.transferFromImageBitmap(base);
      else {
        context!.drawImage(base, 0, 0);
        base.close();
      }
    }
    return { canvas, paint };
  }

  function post(request: TerrainRequest) {
    worker.postMessage(request);
  }

  function loadTier(minZoom: number) {
    const url = urls.get(minZoom ? 'detail' : 'overview');
    if (!url || tiers.has(minZoom)) return;
    tiers.set(minZoom, 'pending');
    post({ type: 'load', minZoom, url: `${url}.render-${minZoom}.json.gz`, colors });
  }

  function request() {
    if (!alive || pending || !camera || tiers.get(0) !== 'ready') return;
    const { transform, viewport, detail, zoom, ...rest } = camera;
    if (!viewport.width || !viewport.height) return;
    let tier = 0;
    if (detail) {
      let wanted = 0;
      for (const minZoom of DETAIL_RENDER_ZOOMS) {
        if (zoom + 1e-9 < minZoom) break;
        wanted = minZoom;
        if (tiers.get(minZoom) === 'ready') tier = minZoom;
      }
      if (wanted) loadTier(wanted);
    }
    const pixelRatio = devicePixelRatio || 1;
    const { k } = transform;
    // Refresh the 1.5× bridge buffer at rest. Live frames paint the screen itself.
    const margin = moving ? 0 : cacheMargin;
    const marginX = Math.round(viewport.width * margin * pixelRatio) / pixelRatio;
    const marginY = Math.round(viewport.height * margin * pixelRatio) / pixelRatio;
    const width = Math.round(viewport.width * pixelRatio) / pixelRatio + 2 * marginX;
    const height = Math.round(viewport.height * pixelRatio) / pixelRatio + 2 * marginY;
    if (presented?.revision === camera.revision && presented.tier === tier && presented.water === water
      && presented.view.pixelRatio === pixelRatio && presented.view.width === width && presented.view.height === height) return;
    const view = { x: transform.x + marginX, y: transform.y + marginY, k, width, height, pixelRatio };
    pending = { ...rest, transform, viewport, tier, detail, zoom, water, view, id: ++sequence };
    post({ type: 'view', id: pending.id, minZoom: tier, water, minor: pending.minor, view });
  }

  function position(): ZoomTransform {
    const target = camera!.transform;
    if (!presented) return target;
    const { transform, view } = presented;
    const factor = target.k / view.k;
    const left = target.x - view.x * factor;
    const top = target.y - view.y * factor;
    const age = camera!.revision - presented.revision;
    // A zoom always waits for a new raster. Only panning can reuse pixels without resampling.
    const bridge = age > 0 && age <= bridgeFrames && factor === 1
      && left <= 0 && top <= 0 && left + view.width * factor >= camera!.viewport.width
      && top + view.height * factor >= camera!.viewport.height;
    const visible = bridge ? target : transform;
    const scale = visible.k / view.k;
    // Move the cached bitmap and its overlay by the same whole physical pixels.
    const snap = (value: number) => bridge ? Math.round(value * view.pixelRatio) / view.pixelRatio : value;
    const shiftX = visible.x - view.x * scale;
    const shiftY = visible.y - view.y * scale;
    const x = snap(shiftX);
    const y = snap(shiftY);
    front.canvas.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale})`;
    host.toggleAttribute('data-raster-bridge', bridge);
    return bridge ? visible.translate((x - shiftX) / visible.k, (y - shiftY) / visible.k) : visible;
  }

  function fail() {
    alive = false;
    worker.terminate();
    host.remove();
    svg.removeAttribute('data-canvas-map');
    onActive(false);
    if (camera) onPresent(camera.transform);
  }

  worker.onmessage = ({ data }: MessageEvent<TerrainResponse>) => {
    if (data.type === 'ready') {
      onTierReady(data.minZoom, data.countries);
      tiers.set(data.minZoom, 'ready');
      request();
      return;
    }
    if (data.type === 'error') {
      console.warn('Die Kartengeometrie konnte nicht geladen werden.', data.message);
      tiers.set(data.minZoom, 'failed');
      if (!data.minZoom) fail();
      return;
    }
    if (!pending || pending.id !== data.id) {
      data.base.close();
      return;
    }
    const next = pending;
    pending = undefined;
    presented = next;
    front.paint(data.base, next.view);
    if (!front.canvas.isConnected) host.append(front.canvas);
    host.dataset.rasterLevel = next.tier ? 'detail' : 'overview';
    host.dataset.rasterTier = String(data.minZoom);
    host.dataset.rasterFrame = String(next.id);
    host.toggleAttribute('data-raster-water', next.water);
    host.toggleAttribute('data-raster-minor', next.water && next.minor);
    const visible = position();
    if (!svg.hasAttribute('data-canvas-map')) {
      svg.setAttribute('data-canvas-map', '');
      onActive(true);
    }
    onPresent(visible, next.tier, next.minor);
    request();
  };
  worker.onerror = fail;

  return {
    get available() { return alive; },
    draw(transform: ZoomTransform, viewport: Size, zoom: number, detail: boolean, minor: boolean) {
      const changed = !camera || camera.zoom !== zoom || camera.detail !== detail || camera.minor !== minor
        || camera.transform.x !== transform.x || camera.transform.y !== transform.y
        || camera.viewport.width !== viewport.width || camera.viewport.height !== viewport.height;
      camera = { transform, viewport, zoom, detail, minor, revision: (camera?.revision ?? 0) + Number(changed) };
      request();
      return alive ? position() : transform;
    },
    setMoving(active: boolean) { moving = active; },
    load(level: TerrainLevel, url: string) {
      if (!alive) return;
      urls.set(level, url);
      loadTier(level === 'overview' ? 0 : DETAIL_RENDER_ZOOMS[0]);
    },
    setWaterVisible(show: boolean) {
      water = show;
      request();
    },
  };
}
