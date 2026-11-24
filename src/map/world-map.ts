import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { D3ZoomEvent } from 'd3-zoom';
import type { Topology } from 'topojson-specification';
import type { Entity, SetDefinition } from '../data/schema';
import { getCountryFocus, maxZoom, projectWorldMap, worldHeight, worldWidth } from './geometry';
import type { ProjectedCountry } from './geometry';
import { boundaryTolerancePx, isNearMarker, markerHitRadiusPx, markerRadiusPx, resolveCountryClick } from './hit-test';

const svgNamespace = 'http://www.w3.org/2000/svg';

interface CountryLayer {
  geometry: ProjectedCountry;
  shape: SVGPathElement;
  marker: SVGCircleElement | null;
  hitArea: SVGElement;
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
  svg.setAttribute('viewBox', `0 0 ${worldWidth} ${worldHeight}`);
  svg.append(group);
  appendPath(group, projected.ocean, 'map-ocean');
  if (projected.land) appendPath(group, projected.land, 'map-land');

  const markerLayer = document.createElementNS(svgNamespace, 'g');
  for (const geometry of projected.countries) {
    const { id, path, marker: position } = geometry;
    const name = id === undefined ? undefined : entityNames.get(id);
    if (id === undefined || name === undefined) {
      appendPath(group, path, 'map-land');
      continue;
    }

    const shape = appendPath(group, path, 'map-country');
    shape.dataset.countryId = id;
    let marker: SVGCircleElement | null = null;
    let hitArea: SVGElement = shape;
    if (position) {
      const markerHit = makeCircle(position, 'map-marker-hit');
      markerHit.dataset.countryId = id;
      marker = makeCircle(position, 'map-marker');
      markerLayer.append(markerHit, marker);
      hitArea = markerHit;
    }
    layers.set(id, { geometry, shape, marker, hitArea, name, outline: new Path2D(path) });
  }
  group.append(markerLayer);

  let activeTarget: string | undefined;
  const hitContext = document.createElement('canvas').getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selection = select(svg);

  function resizeMarkers() {
    const scale = group.getScreenCTM()?.a;
    if (!scale) return;
    for (const { marker, hitArea } of layers.values()) {
      if (marker) {
        marker.setAttribute('r', String(markerRadiusPx / scale));
        hitArea.setAttribute('r', String(markerHitRadiusPx / scale));
      }
    }
  }

  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .extent([[0, 0], [worldWidth, worldHeight]])
    .scaleExtent([1, maxZoom])
    .translateExtent([[-worldWidth / 2, -worldHeight / 2], [worldWidth * 1.5, worldHeight * 1.5]])
    .clickDistance(5)
    .on('zoom', ({ transform }: D3ZoomEvent<SVGSVGElement, unknown>) => {
      group.setAttribute('transform', transform.toString());
      resizeMarkers();
    });
  selection.call(zoomBehavior);
  new ResizeObserver(resizeMarkers).observe(svg);
  resizeMarkers();

  function setClickable(enabled: boolean) {
    svg.classList.toggle('is-answerable', enabled);
    for (const { hitArea, name } of layers.values()) {
      if (enabled) {
        hitArea.setAttribute('tabindex', '0');
        hitArea.setAttribute('role', 'button');
        hitArea.setAttribute('aria-label', name);
      } else {
        hitArea.removeAttribute('tabindex');
        hitArea.removeAttribute('role');
        hitArea.removeAttribute('aria-label');
      }
    }
  }

  function showCountryState(id: string, state: 'highlighted' | 'correct' | 'incorrect' | '') {
    const country = layers.get(id);
    if (country) {
      country.shape.dataset.state = state;
      if (country.marker) country.marker.dataset.state = state;
    }
  }

  function isNearCountry(country: CountryLayer, event: MouseEvent): boolean {
    const matrix = group.getScreenCTM();
    if (!matrix || !matrix.a) return false;
    const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const marker = country.geometry.marker;
    if (marker && isNearMarker(x, y, marker, matrix.a)) return true;
    if (!hitContext) return false;

    hitContext.lineWidth = (boundaryTolerancePx * 2) / matrix.a;
    hitContext.lineJoin = 'round';
    return hitContext.isPointInStroke(country.outline, x, y);
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
      Boolean(target.marker),
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

  function resetView() {
    selection.interrupt().call(zoomBehavior.transform, zoomIdentity);
  }

  return {
    resetView,
    zoomBy(factor: number) {
      selection.interrupt().call(zoomBehavior.scaleBy, factor);
    },
    showQuestion(id: string, clickable: boolean) {
      resetView();
      for (const countryId of layers.keys()) showCountryState(countryId, '');
      if (!clickable) showCountryState(id, 'highlighted');
      activeTarget = clickable ? id : undefined;
      setClickable(clickable);
    },
    revealAnswer(correctId: string, selectedId: string) {
      activeTarget = undefined;
      setClickable(false);
      if (correctId !== selectedId) showCountryState(selectedId, 'incorrect');
      showCountryState(correctId, 'correct');

      const country = layers.get(correctId);
      if (!country) return;
      const { center: [x, y], scale } = getCountryFocus(country.geometry.bounds);
      const transform = zoomIdentity.translate(worldWidth / 2, worldHeight / 2).scale(scale).translate(-x, -y);
      selection.interrupt();
      if (motion.matches) {
        selection.call(zoomBehavior.transform, transform);
      } else {
        selection.transition().delay(300).duration(550).call(zoomBehavior.transform, transform);
      }
    },
  };
}
