import test from 'ava';
import { getCommandNames, handleSlashCommand, type CommandContext } from '../src/commands/index.js';

function createContext() {
  const messages: any[] = [];
  let cleared = 0;
  let loginShown: boolean | undefined;
  const context: CommandContext = {
    addMessage: message => messages.push(message),
    clearHistory: () => {
      cleared++;
    },
    setShowLogin: show => {
      loginShown = show;
    },
  };
  return { context, messages, cleared: () => cleared, loginShown: () => loginShown };
}

test('getCommandNames lists every built-in command', t => {
  t.deepEqual(getCommandNames().sort(), ['clear', 'copy', 'copy-pick', 'effort', 'exit', 'help', 'init', 'login', 'model', 'reasoning', 'stats']);
});

test('handleSlashCommand records the input and runs the matching command', t => {
  const { context, messages, cleared } = createContext();
  handleSlashCommand('/clear', context);
  t.is(cleared(), 1);
  t.deepEqual(messages[0], { role: 'user', content: '/clear' });
  t.is(messages[1].role, 'system');
});

test('handleSlashCommand matches case-insensitively and ignores arguments', t => {
  const { context, loginShown } = createContext();
  handleSlashCommand('/LOGIN extra args', context);
  t.true(loginShown());
});

test('handleSlashCommand only records the input for unknown commands', t => {
  const { context, messages, cleared } = createContext();
  handleSlashCommand('/unknown', context);
  t.deepEqual(messages, [{ role: 'user', content: '/unknown' }]);
  t.is(cleared(), 0);
});

test('/help lists every command', t => {
  const { context, messages } = createContext();
  handleSlashCommand('/help', context);
  for (const name of getCommandNames()) {
    t.true(messages[1].content.includes(`/${name} - `), `missing /${name}`);
  }
});

test('/exit calls exit', t => {
  const { context } = createContext();
  let exited = 0;
  handleSlashCommand('/exit', { ...context, exit: () => { exited++; } });
  t.is(exited, 1);
});

test('/copy passes the reply index from its argument', t => {
  const { context } = createContext();
  const indexes: number[] = [];
  const copyReply = (index: number) => { indexes.push(index); };
  handleSlashCommand('/copy', { ...context, copyReply });
  handleSlashCommand('/copy 3', { ...context, copyReply });
  t.deepEqual(indexes, [1, 3]);
});

test('/copy rejects an argument that is not a positive number', t => {
  const { context, messages } = createContext();
  let called = false;
  handleSlashCommand('/copy two', { ...context, copyReply: () => { called = true; } });
  t.false(called);
  t.true(messages[1].content.startsWith('Usage: /copy [N].'));
});

test('/copy-pick opens the picker', t => {
  const { context } = createContext();
  let opened = false;
  handleSlashCommand('/copy-pick', { ...context, openCopyPicker: () => { opened = true; } });
  t.true(opened);
});

function effortContext(model: string, reasoningEffort: string | null = null) {
  const { context, messages } = createContext();
  const set: (string | null)[] = [];
  return {
    context: { ...context, model, reasoningEffort, setReasoningEffort: (e: string | null) => { set.push(e); } },
    messages,
    set,
  };
}

test('/effort without a value shows the current value and the options', t => {
  const { context, messages, set } = effortContext('openai/gpt-oss-120b', 'high');
  handleSlashCommand('/effort', context);
  t.deepEqual(set, []);
  t.is(messages[1].content, 'Reasoning effort for openai/gpt-oss-120b: high. Options: low, medium, high, auto.');
});

test('/effort sets a value the model accepts, case-insensitively', t => {
  const { context, set } = effortContext('openai/gpt-oss-120b');
  handleSlashCommand('/effort HIGH', context);
  t.deepEqual(set, ['high']);
});

test('/effort auto clears the value', t => {
  const { context, set } = effortContext('openai/gpt-oss-120b', 'low');
  handleSlashCommand('/effort auto', context);
  t.deepEqual(set, [null]);
});

test('/effort rejects a value the model does not accept', t => {
  const { context, messages, set } = effortContext('openai/gpt-oss-120b');
  handleSlashCommand('/effort none', context);
  t.deepEqual(set, []);
  t.true(messages[1].content.startsWith('Unknown reasoning effort "none"'));
});

test('/effort tells when the model takes no effort', t => {
  const { context, messages, set } = effortContext('moonshotai/kimi-k2-instruct');
  handleSlashCommand('/effort high', context);
  t.deepEqual(set, []);
  t.is(messages[1].content, 'moonshotai/kimi-k2-instruct does not take a reasoning effort.');
});
