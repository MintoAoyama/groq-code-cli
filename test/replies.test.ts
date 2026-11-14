import test from 'ava';
import { codeBlocksOf, fit, parseReplyIndex, repliesOf } from '../src/utils/replies.js';

test('repliesOf groups assistant texts per prompt, newest first', t => {
  const replies = repliesOf([
    { role: 'user', content: 'first' },
    { role: 'assistant', content: 'reading files' },
    { role: 'tool_execution', content: 'read_file' },
    { role: 'assistant', content: 'done' },
    { role: 'user', content: '/stats' },
    { role: 'system', content: 'stats' },
    { role: 'user', content: 'second' },
    { role: 'assistant', content: '  answer  ' },
  ]);
  t.deepEqual(replies, ['answer', 'reading files\n\ndone']);
});

test('repliesOf skips prompts with only empty assistant texts', t => {
  t.deepEqual(repliesOf([{ role: 'user', content: 'q' }, { role: 'assistant', content: ' ' }]), []);
});

test('codeBlocksOf extracts language and source', t => {
  const text = 'intro\n```ts\nconst a = 1;\n```\nmid\n```\nplain\n```\n';
  t.deepEqual(codeBlocksOf(text), [
    { language: 'ts', source: 'const a = 1;' },
    { language: '', source: 'plain' },
  ]);
});

test('parseReplyIndex defaults to the latest reply', t => {
  t.deepEqual(parseReplyIndex(''), { index: 1 });
  t.deepEqual(parseReplyIndex(' 4 '), { index: 4 });
  t.true('error' in parseReplyIndex('0'));
  t.true('error' in parseReplyIndex('-1'));
  t.true('error' in parseReplyIndex('x'));
});

test('fit keeps text that fits and counts full-width characters as two cells', t => {
  t.is(fit('abcde', 5), 'abcde');
  t.is(fit('abcdef', 5), 'abcd…');
  t.is(fit('日本語です', 6), '日本…');
  t.is(fit('日本語', 6), '日本語');
});
