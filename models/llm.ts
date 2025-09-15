import { Ollama, type Message, type Tool } from "ollama";
import { type OllamaConfig } from "../lib/get-mcp-config";

export class LocalModel {
  private config: OllamaConfig;
  private model: Ollama;

  constructor(ollamaConfig: OllamaConfig) {
    this.config = ollamaConfig;
    this.model = new Ollama(ollamaConfig);
  }

  async createMessage({
    messages,
    tools,
  }: {
    messages: Message[];
    tools?: Tool[];
  }) {
    const response = await this.model.chat({
      model: this.config.model,
      messages,
      tools,
    });
    return response;
  }
}
