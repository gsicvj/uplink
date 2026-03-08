import { describe, expect, test } from "bun:test";
import { getClientArgs } from "./connect-to-mcp-servers";
import type { AllowedDirs } from "./get-dirs-from-args";

describe("getClientArgs", () => {
  const baseArgs = ["--some", "arg"];

  test("filesystem server concatenates localDirs to args", () => {
    const allowedDirs: AllowedDirs = {
      localDirs: ["/tmp", "./src"],
      remoteDirs: [],
    };
    expect(
      getClientArgs("filesystem", baseArgs, allowedDirs)
    ).toEqual(["--some", "arg", "/tmp", "./src"]);
  });

  test("filesystem server with empty localDirs returns only server args", () => {
    const allowedDirs: AllowedDirs = {
      localDirs: [],
      remoteDirs: ["/cloud"],
    };
    expect(getClientArgs("filesystem", baseArgs, allowedDirs)).toEqual([
      "--some",
      "arg",
    ]);
  });

  test("uplink server concatenates remoteDirs to args", () => {
    const allowedDirs: AllowedDirs = {
      localDirs: [],
      remoteDirs: ["/uploads", "public"],
    };
    expect(getClientArgs("uplink", baseArgs, allowedDirs)).toEqual([
      "--some",
      "arg",
      "/uploads",
      "public",
    ]);
  });

  test("uplink server with empty remoteDirs returns only server args", () => {
    const allowedDirs: AllowedDirs = {
      localDirs: ["/tmp"],
      remoteDirs: [],
    };
    expect(getClientArgs("uplink", baseArgs, allowedDirs)).toEqual([
      "--some",
      "arg",
    ]);
  });

  test("unknown server name returns server args unchanged", () => {
    const allowedDirs: AllowedDirs = {
      localDirs: ["/tmp"],
      remoteDirs: ["/cloud"],
    };
    expect(getClientArgs("other-server", baseArgs, allowedDirs)).toEqual(
      baseArgs
    );
  });

  test("empty server args with filesystem returns only localDirs", () => {
    const allowedDirs: AllowedDirs = {
      localDirs: ["/tmp"],
      remoteDirs: [],
    };
    expect(getClientArgs("filesystem", [], allowedDirs)).toEqual(["/tmp"]);
  });
});
