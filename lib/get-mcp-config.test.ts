import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import {
  getConfigFromPath,
  getConfig,
  resetConfigCache,
} from "./get-mcp-config";
import type { McpConfig } from "../config-validation";

const minimalConfig: McpConfig = {
  mcpServers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
    },
    uplink: {
      command: "bun",
      args: ["run", "servers/cdn/uplink-server.ts"],
    },
  },
  localAgent: { host: "http://localhost:11434", modelId: "llama3.2:3b" },
  remoteAgent: { host: "", modelId: "llama-3.1-8b-instant" },
  agentProvider: "localAgent",
  isChatEnabled: true,
};

describe("getConfigFromPath", () => {
  test("parses valid config from file", async () => {
    const path = `/tmp/uplink-mcp-config-${Date.now()}.json`;
    await Bun.write(path, JSON.stringify(minimalConfig));
    try {
      const config = await getConfigFromPath(path);
      expect(config.mcpServers).toEqual(minimalConfig.mcpServers);
      expect(config.localAgent).toEqual(minimalConfig.localAgent);
      expect(config.remoteAgent).toEqual(minimalConfig.remoteAgent);
      expect(config.agentProvider).toBe(minimalConfig.agentProvider);
      expect(config.isChatEnabled).toBe(minimalConfig.isChatEnabled);
    } finally {
      await rm(path, { force: true });
    }
  });

  test("throws when file does not exist", async () => {
    await expect(
      getConfigFromPath("/nonexistent-mcp-config-12345.json")
    ).rejects.toThrow();
  });
});

describe("getConfig", () => {
  test("reads and returns config with expected shape", async () => {
    resetConfigCache();
    try {
      const config = await getConfig();
      expect(config).toHaveProperty("mcpServers");
      expect(config).toHaveProperty("localAgent");
      expect(config).toHaveProperty("remoteAgent");
      expect(config).toHaveProperty("agentProvider");
      expect(config).toHaveProperty("isChatEnabled");
      expect(typeof config.mcpServers).toBe("object");
      expect(config.localAgent).toHaveProperty("host");
      expect(config.localAgent).toHaveProperty("modelId");
      expect(["localAgent", "remoteAgent"]).toContain(config.agentProvider);
    } finally {
      resetConfigCache();
    }
  });
});
