import { select, isCancel, cancel, text, log } from "@clack/prompts";
import type { McpConfig, ProviderOption } from "../config-validation";
import { FILESYSTEM_MCP, UPLINK_MCP } from "./connect-to-mcp-servers";
import { ensureDirs } from "./ensure-dirs";
import { configureDirectories, configureModel, configureProvider } from "./get-mcp-config";
import { type UplinkAgent } from "./host-agent";

type ConfigOption = "directories" | "provider" | "model";
type ActionOption = "config";

export interface HostContext {
  agent: UplinkAgent
  getConfig: () => Promise<McpConfig>
  initAgent?: (newConfig: McpConfig) => Promise<UplinkAgent>
  setAgent?: (agent: UplinkAgent) => void;
}
export type ConfigHandlers = Record<ConfigOption, (ctx: HostContext) => Promise<void>>;
export type HostActions = Record<ActionOption, (ctx: HostContext) => Promise<void>>;

async function handleDirectories(ctx: HostContext) {
  const dirs = await promptForDirs(ctx);
  if (dirs) {
    const newConfig = await configureDirectories(dirs.serverName, dirs.dirs);
    if (newConfig && ctx.initAgent && ctx.setAgent) {
      await ctx.agent.stop();
      const newAgent = await ctx.initAgent(newConfig);
      await newAgent.start();
      ctx.setAgent(newAgent);
    }
  }
}

async function handleProvider(ctx: HostContext) {
  const provider = await promptForProvider(ctx);
  if (provider) {
    const newConfig = await configureProvider(provider);
    if (newConfig) {
      await ctx.agent.stop();
      if (ctx.initAgent && ctx.setAgent) {
        const newAgent = await ctx.initAgent(newConfig);
        await newAgent.start();
        ctx.setAgent(newAgent);
      }
    }
  }
}

async function handleModel(ctx: HostContext) {
  const config = await ctx.getConfig();
  const model = await promptForModel(ctx);
  if (model) {
    const newConfig = await configureModel(model.provider, model.modelId);
    if (newConfig) {
      await ctx.agent.restartAgent(
        newConfig!.providers[config.agentProvider]!,
        config.providers[config.agentProvider]!
      )
    }
  }
}

export const configHandlers: ConfigHandlers = {
  directories: handleDirectories,
  provider: handleProvider,
  model: handleModel,
}

export const actions: HostActions = {
  config: promptForConfig
}

export async function promptForConfig(ctx: HostContext) {
  const configType = await select({
    message: 'What would you like to configure?',
    options: [
      { value: 'directories', label: 'Allowed directories' },
      { value: 'provider', label: 'Agent provider' },
      { value: 'model', label: 'Model', hint: 'gpt-oss' }
    ],
  });
  if (isCancel(configType)) {
    cancel('Configuring cancelled.');
    return;
    // no-op
  }
  let cachedConfig: McpConfig | null = null;
  let inFlight: Promise<McpConfig> | null = null;

  async function getConfigCached() {
    if (cachedConfig !== null) return cachedConfig;
    if (inFlight) return inFlight;
    inFlight = ctx.getConfig();
    inFlight
      .then((config) => cachedConfig = config)
      .finally(() => {
        inFlight = null
      })
    return inFlight;
  }

  const configHandler = configHandlers[configType];
  try {
    await configHandler({
      agent: ctx.agent,
      getConfig: getConfigCached,
      initAgent: ctx.initAgent,
      setAgent: ctx.setAgent,
    });
  } catch (error) {
    log.error("Failed to update config.")
  }
}

export async function promptForDirs(ctx: HostContext) {
  const serverName = await select({
    message: "Which server's directories do you want to change?",
    options: [
      { value: FILESYSTEM_MCP, label: "Filesystem MCP", hint: "Local storage" },
      { value: UPLINK_MCP, label: "Uplink MCP", hint: "Remote storage" },
    ],
  });
  if (isCancel(serverName)) {
    return null;
  }

  const checkedDirs: string[] = [];
  const directories = await text({
    message: `Please specify allowed directories.`,
    placeholder: "Example: dir1/ dir2/",
    validate(value) {
      if (value?.split(" ").length === 0) return `Please specify at least one directory!`;
    },
  });
  if (isCancel(directories)) {
    cancel('Operation cancelled.');
    process.exit(0);
  }
  const dirsToEnsure = directories ? directories.split(" ") : [];
  const ensuredDirs = await ensureDirs(dirsToEnsure);
  if (ensuredDirs.length > 0) {
    checkedDirs.push(...ensuredDirs);
  }
  return { serverName, dirs: checkedDirs };
}

export async function promptForProvider(ctx: HostContext) {
  const provider = await select({
    message: "Which agent provider should be used?",
    options: [
      { value: "localAgent", label: "Local Agent" },
      { value: "remoteAgent", label: "Remote Agent" },
    ],
  });
  if (isCancel(provider)) {
    return null;
  }
  return provider as ProviderOption;
}

export async function promptForModel(ctx: HostContext) {
  const config = await ctx.getConfig();
  const provider = config.agentProvider;
  if (!config.providers[provider]) {
    return null;
  }
  const modelOptions = config.providers[provider].models.map(modelId => ({
    value: modelId,
    label: modelId
  }))
  const modelId = await select({
    message: "Which model should be used?",
    options: modelOptions,
  });
  if (isCancel(modelId)) {
    return null;
  }
  return { provider, modelId };
}
