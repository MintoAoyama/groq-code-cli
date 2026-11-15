import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { cleanupTranscripts, projectDirName, TranscriptWriter } from '../src/utils/transcript.js';

function tempDir(t: { teardown: (fn: () => void) => void }): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-transcript-'));
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function readEntries(filePath: string): any[] {
  return fs.readFileSync(filePath, 'utf-8').trim().split('\n').map(line => JSON.parse(line));
}

test('projectDirName replaces every non-alphanumeric character', t => {
  t.is(projectDirName('/Users/me/my_repo.v2'), '-Users-me-my-repo-v2');
});

test('TranscriptWriter creates no file until the first message', t => {
  const root = tempDir(t);
  const writer = new TranscriptWriter({ root, cwd: '/work/repo', version: '1.0.0' });
  t.false(fs.existsSync(writer.filePath));
  t.is(writer.filePath, path.join(root, '-work-repo', `${writer.sessionId}.jsonl`));
});

test('TranscriptWriter writes Claude Code style entries chained by parentUuid', t => {
  const root = tempDir(t);
  const cwd = tempDir(t);
  const writer = new TranscriptWriter({ root, cwd, version: '1.0.0' });

  writer.write({ role: 'user', content: 'hello' });
  writer.write({
    role: 'assistant',
    content: 'Reading it',
    tool_calls: [{ id: 'call_1', function: { name: 'read_file', arguments: '{"file_path":"a.ts"}' } }],
    model: 'openai/gpt-oss-120b',
    effort: 'high',
  });
  writer.write({ role: 'tool', tool_call_id: 'call_1', content: '{"success":true}' });
  writer.write({ role: 'assistant', content: 'Done', model: 'openai/gpt-oss-120b', effort: null });

  const [user, toolUse, toolResult, final] = readEntries(writer.filePath);

  t.like(user, { type: 'user', message: { role: 'user', content: 'hello' }, parentUuid: null, cwd, agent: 'groq-code-cli', version: '1.0.0' });
  t.is(user.sessionId, writer.sessionId);
  t.regex(user.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  t.is(toolUse.type, 'assistant');
  t.is(toolUse.parentUuid, user.uuid);
  t.is(toolUse.effort, 'high');
  t.deepEqual(toolUse.message, {
    role: 'assistant',
    model: 'openai/gpt-oss-120b',
    content: [
      { type: 'text', text: 'Reading it' },
      { type: 'tool_use', id: 'call_1', name: 'read_file', input: { file_path: 'a.ts' } },
    ],
  });

  t.is(toolResult.type, 'user');
  t.deepEqual(toolResult.message.content, [{ type: 'tool_result', tool_use_id: 'call_1', content: '{"success":true}' }]);

  t.false('effort' in final);
  t.deepEqual(final.message.content, [{ type: 'text', text: 'Done' }]);
});

test('TranscriptWriter keeps unparseable tool arguments as a string', t => {
  const root = tempDir(t);
  const writer = new TranscriptWriter({ root, cwd: '/work/repo', version: '1.0.0' });
  writer.write({
    role: 'assistant',
    content: '',
    tool_calls: [{ id: 'call_1', function: { name: 'create_file', arguments: '{"file_path":' } }],
    model: 'm',
    effort: null,
  });
  const [entry] = readEntries(writer.filePath);
  t.deepEqual(entry.message.content, [{ type: 'tool_use', id: 'call_1', name: 'create_file', input: '{"file_path":' }]);
});

test('TranscriptWriter makes the file readable by the owner only', t => {
  const root = tempDir(t);
  const writer = new TranscriptWriter({ root, cwd: '/work/repo', version: '1.0.0' });
  writer.write({ role: 'user', content: 'secret' });
  t.is(fs.statSync(writer.filePath).mode & 0o777, 0o600);
});

test('cleanupTranscripts deletes only transcripts older than the period and empty project dirs', t => {
  const root = tempDir(t);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const write = (rel: string, ageDays: number) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{}\n');
    const time = new Date(now - ageDays * day);
    fs.utimesSync(file, time, time);
    return file;
  };

  const oldOnly = write('-old-project/a.jsonl', 31);
  const oldMixed = write('-mixed/b.jsonl', 31);
  const recent = write('-mixed/c.jsonl', 29);
  const notTranscript = write('-other/notes.txt', 100);

  t.is(cleanupTranscripts(30, root, now), 2);
  t.false(fs.existsSync(oldOnly));
  t.false(fs.existsSync(path.dirname(oldOnly)));
  t.false(fs.existsSync(oldMixed));
  t.true(fs.existsSync(recent));
  t.true(fs.existsSync(notTranscript));
});

test('cleanupTranscripts returns 0 when the root does not exist', t => {
  t.is(cleanupTranscripts(30, path.join(os.tmpdir(), 'groq-transcript-missing-dir')), 0);
});
