import { log } from "@clack/prompts";

export function parseToolArguments(
  args: string | Record<string, unknown>
): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch (error) {
      log.error(`Failed to parse tool arguments`);
      return { value: args };
    }
  }
  return args;
}
