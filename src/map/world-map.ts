import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import type { D3ZoomEvent, ZoomTransform } from 'd3-zoom';
import type { Topology } from 'topojson-specification';
import type { Entity, SetDefinition } from '../data/schema';
import { countryCenter, projectWorldMap, worldWidth } from './geometry';
import type { ProjectedCountry } from './geometry';
import { boundaryTolerancePx, isNearMarker, markerHitRadiusPx, markerRadiusPx, resolveCountryClick } from './hit-test';
import { clampMapY, nearestWorldX, wrapWorldX } from './viewport';

const svgNamespace = 'http://www.w3.org/2000/svg';
const copyOffsets = [-worldWidth, 0, worldWidth];
const maxZoom = 24;

interface CountryView {
  shape: SVGPathElement;
  marker: SVGCircleElement | null;
  hitArea: SVGElement;
}

interface CountryLayer {
  geometry: ProjectedCountry;
  views: CountryView[];
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
  const group = document.createElementNS(svgNamespace, 'g');
  svg.append(group);

  const copies = copyOffsets.map((offset, index) => {
    const tile = document.createElementNS(svgNamespace, 'g');
    const markers = document.createElementNS(svgNamespace, 'g');
    tile.dataset.worldCopy = String(index - 1);
    tile.setAttribute('transform', `translate(${offset},0)`);
    group.append(tile);
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
      return { shape, marker, hitArea };
    });
    layers.set(id, { geometry, views, name, outline: new Path2D(path) });
  }
  for (const { tile, markers } of copies) tile.append(markers);

  let activeTarget: string | undefined;
  let viewport = { width: 0, height: 0 };
  let displayCenterX = worldWidth / 2;
  const hitContext = document.createElement('canvas').getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selection = select(svg);

  function updateKeyboardTargets() {
    for (const layer of layers.values()) {
      const [centerX] = layer.geometry.marker ?? countryCenter(layer.geometry.bounds);
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

    for (const { views } of layers.values()) {
      for (const { marker, hitArea } of views) {
        if (marker) {
          marker.setAttribute('r', String(markerRadiusPx / k));
          hitArea.setAttribute('r', String(markerHitRadiusPx / k));
        }
      }
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
  selection.call(zoomBehavior).on('dblclick.zoom', null);

  function transformAround([x, y]: [number, number], scale: number) {
    const top = clampMapY(viewport.height / 2 - y * scale, projected.height * scale, viewport.height);
    return zoomIdentity.translate(viewport.width / 2 - x * scale, top).scale(scale);
  }

  function resetView() {
    const [minimum] = zoomBehavior.scaleExtent();
    const scale = Math.max(minimum, Math.min(viewport.height / projected.height, minimum * 2));
    const center: [number, number] = [worldWidth * 0.38, projected.height / 2];
    selection.interrupt().call(zoomBehavior.transform, transformAround(center, scale));
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
    for (const { shape, marker } of layers.get(id)?.views ?? []) {
      shape.dataset.state = state;
      if (marker) marker.dataset.state = state;
    }
  }

  function isNearCountry(country: CountryLayer, event: MouseEvent): boolean {
    const matrix = group.getScreenCTM();
    if (!matrix || !matrix.a) return false;
    const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const marker = country.geometry.marker;
    if (marker && isNearMarker(nearestWorldX(x, marker[0]), y, marker, matrix.a)) return true;
    if (!hitContext) return false;

    hitContext.lineWidth = (boundaryTolerancePx * 2) / matrix.a;
    hitContext.lineJoin = 'round';
    const wrapped = wrapWorldX(x);
    return copyOffsets.some((offset) => hitContext.isPointInStroke(country.outline, wrapped + offset, y));
  }

  svg.addEventListener('click', (event) => {
    if (!activeTarget) return;
    const target = layers.get(activeTarget);
    if (!target) return;
    const clicked = event.target instanceof SVGElement ? event.target : null;
    const id = resolveCountryClick(
      clicked?.dataset.countryId,
      clicked?.classList.contains('map-marker-hit') ?? false,
      activeTarget,
      Boolean(target.geometry.marker),
      () => isNearCountry(target, event),
    );
    if (id) onCountrySelected(id);
  });

  svg.addEventListener('keydown', (event) => {
    if (!activeTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
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
    showQuestion(id: string, clickable: boolean) {
      for (const countryId of layers.keys()) showCountryState(countryId, '');
      if (!clickable) showCountryState(id, 'highlighted');
      activeTarget = clickable ? id : undefined;
      svg.classList.toggle('is-answerable', clickable);
      resetView();
    },
    revealAnswer(correctId: string, selectedId: string, animate: boolean) {
      activeTarget = undefined;
      svg.classList.remove('is-answerable');
      updateKeyboardTargets();
      if (correctId !== selectedId) showCountryState(selectedId, 'incorrect');
      showCountryState(correctId, 'correct');

      const country = layers.get(correctId);
      if (!country) return;
      const { bounds } = country.geometry;
      const [[left, top], [right, bottom]] = bounds;
      const [x, y] = countryCenter(bounds);
      const [minimum, maximum] = zoomBehavior.scaleExtent();
      const fit = Math.min(viewport.width * 0.58 / (right - left), viewport.height * 0.48 / (bottom - top));
      const scale = Math.min(maximum, Math.max(minimum * 1.3, fit));
      const currentX = zoomTransform(svg).invertX(viewport.width / 2);
      const transform = transformAround([nearestWorldX(x, currentX), y], scale);
      selection.interrupt();
      if (animate && !motion.matches) {
        selection.transition().delay(250).duration(550).call(zoomBehavior.transform, transform);
      } else {
        selection.call(zoomBehavior.transform, transform);
      }
    },
  };
}
