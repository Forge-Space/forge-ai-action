import type { GitHub } from '@actions/github/lib/utils.js';
import type { Context } from '@actions/github/lib/context.js';
import type { ActionResult } from './types.js';
import type { MigrateResult } from './commands/migrate.js';

const COMMENT_MARKER = '<!-- forge-ai-action -->';

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '\u2026';
}

function buildCommentBody(result: ActionResult): string {
  const gateIcon = result.passed ? '\u2705' : '\u274C';
  const gateLabel = result.passed ? 'Passed' : 'Failed';
  const deltaSign = result.delta >= 0 ? '+' : '';

  const lines: string[] = [COMMENT_MARKER];

  lines.push(`## Forge AI Quality Gate`);
  lines.push('');
  lines.push(
    `${gateIcon} **${gateLabel}** &mdash; ` +
    `Score **${result.score}**/100 (${result.grade}) ` +
    `&middot; Delta **${deltaSign}${result.delta}** ` +
    `&middot; ${result.findings.length} new finding${result.findings.length === 1 ? '' : 's'}`,
  );
  lines.push('');

  if (result.categories.length > 0) {
    lines.push('<details>');
    lines.push('<summary>Category scores</summary>');
    lines.push('');
    lines.push('| Category | Score |');
    lines.push('|----------|------:|');
    for (const c of result.categories) {
      lines.push(`| ${escapeCell(c.name)} | ${c.score} |`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  if (result.findings.length > 0) {
    lines.push('<details open>');
    lines.push(
      `<summary>New findings (${result.findings.length})</summary>`,
    );
    lines.push('');
    lines.push('| Severity | Rule | File | Message |');
    lines.push('|:--------:|------|------|---------|');

    const shown = result.findings.slice(0, 25);
    for (const f of shown) {
      const sev = severityBadge(f.severity);
      const file = f.line
        ? `\`${escapeCell(f.file)}:${f.line}\``
        : `\`${escapeCell(f.file)}\``;
      const rule = `\`${escapeCell(f.rule)}\``;
      const msg = escapeCell(truncate(f.message, 80));
      lines.push(`| ${sev} | ${rule} | ${file} | ${msg} |`);
    }

    if (result.findings.length > 25) {
      lines.push('');
      lines.push(
        `*\u2026and ${result.findings.length - 25} more findings.*`,
      );
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push('---');
  lines.push(
    '<sub>Powered by ' +
    '<a href="https://github.com/Forge-Space/forge-ai-action">Forge AI Action</a>' +
    ' &middot; ' +
    '<a href="https://forgespace.co">forgespace.co</a></sub>',
  );

  return lines.join('\n');
}

function severityBadge(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return '\u{1F534}';
    case 'high':
      return '\u{1F7E0}';
    case 'medium':
      return '\u{1F7E1}';
    case 'low':
      return '\u{1F535}';
    default:
      return '\u26AA';
  }
}

export async function postComment(
  octokit: InstanceType<typeof GitHub>,
  context: Context,
  result: ActionResult,
): Promise<void> {
  const pr = context.payload.pull_request;
  if (!pr) return;

  const { owner, repo } = context.repo;
  const issueNumber = pr.number;

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const existing = comments.find(
    (c) => c.body?.includes(COMMENT_MARKER),
  );

  const body = buildCommentBody(result);

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}

const MIGRATE_MARKER = '<!-- forge-ai-migrate -->';

function readinessIcon(readiness: string): string {
  switch (readiness) {
    case 'ready':
      return '\u2705';
    case 'needs-work':
      return '\u{1F7E1}';
    case 'high-risk':
      return '\u274C';
    default:
      return '\u2753';
  }
}

function buildMigrateCommentBody(result: MigrateResult): string {
  const plan = result.migrationPlan;
  const rIcon = readinessIcon(result.migrationReadiness ?? '');
  const gateIcon = result.passed ? '\u2705' : '\u274C';
  const gateLabel = result.passed ? 'Passed' : 'Failed';

  const lines: string[] = [MIGRATE_MARKER];

  lines.push('## Forge AI Migration Assessment');
  lines.push('');
  lines.push(
    `${rIcon} **Readiness: ${result.migrationReadiness}** ` +
    `&mdash; Score **${result.score}**/100 (${result.grade}) ` +
    `&middot; ${gateIcon} Gate ${gateLabel}`,
  );
  lines.push('');

  lines.push(`**Strategy:** ${plan.strategy}`);
  lines.push(`> ${plan.strategyDescription}`);
  lines.push('');
  lines.push(`**Estimated Effort:** ${plan.estimatedEffort}`);
  lines.push('');

  if (result.categories.length > 0) {
    lines.push('### Health Categories');
    lines.push('');
    lines.push('| Category | Score | Grade |');
    lines.push('|----------|------:|:-----:|');
    for (const c of result.categories) {
      const g = gradeFromScore(c.score);
      const icon = c.score >= 75 ? '\u2705' : c.score >= 50 ? '\u{1F7E1}' : '\u274C';
      lines.push(
        `| ${escapeCell(c.name)} | ${c.score} | ${icon} ${g} |`,
      );
    }
    lines.push('');
  }

  if (plan.phases.length > 0) {
    lines.push('<details open>');
    lines.push(
      `<summary><strong>Migration Roadmap (${plan.phases.length} phases)</strong></summary>`,
    );
    lines.push('');

    for (const phase of plan.phases) {
      lines.push(`#### ${phase.name}`);
      lines.push(`> ${phase.description}`);
      lines.push('');
      for (const task of phase.tasks) {
        lines.push(`- [ ] ${task}`);
      }
      lines.push('');
      lines.push(`**Quality Gate:** ${phase.gate}`);
      lines.push('');
    }

    lines.push('</details>');
    lines.push('');
  }

  if (plan.dependencyRisks.length > 0) {
    lines.push('<details>');
    lines.push(
      `<summary>Dependency risks (${plan.dependencyRisks.length})</summary>`,
    );
    lines.push('');
    lines.push('| Package | Severity | Recommendation |');
    lines.push('|---------|:--------:|----------------|');
    for (const d of plan.dependencyRisks) {
      const sev = severityBadge(d.severity);
      lines.push(
        `| \`${escapeCell(d.name)}\` | ${sev} | ${escapeCell(d.recommendation)} |`,
      );
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  if (plan.boundaries.length > 0) {
    lines.push('<details>');
    lines.push(
      `<summary>Strangler boundaries (${plan.boundaries.length})</summary>`,
    );
    lines.push('');
    lines.push('| Module | Type | Complexity | Reason |');
    lines.push('|--------|:----:|:----------:|--------|');
    for (const b of plan.boundaries) {
      lines.push(
        `| \`${escapeCell(b.module)}\` | ${b.type} | ${b.complexity} | ${escapeCell(truncate(b.reason, 60))} |`,
      );
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  if (plan.typingSteps.length > 0) {
    lines.push('<details>');
    lines.push(
      `<summary>TypeScript migration (${plan.typingSteps.length} files)</summary>`,
    );
    lines.push('');
    lines.push('| File | Priority | Reason |');
    lines.push('|------|:--------:|--------|');
    for (const s of plan.typingSteps) {
      const icon =
        s.priority === 'high' ? '\u{1F534}' :
        s.priority === 'medium' ? '\u{1F7E1}' : '\u{1F535}';
      lines.push(
        `| \`${escapeCell(s.file)}\` | ${icon} ${s.priority} | ${escapeCell(truncate(s.reason, 60))} |`,
      );
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  if (result.findings.length > 0) {
    lines.push('<details>');
    lines.push(
      `<summary>All findings (${result.findings.length})</summary>`,
    );
    lines.push('');
    lines.push('| Severity | Issue | Detail |');
    lines.push('|:--------:|-------|--------|');
    const shown = result.findings.slice(0, 30);
    for (const f of shown) {
      const sev = severityBadge(f.severity);
      lines.push(
        `| ${sev} | ${escapeCell(f.rule)} | ${escapeCell(truncate(f.message, 80))} |`,
      );
    }
    if (result.findings.length > 30) {
      lines.push('');
      lines.push(
        `*\u2026and ${result.findings.length - 30} more.*`,
      );
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push('---');
  lines.push(
    '<sub>Powered by ' +
    '<a href="https://github.com/Forge-Space/forge-ai-action">Forge AI Action</a>' +
    ' &middot; ' +
    '<a href="https://forgespace.co">forgespace.co</a></sub>',
  );

  return lines.join('\n');
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export async function postMigrateComment(
  octokit: InstanceType<typeof GitHub>,
  context: Context,
  result: MigrateResult,
): Promise<void> {
  const pr = context.payload.pull_request;
  if (!pr) return;

  const { owner, repo } = context.repo;
  const issueNumber = pr.number;

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });

  const existing = comments.find(
    (c) => c.body?.includes(MIGRATE_MARKER),
  );

  const body = buildMigrateCommentBody(result);

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}

export {
  buildCommentBody,
  buildMigrateCommentBody,
  COMMENT_MARKER,
  MIGRATE_MARKER,
};
