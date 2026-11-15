import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Agent } from '../src/core/agent.js';
import { loadInstructionFiles } from '../src/utils/instructions.js';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('loadInstructionFiles reads AGENTS.md then CLAUDE.md in each directory, in order', t => {
  const user = makeTempDir('groq-instr-user-');
  const project = makeTempDir('groq-instr-project-');
  try {
    fs.writeFileSync(path.join(user, 'CLAUDE.md'), 'user claude');
    fs.writeFileSync(path.join(project, 'AGENTS.md'), 'project agents');
    fs.writeFileSync(path.join(project, 'CLAUDE.md'), 'project claude');

    const files = loadInstructionFiles([user, project]);

    t.deepEqual(files.map(f => f.content), ['user claude', 'project agents', 'project claude']);
    t.is(files[0].path, path.join(user, 'CLAUDE.md'));
  } finally {
    fs.rmSync(user, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('loadInstructionFiles reads a symlinked CLAUDE.md only once', t => {
  const dir = makeTempDir('groq-instr-link-');
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'shared');
    fs.symlinkSync('AGENTS.md', path.join(dir, 'CLAUDE.md'));

    const files = loadInstructionFiles([dir]);

    t.deepEqual(files.map(f => f.path), [path.join(dir, 'AGENTS.md')]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('loadInstructionFiles reads a directory listed twice only once', t => {
  const dir = makeTempDir('groq-instr-dup-');
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'once');

    t.is(loadInstructionFiles([dir, dir]).length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('loadInstructionFiles skips missing and blank files', t => {
  const dir = makeTempDir('groq-instr-blank-');
  try {
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '  \n');

    t.deepEqual(loadInstructionFiles([dir, path.join(dir, 'missing')]), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test.serial('Agent adds user and project instruction files after the system message', async t => {
  const home = makeTempDir('groq-instr-home-');
  const project = makeTempDir('groq-instr-cwd-');
  const original = { ...process.env };
  try {
    fs.mkdirSync(path.join(home, '.groq'));
    fs.writeFileSync(path.join(home, '.groq', 'AGENTS.md'), 'Reply in Japanese.');
    fs.writeFileSync(path.join(project, 'CLAUDE.md'), 'Run npm test.');
    process.env.HOME = home;
    process.env.GROQ_CONTEXT_DIR = project;

    const agent = await Agent.create('test-model', 1.0, 'custom system', false);
    const msgs = (agent as any).messages as Array<{ role: string; content: string }>;

    t.is(msgs[0].content, 'custom system');
    t.true(msgs[1].content.includes(path.join(home, '.groq', 'AGENTS.md')));
    t.true(msgs[1].content.endsWith('Reply in Japanese.'));
    t.true(msgs[2].content.endsWith('Run npm test.'));
  } finally {
    for (const k of Object.keys(process.env)) delete (process.env as any)[k];
    Object.assign(process.env, original);
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});
