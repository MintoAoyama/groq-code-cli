import test from 'ava';
import { runHeadless } from '../src/core/headless.js';

type Callbacks = Parameters<import('../src/core/agent.js').Agent['setToolCallbacks']>[0];

// Stands in for the Agent: `script` plays the part of chat() using the callbacks runHeadless sets.
function fakeAgent(script: (callbacks: Callbacks, autoApprove: boolean) => Promise<void>, replaced: string | null = null) {
  let callbacks: Callbacks = {};
  let autoApprove = false;
  return {
    refreshModels: async () => replaced,
    getCurrentModel: () => 'openai/gpt-oss-120b',
    setSessionAutoApprove: (enabled: boolean) => {
      autoApprove = enabled;
    },
    setToolCallbacks: (value: Callbacks) => {
      callbacks = value;
    },
    chat: async () => script(callbacks, autoApprove),
  };
}

async function run(agent: ReturnType<typeof fakeAgent>, allowEdits = false) {
  let out = '';
  let log = '';
  const code = await runHeadless(agent, 'prompt', {
    allowEdits,
    out: text => (out += text),
    log: text => (log += text),
  });
  return { code, out, log };
}

test('prints only the final reply to stdout', async t => {
  const agent = fakeAgent(async callbacks => {
    callbacks.onThinkingText?.('Let me look.');
    callbacks.onToolStart?.('read_file', {});
    callbacks.onFinalMessage?.('Done.');
  });
  const { code, out, log } = await run(agent);
  t.is(code, 0);
  t.is(out, 'Done.\n');
  t.regex(log, /Let me look\./);
  t.regex(log, /\[tool\] read_file/);
});

test('refuses tools that need approval', async t => {
  let approved: boolean | undefined;
  const agent = fakeAgent(async callbacks => {
    approved = (await callbacks.onToolApproval?.('edit_file', {}))?.approved;
    callbacks.onFinalMessage?.('Could not edit.');
  });
  const { code, log } = await run(agent);
  t.false(approved);
  t.is(code, 0);
  t.regex(log, /--allow-edits/);
});

test('--allow-edits turns on auto-approval for file edits', async t => {
  let autoApproved = false;
  const agent = fakeAgent(async (callbacks, autoApprove) => {
    autoApproved = autoApprove;
    callbacks.onFinalMessage?.('Edited.');
  });
  await run(agent, true);
  t.true(autoApproved);
});

test('API errors are not retried and exit with 1', async t => {
  let retried: boolean | undefined;
  const agent = fakeAgent(async callbacks => {
    retried = await callbacks.onError?.('API Error (500): boom');
  });
  const { code, out, log } = await run(agent);
  t.false(retried);
  t.is(code, 1);
  t.is(out, '');
  t.regex(log, /error: API Error \(500\): boom/);
});

test('stops at the iteration limit and exits with 1', async t => {
  let continued: boolean | undefined;
  const agent = fakeAgent(async callbacks => {
    continued = await callbacks.onMaxIterations?.(50);
  });
  const { code, log } = await run(agent);
  t.false(continued);
  t.is(code, 1);
  t.regex(log, /50 tool iterations/);
});

test('a thrown error such as a missing API key exits with 1', async t => {
  const agent = fakeAgent(async () => {
    throw new Error('No API key available.');
  });
  const { code, log } = await run(agent);
  t.is(code, 1);
  t.regex(log, /No API key available/);
});

test('tells when a removed model was replaced', async t => {
  const agent = fakeAgent(async callbacks => callbacks.onFinalMessage?.('Hi.'), 'moonshotai/kimi-k2-instruct');
  const { log } = await run(agent);
  t.regex(log, /moonshotai\/kimi-k2-instruct is no longer available/);
});
