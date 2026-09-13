import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('mobile bomber mine control stays fixed in the lower thumb zone', () => {
  const css = readFileSync(new URL('../src/bomber.css', import.meta.url), 'utf8');
  const mobileRules = css.slice(css.indexOf('@media (max-width: 700px)'), css.indexOf('.route-controls'));

  assert.match(mobileRules, /\.action:not\(\[hidden\]\)/);
  assert.match(mobileRules, /position:\s*fixed/);
  assert.match(mobileRules, /bottom:\s*max\(/);
  assert.match(mobileRules, /min-height:\s*92px/);
});
