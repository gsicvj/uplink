import { describe, expect, mock, test } from "bun:test";

const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => "",
  } as Response;
});

// Override global fetch for these tests
(globalThis as any).fetch = fetchMock;

describe("warmUpModel", () => {
  test("calls Ollama chat endpoint with expected payload", async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    } as Response));

    const { warmUpModel } = await import("./ollama-models");

    const host = "http://localhost:11434";
    const model = "llama3";
    const tools: any[] = [{ type: "function", function: { name: "test", parameters: {} } }];

    await warmUpModel(host, model, tools as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${host}/api/chat`);
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe(model);
    expect(body.stream).toBe(false);
    expect(body.tools).toEqual(tools);
    expect(body.messages[0]).toEqual({ role: "user", content: "Hi" });
  });

  test("throws with descriptive error when response not ok", async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "Server error",
    } as Response));

    const { warmUpModel } = await import("./ollama-models");

    await expect(
      warmUpModel("http://localhost:11434", "llama3", [])
    ).rejects.toThrow(/Failed to warm up model/);
  });
});

describe("coolDownModel", () => {
  test("returns true when response ok", async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    } as Response));

    const { coolDownModel } = await import("./ollama-models");

    const result = await coolDownModel("http://localhost:11434", "llama3");
    expect(result).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(init!.body as string);
    expect(body.keep_alive).toBe(0);
  });

  test("returns false when response not ok", async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "Server error",
    } as Response));

    const { coolDownModel } = await import("./ollama-models");

    const result = await coolDownModel("http://localhost:11434", "llama3");
    expect(result).toBe(false);
  });
});

