import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCORE_ANCHORS, type ScoreMode } from '../src/game/rules.ts';

// Historical synthetic references remain fixed when owner playtests adjust live anchors.
const simulatedAnchorsV02: Record<ScoreMode, { low: number; high: number }> = {
  'asteroid-pilot': { low: 66, high: 700 },
  'asteroid-gunner': { low: 25, high: 7200 },
  'asteroid-bomber': { low: 71, high: 3060 },
  'asteroid-life-support': { low: 150, high: 7800 },
  'space-pilot': { low: 63, high: 332 },
  'space-bomber': { low: 64, high: 5800 },
};

test('seeded calibration reproduces the historical v0.2 reference anchors', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/calibrate-scores.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8',
  });
  const rows = output.trim().split('\n');
  assert.equal(rows.length, 6);
  for (const row of rows) {
    const [mode, count, , low, , high] = row.split('\t');
    assert.equal(Number(count), 288, mode);
    assert.deepEqual(simulatedAnchorsV02[mode as ScoreMode], { low: Number(low), high: Number(high) });
    if (mode !== 'space-pilot' && mode !== 'space-bomber') {
      assert.deepEqual(SCORE_ANCHORS[mode as ScoreMode], simulatedAnchorsV02[mode as ScoreMode]);
    }
  }
});
