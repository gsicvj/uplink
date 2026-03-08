import { describe, expect, test } from "bun:test";
import { isPathAllowed } from "./tools";

describe("isPathAllowed", () => {
  test("allows path that equals normalized dir", () => {
    expect(isPathAllowed("uploads", ["uploads"])).toBe(true);
    expect(isPathAllowed("/uploads", ["uploads"])).toBe(true);
    expect(isPathAllowed("./uploads", ["uploads"])).toBe(true);
  });

  test("allows path that is subpath of allowed dir", () => {
    expect(isPathAllowed("uploads/img", ["uploads"])).toBe(true);
    expect(isPathAllowed("/uploads/img/photo.png", ["/uploads"])).toBe(true);
    expect(isPathAllowed("a/b/c", ["a"])).toBe(true);
  });

  test("rejects path outside allowed dirs", () => {
    expect(isPathAllowed("other", ["uploads"])).toBe(false);
    expect(isPathAllowed("uploads2/img", ["uploads"])).toBe(false);
    expect(isPathAllowed("x/uploads", ["uploads"])).toBe(false);
  });

  test("empty allowed dir allows everything", () => {
    expect(isPathAllowed("anything", [""])).toBe(true);
    expect(isPathAllowed("/foo/bar", [""])).toBe(true);
  });

  test("root slash as allowed dir allows everything", () => {
    expect(isPathAllowed("foo", ["/"])).toBe(true);
    expect(isPathAllowed("/foo/bar", ["/"])).toBe(true);
  });

  test("allows if path matches any of multiple allowed dirs", () => {
    expect(
      isPathAllowed("uploads/img", ["downloads", "uploads"])
    ).toBe(true);
    expect(
      isPathAllowed("downloads/asset", ["downloads", "uploads"])
    ).toBe(true);
  });

  test("rejects when no dir matches", () => {
    expect(
      isPathAllowed("other/file", ["downloads", "uploads"])
    ).toBe(false);
  });

  test("normalizes allowed dirs (strip ./ and /)", () => {
    expect(isPathAllowed("uploads/x", ["./uploads"])).toBe(true);
    expect(isPathAllowed("uploads/x", ["/uploads"])).toBe(true);
  });
});
