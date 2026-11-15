<h2 align="center">
 <br>
 <img src="docs/thumbnail.png" alt="Groq Code CLI" width="400">
 <br>
 <br>
 Groq Code CLI: A highly customizable, lightweight, and open-source coding CLI powered by Groq for instant iteration.
 <br>
</h2>

<p align="center">
 <a href="https://github.com/build-with-groq/groq-code-cli/stargazers"><img src="https://img.shields.io/github/stars/build-with-groq/groq-code-cli"></a>
 <a href="https://github.com/build-with-groq/groq-code-cli/blob/main/LICENSE">
 <img src="https://img.shields.io/badge/License-MIT-green.svg">
 </a>
</p>

<p align="center">
 <a href="#Overview">Overview</a> •
 <a href="#Installation">Installation</a> •
 <a href="#Usage">Usage</a> •
 <a href="#Development">Development</a>
</p>

<br>

https://github.com/user-attachments/assets/5902fd07-1882-4ee7-825b-50d627f8c96a

<br>

# Overview

Coding CLIs are everywhere. The Groq Code CLI is different. It is a blueprint, a building block, for developers looking to leverage, customize, and extend a CLI to be entirely their own. Leading open-source CLIs are all fantastic, inspiring for the open-source community, and hugely rich in features. However, that's just it: they are *gigantic*. Feature-rich: yes, but local development with such a large and interwoven codebase is unfriendly and overwhelming. **This is a project for developers looking to dive in.**

Groq Code CLI is your chance to make a CLI truly your own. Equipped with all of the features, tools, commands, and UI/UX that’s familiar to your current favorite CLI, we make it simple to add new features you’ve always wanted. By massively cutting down on bloat and code mass without compromising on quality, you can jump into modifying this CLI however you see fit. By leveraging models on Groq, you can iterate even faster (`/model` to see available models). Simply activate the CLI by typing `groq` in your terminal. Use Groq Code CLI in any directory just like you would with any other coding CLI. Use it in this directory to have it build and customize itself!

A few customization ideas to get started:
- New slash commands (e.g. /mcp, /deadcode, /complexity, etc.)
- Additional tools (e.g. web search, merge conflict resolver, knowledge graph builder, etc.)
- Custom start-up ASCII art
- Change the start-up command
- Anything you can think of!


## Installation

### For Development (Recommended)
```bash
git clone https://github.com/build-with-groq/groq-code-cli.git
cd groq-code-cli
npm install
npm run build
npm link        # Enables the `groq` command in any directory
```

```bash
# Run this in the background during development to automatically apply any changes to the source code
npm run dev  
```

### Run Instantly
```bash
# Using npx, no installation required
npx groq-code-cli@latest
```

### Install Globally
```bash
npm install -g groq-code-cli@latest
```

## Usage
```bash
# Start chat session
groq

# Start chat session and send a first message
groq "explain this repository"

# Answer without the chat UI and print only the reply
groq -p "explain this repository"
git diff | groq -p "write a commit message for this diff"
```

### Command Line Options

```bash
groq [options] [prompt]

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
```

### Headless Mode

`-p` / `--print` runs a single prompt without the chat UI. Only the final reply goes to stdout, so it can be piped; tool calls, intermediate text and errors go to stderr. The exit code is 1 when the request fails or stops at the tool iteration limit.

Tools that need approval in the chat UI are refused, because there is no one to ask. `--allow-edits` lets the model create and edit files; running commands and deleting files are always refused in headless mode.

### Authentication

On first use, start a chat:

```bash
groq
```

And type the `/login` command:

