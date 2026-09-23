import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCORE_ANCHORS, type ScoreMode } from '../src/game/rules.ts';

test('seeded calibration reproduces every published anchor', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/calibrate-scores.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8',
  });
  const rows = output.trim().split('\n');
  assert.equal(rows.length, 6);
  for (const row of rows) {
    const [mode, count, , low, , high] = row.split('\t');
    assert.equal(Number(count), 288, mode);
    assert.deepEqual(SCORE_ANCHORS[mode as ScoreMode], { low: Number(low), high: Number(high) });
  }
});
