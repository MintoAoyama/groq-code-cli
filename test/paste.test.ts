import test from 'ava';
import { backspaceLength, expandPastes, lineCountOf, pastePlaceholder } from '../src/utils/paste.js';

test('lineCountOf counts a trailing newline as an extra line', t => {
  t.is(lineCountOf('one'), 1);
  t.is(lineCountOf('one\ntwo\nthree'), 3);
  t.is(lineCountOf('one\n'), 2);
});

test('expandPastes replaces placeholders with the pasted text', t => {
  const pastes = new Map([[1, 'a\nb\nc'], [2, 'x\ny\nz']]);
  const text = `before ${pastePlaceholder(1, 3)} middle ${pastePlaceholder(2, 3)}`;
  t.is(expandPastes(text, pastes), 'before a\nb\nc middle x\ny\nz');
});

test('expandPastes keeps placeholders it has no paste for', t => {
  const text = `${pastePlaceholder(3, 5)} typed by hand`;
  t.is(expandPastes(text, new Map()), text);
});

test('backspaceLength removes a whole placeholder before the cursor', t => {
  const placeholder = pastePlaceholder(1, 12);
  t.is(backspaceLength(`hi ${placeholder}`), placeholder.length);
  t.is(backspaceLength(`${placeholder} `), 1);
  t.is(backspaceLength('plain'), 1);
});
