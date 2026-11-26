import type { ZoomTransform } from 'd3-zoom';
import type { Coordinate } from '../data/map';
import { worldWidth } from './viewport';

export const ATLAS_CAPITAL_MARKER_MIN_PX = 60;
export const ATLAS_CAPITAL_LABEL_MIN_PX = 140;
const markerSize = 6;
const labelDistance = 7;
const labelPadding = 3;
const labelHeight = 15;
const svgNamespace = 'http://www.w3.org/2000/svg';

type LabelBounds = { left: number; right: number; top: number; bottom: number };

function overlaps(a: LabelBounds, b: LabelBounds) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

interface Capital {
  id: string;
  name: string;
  point: Coordinate;
  diagonal: number;
}

export function renderAtlasCapitals(svg: SVGSVGElement, capitals: Capital[]) {
  const layer = document.createElementNS(svgNamespace, 'g');
  layer.setAttribute('class', 'atlas-capitals');
  layer.setAttribute('aria-hidden', 'true');
  svg.append(layer);
  const ordered = [...capitals].sort((a, b) => b.diagonal - a.diagonal || a.id.localeCompare(b.id));
  const measurement = document.createElement('canvas').getContext('2d')!;
  const fontFamily = getComputedStyle(svg).fontFamily;
  type View = ReturnType<typeof makeView>;
  const views = new Map<string, View>();
  const widths = new Map<string, number>();
  let transitionFrame = 0;

  function makeView(id: string, name: string) {
    const group = document.createElementNS(svgNamespace, 'g');
    group.setAttribute('class', 'map-capital');
    group.dataset.capitalCountry = id;
    const pin = document.createElementNS(svgNamespace, 'rect');
    pin.setAttribute('x', String(-markerSize / 2));
    pin.setAttribute('y', String(-markerSize / 2));
    pin.setAttribute('width', String(markerSize));
    pin.setAttribute('height', String(markerSize));
    const label = document.createElementNS(svgNamespace, 'text');
    label.textContent = name;
    label.setAttribute('y', '4');
    group.append(pin, label);
    layer.append(group);
    return { group, label, show: false, labelVisible: false, removal: 0 };
  }

  function draw(transform: ZoomTransform, { width, height }: { width: number; height: number }) {
    if (!layer.isConnected) svg.append(layer);
    const tileWidth = worldWidth * transform.k;
    const occupied: LabelBounds[] = [];
    for (const view of views.values()) view.show = view.labelVisible = false;
    for (const { id, name, point, diagonal } of ordered) {
      const size = diagonal * transform.k;
      if (size < ATLAS_CAPITAL_MARKER_MIN_PX) break;
      const y = transform.applyY(point[1]);
      if (y < 0 || y > height) continue;
      const origin = transform.applyX(point[0]);
      const first = Math.ceil((0 - origin) / tileWidth);
      const last = Math.floor((width - origin) / tileWidth);
      for (let copy = first; copy <= last; copy++) {
        const key = `${id}:${copy}`;
        let view = views.get(key);
        if (!view) {
          view = makeView(id, name);
          views.set(key, view);
        }
        const x = origin + copy * tileWidth;
        view.show = true;
        view.group.setAttribute('transform', `translate(${x},${y})`);
        if (size < ATLAS_CAPITAL_LABEL_MIN_PX) continue;
        let labelWidth = widths.get(id);
        if (labelWidth === undefined) {
          measurement.font = `600 11px ${fontFamily}`;
          labelWidth = Math.ceil(measurement.measureText(name).width);
          widths.set(id, labelWidth);
        }
        for (const side of [1, -1]) {
          const left = x + (side > 0 ? labelDistance : -labelDistance - labelWidth) - labelPadding;
          const bounds = { left, right: left + labelWidth + labelPadding * 2, top: y - labelHeight / 2, bottom: y + labelHeight / 2 };
          if (bounds.left < 0 || bounds.right > width || bounds.top < 0 || bounds.bottom > height
            || occupied.some((box) => overlaps(bounds, box))) continue;
          occupied.push(bounds);
          view.label.setAttribute('x', String(side * labelDistance));
          view.label.setAttribute('text-anchor', side > 0 ? 'start' : 'end');
          view.labelVisible = true;
          break;
        }
      }
    }

    cancelAnimationFrame(transitionFrame);
    transitionFrame = requestAnimationFrame(() => {
      for (const [key, view] of views) {
        view.group.toggleAttribute('data-visible', view.show);
        view.label.toggleAttribute('data-visible', view.labelVisible);
        if (!view.show && !view.removal) view.removal = window.setTimeout(() => {
          view.removal = 0;
          if (view.show || views.get(key) !== view) return;
          view.group.remove();
          views.delete(key);
        }, 150);
      }
    });
  }

  function clear() {
    cancelAnimationFrame(transitionFrame);
    for (const view of views.values()) window.clearTimeout(view.removal);
    layer.replaceChildren();
    views.clear();
  }

  void document.fonts?.ready.then(() => widths.clear());

  return { draw, clear, pause() { cancelAnimationFrame(transitionFrame); layer.remove(); } };
}
