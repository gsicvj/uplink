import { getConfig } from "./lib/get-mcp-config";
import { isCancel, log, outro, text } from "@clack/prompts";
import { getDirsFromArgs, type AllowedDirs } from "./lib/get-dirs-from-args";
import { z } from "zod";
import { FILESYSTEM_MCP, UPLINK_MCP } from "./lib/connect-to-mcp-servers";
import { connectAgentServer, initAgent, type UplinkAgent } from "./lib/host-agent";
import { actions } from "./lib/host-prompts";
import type { McpConfig } from "./config-validation";

let agent: UplinkAgent;
let dataMCP: Awaited<ReturnType<typeof connectAgentServer>>;

async function main() {
  const config = await getConfig();
  const { localDirs, remoteDirs } = await getDirsFromArgs(Bun.argv);
  const allowedDirs = {
    localDirs: localDirs.length > 0 ? localDirs : config.mcpServers[FILESYSTEM_MCP]!.vargs,
    remoteDirs: remoteDirs.length > 0 ? remoteDirs : config.mcpServers[UPLINK_MCP]!.vargs
  }
  await chatLoop(config, allowedDirs);
  process.exit(0);
}

async function chatLoop(
  config: McpConfig,
  allowedDirs: AllowedDirs
) {
  dataMCP = await connectAgentServer(config.providers, config.agentProvider, allowedDirs);
  const { remoteClients, localClients, disconnectFromMCPServers } = dataMCP;
  agent = await initAgent(config.providers, config.agentProvider, remoteClients, localClients);
  await agent.start();

  while (true) {
    try {
      const line = await text({
        message: "User:",
      });

      if (isCancel(line) || line === "/bye") {
        // user wants to exit the chat
        outro("Bye!");
        return;
      }

      if (line === "/config") {
        const action = actions["config"];
        await action({
          agent,
          getConfig,
          initAgent: async (newConfig: McpConfig) => {
            const newAllowedDirs: AllowedDirs = {
              localDirs: newConfig.mcpServers[FILESYSTEM_MCP]!.vargs,
              remoteDirs: newConfig.mcpServers[UPLINK_MCP]!.vargs
            }

            const newDataMCP = await connectAgentServer(
              newConfig.providers,
              newConfig.agentProvider,
              newAllowedDirs
            )

            const newAgent = await initAgent(
              newConfig.providers,
              newConfig.agentProvider,
              newDataMCP.remoteClients,
              newDataMCP.localClients
            )

            return newAgent;
          },
          setAgent: (newAgent: UplinkAgent) => {
            agent = newAgent;
          }
        })
        continue;
      }

      else {
        const result = await agent.solve(String(line));

        if (result.error) {
          log.error(`Error: ${result.error}`);
        }

        const config = await getConfig();
        if (config.isChatEnabled === false) {
          break;
        }
      }
    } catch (error) {
      log.error(`Unexpected error: ${error}`);
    }
  }

  await disconnectFromMCPServers();
}

main().catch((error) => {
  let message: string;
  if (typeof z !== "undefined" && error instanceof z.ZodError) {
    const firstIssue = error.issues[0];
    if (firstIssue) {
      const path = firstIssue.path.join(".");
      const issueMessage = firstIssue.message || "Invalid value.";
      message = path ? `Validation error at "${path}": ${issueMessage}` : `Validation error: ${issueMessage}`;
    } else {
      message = "Validation failed due to an unknown error.";
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }
  log.warn(`The host application encountered an error: ${message}`);
  outro(`The application exited.`);
  process.exit(1);
});
