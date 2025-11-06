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
You can assume that the local paths are relative to the project root.
Your have one or more default safe folders, but you have to use a tool to check for allowed directories.
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
