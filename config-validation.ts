import { z } from "zod";

/*
  TODO:
  - Firstly align Zod schemas with what current config is.
  - In a separate task, go ahead and simplify config and zod schemas.
*/
export const mcpServerSchema = z.object({
  command: z.string().min(1, "Missing command to run the MCP server."),
  args: z.array(z.string()).min(1, "Missing MCP server arguments."),
  vargs: z.array(z.string()).describe("Additional arguments that the MCP server might need."),
  env: z.record(z.string(), z.string()).optional().describe("Environment variables needed by the MCP server, specified as key-value pairs."),
  roots: z.array(z.object({
    uri: z.string(),
    name: z.string()
  })).optional()
})

export const agentSchema = z.object({
  host: z.string().min(1, "Missing agent host.").describe("The URL of the model provider server."),
  modelId: z.string().min(1, "Missing model id.").describe("The unique identifier for the selected model."),
  models: z.array(z.string().min(1, "Missing a proper model name.")).describe("The list of available model identifiers that the agent can use.").min(1)
});

export const providersSchema = z.record(z.string(), agentSchema);

export const configSchema = z.object({
  mcpServers: z.record(z.string(), mcpServerSchema),
  providers: providersSchema,
  agentProvider: z.string(),
}).superRefine((cfg, ctx) => {
  if (!(Object.hasOwn(cfg.providers, cfg.agentProvider))) {
    ctx.addIssue({
      code: "custom",
      path: ["agentProvider"],
      message: "agentProvider must be a key of providers"
    })
  }
});

export type McpServerConfig = z.infer<typeof mcpServerSchema>;

export type AgentConfig = z.infer<typeof agentSchema>;

export type Providers = z.infer<typeof providersSchema>;

export type ProviderOption = keyof z.infer<typeof providersSchema>;

export type McpConfig = z.infer<typeof configSchema>;

export const validateMcpConfig = (data: unknown): McpConfig => configSchema.parse(data);