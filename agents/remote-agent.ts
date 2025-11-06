import { connectAISDKToMCPServers } from "../lib/connect-to-mcp-servers";
import {
  Experimental_Agent as Agent,
  type ModelMessage,
  type experimental_MCPClient as MCPClient,
  stepCountIs,
} from "ai";
import { logRemoteResponse } from "../lib/message-logger";
import { groq } from "@ai-sdk/groq";
import type { Config } from "../lib/get-mcp-config";
import type { SolveResult } from "./local-agent";

export class RemoteAgent {
  private agent: any | null = null;
  private messages: ModelMessage[] = [];
  private clients: Map<string, MCPClient> | null = null;
  private instructions: string;
  private modelId: string;

  constructor({
    instructions,
    modelId,
  }: {
    instructions: string;
    modelId: string;
  }) {
    this.instructions = instructions;
    this.modelId = modelId;
    // Nice to research: There are "structuredOutputs" that define how output looks like
  }

  async connect(config: Config) {
    const startTime = performance.now();
    const { tools, clients } = await connectAISDKToMCPServers(config);
    this.clients = clients;
    this.agent = new Agent({
      model: groq(this.modelId),
      system: this.instructions,
      tools,
      stopWhen: stepCountIs(10),
    });
    const connectTime = +((performance.now() - startTime) / 1000).toFixed(2);
    logRemoteResponse({
      init: {
        modelId: this.modelId,
        totalDuration: connectTime,
      },
    });
  }

  async solve(prompt: string): Promise<SolveResult> {
    const startTime = performance.now();
    // save context
    this.messages.push({
      role: "user",
      content: prompt,
    });
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
      console.error(`Assistant: ${response.text}`);
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

    const totalTime = +(performance.now() - startTime).toFixed(2);
    console.error(`Assistant needed ${totalTime}ms to complete.`);

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
