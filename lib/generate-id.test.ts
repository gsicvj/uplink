import { describe, expect, test } from "bun:test";
import { generateId } from "./generate-id";

const VALID_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

describe("generateId", () => {
  test("returns string of length 16", () => {
    expect(generateId()).toHaveLength(16);
  });

  test("uses only allowed charset", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateId();
      for (const char of id) {
        expect(VALID_CHARS).toContain(char);
      }
    }
  });

  test("produces different ids over many calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });
});