![Login](docs/login.png)
>Get your API key from the <strong>Groq Console</strong> [here](https://console.groq.com/keys)

This creates a .groq/ folder in your home directory that stores your API key, default model selection, the reasoning effort chosen for each model, and any other config you wish to add.

You can also set your API key for your current directory via environment variable:
```bash
export GROQ_API_KEY=your_api_key_here
```

### Instruction Files

At startup, `AGENTS.md` and `CLAUDE.md` are added to the conversation as instructions, from these directories in order:

1. `~/.groq/` - instructions for every project, such as the language to reply in
2. The current directory - instructions for the project

Later files take precedence. A `CLAUDE.md` symlinked to `AGENTS.md` is read once. The instructions apply with `--system` too.

### Proxy Configuration

Supports HTTP/HTTPS/SOCKS5 proxies via environment variables:

```bash
export HTTP_PROXY=http://proxy:8080
export HTTPS_PROXY=socks5://proxy:1080
```

Priority: `HTTPS_PROXY` > `HTTP_PROXY`

### Session Transcripts

Each session is saved as JSONL to `~/.groq/projects/<project>/<session-id>.jsonl`, where `<project>` is the working directory with every non-alphanumeric character replaced by `-`. The layout follows Claude Code's transcripts in `~/.claude/projects/`, so tools that read those, such as Markdown exporters, can read these too. Every entry carries `"agent": "groq-code-cli"` to tell them apart. `/clear` starts a new session file, and each `--print` run is a session of its own.

The file is created on the first message and is readable by the owner only. It holds everything sent to and returned by tools, including file contents and command output.

Transcripts last written more than 30 days ago are deleted at startup. To change the period, set `cleanupPeriodDays` (an integer of at least 1) in `~/.groq/local-settings.json`:

```json
{
  "cleanupPeriodDays": 60
}
```

If the file cannot be read or the value is invalid, nothing is deleted.

### Hooks

Commands in `hooks.SessionEnd` of `~/.groq/local-settings.json` run when a session ends, in the same format as Claude Code's hooks. Only the `SessionEnd` event and `command` hooks are supported:

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": "clear|prompt_input_exit",
        "hooks": [{ "type": "command", "command": "~/bin/on-session-end.sh", "timeout": 1.5 }]
      }
    ]
  }
}
```

Each command runs through the shell in the session's working directory and receives this JSON on stdin:

```json
{
  "session_id": "...",
  "transcript_path": "/Users/you/.groq/projects/<project>/<session-id>.jsonl",
  "cwd": "...",
  "hook_event_name": "SessionEnd",
  "reason": "prompt_input_exit"
}
```

| `reason` | When |
|---|---|
| `clear` | `/clear` ends the session and starts a new one |
| `prompt_input_exit` | `/exit`, `exit` or Ctrl+C |
| `other` | The process receives SIGHUP (the terminal is closed) or SIGTERM |

`matcher` follows Claude Code's rules: omitted, `""` or `"*"` matches every reason; a value made only of letters, digits, `_`, `-`, spaces, `,` and `|` lists exact reasons separated by `|` or `,`; anything else is an unanchored regular expression. Output is discarded, and a command still running after `timeout` seconds (default 1.5, at most 60) is killed, so a hook with more to do should run that part in the background.

### Available Commands
- `/help` - Show help and available commands
- `/login` - Login with your credentials
- `/model` - Select from the models Groq currently serves, fetched at startup; a saved model that Groq has removed is switched to `openai/gpt-oss-120b`
- `/clear` - Clear chat history and context
- `/reasoning` - Toggle display of reasoning content in messages
- `/effort [value]` - Show or set the reasoning effort sent to models that take one (`/effort auto` stops sending it); saved per model
- `/stats` - Display session statistics and token usage
- `/copy [N]` - Copy the latest reply, or the Nth-latest; a reply with code blocks opens a picker for the whole reply or one block
- `/copy-pick` - Pick an earlier reply from a list and copy it
- `/exit` - Exit the application (typing `exit` also works)

`/copy` and `/copy-pick` write to the clipboard with `pbcopy`, `clip`, `wl-copy`, `xclip` or `xsel`. Over SSH, or when none of them is available, they send the text to the terminal with OSC 52 instead, which the terminal must allow (in iTerm2: "Applications in terminal may access clipboard").

### Status Line

Two lines under the input box show the session at a glance:

```
 openai/gpt-oss-120b (high) | Git: main (+12,-3)
 Ctx: 12.8k (9.8%) | $0.0023 | Tokens: 12.8k ( 12k / 800 ) | TPM left: 241.5k/250k | RPD left: 997/1000
