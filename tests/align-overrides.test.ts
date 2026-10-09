import { describe, expect, it } from "vitest";
import { alignOverrides as align } from "../.github/scripts/align-overrides.mjs";

const wrap = (overrides: string[]) =>
  `minimumReleaseAge: 1440\noverrides:\n${overrides.map((l) => `  ${l}`).join("\n")}\n\ntrustLockfile: true\n`;
const BASE = wrap(["sharp@<0.34.0: 0.34.5"]);

describe("alignOverrides", () => {
  it("raises stacked selectors for one package to the highest target", () => {
    const input = wrap(["smol-toml@<1.6.1: ^1.6.1", "smol-toml@<=1.7.0: ^1.7.1", "smol-toml@<=1.8.0: ^1.9.0"]);
    expect(align(input, BASE)).toBe(
      wrap(["smol-toml@<1.6.1: ^1.9.0", "smol-toml@<=1.7.0: ^1.9.0", "smol-toml@<=1.8.0: ^1.9.0"]),
    );
  });

  it("compares targets numerically, not as strings", () => {
    const input = wrap(["foo@<1.2.0: ^1.2.0", "foo@<1.10.0: ^1.10.0"]);
    expect(align(input, BASE)).toBe(wrap(["foo@<1.2.0: ^1.10.0", "foo@<1.10.0: ^1.10.0"]));
  });

  it("keeps majors apart", () => {
    const input = wrap(["next@>=15.0.0 <15.5.9: ^15.5.9", "next@>=16.0.0 <16.3.8: ^16.3.8"]);
    expect(align(input, BASE)).toBe(input);
  });

  it("leaves base overrides and non-caret pins untouched", () => {
    const base = wrap(["foo@<1.0.0: ^1.5.0", "bar@<2.0.0: 2.0.1"]);
    const input = wrap(["foo@<1.0.0: ^1.5.0", "foo@<1.4.0: ^1.4.0", "bar@<2.0.0: 2.0.1", "bar@<2.1.0: ^2.1.0"]);
    expect(align(input, base)).toBe(
      wrap(["foo@<1.0.0: ^1.5.0", "foo@<1.4.0: ^1.4.0", "bar@<2.0.0: 2.0.1", "bar@<2.1.0: ^2.1.0"]),
    );
  });

  it("handles scoped and quoted names and values", () => {
    const input = wrap([
      '"@scope/pkg@<1.2.3": ^1.2.3',
      "'@scope/pkg@<1.4.0': '^1.4.0'",
      '"plain@<1.0.0": "^1.0.1"',
      "plain@<1.0.2: ^1.0.3",
    ]);
    expect(align(input, BASE)).toBe(
      wrap([
        '"@scope/pkg@<1.2.3": ^1.4.0',
        "'@scope/pkg@<1.4.0': '^1.4.0'",
        '"plain@<1.0.0": "^1.0.3"',
        "plain@<1.0.2: ^1.0.3",
      ]),
    );
  });

  it("aligns CRLF files and keeps the line endings", () => {
    const input = wrap(["a@<1.1.0: ^1.1.0", "a@<1.2.0: ^1.2.0"]).replaceAll("\n", "\r\n");
    expect(align(input, BASE)).toBe(wrap(["a@<1.1.0: ^1.2.0", "a@<1.2.0: ^1.2.0"]).replaceAll("\n", "\r\n"));
  });

  it("recognises a base entry that pnpm re-quoted or re-spaced", () => {
    const base = wrap(["foo@<1.0.0: ^1.5.0"]);
    const input = wrap(['"foo@<1.0.0":   ^1.5.0', "foo@<1.4.0: ^1.4.0"]);
    expect(align(input, base)).toBe(input);
  });

  it("puts every 0.x target in one group", () => {
    const input = wrap(["a@<0.3.1: ^0.3.1", "a@<0.4.0: ^0.4.0"]);
    expect(align(input, BASE)).toBe(wrap(["a@<0.3.1: ^0.4.0", "a@<0.4.0: ^0.4.0"]));
  });

  it("skips prerelease targets", () => {
    const input = wrap(["a@<1.1.0: ^1.1.0-beta.1", "a@<1.2.0: ^1.2.0"]);
    expect(align(input, BASE)).toBe(input);
  });

  it("is idempotent", () => {
    const input = wrap(["a@<1.1.0: ^1.1.0", "a@<1.2.0: ^1.2.0", "@s/b@<2.0.1: ^2.0.1", "@s/b@<2.0.2: ^2.0.2"]);
    const once = align(input, BASE);
    expect(align(once, BASE)).toBe(once);
  });

  it("returns the text unchanged when nothing overlaps or there is no overrides block", () => {
    const input = wrap(["a@<1.1.0: ^1.1.0", "b@<2.0.0: ^2.0.1"]);
    expect(align(input, BASE)).toBe(input);
    expect(align("trustLockfile: true\n", BASE)).toBe("trustLockfile: true\n");
  });

  it("changes nothing outside the overrides block", () => {
    const input = `allowBuilds:\n  a@<1.0.0: ^1.0.0\n  a@<2.0.0: ^1.5.0\noverrides:\n  a@<1.0.0: ^1.0.0 # keep\n  a@<1.2.0: ^1.2.0\n`;
    expect(align(input, BASE)).toBe(
      `allowBuilds:\n  a@<1.0.0: ^1.0.0\n  a@<2.0.0: ^1.5.0\noverrides:\n  a@<1.0.0: ^1.2.0 # keep\n  a@<1.2.0: ^1.2.0\n`,
    );
  });
});
