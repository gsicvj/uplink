Uplink

# Uplink – local & remote friendly AI-powered agent

Uplink is a lightweight open-source tool that fuses local filesystem management with optional cloud sync. It combines on-device LLMs (via Ollama) and hosted LLMs (via Groq or other providers) using the @modelcontextprotocol guidelines for extensible tooling.

Runs entirely in the terminal: browse, organise, edit and create files, or upload them to a cloud provider while steering the workflow with natural-language instructions.

By default the agentic loop stays open: the AI keeps accepting new prompts until you type `/bye`, chaining tool calls between questions. Passing `--local` / `--remote` directory arguments only changes which folders the agent can touch—it still runs in interactive chat mode. For single-run mode, start the host with a one-off `--prompt` argument (for example `bun run host.ts --prompt "summarise README.md"`); the host will run the tools it needs, respond once, and exit.

[![CI](https://github.com/gsicvj/uplink/actions/workflows/ci.yml/badge.svg)](https://github.com/gsicvj/uplink/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/gsicvj/uplink/graph/badge.svg)](https://codecov.io/gh/gsicvj/uplink)
[![license](https://img.shields.io/badge/license-[MIT]-blue.svg)](LICENSE)

## Key Features

The project ships with a focused set of integrations and connectors:

- **Terminal Host Application** Runs entirely in the terminal with a guided chat loop.
- **Modular MCP Servers** Ships with filesystem browsing/organising and Bunny CDN storage today, but you can swap in any MCP-compatible implementation.
- **Multi-provider LLM support** Uses local Ollama models and Groq-hosted models out of the box; swap in a different remote provider by changing the import and model reference.
- **Structured Logging** Detailed performance logs for both local and remote agents.
- **Bun Runtime** Built with Bun instead of Node.js (tested on macOS).
- **Model Context Protocol** Implements @modelcontextprotocol client, server, and transport basics.

## Integration

See `SETUP.md` for the full quick-start guide, environment variable expectations, configuration tips, and troubleshooting steps. It covers installing Bun and dependencies, copying `.env.example` to `.env`, configuring `mcp-config.json`, and running the host. Pass allowed directories as host arguments: `--local` for filesystem directories and `--remote` for uplink (CDN) directories—e.g. `bun run host.ts --local assets downloads --remote /`.

### Example of a successful prompt when running a local model:

```text
User: Upload 3 facts about life.
Assistant: Step 1 – Check the allowed local directories.
Assistant: Step 2 – Write a new file (`downloads/life_facts.txt`) with the three facts.
Assistant: Step 3 – Upload that local file to the cloud storage as `life_facts.txt`.

User: Great, thanks!
Assistant: You’re welcome! The file is now safely stored in the cloud.
```

### Example `mcp-config.json`

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "bunx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "vargs": ["relative-to-project-root/", "/or/absolute/path"]
    },
    "uplink": {
      "command": "bun",
      "args": ["run", "servers/cdn/uplink-server.ts"],
      "vargs": ["/", "other/nested/paths/"]
    }
  },
  "providers": {
    "localAgent": {
      "host": "http://localhost:11434",
      "modelId": "gpt-oss:20b",
      "models": ["gpt-oss:20b"]
    },
    "remoteAgent": {
      "host": "https://console.groq.com",
      "modelId": "openai/gpt-oss-20b",
      "models": ["openai/gpt-oss-20b"]
    }
  },
  "agentProvider": "remoteAgent"
}
```

The `providers` map defines all available agents and their models. Set `agentProvider` to one of those provider keys (for example `remoteAgent` or `localAgent`) to choose the default; the active agent and model can still be changed dynamically within the host application. The `vargs` arrays on each MCP server are populated at runtime with the allowed directories you select from the CLI.

## Safety & Risk Disclosure (Use at Your Own Risk)

- **Data Loss**: CRUD operations can permanently delete or overwrite files. Restrict access by setting allowed folders.
- **Security**: Using LLMs will grow the attack surface of your application. Ensure best safety practises. Test locally.
- **Resource Use**: Local LLMs consume CPU/GPU, memory, and disk I/O.
- **Dependencies**: Bugs or vulnerabilities in Ollama, Bun, @modelcontextprotocol, or Bunnynet SDK may affect the system.

## TODO

- [ ] Merge ollama and uplink docker stages into a single stage
- [x] Update UX with external CLI libraries (@clack/prompt and @chalk)
- [x] Use input arguments for run startup commands
- [x] Add .env.example to simplify setting environment variables
- [x] Fix new setup where ENOENT: no such file or directory, open 'logging/local.log'
- [x] Move allowed dirs from mcp-config to host app args
- [x] Implement in-app model selection
- [x] Implement in-app provider selection
- [x] Implement in-app allowed directories selection
- [x] Add unit high and medium value tests
- [x] Simplify config and Zod schemas
- [x] Enter chat mode when no --prompt arg is provided
- [ ] Enable tool toogle or multiple select for allowed/banned
- [ ] Use MCP to handle roots change instead of restarting agent on dirs change
- [ ] Create a user flow, ask what would a user want, and refactor where valuable
- [ ] Treat local agent as Ollama Custom Provider
- [ ] Simplify agents by merging Local and Remote Agent
- [ ] Implement terminal history
- [ ] Provide script argument for local/remote model
- [ ] Train and use a smaller domain specific model

## License

This project is licensed under the [MIT License](LICENSE).
