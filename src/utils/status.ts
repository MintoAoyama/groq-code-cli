import { execFile } from 'child_process';
import os from 'os';

export interface RateLimit {
  limitRequests?: number;
  remainingRequests?: number;
  limitTokens?: number;
  remainingTokens?: number;
}

export interface GitStatus {
  branch: string;
  insertions: number;
  deletions: number;
}

export function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  const [value, unit] = count < 1_000_000 ? [count / 1000, 'k'] : [count / 1_000_000, 'M'];
  return `${value.toFixed(1).replace(/\.0$/, '')}${unit}`;
}

export function formatCost(usd: number): string {
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

export function shortenHome(dir: string, home: string = os.homedir()): string {
  if (home && (dir === home || dir.startsWith(home + '/'))) return '~' + dir.slice(home.length);
  return dir;
}

const toNumber = (value: string | null): number | undefined => {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// Header names from https://console.groq.com/docs/rate-limits: requests are per day, tokens per minute.
export function parseRateLimit(headers: { get(name: string): string | null }): RateLimit | undefined {
  const rateLimit: RateLimit = {
    limitRequests: toNumber(headers.get('x-ratelimit-limit-requests')),
    remainingRequests: toNumber(headers.get('x-ratelimit-remaining-requests')),
    limitTokens: toNumber(headers.get('x-ratelimit-limit-tokens')),
    remainingTokens: toNumber(headers.get('x-ratelimit-remaining-tokens')),
  };
  return Object.values(rateLimit).some(value => value !== undefined) ? rateLimit : undefined;
}

export function parseShortstat(output: string): { insertions: number; deletions: number } {
  const insertions = /(\d+) insertions?\(\+\)/.exec(output);
  const deletions = /(\d+) deletions?\(-\)/.exec(output);
  return {
    insertions: insertions ? Number(insertions[1]) : 0,
    deletions: deletions ? Number(deletions[1]) : 0,
  };
}

function git(args: string[], cwd: string): Promise<string | undefined> {
  return new Promise(resolve => {
    execFile('git', args, { cwd, timeout: 2000 }, (error, stdout) => {
      resolve(error ? undefined : stdout.trim());
    });
  });
}

export async function readGitStatus(cwd: string = process.cwd()): Promise<GitStatus | undefined> {
  const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  if (branch === undefined) return undefined;
  // Staged and unstaged changes together; fails before the first commit, which counts as none.
  const shortstat = await git(['diff', 'HEAD', '--shortstat'], cwd);
  return { branch, ...parseShortstat(shortstat ?? '') };
}
