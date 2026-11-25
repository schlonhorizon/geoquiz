import BezierEasing from 'bezier-easing';
import { pointer, select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import type { D3ZoomEvent, ZoomTransform } from 'd3-zoom';
import type { Topology } from 'topojson-specification';
import type { Entity, SetDefinition } from '../data/schema';
import { countryCenter, projectWorldMap } from './geometry';
import type { ProjectedCountry } from './geometry';
import { boundaryTolerancePx, isNearMarker, markerDistance, markerHitRadiusPx, markerRadiusPx, resolveCountryClick } from './hit-test';
import { createSolutionRadar } from './solution-radar';
import { clampMapY, fitCountryBounds, flightDuration, insetCountryFrame, interpolateFlight, nearestWorldX, worldWidth, wrapWorldX } from './viewport';
import type { Bounds, MapFrame } from './viewport';

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
}

interface CountryLayer {
  geometry: ProjectedCountry;
  views: CountryView[];
  center: [number, number];
  keyboardView?: CountryView;
  name: string;
  outline: Path2D;
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
) {
  const projected = projectWorldMap(topology, config);
  const entityNames = new Map(entities.map(({ id, name }) => [id, name]));
  const layers = new Map<string, CountryLayer>();
  const markerViews: { hitArea: SVGCircleElement; dot: SVGCircleElement; ring: SVGCircleElement }[] = [];
  const radar = createSolutionRadar(svg);
  const group = document.createElementNS(svgNamespace, 'g');
  svg.append(group);

  const copies = copyOffsets.map((offset, index) => {
    const tile = document.createElementNS(svgNamespace, 'g');
    const markers = document.createElementNS(svgNamespace, 'g');
    tile.dataset.worldCopy = String(index - 1);
    tile.setAttribute('transform', `translate(${offset},0)`);
    group.append(tile);
    appendPath(tile, projected.grid, 'map-grid');
    if (projected.land) appendPath(tile, projected.land, 'map-land');
    return { tile, markers };
  });

  for (const geometry of projected.countries) {
    const { id, path, marker: position } = geometry;
    const name = id === undefined ? undefined : entityNames.get(id);
    if (id === undefined || name === undefined) {
      for (const { tile } of copies) appendPath(tile, path, 'map-land');
      continue;
    }

    const views: CountryView[] = copies.map(({ tile, markers }) => {
      const shape = appendPath(tile, path, 'map-country');
      shape.dataset.countryId = id;
      if (!position) return { shape, marker: null, hitArea: shape };

      const hitArea = makeCircle(position, 'map-marker-hit');
      hitArea.dataset.countryId = id;
      const marker = makeCircle(position, 'map-marker');
      const ring = makeCircle(position, 'map-marker-ring');
      markers.append(ring, hitArea, marker);
      markerViews.push({ hitArea, dot: marker, ring });
      return { shape, marker, hitArea };
    });
    layers.set(id, { geometry, views, center: position ?? countryCenter(geometry.bounds), name, outline: new Path2D(path) });
  }
  for (const { tile, markers } of copies) tile.append(markers);

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
  let markerScale = 0;
  let wheelTarget: number | undefined;
  let wheelPause: number | undefined;
  let gestureActive = false;
  let radarCountry: CountryLayer | undefined;
  let flyOut = false;
  let anchorY = 0;
  let flight = 0;
  let frame: MapFrame | undefined;
  let atlas = true;
  const hitContext = document.createElement('canvas').getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selection = select(svg);

  function updateKeyboardTargets() {
    for (const layer of layers.values()) {
      const [centerX] = layer.center;
      const copy = 1 + Math.round((displayCenterX - centerX) / worldWidth);
      const current = picking ? layer.views[copy] : undefined;
      if (current === layer.keyboardView) continue;
      if (layer.keyboardView) {
        const { hitArea } = layer.keyboardView;
        hitArea.removeAttribute('tabindex');
        hitArea.removeAttribute('role');
        hitArea.removeAttribute('aria-label');
      }
      if (current) {
        current.hitArea.setAttribute('tabindex', '0');
        current.hitArea.setAttribute('role', 'button');
        current.hitArea.setAttribute('aria-label', layer.name);
      }
      layer.keyboardView = current;
    }
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

  function draw(transform: ZoomTransform) {
    const { k } = transform;
    displayCenterX = wrapWorldX(transform.invertX(viewport.width / 2));
    const x = viewport.width / 2 - displayCenterX * k;
    const y = transform.y;
    group.setAttribute('transform', `translate(${x},${y}) scale(${k})`);
    const halfWidth = viewport.width / (2 * k);
    const leftEdge = Math.min(-worldWidth, displayCenterX - halfWidth);
    const rightEdge = Math.max(2 * worldWidth, displayCenterX + halfWidth);
    extraMap[0].setAttribute('x', String(leftEdge));
    extraMap[0].setAttribute('width', String(-worldWidth - leftEdge));
    extraMap[1].setAttribute('x', String(2 * worldWidth));
    extraMap[1].setAttribute('width', String(rightEdge - 2 * worldWidth));

    if (markerScale !== k) {
      for (const { hitArea, dot, ring } of markerViews) {
        dot.setAttribute('r', String(markerRadiusPx / k));
        hitArea.setAttribute('r', String(markerHitRadiusPx / k));
        ring.setAttribute('r', String(markerRingRadiusPx / k));
      }
      markerScale = k;
    }
    updateKeyboardTargets();
    placeRadar(transform);
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
      draw(transform);
    })
    .on('end', () => {
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
    const { width, height } = svg.getBoundingClientRect();
    if (!width || !height || (width === viewport.width && height === viewport.height)) return;
    const before = viewport;
    const transform = zoomTransform(svg);
    viewport = { width, height };
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
    for (const { shape, marker, hitArea } of layers.get(id)?.views ?? []) {
      shape.dataset.state = state;
      shape.classList.toggle('map-target-pulse', pulse);
      if (marker) {
        marker.dataset.state = state;
        marker.classList.toggle('map-target-pulse', pulse);
        if (state) marker.parentElement?.append(hitArea, marker);
      }
    }
  }

  function pointerOnMap(event: MouseEvent) {
    const matrix = group.getScreenCTM();
    if (!matrix || !matrix.a) return;
    const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x, y, scale: matrix.a };
  }

  function isNearCountry(country: CountryLayer, { x, y, scale }: { x: number; y: number; scale: number }): boolean {
    const marker = country.geometry.marker;
    if (marker && isNearMarker(x, y, marker, scale)) return true;
    if (!hitContext) return false;

    hitContext.lineWidth = (boundaryTolerancePx * 2) / scale;
    hitContext.lineJoin = 'round';
    const wrapped = wrapWorldX(x);
    return copyOffsets.some((offset) => hitContext.isPointInStroke(country.outline, wrapped + offset, y));
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
      if (!clickedMarker && onExtraMap && hitContext) {
        const x = wrapWorldX(point.x);
        for (const [id, { outline }] of layers) {
          if (hitContext.isPointInPath(outline, x, point.y)) clickedId = id;
        }
      }
    }
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
    setAtlas(active: boolean) { atlas = active; },
    clear() {
      flight++;
      radarCountry = undefined;
      radar.clear();
      selection.interrupt();
      for (const id of layers.keys()) showCountryState(id, '');
    },
    setPicking(enabled: boolean, assist?: string) {
      picking = enabled;
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
