import test from 'ava';
import { parseMarkdown, parseInlineElements } from '../src/utils/markdown.js';

test('parseMarkdown collects fenced code blocks without the fences', t => {
  const elements = parseMarkdown(['before', '```ts', 'const a = 1;', 'const b = 2;', '```', 'after'].join('\n'));
  t.deepEqual(elements, [
    { type: 'text', content: 'before' },
    { type: 'code-block', content: 'const a = 1;\nconst b = 2;' },
    { type: 'text', content: 'after' },
  ]);
});

test('parseMarkdown keeps an unterminated code block until the end', t => {
  const elements = parseMarkdown(['```', 'line 1', 'line 2'].join('\n'));
  t.deepEqual(elements, [{ type: 'code-block', content: 'line 1\nline 2' }]);
});

test('parseMarkdown detects heading levels', t => {
  const elements = parseMarkdown(['# Title', '### Section'].join('\n'));
  t.deepEqual(elements, [
    { type: 'heading', content: 'Title', level: 1 },
    { type: 'heading', content: 'Section', level: 3 },
  ]);
});

test('parseMarkdown marks lines with inline syntax as mixed lines', t => {
  const elements = parseMarkdown(['use `npm test`', '**bold**', '*italic*', 'plain'].join('\n'));
  t.deepEqual(
    elements.map(element => element.type),
    ['mixed-line', 'mixed-line', 'mixed-line', 'text'],
  );
});

test('parseMarkdown keeps empty lines as a single space', t => {
  const elements = parseMarkdown('a\n\nb');
  t.deepEqual(elements[1], { type: 'text', content: ' ' });
});

test('parseInlineElements splits code, bold and italic segments', t => {
  t.deepEqual(parseInlineElements('run `npm test` then **check** the *output* now'), [
    { type: 'text', content: 'run ' },
    { type: 'code', content: 'npm test' },
    { type: 'text', content: ' then ' },
    { type: 'bold', content: 'check' },
    { type: 'text', content: ' the ' },
    { type: 'italic', content: 'output' },
    { type: 'text', content: ' now' },
  ]);
});

test('parseInlineElements does not parse emphasis inside inline code', t => {
  t.deepEqual(parseInlineElements('`**not bold**`'), [{ type: 'code', content: '**not bold**' }]);
});

test('parseInlineElements returns unmatched markers as text', t => {
  t.deepEqual(parseInlineElements('a ` b'), [{ type: 'text', content: 'a ` b' }]);
});
