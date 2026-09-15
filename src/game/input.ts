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

/** Asteroid Bomber only times releases; flight and the aft drop point are automatic. */
export function createBomberInput(_surface: HTMLElement, action: HTMLElement) {
  const keys = new Set<string>();
  let pointer: number | null = null;
  let queuedMine = false;
  let enabled = false;
  const clear = () => { keys.clear(); pointer = null; queuedMine = false; };
  window.addEventListener('keydown', e => {
    if (!enabled || !['Space', 'Enter'].includes(e.code)) return;
    e.preventDefault();
    if (!keys.has(e.code)) queuedMine = true;
    keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', clear);
  action.addEventListener('pointerdown', e => {
    if (!enabled || pointer !== null) return;
    e.preventDefault(); pointer = e.pointerId; queuedMine = true;
    action.setPointerCapture?.(pointer);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    action.addEventListener(event, ((e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      if (event !== 'pointerup') queuedMine = false;
    }) as EventListener);
  }
  return {
    enable(value: boolean) { enabled = value; clear(); },
    read() {
      const placing = queuedMine || pointer !== null || keys.size > 0;
      queuedMine = false;
      return { x: 0, y: 0, placing };
    },
  };
}

export function createSpaceBomberInput(surface: HTMLElement, fireAction: HTMLElement, mineAction: HTMLElement) {
  const keys = new Set<string>();
  let touch: { x: number; y: number } | null = null;
  let movementPointer: number | null = null;
  let firePointer: number | null = null;
  let minePointer: number | null = null;
  let queuedFire = false;
  let queuedMine = false;
  let enabled = false;
  const movement = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD'];
  const fireKeys = ['Space'];
  const mineKeys = ['Enter', 'ShiftLeft', 'ShiftRight'];
  const clear = () => {
    keys.clear(); touch = null; movementPointer = null; firePointer = null; minePointer = null;
    queuedFire = false; queuedMine = false;
  };
  const setTouch = (e: PointerEvent) => {
    const box = surface.querySelector('canvas')?.getBoundingClientRect();
    if (box) touch = {
      x: (e.clientX - box.left) / box.width * 480,
      y: (e.clientY - box.top) / box.height * 560,
    };
  };
  const down = (e: KeyboardEvent) => {
    if (!enabled || (!movement.includes(e.code) && !fireKeys.includes(e.code) && !mineKeys.includes(e.code))) return;
    e.preventDefault();
    if (movement.includes(e.code)) touch = null;
    if (fireKeys.includes(e.code) && !keys.has(e.code)) queuedFire = true;
    if (mineKeys.includes(e.code) && !keys.has(e.code)) queuedMine = true;
    keys.add(e.code);
  };
  const up = (e: KeyboardEvent) => keys.delete(e.code);
  surface.addEventListener('pointerdown', e => {
    if (!enabled || movementPointer !== null) return;
    e.preventDefault(); movementPointer = e.pointerId; surface.setPointerCapture(movementPointer); setTouch(e);
  });
  surface.addEventListener('pointermove', e => {
    if (enabled && (e.pointerId === movementPointer || (e.pointerType === 'mouse' && movementPointer === null))) { e.preventDefault(); setTouch(e); }
  });
  const releaseMovement = (e: PointerEvent) => {
    if (e.pointerId === movementPointer) { movementPointer = null; }
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    surface.addEventListener(event, releaseMovement as EventListener);
  }
  const bindAction = (element: HTMLElement, kind: 'fire' | 'mine') => {
    element.addEventListener('pointerdown', e => {
      if (!enabled || (kind === 'fire' ? firePointer : minePointer) !== null) return;
      e.preventDefault();
      if (kind === 'fire') { firePointer = e.pointerId; queuedFire = true; }
      else { minePointer = e.pointerId; queuedMine = true; }
      element.setPointerCapture?.(e.pointerId);
    });
    const release = (e: PointerEvent) => {
      if (kind === 'fire' && e.pointerId === firePointer) firePointer = null;
      if (kind === 'mine' && e.pointerId === minePointer) minePointer = null;
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      element.addEventListener(event, release as EventListener);
    }
  };
  bindAction(fireAction, 'fire');
  bindAction(mineAction, 'mine');
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  return {
    enable(value: boolean) { enabled = value; clear(); },
    read() {
      const movementInput = {
        x: Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')),
        y: Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW')),
        aimX: touch?.x, aimY: touch?.y,
      };
      const firing = queuedFire || firePointer !== null || fireKeys.some(key => keys.has(key));
      const placing = queuedMine || minePointer !== null || mineKeys.some(key => keys.has(key));
      queuedFire = false; queuedMine = false;
      return { ...movementInput, firing, placing };
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
    if (e.repeat) return;
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
    enable(value: boolean) { enabled = value; },
    reset() { selected = 1; },
    read() { return { route: routes[selected] }; },
  };
}
