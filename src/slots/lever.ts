export const fullPull = 24;
const tapSlop = 8;

export function connectLever(button: HTMLButtonElement, spin: () => void): void {
  let pointer: { id: number; x: number; y: number; moved: boolean } | null = null;

  function reset() {
    pointer = null;
    button.style.removeProperty('--pull');
    button.removeAttribute('data-pulling');
  }

  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || pointer ||
        button.getAttribute('aria-disabled') === 'true') return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    button.setPointerCapture(event.pointerId);
    button.setAttribute('data-pulling', '');
  });

  button.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId) return;
    const dy = event.clientY - pointer.y;
    pointer.moved ||= Math.hypot(event.clientX - pointer.x, dy) > tapSlop;
    button.style.setProperty('--pull', String(Math.min(1, Math.max(0, dy / fullPull))));
  });

  button.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    const dy = event.clientY - pointer.y;
    const tap = !pointer.moved && Math.hypot(event.clientX - pointer.x, dy) <= tapSlop;
    reset();
    if (dy >= fullPull || tap) spin();
  });

  button.addEventListener('pointercancel', event => {
    if (pointer?.id === event.pointerId) reset();
  });
  button.addEventListener('lostpointercapture', event => {
    if (pointer?.id === event.pointerId) reset();
  });
  button.addEventListener('keydown', event => {
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
  });
  // Pointer activation is resolved on release. A keyboard or assistive click has no click count.
  button.addEventListener('click', event => {
    if (event.detail === 0) spin();
  });
}
