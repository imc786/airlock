# Changelog

Notable changes to the Airlock template surface. Versions are the git tags adopters copy from; each
entry says what changed and any action needed when re-syncing a repo that copied an earlier tag.

Tags are immutable: a published tag is never moved, only superseded by a new one.

## v2 - 2026-07-27

- **audit.yml:** the PR body now reports the full advisory set the regenerated overrides address,
  captured against the natural post-reset state. Previously it captured against the committed lockfile
  (already fixed), so prune-only PRs carried an empty advisory section. The pure-prune and
  audit-did-not-complete cases now get their own distinct messages.
- **README:** documents the live-file adoption step (copy `pnpm-workspace.yaml`, not just the base, or
  the first CI install runs with no `trustLockfile`/`allowBuilds`), the overlapping-overrides
  behaviour of `--fix=override`, and the `--no-optional` audit scope.

**Adopter action:** re-copy `.github/workflows/audit.yml`, and make sure the live `pnpm-workspace.yaml`
is committed alongside `pnpm-workspace.base.yaml`.

## v1 - 2026-07-26

Initial release: two-pass audit regenerator, Vercel-preview-gated unattended auto-merge, Dependabot
with cooldown, SHA-pinned actions, and the pnpm 11 supply-chain settings. The unattended audit to
auto-merge round-trip was verified live before tagging.
