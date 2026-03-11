import {
  ToolLoopAgent,
  type ModelMessage,
  stepCountIs,
} from "ai";

import { groq, type GroqLanguageModelOptions } from '@ai-sdk/groq';

import { log, spinner } from "@clack/prompts";
import { logRemoteResponse } from "../lib/message-logger";
import type { SolveResult } from "./local-agent";
import chalk from "chalk";
import type { McpConfig } from "../config-validation";
import { connectAISDKToMCPServers, type ToolType } from "../lib/connect-to-mcp-servers";
import type { AllowedDirs } from "../lib/evaluate-args";

export class RemoteAgent {
  private agent: ToolLoopAgent | null = null;
  private messages: ModelMessage[] = [];
  private tools: ToolType;
  private instructions: string;
  private config: McpConfig["providers"][number];

  static async connectMCPServers(allowedDirs: AllowedDirs) {
    return await connectAISDKToMCPServers(allowedDirs);
  }

  constructor({
    instructions,
    tools,
    config,
  }: {
    instructions: string;
    tools: ToolType
    config: McpConfig["providers"][number];
  }) {
    this.instructions = instructions;
    this.tools = tools;
    this.config = config;
    // Nice to research: There are "structuredOutputs" that define how output looks like
  }

  async start() {
    const startTime = performance.now();
    try {
      this.agent = new ToolLoopAgent({
        model: groq(this.config.modelId),
        instructions: this.instructions,
        tools: this.tools,
        stopWhen: stepCountIs(10),
        providerOptions: {
          groq: {
            reasoningFormat: 'parsed',
            reasoningEffort: 'medium',
          } satisfies GroqLanguageModelOptions,
        },
      });

      const connectTime = +((performance.now() - startTime) / 1000).toFixed(2);
      await logRemoteResponse({
        init: {
          modelId: this.config.modelId,
          totalDuration: connectTime,
        },
      });
      log.message(`Remote model ${this.config.modelId} ready, with ${Object.keys(this.tools).length} tools...`);
    } catch (error) {
      const errorMessage = `Failed to initialize remote agent: ${error instanceof Error ? error.message : String(error)}`;
      log.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async stop() {
    this.agent = null;
  }

  async solve(prompt: string): Promise<SolveResult> {
    const startTime = performance.now();
    const solveSpinner = spinner();
    solveSpinner.start("Solving");
    // save context
    this.messages.push({
      role: "user",
      content: prompt,
    });
    try {
      /*
        - Automatically handles the tool-calling loop
        - Decides when to call tools vs respond
        - Manages multiple iterations internally
      */
      const response = await this.agent!.generate({
        messages: this.messages,
      });
      // respond and save context
      if (response.text) {
        this.messages.push({
          role: "assistant",
          content: response.text,
        });
        solveSpinner.stop(`Solved`);

        log.info("Assistant: ");
        log.message(response.text, {
          spacing: 0
        });
      }
      // log response
      logRemoteResponse({ response });

      // Check if there was an error
      const error =
        response.finishReason === "error"
          ? "Agent encountered an error"
          : response.finishReason === "other"
            ? "Max iterations reached"
            : null;

      const totalTime = +((performance.now() - startTime) / 1000).toFixed(2);
      log.info(chalk.dim(`Assistant needed ${totalTime}s to complete.`));

      return {
        content: response.text ?? null,
        error,
      };
    } catch (error) {
      solveSpinner.stop("");
      return {
        content: "Failed to solve the prompt.",
        error: error instanceof Error ? error.message : `${error}`
      }
    }
  }

  updateConfig(config: McpConfig["providers"][string]) {
    this.config = config;
  }

  async restartAgent(
    newConfig: McpConfig["providers"][string],
    oldConfig: McpConfig["providers"][string],
  ) {
    await this.stop();
    this.updateConfig(newConfig);
    await this.start();
  }
}
