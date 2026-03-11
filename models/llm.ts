import { Ollama, type Message, type Tool } from "ollama";
import { logLocalResponse } from "../lib/message-logger";
import type { McpConfig } from "../config-validation";

export class LocalModel {
  private config: McpConfig["providers"][string];
  private model: Ollama;

  constructor(localConfig: McpConfig["providers"][string]) {
    this.config = localConfig;
    this.model = new Ollama(localConfig);
  }

  async createMessage({
    messages,
    tools,
  }: {
    messages: Message[];
    tools?: Tool[];
  }) {
    const response = await this.model.chat({
      model: this.config.modelId,
      messages,
      tools
    });
    await logLocalResponse({ response });
    return response;
  }

  cancel() {
    this.model?.abort();
  }

  async setModel(modelId: string) {
    // Recreate Ollama Instance with new modelId
    this.config.modelId = modelId;
    this.model = new Ollama(this.config);
  }
}
