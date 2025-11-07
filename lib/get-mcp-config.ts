export type LLM =
  | "qwen3:0.6b"
  | "gpt-oss:20b"
  | "gpt-oss-faster"
  | "gemma:2b"
  | "cow/gemma2_tools"
  | "phi3:latest"
  | "llama3-groq-tool-use"
  | "llama3.1:8b"
  | "llama3.2:3b";

export type Config = {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      roots?: Array<{ uri: string; name: string }>;
    };
  };
  localAgent: {
    host: string;
    modelId: LLM;
  };
  remoteAgent: {
    host: string;
    modelId: string; // How to import the type? Lib doesn't export.
  };
  agentProvider: "localAgent" | "remoteAgent";
  isChatEnabled: boolean;
};

export type ServerConfig = Config["mcpServers"];

export type LocalConfig = Config["localAgent"];
export type RemoteConfig = Config["remoteAgent"];

const mcpConfigPath = "mcp-config.json";
let config: object | null = null;

export const getConfig = async () => {
  if (config == null) {
    const file = Bun.file(mcpConfigPath);
    config = await file.json();
  }
  return config as Config;
};
