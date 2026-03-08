import {
  buildCommentBody,
  COMMENT_MARKER,
} from '../src/comment.js';
import type { ActionResult } from '../src/types.js';

function makeResult(
  overrides: Partial<ActionResult> = {},
): ActionResult {
  return {
    score: 78,
    grade: 'B+',
    delta: 3,
    passed: true,
    findings: [],
    categories: [
      { name: 'security', score: 92 },
      { name: 'architecture', score: 85 },
    ],
    summary: 'Gate Passed (78/60).',
    ...overrides,
  };
}

describe('buildCommentBody', () => {
  it('includes marker for update detection', () => {
    const body = buildCommentBody(makeResult());
    expect(body).toContain(COMMENT_MARKER);
  });

  it('shows score and grade', () => {
    const body = buildCommentBody(makeResult());
    expect(body).toContain('**78**/100 (B+)');
  });

  it('shows positive delta with plus sign', () => {
    const body = buildCommentBody(makeResult({ delta: 5 }));
    expect(body).toContain('**+5**');
  });

  it('shows negative delta without plus sign', () => {
    const body = buildCommentBody(makeResult({ delta: -3 }));
    expect(body).toContain('**-3**');
  });

  it('shows pass icon when passed', () => {
    const body = buildCommentBody(makeResult({ passed: true }));
    expect(body).toContain('\u2705');
    expect(body).toContain('**Passed**');
  });

  it('shows fail icon when failed', () => {
    const body = buildCommentBody(makeResult({ passed: false }));
    expect(body).toContain('\u274C');
    expect(body).toContain('**Failed**');
  });

  it('renders findings in details block', () => {
    const body = buildCommentBody(
      makeResult({
        findings: [
          {
            file: 'src/api.ts',
            rule: 'empty-catch',
            severity: 'medium',
            message: 'Empty catch block',
          },
        ],
      }),
    );
    expect(body).toContain('<details open>');
    expect(body).toContain('New findings');
    expect(body).toContain('`empty-catch`');
    expect(body).toContain('`src/api.ts`');
  });

  it('truncates findings at 25', () => {
    const findings = Array.from({ length: 30 }, (_, i) => ({
      file: `src/file${i}.ts`,
      rule: 'test-rule',
      severity: 'low',
      message: `Finding ${i}`,
    }));
    const body = buildCommentBody(makeResult({ findings }));
    expect(body).toContain('and 5 more findings');
  });

  it('renders category scores in collapsible table', () => {
    const body = buildCommentBody(makeResult());
    expect(body).toContain('<details>');
    expect(body).toContain('Category scores');
    expect(body).toContain('security');
    expect(body).toContain('92');
    expect(body).toContain('architecture');
    expect(body).toContain('85');
  });

  it('hides findings section when empty', () => {
    const body = buildCommentBody(makeResult({ findings: [] }));
    expect(body).not.toContain('New findings');
  });

  it('includes footer links', () => {
    const body = buildCommentBody(makeResult());
    expect(body).toContain('forge-ai-action');
    expect(body).toContain('forgespace.co');
  });

  it('shows file line number when available', () => {
    const body = buildCommentBody(
      makeResult({
        findings: [
          {
            file: 'src/api.ts',
            line: 42,
            rule: 'any-type',
            severity: 'low',
            message: 'Avoid any',
          },
        ],
      }),
    );
    expect(body).toContain('`src/api.ts:42`');
  });

  it('escapes pipe characters in messages', () => {
    const body = buildCommentBody(
      makeResult({
        findings: [
          {
            file: 'src/index.ts',
            rule: 'no-any',
            severity: 'high',
            message: 'Type A | B should use union',
          },
        ],
      }),
    );
    expect(body).toContain('Type A \\| B should use union');
    expect(body).not.toMatch(/\| Type A \| B/);
  });

  it('truncates long messages', () => {
    const longMessage = 'A'.repeat(120);
    const body = buildCommentBody(
      makeResult({
        findings: [
          {
            file: 'src/index.ts',
            rule: 'test',
            severity: 'low',
            message: longMessage,
          },
        ],
      }),
    );
    expect(body).toContain('\u2026');
    expect(body).not.toContain(longMessage);
  });
});
