import { z } from "zod";

export const envSchema = z.object({
  GROQ_API_KEY: z.string().min(1, "Missing groq api key"),
  BUNNY_STORAGE_ZONE_NAME: z.string().min(1, "Missing storage zone name"),
  BUNNY_STORAGE_ACCESS_KEY: z.string().min(1, "Missing storage access key"),
  BUNNY_PULLZONE_URL: z.string().url("Missing pullzone URL"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

function getEnv(): Env {
  if (_env === null) {
    _env = envSchema.parse(Bun.env);
  }
  return _env;
}

/** Parsed env (lazy: validated on first access so tests can load modules without setting CI env vars). */
export const env = new Proxy({} as Env, {
  get(_, key: keyof Env) {
    return getEnv()[key];
  },
});
