import { mkdir } from "node:fs/promises";
import { log } from "@clack/prompts";

export async function ensureDirs(dirs: string[]): Promise<string[]> {
  let ensured: string[] = [];
  for (const dir of dirs) {
    try {
      await mkdir(dir, { recursive: true });
      ensured.push(dir);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      log.warn(`Unable to use directory ${dir}: ${message}`);
    }
  }
  return ensured;
}