import { logRemoteResponse } from "../lib/message-logger";
import type { LanguageModel, ModelMessage, ToolSet } from "ai";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";

export class GroqModel {
  private model: LanguageModel;

  constructor(modelId: string) {
    this.model = groq(modelId);
  }

  async createMessage({
    messages,
    tools,
  }: {
    messages: ModelMessage[];
    tools?: ToolSet;
  }) {
    const response = await generateText({
      model: this.model,
      messages,
      tools,
    });
    await logRemoteResponse({ response });
    return response;
  }
}
