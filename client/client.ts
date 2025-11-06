import { Client as MCPClient } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "ollama";
export class Client {
  private mcpClient: MCPClient;
  private transport: StdioClientTransport;
  public tools: Tool[] | null = null;

  constructor({
    serverName,
    command,
    args,
  }: {
    serverName: string;
    command: string;
    args: string[];
  }) {
    this.mcpClient = new MCPClient(
      {
        name: `ollama-client-${serverName}`,
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {
            call: {
              listChanged: true,
            },
            list: {
              listChanged: true,
            },
          },
          resources: {
            listChanged: true,
          },
        },
      }
    );

    this.transport = new StdioClientTransport({
      command,
      args,
      stderr: "ignore",
    });
  }

  async callToolWithTimeout(
    toolName: string,
    toolArgs: Record<string, unknown>,
    timeout: number = 10000
  ) {
    const toolFn = this.callTool(toolName, toolArgs);
    const timeoutFn = new Promise<undefined>((resolve) => {
      return setTimeout(resolve, timeout, undefined);
    });
    return await Promise.race([toolFn, timeoutFn]);
  }

  async callTool(toolName: string, args: Record<string, unknown>) {
    try {
      const toolCallResponse = await this.mcpClient.callTool({
        name: toolName,
        arguments: args,
      });
      return toolCallResponse;
    } catch (error) {
      // Return undefined - agent will handle logging with retry context
      return undefined;
    }
  }

  async saveTools() {
    const clientTools = await this.mcpClient.listTools();
    this.tools = clientTools.tools
      .map((tool) => {
        return {
          type: "function",
          function: {
            name: tool.name ?? "",
            description: tool.description ?? "",
            parameters: {
              type: "object",
              properties: tool.inputSchema?.properties ?? ({} as any),
              required: tool.inputSchema?.required ?? [],
            },
          },
        };
      })
      .filter(Boolean);
  }

  async connectToServer() {
    try {
      await this.mcpClient.connect(this.transport);
    } catch (error) {
      console.error(`Failed to connect MCP Client: ${error}`);
      throw error;
    }
  }

  async disconnectFromServer() {
    await this.mcpClient.close();
    await this.transport.close();
  }
}
