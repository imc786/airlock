import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Biome 2 globs are relative to the config, so "*.ts" matches root files only. Lint a nested file with the
// shipped biome.json and the installed Biome, so a glob or version change shows up here rather than in
// coverage that quietly stops applying.

const ROOT = join(__dirname, "..");

function lintNested(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), "biome-config-"));
  try {
    copyFileSync(join(ROOT, "biome.json"), join(dir, "biome.json"));
    mkdirSync(join(dir, "nested", "deep"), { recursive: true });
    writeFileSync(join(dir, "nested", "deep", "fixture.ts"), source);
    try {
      return execFileSync(
        join(ROOT, "node_modules", ".bin", "biome"),
        ["lint", "--vcs-enabled=false", "--reporter=github", "."],
        { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      return (error as { stdout: string }).stdout;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("biome.json TypeScript override", () => {
  // The useConst hit proves Biome ran and applied the override, so the absence below is not vacuous.
  it("reaches nested files, so test-runner globals are left to tsc", () => {
    const out = lintNested('let suite = "x";\ndescribe(suite, () => undefined);\n');
    expect(out).toContain("lint/style/useConst");
    expect(out).not.toContain("noUndeclaredVariables");
  });

  it("applies its TypeScript-only rules to nested files too", () => {
    expect(lintNested("export function f(): number {\n  let n = 1;\n  return n;\n}\n")).toContain(
      "lint/style/useConst",
    );
  });

  // tsc reports unreachable code only when allowUnreachableCode is false, so Biome keeps this rule.
  it("keeps unreachable-code detection on", () => {
    const out = lintNested('export function f(): number {\n  return 1;\n  console.log("never");\n}\n');
    expect(out).toContain("lint/correctness/noUnreachable");
  });
});
