import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { matchesReason, parseHookMatchers, runCommandHook, runSessionEndHooks, type SessionEndInput } from '../src/utils/hooks.js';

function tempDir(t: { teardown: (fn: () => void) => void }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-hooks-'));
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function input(cwd: string, reason: SessionEndInput['reason']): SessionEndInput {
  return { session_id: 'abc', transcript_path: '/t/abc.jsonl', cwd, hook_event_name: 'SessionEnd', reason };
}

test('matchesReason matches every reason without a matcher or with *', t => {
  t.true(matchesReason(undefined, 'clear'));
  t.true(matchesReason('', 'other'));
  t.true(matchesReason('*', 'prompt_input_exit'));
});

test('matchesReason matches |-separated reasons exactly', t => {
  t.true(matchesReason('clear|prompt_input_exit', 'prompt_input_exit'));
  t.false(matchesReason('clear|prompt_input_exit', 'other'));
  t.false(matchesReason('clea', 'clear'));
});

test('parseHookMatchers keeps only well-formed command hooks', t => {
  t.deepEqual(parseHookMatchers(undefined), []);
  t.deepEqual(parseHookMatchers({ hooks: [] }), []);
  t.deepEqual(parseHookMatchers([
    { matcher: 'clear', hooks: [{ type: 'command', command: 'a' }, { type: 'command' }, { type: 'http', command: 'b' }] },
    { hooks: [{ type: 'command', command: 'c', timeout: 5 }, { type: 'command', command: 'd', timeout: 0 }] },
    { hooks: [{ type: 'command', command: 1 }] },
    'junk',
  ]), [
    { matcher: 'clear', hooks: [{ type: 'command', command: 'a' }] },
    { matcher: undefined, hooks: [{ type: 'command', command: 'c', timeout: 5 }] },
  ]);
});

test('runCommandHook passes the input as JSON on stdin in the given directory', async t => {
  const dir = tempDir(t);
  await runCommandHook('cat > received.json', input(dir, 'clear'), 5, dir);
  t.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'received.json'), 'utf-8')), input(dir, 'clear'));
});

test('runCommandHook kills a hook that runs past the timeout', async t => {
  const dir = tempDir(t);
  const started = Date.now();
  await runCommandHook('sleep 5', input(dir, 'other'), 0.2, dir);
  t.true(Date.now() - started < 2000);
});

test('runCommandHook resolves when the hook ignores stdin or fails', async t => {
  const dir = tempDir(t);
  await runCommandHook('exit 3', input(dir, 'other'), 5, dir);
  t.pass();
});

test('runSessionEndHooks runs only the hooks whose matcher fits the reason', async t => {
  const dir = tempDir(t);
  await runSessionEndHooks([
    { matcher: 'clear', hooks: [{ type: 'command', command: 'touch on-clear' }] },
    { matcher: 'prompt_input_exit', hooks: [{ type: 'command', command: 'touch on-exit' }] },
    { hooks: [{ type: 'command', command: 'touch always' }] },
  ], input(dir, 'prompt_input_exit'));
  t.false(fs.existsSync(path.join(dir, 'on-clear')));
  t.true(fs.existsSync(path.join(dir, 'on-exit')));
  t.true(fs.existsSync(path.join(dir, 'always')));
});
