import { Client } from "../client/client";
import { log, spinner } from '@clack/prompts';
import chalk from 'chalk';

import { logLocalResponse } from "../lib/message-logger";
import { LocalModel } from "../models/llm";
import type { Message, Tool, ToolCall, ChatResponse } from "ollama";
import type { McpConfig } from "../config-validation";
import type { AllowedDirs } from "../lib/get-dirs-from-args";
import { connectToMCPServers } from "../lib/connect-to-mcp-servers";
import { coolDownModel, warmUpModel } from "../lib/ollama-models";

export interface SolveResult {
  content: string | null;
  error: string | null;
}

type CallToolResponse = Awaited<ReturnType<Client["callTool"]>>;

export class LocalAgent {
  private model: LocalModel | null = null;
  public tools: Tool[] = [];
  private toolMap: Map<string, Client>;
  private messages: Message[];
  private config: McpConfig["providers"][string];

  static async connectMCPServers(allowedDirs: AllowedDirs) {
    return await connectToMCPServers(allowedDirs);
  }

  constructor({
    instructions,
    tools,
    toolMap,
    config
  }: {
    instructions: string;
    tools: Tool[];
    toolMap: Map<string, Client>;
    config: McpConfig["providers"][string];
  }) {
    this.tools = tools;
    this.toolMap = toolMap;
    this.config = config;
    this.messages = [
      {
        role: "system",
        content: instructions,
      },
    ];
  }

  async start() {
    const warmupSpinner = spinner();
    warmupSpinner.start(
      `Warming up local model ${this.config.modelId} with ${this.tools.length} tools...`
    );

    try {
      if (!this.model) {
        this.model = new LocalModel({
          modelId: this.config.modelId,
          host: this.config.host,
          models: this.config.models
        });
      }
      const startTime = performance.now();
      await warmUpModel(this.config.host, this.config.modelId, this.tools);
      const connectTime = +((performance.now() - startTime) / 1000).toFixed(2);
      logLocalResponse({
        init: {
          modelId: this.config.modelId,
          totalDuration: connectTime,
        },
      });
      warmupSpinner.stop(`Local model ${this.config.modelId} ready.`);
    } catch (_) {
      const errorMessage = `Failed to initialize local agent with ${this.config.modelId}`;
      warmupSpinner.stop("");
      log.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async stop() {
    const stoppingSpinner = spinner();
    stoppingSpinner.start(`Stopping local model ${this.config.modelId}`);
    // Abort work
    this.model?.cancel();
    // Unload model
    await coolDownModel(this.config.host, this.config.modelId);
    // Garbage collection
    this.model = null;
    this.messages = [];
    stoppingSpinner.stop(`Local model ${this.config.modelId} stopped`);
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

    const thinkingSpinner = spinner();
    thinkingSpinner.start(chalk.dim("Assistant thinking"));

    try {
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
      thinkingSpinner.stop("Thinking done.");
      log.info(
        chalk.dim(`${iterationsCount} steps were made in ${solveTotalTime}s . ${toolCallsCount} tools were called in ${toolCallsTotalTime}s.`),
      );

      logLocalResponse({
        solve: {
          modelId: this.config.modelId,
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
    } catch (error) {
      thinkingSpinner.stop("");
      return {
        content: "Failed to solve the prompt.",
        error: error instanceof Error ? error.message : `${error}`
      }
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

  updateConfig(config: McpConfig["providers"][string]) {
    this.config = config;
  }

  async restartAgent(
    newConfig: McpConfig["providers"][string],
    oldConfig: McpConfig["providers"][string],
  ) {
    await this.stop();
    this.updateConfig(newConfig)
    await this.start();
  }
}
