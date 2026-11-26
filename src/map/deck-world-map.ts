import { COORDINATE_SYSTEM, Deck, OrthographicView } from '@deck.gl/core';
import type { Layer, OrthographicViewState } from '@deck.gl/core';
import { IconLayer, PathLayer, SolidPolygonLayer, TextLayer } from '@deck.gl/layers';
import { Matrix4 } from '@math.gl/core';
import type { ZoomTransform } from 'd3-zoom';
import type { Coordinate } from '../data/map';
import { ATLAS_CAPITAL_LABEL_MIN_PX, ATLAS_CAPITAL_MARKER_MIN_PX } from './atlas-capitals';
import { loadTerrainTier } from './terrain-data';
import { worldWidth, wrapWorldX } from './viewport';
import { DETAIL_RENDER_ZOOMS } from './world-raster-types';
import type { TerrainLevel, TerrainShape } from './world-raster-types';

type Size = { width: number; height: number };
type Ring = Coordinate[];
type Polygon = Ring[];
type Color = [number, number, number, number];
type Capital = { id: string; name: string; point: Coordinate; diagonal: number };
type Label = Capital & { side: number };
type Geometry = { polygons: Polygon[]; lines: Ring[] };
type Tile = { copy: number; left: number; top: number; right: number; bottom: number };
const cell = 48;
const square = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="6" height="6"%3E%3Cpath fill="white" d="M0 0h6v6H0z"/%3E%3C/svg%3E';

function signedArea(ring: Ring) {
  return ring.reduce((area, [x, y], i) => {
    const [nextX, nextY] = ring[(i + 1) % ring.length];
    return area + x * nextY - y * nextX;
  }, 0);
}

function contains(ring: Ring, [x, y]: Coordinate) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[j];
    if ((y0 > y) !== (y1 > y) && x < (x1 - x0) * (y - y0) / (y1 - y0) + x0) inside = !inside;
  }
  return inside;
}

function prepareGeometry(shapes: TerrainShape[]) {
  const result = new Map<string, Geometry>();
  for (const { name, d } of shapes) {
    let geometry = result.get(name);
    if (!geometry) result.set(name, geometry = { polygons: [], lines: [] });
    const closed: { points: Ring; area: number }[] = [];
    let points: Ring = [];
    for (const match of d.matchAll(/([ML])(-?[\d.]+),(-?[\d.]+)|Z/g)) {
      const [token, command, x, y] = match;
      if (command === 'M' && points.length > 1) geometry.lines.push(points);
      if (command === 'M') points = [];
      if (command) points.push([Number(x), Number(y)]);
      if (token === 'Z' && points.length > 2) {
        closed.push({ points, area: signedArea(points) });
        geometry.lines.push([...points, points[0]]);
        points = [];
      }
    }
    if (points.length > 1) geometry.lines.push(points);
    closed.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
    const polygons: Polygon[] = [];
    const exteriorSign = Math.sign(closed[0]?.area ?? 1);
    for (const { points, area } of closed) {
      const parent = Math.sign(area) === exteriorSign ? undefined : polygons.find(([ring]) => contains(ring, points[0]));
      if (parent) parent.push(points);
      else polygons.push([points]);
    }
    geometry.polygons.push(...polygons);
  }
  return result;
}

