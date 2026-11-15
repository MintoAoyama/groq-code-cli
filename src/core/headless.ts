import type { Agent } from './agent.js';

export interface HeadlessOptions {
  allowEdits?: boolean;
  out?: (text: string) => void;
  log?: (text: string) => void;
}

type HeadlessAgent = Pick<Agent, 'chat' | 'refreshModels' | 'setToolCallbacks' | 'setSessionAutoApprove' | 'getCurrentModel'>;

// Runs one prompt without the TUI. Only the final reply goes to `out` (stdout), so it can be piped;
// progress and errors go to `log` (stderr). Resolves to the process exit code.
export async function runHeadless(agent: HeadlessAgent, prompt: string, options: HeadlessOptions = {}): Promise<number> {
  const out = options.out ?? (text => process.stdout.write(text));
  const log = options.log ?? (text => process.stderr.write(text));
  let finalMessage: string | null = null;
  let failure: string | null = null;

  const replaced = await agent.refreshModels();
  if (replaced) {
    log(`${replaced} is no longer available on Groq. Using ${agent.getCurrentModel()}.\n`);
  }

  // With auto-approval, create_file and edit_file skip the approval callback; the
  // callback then only sees execute_command and delete_file, which are always refused.
  agent.setSessionAutoApprove(Boolean(options.allowEdits));
  agent.setToolCallbacks({
    onToolStart: name => log(`[tool] ${name}\n`),
    onToolEnd: (name, result) => {
      if (result?.success === false) log(`[tool] ${name} failed: ${result.error ?? 'unknown error'}\n`);
    },
    onToolApproval: async name => {
      log(`[tool] ${name} refused: it needs approval, which headless mode cannot ask for${options.allowEdits ? '' : ' (use --allow-edits for file edits)'}\n`);
      return { approved: false };
    },
    onThinkingText: content => {
      if (content.trim()) log(`${content}\n`);
    },
    onFinalMessage: content => {
      finalMessage = content;
    },
    onMaxIterations: async maxIterations => {
      failure = `Stopped after ${maxIterations} tool iterations.`;
      return false;
    },
    onError: async error => {
      failure = error;
      return false;
    },
  });

  try {
    await agent.chat(prompt);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  if (finalMessage !== null) {
    out((finalMessage as string).endsWith('\n') ? finalMessage : `${finalMessage}\n`);
  }
  if (failure) {
    log(`error: ${failure}\n`);
    return 1;
  }
  return finalMessage === null ? 1 : 0;
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
