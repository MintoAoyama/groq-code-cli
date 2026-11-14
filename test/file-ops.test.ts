import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { displayTree, shouldIgnore } from '../src/utils/file-ops.js';

test('shouldIgnore matches ignored directory names', t => {
  t.true(shouldIgnore('/home/u/app/node_modules'));
  t.true(shouldIgnore('/home/u/app/dist'));
  t.true(shouldIgnore('/home/u/app/build'));
});

test('shouldIgnore does not match ignored names that only appear in ancestors', t => {
  t.false(shouldIgnore('/home/u/build-tools/src/index.ts'));
  t.false(shouldIgnore('/home/u/dist/app/src/index.ts'));
  t.false(shouldIgnore('/home/u/app/rebuild.ts'));
});

test('shouldIgnore matches glob patterns against the whole file name', t => {
  t.true(shouldIgnore('/home/u/app/debug.log'));
  t.true(shouldIgnore('/home/u/app/cache.pyc'));
  t.false(shouldIgnore('/home/u/app/src/catalog.ts'));
  t.false(shouldIgnore('/home/u/app/src/dialog.tsx'));
  t.false(shouldIgnore('/home/u/app/debug.log.ts'));
});

test('shouldIgnore skips hidden files except the allowed ones', t => {
  t.true(shouldIgnore('/home/u/app/.cache'));
  t.false(shouldIgnore('/home/u/app/.env'));
  t.false(shouldIgnore('/home/u/app/.gitignore'));
});

test('displayTree lists a project located under an ignored directory name', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-file-ops-'));
  const project = path.join(root, 'build', 'project');
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.mkdirSync(path.join(project, 'node_modules'));
  fs.writeFileSync(path.join(project, 'catalog.ts'), '');
  fs.writeFileSync(path.join(project, 'debug.log'), '');
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));

  t.is(await displayTree(project), ['project/', '├── src/', '└── catalog.ts'].join('\n'));
});
