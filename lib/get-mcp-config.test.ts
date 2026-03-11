import { describe, expect, test } from "bun:test";
import { getConfig, resetConfigCache } from "./get-mcp-config";

describe("getConfig", () => {
  test("reads and returns config with expected shape", async () => {
    resetConfigCache();
    try {
      const config = await getConfig();
      expect(config).toHaveProperty("mcpServers");
      expect(config).toHaveProperty("providers");
      expect(config).toHaveProperty("agentProvider");
      expect(typeof config.mcpServers).toBe("object");
      expect(typeof config.providers).toBe("object");
      const activeProvider = config.providers[config.agentProvider];
      expect(activeProvider).toBeDefined();
      expect(activeProvider).toHaveProperty("host");
      expect(activeProvider).toHaveProperty("models");
    } finally {
      resetConfigCache();
    }
  });
});
