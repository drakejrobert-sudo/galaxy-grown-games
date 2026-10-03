import type { LifeSupportRoute, SpaceLifeInput, SpaceBattleBomberInput } from './rules';

export interface InputFrame<T> { first: T; continued: T }

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
    readFrame() {
      const held = pointer !== null;
      const first = this.read();
      return { first, continued: { ...first, firing: held } };
    },
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

export function createSpaceLifeInput(buttons: Record<'left' | 'right' | 'jump', HTMLElement>) {
  const keys = new Set<string>();
  const pointers = new Map<number, keyof typeof buttons>();
  let jumpQueued = false, enabled = false;
  const clear = () => { keys.clear(); pointers.clear(); jumpQueued = false; };
  const controls = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'ArrowUp', 'KeyW', 'Space']);
  window.addEventListener('keydown', e => {
    if (!enabled || !controls.has(e.code)) return;
    e.preventDefault();
    if (!keys.has(e.code)) {
      if (['ArrowUp', 'KeyW', 'Space'].includes(e.code)) jumpQueued = true;
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', clear);
  for (const [action, button] of Object.entries(buttons) as [keyof typeof buttons, HTMLElement][]) {
    button.addEventListener('pointerdown', e => {
      if (!enabled) return;
      e.preventDefault(); pointers.set(e.pointerId, action); button.setPointerCapture?.(e.pointerId);
      if (action === 'jump') jumpQueued = true;
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, ((e: PointerEvent) => {
      if (pointers.get(e.pointerId) === action) pointers.delete(e.pointerId);
    }) as EventListener);
  }
  return {
    enable(value: boolean) { enabled = value; clear(); },
    readFrame(): InputFrame<SpaceLifeInput> {
      const first = this.read();
      return { first, continued: { ...first, jump: false } };
    },
    read(): SpaceLifeInput {
      const held = (action: keyof typeof buttons) => [...pointers.values()].includes(action);
      const x = Number(held('right') || keys.has('ArrowRight') || keys.has('KeyD'))
        - Number(held('left') || keys.has('ArrowLeft') || keys.has('KeyA'));
      const input = { x, jump: jumpQueued };
      jumpQueued = false;
      return input;
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
    readFrame() {
      const held = pointer !== null || keys.size > 0;
      const first = this.read();
      return { first, continued: { ...first, placing: held } };
    },
    read() {
      const placing = queuedMine || pointer !== null || keys.size > 0;
      queuedMine = false;
      return { x: 0, y: 0, placing };
    },
  };
}

/** Mine-only pursuit: every press is a single attempt, never held or banked. */
export function createSpaceBomberInput(surface: HTMLElement, action: HTMLElement) {
  const keys = new Set<string>();
  const held = new Set<number>();
  const queued = new Set<number>();
  let keyboardQueued = false, straightQueued = false, enabled = false;
  let gesture: number | null = null;
  let aim: { x: number; y: number } | undefined;
  let launch: typeof aim;
  const clear = () => { keys.clear(); held.clear(); queued.clear(); keyboardQueued = false; straightQueued = false; gesture = null; aim = undefined; launch = undefined; };
  const point = (e: PointerEvent) => {
    const box = surface.querySelector('canvas')?.getBoundingClientRect();
    return box && box.width && box.height ? { x: (e.clientX - box.left) / box.width * 480, y: (e.clientY - box.top) / box.height * 560 } : undefined;
  };
  surface.addEventListener('pointerdown', e => {
    if (!enabled || gesture !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); gesture = e.pointerId; aim = point(e); surface.setPointerCapture?.(gesture);
  });
  surface.addEventListener('pointermove', e => {
    if (enabled && (e.pointerId === gesture || e.pointerType === 'mouse' && gesture === null)) { aim = point(e); }
  });
  surface.addEventListener('pointerup', e => {
    if (!enabled || e.pointerId !== gesture || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); launch = point(e); aim = launch; gesture = null;
  });
  for (const event of ['pointercancel', 'lostpointercapture']) surface.addEventListener(event, ((e: PointerEvent) => {
    if (e.pointerId === gesture) { gesture = null; aim = undefined; launch = undefined; }
  }) as EventListener);
  window.addEventListener('keydown', e => {
    if (!enabled || !['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyA', 'KeyD', 'KeyS'].includes(e.code)) return;
    e.preventDefault();
    if (!['Space', 'Enter'].includes(e.code)) aim = undefined;
    if (['ArrowDown', 'KeyS'].includes(e.code)) straightQueued = true;
    if (['Space', 'Enter'].includes(e.code) && !e.repeat && !keys.has(e.code)) keyboardQueued = true;
    keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', clear);
  action.addEventListener('pointerdown', e => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0) || held.has(e.pointerId)) return;
    e.preventDefault(); held.add(e.pointerId); queued.add(e.pointerId);
    action.setPointerCapture?.(e.pointerId);
  });
  action.addEventListener('pointerup', e => { held.delete(e.pointerId); });
  action.addEventListener('pointercancel', e => { held.delete(e.pointerId); queued.delete(e.pointerId); });
  action.addEventListener('lostpointercapture', e => {
    if (held.delete(e.pointerId)) queued.delete(e.pointerId);
  });
  return {
    enable(value: boolean) { enabled = value; clear(); },
    readFrame(): InputFrame<SpaceBattleBomberInput> {
      const straightHeld = keys.has('ArrowDown') || keys.has('KeyS');
      const first = this.read();
      // World coordinates and release/press attempts belong only to the displayed frame.
      const continued: SpaceBattleBomberInput = { placing: false };
      if (first.turn) continued.turn = first.turn;
      if (straightHeld) continued.straight = true;
      return { first, continued };
    },
    read() {
      const input: SpaceBattleBomberInput = { placing: keyboardQueued || queued.size > 0 || launch !== undefined };
      if (aim) input.aim = aim;
      if (launch) input.launch = launch;
      const turn = Number(keys.has('ArrowLeft') || keys.has('KeyA')) - Number(keys.has('ArrowRight') || keys.has('KeyD'));
      if (turn) input.turn = turn;
      if (straightQueued || keys.has('ArrowDown') || keys.has('KeyS')) input.straight = true;
      keyboardQueued = false; straightQueued = false; queued.clear(); launch = undefined;
      // Once a gesture ends (or hover stops moving), retain its direction/range in simulation.
      // Replaying the world point would silently change range as the automatic ship weaves.
      if (gesture === null) aim = undefined;
      return input;
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

/** Space Battle touch aims only; firing sources have independent held/queued ownership. */
export function createSpaceGunnerInput(surface: HTMLElement, fireAction: HTMLElement) {
  let enabled = false;
  let aimPointer: number | null = null;
  let aim: { x: number; y: number } | null = null;
  const keys = new Set<string>();
  const held = new Set<number>();
  const queued = new Set<number>();
  let keyboardQueued = false;
  const movement = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  const firing = ['Space', 'Enter'];
  const clear = () => {
    aimPointer = null; aim = null; keys.clear(); held.clear(); queued.clear(); keyboardQueued = false;
  };
  const setAim = (e: PointerEvent) => {
    const box = surface.querySelector('canvas')?.getBoundingClientRect();
    if (box && box.width && box.height) aim = {
      x: (e.clientX - box.left) / box.width * 480,
      y: (e.clientY - box.top) / box.height * 560,
    };
  };
  surface.addEventListener('pointerdown', e => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0) || aimPointer !== null) return;
    e.preventDefault(); aimPointer = e.pointerId;
    surface.setPointerCapture?.(e.pointerId); setAim(e);
    if (e.pointerType === 'mouse') { held.add(e.pointerId); queued.add(e.pointerId); }
  });
  surface.addEventListener('pointermove', e => {
    if (!enabled || (e.pointerType !== 'mouse' && e.pointerId !== aimPointer)) return;
    e.preventDefault(); setAim(e);
  });
  fireAction.addEventListener('pointerdown', e => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault(); held.add(e.pointerId); queued.add(e.pointerId);
    fireAction.setPointerCapture?.(e.pointerId);
  });
  for (const element of [surface, fireAction]) {
    element.addEventListener('pointerup', e => {
      if (e.pointerId === aimPointer) aimPointer = null;
      held.delete(e.pointerId); // Keep an ordinary quick tap until the next read.
    });
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === aimPointer) aimPointer = null;
      // A capture-loss event after normal release must not erase the released tap.
      if (held.delete(e.pointerId)) queued.delete(e.pointerId);
    };
    element.addEventListener('lostpointercapture', cancel);
    element.addEventListener('pointercancel', e => {
      cancel(e); queued.delete(e.pointerId);
    });
  }
  window.addEventListener('keydown', e => {
    if (!enabled || ![...movement, ...firing].includes(e.code)) return;
    e.preventDefault();
    if (movement.includes(e.code) && !keys.has(e.code)) aim = null;
    if (firing.includes(e.code) && !keys.has(e.code)) keyboardQueued = true;
    keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', clear);
  return {
    enable(value: boolean) { enabled = value; clear(); },
    readFrame() {
      const heldFiring = held.size > 0 || firing.some(key => keys.has(key));
      const first = this.read();
      return { first, continued: { ...first, firing: heldFiring } };
    },
    read() {
      const result = {
        x: Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA')),
        y: Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW')),
        aimX: aim?.x, aimY: aim?.y,
        firing: keyboardQueued || queued.size > 0 || held.size > 0 || firing.some(key => keys.has(key)),
      };
      keyboardQueued = false; queued.clear();
      return result;
    },
  };
}
