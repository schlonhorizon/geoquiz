import BezierEasing from 'bezier-easing';
import type { Coordinate } from '../data/map';

const travelDelay = 300;
const travelDuration = 600;
const travelEase = BezierEasing(.65, 0, .35, 1);
const labelGap = 14;
const edgeGap = 4;
const distanceFormat = new Intl.NumberFormat('de', { maximumFractionDigits: 0 });

export interface CapitalAttempt {
  guess: Coordinate;
  correct: boolean;
  distanceKm: number;
}

export function formatCapitalDistance(distanceKm: number) {
  return `${distanceFormat.format(distanceKm)} km`;
}

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function anchor(node: HTMLElement, [x, y]: Coordinate) {
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}

function placeLabel(node: HTMLElement, [x, y]: Coordinate, area: Box, obstacles: Box[], centered = false) {
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const middle = [x - width / 2, y - height / 2];
  const right = [x + labelGap, middle[1]];
  const left = [x - labelGap - width, middle[1]];
  const above = [middle[0], y - labelGap - height];
  const below = [middle[0], y + labelGap];
  const options = centered ? [middle, above, below, right, left] : [right, left, above, below];
  const visible = width <= area.width && height <= area.height
    && x >= area.x - edgeGap && x <= area.x + area.width + edgeGap
    && y >= area.y - edgeGap && y <= area.y + area.height + edgeGap;
  node.style.visibility = visible ? '' : 'hidden';
  if (!visible) return;

  const boxes = options.map(([left, top]) => ({
    x: Math.max(area.x, Math.min(left, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(top, area.y + area.height - height)),
    width, height,
  }));
  const best = boxes.find((box) => obstacles.every((obstacle) => !overlaps(box, obstacle))) ?? boxes[0];
  anchor(node, [best.x, best.y]);
  return best;
}

function centerBox([x, y]: Coordinate): Box {
  return { x: x - 7, y: y - 7, width: 14, height: 14 };
}

export function createCapitalFeedback(frame: HTMLElement, scene: SVGGElement) {
  const layer = document.createElement('div');
  layer.className = 'capital-feedback';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `
    <span class="capital-guess">
      <span class="capital-ring"></span><span class="capital-ring"></span><span class="capital-square"></span>
    </span>
    <span class="capital-feedback-answer"></span>
    <span class="capital-label capital-name"></span>
    <span class="capital-label capital-distance"></span>`;
  const guess = layer.querySelector<HTMLElement>('.capital-guess')!;
  const answer = layer.querySelector<HTMLElement>('.capital-feedback-answer')!;
  const name = layer.querySelector<HTMLElement>('.capital-name')!;
  const distance = layer.querySelector<HTMLElement>('.capital-distance')!;
  frame.style.setProperty('--capital-travel-delay', `${travelDelay}ms`);
  frame.style.setProperty('--capital-travel-duration', `${travelDuration}ms`);
  frame.append(layer);

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sizes = new ResizeObserver(() => layout());
  let data: { title: string; solution: Coordinate; chosen?: Coordinate; started: number } | undefined;
  let animation = 0;

  function layout(now = performance.now()) {
    if (!data || !frame.isConnected) return;
    const matrix = scene.getScreenCTM();
    if (!matrix) return;
    const rect = frame.getBoundingClientRect();
    const { clientWidth, clientHeight } = frame;
    if (!clientWidth || !clientHeight || !rect.width || !rect.height) return;
    const sx = clientWidth / rect.width;
    const sy = clientHeight / rect.height;
    const toPixels = ([x, y]: Coordinate): Coordinate => {
      const point = new DOMPoint(x, y).matrixTransform(matrix);
      return [(point.x - rect.left) * sx, (point.y - rect.top) * sy];
    };
    const insetX = Math.max(0, -rect.left) * sx + edgeGap;
    const insetY = Math.max(0, -rect.top) * sy + edgeGap;
    const bounds: Box = {
      x: insetX, y: insetY,
      width: clientWidth - insetX - Math.max(0, rect.right - window.innerWidth) * sx - edgeGap,
      height: clientHeight - insetY - Math.max(0, rect.bottom - window.innerHeight) * sy - edgeGap,
    };
    const target = toPixels(data.solution);
    const from = data.chosen ? toPixels(data.chosen) : target;
    const time = (now - data.started - travelDelay) / travelDuration;
    const settled = !data.chosen || motion.matches || time >= 1;
    const progress = settled ? 1 : travelEase(Math.max(0, time));
    const point: Coordinate = [from[0] + (target[0] - from[0]) * progress, from[1] + (target[1] - from[1]) * progress];
    anchor(guess, from);
    anchor(answer, target);
    const caption = `${data.title}${settled ? '' : '?'}`;
    if (name.textContent !== caption) name.textContent = caption;
    const position = placeLabel(name, point, bounds, [centerBox(point)]);
    if (data.chosen) {
      const midpoint: Coordinate = [(from[0] + target[0]) / 2, (from[1] + target[1]) / 2];
      placeLabel(distance, midpoint, bounds, [centerBox(from), centerBox(target), ...(position ? [position] : [])], true);
    }
  }

  const onScroll = () => layout();

  function reveal(title: string, solution: Coordinate, chosen?: Coordinate, attempt?: CapitalAttempt) {
    const started = performance.now();
    distance.textContent = attempt ? formatCapitalDistance(attempt.distanceKm) : '';
    frame.toggleAttribute('data-capital-guess', Boolean(chosen));
    frame.toggleAttribute('data-capital-wrong', attempt?.correct === false);
    frame.setAttribute('data-capital-result', '');
    data = { title, solution, chosen, started };
    sizes.observe(frame);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    layout(started);
    if (!chosen || motion.matches) return;
    const tick = (now: number) => {
      layout(now);
      if (now - started < travelDelay + travelDuration && !motion.matches) animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  }

  function dispose() {
    cancelAnimationFrame(animation);
    sizes.disconnect();
    window.removeEventListener('scroll', onScroll, true);
  }

  return { reveal, layout, dispose };
}
