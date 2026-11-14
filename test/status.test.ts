import test from 'ava';
import {
  formatCost,
  formatTokens,
  parseRateLimit,
  parseShortstat,
  shortenHome,
} from '../src/utils/status.js';
import { estimateCost } from '../src/utils/models.js';
import { clipboardCommands, osc52 } from '../src/utils/clipboard.js';

test('formatTokens abbreviates thousands and millions', t => {
  t.is(formatTokens(999), '999');
  t.is(formatTokens(12_345), '12.3k');
  t.is(formatTokens(2_500_000), '2.5M');
  t.is(formatTokens(250_000), '250k');
});

test('formatCost shows more digits for small amounts', t => {
  t.is(formatCost(0.00123), '$0.0012');
  t.is(formatCost(1.234), '$1.23');
});

test('shortenHome replaces only a whole home directory prefix', t => {
  t.is(shortenHome('/Users/a/work', '/Users/a'), '~/work');
  t.is(shortenHome('/Users/ab/work', '/Users/a'), '/Users/ab/work');
});

test('parseRateLimit reads Groq headers and ignores missing ones', t => {
  const headers = new Headers({
    'x-ratelimit-limit-tokens': '6000',
    'x-ratelimit-remaining-tokens': '5800',
  });
  t.deepEqual(parseRateLimit(headers), {
    limitRequests: undefined,
    remainingRequests: undefined,
    limitTokens: 6000,
    remainingTokens: 5800,
  });
  t.is(parseRateLimit(new Headers()), undefined);
});

test('parseShortstat reads insertions and deletions', t => {
  t.deepEqual(parseShortstat(' 2 files changed, 10 insertions(+), 1 deletion(-)'), { insertions: 10, deletions: 1 });
  t.deepEqual(parseShortstat(' 1 file changed, 1 insertion(+)'), { insertions: 1, deletions: 0 });
  t.deepEqual(parseShortstat(''), { insertions: 0, deletions: 0 });
});

test('estimateCost uses per-million prices and skips unknown models', t => {
  t.is(estimateCost('openai/gpt-oss-120b', 1_000_000, 1_000_000), 0.75);
  t.is(estimateCost('unknown/model', 100, 100), undefined);
});

test('clipboardCommands picks tools per platform', t => {
  t.deepEqual(clipboardCommands('darwin', {}).map(c => c.command), ['pbcopy']);
  t.deepEqual(clipboardCommands('linux', {}).map(c => c.command), ['xclip', 'xsel']);
  t.deepEqual(clipboardCommands('linux', { WAYLAND_DISPLAY: 'wayland-0' }).map(c => c.command), ['wl-copy', 'xclip', 'xsel']);
});

test('osc52 encodes the text and wraps it for tmux', t => {
  t.is(osc52('hi', {}), '\x1b]52;c;aGk=\x07');
  t.is(osc52('hi', { TMUX: '1' }), '\x1bPtmux;\x1b\x1b]52;c;aGk=\x07\x1b\\');
});
