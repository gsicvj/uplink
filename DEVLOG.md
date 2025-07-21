# Development diary (DEVLOG)

This file serves as a personal diary for ideas, issues and progress with the development of the project.

---

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
