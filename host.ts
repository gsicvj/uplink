import { getConfig, type Config } from "./lib/get-mcp-config";
import { LocalAgent } from "./agents/local-agent";
import { RemoteAgent } from "./agents/remote-agent";
import { HOST_INSTRUCTIONS } from "./host-instructions";

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

  if (agentProvider === "remoteAgent") {
    agent = new RemoteAgent({
      instructions: HOST_INSTRUCTIONS,
      modelId: config.remoteAgent.modelId,
      allowedDirs
    });
  } else if (agentProvider === "localAgent") {
    agent = new LocalAgent({
      instructions: HOST_INSTRUCTIONS,
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