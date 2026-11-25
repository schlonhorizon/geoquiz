import type { MapFrame } from './viewport';

const svgNamespace = 'http://www.w3.org/2000/svg';
const ringRadius = 9;
const edgeInset = 6;
const labelGap = 12;

export function createSolutionRadar(map: SVGSVGElement) {
  const layer = document.createElement('div');
  layer.className = 'solution-radar';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;

  const canvas = document.createElementNS(svgNamespace, 'svg');
  const marker = document.createElementNS(svgNamespace, 'g');
  const leader = document.createElementNS(svgNamespace, 'line');
  leader.classList.add('radar-leader');
  const rings = Array.from({ length: 4 }, (_, index) => {
    const ring = document.createElementNS(svgNamespace, 'circle');
    ring.setAttribute('r', String(ringRadius));
    ring.classList.add(index === 3 ? 'radar-ring' : 'radar-pulse');
    ring.style.setProperty('--radar-delay', `${index * 180}ms`);
    return ring;
  });
  marker.append(leader, ...rings);
  canvas.append(marker);

  const label = document.createElement('span');
  label.className = 'radar-label';
  layer.append(canvas, label);
  map.after(layer);

  let labelWidth = 0;
  let labelHeight = 0;
  let measuredAtWidth = 0;

  return {
    show(name: string) {
      if (!layer.hidden && label.textContent === name) return;
      label.textContent = name;
      layer.hidden = false;
      measuredAtWidth = 0;
    },
    clear() {
      layer.hidden = true;
    },
    place(x: number, y: number, width: number, height: number, frame: MapFrame) {
      if (layer.hidden) return;
      if (width !== measuredAtWidth) {
        measuredAtWidth = width;
        labelWidth = label.offsetWidth;
        labelHeight = label.offsetHeight;
      }
      const visible = x >= 0 && x <= width && y >= frame.top && y <= frame.bottom
        && frame.bottom - frame.top >= labelHeight + 2 * edgeInset;
      layer.style.visibility = visible ? '' : 'hidden';
      if (!visible) return;

      const right = x + ringRadius + labelGap;
      const left = x - ringRadius - labelGap - labelWidth;
      const labelX = Math.max(edgeInset, Math.min(width - labelWidth - edgeInset,
        right + labelWidth <= width - edgeInset ? right : left));
      const labelY = Math.max(frame.top + edgeInset, Math.min(frame.bottom - labelHeight - edgeInset, y - labelHeight / 2));
      label.style.transform = `translate(${labelX}px, ${labelY}px)`;
      marker.setAttribute('transform', `translate(${x}, ${y})`);
      layer.style.setProperty('--radar-radius', `${Math.max(x, width - x, y, height - y)}px`);

      const endX = labelX > x ? labelX - x : labelX + labelWidth - x;
      const endY = labelY + labelHeight / 2 - y;
      const length = Math.hypot(endX, endY);
      leader.setAttribute('x1', String(endX * ringRadius / length));
      leader.setAttribute('y1', String(endY * ringRadius / length));
      leader.setAttribute('x2', String(endX));
      leader.setAttribute('y2', String(endY));
    },
  };
}
