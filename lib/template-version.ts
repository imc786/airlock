import { readFileSync } from "node:fs";
import { join } from "node:path";

export type TemplateVersion = {
  full: string;
  tag: string;
};

// Marker shape shared with every consuming repo.
const MARKER = /^airlock@(v\d+)$/;

export function parseTemplateVersion(raw: string): TemplateVersion {
  const value = raw.trim();
  const match = MARKER.exec(value);
  if (!match) {
    throw new Error(`Malformed TEMPLATE_VERSION: expected "airlock@vN", got "${value}"`);
  }
  return { full: value, tag: match[1] };
}

// Build-time only: read from a statically rendered page, so it is never needed at request time.
export function readTemplateVersion(): TemplateVersion {
  const raw = readFileSync(join(process.cwd(), ".github", "TEMPLATE_VERSION"), "utf8");
  return parseTemplateVersion(raw);
}
