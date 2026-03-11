import { log } from "@clack/prompts";
import { rename } from 'node:fs/promises';
import { validateMcpConfig, type AgentConfig, type McpConfig, type McpServerConfig, type ProviderOption, type Providers } from "../config-validation";

const MCP_CONFIG_PATH = "mcp-config.json";
const TEMP_MCP_CONFIG_PATH = `temp-${MCP_CONFIG_PATH}`;

type ServerName = "filesystem" | "uplink";

let config: McpConfig | null = null;
let configInFlight: Promise<McpConfig> | null = null;

/** For tests: reset in-memory cache so next getConfig() re-reads file. */
export function resetConfigCache(): void {
  config = null;
}

/** For tests: load config from a specific path (no cache). */
export async function getConfigFromPath(path: string, tempPath: string) {
  try {
    const tempFile = Bun.file(tempPath);
    if (await tempFile.exists()) {
      await tempFile.delete();
    }
  } catch (error) {
    // no-op
  }
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

export async function getConfig() {
  if (config !== null) {
    return structuredClone(config);
  }
  if (configInFlight) return configInFlight;
  configInFlight = getConfigFromPath(MCP_CONFIG_PATH, TEMP_MCP_CONFIG_PATH)
    .then((newConfig) => {
      config = structuredClone(newConfig);
      return structuredClone(newConfig);
    })
    .finally(() => {
      configInFlight = null;
    });
  return configInFlight;
}

async function updateConfig(updated: McpConfig) {
  try {
    const validated = validateMcpConfig(updated);
    const stringifiedConfig = JSON.stringify(validated, null, 2);
    const isWritten = await Bun.write(TEMP_MCP_CONFIG_PATH, stringifiedConfig);
    if (isWritten) {
      await rename(TEMP_MCP_CONFIG_PATH, MCP_CONFIG_PATH);
    }
    config = JSON.parse(stringifiedConfig);
    return structuredClone(config);
  } catch (error) {
    log.error("Unable to update config.");
    return null;
  }
}

export async function configureDirectories(
  serverName: ServerName,
  dirs: string[],
) {
  const updatedServer = {
    ...config!.mcpServers[serverName],
    vargs: dirs,
  } as McpServerConfig;

  return updateConfig({
    ...config!,
    mcpServers: {
      ...config!.mcpServers,
      [serverName]: updatedServer
    }
  });
}

export async function configureProvider(newProvider: ProviderOption) {
  const newConfig: McpConfig = {
    ...config!,
    agentProvider: newProvider,
  };
  return updateConfig(newConfig);
}

export async function configureModel(provider: ProviderOption, modelId: string) {
  const newProviders: Providers = {
    ...config!.providers,
    [provider]: {
      ...config!.providers[provider],
      modelId
    } as AgentConfig
  };
  return updateConfig({
    ...config!,
    providers: newProviders,
  });
}
