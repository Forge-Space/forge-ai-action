# Forge AI Action

**Quality gates for AI-assisted code.** Prevent AI limbo engineering by scanning every PR for governance violations, quality regressions, and anti-patterns.

The only GitHub Action that measures whether AI is helping or hurting your codebase.

## Quick Start

```yaml
- uses: Forge-Space/forge-ai-action@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

That's it. Every PR gets a quality report with score, delta, findings, and a pass/fail gate.

## Usage

### Quality Gate (default)

Fails the check if the quality score drops below the threshold:

```yaml
name: Quality Gate
on: [pull_request]

jobs:
  forge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: Forge-Space/forge-ai-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          threshold: 75
```

### Scan Only

Report quality without blocking:

```yaml
- uses: Forge-Space/forge-ai-action@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    command: scan
```

### PR Delta

Show what changed compared to the base branch:

```yaml
- uses: Forge-Space/forge-ai-action@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    command: diff
```

### Health Assessment

Run a full project health assessment (5 categories):

```yaml
- uses: Forge-Space/forge-ai-action@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    command: assess
```

### Migration Assessment

Full migration toolkit — health assessment, strangler boundaries, TypeScript migration plan, dependency risks, and a phased roadmap with quality gates:

```yaml
- uses: Forge-Space/forge-ai-action@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    command: migrate
    threshold: 40
```

### Test Autogen Check

Validate whether changed production files have required generated tests.

```yaml
- uses: Forge-Space/forge-ai-action@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    command: test-autogen-check
    test_autogen_phase: phase1
```

The command uses argument-based process execution and branch-safe diff-base detection for CI runners.

Sonar analysis is configured via `sonar-project.properties` to ignore generated `dist/**` artifacts.

### Use Outputs

```yaml
- uses: Forge-Space/forge-ai-action@v1
  id: forge
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    command: migrate
- run: |
    echo "Score: ${{ steps.forge.outputs.score }}"
    echo "Readiness: ${{ steps.forge.outputs.readiness }}"
    echo "Strategy: ${{ steps.forge.outputs.strategy }}"
    echo "Passed: ${{ steps.forge.outputs.passed }}"
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `command` | `gate` | Command: `gate`, `scan`, `diff`, `assess`, `migrate`, or `test-autogen-check` |
| `threshold` | `60` | Minimum score (0-100) for gate command |
| `config` | auto | Path to `.forgerc.json` |
| `comment` | `true` | Post PR comment with results |
| `annotations` | `true` | Add inline file annotations |
| `test_autogen_phase` | `warn` | Enforcement phase for `test-autogen-check`: `warn`, `phase1`, `phase2` |

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Quality score (0-100) |
| `delta` | Score change vs base branch |
| `passed` | Whether the gate passed (`true`/`false`) |
| `findings-count` | Number of new findings |
| `readiness` | Migration readiness: `ready`, `needs-work`, `high-risk` (assess/migrate) |
| `strategy` | Recommended migration strategy (assess/migrate) |

## What It Scans

109 rules across 10 categories:

- **Security** — hardcoded secrets, SQL injection, XSS, eval usage
- **Architecture** — god files, circular deps, barrel file abuse
- **Error Handling** — empty catch, swallowed errors, missing error boundaries
- **AI Governance** — AI anti-patterns, vibe-coded shortcuts, limbo indicators
- **Code Quality** — any types, console.log, TODO/FIXME, magic numbers
- **Performance** — N+1 queries, missing indexes, sync I/O
- **Accessibility** — missing alt text, unlabeled form controls
- **Testing** — skipped tests, weak assertions
- **Migration** — legacy patterns, deprecated APIs
- **Scalability** — unbounded queries, missing pagination

Supports: TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Vue, Svelte

## Configuration

Create `.forgerc.json` in your repo root:

```json
{
  "preset": "recommended",
  "rules": {
    "console-log": { "severity": "off" }
  },
  "ignore": ["**/*.test.ts", "dist/**"]
}
```

## How It Works

1. Scans your codebase with [forge-ai-init](https://github.com/Forge-Space/forge-ai-init)'s 109-rule scanner
2. Compares against the base branch to compute quality delta
3. Posts a PR comment with score, grade, findings, and category breakdown
4. Adds inline annotations on files with issues
5. Sets a pass/fail status check based on your threshold

For `migrate` command, it additionally:
6. Assesses project health across 5 categories (deps, architecture, security, quality, migration-readiness)
7. Generates a phased migration roadmap with quality gates per phase
8. Identifies strangler boundaries, dependency risks, and TypeScript migration candidates

## License

MIT
