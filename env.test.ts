import { describe, expect, test } from "bun:test";
import { envSchema } from "./env";

describe("envSchema", () => {
  const validEnv = {
    GROQ_API_KEY: "sk-xxx",
    BUNNY_STORAGE_ZONE_NAME: "my-zone",
    BUNNY_STORAGE_ACCESS_KEY: "access-key",
    BUNNY_PULLZONE_URL: "https://cdn.example.com",
  };

  test("parses valid env", () => {
    expect(envSchema.parse(validEnv)).toEqual(validEnv);
  });

  test("rejects missing GROQ_API_KEY", () => {
    const { GROQ_API_KEY: _, ...rest } = validEnv;
    expect(() => envSchema.parse(rest)).toThrow();
  });

  test("rejects empty GROQ_API_KEY", () => {
    expect(() =>
      envSchema.parse({ ...validEnv, GROQ_API_KEY: "" })
    ).toThrow();
  });

  test("rejects missing BUNNY_STORAGE_ZONE_NAME", () => {
    const { BUNNY_STORAGE_ZONE_NAME: _, ...rest } = validEnv;
    expect(() => envSchema.parse(rest)).toThrow();
  });

  test("rejects missing BUNNY_STORAGE_ACCESS_KEY", () => {
    const { BUNNY_STORAGE_ACCESS_KEY: _, ...rest } = validEnv;
    expect(() => envSchema.parse(rest)).toThrow();
  });

  test("rejects invalid BUNNY_PULLZONE_URL", () => {
    expect(() =>
      envSchema.parse({ ...validEnv, BUNNY_PULLZONE_URL: "not-a-url" })
    ).toThrow();
  });

  test("rejects missing BUNNY_PULLZONE_URL", () => {
    const { BUNNY_PULLZONE_URL: _, ...rest } = validEnv;
    expect(() => envSchema.parse(rest)).toThrow();
  });
});
