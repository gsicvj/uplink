import { describe, expect, mock, test } from "bun:test";

const ensureDirsMock = mock(async (dirs: string[]) => dirs);

mock.module("./ensure-dirs", () => ({
  ensureDirs: ensureDirsMock,
}));

describe("getDirsFromArgs", () => {
  test("returns empty local and remote when no args", async () => {
    const { getDirsFromArgs } = await import("./evaluate-args");
    const result = await getDirsFromArgs([]);
    expect(result).toEqual({
      localDirs: [],
      remoteDirs: [],
    });
  });

  test("parses --local followed by dirs", async () => {
    const { getDirsFromArgs } = await import("./evaluate-args");
    const result = await getDirsFromArgs(["--local", "/tmp", "./src"]);
    expect(result).toEqual({
      localDirs: ["/tmp", "./src"],
      remoteDirs: [],
    });
  });

  test("parses --remote followed by dirs", async () => {
    const { getDirsFromArgs } = await import("./evaluate-args");
    const result = await getDirsFromArgs(["--remote", "/uploads", "public"]);
    expect(result).toEqual({
      localDirs: [],
      remoteDirs: ["/uploads", "public"],
    });
  });

  test("switches to remote after --remote", async () => {
    const { getDirsFromArgs } = await import("./evaluate-args");
    const result = await getDirsFromArgs([
      "--local",
      "/tmp",
      "--remote",
      "/cloud",
      "backup",
    ]);
    expect(result).toEqual({
      localDirs: ["/tmp"],
      remoteDirs: ["/cloud", "backup"],
    });
  });

  test("switches back to local after --local", async () => {
    const { getDirsFromArgs } = await import("./evaluate-args");
    const result = await getDirsFromArgs([
      "--remote",
      "/cloud",
      "--local",
      "./src",
      "./lib",
    ]);
    expect(result).toEqual({
      localDirs: ["./src", "./lib"],
      remoteDirs: ["/cloud"],
    });
  });

  test("ignores args before any flag", async () => {
    const { getDirsFromArgs } = await import("./evaluate-args");
    const result = await getDirsFromArgs([
      "bun",
      "run",
      "host.ts",
      "--local",
      "/tmp",
    ]);
    expect(result).toEqual({
      localDirs: ["/tmp"],
      remoteDirs: [],
    });
  });

  test("both local and remote with multiple switches", async () => {
    const { getDirsFromArgs } = await import("./evaluate-args");
    const result = await getDirsFromArgs([
      "--local",
      "a",
      "b",
      "--remote",
      "x",
      "--local",
      "c",
    ]);
    expect(result).toEqual({
      localDirs: ["a", "b", "c"],
      remoteDirs: ["x"],
    });
  });
});

describe("getPromptFromArgs", () => {
  test("returns null when no --prompt arg is present", async () => {
    const { getPromptFromArgs } = await import("./evaluate-args");
    const result = await getPromptFromArgs(["bun", "run", "host.ts"]);
    expect(result).toBeNull();
  });

  test("returns the string following --prompt", async () => {
    const { getPromptFromArgs } = await import("./evaluate-args");
    const result = await getPromptFromArgs([
      "bun",
      "run",
      "host.ts",
      "--prompt",
      "hello world",
    ]);
    expect(result).toBe("hello world");
  });

  test("works regardless of arg order", async () => {
    const { getPromptFromArgs } = await import("./evaluate-args");
    const result = await getPromptFromArgs([
      "--local",
      "foo/",
      "--prompt",
      "upload files",
      "--remote",
      "/",
    ]);
    expect(result).toBe("upload files");
  });

  test("returns null when --prompt has no following value", async () => {
    const { getPromptFromArgs } = await import("./evaluate-args");
    const result = await getPromptFromArgs(["bun", "run", "host.ts", "--prompt"]);
    expect(result).toBeNull();
  });
});
