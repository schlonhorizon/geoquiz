import { mobileLayout } from './mobile-viewport';

const grabThreshold = 10;
const snapThreshold = 64;

export function createProfileSheet(sheet: HTMLElement) {
  const mobile = window.matchMedia(mobileLayout);
  const grip = document.createElement('button');
  grip.type = 'button';
  grip.className = 'profile-grip';
  const content = document.createElement('div');
  content.className = 'profile-content';
  sheet.append(grip, content);
  let close: () => void;
  let drag: { y: number; height: number } | undefined;
  let swipe: { x: number; y: number } | undefined;
  let handledDrag = false;

  function setExpanded(expanded: boolean) {
    sheet.toggleAttribute('data-expanded', expanded);
    grip.setAttribute('aria-expanded', String(expanded));
    grip.setAttribute('aria-label', expanded ? 'Steckbrief verkleinern' : 'Steckbrief vergrößern');
  }

  function start(y: number) {
    drag = { y, height: sheet.getBoundingClientRect().height };
    sheet.setAttribute('data-dragging', '');
  }

  function move(y: number) {
    if (!drag) return;
    sheet.style.setProperty('--profile-drag-height', `${Math.max(0, drag.height + drag.y - y)}px`);
  }

  function finish(y?: number) {
    if (!drag) return;
    const delta = y === undefined ? 0 : y - drag.y;
    drag = undefined;
    sheet.removeAttribute('data-dragging');
    sheet.style.removeProperty('--profile-drag-height');
    if (Math.abs(delta) < snapThreshold) return;
    if (delta < 0) setExpanded(true);
    else if (sheet.hasAttribute('data-expanded') && delta < snapThreshold * 2) setExpanded(false);
    else close();
  }

  grip.addEventListener('pointerdown', (event) => {
    if (!mobile.matches || !event.isPrimary || event.button !== 0) return;
    handledDrag = false;
    grip.setPointerCapture(event.pointerId);
    start(event.clientY);
  });
  grip.addEventListener('pointermove', (event) => {
    if (!drag) return;
    handledDrag ||= Math.abs(drag.y - event.clientY) >= grabThreshold;
    move(event.clientY);
  });
  grip.addEventListener('pointerup', (event) => finish(event.clientY));
  grip.addEventListener('pointercancel', () => finish());
  grip.addEventListener('click', (event) => {
    if (!handledDrag || event.detail === 0) setExpanded(!sheet.hasAttribute('data-expanded'));
    handledDrag = false;
  });

  content.addEventListener('touchstart', (event) => {
    const finger = event.touches[0];
    swipe = content.scrollTop <= 0 && event.touches.length === 1
      ? { x: finger.clientX, y: finger.clientY } : undefined;
  }, { passive: true });
  content.addEventListener('touchmove', (event) => {
    if (!mobile.matches || !swipe || event.touches.length !== 1) return;
    const finger = event.touches[0];
    if (!drag && (finger.clientY - swipe.y < grabThreshold || finger.clientY - swipe.y <= Math.abs(finger.clientX - swipe.x))) {
      if (finger.clientY < swipe.y - grabThreshold) swipe = undefined;
      return;
    }
    if (!event.cancelable) return;
    event.preventDefault();
    if (!drag) start(swipe.y);
    move(finger.clientY);
  }, { passive: false });
  content.addEventListener('touchend', (event) => {
    if (mobile.matches && swipe) finish(event.changedTouches[0]?.clientY);
    else if (swipe && event.changedTouches[0]?.clientY - swipe.y > snapThreshold) close();
    swipe = undefined;
  });
  content.addEventListener('touchcancel', () => { swipe = undefined; finish(); });

  return {
    content,
    prepareContent(onClose: () => void, reset: boolean) {
      close = onClose;
      if (!reset) content.scrollTop = 0;
      if (reset) setExpanded(false);
    },
  };
}
