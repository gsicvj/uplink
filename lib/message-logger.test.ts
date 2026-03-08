import { describe, expect, mock, test } from "bun:test";

const appendFileMock = mock(async () => {});
const mkdirMock = mock(async () => {});

mock.module("node:fs/promises", () => ({
  ...require("node:fs/promises"),
  appendFile: appendFileMock,
  mkdir: mkdirMock,
}));

test("message-logger mocks are set up before import", () => {
  expect(appendFileMock).toBeDefined();
});

describe("logLocalResponse", () => {
  test("init: appends init-shaped log line", async () => {
    appendFileMock.mockClear();
    const { logLocalResponse } = await import("./message-logger");
    await logLocalResponse({
      init: { modelId: "test-model", totalDuration: 1.5 },
    });
    expect(appendFileMock).toHaveBeenCalledTimes(1);
    const [path, content] = appendFileMock.mock.calls[0]!;
    expect(path).toContain("local.log");
    const obj = JSON.parse(content as string);
    expect(obj.type).toBe("init");
    expect(obj.modelId).toBe("test-model");
    expect(obj.totalDuration).toBe(1.5);
    expect(typeof obj.createdAt).toBe("number");
  });

  test("solve: appends solve-shaped log line", async () => {
    appendFileMock.mockClear();
    const { logLocalResponse } = await import("./message-logger");
    await logLocalResponse({
      solve: {
        modelId: "test-model",
        totalDuration: 2,
        toolCallsCount: 3,
        toolCallsTotalTime: 0.5,
        iterationsCount: 2,
      },
    });
    expect(appendFileMock).toHaveBeenCalledTimes(1);
    const [, content] = appendFileMock.mock.calls[0]!;
    const obj = JSON.parse(content as string);
    expect(obj.type).toBe("solve");
    expect(obj.modelId).toBe("test-model");
    expect(obj.totalDuration).toBe(2);
    expect(obj.toolCallsCount).toBe(3);
    expect(obj.toolCallsTotalTime).toBe(0.5);
    expect(obj.iterationsCount).toBe(2);
  });
});

describe("logRemoteResponse", () => {
  test("init: appends init-shaped log line", async () => {
    appendFileMock.mockClear();
    const { logRemoteResponse } = await import("./message-logger");
    await logRemoteResponse({
      init: { modelId: "remote-model", totalDuration: 0.8 },
    });
    expect(appendFileMock).toHaveBeenCalledTimes(1);
    const [path, content] = appendFileMock.mock.calls[0]!;
    expect(path).toContain("remote.log");
    const obj = JSON.parse(content as string);
    expect(obj.type).toBe("init");
    expect(obj.modelId).toBe("remote-model");
    expect(obj.totalDuration).toBe(0.8);
  });

  test("solve: appends solve-shaped log line", async () => {
    appendFileMock.mockClear();
    const { logRemoteResponse } = await import("./message-logger");
    await logRemoteResponse({
      solve: {
        modelId: "remote-model",
        totalDuration: 1.2,
        toolCallsCount: 1,
        toolCallsTotalTime: 0.3,
        iterationsCount: 1,
      },
    });
    expect(appendFileMock).toHaveBeenCalledTimes(1);
    const [, content] = appendFileMock.mock.calls[0]!;
    const obj = JSON.parse(content as string);
    expect(obj.type).toBe("solve");
    expect(obj.modelId).toBe("remote-model");
    expect(obj.toolCallsCount).toBe(1);
    expect(obj.iterationsCount).toBe(1);
  });
});
