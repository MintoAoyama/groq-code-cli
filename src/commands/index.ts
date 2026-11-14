import { CommandDefinition, CommandContext } from './base.js';
import { helpCommand } from './definitions/help.js';
import { loginCommand } from './definitions/login.js';
import { modelCommand } from './definitions/model.js';
import { clearCommand } from './definitions/clear.js';
import { initCommand } from './definitions/init.js';
import { reasoningCommand } from './definitions/reasoning.js';
import { statsCommand } from './definitions/stats.js';
import { copyCommand, copyPickCommand } from './definitions/copy.js';
import { exitCommand } from './definitions/exit.js';

const availableCommands: CommandDefinition[] = [
  helpCommand,
  loginCommand,
  modelCommand,
  clearCommand,
  initCommand,
  reasoningCommand,
  statsCommand,
  copyCommand,
  copyPickCommand,
  exitCommand,
];

export function getAvailableCommands(): CommandDefinition[] {
  return [...availableCommands];
}

export function getCommandNames(): string[] {
  return getAvailableCommands().map(cmd => cmd.command);
}

export function handleSlashCommand(
  command: string, 
  context: CommandContext
) {
  // Extract the command part, everything up to the first space or end of string
  const fullCommand = command.slice(1);
  const spaceIndex = fullCommand.indexOf(' ');
  const cmd = spaceIndex > -1 ? fullCommand.substring(0, spaceIndex).toLowerCase() : fullCommand.toLowerCase();
  const args = spaceIndex > -1 ? fullCommand.substring(spaceIndex + 1).trim() : '';
  
  const commandDef = getAvailableCommands().find(c => c.command === cmd);
  
  // Add user message for the command
  context.addMessage({
    role: 'user',
    content: command,
  });
  
  if (commandDef) {
    commandDef.handler({ ...context, args });
  }
}

export { CommandDefinition, CommandContext } from './base.js';