import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from '../src/utils/local-settings.js';

function withHome(t: { teardown: (fn: () => void) => void }, config?: string): ConfigManager {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-home-'));
  t.teardown(() => fs.rmSync(home, { recursive: true, force: true }));
  if (config !== undefined) {
    fs.mkdirSync(path.join(home, '.groq'));
    fs.writeFileSync(path.join(home, '.groq', 'local-settings.json'), config);
  }
  return new ConfigManager(home);
}

test('getCleanupPeriodDays falls back to the default without a config file', t => {
  t.is(withHome(t).getCleanupPeriodDays(30), 30);
});

test('getCleanupPeriodDays falls back to the default when the key is unset', t => {
  t.is(withHome(t, '{"defaultModel":"m"}').getCleanupPeriodDays(30), 30);
});

test('getCleanupPeriodDays returns a configured value', t => {
  t.is(withHome(t, '{"cleanupPeriodDays":7}').getCleanupPeriodDays(30), 7);
});

for (const value of ['0', '-1', '1.5', '"7"', 'null']) {
  test(`getCleanupPeriodDays rejects ${value}`, t => {
    t.is(withHome(t, `{"cleanupPeriodDays":${value}}`).getCleanupPeriodDays(30), null);
  });
}

test('getCleanupPeriodDays returns null when the config file cannot be parsed', t => {
  t.is(withHome(t, '{').getCleanupPeriodDays(30), null);
});
