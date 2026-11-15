import { spawn } from 'child_process';

export interface CommandHook {
  type: 'command';
  command: string;
  // Seconds, as in Claude Code.
  timeout?: number;
}

export interface HookMatcher {
  // Evaluated like Claude Code's matchers; see matchesReason.
  matcher?: string;
  hooks: CommandHook[];
}

export interface HooksConfig {
  SessionEnd?: HookMatcher[];
}

export type SessionEndReason = 'clear' | 'prompt_input_exit' | 'other';

export interface SessionEndInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: 'SessionEnd';
  reason: SessionEndReason;
}

// Claude Code's default and upper limit for SessionEnd, which runs while the CLI is quitting.
export const DEFAULT_SESSION_END_TIMEOUT_SECONDS = 1.5;
export const MAX_SESSION_END_TIMEOUT_SECONDS = 60;

const EXACT_MATCHER = /^[A-Za-z0-9_\- ,|]*$/;

/**
 * Follows Claude Code's matcher rules: omitted, "" or "*" match everything; a value of only letters, digits,
 * "_", "-", spaces, "," and "|" lists exact names separated by "|" or ","; anything else is an unanchored regex.
 */
export function matchesReason(matcher: string | undefined, reason: string): boolean {
  if (matcher === undefined || matcher === '' || matcher === '*') return true;
  if (EXACT_MATCHER.test(matcher)) {
    return matcher.split(/[|,]/).map(part => part.trim()).includes(reason);
  }
  try {
    return new RegExp(matcher).test(reason);
  } catch {
    return false;
  }
}

/**
 * Keeps only well-formed command hooks, so a typo in the config never throws while quitting.
 */
export function parseHookMatchers(value: unknown): HookMatcher[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (typeof entry !== 'object' || entry === null || !Array.isArray(entry.hooks)) return [];
    const hooks = (entry.hooks as unknown[]).filter((hook): hook is CommandHook =>
      typeof hook === 'object' && hook !== null &&
      (hook as CommandHook).type === 'command' &&
      typeof (hook as CommandHook).command === 'string' &&
      ((hook as CommandHook).timeout === undefined || (typeof (hook as CommandHook).timeout === 'number' && (hook as CommandHook).timeout! > 0))
    );
    const matcher = typeof entry.matcher === 'string' ? entry.matcher : undefined;
    return hooks.length > 0 ? [{ matcher, hooks }] : [];
  });
}

/**
 * Runs a command through the shell with the input as JSON on stdin, and kills it after the timeout.
 *
 * The output is discarded; a hook that has more to do should detach that work itself.
 */
export function runCommandHook(command: string, input: object, timeoutSeconds: number, cwd: string): Promise<void> {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(command, { shell: true, cwd, stdio: ['pipe', 'ignore', 'ignore'] });
    } catch {
      resolve();
      return;
    }
    const timer = setTimeout(() => child.kill(), timeoutSeconds * 1000);
    child.on('error', () => {
      clearTimeout(timer);
      resolve();
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
    // A hook that exits without reading stdin closes the pipe early.
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(input));
  });
}

export async function runSessionEndHooks(matchers: HookMatcher[], input: SessionEndInput): Promise<void> {
  const hooks = matchers.filter(m => matchesReason(m.matcher, input.reason)).flatMap(m => m.hooks);
  await Promise.all(hooks.map(hook =>
    runCommandHook(hook.command, input, Math.min(hook.timeout ?? DEFAULT_SESSION_END_TIMEOUT_SECONDS, MAX_SESSION_END_TIMEOUT_SECONDS), input.cwd)
  ));
}
