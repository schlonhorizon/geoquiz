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
import { clampMapY, nearestWorldX, worldWidth, wrapWorldX } from './viewport';

const svgNamespace = 'http://www.w3.org/2000/svg';
const copyOffsets = [-worldWidth, 0, worldWidth];
const maxZoom = 24;
const flightEase = BezierEasing(.65, 0, .35, 1);
const wheelEase = BezierEasing(0, 0, .58, 1);

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
) {
  const projected = projectWorldMap(topology, config);
  const entityNames = new Map(entities.map(({ id, name }) => [id, name]));
  const layers = new Map<string, CountryLayer>();
  const markerViews: { hitArea: SVGCircleElement; dot: SVGCircleElement }[] = [];
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
      markers.append(hitArea, marker);
      markerViews.push({ hitArea, dot: marker });
      return { shape, marker, hitArea };
    });
    layers.set(id, { geometry, views, center: position ?? countryCenter(geometry.bounds), name, outline: new Path2D(path) });
  }
  for (const { tile, markers } of copies) tile.append(markers);

  let activeTarget: string | undefined;
  let viewport = { width: 0, height: 0 };
  let displayCenterX = worldWidth / 2;
  let markerScale = 0;
  let wheelTarget: number | undefined;
  let returnView: { center: [number, number]; relativeScale: number } | undefined;
  const hitContext = document.createElement('canvas').getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selection = select(svg);

  function updateKeyboardTargets() {
    for (const layer of layers.values()) {
      const [centerX] = layer.center;
      const copy = 1 + Math.round((displayCenterX - centerX) / worldWidth);
      const current = activeTarget ? layer.views[copy] : undefined;
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

  function draw(transform: ZoomTransform) {
    const { k } = transform;
    displayCenterX = wrapWorldX(transform.invertX(viewport.width / 2));
    const x = viewport.width / 2 - displayCenterX * k;
    const y = clampMapY(transform.y, projected.height * k, viewport.height);
    group.setAttribute('transform', `translate(${x},${y}) scale(${k})`);

    if (markerScale !== k) {
      for (const { hitArea, dot } of markerViews) {
        dot.setAttribute('r', String(markerRadiusPx / k));
        hitArea.setAttribute('r', String(markerHitRadiusPx / k));
      }
      markerScale = k;
    }
    updateKeyboardTargets();
  }

  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent(() => [[0, 0], [viewport.width, viewport.height]])
    .constrain((transform) => zoomIdentity
      .translate(transform.x, clampMapY(transform.y, projected.height * transform.k, viewport.height))
      .scale(transform.k))
    // Interpolate the view center and width without zooming out past either endpoint.
    .interpolate((from, to) => (t) => [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ])
    .clickDistance(5)
    .on('zoom', ({ transform }: D3ZoomEvent<SVGSVGElement, unknown>) => draw(transform));
  selection.call(zoomBehavior).on('dblclick.zoom', null).on('wheel.zoom', null);

  selection.on('wheel.quiz', (event: WheelEvent) => {
    event.preventDefault();
    const [minimum, maximum] = zoomBehavior.scaleExtent();
    const currentScale = wheelTarget ?? zoomTransform(svg).k;
    const factor = 2 ** zoomBehavior.wheelDelta().call(svg, event, 0, [svg]);
    const scale = Math.max(minimum, Math.min(maximum, currentScale * factor));
    if (scale === currentScale) return;
    selection.interrupt();
    const anchor = pointer(event, svg);
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
    const top = clampMapY(viewport.height / 2 - y * scale, projected.height * scale, viewport.height);
    return zoomIdentity.translate(viewport.width / 2 - x * scale, top).scale(scale);
  }

  function resetView(center: [number, number] = [worldWidth * 0.38, projected.height / 2]) {
    const [minimum] = zoomBehavior.scaleExtent();
    const scale = Math.max(minimum, Math.min(viewport.height / projected.height, minimum * 2));
    selection.interrupt().call(zoomBehavior.transform, transformAround(center, scale));
  }

  function flyTo([x, y]: [number, number], scale: number, animate: boolean) {
    const currentX = zoomTransform(svg).invertX(viewport.width / 2);
    const transform = transformAround([nearestWorldX(x, currentX), y], scale);
    selection.interrupt();
    if (animate && !motion.matches) {
      selection.transition().duration(800).ease(flightEase).call(zoomBehavior.transform, transform);
    } else {
      selection.call(zoomBehavior.transform, transform);
    }
  }

  function fitViewport() {
    const { width, height } = svg.getBoundingClientRect();
    if (!width || !height || (width === viewport.width && height === viewport.height)) return;
    const before = viewport;
    const transform = zoomTransform(svg);
    viewport = { width, height };
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const minimum = width / worldWidth;
    zoomBehavior.scaleExtent([minimum, minimum * maxZoom]);
    if (!before.width) {
      resetView();
      return;
    }
    const center = transform.invert([before.width / 2, before.height / 2]);
    const scale = transform.k * width / before.width;
    selection.interrupt().call(zoomBehavior.transform, transformAround(center, scale));
  }

  new ResizeObserver(fitViewport).observe(svg);
  fitViewport();

  function showCountryState(id: string, state: 'highlighted' | 'correct' | 'incorrect' | '') {
    for (const { shape, marker, hitArea } of layers.get(id)?.views ?? []) {
      shape.dataset.state = state;
      if (marker) {
        marker.dataset.state = state;
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
    if (!activeTarget) return;
    const target = layers.get(activeTarget);
    if (!target) return;
    const clicked = event.target instanceof SVGElement ? event.target : null;
    const point = pointerOnMap(event);
    const clickedMarker = clicked?.classList.contains('map-marker-hit') ?? false;
    let clickedId = clicked?.dataset.countryId;
    if (clickedMarker && point) {
      // The circles can overlap at world scale. Use distance instead of SVG paint order.
      let shortest = markerHitRadiusPx;
      for (const [id, { geometry }] of layers) {
        if (!geometry.marker) continue;
        const distance = markerDistance(point.x, point.y, geometry.marker, point.scale);
        if (distance < shortest) {
          shortest = distance;
          clickedId = id;
        }
      }
    }
    const id = resolveCountryClick(
      clickedId,
      clickedMarker,
      activeTarget,
      Boolean(target.geometry.marker),
      () => Boolean(point && isNearCountry(target, point)),
    );
    if (id) onCountrySelected(id);
  });

  svg.addEventListener('keydown', (event) => {
    if (!activeTarget || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
    const id = event.target instanceof SVGElement ? event.target.dataset.countryId : undefined;
    if (id) {
      event.preventDefault();
      onCountrySelected(id);
    }
  });

  return {
    resetView,
    zoomBy(factor: number) {
      selection.interrupt().call(zoomBehavior.scaleBy, factor);
    },
    showQuestion(id: string, { clickable, restart, animate }: { clickable: boolean; restart: boolean; animate: boolean }) {
      for (const countryId of layers.keys()) showCountryState(countryId, '');
      if (!clickable) showCountryState(id, 'highlighted');
      activeTarget = clickable ? id : undefined;
      svg.classList.toggle('is-answerable', clickable);
      if (!clickable || restart) {
        resetView(clickable ? undefined : layers.get(id)?.center);
      } else if (returnView) {
        const [minimum] = zoomBehavior.scaleExtent();
        flyTo(returnView.center, returnView.relativeScale * minimum, animate);
      } else {
        updateKeyboardTargets();
      }
      returnView = undefined;
    },
    revealAnswer(correctId: string, selectedId: string | undefined, { fly, animate }: { fly: boolean; animate: boolean }) {
      selection.interrupt();
      activeTarget = undefined;
      svg.classList.remove('is-answerable');
      updateKeyboardTargets();
      if (selectedId && correctId !== selectedId) showCountryState(selectedId, 'incorrect');
      showCountryState(correctId, 'correct');

      const country = layers.get(correctId);
      if (!country || !fly) return;
      const current = zoomTransform(svg);
      const [minimum, maximum] = zoomBehavior.scaleExtent();
      returnView = {
        center: current.invert([viewport.width / 2, viewport.height / 2]),
        relativeScale: current.k / minimum,
      };
      const { bounds } = country.geometry;
      const [[left, top], [right, bottom]] = bounds;
      const fit = Math.min(viewport.width * 0.58 / (right - left), viewport.height * 0.48 / (bottom - top));
      const scale = Math.min(maximum, Math.max(minimum * 1.3, fit));
      flyTo(country.center, scale, animate);
    },
  };
}
