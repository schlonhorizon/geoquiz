import type { Coordinate } from '../data/map';
import type { CountryMap } from '../map/country-map';

const svgNamespace = 'http://www.w3.org/2000/svg';

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
  options: { onPick?: (point: Coordinate) => void; answer?: Coordinate; nearby?: boolean } = {},
) {
  const svg = element('svg', 'country-map');
  const [left, top, width, height] = model.view;
  svg.setAttribute('viewBox', model.view.join(' '));
  svg.setAttribute('aria-label', label);
  svg.setAttribute('role', options.onPick ? 'application' : 'img');
  if (options.nearby) {
    for (const outline of model.context) {
      const background = element('path', 'local-neighbor');
      background.setAttribute('d', outline);
      svg.append(background);
    }
  }
  const land = element('path', 'local-outline');
  land.setAttribute('d', model.outline);
  land.setAttribute('pathLength', '1');
  const line = element('line', 'capital-line');
  const guessPin = pin('capital-guess');
  const answerPin = pin('capital-answer');
  const cursorPin = pin('capital-cursor');
  svg.append(land, line, guessPin, answerPin, cursorPin);
  let cursor: Coordinate = [left + width / 2, top + height / 2];
  let selecting = Boolean(options.onPick);

  function reveal(answer: Coordinate, guess?: Coordinate) {
    selecting = false;
    svg.removeAttribute('data-selecting');
    svg.removeAttribute('tabindex');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
    svg.removeAttribute('data-cursor');
    const solution = model.project(answer);
    placePin(answerPin, solution);
    svg.setAttribute('data-solution', '');
    if (guess) {
      const chosen = model.project(guess);
      placePin(guessPin, chosen);
      endpoints(line, chosen, solution);
      svg.setAttribute('data-guess', '');
    }
  }

  if (options.answer) reveal(options.answer);
  if (options.onPick) {
    const pick = options.onPick;
    svg.setAttribute('data-selecting', '');
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('aria-label', `${label}. Pfeiltasten bewegen den Zeiger. Enter markiert den Punkt.`);
    svg.addEventListener('click', (event) => {
      if (!selecting) return;
      const matrix = svg.getScreenCTM();
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
        const speed = Math.max(width, height) / (event.shiftKey ? 16 : 70);
        cursor = [
          Math.min(left + width, Math.max(left, cursor[0] + step[0] * speed)),
          Math.min(top + height, Math.max(top, cursor[1] + step[1] * speed)),
        ];
        placePin(cursorPin, cursor);
        svg.setAttribute('data-cursor', '');
      } else {
        pick(model.invert(cursor));
      }
    });
  }
  return { svg, reveal };
}