function color(value: string): Color {
  if (value.startsWith('rgb')) {
    const [r, g, b, alpha = 1] = (value.match(/[\d.]+/g) ?? []).map(Number);
    return [r, g, b, Math.round(alpha * 255)];
  }
  const hex = value.replace(/^#/, '');
  const rgb = hex.length === 3 ? [...hex].map(token => token.repeat(2)) : hex.match(/.{2}/g) ?? [];
  return [parseInt(rgb[0], 16), parseInt(rgb[1], 16), parseInt(rgb[2], 16), 255];
}

export function createDeckMap(
  svg: SVGSVGElement,
  onActive: (active: boolean) => void,
) {
  const canvas = document.createElement('canvas');
  if (!canvas.getContext('webgl2', { alpha: true, antialias: true })) return;
  const host = document.createElement('div');
  host.className = 'world-raster';
  host.setAttribute('aria-hidden', 'true');
  host.dataset.renderer = 'deck';
  host.style.background = 'var(--sea)';
  canvas.className = 'world-raster-base';
  host.append(canvas);
  svg.before(host);
  const css = getComputedStyle(svg);
  const ink = color(css.getPropertyValue('--ink').trim());
  const paper = color(css.getPropertyValue('--paper').trim());
  const sea = color(css.getPropertyValue('--sea').trim());
  const gray = color(css.getPropertyValue('--land-off').trim());
  const river = color(css.getPropertyValue('--river').trim());
  const grid = color(css.getPropertyValue('--grid').trim());
  const fontFamily = css.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  const measure = document.createElement('canvas').getContext('2d')!;
  const urls = new Map<TerrainLevel, string>();
  const loaded = new Map<number, TerrainShape[]>();
  const regions = new Map<string, ReturnType<typeof prepareGeometry>>();
  const requested = new Set<number>();
  let capitals: Capital[] = [];
  let pins: Capital[] = [];
  let labels: Label[] = [];
  let atlas = true;
  let water = true;
  let moving = false;
  let camera: { transform: ZoomTransform; viewport: Size; zoom: number; detail: boolean; minor: boolean } | undefined;
  let initialized = false;
  let failed = false;
  let frame = 0;
  let cityRevision = 0;
  let layerKey = '';
  let layoutKey = '';
  let pixelRatio = devicePixelRatio;
  const deck = new Deck<OrthographicView>({
    canvas,
    width: '100%',
    height: '100%',
    views: new OrthographicView({ id: 'miller', flipY: true }),
    viewState: { target: [worldWidth / 2, 200, 0], zoom: 0 },
    controller: false,
    useDevicePixels: pixelRatio,
    onLoad() {
      initialized = true;
      render();
    },
    onError(error) {
      if (failed) return;
      failed = true;
      console.error('Deck.gl-Prototyp konnte nicht zeichnen.', error);
      host.remove();
      svg.removeAttribute('data-canvas-map');
      onActive(false);
    },
    onAfterRender() {
      if (failed || !loaded.has(0)) return;
      host.dataset.rasterFrame = String(++frame);
      if (!svg.hasAttribute('data-canvas-map')) {
        svg.setAttribute('data-canvas-map', '');
        onActive(true);
      }
    },
  });

  function loadTier(minZoom: number) {
    const url = urls.get(minZoom ? 'detail' : 'overview');
    if (!url || requested.has(minZoom)) return;
    requested.add(minZoom);
    void loadTerrainTier(`${url}.render-${minZoom}.json.gz`).then(({ shapes }) => {
      loaded.set(minZoom, shapes);
      render();
    }).catch(error => console.error('Deck.gl-Kartenebene konnte nicht geladen werden.', error));
  }

  function placeCities(transform: ZoomTransform, viewport: Size, x: number) {
    pins = [];
    labels = [];
    cityRevision++;
    if (!atlas) return;
    measure.font = `600 11px "${fontFamily}"`;
    const occupied: [number, number, number, number][] = [];
    for (const city of capitals) {
      const size = city.diagonal * transform.k;
      if (size < ATLAS_CAPITAL_MARKER_MIN_PX) break;
      const x0 = x + worldWidth * Math.round((viewport.width / 2 - x - city.point[0] * transform.k) / (worldWidth * transform.k)) * transform.k;
      const px = x0 + city.point[0] * transform.k;
      const py = transform.applyY(city.point[1]);
      if (px < 0 || px > viewport.width || py < 0 || py > viewport.height) continue;
      pins.push(city);
      if (size < ATLAS_CAPITAL_LABEL_MIN_PX) continue;
      const width = Math.ceil(measure.measureText(city.name).width) + 6;
      for (const side of [1, -1]) {
        const left = side === 1 ? px + 4 : px - 4 - width;
        const right = left + width;
        const top = py - 7.5;
        const bottom = py + 7.5;
        if (left < 0 || right > viewport.width || top < 0 || bottom > viewport.height) continue;
        if (occupied.some(([l, t, r, b]) => left < r && l < right && top < b && t < bottom)) continue;
        occupied.push([left, top, right, bottom]);
        labels.push({ ...city, side });
        break;
      }
    }
  }

  function regionKey({ left, top, right, bottom }: Tile) {
    return `${left}:${top}:${right}:${bottom}`;
  }

  function createLayers(tier: number, tiles: Tile[], minor: boolean) {
    const layers: Layer[] = [];
    const shapes = loaded.get(tier)!;
    for (const tile of tiles) {
      const { copy, left, top, right, bottom } = tile;
      const key = `${tier}:${regionKey(tile)}`;
      let geometry = regions.get(key);
      if (!geometry) {
        geometry = prepareGeometry(shapes.filter(({ bounds: [[l, t], [r, b]] }) =>
          l <= right && r >= left && t <= bottom && b >= top));
        if (regions.size >= 12) regions.delete(regions.keys().next().value!);
        regions.set(key, geometry);
      }
      const visible = geometry;
      const modelMatrix = new Matrix4().translate([copy * worldWidth, 0, 0]);
      const common = { modelMatrix, coordinateSystem: COORDINATE_SYSTEM.CARTESIAN, pickable: false };
      function paths(key: string, tint: Color, width: number) {
        const data = visible.get(key)?.lines;
        if (data?.length) layers.push(new PathLayer<Ring>({
          ...common, id: `${copy}-${key}-line`, data, getPath: item => item,
          getColor: tint, widthUnits: 'pixels', getWidth: width, capRounded: true, jointRounded: true,
        }));
      }
      function area(key: string, tint: Color) {
        const data = visible.get(key)?.polygons;
        if (data?.length) layers.push(new SolidPolygonLayer<Polygon>({
          ...common, id: `${copy}-${key}-fill`, data, getPolygon: item => item, getFillColor: tint,
        }));
        paths(key, ink, .8);
      }
      paths('map-grid', grid, 1);
      area('map-land', gray);
      area('map-country', paper);
      if (water) {
        paths('map-river', river, .6);
        if (minor) paths('map-river-minor', river, .6);
        area('map-lake', sea);
      }
      if (atlas && pins.length) {
        layers.push(new IconLayer<Capital>({
          ...common, id: `${copy}-city-pins`, data: pins, iconAtlas: square,
          iconMapping: { square: { x: 0, y: 0, width: 6, height: 6, mask: true } },
          getIcon: () => 'square', getPosition: item => item.point, getSize: 6, getColor: ink, sizeUnits: 'pixels',
        }));
      }
      if (atlas && labels.length) {
        layers.push(new TextLayer<Label>({
          ...common, id: `${copy}-city-labels`, data: labels, fontFamily, fontWeight: 600,
          getPosition: item => item.point, getText: item => item.name, getColor: ink, getSize: 11,
          getPixelOffset: item => [7 * item.side, 0], getTextAnchor: item => item.side === 1 ? 'start' : 'end',
          getAlignmentBaseline: 'center', characterSet: 'auto', sizeUnits: 'pixels',
          fontSettings: { sdf: true }, outlineColor: paper, outlineWidth: .16,
        }));
      }
    }
    return layers;
  }

  function render() {
    if (!initialized || failed || !camera || !loaded.has(0)) return;
    const { transform, viewport, zoom, detail, minor } = camera;
    let tier = 0, wanted = 0;
    for (const minZoom of DETAIL_RENDER_ZOOMS) {
      if (!detail || zoom < minZoom) break;
      wanted = minZoom;
      if (loaded.has(minZoom)) tier = minZoom;
    }
    if (wanted) loadTier(wanted);
    const center = wrapWorldX(transform.invertX(viewport.width / 2));
    const x = viewport.width / 2 - center * transform.k;
    const { k, y } = transform;
    const first = Math.floor(-x / (k * worldWidth));
    const last = Math.ceil((viewport.width - x) / (k * worldWidth));
    const low = (value: number) => Math.floor((value - 1) / cell) * cell;
    const high = (value: number) => Math.ceil((value + 1) / cell) * cell;
    const tiles = Array.from({ length: last - first }, (_, i) => {
      const copy = first + i;
      const origin = x + copy * worldWidth * k;
      return {
        copy, left: Math.max(0, low(-origin / k)), top: Math.max(0, low(-y / k)),
        right: Math.min(worldWidth, high((viewport.width - origin) / k)), bottom: high((viewport.height - y) / k),
      };
    });
    const nextLayoutKey = `${atlas}:${x}:${transform.y}:${transform.k}:${viewport.width}:${viewport.height}`;
    if (!moving && nextLayoutKey !== layoutKey) {
      layoutKey = nextLayoutKey;
      placeCities(transform, viewport, x);
    }
    const nextLayerKey = `${tier}:${first}:${tiles.map(regionKey).join(',')}:${water}:${minor}:${atlas}:${cityRevision}`;
    const layers = layerKey === nextLayerKey ? undefined : createLayers(tier, tiles, minor);
    layerKey = nextLayerKey;
    const viewState: OrthographicViewState = { target: [center, transform.invertY(viewport.height / 2), 0], zoom: Math.log2(transform.k) };
    host.dataset.rasterLevel = tier ? 'detail' : 'overview';
    host.dataset.rasterTier = String(tier);
    host.dataset.mapLabels = String(atlas ? labels.length : 0);
    host.toggleAttribute('data-raster-water', water);
    host.toggleAttribute('data-raster-minor', water && minor);
    const dprChange = pixelRatio === devicePixelRatio ? {} : { useDevicePixels: pixelRatio = devicePixelRatio };
    deck.setProps({ viewState, ...dprChange, ...(layers && { layers }) });
    deck.redraw('camera');
  }

  return {
    draw(transform: ZoomTransform, viewport: Size, zoom: number, detail: boolean, minor: boolean) {
      camera = { transform, viewport, zoom, detail, minor };
      render();
      return transform;
    },
    setMoving(active: boolean) { moving = active; },
    setAtlas(active: boolean) { atlas = active; layoutKey = ''; render(); },
    setCapitals(cities: Capital[]) { capitals = [...cities].sort((a, b) => b.diagonal - a.diagonal); layoutKey = ''; },
    setWaterVisible(show: boolean) { water = show; render(); },
    load(level: TerrainLevel, url: string) {
      urls.set(level, url);
      loadTier(level === 'overview' ? 0 : DETAIL_RENDER_ZOOMS[0]);
    },
  };
}
