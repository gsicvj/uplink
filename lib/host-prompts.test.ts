import { describe, expect, mock, test } from "bun:test";
import type { HostContext } from "./host-prompts";

const selectMock = mock(async (_opts: any) => "directories");
const textMock = mock(async (_opts: any) => "dir1 dir2");
const cancelMock = mock((_msg?: string) => {});
const isCancelMock = mock((_val: any) => false);
const logErrorMock = mock((_msg: string) => {});

mock.module("@clack/prompts", () => ({
  select: selectMock,
  text: textMock,
  cancel: cancelMock,
  isCancel: isCancelMock,
  spinner: () => ({
    start: () => {},
    stop: () => {},
    message: () => {},
  }),
  log: {
    info: () => {},
    warn: () => {},
    error: logErrorMock,
    message: () => {},
  },
}));

const ensureDirsMock = mock(async (dirs: string[]) => dirs);

mock.module("./ensure-dirs", () => ({
  ensureDirs: ensureDirsMock,
}));

describe("promptForDirs", () => {
  test("returns server name and ensured dirs", async () => {
    selectMock.mockReset();
    textMock.mockReset();
    ensureDirsMock.mockReset();
    selectMock.mockImplementation(async () => "filesystem");
    textMock.mockImplementation(async () => "dir1 dir2");
    ensureDirsMock.mockImplementation(async (dirs: string[]) => dirs);

    const { promptForDirs } = await import("./host-prompts");

    const ctx = {} as HostContext;
    const result = await promptForDirs(ctx);

    expect(result?.serverName).toBe("filesystem");
    expect(result?.dirs).toEqual(["dir1", "dir2"]);
  });
});

describe("promptForProvider", () => {
  test("returns selected provider", async () => {
    selectMock.mockReset();
    selectMock.mockImplementation(async () => "localAgent");

    const { promptForProvider } = await import("./host-prompts");

    const provider = await promptForProvider({} as HostContext);
    expect(provider).toBe("localAgent");
  });
});

describe("promptForModel", () => {
  test("returns provider and model when provider has models", async () => {
    selectMock.mockReset();
    selectMock.mockImplementation(async () => "model-1");

    const { promptForModel } = await import("./host-prompts");

    const ctx: HostContext = {
      agent: {} as any,
      getConfig: async () =>
        ({
          agentProvider: "localAgent",
          providers: {
            localAgent: {
              host: "http://local",
              models: ["model-1", "model-2"],
              defaultModelId: "model-1",
            },
          },
        } as any),
    };

    const result = await promptForModel(ctx);
    expect(result).toEqual({ provider: "localAgent", modelId: "model-1" });
  });
});

describe("promptForConfig", () => {
  test("dispatches to directories handler and restarts agent when needed", async () => {
    selectMock.mockReset();
    selectMock.mockImplementationOnce(async () => "directories");
    selectMock.mockImplementationOnce(async () => "filesystem");
    textMock.mockReset();
    textMock.mockImplementation(async () => "dir1");

    const stopMock = mock(async () => {});
    const startMock = mock(async () => {});
    const setAgentMock = mock((_: any) => {});

    const { promptForConfig } = await import("./host-prompts");

    const ctx: HostContext = {
      agent: { stop: stopMock, start: startMock } as any,
      getConfig: async () =>
        ({
          agentProvider: "localAgent",
          providers: {
            localAgent: {
              host: "http://local",
              models: ["m"],
              defaultModelId: "m",
            },
          },
        } as any),
      initAgent: async () =>
        ({ start: startMock, stop: stopMock } as any),
      setAgent: setAgentMock,
    };

    await promptForConfig(ctx);
  });
});

