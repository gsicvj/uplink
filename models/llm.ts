import { Ollama, type Message, type Tool } from "ollama";
import { logLocalResponse } from "../lib/message-logger";
import type { McpConfig } from "../config-validation";

export class LocalModel {
  private config: McpConfig["localAgent"];
  private model: Ollama;

  constructor(localConfig: McpConfig["localAgent"]) {
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
      tools,
      // think: "low", // !!!!! gpt-oss supports this, llama3.1 throws
      // format: zodToJsonSchema(FormatSchema),
      // options: {
      //   temperature: 0,
      // },
    });
    await logLocalResponse({ response });
    return response;
  }

  async setModel(modelId: string) {
    this.config.modelId = modelId;
    this.model.abort();
    this.model = new Ollama(this.config);
  }
}
