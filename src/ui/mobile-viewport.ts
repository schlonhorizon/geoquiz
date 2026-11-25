export const mobileLayout = '(max-width: 599px), (max-height: 500px) and (pointer: coarse)';

export function observeKeyboard(stage: HTMLElement, onChange: () => void) {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement;
  let frame = 0;
  function update() {
    const editing = document.activeElement?.matches('input[type="text"], input[type="search"]');
    const height = editing ? Math.round(viewport!.height) : 0;
    const top = editing ? Math.max(0, Math.round(viewport!.offsetTop)) : 0;
    const bottom = editing ? Math.max(0, Math.round(window.innerHeight - viewport!.height - viewport!.offsetTop)) : 0;
    if (height) root.style.setProperty('--viewport-height', `${height}px`);
    else root.style.removeProperty('--viewport-height');
    root.style.setProperty('--viewport-top', `${top}px`);
    root.style.setProperty('--viewport-bottom', `${bottom}px`);
    stage.toggleAttribute('data-keyboard', Boolean(editing && (bottom > 70 || height < 420)));
    stage.toggleAttribute('data-keyboard-compact', Boolean(editing && height < 330));
    onChange();
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }
  viewport.addEventListener('resize', schedule);
  viewport.addEventListener('scroll', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
}
