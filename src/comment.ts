import type { GitHub } from '@actions/github/lib/utils.js';
import type { Context } from '@actions/github/lib/context.js';
import type { ActionResult } from './types.js';

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

export { buildCommentBody, COMMENT_MARKER };
