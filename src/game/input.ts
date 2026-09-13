export function createInput(surface: HTMLElement) {
  const keys = new Set<string>();
  let touch: { x: number; y: number } | null = null;
  let pointer: number | null = null;
  const controls = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'];
  let enabled = false;
  const down = (e: KeyboardEvent) => { if (enabled && controls.includes(e.code)) { e.preventDefault(); keys.add(e.code); } };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const clear = () => { keys.clear(); touch = null; pointer = null; };
  const setTouch = (e: PointerEvent) => {
    const box = surface.querySelector('canvas')?.getBoundingClientRect();
    if (box) touch = { x: (e.clientX - box.left) / box.width * 480, y: (e.clientY - box.top) / box.height * 560 };
  };
  surface.addEventListener('pointerdown', e => {
    if (!enabled || pointer !== null) return;
    e.preventDefault(); pointer = e.pointerId; surface.setPointerCapture(pointer); setTouch(e);
  });
  surface.addEventListener('pointermove', e => { if (enabled && e.pointerId === pointer) { e.preventDefault(); setTouch(e); } });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(event, clear);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  return {
    enable(value: boolean) { enabled = value; clear(); },
    read(x: number, y: number) {
      if (touch) {
        // Touch sets a destination; it never teleports or bypasses engine impairment.
        const dx = touch.x - x, dy = touch.y - y;
        const distance = Math.hypot(dx, dy);
        return distance < 5 ? { x: 0, y: 0 } : { x: dx / distance, y: dy / distance };
      }
      return { x: Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')),
        y: Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW')) };
    },
  };
}

export function createGunnerInput(surface: HTMLElement) {
  const keys = new Set<string>();
  let pointer: number | null = null;
  let aim: { x: number; y: number } | null = null;
  let enabled = false;
  const movement = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'];
  const controls = [...movement, 'Space'];
  const down = (e: KeyboardEvent) => {
    if (enabled && controls.includes(e.code)) { e.preventDefault(); keys.add(e.code); }
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  const clear = () => { keys.clear(); pointer = null; aim = null; };
  const setAim = (e: PointerEvent) => {
    const box = surface.querySelector('canvas')?.getBoundingClientRect();
    if (box) aim = {
      x: (e.clientX - box.left) / box.width * 480,
      y: (e.clientY - box.top) / box.height * 560,
    };
  };
  surface.addEventListener('pointerdown', e => {
    if (!enabled || pointer !== null) return;
    e.preventDefault(); pointer = e.pointerId; surface.setPointerCapture(pointer); setAim(e);
  });
  surface.addEventListener('pointermove', e => {
    if (enabled && e.pointerId === pointer) { e.preventDefault(); setAim(e); }
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId === pointer) { pointer = null; aim = null; }
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(event, release as EventListener);
  }
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  return {
    enable(value: boolean) { enabled = value; clear(); },
    read() {
      return {
        x: Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')),
        y: Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW')),
        aimX: aim?.x,
        aimY: aim?.y,
        firing: keys.has('Space') || pointer !== null,
      };
    },
  };
}
