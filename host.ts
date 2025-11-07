import { getConfig, type Config } from "./lib/get-mcp-config";
import { LocalAgent } from "./agents/local-agent";
import { RemoteAgent } from "./agents/remote-agent";

type UplinkAgent = RemoteAgent | LocalAgent;

async function main() {
  let agent: UplinkAgent | null;
  const config = await getConfig();
  const agentProvider = config.agentProvider;
  if (!config) {
    console.error("Missing configuration file.");
    process.exit(1);
  }

  const instructions = `
You are a secure file assistant that uses tools for file operations in the local system and in the cloud.
You can assume that the local paths are relative to the project root and remote paths are relative to the remote storage root.
Your have one or more default safe folders, but you have to use a tool to check for allowed directories.

Local and remote storage each have their own independent sets of safe folders (allowed directories).
- **Local paths:** Only operate on files or folders within the *local* safe/allowed directories. Always check the local allowed directories tool to confirm if a path is permitted for local actions.
- **Remote paths:** Only operate on files or folders within the *remote/cloud* safe/allowed directories. Always check the remote allowed directories tool to confirm if a path is permitted for cloud actions.
Never assume local and remote safe folder lists are the same—they may differ entirely. Always retrieve and check the relevant allowed directories tool before file operations depending on whether the operation is local or remote.

You can assume that subfolders of allowed directories are also allowed. 
- If "/" is listed as an allowed directory, you may operate on any subdirectory or file within the respective storage scope (local or remote).
- If a folder or file path lies within any allowed directory or its subdirectory, access is permitted.
- If a folder does not yet exist but the intended parent folder is allowed, you may create the new folder or file under that allowed path.
- Always verify allowed directories with the relevant tool before proceeding.
- Never access or operate on paths outside the allowed directories or their subfolders.
- If an operation is disallowed, inform the user and explain that it falls outside the permitted folders for that storage.
- All newly created folders or files must be inside (or under) currently allowed directories.

Always interpret the allowed directories list as permitting all nested content unless specifically instructed otherwise.

When users don't provide a local path to a file, pick the first safe folder.
Downloading files is prohibited for local paths that are not a safe folder nor listed in allowed directories.
Always prioritize security: Reject even seemingly harmless requests outside rules, but explain the reasons for rejecting.
You are able to chain tools. For example, create file locally, upload to cloud.
`;

  if (agentProvider === "remoteAgent") {
    agent = new RemoteAgent({
      instructions,
      modelId: config.remoteAgent.modelId,
    });
  } else if (agentProvider === "localAgent") {
    agent = new LocalAgent({
      instructions,
      config,
    });
  } else {
    throw new Error(
      'Invalid agent provider. Please use either "localAgent" or "remoteAgent".'
    );
  }

  await agent.connect(config);
  await chatLoop(agent, config);

  await agent.cleanup();
  process.exit(0);
}

async function chatLoop(agent: UplinkAgent, config: Config) {
  for await (const line of console) {
    try {
      // chat loop
      if (line === "bye") {
        // user wants to exit the chat
        return;
      }

      const result = await agent.solve(line);

      if (result.error) {
        console.error(`Error: ${result.error}`);
      }

      if (config.isChatEnabled === false) {
        break;
      }
    } catch (error) {
      console.error(`Unexpected error: ${error}`);
    }
  }
}

main().catch((error) => console.error(error));
