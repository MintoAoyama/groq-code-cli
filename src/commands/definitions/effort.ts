import { CommandDefinition, CommandContext } from '../base.js';
import { getEfforts } from '../../utils/models.js';

const AUTO = 'auto';

export const effortCommand: CommandDefinition = {
  command: 'effort',
  description: 'Show or set the reasoning effort: /effort <value>, or /effort auto to leave it to the API',
  handler: ({ args = '', model = '', reasoningEffort = null, addMessage, setReasoningEffort }: CommandContext) => {
    const efforts = getEfforts(model);
    if (efforts.length === 0) {
      addMessage({ role: 'system', content: `${model} does not take a reasoning effort.` });
      return;
    }
    const options = `Options: ${[...efforts, AUTO].join(', ')}.`;
    const value = args.trim().toLowerCase();
    if (value === '') {
      addMessage({
        role: 'system',
        content: `Reasoning effort for ${model}: ${reasoningEffort ?? `${AUTO} (not sent)`}. ${options}`,
      });
      return;
    }
    if (value !== AUTO && !efforts.includes(value)) {
      addMessage({ role: 'system', content: `Unknown reasoning effort "${value}" for ${model}. ${options}` });
      return;
    }
    const effort = value === AUTO ? null : value;
    setReasoningEffort?.(effort);
    addMessage({
      role: 'system',
      content: effort === null
        ? `Reasoning effort for ${model} is now left to the API.`
        : `Reasoning effort for ${model} set to ${effort}.`,
    });
  }
};
