import { select } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import type { D3ZoomEvent } from 'd3-zoom';
import type { Coordinate } from '../data/map';
import type { CountryMap } from '../map/country-map';
import { createCapitalFeedback } from './capital-feedback';
import type { CapitalAttempt } from './capital-feedback';

const svgNamespace = 'http://www.w3.org/2000/svg';
const dragThreshold = 5;

function element<K extends keyof SVGElementTagNameMap>(tag: K, className: string) {
  const node = document.createElementNS(svgNamespace, tag);
  node.setAttribute('class', className);
  return node;
}

function endpoints(line: SVGLineElement, [x, y]: Coordinate, [toX, toY] = [x, y]) {
  line.setAttribute('x1', String(x));
  line.setAttribute('y1', String(y));
  line.setAttribute('x2', String(toX));
  line.setAttribute('y2', String(toY));
}

function pin(className: string) {
  const node = element('circle', className);
  node.setAttribute('r', '2');
  return node;
}

function placePin(pin: SVGCircleElement, [x, y]: Coordinate) {
  pin.setAttribute('cx', String(x));
  pin.setAttribute('cy', String(y));
}

export function renderCountryMap(
  model: CountryMap,
  label: string,
  options: {
    onPick?: (point: Coordinate) => void;
    onResolvedClick?: () => void;
    onInteraction?: (active: boolean) => void;
    answer?: Coordinate;
    capitalName?: string;
  } = {},
) {
  const svg = element('svg', 'country-map');
  const [left, top, width, height] = model.view;
  svg.setAttribute('viewBox', model.view.join(' '));
  svg.setAttribute('aria-label', label);
  svg.setAttribute('role', options.onPick ? 'application' : 'img');
  const scene = element('g', 'country-map-scene');
  for (const outline of model.context) {
    const background = element('path', 'local-neighbor');
    background.setAttribute('d', outline);
    scene.append(background);
  }
  const land = element('path', 'local-outline');
  land.setAttribute('d', model.outline);
  land.setAttribute('pathLength', '1');
  const line = element('line', 'capital-line');
  line.setAttribute('pathLength', '1');
  const answerPin = pin('capital-answer');
  const cursorPin = pin('capital-cursor');
  scene.append(land, line, answerPin);
  svg.append(scene, cursorPin);
  const frame = document.createElement('div');
  frame.className = 'country-map-frame';
  frame.append(svg);
  const feedback = options.onPick ? createCapitalFeedback(frame, scene) : undefined;
  let cursor: Coordinate = [left + width / 2, top + height / 2];
  let selecting = Boolean(options.onPick);
  let active = false;
  const selection = select(svg);

  function extent(): [Coordinate, Coordinate] {
    const matrix = svg.getScreenCTM();
    if (!matrix) return [[left, top], [left + width, top + height]];
    const inverse = matrix.inverse();
    const bounds = svg.getBoundingClientRect();
    const min = new DOMPoint(bounds.left, bounds.top).matrixTransform(inverse);
    const max = new DOMPoint(bounds.right, bounds.bottom).matrixTransform(inverse);
    return [[min.x, min.y], [max.x, max.y]];
  }

  const behavior = zoom<SVGSVGElement, unknown>().extent(extent).translateExtent(model.world)
    .scaleExtent([.35, 24]).clickDistance(dragThreshold)
    .on('zoom', ({ sourceEvent, transform }: D3ZoomEvent<SVGSVGElement, unknown>) => {
      if (sourceEvent && !active) options.onInteraction?.(active = true);
      scene.setAttribute('transform', transform.toString());
      feedback?.layout();
    })
    .on('end', () => {
      if (active) options.onInteraction?.(active = false);
    });

  function showMarkers(points: Coordinate[]) {
    if (!options.onPick || !svg.isConnected) return;
    const [[minX, minY], [maxX, maxY]] = extent();
    const width = maxX - minX;
    const height = maxY - minY;
    const transform = zoomTransform(svg);
    if (points.every(([x, y]) => transform.applyX(x) >= minX + width * .08 && transform.applyX(x) <= maxX - width * .08
      && transform.applyY(y) >= minY + height * .08 && transform.applyY(y) <= maxY - height * .08)) return;
    const left = Math.min(...points.map(([x]) => x));
    const right = Math.max(...points.map(([x]) => x));
    const top = Math.min(...points.map(([, y]) => y));
    const bottom = Math.max(...points.map(([, y]) => y));
    const scale = Math.min(transform.k, width * .84 / (right - left), height * .84 / (bottom - top));
    const fit = zoomIdentity.translate((minX + maxX - (left + right) * scale) / 2,
      (minY + maxY - (top + bottom) * scale) / 2).scale(scale);
    selection.call(behavior.transform, behavior.constrain()(fit, extent(), model.world));
  }

  function reveal(answer: Coordinate, attempt?: CapitalAttempt) {
    selecting = false;
    svg.removeAttribute('data-selecting');
    svg.removeAttribute('tabindex');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
    svg.removeAttribute('data-cursor');
    const solution = model.project(answer);
    svg.setAttribute('data-solution', '');
    if (!feedback) {
      placePin(answerPin, solution);
      return;
    }
    const chosen = attempt ? model.project(attempt.guess) : undefined;
    if (chosen) {
      endpoints(line, chosen, solution);
      svg.setAttribute('data-guess', '');
    }
    showMarkers(chosen ? [solution, chosen] : [solution]);
    feedback.reveal(options.capitalName ?? label, solution, chosen, attempt);
  }

  if (options.answer) reveal(options.answer);
  if (options.onPick) {
    const pick = options.onPick;
    selection.call(behavior).on('dblclick.zoom', null);
    svg.setAttribute('data-explorable', '');
    svg.setAttribute('data-selecting', '');
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('aria-label', `${label}. Ziehen verschiebt die Karte. Mausrad und zwei Finger zoomen. Pfeiltasten bewegen den Zeiger. Enter markiert den Punkt.`);
    let touchStart: Touch | undefined;
    let dragged = false;
    const touchCapture = { passive: true, capture: true };
    svg.addEventListener('touchstart', (event) => {
      if (event.touches.length > 1) dragged = true;
      else {
        touchStart = event.touches[0];
        dragged = false;
      }
    }, touchCapture);
    svg.addEventListener('touchmove', (event) => {
      const touch = event.touches[0];
      if (touchStart && Math.hypot(touch.clientX - touchStart.clientX, touch.clientY - touchStart.clientY) > dragThreshold) {
        dragged = true;
      }
    }, touchCapture);
    svg.addEventListener('touchcancel', () => { dragged = true; }, touchCapture);
    svg.addEventListener('pointerdown', (event) => { if (event.pointerType === 'mouse') dragged = false; });
    svg.addEventListener('click', (event) => {
      if (dragged) return;
      if (!selecting) {
        options.onResolvedClick?.();
        return;
      }
      const matrix = scene.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const coordinate = model.invert([point.x, point.y]);
      if (coordinate.every(Number.isFinite) && Math.abs(coordinate[1]) <= 90) pick(coordinate);
    });
    svg.addEventListener('keydown', (event) => {
      if (!selecting || event.altKey || event.ctrlKey || event.metaKey) return;
      const steps: Record<string, Coordinate> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const step = steps[event.key];
      if (!step && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (step) {
        const [[left, top], [right, bottom]] = extent();
        const speed = Math.max(right - left, bottom - top) / (event.shiftKey ? 16 : 70);
        cursor = [
          Math.min(right, Math.max(left, cursor[0] + step[0] * speed)),
          Math.min(bottom, Math.max(top, cursor[1] + step[1] * speed)),
        ];
        placePin(cursorPin, cursor);
        svg.setAttribute('data-cursor', '');
      } else {
        pick(model.invert(zoomTransform(svg).invert(cursor)));
      }
    });
  }
  return { svg, frame, reveal, dispose: () => feedback?.dispose() };
}
