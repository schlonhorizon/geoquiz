import type { ZoomTransform } from 'd3-zoom';

export const MAP_IDLE_DELAY_MS = 150;

export function createMapMotion(
  svg: SVGSVGElement,
  paint: (transform: ZoomTransform) => void,
  settle: (transform: ZoomTransform) => void,
) {
  let pending: ZoomTransform | undefined;
  let frame = 0;
  let timer = 0;
  let moving = false;

  function flush() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (pending) paint(pending);
    pending = undefined;
  }

  return {
    get moving() { return moving; },
    start() {
      window.clearTimeout(timer);
      if (moving) return;
      moving = true;
      svg.setAttribute('data-map-moving', '');
    },
    draw(transform: ZoomTransform) {
      pending = transform;
      if (!frame) frame = requestAnimationFrame(flush);
    },
    end(transform: ZoomTransform) {
      flush();
      window.clearTimeout(timer);
      const finish = () => {
        moving = false;
        svg.removeAttribute('data-map-moving');
        settle(transform);
      };
      if (moving) timer = window.setTimeout(finish, MAP_IDLE_DELAY_MS);
      else finish();
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    },
  };
}
