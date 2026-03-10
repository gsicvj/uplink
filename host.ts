import { configureDirectories, configureModel, configureProvider, getConfig } from "./lib/get-mcp-config";
import { LocalAgent } from "./agents/local-agent";
import { RemoteAgent } from "./agents/remote-agent";
import { cancel, isCancel, log, outro, text, confirm, select } from "@clack/prompts";
import { getDirsFromArgs, type AllowedDirs } from "./lib/get-dirs-from-args";
import { ensureDirs } from "./lib/ensure-dirs";
import { HOST_INSTRUCTIONS } from "./host-instructions";
import type { McpConfig, ProviderOption } from "./config-validation";
import { z } from "zod";
import { FILESYSTEM_MCP, UPLINK_MCP } from "./lib/connect-to-mcp-servers";

type UplinkAgent = RemoteAgent | LocalAgent;

async function promptForDirs() {
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
async function checkDirs(dirs: string[], type: string) {
  if (dirs.length > 0) {
    return dirs;
  }
  const checkedDirs: string[] = [];
  while (true) {
    const directories = await text({
      message: `Please specify ${type} allowed directories.`,
      placeholder: "Example: dir1/ dir2/",
      validate(value) {
        if (value?.split(" ").length === 0) return `Please specify at least one ${type} directory!`;
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
      break;
    } else {
      const shouldRetry = await confirm({
        message: 'Do you want to retry?',
      });
      if (shouldRetry === false) {
        return [];
      }
    }
  }
  return checkedDirs;
}

async function promptForProvider() {
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

async function promptForModel(provider: ProviderOption) {
  const config = await getConfig()!;
  const modelOptions = config[provider].models.map(modelId => ({
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

/**
 * 
 * Thinking of keeping track of allowed directories
 * - If user provides them at runtime, they should be respected
 * - Else if user adds them to mcp-config.json, they should be read
 * - Else tell the user to configure dirs - exit, maybe?
 */

async function main() {
  let agent: UplinkAgent | null;
  const config = await getConfig();
  const agentProvider = config.agentProvider;
  const { localDirs, remoteDirs } = await getDirsFromArgs(Bun.argv);
  const allowedDirs = {
    localDirs: localDirs.length > 0 ? localDirs : config.mcpServers[FILESYSTEM_MCP]!.vargs,
    remoteDirs: remoteDirs.length > 0 ? remoteDirs : config.mcpServers[UPLINK_MCP]!.vargs
  }

  if (agentProvider === "remoteAgent") {
    agent = new RemoteAgent({
      instructions: HOST_INSTRUCTIONS,
      modelId: config.remoteAgent.modelId,
      allowedDirs
    });
  } else if (agentProvider === "localAgent") {
    agent = new LocalAgent({
      instructions: HOST_INSTRUCTIONS,
      config,
      allowedDirs
    });
  } else {
    throw new Error(
      'Invalid agent provider. Please use either "localAgent" or "remoteAgent".'
    );
  }

  await agent.connect();
  await chatLoop(agent);

  await agent.cleanup();
  process.exit(0);
}

async function chatLoop(agent: UplinkAgent) {
  const history: string[] = [];
  let config = await getConfig();
  while (true) {
    try {
      const line = await text({
        message: "User:",
      });

      if (isCancel(line)) {
        cancel('Operation cancelled.');
        outro("Bye!");
        process.exit(0);
      }

      // chat loop
      if (line === "/bye") {
        // user wants to exit the chat
        outro("Bye!");
        return;
      }

      history.push(line);

      if (line === "/config") {
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
          // no-op
        } else {
          config = await getConfig();

          switch (configType) {
            case 'directories': {
              const dirs = await promptForDirs();
              if (dirs) {
                configureDirectories(dirs.serverName, dirs.dirs);
              }
            }
              break;
            case 'provider': {
              const provider = await promptForProvider();
              if (provider) {
                configureProvider(provider);
              }
            }
              break;
            case 'model': {
              const model = await promptForModel(config.agentProvider);
              if (model) {
                configureModel(model.provider, model.modelId);
                agent.setModel(model.modelId)
              }
            }
              break;
            default: break;
          }
        }

        continue;
      }

      const result = await agent.solve(String(line));

      if (result.error) {
        log.error(`Error: ${result.error}`);
      }

      if (config.isChatEnabled === false) {
        break;
      }
    } catch (error) {
      log.error(`Unexpected error: ${error}`);
    }
  }
}

main().catch((error) => {
  let message: string;
  if (typeof z !== "undefined" && error instanceof z.ZodError) {
    const firstIssue = error.issues[0];
    if (firstIssue) {
      const path = firstIssue.path.join(".");
      const issueMessage = firstIssue.message || "Invalid value.";
      message = path ? `Validation error at "${path}": ${issueMessage}` : `Validation error: ${issueMessage}`;
    } else {
      message = "Validation failed due to an unknown error.";
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }
  log.warn(`The host application encountered an error: ${message}`);
  outro(`The application exited.`);
  process.exit(1);
});
