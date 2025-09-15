import { Client } from "../client/client";

import { type Config } from "../lib/get-mcp-config";
import { LocalModel } from "../models/llm";
import type { Message, Tool, ToolCall, ChatResponse } from "ollama";

type CallToolResponse = Awaited<ReturnType<Client["callTool"]>>;
export class OllamaAgent {
  private model: LocalModel;
  private clients: Map<string, Client>;
  private toolMap: Map<string, Client>;
  public tools: Tool[] = [];
  private messages: Message[];

  constructor({
    instructions,
    config,
  }: {
    instructions: string;
    config: Config;
  }) {
    this.toolMap = new Map();
    this.clients = new Map();
    this.model = new LocalModel({
      model: config.ollama.model,
      host: config.ollama.host,
    });
    this.messages = [
      {
        role: "system",
        content: instructions,
      },
    ];
  }

  async createClients(config: Config) {
    for (const [serverName, serverConfig] of Object.entries(
      config.mcpServers
    )) {
      try {
        const client = new Client({ serverName, args: serverConfig.args });
        await client.connectToServer();
        await client.saveTools();
        if (client.tools) {
          this.tools.push(...client.tools);
          client.tools.map(({ function: toolFn }) => {
            if (!toolFn.name || toolFn.description?.includes("DEPRECATED:")) {
              return null;
            }
            this.toolMap.set(toolFn.name, client);
          });
        }
        this.clients.set(serverName, client);
      } catch (error) {
        console.error(`Failed to create ${serverName} client: ${error}`);
      }
    }
  }

  /**
   * This agent method will try to solve until failure or success.
   */
  async solve() {
    try {
      // Bun style input reading
      for await (const line of console) {
        // saving user goal
        this.messages.push({
          role: "user",
          content: line,
        });
        // only run-once
        break;
      }

      /** agent loop starts here */
      let chatResponse: ChatResponse;
      let toolCalls: ToolCall[];
      do {
        chatResponse = await this.model.createMessage({
          messages: this.messages,
          tools: this.tools,
        });
        this.messages.push(chatResponse.message);
        toolCalls = chatResponse.message.tool_calls ?? [];
        if (toolCalls.length > 0) {
          // agent decides if it should make tool calls
          for (const {
            function: { name: toolName, arguments: toolArgs },
          } of toolCalls) {
            const client = this.toolMap.get(toolName);
            if (!client) {
              throw new Error(`The ${toolName} is unavailable.`);
            }
            const toolResponse = await client.callToolWithTimeout(
              toolName,
              toolArgs
            );

            if (!toolResponse) {
              throw new Error(`No response came from ${toolName}.`);
            }
            const formattedResponse = this.formatToolResponse(toolResponse);
            console.error(`Assistant: ${formattedResponse}`);
            this.messages.push({
              role: "tool",
              content: formattedResponse,
            });
          }
        } else {
          // or respond with a message
          const lastMessage = this.messages[this.messages.length - 1];
          console.error("Assistant: ", lastMessage?.content);
        }
        // agent should exit if there are no tools to call
      } while (toolCalls.length > 0);
      /** agent loop ends here */
    } catch (error) {
      console.error(`Failed to achieve the goal: ${error}`);
    }
  }

  formatToolResponse(toolResponse: CallToolResponse) {
    const content = toolResponse?.content!;
    if (Array.isArray(content)) {
      return content
        .filter((item: any) => item && item.type === "text")
        .map((item: any) => item.text || "No content")
        .join("\n");
    }
    return String(content);
  }

  async prepareModel() {
    await this.model.createMessage({
      messages: this.messages,
      tools: this.tools,
    });
  }

  async cleanup() {
    for (const client of Object.values(this.clients)) {
      await client.disconnectFromServer();
    }
  }
}

export async function hostOllamaAgent(agent: OllamaAgent, config: Config) {
  try {
    await agent.createClients(config);
    await agent.prepareModel();
    await agent.solve();
  } finally {
    await agent.cleanup();
    process.exit(0);
  }
}
