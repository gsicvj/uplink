# Setup Guide - Uplink

## Quick Start

1. **Install Bun** to run TypeScript code: `curl -fsSL https://bun.sh/install | bash`

2. **Install dependencies** to get required packages:

   ```bash
   bun install
   bun add @modelcontextprotocol/server-filesystem
   ```

3. **Create directories** to enable file operations: `mkdir -p assets downloads`

4. **Get a Groq API key** to access free LLM inference: Register for a free trial account at [console.groq.com](https://console.groq.com) and copy your API key

5. **Create `.env` file** to configure API keys (add at least one LLM API key):

   ```env
   GROQ_API_KEY=your_key_here
   BUNNY_API_KEY=your_key_here
   BUNNY_STORAGE_ZONE_NAME=your_zone
   BUNNY_STORAGE_ACCESS_KEY=your_access_key
   BUNNY_PULLZONE_URL=https://your-pullzone.b-cdn.net
   ```

6. **Configure `mcp-config.json`** to choose your LLM provider:

   - Set `"agentProvider": "remoteAgent"` to use cloud LLMs (OpenAI, Anthropic, etc.)
   - Set `"agentProvider": "localAgent"` to use Ollama (requires step 7)
   - Keep `"isChatEnabled": true` to allow the agent to respond conversationally and explain its actions

7. **(Optional) Install Ollama** to run local LLMs:

   ```bash
   # Install: brew install ollama (macOS) or visit ollama.com
   ollama serve  # Start service
   ollama pull gpt-oss:20b  # Pull this model (preferably)
   ollama pull llama3.1:8b  # Pull this model (if limited with hardware)
   ```

8. **Run the application** to start the agent: `bun run host.ts`

## Troubleshooting

- **Missing API key errors**: Check your `.env` file has the required keys
- **Ollama connection failed**: Run `ollama serve` in a separate terminal
- **Permission errors**: Run `chmod -R 755 assets downloads`
- **MCP server errors**: Test with `bunx mcp-server-filesystem assets`
