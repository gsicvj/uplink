# Uplink – local & remote friendly AI-powered agent

Uplink is a lightweight open-source tool that fuses local filesystem management with optional cloud sync. It combines on-device LLMs (via Ollama) and hosted LLMs (via Groq or other providers) using the @modelcontextprotocol guidelines for extensible tooling.

Runs entirely in the terminal: browse, organise, edit and create files, or upload them to a cloud provider while steering the workflow with natural-language instructions.

By default the agentic loop stays open (`isChatEnabled` defaults to `true`): the AI keeps accepting new prompts until you type `bye`, chaining tool calls between questions. Set `isChatEnabled` to `false` for single-run mode, where the agent takes your prompt, calls MCP tools until it reaches a solution, responds, and exits.

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

See `SETUP.md` for the full quick-start guide, environment variable expectations, configuration tips, and troubleshooting steps. It covers everything from installing Bun and dependencies through configuring `mcp-config.json`, adjusting `env.ts`, and running `bun run host.ts`.

Example of a successful prompt when running a local model:

```text
User:
Upload 3 facts about life

Assistant:
Allowed directories: /absolute/path/uplink/assets

Assistant:
Successfully wrote to /absolute/path/uplink/assets/sun_facts.txt

Assistant:
The file **sun_facts.txt** containing three facts about the Sun has been uploaded to the cloud.
```

### Example `mcp-config.json`

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "bunx",
      "args": ["@modelcontextprotocol/server-filesystem", "assets", "downloads"]
    },
    "uplink": {
      "command": "bun",
      "args": ["run", "servers/cdn/uplink-server.ts", "/"]
    }
  },
  "localAgent": {
    "host": "http://localhost:11434",
    "modelId": "gpt-oss:20b"
  },
  "remoteAgent": {
    "host": "https://console.groq.com",
    "modelId": "openai/gpt-oss-20b"
  },
  "agentProvider": "localAgent",
  "isChatEnabled": true
}
```

Set `agentProvider` to `remoteAgent` or `localAgent` depending on which provider you want to use by default. Both agents can still be selected dynamically within the host application.

## Safety & Risk Disclosure (Use at Your Own Risk)

- **Data Loss**: CRUD operations can permanently delete or overwrite files. Restrict access by setting allowed folders.
- **Security**: Using LLMs will grow the attack surface of your application. Ensure best safety practises. Test locally.
- **Resource Use**: Local LLMs consume CPU/GPU, memory, and disk I/O.
- **Dependencies**: Bugs or vulnerabilities in Ollama, Bun, @modelcontextprotocol, or Bunnynet SDK may affect the system.

## License

This project is licensed under the [MIT License](LICENSE).
