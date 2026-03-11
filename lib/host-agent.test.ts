import { describe, expect, mock, test } from "bun:test";
import { connectAgentServer, initAgent } from "./host-agent";
import type { McpConfig } from "../config-validation";
import type { AllowedDirs } from "./get-dirs-from-args";

const connectRemoteMock = mock(async (_dirs: AllowedDirs) => ({
  tools: [],
  disconnect: mock(async () => {}),
  toolMap: new Map(),
}));

const connectLocalMock = mock(async (_dirs: AllowedDirs) => ({
  tools: [],
  disconnect: mock(async () => {}),
  toolMap: new Map(),
}));

class FakeRemoteAgent {
  tools: any;
  config: any;
  instructions: any;
  constructor(opts: any) {
    this.instructions = opts.instructions;
    this.tools = opts.tools;
    this.config = opts.config;
  }
}

class FakeLocalAgent {
  tools: any;
  toolMap: any;
  config: any;
  instructions: any;
  constructor(opts: any) {
    this.instructions = opts.instructions;
    this.tools = opts.tools;
    this.toolMap = opts.toolMap;
    this.config = opts.config;
  }
}

mock.module("../agents/remote-agent", () => ({
  RemoteAgent: Object.assign(FakeRemoteAgent, {
    connectMCPServers: connectRemoteMock,
  }),
}));

mock.module("../agents/local-agent", () => ({
  LocalAgent: Object.assign(FakeLocalAgent, {
    connectMCPServers: connectLocalMock,
  }),
}));

describe("connectAgentServer", () => {
  const providers: McpConfig["providers"] = {
    remoteAgent: {
      host: "http://remote",
      models: ["remote-model"],
      defaultModelId: "remote-model",
    },
    localAgent: {
      host: "http://local",
      models: ["local-model"],
      defaultModelId: "local-model",
    },
  };
  const dirs: AllowedDirs = { localDirs: ["/tmp"], remoteDirs: ["/cloud"] };

  test("connects remote agent when provider is remoteAgent", async () => {
    connectRemoteMock.mockReset();
    const result = await connectAgentServer(providers, "remoteAgent", dirs);
    expect(connectRemoteMock).toHaveBeenCalledWith(dirs);
    expect(result.remoteClients).not.toBeNull();
    expect(result.localClients).toBeNull();
  });

  test("connects local agent when provider is localAgent", async () => {
    connectLocalMock.mockReset();
    const result = await connectAgentServer(providers, "localAgent", dirs);
    expect(connectLocalMock).toHaveBeenCalledWith(dirs);
    expect(result.localClients).not.toBeNull();
    expect(result.remoteClients).toBeNull();
  });

  test("throws when provider is not configured", async () => {
    await expect(
      connectAgentServer({}, "localAgent", dirs as any)
    ).rejects.toThrow(/Invalid agent provider/);
  });
});

describe("initAgent", () => {
  const providers: McpConfig["providers"] = {
    remoteAgent: {
      host: "http://remote",
      models: ["remote-model"],
      defaultModelId: "remote-model",
    },
    localAgent: {
      host: "http://local",
      models: ["local-model"],
      defaultModelId: "local-model",
    },
  };

  test("creates RemoteAgent when provider is remoteAgent", async () => {
    const remoteClients: any = { tools: [{ name: "t" }], toolMap: new Map() };
    const agent = await initAgent(
      providers,
      "remoteAgent",
      remoteClients,
      null
    );
    expect(agent).toBeInstanceOf(FakeRemoteAgent);
  });

  test("creates LocalAgent when provider is localAgent", async () => {
    const localClients: any = { tools: [{ name: "t" }], toolMap: new Map() };
    const agent = await initAgent(
      providers,
      "localAgent",
      null,
      localClients
    );
    expect(agent).toBeInstanceOf(FakeLocalAgent);
  });

  test("throws when provider config is missing", async () => {
    await expect(
      initAgent({}, "localAgent", null as any, null as any)
    ).rejects.toThrow(/Invalid agent provider/);
  });
});

