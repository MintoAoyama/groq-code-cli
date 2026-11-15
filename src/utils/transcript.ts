import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Written on every entry so tools that read Claude Code transcripts can tell these apart.
export const TRANSCRIPT_AGENT = 'groq-code-cli';

export const DEFAULT_CLEANUP_PERIOD_DAYS = 30;

export function defaultTranscriptsRoot(): string {
  return path.join(os.homedir(), '.groq', 'projects');
}

// Same encoding Claude Code uses for ~/.claude/projects/<project>.
export function projectDirName(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-');
}

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export type TranscriptMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: ToolCall[]; model: string; effort: string | null }
  | { role: 'tool'; tool_call_id: string; content: string };

function parseToolInput(args: string): unknown {
  try {
    return JSON.parse(args);
  } catch {
    return args;
  }
}

function currentGitBranch(cwd: string): string | undefined {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Appends a session's messages to a JSONL file laid out like a Claude Code transcript.
 *
 * The file is created on the first message, so a session that sends nothing leaves no file.
 */
export class TranscriptWriter {
  readonly sessionId: string;
  readonly filePath: string;
  private readonly cwd: string;
  private readonly version: string;
  private parentUuid: string | null = null;

  constructor(options: { root?: string; cwd?: string; version: string; sessionId?: string }) {
    this.cwd = options.cwd ?? process.cwd();
    this.version = options.version;
    this.sessionId = options.sessionId ?? randomUUID();
    const root = options.root ?? defaultTranscriptsRoot();
    this.filePath = path.join(root, projectDirName(this.cwd), `${this.sessionId}.jsonl`);
  }

  write(message: TranscriptMessage): void {
    const uuid = randomUUID();
    const entry = {
      ...this.toEntry(message),
      uuid,
      parentUuid: this.parentUuid,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      cwd: this.cwd,
      gitBranch: currentGitBranch(this.cwd),
      agent: TRANSCRIPT_AGENT,
      version: this.version,
    };
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.appendFileSync(this.filePath, JSON.stringify(entry) + '\n', { mode: 0o600 });
      this.parentUuid = uuid;
    } catch {
      // A transcript that cannot be written must not interrupt the chat.
    }
  }

  private toEntry(message: TranscriptMessage): Record<string, unknown> {
    switch (message.role) {
      case 'user':
        return { type: 'user', message: { role: 'user', content: message.content } };
      case 'assistant': {
        const content: Record<string, unknown>[] = [];
        if (message.content) {
          content.push({ type: 'text', text: message.content });
        }
        for (const call of message.tool_calls ?? []) {
          content.push({ type: 'tool_use', id: call.id, name: call.function.name, input: parseToolInput(call.function.arguments) });
        }
        return {
          type: 'assistant',
          message: { role: 'assistant', model: message.model, content },
          ...(message.effort ? { effort: message.effort } : {}),
        };
      }
      case 'tool':
        // An array content keeps tool results out of readers that only show typed prompts.
        return {
          type: 'user',
          message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: message.tool_call_id, content: message.content }] },
        };
    }
  }
}

/**
 * Deletes transcripts last written more than `days` days ago, then removes project directories left empty.
 *
 * @returns The number of transcripts deleted.
 */
export function cleanupTranscripts(days: number, root: string = defaultTranscriptsRoot(), now: number = Date.now()): number {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  let deleted = 0;
  let projects: fs.Dirent[];
  try {
    projects = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const projectDir = path.join(root, project.name);
    try {
      for (const file of fs.readdirSync(projectDir, { withFileTypes: true })) {
        if (!file.isFile() || !file.name.endsWith('.jsonl')) continue;
        const filePath = path.join(projectDir, file.name);
        if (fs.statSync(filePath).mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      }
      if (fs.readdirSync(projectDir).length === 0) {
        fs.rmdirSync(projectDir);
      }
    } catch {
      // Leave anything that cannot be read or removed for the next run.
    }
  }
  return deleted;
}
