import { Ollama, type Message, type Tool } from "ollama";
import { type LocalConfig } from "../lib/get-mcp-config";
import { logLocalResponse } from "../lib/message-logger";

export class LocalModel {
  private config: LocalConfig;
  private model: Ollama;

  constructor(localConfig: LocalConfig) {
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
}
