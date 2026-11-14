import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
}

const remote = git('remote', 'get-url', 'origin');
const buildInfo = {
  repository: remote?.match(/[/:]([^/:]+\/[^/]+?)(?:\.git)?$/)?.[1],
  commit: git('rev-parse', '--short', 'HEAD'),
  dirty: Boolean(git('status', '--porcelain', '--untracked-files=no')),
};

writeFileSync(new URL('../dist/build-info.json', import.meta.url), `${JSON.stringify(buildInfo, null, 2)}\n`);
