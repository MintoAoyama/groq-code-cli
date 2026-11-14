import chalk from 'chalk';
import { MUTED } from './theme.js';

const MARK = ['╭─╮', '╰─┤', '╰─╯'];

export function renderBanner({ version, model, cwd }: { version: string; model: string; cwd: string }): string {
  const mark = (row: number) => chalk.hex('#FF4500')(MARK[row]);
  return [
    ` ${mark(0)}  ${chalk.bold('Groq Code CLI')} ${chalk.hex(MUTED)(version)}`,
    ` ${mark(1)}  ${model}`,
    ` ${mark(2)}  ${chalk.hex(MUTED)(cwd)}`,
  ].join('\n');
}
