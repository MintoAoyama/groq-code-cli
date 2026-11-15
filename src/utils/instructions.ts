import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const INSTRUCTION_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md'];

export interface InstructionFile {
  path: string;
  content: string;
}

/**
 * Directories searched for instruction files, from the most general to the most specific.
 */
export function getInstructionDirs(projectDir: string): string[] {
  return [path.join(os.homedir(), '.groq'), projectDir];
}

/**
 * Reads AGENTS.md and CLAUDE.md from each directory, in order.
 * A file reached twice (for example CLAUDE.md symlinked to AGENTS.md) is read once.
 */
export function loadInstructionFiles(dirs: string[]): InstructionFile[] {
  const seen = new Set<string>();
  const files: InstructionFile[] = [];

  for (const dir of dirs) {
    for (const name of INSTRUCTION_FILE_NAMES) {
      const filePath = path.join(dir, name);
      let realPath: string;
      try {
        realPath = fs.realpathSync(filePath);
      } catch {
        continue;
      }
      if (seen.has(realPath)) continue;
      seen.add(realPath);

      const content = fs.readFileSync(realPath, 'utf-8');
      if (content.trim() === '') continue;
      files.push({ path: filePath, content });
    }
  }

  return files;
}

export function formatInstructionMessage(file: InstructionFile): string {
  return `Instructions from ${file.path}. Follow them throughout the conversation; more specific files listed later take precedence.\n\n${file.content}`;
}
