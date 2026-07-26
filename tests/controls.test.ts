import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controls } from "@/lib/controls";
import { parseTemplateVersion } from "@/lib/template-version";

describe("controls", () => {
  it("exposes a non-empty set, each with an id and title", () => {
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.id).toBeTruthy();
      expect(control.title).toBeTruthy();
    }
  });

  it("has unique ids", () => {
    const ids = controls.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("template version", () => {
  it("parses the airlock@vN marker shape", () => {
    expect(parseTemplateVersion("airlock@v1")).toEqual({ full: "airlock@v1", tag: "v1" });
    expect(() => parseTemplateVersion("v1")).toThrow();
  });

  it("the committed TEMPLATE_VERSION marker is well-formed", () => {
    const raw = readFileSync(join(__dirname, "..", ".github", "TEMPLATE_VERSION"), "utf8");
    expect(parseTemplateVersion(raw).tag).toMatch(/^v\d+$/);
  });
});
