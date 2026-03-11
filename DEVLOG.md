# Development diary (DEVLOG)

This file serves as a personal diary for ideas, issues and progress with the development of the project.

---

## 11. 03. 2026

TODO: have to make a way to tell agent about required items per server
I'm thinking about { required: { dirs: string[] }}
But what about dynamically added servers, and avoiding hardcoding config.
LLM could in theory react to MCP server error about missing config.

- But that exposes vulnerability, right?
- But what if I limit config changes to only that server.
- I can always ask the user if they want to modify config based on LLM idea.

An app that configures itself during runtime:

- Requires instructions update to format message in special way
- "idea": { message: string, validationSchema: string, serverName: string }
  LLM could:
- Provide idea what to set based on error message ("Server X failed because of Y")
- Propose to set and validate Y for server X
- If allowed it would update config for server X
- BUT IT would have to know to read and send with server config "does it work out of the box?"

## 10. 03. 2026

Thinking of keeping track of allowed directories

- If user provides them at runtime, they should be respected
- Else if user adds them to mcp-config.json, they should be read
- Else tell the user to configure dirs - exit, maybe?

### 19. 07. 2025

## Prompt Engineering

### Promising runtime

From 10+ seconds to 2-3 seconds of understanding commands.

My initial tool descriptions and parameters were too complex.
Was inspired by my pwa project to simplify parameters and descriptions.

Uploading multiple files is fine even with current implementation.
The LLM just called the upload_file command 2 and it was fine.

### Unpredicted behaviour

Sometimes a tool call just hangs and I don't know what's happening.
Prompt "List root on cdn and list static on cdn"
First call on root was successfull.
Second call was infinitely loading, After I clicked skip and continue, it called and infinitely loaded again.

I added a try catch and restarted the server.
Maybe I haven't restarted the server before and it called the list with parameters resulting in infinite loading.
