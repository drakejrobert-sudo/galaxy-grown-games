import assert from 'node:assert/strict';
import test from 'node:test';
import { connectLever, fullPull } from '../src/slots/lever';

function lever() {
  const control = new EventTarget();
  const attributes = new Map<string, string>();
  const style = new Map<string, string>();
  const button = Object.assign(control, {
    getAttribute: (name: string) => attributes.get(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
    setPointerCapture() {},
    style: {
      setProperty: (name: string, value: string) => style.set(name, value),
      removeProperty: (name: string) => style.delete(name),
    },
  });
  let spins = 0;
  connectLever(button as unknown as HTMLButtonElement, () => spins++);
  const send = (type: string, other = {}) => control.dispatchEvent(Object.assign(
    new Event(type, { cancelable: true }), other,
  ));
  const pointer = (type: string, y = 0, other = {}) => send(type, {
    isPrimary: true, pointerId: 1, button: 0, clientX: 0, clientY: y, ...other,
  });
  return { pointer, send, button, style, spins: () => spins };
}

test('lever accepts a tap or full downward pull and ignores the following pointer click', () => {
  const { pointer, send, style, spins } = lever();
  pointer('pointerdown');
  pointer('pointermove', fullPull);
  assert.equal(style.get('--pull'), '1');
  pointer('pointerup', fullPull);
  assert.equal(style.has('--pull'), false);
  send('click', { detail: 1 });
  assert.equal(spins(), 1);
  pointer('pointerdown');
  pointer('pointerup');
  send('click', { detail: 1 });
  assert.equal(spins(), 2);
});

test('short pulls, swipes, lost capture, cancellation and disabled pulls leave the lever idle', () => {
  const { pointer, send, button, style, spins } = lever();
  for (const ending of ['pointercancel', 'lostpointercapture']) {
    pointer('pointerdown');
    pointer('pointermove', fullPull);
    pointer(ending);
    pointer('pointerup', fullPull);
    assert.equal(style.has('--pull'), false);
  }
  pointer('pointerdown');
  pointer('pointerup', fullPull - 1);
  pointer('pointerdown');
  pointer('pointermove', 0, { clientX: 20 });
  pointer('pointerup');
  button.setAttribute('aria-disabled', 'true');
  pointer('pointerdown');
  pointer('pointerup', fullPull);
  send('click', { detail: 1 });
  assert.equal(spins(), 0);
});

test('keyboard and assistive activation work without replaying held keys', () => {
  const { send, spins } = lever();
  assert.equal(send('keydown', { key: 'Enter', repeat: true }), false);
  assert.equal(send('keydown', { key: ' ', repeat: true }), false);
  assert.equal(send('keydown', { key: 'Enter', repeat: false }), true);
  send('click', { detail: 0 });
  assert.equal(spins(), 1);
});
