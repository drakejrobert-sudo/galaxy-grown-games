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
  const narrow = css.slice(css.indexOf('@media (max-width: 480px) {'));
  assert.match(narrow, /grid-template-columns:\s*minmax\(0, 480px\);/);
  assert.match(narrow, /position:\s*static/);
  assert.ok(css.indexOf('@media (max-width: 480px) {') > css.indexOf('(any-pointer: coarse)'));
  assert.doesNotMatch(css, /position:\s*fixed/);
});
