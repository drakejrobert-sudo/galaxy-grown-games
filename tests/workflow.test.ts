import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Pages deploy retries cannot upload a duplicate artifact', () => {
  const workflow = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const buildJob = workflow.indexOf('\n  build:');
  const deployJob = workflow.indexOf('\n  deploy:');

  assert.ok(buildJob >= 0, 'Pages workflow must have a build job');
  assert.ok(deployJob > buildJob, 'deploy must be a separate job after build');
  assert.match(workflow.slice(deployJob), /\n    needs: build\n/);
  assert.equal(workflow.match(/actions\/upload-pages-artifact@/g)?.length, 1);
  assert.ok(workflow.indexOf('actions/upload-pages-artifact@') < deployJob,
    'only the successful build job should upload the Pages artifact');
  assert.ok(workflow.indexOf('actions/deploy-pages@') > deployJob,
    'the deploy action should run only in the dependent deploy job');
});
