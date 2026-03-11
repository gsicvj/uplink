# Setup Guide - Uplink

## Quick Start

1. **Install Bun** to run TypeScript code: `curl -fsSL https://bun.sh/install | bash`

2. **Install dependencies** to get required packages:

   ```bash
   bun install
   bun add @modelcontextprotocol/server-filesystem
   ```

3. **Create directories** to enable file operations and logs: `mkdir -p assets downloads logging`

4. **Get a Groq API key** to access free LLM inference: Register for a free trial account at [console.groq.com](https://console.groq.com) and copy your API key

5. **Create `.env` file**: Copy `.env.example` to `.env` and add at least one LLM API key (and any other keys you need).

6. **Configure `mcp-config.json`** to choose your LLM provider:

   - Copy `mcp-config.example.json` to `mcp-config.json`.
   - Under `"providers"`, set `remoteAgent.modelId` to a Groq model (for example `openai/gpt-oss-20b`) and `localAgent.modelId` to an installed Ollama model (for example `gpt-oss:20b`).
   - Use the `"models"` arrays on each provider to list all available model IDs you want to select from in the app.
   - Set `"agentProvider": "remoteAgent"` or `"localAgent"` to pick which provider is used by default; you can still switch provider and model from within the host.

7. **(Optional) Pick a different remote LLM provider** if you already have access to one:

   - Browse the [AI SDK provider catalog](https://ai-sdk.dev/providers/ai-sdk-providers/openai) to find a compatible provider and note the install instructions.
   - Update `agents/remote-agent.ts` so the `model` field uses that provider's SDK export instead of Groq (for example `openai(this.config.modelId)` after importing `{ openai } from "@ai-sdk/openai"`).
   - Set `providers.remoteAgent.modelId` in `mcp-config.json` to a model offered by that provider.

8. **(Optional) Install Ollama** to run local LLMs:

   ```bash
   # Install: brew install ollama (macOS) or visit ollama.com
   ollama serve  # Start service
   ollama pull gpt-oss:20b  # Pull this model (preferably)
   ollama pull llama3.1:8b  # Pull this model (if limited with hardware)
   ```

9. **Run the application** to start the agent:

   ```bash
   bun run host.ts --local assets downloads --remote /
   ```

   Use `--local` for allowed filesystem directories and `--remote` for allowed uplink (CDN) directories. If you also pass a `--prompt "your question"` argument, the host will run in single-run (oneshot) mode: it will answer once and then exit. Without `--prompt`, it stays in interactive chat mode until you type `/bye`.

## Troubleshooting

- **Missing API key errors**: Check your `.env` file has the required keys
- **Ollama connection failed**: Run `ollama serve` in a separate terminal
- **Permission errors**: Run `chmod -R 755 assets downloads`
- **MCP server errors**: Test with `bunx @modelcontextprotocol/server-filesystem assets`
