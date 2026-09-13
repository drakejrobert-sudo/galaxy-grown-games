import type { LifeSupportRoute } from './rules';

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
  let pointer: number | null = null;
  let aim: { x: number; y: number } | null = null;
  let queuedShot = false;
  let enabled = false;
  const clear = () => { pointer = null; aim = null; queuedShot = false; };
  const setAim = (e: PointerEvent) => {
    const box = surface.querySelector('canvas')?.getBoundingClientRect();
    if (box) aim = {
      x: (e.clientX - box.left) / box.width * 480,
      y: (e.clientY - box.top) / box.height * 560,
    };
  };
  surface.addEventListener('pointerdown', e => {
    if (!enabled || pointer !== null) return;
    e.preventDefault(); pointer = e.pointerId; queuedShot = true;
    surface.setPointerCapture(pointer); setAim(e);
  });
  surface.addEventListener('pointermove', e => {
    if (enabled && (e.pointerType === 'mouse' || e.pointerId === pointer)) {
      e.preventDefault(); setAim(e);
    }
  });
  const release = (e: PointerEvent) => {
    if (e.pointerId === pointer) pointer = null;
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(event, release as EventListener);
  }
  window.addEventListener('blur', clear);
  return {
    enable(value: boolean) { enabled = value; clear(); },
    read() {
      const firing = queuedShot || pointer !== null;
      queuedShot = false;
      return {
        aimX: aim?.x,
        aimY: aim?.y,
        firing,
      };
    },
  };
}

export function createBomberInput(surface: HTMLElement, action: HTMLElement) {
  const keys = new Set<string>();
  let touch: { x: number; y: number } | null = null;
  let pointer: number | null = null;
  let actionPointer: number | null = null;
  let queuedMine = false;
  let enabled = false;
  const movement = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'];
  const mineKeys = ['Space', 'Enter'];
  const clear = () => {
    keys.clear(); touch = null; pointer = null; actionPointer = null; queuedMine = false;
  };
  const setTouch = (e: PointerEvent) => {
    const box = surface.querySelector('canvas')?.getBoundingClientRect();
    if (box) touch = {
      x: (e.clientX - box.left) / box.width * 480,
      y: (e.clientY - box.top) / box.height * 560,
    };
  };
  const down = (e: KeyboardEvent) => {
    if (!enabled || (!movement.includes(e.code) && !mineKeys.includes(e.code))) return;
    e.preventDefault();
    if (mineKeys.includes(e.code) && !keys.has(e.code)) queuedMine = true;
    keys.add(e.code);
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  surface.addEventListener('pointerdown', e => {
    if (!enabled || pointer !== null) return;
    e.preventDefault(); pointer = e.pointerId; surface.setPointerCapture(pointer); setTouch(e);
  });
  surface.addEventListener('pointermove', e => {
    if (enabled && e.pointerId === pointer) { e.preventDefault(); setTouch(e); }
  });
  const releaseSurface = (e: PointerEvent) => {
    if (e.pointerId === pointer) { pointer = null; touch = null; }
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(event, releaseSurface as EventListener);
  }
  action.addEventListener('pointerdown', e => {
    if (!enabled || actionPointer !== null) return;
    e.preventDefault(); actionPointer = e.pointerId; queuedMine = true;
    action.setPointerCapture?.(actionPointer);
  });
  const releaseAction = (e: PointerEvent) => {
    if (e.pointerId === actionPointer) actionPointer = null;
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    action.addEventListener(event, releaseAction as EventListener);
  }
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  return {
    enable(value: boolean) { enabled = value; clear(); },
    read(x: number, y: number) {
      let movementInput;
      if (touch) {
        const dx = touch.x - x, dy = touch.y - y;
        const distance = Math.hypot(dx, dy);
        movementInput = distance < 5 ? { x: 0, y: 0 } : { x: dx / distance, y: dy / distance };
      } else {
        movementInput = {
          x: Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')),
          y: Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW')),
        };
      }
      const placing = queuedMine || actionPointer !== null || mineKeys.some(key => keys.has(key));
      queuedMine = false;
      return { ...movementInput, placing };
    },
  };
}

export function createLifeSupportInput(routeButtons: readonly HTMLElement[]) {
  const routes: readonly LifeSupportRoute[] = ['Thrusters', 'Shields', 'Guns'];
  let selected = 1;
  let enabled = false;
  const choose = (index: number) => {
    if (!enabled) return;
    selected = Math.max(0, Math.min(routes.length - 1, index));
  };
  const down = (e: KeyboardEvent) => {
    if (!enabled) return;
    const direct = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : e.code === 'Digit3' ? 2 : null;
    if (direct !== null) {
      e.preventDefault(); choose(direct); return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault(); choose((selected + routes.length - 1) % routes.length);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault(); choose((selected + 1) % routes.length);
    }
  };
  routeButtons.forEach((button, index) => button.addEventListener('pointerdown', e => {
    if (!enabled) return;
    e.preventDefault(); choose(index);
  }));
  window.addEventListener('keydown', down);
  return {
    enable(value: boolean) { enabled = value; selected = 1; },
    read() { return { route: routes[selected] }; },
  };
}
