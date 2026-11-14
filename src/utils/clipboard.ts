import { spawn } from 'child_process';

export type CopyResult =
  | { ok: true; method: string }
  | { ok: false; reason: string };

interface ClipboardCommand {
  command: string;
  args: string[];
}

export function clipboardCommands(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): ClipboardCommand[] {
  switch (platform) {
    case 'darwin':
      return [{ command: 'pbcopy', args: [] }];
    case 'win32':
      return [{ command: 'clip', args: [] }];
    default: {
      const commands: ClipboardCommand[] = [];
      if (env.WAYLAND_DISPLAY) commands.push({ command: 'wl-copy', args: [] });
      commands.push(
        { command: 'xclip', args: ['-selection', 'clipboard'] },
        { command: 'xsel', args: ['--clipboard', '--input'] },
      );
      return commands;
    }
  }
}

function runWithInput({ command, args }: ClipboardCommand, text: string): Promise<boolean> {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    } catch {
      resolve(false);
      return;
    }
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
    child.stdin.on('error', () => resolve(false));
    child.stdin.end(text);
  });
}

export function osc52(text: string, env: NodeJS.ProcessEnv = process.env): string {
  const sequence = `\x1b]52;c;${Buffer.from(text, 'utf-8').toString('base64')}\x07`;
  // tmux only forwards the sequence to the outer terminal inside a passthrough wrapper.
  return env.TMUX ? `\x1bPtmux;${sequence.replace(/\x1b/g, '\x1b\x1b')}\x1b\\` : sequence;
}

export async function copyToClipboard(text: string): Promise<CopyResult> {
  // Over SSH the local tools write to the remote machine's clipboard, not the user's.
  if (!process.env.SSH_TTY) {
    for (const candidate of clipboardCommands()) {
      if (await runWithInput(candidate, text)) return { ok: true, method: candidate.command };
    }
  }
  if (!process.stdout.isTTY) {
    return { ok: false, reason: 'no clipboard command found and stdout is not a terminal' };
  }
  process.stdout.write(osc52(text));
  return { ok: true, method: 'OSC 52' };
}
