import { LocalAgent } from "../agents/local-agent";
import { RemoteAgent } from "../agents/remote-agent";
import type { McpConfig, ProviderOption } from "../config-validation";
import { HOST_INSTRUCTIONS } from "../host-instructions";
import type { AllowedDirs } from "./get-dirs-from-args";

export type UplinkAgent = RemoteAgent | LocalAgent;

export async function connectAgentServer(providers: McpConfig["providers"], provider: ProviderOption, allowedDirs: AllowedDirs) {
  if (provider === "remoteAgent" && Object.hasOwn(providers, "remoteAgent") && providers[provider]) {
    const clients = await RemoteAgent.connectMCPServers(allowedDirs);
    return {
      remoteClients: clients,
      localClients: null,
      disconnectFromMCPServers: () => clients.disconnect()
    };
  } else if (provider === "localAgent" && Object.hasOwn(providers, "localAgent") && providers[provider]) {
    const clients = await LocalAgent.connectMCPServers(allowedDirs);
    return {
      remoteClients: null,
      localClients: clients,
      disconnectFromMCPServers: () => clients.disconnect()
    }
  } else {
    throw new Error(
      'Invalid agent provider. Please use either "localAgent" or "remoteAgent".'
    );
  }
}

export async function initAgent(
  providers: McpConfig["providers"],
  provider: ProviderOption,
  remoteClients: Awaited<ReturnType<typeof RemoteAgent.connectMCPServers>> | null,
  localClients: Awaited<ReturnType<typeof LocalAgent.connectMCPServers>> | null
) {
  let agent: UplinkAgent;

  if (provider === "remoteAgent" && Object.hasOwn(providers, "remoteAgent") && providers[provider] && remoteClients !== null) {
    agent = new RemoteAgent({
      instructions: HOST_INSTRUCTIONS,
      tools: remoteClients?.tools,
      config: providers[provider],
    });
  } else if (provider === "localAgent" && Object.hasOwn(providers, "localAgent") && providers[provider] && localClients !== null) {
    agent = new LocalAgent({
      instructions: HOST_INSTRUCTIONS,
      tools: localClients.tools,
      toolMap: localClients.toolMap,
      config: providers[provider],
    });
  } else {
    throw new Error(
      'Invalid agent provider. Please use either "localAgent" or "remoteAgent".'
    );
  }
  return agent
}
