import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "../client/client";
import { log } from "@clack/prompts";
import {
  experimental_createMCPClient as createMCPClient,
  type experimental_MCPClient as MCPClient,
} from "ai";
import type { AllowedDirs } from "./get-dirs-from-args";
import { getConfig } from "./get-mcp-config";

export const FILESYSTEM_MCP = "filesystem";
export const UPLINK_MCP = "uplink";

export type ToolType = Awaited<ReturnType<MCPClient["tools"]>>;

export function getClientArgs(serverName: string, serverArgs: string[], allowedDirs: AllowedDirs): string[] {
  let clientArgs: string[] = [];
  if (serverName === FILESYSTEM_MCP) {
    if (allowedDirs.localDirs.length === 0) {
      log.warn(
        `No allowed directories were provided for the MCP server "${serverName}". ` +
        `The ${serverName} server may fail to start or have limited functionality. ` +
        `Please specify at least one local directory to allow access.`
      );
    }
    clientArgs = serverArgs.concat(allowedDirs.localDirs);
  } else if (serverName === UPLINK_MCP) {
    if (allowedDirs.remoteDirs.length === 0) {
      log.warn(`No allowed directories were provided for the MCP server "${serverName}" . ` +
        `The ${serverName} server may fail to start or have limited functionality. ` +
        `Please specify at least one remote directory to allow access.`);
    }
    clientArgs = serverArgs.concat(allowedDirs.remoteDirs);
  } else {
    clientArgs = serverArgs;
  }
  return clientArgs;
}

export async function connectToMCPServers(allowedDirs: AllowedDirs) {
  const config = await getConfig();
  const tools = [];
  const clients: Map<string, Client> = new Map();
  const toolMap: Map<string, Client> = new Map();

  // Connect to all servers first
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const clientArgs = getClientArgs(serverName, serverConfig.args, allowedDirs);
      const client = new Client({
        serverName,
        command: serverConfig.command,
        args: clientArgs
      });
      await client.connectToServer();
      await client.saveTools();
      if (client.tools) {
        tools.push(...client.tools);
        client.tools.map(({ function: toolFn }) => {
          if (!toolFn.name || toolFn.description?.includes("DEPRECATED:")) {
            return null;
          }
          toolMap.set(toolFn.name, client);
        });
      }
      clients.set(serverName, client);
    } catch (error) {
      log.error(`Failed to create ${serverName} client: ${error}`);
    }
  }

  return {
    tools,
    toolMap,
    disconnect: async () => {
      for (const client of Object.values(clients)) {
        await client.disconnectFromServer();
      }
    }
  };
}

export async function connectAISDKToMCPServers(allowedDirs: AllowedDirs) {
  const config = await getConfig();
  const clients: Map<string, MCPClient> = new Map();
  let tools: ToolType = {};

  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    const clientArgs = getClientArgs(serverName, serverConfig.args, allowedDirs);
    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: clientArgs,
      stderr: "ignore",
    });

    try {
      const client = await createMCPClient({
        name: serverName,
        transport,
      });
      const clientTools = await client.tools();
      Object.assign(tools, clientTools);
      clients.set(serverName, client);
    } catch (error) {
      log.error(`Failed to create ${serverName} client: ${error}`);
    }
  }

  return {
    tools,
    toolMap: null,
    disconnect: async () => {
      if (clients === null) {
        return;
      }
      await Promise.all(
        Object.values(clients).map((client) => client.close())
      );
    }
  };
}
