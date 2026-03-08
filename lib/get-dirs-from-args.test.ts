import { describe, expect, test } from "bun:test";
import { getDirsFromArgs } from "./get-dirs-from-args";

describe("getDirsFromArgs", () => {
  test("returns empty local and remote when no args", () => {
    expect(getDirsFromArgs([])).toEqual({
      localDirs: [],
      remoteDirs: [],
    });
  });

  test("parses --local followed by dirs", () => {
    expect(getDirsFromArgs(["--local", "/tmp", "./src"])).toEqual({
      localDirs: ["/tmp", "./src"],
      remoteDirs: [],
    });
  });

  test("parses --remote followed by dirs", () => {
    expect(getDirsFromArgs(["--remote", "/uploads", "public"])).toEqual({
      localDirs: [],
      remoteDirs: ["/uploads", "public"],
    });
  });

  test("switches to remote after --remote", () => {
    expect(
      getDirsFromArgs(["--local", "/tmp", "--remote", "/cloud", "backup"])
    ).toEqual({
      localDirs: ["/tmp"],
      remoteDirs: ["/cloud", "backup"],
    });
  });

  test("switches back to local after --local", () => {
    expect(
      getDirsFromArgs(["--remote", "/cloud", "--local", "./src", "./lib"])
    ).toEqual({
      localDirs: ["./src", "./lib"],
      remoteDirs: ["/cloud"],
    });
  });

  test("ignores args before any flag", () => {
    expect(getDirsFromArgs(["bun", "run", "host.ts", "--local", "/tmp"])).toEqual({
      localDirs: ["/tmp"],
      remoteDirs: [],
    });
  });

  test("both local and remote with multiple switches", () => {
    expect(
      getDirsFromArgs([
        "--local",
        "a",
        "b",
        "--remote",
        "x",
        "--local",
        "c",
      ])
    ).toEqual({
      localDirs: ["a", "b", "c"],
      remoteDirs: ["x"],
    });
  });
});
