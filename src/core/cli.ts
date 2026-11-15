#!/usr/bin/env node
import { parseArgs } from 'node:util';
import os from 'node:os';
import chalk from 'chalk';
import { render } from 'ink';
import React from 'react';
import { Agent } from './agent.js';
import { readStdin, runHeadless } from './headless.js';
import App from '../ui/App.js';
import { getVersion } from '../utils/version.js';
import { shortenHome } from '../utils/status.js';
import { renderBanner } from '../ui/banner.js';
import { DEFAULT_MODEL } from '../utils/models.js';
import { ConfigManager } from '../utils/local-settings.js';
import { cleanupTranscripts, DEFAULT_CLEANUP_PERIOD_DAYS } from '../utils/transcript.js';

const HELP = `Usage: groq [options] [prompt]

Groq Code CLI

Arguments:
  prompt                    Message to send when the chat starts (put -- before one that starts with -)

Options:
  -p, --print               Answer the prompt without the chat UI, print the reply and exit.
                            Piped input is appended to the prompt
  --allow-edits             With --print, let the model create and edit files without asking.
                            Commands and deletions are always refused
  -t, --temperature <temp>  Temperature for generation (default: 1)
  -s, --system <message>    Custom system message
  -d, --debug               Enable debug logging to debug-agent.log in current directory
  -h, --help                Display help
  -V, --version             Display version number

Proxy:
  Set HTTPS_PROXY or HTTP_PROXY (e.g. http://proxy:8080 or socks5://proxy:1080)`;

/**
 * Start the interactive terminal chat UI by creating an Agent and rendering the Ink App.
 *
 * Prints the CLI banner, then renders the React/Ink UI and resolves when the UI exits.
 *
 * @param agent - The agent to chat with.
 * @param initialPrompt - Optional message to send as soon as the chat starts.
 */
async function startChat(agent: Agent, initialPrompt?: string): Promise<void> {
  console.log(renderBanner({
    version: getVersion(),
    model: agent.getCurrentModel(),
    cwd: shortenHome(process.cwd()),
  }));
  // Without the kitty keyboard protocol, Shift+Enter arrives as plain Enter.
  const instance = render(React.createElement(App, { agent, initialPrompt }), { kittyKeyboard: { mode: 'auto' } });
  await instance.waitUntilExit();
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  console.error(`Run 'groq --help' for usage.`);
  process.exit(1);
}

function parseOptions() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        print: { type: 'boolean', short: 'p' },
        'allow-edits': { type: 'boolean' },
        temperature: { type: 'string', short: 't', default: '1' },
        system: { type: 'string', short: 's' },
        debug: { type: 'boolean', short: 'd' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'V' },
      },
    });
  } catch (error) {
    // Unknown options throw.
    fail(error instanceof Error ? error.message : String(error));
  }
}

const { values, positionals } = parseOptions();

if (values.help) {
  console.log(HELP);
} else if (values.version) {
  console.log(getVersion());
} else {
  const temperature = parseFloat(values.temperature);
  if (Number.isNaN(temperature)) {
    fail(`temperature must be a number, got '${values.temperature}'`);
  }
  if (values['allow-edits'] && !values.print) {
    fail('--allow-edits only works with --print');
  }
  // Unquoted words are joined, so `groq explain this repo` works without quotes.
  const prompt = positionals.join(' ').trim();

  const cleanupPeriodDays = new ConfigManager().getCleanupPeriodDays(DEFAULT_CLEANUP_PERIOD_DAYS);
  if (cleanupPeriodDays === null) {
    // stderr, so a warning never ends up in the piped output of --print.
    console.error(chalk.yellow('Skipped deleting old transcripts: ~/.groq/local-settings.json could not be read, or its cleanupPeriodDays is not an integer of at least 1'));
  } else {
    cleanupTranscripts(cleanupPeriodDays);
  }

  let agent: Agent;
  try {
    // API key will be checked on first message
    agent = await Agent.create(DEFAULT_MODEL, temperature, values.system || null, values.debug);
  } catch (error) {
    console.log(chalk.red(`Error initializing agent: ${error}`));
    process.exit(1);
  }

  // Closing the terminal or killing the process skips the normal exit, so end the session here.
  // The listener must stay registered (not `once`): ink's signal-exit re-raises the signal,
  // killing the process before the hooks finish, when it finds no other listener.
  let signaled = false;
  for (const signal of ['SIGHUP', 'SIGTERM'] as const) {
    process.on(signal, () => {
      if (signaled) return;
      signaled = true;
      agent.endSession('other').finally(() => process.exit(128 + os.constants.signals[signal]));
    });
  }

  if (values.print) {
    // `cat file | groq -p "summarize"` sends the prompt followed by the file.
    const piped = process.stdin.isTTY ? '' : (await readStdin()).trim();
    const message = [prompt, piped].filter(Boolean).join('\n\n');
    if (!message) fail('--print needs a prompt, as an argument or on stdin');
    process.exitCode = await runHeadless(agent, message, { allowEdits: values['allow-edits'] });
    await agent.endSession('other');
  } else {
    await startChat(agent, prompt || undefined);
    await agent.endSession('prompt_input_exit');
  }
}
