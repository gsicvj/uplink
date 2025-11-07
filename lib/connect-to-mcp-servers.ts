import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "../client/client";
import type { Config } from "./get-mcp-config";
import {
  experimental_createMCPClient as createMCPClient,
  type experimental_MCPClient as MCPClient,
} from "ai";

export type ToolType = Awaited<ReturnType<MCPClient["tools"]>>;

export async function connectToMCPServers(config: Config) {
  const tools = [];
  const clients: Map<string, Client> = new Map();
  const toolMap: Map<string, Client> = new Map();

  // Connect to all servers first
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const client = new Client({
        serverName,
        command: serverConfig.command,
        args: serverConfig.args,
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
      console.error(`Failed to create ${serverName} client: ${error}`);
    }
  }

  return {
    tools,
    clients,
    toolMap,
  };
}

export async function connectAISDKToMCPServers(config: Config) {
  const clients: Map<string, MCPClient> = new Map();
  let tools: ToolType = {};

  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
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
      console.error(`Failed to create ${serverName} client: ${error}`);
    }
  }

  return { tools, clients };
}
