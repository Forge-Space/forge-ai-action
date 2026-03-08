import type { GitHub } from '@actions/github/lib/utils.js';
import type { Context } from '@actions/github/lib/context.js';
import type { ActionResult } from './types.js';

const COMMENT_MARKER = '<!-- forge-ai-action -->';

function buildCommentBody(result: ActionResult): string {
  const gateIcon = result.passed ? '\u2705' : '\u274C';
  const gateLabel = result.passed ? 'Passed' : 'Failed';
  const deltaSign = result.delta >= 0 ? '+' : '';

  let body = `${COMMENT_MARKER}\n`;
  body += `## \uD83D\uDEE1\uFE0F Forge Quality Report\n\n`;

  body += `| Metric | Value |\n`;
  body += `|--------|-------|\n`;
  body += `| Score | **${result.score}**/100 (${result.grade}) |\n`;
  body += `| Delta | **${deltaSign}${result.delta}** vs base |\n`;
  body += `| Gate | ${gateIcon} ${gateLabel} |\n`;
  body += `| Findings | ${result.findings.length} new |\n\n`;

  if (result.findings.length > 0) {
    body += `### New Findings\n\n`;
    body += `| File | Rule | Severity | Message |\n`;
    body += `|------|------|----------|---------|\n`;

    const shown = result.findings.slice(0, 20);
    for (const f of shown) {
      const file = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``;
      body += `| ${file} | ${f.rule} | ${f.severity} | ${f.message} |\n`;
    }

    if (result.findings.length > 20) {
      body += `\n*...and ${result.findings.length - 20} more findings.*\n`;
    }
    body += '\n';
  }

  if (result.categories.length > 0) {
    const cats = result.categories
      .map((c) => `\`${c.name}: ${c.score}\``)
      .join(' \u00B7 ');
    body += `### Category Scores\n${cats}\n\n`;
  }

  body += `---\n`;
  body += `<sub>Powered by <a href="https://github.com/Forge-Space/forge-ai-init">Forge AI</a>`;
  body += ` \u00B7 <a href="https://forgespace.co">forgespace.co</a></sub>\n`;

  return body;
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
