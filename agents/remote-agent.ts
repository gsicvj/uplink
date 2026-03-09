import { connectAISDKToMCPServers } from "../lib/connect-to-mcp-servers";
import {
  Experimental_Agent as Agent,
  type ModelMessage,
  type experimental_MCPClient as MCPClient,
  stepCountIs,
} from "ai";
import { log, spinner } from "@clack/prompts";
import { logRemoteResponse } from "../lib/message-logger";
import { groq } from "@ai-sdk/groq";
import type { Config } from "../lib/get-mcp-config";
import type { SolveResult } from "./local-agent";
import type { AllowedDirs } from "../lib/get-dirs-from-args";
import chalk from "chalk";
import type { McpConfig } from "../config";

export class RemoteAgent {
  private agent: any | null = null;
  private messages: ModelMessage[] = [];
  private clients: Map<string, MCPClient> | null = null;
  private instructions: string;
  private modelId: string;
  private allowedDirs: AllowedDirs;

  constructor({
    instructions,
    modelId,
    allowedDirs
  }: {
    instructions: string;
    modelId: string;
    allowedDirs: AllowedDirs
  }) {
    this.allowedDirs = allowedDirs;
    this.instructions = instructions;
    this.modelId = modelId;
    // Nice to research: There are "structuredOutputs" that define how output looks like
  }

  async connect(config: McpConfig) {
    const startTime = performance.now();
    const { tools, clients } = await connectAISDKToMCPServers(config, this.allowedDirs);
    const warmupSpinner = spinner();
    warmupSpinner.start(
      `Warming up model ${config.remoteAgent.modelId} with ${Object.keys(tools).length} tools...`
    );
    try {
      this.clients = clients;
      this.agent = new Agent({
        model: groq(this.modelId),
        system: this.instructions,
        tools,
        stopWhen: stepCountIs(10),
      });
      const connectTime = +((performance.now() - startTime) / 1000).toFixed(2);
      await logRemoteResponse({
        init: {
          modelId: this.modelId,
          totalDuration: connectTime,
        },
      });
      warmupSpinner.stop(`Remote model ${config.remoteAgent.modelId} ready.`);
    } catch (error) {
      const errorMessage = `Failed to initialize remote agent: ${error instanceof Error ? error.message : String(error)}`;
      warmupSpinner.stop("");
      log.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async solve(prompt: string): Promise<SolveResult> {
    const startTime = performance.now();
    // save context
    this.messages.push({
      role: "user",
      content: prompt,
    });
    const solveSpinner = spinner();
    solveSpinner.start("Solving.");
    /*
      - Automatically handles the tool-calling loop
      - Decides when to call tools vs respond
      - Manages multiple iterations internally
    */
    const response = await this.agent.generate({
      messages: this.messages,
    });
    // respond and save context
    if (response.text) {
      this.messages.push({
        role: "assistant",
        content: response.text,
      });
      solveSpinner.stop(`Solved.`);

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
        : response.finishReason === "step-limit"
          ? "Max iterations reached"
          : null;

    const totalTime = +((performance.now() - startTime) / 1000).toFixed(2);
    log.info(chalk.dim(`Assistant needed ${totalTime}s to complete.`));

    return {
      content: response.text ?? null,
      error,
    };
  }

  async cleanup() {
    if (this.clients === null) {
      return;
    }
    await Promise.all(
      Object.values(this.clients).map((client) => client.close())
    );
  }
}
