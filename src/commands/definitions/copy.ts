import { CommandDefinition, CommandContext } from '../base.js';
import { parseReplyIndex } from '../../utils/replies.js';

export const copyCommand: CommandDefinition = {
  command: 'copy',
  description: 'Copy the latest reply, or the Nth-latest with /copy N',
  handler: ({ args = '', addMessage, copyReply }: CommandContext) => {
    const parsed = parseReplyIndex(args);
    if ('error' in parsed) {
      addMessage({ role: 'system', content: `Usage: /copy [N]. ${parsed.error}` });
      return;
    }
    copyReply?.(parsed.index);
  }
};

export const copyPickCommand: CommandDefinition = {
  command: 'copy-pick',
  description: 'Pick an earlier reply from a list and copy it',
  handler: ({ openCopyPicker }: CommandContext) => {
    openCopyPicker?.();
  }
};
