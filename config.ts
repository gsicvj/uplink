import { z } from "zod";

/*
  TODO:
  - Firstly align Zod schemas with what current config is.
  - In a separate task, go ahead and simplify config and zod schemas.
*/
export const mcpServerSchema = z.object({
  command: z.string().min(1, "Missing command to run the MCP server."),
  args: z.array(z.string()).min(1, "Missing MCP server arguments."),
  env: z.record(z.string()).optional(),
  roots: z.array(z.object({
    uri: z.string(),
    name: z.string()
  })).optional()
})

export const agentSchema = z.object({
  host: z.string().min(1, "Missing agent host.").describe("The URL of the model provider server."),
  modelId: z.string().min(1, "Missing model id.").describe("The unique identifier for the agent model."),
});

export const configSchema = z.object({
  mcpServers: z.record(mcpServerSchema),
  localAgent: agentSchema,
  remoteAgent: agentSchema,
  agentProvider: z.enum(["localAgent", "remoteAgent"]),
  isChatEnabled: z.boolean()
});

export type McpServerConfig = z.infer<typeof mcpServerSchema>;

export type AgentConfig = z.infer<typeof agentSchema>;

export type McpConfig = z.infer<typeof configSchema>;

export const validateMcpConfig = (data: unknown): McpConfig => configSchema.parse(data);