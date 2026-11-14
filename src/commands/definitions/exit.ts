import { CommandDefinition, CommandContext } from '../base.js';

export const exitCommand: CommandDefinition = {
  command: 'exit',
  description: 'Exit the application',
  handler: ({ exit }: CommandContext) => {
    exit?.();
  }
};
