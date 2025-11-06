# Uplink - local filesystem and cloud friendly AI-powered agent

A lightweight open-source tool that fuses local filesystem management with cloud sync, powered by Ollama for on-device LLM integration build on the @modelcontextprotocol client-server guidelines.

Runs in terminal. You can browse, edit and create files locally, or upload them to any cloud provider while giving instructions in natural language leveraging AI-powered agents.

The agentic loop will run only once: the AI will set a goal based on your prompt, call tools until it reaches a solution and respond with a result message and exit the process.

[![license](https://img.shields.io/badge/license-[MIT]-blue.svg)](LICENSE)

## Key Features

The project supports only a few integrations and connectors at this time:

- **Host Application** The example host application runs in terminal.
- **Local Filesystem Explorer** If host application is used, it will use a filesystem MCP server.
- **Cloud Upload** Contains custom unofficial MCP server implementation for bunnycdn.
- **Ollama-powered LLM integration** Access local, open-source large language models via Ollama.
- **Bun Runtime** Built with Bun instead of Node.js
- **Model Context Protocol** Implements the @modelcontextprotocol Client, Server, Transport.
- **CLI & API** Running and interfacing with the host application via local terminal.

## Integration

To bootstrap the host application:

- install dependencies from `package.json`
- install `ollama` to your operating system
- instal open-source models (here's a repo: [huggingface](https://huggingface.co/models))
- create `mcp-config.json`
- create `.env` file and setup project secrets (customize `env.ts` as needed)

To run the application: `bun run host.ts`

Example of a successful prompt when running `gpt-oss` model.

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

### Example mcp-config.json

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "bunx",
      "args": ["mcp-server-filesystem", "assets"]
    },
    "uplink": {
      "command": "bun",
      "args": ["run", "servers/cdn/uplink-server.ts"],
      "env": {
        "BUNNY_STORAGE_ZONE_NAME": "storage-zone-name",
        "BUNNY_STORAGE_ACCCES_KEY": "read-write-access-key"
      }
    }
  },
  "ollama": {
    "host": "http://localhost:11434",
    "model": "gpt-oss:20b"
  },
  "openai": {
    "host": "https://todo.dev",
    "model": "gpt-4.1"
  }
}
```

## Safety & Risk Disclosure (Use at Your Own Risk)

- **Data Loss**: CRUD operations can permanently delete or overwrite files. Restrict access by setting allowed folders.
- **Security**: Using LLMs will grow the attack surface of your application. Ensure best safety practises. Test locally.
- **Resource Use**: Local LLMs consume CPU/GPU, memory, and disk I/O.
- **Dependencies**: Bugs or vulnerabilities in Ollama, Bun, @modelcontextprotocol, or Bunnynet SDK may affect the system.

## TODO / Roadmap

- [x] Add support for external LLMs by using Open AI SDK
- [x] Add additional custom servers for other cloud providers
- [x] Add mime type when uploading text files to cloud

## License

This project is licensed under the [MIT License](LICENSE).
