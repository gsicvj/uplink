import { log } from "@clack/prompts";
import { validateMcpConfig, type AgentConfig, type McpConfig, type McpServerConfig, type ProviderOption } from "../config-validation";
import { FILESYSTEM_MCP, UPLINK_MCP } from "../lib/connect-to-mcp-servers";

const MCP_CONFIG_PATH = "mcp-config.json";
let config: McpConfig | null = null;

/** For tests: reset in-memory cache so next getConfig() re-reads file. */
export function resetConfigCache(): void {
  config = null;
}

/** For tests: load config from a specific path (no cache). */
export async function getConfigFromPath(path: string) {
  try {
    const file = Bun.file(path);
    const unsafeConfig = await file.json();
    const validated = validateMcpConfig(unsafeConfig);
    return validated;
  } catch (error) {
    log.error("Missing or invalid config file.");
    throw error;
  }
}

export const getConfig = async () => {
  if (config == null) {
    config = await getConfigFromPath(MCP_CONFIG_PATH);
  }
  return config;
};

const updateConfig = async (updated: McpConfig) => {
  try {
    const validated = validateMcpConfig(updated);
    const stringifiedConfig = JSON.stringify(validated, null, 2);
    await Bun.write(MCP_CONFIG_PATH, stringifiedConfig);
    config = JSON.parse(stringifiedConfig);
    return config;
  } catch (error) {
    log.error("Unable to update config.");
    return null;
  }
}

export const configureDirectories = (serverName: typeof FILESYSTEM_MCP | typeof UPLINK_MCP, dirs: string[]) => {
  const updatedServer = {
    ...config!.mcpServers[serverName],
    vargs: dirs,
  } as McpServerConfig;

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
  return updateConfig({
    ...config!,
    mcpServers: {
      ...config!.mcpServers,
      [serverName]: updatedServer
    }
  })
}

export const configureProvider = (newProvider: ProviderOption) => {
  const newConfig = {
    ...config!,
    agentProvider: newProvider
  }
  return updateConfig(newConfig);
}

export const configureModel = (provider: ProviderOption, modelId: string) => {
  const newProvider: AgentConfig = {
    ...config![provider],
    modelId
  }
  return updateConfig({
    ...config!,
    [provider]: newProvider
  });
}
