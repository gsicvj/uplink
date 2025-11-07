import { z } from "zod";

const envSchema = z.object({
  GROQ_API_KEY: z.string().min(1, "Missing groq api key"),
  BUNNY_API_KEY: z.string().min(1, "Missing bunny api key"),
  BUNNY_STORAGE_ZONE_NAME: z.string().min(1, "Missing storage zone name"),
  BUNNY_STORAGE_ACCESS_KEY: z.string().min(1, "Missing storage access key"),
  BUNNY_PULLZONE_URL: z.string().url("Missing pullzone URL"),
});

export const env = envSchema.parse(Bun.env);

export type Env = z.infer<typeof envSchema>;
