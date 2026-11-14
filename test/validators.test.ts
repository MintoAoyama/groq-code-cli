import test from 'ava';
import * as path from 'path';
import { setReadFilesTracker, validateReadBeforeEdit, getReadBeforeEditError } from '../src/tools/validators.js';

test.serial('validateReadBeforeEdit allows only files recorded as read', t => {
  const readFiles = new Set([path.resolve('src/index.ts')]);
  setReadFilesTracker(readFiles);
  t.true(validateReadBeforeEdit('src/index.ts'));
  t.true(validateReadBeforeEdit(path.resolve('src/index.ts')));
  t.false(validateReadBeforeEdit('src/other.ts'));
});

test.serial('validateReadBeforeEdit sees files read after the tracker was set', t => {
  const readFiles = new Set<string>();
  setReadFilesTracker(readFiles);
  t.false(validateReadBeforeEdit('README.md'));
  readFiles.add(path.resolve('README.md'));
  t.true(validateReadBeforeEdit('README.md'));
});

test('getReadBeforeEditError names the file', t => {
  t.true(getReadBeforeEditError('src/a.ts').includes('src/a.ts'));
});