```

- Model, with the reasoning effort set by `/effort`
- Git branch and uncommitted line changes against `HEAD`, when started inside a repository
- `Ctx`: tokens used by the latest request, with the share of the context window Groq reports for the model
- Estimated session cost, for models with prices in `src/utils/models.ts`
- Session tokens in total ( input / output )
- Remaining tokens per minute and requests per day, from the rate limit headers of the latest response


## Development

### Testing Locally
```bash
# Run this in the background during development to automatically apply any changes to the source code
npm run dev  
```

### Available Scripts
```bash
npm run build      # Build TypeScript to dist/
npm run dev        # Build in watch mode
npm test           # Run the tests
```

### Project Structure

```
groq-code-cli/
├── src/
│   ├── commands/           
│   │   ├── definitions/        # Individual command implementations
│   │   │   ├── clear.ts        # Clear chat history command
│   │   │   ├── copy.ts         # Copy reply commands (/copy, /copy-pick)
│   │   │   ├── effort.ts       # Reasoning effort command
│   │   │   ├── exit.ts         # Exit command
│   │   │   ├── help.ts         # Help command
│   │   │   ├── init.ts         # Project context generation command
│   │   │   ├── login.ts        # Authentication command
│   │   │   ├── model.ts        # Model selection command
│   │   │   ├── reasoning.ts    # Reasoning toggle command
│   │   │   └── stats.ts        # Session statistics command
│   │   ├── base.ts             # Base command interface
│   │   └── index.ts            # Command exports
│   ├── core/               
│   │   ├── agent.ts            # AI agent implementation
│   │   ├── cli.ts              # CLI entry point and setup
│   │   └── headless.ts         # --print mode without the TUI
│   ├── tools/              
│   │   ├── tool-schemas.ts     # Tool schema definitions
│   │   ├── tools.ts            # Tool implementations
│   │   └── validators.ts       # Input validation utilities
│   ├── ui/                 
│   │   ├── App.tsx             # Main application component
│   │   ├── banner.ts           # Start-up banner
│   │   ├── theme.ts            # Shared colors
│   │   ├── components/     
│   │   │   ├── core/           # Core chat TUI components
│   │   │   ├── display/        # Auxiliary components for TUI display
│   │   │   └── input-overlays/ # Input overlays and modals that occupy the MessageInput box
│   │   └── hooks/          
│   └── utils/              
│       ├── clipboard.ts        # Clipboard access for /copy
│       ├── constants.ts        # Application constants
│       ├── context.ts          # Project context generation for /init
│       ├── file-ops.ts         # File system operations
│       ├── hooks.ts            # SessionEnd hooks
│       ├── local-settings.ts   # Local configuration management
│       ├── markdown.ts         # Markdown processing utilities
│       ├── models.ts           # Models from the API, with names, prices and reasoning efforts
│       ├── proxy-config.ts     # Proxy resolution
│       ├── replies.ts          # Reply and code block extraction for /copy
│       ├── status.ts           # Status line data (git, rate limits, formatting)
│       ├── transcript.ts       # Session transcripts and their cleanup
│       └── version.ts          # Version string with build info
├── docs/                   
├── scripts/                    # Build helpers
├── test/                       # Tests (ava)
├── package.json    
├── tsconfig.json        
└── LICENSE          
```

**TL;DR:** Start with `src/core/cli.ts` (main entry point), `src/core/agent.ts`, and `src/ui/hooks/useAgent.ts` (bridge between TUI and the agent). Tools are in `src/tools/`, slash commands are in `src/commands/definitions/`, and customize the TUI in `src/ui/components/`.

### Customization

#### Adding New Tools

Tools are AI-callable functions that extend the CLI's capabilities. To add a new tool:

1. **Define the tool schema** in `src/tools/tool-schemas.ts`:
```typescript
export const YOUR_TOOL_SCHEMA: ToolSchema = {
  type: 'function',
  function: {
    name: 'your_tool_name',
    description: 'What your tool does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Parameter description' }
      },
      required: ['param1']
    }
  }
};
```

2. **Implement the tool function** in `src/tools/tools.ts`:
```typescript
export async function yourToolName(param1: string): Promise<ToolResult> {
  // Your implementation here
  return createToolResponse(true, result, 'Success message');
}
```

3. **Register the tool** in the `TOOL_REGISTRY` object and `executeTool` switch statement in `src/tools/tools.ts`.

4. **Add the schema** to `ALL_TOOL_SCHEMAS` array in `src/tools/tool-schemas.ts`.

#### Adding New Slash Commands

Slash commands provide direct user interactions. To add a new command:

1. **Create command definition** in `src/commands/definitions/your-command.ts`:
```typescript
import { CommandDefinition, CommandContext } from '../base.js';

export const yourCommand: CommandDefinition = {
  command: 'yourcommand',
  description: 'What your command does',
  handler: ({ addMessage }: CommandContext) => {
    // Your command logic here
    addMessage({
      role: 'system',
      content: 'Command response'
    });
  }
};
```

Text typed after the command name arrives as `args` in the context (for `/copy 2`, `args` is `'2'`).

2. **Register the command** in `src/commands/index.ts` by importing it and adding to the `availableCommands` array.

#### Changing Start Command
To change the start command from `groq`, change `"groq"` in `"bin"` of `package.json` to your global command of choice.

Re-run `npm run build` and `npm link`.


## Contributing and Support

Improvements through PRs are welcome!

For issues and feature requests, please open an issue on GitHub.

#### Share what you create with Groq on our [socials](https://x.com/GroqInc)!

### Featured Community Creations
- [OpenRouter Support](https://github.com/rahulvrane/groq-code-cli-openrouter) - rahulvrane
