import { describe, expect, test } from "bun:test";
import { agentSchema, configSchema, mcpServerSchema, validateMcpConfig } from "./config-validation";

describe("mcpServerSchema", () => {
  test("accepts valid MCP server config", () => {
    const valid = {
      command: "bun",
      args: ["run", "servers/cdn/uplink-server.ts"],
      vargs: ["/data"],
      env: { NODE_ENV: "test" },
      roots: [{ uri: "file:///data", name: "data-root" }],
    };
    expect(mcpServerSchema.parse(valid)).toEqual(valid);
  });

  test("rejects missing command or args or vargs", () => {
    expect(() =>
      mcpServerSchema.parse({
        // command missing
        args: ["run"],
        vargs: [],
      } as any),
    ).toThrow();

    expect(() =>
      mcpServerSchema.parse({
        command: "bun",
        args: [],
        vargs: [],
      }),
    ).toThrow();

    expect(() =>
      mcpServerSchema.parse({
        command: "bun",
        args: ["run"],
        // vargs missing
      } as any),
    ).toThrow();
  });
});

describe("agentSchema", () => {
  test("accepts valid agent config", () => {
    const valid = {
      host: "http://localhost:11434",
      modelId: "llama3",
      models: ["llama3", "llama3:instruct"],
    };
    expect(agentSchema.parse(valid)).toEqual(valid);
  });

  test("requires non-empty models array and modelId", () => {
    expect(() =>
      agentSchema.parse({
        host: "http://localhost:11434",
        modelId: "",
        models: ["llama3"],
      }),
    ).toThrow();

    expect(() =>
      agentSchema.parse({
        host: "http://localhost:11434",
        modelId: "llama3",
        models: [],
      }),
    ).toThrow();
  });
});

describe("configSchema / validateMcpConfig", () => {
  const baseConfig = {
    mcpServers: {
      filesystem: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        vargs: ["/tmp"],
      },
    },
    providers: {
      localAgent: {
        host: "http://localhost:11434",
        modelId: "llama3",
        models: ["llama3"],
      },
    },
    agentProvider: "localAgent"
  } as const;

  test("validateMcpConfig parses a valid config", () => {
    const parsed = validateMcpConfig(baseConfig);
    expect(parsed).toEqual(baseConfig);
  });

  test("rejects config when agentProvider is not a key of providers", () => {
    const bad = {
      ...baseConfig,
      agentProvider: "remoteAgent",
    };
    expect(() => configSchema.parse(bad)).toThrow(/agentProvider must be a key of providers/);
  });
});

