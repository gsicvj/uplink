import { getConfig, type Config } from "./lib/get-mcp-config";
import { LocalAgent } from "./agents/local-agent";
import { RemoteAgent } from "./agents/remote-agent";
import { cancel, isCancel, log, outro, text } from "@clack/prompts";
import { getDirsFromArgs } from "./lib/get-dirs-from-args";

type UplinkAgent = RemoteAgent | LocalAgent;

async function main() {
  let agent: UplinkAgent | null;
  const allowedDirs = await getDirsFromArgs(Bun.argv);
  const config = await getConfig();
  const agentProvider = config.agentProvider;
  if (!config) {
    log.error("Missing configuration file.");
    process.exit(1);
  }

  const instructions = `
You are a secure file assistant that uses tools for file operations in the local system and in the cloud.
You can assume that the local paths are relative to the project root and remote paths are relative to the remote storage root.
Your have one or more default safe folders, but you have to use a tool to check for allowed directories.

Local and remote storage have separate allowed folders. Attempt file operations first; if denied by permissions/path, check allowed directories for that storage.
Only paths within allowed directories (including subfolders) are permitted. Do not assume local and remote folders match.
Only check allowed lists after a relevant error. New files/folders must be created inside allowed directories.

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
      allowedDirs
    });
  } else if (agentProvider === "localAgent") {
    agent = new LocalAgent({
      instructions,
      config,
      allowedDirs
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
  while (true) {
    try {
      const line = await text({
        message: "User:",
      });

      if (isCancel(line)) {
        cancel('Operation cancelled.');
        outro("Bye!");
        process.exit(0);
      }

      // chat loop
      if (line === "bye") {
        // user wants to exit the chat
        outro("Bye!");
        return;
      }

      const result = await agent.solve(String(line));

      if (result.error) {
        log.error(`Error: ${result.error}`);
      }

      if (config.isChatEnabled === false) {
        break;
      }
    } catch (error) {
      log.error(`Unexpected error: ${error}`);
    }
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : String(error);
  log.warn(`The host application encountered an error: ${message}`);
  outro(`The application exited.`);
  process.exit(1);
});