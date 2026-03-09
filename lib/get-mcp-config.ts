import type { McpConfig } from "../config";

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

const MCP_CONFIG_PATH = "mcp-config.json";
let config: McpConfig | null = null;

/** For tests: reset in-memory cache so next getConfig() re-reads file. */
export function resetConfigCache(): void {
  config = null;
}

/** For tests: load config from a specific path (no cache). */
export async function getConfigFromPath(path: string): Promise<McpConfig | null> {
  try {
    const file = Bun.file(path);
    return await file.json();
  } catch (error) {
    console.error("Unable to retrieve config.");
  }
  return null;
}

export const getConfig = async () => {
  if (config == null) {
    config = await getConfigFromPath(MCP_CONFIG_PATH);
  }
  return config;
};

const updateConfig = async () => {
  if (config == null) {
    return;
  }
  try {
    const stringifiedConfig = JSON.stringify(config, null, 2);
    await Bun.write(MCP_CONFIG_PATH, stringifiedConfig);
  } catch (error) {
    console.error("Unable to update config.", error);
  }
}

export const configureDirectories = () => {
  // TODO: have to make a way to tell agent about required items per server
  // I'm thinking about { required: { dirs: string[] }}
  // But what about dynamically added servers, and avoiding hardcoding config.
  // LLM could in theory react to MCP server error about missing config.
  // - But that exposes vulnerability, right?
  // - But what if I limit config changes to only that server.
  // - I can always ask the user if they want to modify config based on LLM idea.

  // An app that configures itself during runtime:
  // - Requires instructions update to format message in special way
  // - "idea": { message: string, validationSchema: string, serverName: string }
  // LLM could:
  // - Provide idea what to set based on error message ("Server X failed because of Y")
  // - Propose to set and validate Y for server X
  // - If allowed it would update config for server X
  // - *** BUT IT would have to know to read and send with server config "does it work out of the box?"
  throw new Error("Function not implemented.");
}

export const configureProvider = () => {
  throw new Error("Function not implemented.");
}

export const configureModel = () => {
  throw new Error("Function not implemented.");
}
