# Changelog

## [Unreleased]

### Changed

- Tenant context is now mandatory for all action commands:
  - `tenant`
  - `tenant_profile_ref`
- Added tenant profile loader/validator with fail-fast behavior on missing, invalid,
  or mismatched profile data.
- `test-autogen-check` now forwards tenant context to `forge-ai-init`.

## v1.2.0 (2026-03-10)

### Features

- Added `test-autogen-check` command for PR/CI parity with `forge-ai-init test-autogen`.
- Added phased enforcement input `test_autogen_phase`:
  - `warn` (non-blocking),
  - `phase1` (block missing unit/integration),
  - `phase2` (block missing unit/integration/e2e).
- New PR findings support for missing required generated tests.

### Fixed

- Hardened command execution in `test-autogen-check` to avoid shell-based command injection patterns.
- Improved `gate` base-ref resolution in CI to avoid failures when `main` is not available as a local branch.
- Added explicit Sonar configuration to exclude generated artifacts and avoid false-positive duplication in
  action wrapper code.

## v1.1.0 (2026-03-08)

### Features

- `assess` command — full project health assessment (5 categories)
- `migrate` command — migration toolkit with phased roadmap
  - Health assessment across dependencies, architecture, security, quality, migration-readiness
  - Strangler boundary detection for safe module decomposition
  - TypeScript migration plan with prioritized file list
  - Dependency risk analysis with replacement recommendations
  - Phased migration roadmap with quality gates per phase
  - Estimated effort calculation
- Migration-specific PR comment with collapsible sections
- New outputs: `readiness` (ready/needs-work/high-risk), `strategy` (migration strategy)
- 109 scanner rules (up from 89) via forge-ai-init ^0.20.0

### Fixed

- PR comment formatting improvements (collapsible sections, severity badges)

## v1.0.0 (2026-03-08)

### Features

- Quality gate command with configurable threshold
- Full project scan command
- PR delta analysis (before/after quality comparison)
- PR comment with score card, grade, findings table, category breakdown
- Inline file annotations (error/warning/notice by severity)
- Action outputs: score, delta, passed, findings-count
- Support for `.forgerc.json` configuration
- Update-in-place PR comments (no spam on re-push)
- 89 scanner rules across 10 categories via forge-ai-init
