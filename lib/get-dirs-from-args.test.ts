import { describe, expect, mock, test } from "bun:test";

const ensureDirsMock = mock(async (dirs: string[]) => dirs);

mock.module("./ensure-dirs", () => ({
  ensureDirs: ensureDirsMock,
}));

describe("getDirsFromArgs", () => {
  test("returns empty local and remote when no args", async () => {
    const { getDirsFromArgs } = await import("./get-dirs-from-args");
    const result = await getDirsFromArgs([]);
    expect(result).toEqual({
      localDirs: [],
      remoteDirs: [],
    });
  });

  test("parses --local followed by dirs", async () => {
    const { getDirsFromArgs } = await import("./get-dirs-from-args");
    const result = await getDirsFromArgs(["--local", "/tmp", "./src"]);
    expect(result).toEqual({
      localDirs: ["/tmp", "./src"],
      remoteDirs: [],
    });
  });

  test("parses --remote followed by dirs", async () => {
    const { getDirsFromArgs } = await import("./get-dirs-from-args");
    const result = await getDirsFromArgs(["--remote", "/uploads", "public"]);
    expect(result).toEqual({
      localDirs: [],
      remoteDirs: ["/uploads", "public"],
    });
  });

  test("switches to remote after --remote", async () => {
    const { getDirsFromArgs } = await import("./get-dirs-from-args");
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
    const { getDirsFromArgs } = await import("./get-dirs-from-args");
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
    const { getDirsFromArgs } = await import("./get-dirs-from-args");
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
    const { getDirsFromArgs } = await import("./get-dirs-from-args");
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
