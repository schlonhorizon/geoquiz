import BezierEasing from 'bezier-easing';
import { pointer, select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import type { D3ZoomEvent, ZoomTransform } from 'd3-zoom';
import type { Topology } from 'topojson-specification';
import type { MapResources } from '../data/load';
import { attributePoint } from '../data/map';
import type { AttributeDefinition, Entity, SetDefinition } from '../data/schema';
import { renderAtlasCapitals } from './atlas-capitals';
import { countryCenter, projectMapDetails, projectWorldMap } from './geometry';
import type { ProjectedCountry } from './geometry';
import { boundaryTolerancePx, isNearMarker, markerDistance, markerHitRadiusPx, markerRadiusPx, resolveCountryClick } from './hit-test';
import { createSolutionRadar } from './solution-radar';
import { clampMapY, fitCountryBounds, flightDuration, insetCountryFrame, interpolateFlight, nearestWorldX, worldWidth, wrapWorldX } from './viewport';
import type { Bounds, MapFrame } from './viewport';
import { appendWater, MINOR_RIVER_ZOOM, WORLD_DETAIL_ZOOM } from './water';
import { createMapMotion } from './map-motion';
import { createCountryHitIndex } from './country-hit-index';
import { createWorldRaster } from './world-raster';
import { createDeckMap } from './deck-world-map';

export type MapInteraction = 'gesture' | 'wheel';

type CountryState = 'highlighted' | 'correct' | 'incorrect' | '';

const svgNamespace = 'http://www.w3.org/2000/svg';
const copyOffsets = [-worldWidth, 0, worldWidth];
const maxZoom = 24;
const markerRingRadiusPx = 9;
const flightEase = BezierEasing(.65, 0, .35, 1);
const wheelEase = BezierEasing(0, 0, .58, 1);
let nextTileId = 0;

interface CountryView {
  shape: SVGPathElement;
  marker: SVGCircleElement | null;
  hitArea: SVGElement;
  detail?: SVGPathElement;
  overlay?: SVGPathElement;
}

interface CountryLayer {
  geometry: ProjectedCountry;
  views: CountryView[];
  center: [number, number];
  keyboardTarget?: SVGElement;
  name: string;
  outline: Path2D;
  detailOutline?: Path2D;
  state: CountryState;
  pulse: boolean;
  control?: SVGRectElement;
}

function appendPath(parent: SVGElement, outline: string, className: string) {
  const path = document.createElementNS(svgNamespace, 'path');
  path.setAttribute('d', outline);
  path.setAttribute('class', className);
  parent.append(path);
  return path;
}

function makeCircle([x, y]: [number, number], className: string) {
  const circle = document.createElementNS(svgNamespace, 'circle');
  circle.setAttribute('cx', String(x));
  circle.setAttribute('cy', String(y));
  circle.setAttribute('class', className);
  return circle;
}

export function renderWorldMap(
  svg: SVGSVGElement,
  topology: Topology,
  config: SetDefinition['map'],
  entities: readonly Entity[],
  onCountrySelected: (id: string) => void,
  onInteraction: (source: MapInteraction, active: boolean) => void,
  resources: MapResources & { capital?: AttributeDefinition } = {},
) {
  const projected = projectWorldMap(topology, config, resources.water);
  const overviewUrl = resources.renderUrl?.('overview');
  const experiment = new URLSearchParams(location.search).get('renderer') === 'deck';
  const deckMap = experiment && overviewUrl ? createDeckMap(svg, toggleCanvas) : undefined;
  const raster = deckMap ?? (overviewUrl ? createWorldRaster(svg, toggleCanvas, drawOverlay) : undefined);
  if (overviewUrl) raster?.load('overview', overviewUrl);
  const entityNames = new Map(entities.map(({ id, name }) => [id, name]));
  const layers = new Map<string, CountryLayer>();
  const overviewHits = createCountryHitIndex();
  const detailHits = createCountryHitIndex();
  const radar = createSolutionRadar(svg);
  const group = document.createElementNS(svgNamespace, 'g');
  group.setAttribute('class', 'world-map-camera');
  svg.append(group);
  const controls = document.createElementNS(svgNamespace, 'g');
  controls.setAttribute('class', 'world-map-controls');
  svg.append(controls);
  svg.dataset.mapDetail = 'overview';
  svg.style.setProperty('--marker-hit-radius', String(markerHitRadiusPx));
  svg.style.setProperty('--marker-radius', String(markerRadiusPx));
  svg.style.setProperty('--marker-ring-radius', String(markerRingRadiusPx));

  const copies = copyOffsets.map((offset, index) => {
    const tile = document.createElementNS(svgNamespace, 'g');
    const overview = document.createElementNS(svgNamespace, 'g');
    const detail = document.createElementNS(svgNamespace, 'g');
    const overlays = document.createElementNS(svgNamespace, 'g');
    const markers = document.createElementNS(svgNamespace, 'g');
    tile.dataset.worldCopy = String(index - 1);
    tile.setAttribute('transform', `translate(${offset},0)`);
    group.append(tile);
    const grid = appendPath(tile, projected.grid, 'map-grid');
    overview.setAttribute('class', 'map-overview');
    detail.setAttribute('class', 'map-detail');
    tile.append(overview, detail, overlays, markers);
    if (projected.land) appendPath(overview, projected.land, 'map-land');
    return { tile, grid, overview, detail, overlays, markers, offset, visible: true,
      paths: [] as { shape: SVGPathElement; bounds: Bounds }[] };
  });

  for (const geometry of projected.countries) {
    const { id, path, marker: position } = geometry;
    const name = id === undefined ? undefined : entityNames.get(id);
    if (id === undefined || name === undefined) {
      for (const { overview } of copies) appendPath(overview, path, 'map-land');
      continue;
    }

    const views: CountryView[] = copies.map(({ overview, markers }) => {
      const shape = appendPath(overview, path, 'map-country');
      shape.dataset.countryId = id;
      if (!position) return { shape, marker: null, hitArea: shape };

      const hitArea = makeCircle(position, 'map-marker-hit');
      hitArea.dataset.countryId = id;
      const marker = makeCircle(position, 'map-marker');
      const ring = makeCircle(position, 'map-marker-ring');
      markers.append(ring, hitArea, marker);
      return { shape, marker, hitArea };
    });
    const outline = new Path2D(path);
    layers.set(id, { geometry, views, center: position ?? countryCenter(geometry.bounds), name, outline, state: '', pulse: false });
    overviewHits.add(id, outline, geometry.outlineBounds);
  }
  for (const { overview } of copies) appendWater(overview, projected.water);

  const capital = resources.capital;
  const capitalData = capital ? entities.flatMap((entity) => {
    const name = entity[capital.key];
    const location = attributePoint(entity, capital);
    const bounds = layers.get(entity.id)?.geometry.bounds;
    if (typeof name !== 'string' || !name || !location || !bounds) return [];
    const point = projected.project(location);
    const [[left, top], [right, bottom]] = bounds;
    return point ? [{ id: entity.id, name, point, diagonal: Math.hypot(right - left, bottom - top) }] : [];
  }) : [];
  deckMap?.setCapitals(capitalData);
  const capitals = renderAtlasCapitals(svg, deckMap ? [] : capitalData);

  // A narrow band between the panels can require more width than the interactive tiles cover.
  const tile = copies[1].tile;
  tile.id = `world-tile-${++nextTileId}`;
  const pattern = document.createElementNS(svgNamespace, 'pattern');
  pattern.id = `${tile.id}-repeat`;
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  pattern.setAttribute('width', String(worldWidth));
  pattern.setAttribute('height', String(projected.height));
  const reference = document.createElementNS(svgNamespace, 'use');
  reference.setAttribute('href', `#${tile.id}`);
  pattern.append(reference);
  const defs = document.createElementNS(svgNamespace, 'defs');
  defs.append(pattern);
  svg.prepend(defs);
  const extraMap = [-1, 1].map(() => {
    const area = document.createElementNS(svgNamespace, 'rect');
    area.setAttribute('height', String(projected.height));
    area.setAttribute('fill', `url(#${pattern.id})`);
    group.prepend(area);
    return area;
  });

  let picking = false;
  let assistedId: string | undefined;
  let viewport = { width: 0, height: 0 };
  let displayCenterX = worldWidth / 2;
  let settledScale = 0;
  let wheelTarget: number | undefined;
  let wheelPause: number | undefined;
  let gestureActive = false;
  let radarCountry: CountryLayer | undefined;
  let flyOut = false;
  let anchorY = 0;
  let flight = 0;
  let frame: MapFrame | undefined;
  let atlas = true;
  let detailReady = false;
  let detailRequested = false;
  let detailed = false;
  let receivedDetail: Topology | undefined;
  let detailWindow: Bounds | undefined;
  let rendered = zoomIdentity;
  let overlayTransform: ZoomTransform | undefined;
  let origin = [0, 0];
  let hovered: CountryLayer | undefined;
  let keyboardFocus: CountryLayer | undefined;
  let canvasActive = false;
  const hitContext = document.createElement('canvas').getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selection = select(svg);

  function updateKeyboardTargets() {
    for (const layer of layers.values()) {
      const [centerX] = layer.center;
      const copy = 1 + Math.round((displayCenterX - centerX) / worldWidth);
      const view = picking ? layer.views[copies[copy].visible ? copy : 1] : undefined;
      const current = canvasActive ? (picking ? layer.control : undefined) : view && (detailed && !view.marker && view.detail && view.detail.style.display !== 'none'
        ? view.detail : view.hitArea);
      if (current === layer.keyboardTarget) continue;
      const previous = layer.keyboardTarget;
      if (previous) {
        previous.removeAttribute('tabindex');
        previous.removeAttribute('role');
        previous.removeAttribute('aria-label');
      }
      if (current) {
        current.setAttribute('tabindex', '0');
        current.setAttribute('role', 'button');
        current.setAttribute('aria-label', layer.name);
        if (previous && document.activeElement === previous) current.focus({ preventScroll: true });
      }
      layer.keyboardTarget = current;
    }
  }

  function toggleCanvas(active: boolean) {
    if (canvasActive === active) return;
    const focused = document.activeElement instanceof SVGElement ? document.activeElement.dataset.countryId : undefined;
    canvasActive = active;
    settledScale = 0;
    overlayTransform = undefined;
    if (active) group.style.removeProperty('--map-unit');
    if (active) {
      for (const { grid, overview, detail } of copies) {
        grid.remove();
        overview.remove();
        detail.remove();
      }
      for (const [id, layer] of layers) {
        const node = document.createElementNS(svgNamespace, 'rect');
        node.dataset.countryId = id;
        node.setAttribute('width', '1');
        node.setAttribute('height', '1');
        layer.control = node;
        controls.append(node);
        updateCanvasOverlay(layer);
      }
    } else {
      controls.replaceChildren();
      for (const { tile, grid, overview, detail, overlays } of copies) {
        tile.prepend(grid, overview, detail);
        overlays.replaceChildren();
      }
    }
    updateKeyboardTargets();
    if (focused) layers.get(focused)?.keyboardTarget?.focus({ preventScroll: true });
  }

  function updateCanvasOverlay(layer: CountryLayer) {
    if (!canvasActive) return;
    const focused = layer === keyboardFocus;
    const over = layer === hovered;
    for (const [index, view] of layer.views.entries()) {
      view.marker?.toggleAttribute('data-keyboard-focus', focused);
      if (!layer.state && !focused && !over) {
        view.overlay?.remove();
        view.overlay = undefined;
        continue;
      }
      const outline = (detailed ? view.detail?.getAttribute('d') : undefined) ?? layer.geometry.path;
      const shape = view.overlay ??= appendPath(copies[index].overlays, outline, 'map-country');
      if (shape.getAttribute('d') !== outline) shape.setAttribute('d', outline);
      shape.dataset.state = layer.state;
      shape.toggleAttribute('data-hover', over);
      shape.toggleAttribute('data-keyboard-focus', focused);
      shape.classList.toggle('map-target-pulse', layer.pulse);
    }
  }

  function installDetail(topology: Topology) {
    const geometry = projectMapDetails(topology, config);
    for (const { detail, paths } of copies) {
      for (const { d, bounds } of geometry.land) paths.push({ shape: appendPath(detail, d, 'map-land'), bounds });
    }
    for (const [id, layer] of layers) {
      const projected = geometry.countries.get(id);
      const outline = projected?.d ?? layer.geometry.path;
      layer.detailOutline = new Path2D(outline);
      detailHits.add(id, layer.detailOutline, projected?.bounds ?? layer.geometry.outlineBounds);
      copies.forEach(({ detail, paths }, index) => {
        const view = layer.views[index];
        const shape = appendPath(detail, outline, 'map-country');
        shape.dataset.countryId = id;
        shape.dataset.state = view.shape.dataset.state;
        view.detail = shape;
        if (projected) paths.push({ shape, bounds: projected.bounds });
      });
    }
    for (const { detail, paths } of copies) {
      for (const { shape, bounds } of appendWater(detail, geometry.water)) if (bounds) paths.push({ shape, bounds });
    }
    detailReady = true;
    // Give the transparent layer a computed style before starting the crossfade.
    if (!canvasActive) getComputedStyle(copies[1].detail).opacity;
  }

  function zoomLevel(scale: number) {
    return scale / Math.max(viewport.width / worldWidth, minAtlasScale());
  }

  function updateDetails(scale: number) {
    const level = zoomLevel(scale);
    const eligible = level >= WORLD_DETAIL_ZOOM;
    if (!eligible) detailRequested = false;
    else if (!detailRequested && !detailReady && resources.loadDetail) {
      detailRequested = true;
      const url = resources.renderUrl?.('detail');
      if (url) raster?.load('detail', url);
      void resources.loadDetail().then((topology) => {
        receivedDetail = topology;
        if (!camera.moving) settle(zoomTransform(svg));
      }).catch((error: unknown) => {
        console.warn('Die detaillierte Karte konnte nicht geladen werden.', error);
      });
    }
    if (eligible && receivedDetail && !detailReady) {
      installDetail(receivedDetail);
      receivedDetail = undefined;
    }
    const next = eligible && detailReady;
    if (detailed !== next) {
      detailed = next;
      svg.dataset.mapDetail = detailed ? 'detail' : 'overview';
      if (canvasActive) for (const layer of layers.values()) {
        if (layer.state || layer === hovered || layer === keyboardFocus) updateCanvasOverlay(layer);
      }
    }
    svg.toggleAttribute('data-minor-rivers', level >= MINOR_RIVER_ZOOM);
  }

  function constrainY(y: number, scale: number) {
    const { top, bottom } = !atlas && frame ? insetCountryFrame(frame) : { top: 0, bottom: viewport.height };
    return top + clampMapY(y - top, projected.height * scale, bottom - top);
  }

  function minAtlasScale() {
    return viewport.height / projected.height;
  }

  function placeRadar(transform: ZoomTransform) {
    const point = radarCountry?.geometry.marker;
    if (!point || !frame) return;
    const x = viewport.width / 2 + (nearestWorldX(point[0], displayCenterX) - displayCenterX) * transform.k;
    const y = transform.applyY(point[1]);
    radar.place(x, y, viewport.width, viewport.height, frame);
  }

  function cullDetail([[left, top], [right, bottom]]: Bounds) {
    if (detailWindow && left >= detailWindow[0][0] && right <= detailWindow[1][0]
      && top >= detailWindow[0][1] && bottom <= detailWindow[1][1]) return;
    const horizontal = (right - left) / 2;
    const vertical = (bottom - top) / 2;
    detailWindow = [[left - horizontal, top - vertical], [right + horizontal, bottom + vertical]];
    for (const { offset, paths } of copies) {
      for (const { shape, bounds: [[x, y], [endX, endY]] } of paths) {
        const visible = endX + offset >= left - horizontal && x + offset <= right + horizontal
          && endY >= top - vertical && y <= bottom + vertical;
        const display = visible ? '' : 'none';
        if (shape.style.display !== display) shape.style.display = display;
      }
    }
  }

  function drawOverlay(transform: ZoomTransform) {
    if (overlayTransform && overlayTransform.x === transform.x && overlayTransform.y === transform.y
      && overlayTransform.k === transform.k) return;
    overlayTransform = transform;
    const { k } = transform;
    const scaleChanged = settledScale !== k;
    if (scaleChanged && !canvasActive) {
      group.style.setProperty('--map-unit', `${1 / k}px`);
    }
    settledScale = k;
    displayCenterX = wrapWorldX(transform.invertX(viewport.width / 2));
    const x = viewport.width / 2 - displayCenterX * k;
    const y = transform.y;
    rendered = zoomIdentity.translate(x, y).scale(k);
    group.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
    const halfWidth = viewport.width / (2 * k);
    const left = displayCenterX - halfWidth;
    const right = displayCenterX + halfWidth;
    for (const copy of copies) {
      const visible = right >= copy.offset && left <= copy.offset + worldWidth;
      if (canvasActive && visible && (!copy.visible || scaleChanged)) copy.markers.style.setProperty('--map-unit', `${1 / k}px`);
      if (visible === copy.visible) continue;
      copy.tile.style.display = visible ? '' : 'none';
      copy.visible = visible;
    }
    const leftWidth = Math.max(0, -worldWidth - left);
    const rightWidth = Math.max(0, right - 2 * worldWidth);
    if (leftWidth || extraMap[0].getAttribute('width') !== '0') extraMap[0].setAttribute('width', String(leftWidth));
    if (leftWidth) extraMap[0].setAttribute('x', String(left));
    if (rightWidth || extraMap[1].getAttribute('width') !== '0') extraMap[1].setAttribute('width', String(rightWidth));
    if (detailed && !canvasActive) cullDetail([[left, -y / k], [right, (viewport.height - y) / k]]);
    if (atlas) capitals.draw(transform, viewport, !camera.moving);
    placeRadar(transform);
  }

  function draw(transform: ZoomTransform) {
    const level = zoomLevel(transform.k);
    const visible = raster?.draw(transform, viewport, level, detailed, level >= MINOR_RIVER_ZOOM) ?? transform;
    drawOverlay(visible);
  }

  function settle(transform: ZoomTransform) {
    raster?.setMoving(false);
    const { k, y } = transform;
    updateDetails(k);
    if (detailed && !canvasActive) cullDetail([[displayCenterX - viewport.width / (2 * k), -y / k],
      [displayCenterX + viewport.width / (2 * k), (viewport.height - y) / k]]);
    draw(transform);
    updateKeyboardTargets();
    if (atlas) capitals.draw(overlayTransform ?? transform, viewport);
  }

  extraMap[1].setAttribute('x', String(2 * worldWidth));
  const camera = createMapMotion(svg, draw, settle);
  function startMovement() {
    if (!camera.moving) {
      setHover();
      raster?.setMoving(true);
    }
    camera.start();
  }

  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent(() => [[0, 0], [viewport.width, viewport.height]])
    .constrain((transform) => zoomIdentity
      .translate(transform.x, constrainY(transform.y, transform.k))
      .scale(transform.k))
    .interpolate((from, to) => {
      const maxSpan = Math.max(viewport.width, viewport.height) * 2 * worldWidth / viewport.width;
      const widest = Math.max(from[2], to[2]);
      const peak = Math.min(Math.max(maxSpan, widest), widest * 1.18);
      const interpolate = interpolateFlight(from, to, flyOut ? peak : undefined);
      if (!atlas) return interpolate;
      const size = Math.max(viewport.width, viewport.height);
      const anchor = anchorY;
      return (time) => {
        const [x, y, span] = interpolate(time);
        const scale = Math.max(minAtlasScale(), size / span);
        return [x, (anchor - constrainY(anchor - y * scale, scale)) / scale, size / scale];
      };
    })
    .clickDistance(5)
    .on('zoom', ({ transform, sourceEvent }: D3ZoomEvent<SVGSVGElement, unknown>) => {
      if (!gestureActive && (sourceEvent?.type === 'mousemove' || sourceEvent?.type === 'touchmove')) {
        gestureActive = true;
        onInteraction('gesture', true);
      }
      if (sourceEvent || wheelTarget !== undefined) startMovement();
      camera.draw(transform);
    })
    .on('end', () => {
      camera.end(zoomTransform(svg));
      if (!gestureActive) return;
      gestureActive = false;
      onInteraction('gesture', false);
    });
  selection.call(zoomBehavior).on('dblclick.zoom', null).on('wheel.zoom', null);

  selection.on('wheel.quiz', (event: WheelEvent) => {
    event.preventDefault();
    onInteraction('wheel', true);
    window.clearTimeout(wheelPause);
    wheelPause = window.setTimeout(() => onInteraction('wheel', false), 180);
    const [minimum, maximum] = zoomBehavior.scaleExtent();
    const currentScale = wheelTarget ?? zoomTransform(svg).k;
    const factor = 2 ** zoomBehavior.wheelDelta().call(svg, event, 0, [svg]);
    const scale = Math.max(minimum, Math.min(maximum, currentScale * factor));
    if (scale === currentScale) return;
    selection.interrupt();
    startMovement();
    const anchor = pointer(event, svg);
    anchorY = anchor[1];
    flyOut = false;
    if (motion.matches) {
      selection.call(zoomBehavior.scaleTo, scale, anchor);
      return;
    }
    wheelTarget = scale;
    selection.transition().duration(180).ease(wheelEase)
      .on('end.wheel interrupt.wheel cancel.wheel', () => { wheelTarget = undefined; })
      .call(zoomBehavior.scaleTo, scale, anchor);
  }, { passive: false });

  function transformAround([x, y]: [number, number], scale: number) {
    const midY = frame ? (frame.top + frame.bottom) / 2 : viewport.height / 2;
    const top = constrainY(midY - y * scale, scale);
    return zoomIdentity.translate(viewport.width / 2 - x * scale, top).scale(scale);
  }

  function resetView(animate = false) {
    frame = undefined;
    radarCountry = undefined;
    radar.clear();
    const worldScale = viewport.width / worldWidth;
    const minimum = atlas ? minAtlasScale() : worldScale;
    zoomBehavior.scaleExtent([minimum, Math.max(worldScale, minimum) * maxZoom]);
    const scale = atlas ? minimum : Math.max(minimum, Math.min(minAtlasScale(), minimum * 2));
    flyTo([worldWidth * 0.38, projected.height / 2], scale, animate);
  }

  function flyTo([x, y]: [number, number], scale: number, animate: boolean, panOnly = false) {
    const current = zoomTransform(svg);
    const center: [number, number] = [viewport.width / 2, frame ? (frame.top + frame.bottom) / 2 : viewport.height / 2];
    anchorY = center[1];
    const [currentX, currentY] = current.invert(center);
    const targetX = nearestWorldX(x, currentX);
    const transform = transformAround([targetX, y], scale);
    const [targetCenterX, targetCenterY] = transform.invert(center);
    const distance = Math.hypot(targetCenterX - currentX, targetCenterY - currentY);
    const revision = ++flight;
    selection.interrupt();
    const settle = () => {
      if (revision !== flight || !radarCountry) return;
      radar.show(radarCountry.name);
      placeRadar(zoomTransform(svg));
    };
    const moves = Math.hypot(transform.x - current.x, transform.y - current.y) > 0.5
      || Math.abs(transform.k - current.k) > 0.0001;
    if (animate && !motion.matches && moves) {
      startMovement();
      flyOut = !panOnly && distance > 10;
      selection.transition().duration(flightDuration(distance)).ease(flightEase)
        .on('end.solution interrupt.solution cancel.solution', settle)
        .call(zoomBehavior.transform, transform, center);
    } else {
      selection.call(zoomBehavior.transform, transform);
      settle();
    }
  }

  function isInFrame([[left, top], [right, bottom]]: Bounds, visible: MapFrame, centerX: number) {
    const transform = zoomTransform(svg);
    const offset = nearestWorldX(centerX, transform.invertX(viewport.width / 2)) - centerX;
    return transform.applyX(left + offset) >= 10 && transform.applyX(right + offset) <= viewport.width - 10
      && transform.applyY(top) >= visible.top + 10 && transform.applyY(bottom) <= visible.bottom - 10;
  }

  function fitViewport() {
    const { width, height, left, top } = svg.getBoundingClientRect();
    origin = [left, top];
    if (!width || !height || (width === viewport.width && height === viewport.height)) return;
    const before = viewport;
    const transform = zoomTransform(svg);
    viewport = { width, height };
    overlayTransform = undefined;
    frame = undefined;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const minimum = atlas ? minAtlasScale() : width / worldWidth;
    const previousMinimum = zoomBehavior.scaleExtent()[0];
    const lowest = atlas || !before.width ? minimum : Math.min(minimum, previousMinimum * width / before.width);
    const highest = Math.max(width / worldWidth, minimum) * maxZoom;
    zoomBehavior.scaleExtent([lowest, highest]);
    if (!before.width) {
      resetView();
      return;
    }
    const center = transform.invert([before.width / 2, before.height / 2]);
    const scale = Math.max(lowest, Math.min(highest, transform.k * width / before.width));
    selection.interrupt().call(zoomBehavior.transform, transformAround(center, scale));
  }

  new ResizeObserver(fitViewport).observe(svg);
  fitViewport();

  function showCountryState(id: string, state: CountryState, pulse = false) {
    const layer = layers.get(id);
    if (!layer || (layer.state === state && layer.pulse === pulse)) return;
    layer.state = state;
    layer.pulse = pulse;
    for (const { shape, detail, marker, hitArea } of layer.views) {
      for (const path of detail ? [shape, detail] : [shape]) {
        path.dataset.state = state;
        path.classList.toggle('map-target-pulse', pulse);
      }
      if (marker) {
        marker.dataset.state = state;
        marker.classList.toggle('map-target-pulse', pulse);
        if (state) marker.parentElement?.append(hitArea, marker);
      }
    }
    updateCanvasOverlay(layer);
  }

  function pointerOnMap(event: MouseEvent) {
    const [x, y] = rendered.invert([event.clientX - origin[0], event.clientY - origin[1]]);
    return { x, y, scale: rendered.k };
  }

  function hitCountry({ x, y }: { x: number; y: number }) {
    return hitContext && (detailed ? detailHits : overviewHits).hit(hitContext, wrapWorldX(x), y) || undefined;
  }

  function setHover(id?: string) {
    const country = id && layers.get(id) || undefined;
    if (country === hovered) return;
    const previous = hovered;
    hovered = country;
    if (previous) updateCanvasOverlay(previous);
    if (country) updateCanvasOverlay(country);
  }

  function setKeyboardFocus(target?: Element | null) {
    const id = target instanceof SVGElement && target.matches(':focus-visible') ? target.dataset.countryId : undefined;
    const current = id && layers.get(id) || undefined;
    if (current === keyboardFocus) return;
    const previous = keyboardFocus;
    keyboardFocus = current;
    if (previous) updateCanvasOverlay(previous);
    if (current) updateCanvasOverlay(current);
  }

  controls.addEventListener('focusin', (event) => setKeyboardFocus(event.target as Element));
  controls.addEventListener('focusout', () => setKeyboardFocus());

  svg.addEventListener('pointermove', (event) => {
    if (picking && !camera.moving && !event.buttons && event.pointerType === 'mouse' && canvasActive) {
      setHover(hitCountry(pointerOnMap(event)));
    }
  });
  svg.addEventListener('pointerleave', () => setHover());

  function isNearCountry(country: CountryLayer, { x, y, scale }: { x: number; y: number; scale: number }): boolean {
    const marker = country.geometry.marker;
    if (marker && isNearMarker(x, y, marker, scale)) return true;
    if (!hitContext) return false;

    hitContext.lineWidth = (boundaryTolerancePx * 2) / scale;
    hitContext.lineJoin = 'round';
    const wrapped = wrapWorldX(x);
    const outline = detailed ? country.detailOutline ?? country.outline : country.outline;
    return copyOffsets.some((offset) => hitContext.isPointInStroke(outline, wrapped + offset, y));
  }

  svg.addEventListener('click', (event) => {
    if (!picking) return;
    const target = assistedId ? layers.get(assistedId) : undefined;
    const clicked = event.target instanceof SVGElement ? event.target : null;
    const point = pointerOnMap(event);
    const onExtraMap = extraMap.some((area) => area === clicked);
    let clickedMarker = clicked?.classList.contains('map-marker-hit') ?? false;
    let clickedId = clicked?.dataset.countryId;
    if ((clickedMarker || onExtraMap) && point) {
      // The circles can overlap at world scale. Use distance instead of SVG paint order.
      let shortest = markerHitRadiusPx;
      for (const [id, { geometry }] of layers) {
        if (!geometry.marker) continue;
        const distance = markerDistance(point.x, point.y, geometry.marker, point.scale);
        if (distance < shortest) {
          shortest = distance;
          clickedId = id;
          clickedMarker = true;
        }
      }
    }
    if (!clickedMarker && (onExtraMap || canvasActive)) clickedId = hitCountry(point);
    const id = assistedId && target ? resolveCountryClick(
      clickedId,
      clickedMarker,
      assistedId,
      Boolean(target.geometry.marker),
      () => Boolean(point && isNearCountry(target, point)),
    ) : clickedId;
    if (id) onCountrySelected(id);
  });

  svg.addEventListener('keydown', (event) => {
    if (!picking || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
    const id = event.target instanceof SVGElement ? event.target.dataset.countryId : undefined;
    if (id) {
      event.preventDefault();
      onCountrySelected(id);
    }
  });

  return {
    resetView,
    setWaterVisible(show: boolean) { raster?.setWaterVisible(show); },
    setAtlas(active: boolean) {
      atlas = active;
      deckMap?.setAtlas(active);
      if (!active) capitals.clear();
    },
    clear() {
      flight++;
      radarCountry = undefined;
      radar.clear();
      selection.interrupt();
      for (const id of layers.keys()) showCountryState(id, '');
    },
    setPicking(enabled: boolean, assist?: string) {
      picking = enabled;
      if (!enabled) {
        setHover();
        setKeyboardFocus();
      }
      assistedId = assist;
      svg.classList.toggle('is-answerable', enabled);
      updateKeyboardTargets();
    },
    mark: showCountryState,
    focusCountries(ids: readonly string[], visible: MapFrame, animate: boolean, solutionId?: string) {
      const bounds = ids.flatMap((id) => {
        const country = layers.get(id);
        return country ? [country.geometry.bounds] : [];
      });
      if (!bounds.length || !viewport.width) return;
      const top = Math.min(viewport.height - 1, Math.max(0, visible.top));
      const bottom = Math.max(top + 1, Math.min(viewport.height, visible.bottom));
      const previousFrame = frame;
      frame = { top, bottom };
      const [, maximum] = zoomBehavior.scaleExtent();
      const view = fitCountryBounds(bounds, viewport.width, frame, maximum);
      const currentScale = zoomTransform(svg).k;
      const panOnly = Boolean(previousFrame && currentScale <= view.scale + 0.0001
        && isInFrame(view.bounds, frame, view.center[0]));
      const solution = solutionId ? layers.get(solutionId) : undefined;
      radarCountry = solution?.geometry.marker ? solution : undefined;
      if (!radarCountry) radar.clear();
      const scale = atlas ? Math.max(minAtlasScale(), view.scale) : panOnly ? currentScale : view.scale;
      zoomBehavior.scaleExtent([atlas ? minAtlasScale() : Math.min(viewport.width / worldWidth, scale), maximum]);
      flyTo(view.center, scale, animate, panOnly);
    },
  };
}
