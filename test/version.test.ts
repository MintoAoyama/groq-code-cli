import test from 'ava';
import { formatVersion } from '../src/utils/version.js';

test('formatVersion shows the repository and commit of the build', t => {
  t.is(
    formatVersion('1.0.2', { repository: 'MintoAoyama/groq-code-cli', commit: '3f22d05', dirty: false }),
    '1.0.2 (MintoAoyama/groq-code-cli@3f22d05)',
  );
});

test('formatVersion marks builds with uncommitted changes', t => {
  t.is(
    formatVersion('1.0.2', { repository: 'MintoAoyama/groq-code-cli', commit: '3f22d05', dirty: true }),
    '1.0.2 (MintoAoyama/groq-code-cli@3f22d05-dirty)',
  );
});

test('formatVersion falls back to the package version without build info', t => {
  t.is(formatVersion('1.0.2', {}), '1.0.2');
  t.is(formatVersion('1.0.2', { commit: '3f22d05' }), '1.0.2');
});
