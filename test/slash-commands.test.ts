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
  t.deepEqual(getCommandNames().sort(), ['clear', 'help', 'init', 'login', 'model', 'reasoning', 'stats']);
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
