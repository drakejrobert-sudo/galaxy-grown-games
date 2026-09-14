import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('bomber mine control uses a reserved sticky rail across touch viewport widths', () => {
  const css = readFileSync(new URL('../src/bomber.css', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

  assert.ok(shell.includes('#play[data-role="Bomber"] .flight-stage{grid-template-columns:minmax(0,480px) 90px}'));
  assert.match(css, /\.action-rail\s*\{[^}]*align-items:\s*flex-end/s);
  assert.match(css, /\.action\s*\{[^}]*position:\s*sticky[^}]*bottom:\s*max\(/s);
  assert.match(css, /@media \(max-width: 480px\), \(any-pointer: coarse\)/);
  assert.doesNotMatch(shell + css, /:has\(/);
  const narrow = css.slice(css.indexOf('@media (max-width: 616px) {'));
  assert.match(narrow, /grid-template-columns:\s*minmax\(0, 480px\);/);
  assert.match(narrow, /position:\s*static/);
  assert.ok(css.indexOf('@media (max-width: 616px) {') > css.indexOf('(any-pointer: coarse)'));
  assert.doesNotMatch(css, /position:\s*fixed/);
});

test('bomber breakpoint budgets both columns without a canvas-width cliff', () => {
  const css = readFileSync(new URL('../src/bomber.css', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  const breakpoint = Number(css.match(/@media \(max-width: (\d+)px\) \{/)![1]);
  // Tie the sizing model to the shipped CSS; this is not a rendered browser test.
  assert.ok(shell.includes('grid-template-columns:minmax(0,480px) 90px'));
  assert.ok(shell.includes('gap:10px;max-width:580px'));
  assert.ok(shell.includes('main{padding:25px 18px}'));
  assert.match(css, /grid-template-columns: minmax\(0, 480px\) 76px/);
  assert.equal(breakpoint, 480 + 90 + 10 + 2 * 18);
  for (const rail of [76, 90]) {
    const canvasWidth = (viewport: number) => Math.min(480,
      viewport - 36 - (viewport > breakpoint ? rail + 10 : 0));
    for (const viewport of [320, 480, 481, 575, 600, 615, 616, 617, 618]) {
      assert.equal(canvasWidth(viewport), Math.min(480, viewport - 36),
        `full available canvas at ${viewport}px with ${rail}px rail`);
    }
    assert.equal(canvasWidth(breakpoint), canvasWidth(breakpoint + 1));
  }
});
