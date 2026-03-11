import { describe, expect, test } from "bun:test";
import { ensureDirs } from "./ensure-dirs";

describe("ensureDirs", () => {
  test("returns provided directories when mkdir succeeds", async () => {
    const dirs = ["tmp-lib-dir-a", "tmp-lib-dir-b"];
    const ensured = await ensureDirs(dirs);

    expect(ensured).toEqual(dirs);
  });
});

