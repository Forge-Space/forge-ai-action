# Changelog

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
