import { Client } from "../client/client";
import { connectToMCPServers } from "../lib/connect-to-mcp-servers";
import { log, spinner } from '@clack/prompts';
import chalk from 'chalk';

import { logLocalResponse } from "../lib/message-logger";
import { LocalModel } from "../models/llm";
import type { Message, Tool, ToolCall, ChatResponse } from "ollama";
import type { AllowedDirs } from "../lib/get-dirs-from-args";
import type { McpConfig } from "../config-validation";
import { getConfig } from "../lib/get-mcp-config";

export interface SolveResult {
  content: string | null;
  error: string | null;
}

type CallToolResponse = Awaited<ReturnType<Client["callTool"]>>;

export class LocalAgent {
  private model: LocalModel | null = null;
  private clients: Map<string, Client>;
  private toolMap: Map<string, Client>;
  public tools: Tool[] = [];
  private messages: Message[];
  private allowedDirs: AllowedDirs;

  constructor({
    instructions,
    allowedDirs
  }: {
    instructions: string;
    config: McpConfig;
    allowedDirs: AllowedDirs
  }) {
    this.allowedDirs = allowedDirs;
    this.messages = [
      {
        role: "system",
        content: instructions,
      },
    ];
    this.toolMap = new Map();
    this.clients = new Map();
  }

  async connect() {
    const config = await getConfig();
    if (!this.model) {
      this.model = new LocalModel({
        modelId: config.localAgent.modelId,
        host: config.localAgent.host,
        models: config.localAgent.models
      });
    }
    const startTime = performance.now();
    const { clients, toolMap, tools } = await connectToMCPServers(config, this.allowedDirs);
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
    const warmupSpinner = spinner();
    const config = await getConfig();

    warmupSpinner.start(
      `Warming up model ${config.localAgent.modelId} with ${this.tools.length} tools...`
    );

    try {
      const response = await fetch(`${config.localAgent.host}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.localAgent.modelId,
          messages: [{ role: "user", content: "Hi" }],
          tools: this.tools,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      await response.json();
      warmupSpinner.stop(`Local model ${config.localAgent.modelId} ready.`);
    } catch (error) {
      throw new Error(
        `Failed to warm up model. Ensure Ollama is running at ${config.localAgent.host
        } with model ${config.localAgent.modelId}\nError: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async solve(prompt: string, maxIterations = 100): Promise<SolveResult> {
    const config = await getConfig();
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

    const thinkingSpinner = spinner();
    thinkingSpinner.start(chalk.dim("Assistant thinking..."));

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
      chatResponse = await this.model!.createMessage({
        messages: this.messages,
        tools: this.tools,
      });

      iterationsCount++;

      if (!chatResponse.message.content && chatResponse.message.thinking) {
        thinkingSpinner.message(`Assistant thinking... ${chalk.dim(chatResponse.message.thinking)}`);
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
            const errorMessage = `Error executing "${toolName}": ${error instanceof Error ? error.message : "Unknown error"
              }`;
            log.error(
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

    thinkingSpinner.stop("Thinking done.");
    // or respond with a message
    const lastMessage = this.messages[this.messages.length - 1];

    if (lastMessage?.content) {
      log.info("Assistant: ");
      log.message(lastMessage.content, {
        spacing: 0
      });
    }

    const solveTotalTime = +((performance.now() - solveStart) / 1000).toFixed(
      2
    );

    log.info(
      chalk.dim(`${iterationsCount} steps were made in ${solveTotalTime}s . ${toolCallsCount} tools were called in ${toolCallsTotalTime}s.`),
    );
    logLocalResponse({
      solve: {
        modelId: config.localAgent.modelId,
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

  async setModel(modelId: string) {
    await this.cleanup();
    await this.model?.setModel(modelId);
    await this.connect();
  }

  async cleanup() {
    for (const client of Object.values(this.clients)) {
      await client.disconnectFromServer();
    }
  }
}
