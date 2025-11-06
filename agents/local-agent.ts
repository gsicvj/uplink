import { Client } from "../client/client";
import { connectToMCPServers } from "../lib/connect-to-mcp-servers";

import { type Config } from "../lib/get-mcp-config";
import { logLocalResponse } from "../lib/message-logger";
import { LocalModel } from "../models/llm";
import type { Message, Tool, ToolCall, ChatResponse } from "ollama";

export interface SolveResult {
  content: string | null;
  error: string | null;
}

type CallToolResponse = Awaited<ReturnType<Client["callTool"]>>;
export class LocalAgent {
  private model: LocalModel;
  private clients: Map<string, Client>;
  private toolMap: Map<string, Client>;
  public tools: Tool[] = [];
  private messages: Message[];
  private config: Config;

  constructor({
    instructions,
    config,
  }: {
    instructions: string;
    config: Config;
  }) {
    this.messages = [
      {
        role: "system",
        content: instructions,
      },
    ];
    this.toolMap = new Map();
    this.clients = new Map();
    this.config = config;
    this.model = new LocalModel({
      modelId: config.localAgent.modelId,
      host: config.localAgent.host,
    });
  }

  async connect(config: Config) {
    const startTime = performance.now();
    const { clients, toolMap, tools } = await connectToMCPServers(config);
    this.clients = clients;
    this.toolMap = toolMap;
    this.tools = tools;
    await this.warmUpModel();
    const connectTime = +((performance.now() - startTime) / 1000).toFixed(2);
    logLocalResponse({
      init: {
        modelId: config.localAgent.modelId,
        totalDuration: connectTime,
      },
    });
  }

  async warmUpModel(): Promise<void> {
    console.error(
      `Warming up model ${this.config.localAgent.modelId} with ${this.tools.length} tools...`
    );

    try {
      const response = await fetch(`${this.config.localAgent.host}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.localAgent.modelId,
          messages: [{ role: "user", content: "Hi" }],
          tools: this.tools,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      await response.json();
      console.error(`Local model ${this.config.localAgent.modelId} ready.`);
    } catch (error) {
      throw new Error(
        `Failed to warm up model. Ensure Ollama is running at ${
          this.config.localAgent.host
        } with model ${this.config.localAgent.modelId}\nError: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async solve(prompt: string, maxIterations = 100): Promise<SolveResult> {
    const solveStart = performance.now();
    let chatResponse: ChatResponse | undefined;
    let toolCalls: ToolCall[];
    const toolAttempts = new Map<string, number>(); // Track retry attempts per tool
    const maxToolRetries = 3;
    let toolCallsTotalTime = 0;
    let toolCallsCount = 0;
    let iterationsCount = 0;

    // save context
    this.messages.push({
      role: "user",
      content: prompt,
    });
    // solve the user prompt
    let iterations = 0;

    do {
      if (iterations++ >= maxIterations) {
        this.messages.push({
          role: "assistant",
          content:
            "I've reached the maximum number of iterations. Here's what I've accomplished so far...",
        });
        break;
      }
      // first process the prompt
      chatResponse = await this.model.createMessage({
        messages: this.messages,
        tools: this.tools,
      });

      iterationsCount++;

      if (!chatResponse.message.content && chatResponse.message.thinking) {
        console.error(`Assistant: ${chatResponse.message.thinking}`);
      }

      this.messages.push(chatResponse.message);
      toolCalls = chatResponse.message.tool_calls ?? [];

      // decide on action
      if (toolCalls.length > 0) {
        const toolCallsStartTime = performance.now();
        // agent decides if it should make tool calls
        for (const {
          function: { name: toolName, arguments: toolArgs },
        } of toolCalls) {
          const client = this.toolMap.get(toolName)!;
          try {
            const toolResponse = await client.callToolWithTimeout(
              toolName,
              toolArgs
            );
            toolCallsCount++;

            if (!toolResponse) {
              // Handle timeout or tool error - track attempts
              const attempts = (toolAttempts.get(toolName) || 0) + 1;
              toolAttempts.set(toolName, attempts);

              if (attempts >= maxToolRetries) {
                // Max retries reached - fail the entire solve
                break;
              }

              // Add error message and let agent retry
              const errorMessage = `Tool "${toolName}" failed: The tool either timed out or encountered an error. Please try again.`;
              this.messages.push({
                role: "tool",
                content: errorMessage,
              });
              break; // Stop processing remaining tools, let agent retry
            }

            const formattedResponse = this.formatToolResponse(toolResponse);
            this.messages.push({
              role: "tool",
              content: formattedResponse,
            });
            // Reset attempt counter on success
            toolAttempts.delete(toolName);
          } catch (error) {
            // Handle tool execution error - track attempts
            const attempts = (toolAttempts.get(toolName) || 0) + 1;
            toolAttempts.set(toolName, attempts);
            const errorMessage = `Error executing "${toolName}": ${
              error instanceof Error ? error.message : "Unknown error"
            }`;
            console.error(
              `Tool [error]: ${errorMessage} (attempt ${attempts}/${maxToolRetries})`
            );

            if (attempts >= maxToolRetries) {
              // Max retries reached - fail the entire solve
              return {
                content: null,
                error: `Tool "${toolName}" failed after ${maxToolRetries} attempts: ${errorMessage}`,
              };
            }

            // Add error message and let agent retry
            this.messages.push({
              role: "tool",
              content: errorMessage + " Please try again.",
            });
            break; // Stop processing remaining tools, let agent retry
          }
        }
        toolCallsTotalTime = +(
          (performance.now() - toolCallsStartTime) /
          1000
        ).toFixed(2);
      }

      // agent should exit if there are no tools to call
    } while (toolCalls.length > 0);
    // or respond with a message
    const lastMessage = this.messages[this.messages.length - 1];

    if (lastMessage?.content) {
      console.error(`Assistant: ${lastMessage.content}`);
    }

    const solveTotalTime = +((performance.now() - solveStart) / 1000).toFixed(
      2
    );

    console.error(
      `${iterationsCount} steps were made in ${solveTotalTime}s . ${toolCallsCount} tools were called in ${toolCallsTotalTime}s.`
    );
    logLocalResponse({
      solve: {
        modelId: this.config.localAgent.modelId,
        totalDuration: solveTotalTime,
        toolCallsCount,
        toolCallsTotalTime,
        iterationsCount,
      },
    });

    return {
      content: lastMessage?.content ?? null,
      error: null,
    };
    /** agent loop ends here */
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

  async cleanup() {
    for (const client of Object.values(this.clients)) {
      await client.disconnectFromServer();
    }
  }
}
