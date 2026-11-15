#!/usr/bin/env node
import { parseArgs } from 'node:util';
import chalk from 'chalk';
import { render } from 'ink';
import React from 'react';
import { Agent } from './agent.js';
import App from '../ui/App.js';
import { getVersion } from '../utils/version.js';
import { shortenHome } from '../utils/status.js';
import { renderBanner } from '../ui/banner.js';
import { DEFAULT_MODEL } from '../utils/models.js';

const HELP = `Usage: groq [options]

Groq Code CLI

Options:
  -t, --temperature <temp>  Temperature for generation (default: 1)
  -s, --system <message>    Custom system message
  -d, --debug               Enable debug logging to debug-agent.log in current directory
  -p, --proxy <url>         Proxy URL (e.g. http://proxy:8080 or socks5://proxy:1080)
  -h, --help                Display help
  -V, --version             Display version number`;

/**
 * Start the interactive terminal chat UI by creating an Agent and rendering the Ink App.
 *
 * Initializes an AI agent with the given temperature, optional system prompt, debug mode, and optional proxy,
 * validates the proxy URL (if provided), prints the CLI banner, then renders the React/Ink UI. On invalid proxy
 * or on initialization errors the process exits with code 1.
 *
 * @param temperature - Sampling temperature used for model generation.
 * @param system - Optional system message to seed the agent's context; pass `null` to use defaults.
 * @param debug - When true, enables debug logging for the agent.
 * @param proxy - Optional proxy URL to route requests through (e.g., `http://proxy:8080` or `socks5://proxy:1080`).
 */
async function startChat(
  temperature: number,
  system: string | null,
  debug?: boolean,
  proxy?: string
): Promise<void> {
  // Validate proxy URL if provided
  if (proxy) {
    try {
      new URL(proxy);
    } catch (error) {
      // Don't display the actual URL in case it contains credentials
      console.log(chalk.red('Invalid proxy URL provided'));
      console.log(chalk.yellow('Proxy URL must be a valid URL (e.g., http://proxy:8080 or socks5://proxy:1080)'));
      process.exit(1);
    }
  }
  
  try {
    // Create agent (API key will be checked on first message)
    const agent = await Agent.create(DEFAULT_MODEL, temperature, system, debug, proxy);

    console.log(renderBanner({
      version: getVersion(),
      model: agent.getCurrentModel(),
      cwd: shortenHome(process.cwd()),
    }));
    render(React.createElement(App, { agent }));
  } catch (error) {
    console.log(chalk.red(`Error initializing agent: ${error}`));
    process.exit(1);
  }
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  console.error(`Run 'groq --help' for usage.`);
  process.exit(1);
}

function parseOptions() {
  try {
    return parseArgs({
      options: {
        temperature: { type: 'string', short: 't', default: '1' },
        system: { type: 'string', short: 's' },
        debug: { type: 'boolean', short: 'd' },
        proxy: { type: 'string', short: 'p' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'V' },
      },
    }).values;
  } catch (error) {
    // Unknown options and stray positional arguments throw.
    fail(error instanceof Error ? error.message : String(error));
  }
}

const values = parseOptions();

if (values.help) {
  console.log(HELP);
} else if (values.version) {
  console.log(getVersion());
} else {
  const temperature = parseFloat(values.temperature);
  if (Number.isNaN(temperature)) {
    fail(`temperature must be a number, got '${values.temperature}'`);
  }
  await startChat(temperature, values.system || null, values.debug, values.proxy);
}
