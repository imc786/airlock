export type Control = {
  id: string;
  title: string;
  summary: string;
};

export const controls: Control[] = [
  {
    id: "audit-regenerator",
    title: "Two-pass audit regenerator",
    summary:
      "The daily audit job rebuilds the managed pnpm overrides from a base template every run, so stale overrides are pruned instead of accumulating forever.",
  },
  {
    id: "min-release-age",
    title: "Strict minimumReleaseAge + trustLockfile",
    summary:
      "A one-day supply-chain quarantine on resolution, paired with trustLockfile so the committed lockfile still installs cleanly on cold CI runners.",
  },
  {
    id: "allow-builds",
    title: "Deny-by-default build scripts",
    summary:
      "pnpm 11 blocks dependency build scripts unless each is explicitly allowed, keeping the install-time attack surface minimal.",
  },
  {
    id: "cooldown",
    title: "Dependabot cooldown",
    summary:
      "Version updates wait out a cooldown window before adoption; security fixes bypass it, so CVE patches still land immediately.",
  },
  {
    id: "preview-e2e",
    title: "Vercel preview e2e gate",
    summary:
      "Playwright runs once against the real Vercel preview deployment, so auto-merge is gated on the deployed runtime, not just a local build.",
  },
  {
    id: "sha-matched-merge",
    title: "SHA-matched unattended auto-merge",
    summary:
      "Audit and Dependabot PRs merge only after every gate passes, pinned to the exact commit that was tested, with a blast-radius guard on the audit lane.",
  },
];
