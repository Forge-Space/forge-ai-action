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
    expect(body).toContain('**+5** vs base');
  });

  it('shows negative delta without plus sign', () => {
    const body = buildCommentBody(makeResult({ delta: -3 }));
    expect(body).toContain('**-3** vs base');
  });

  it('shows pass icon when passed', () => {
    const body = buildCommentBody(makeResult({ passed: true }));
    expect(body).toContain('\u2705 Passed');
  });

  it('shows fail icon when failed', () => {
    const body = buildCommentBody(makeResult({ passed: false }));
    expect(body).toContain('\u274C Failed');
  });

  it('renders findings table', () => {
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
    expect(body).toContain('### New Findings');
    expect(body).toContain('empty-catch');
    expect(body).toContain('`src/api.ts`');
  });

  it('truncates findings at 20', () => {
    const findings = Array.from({ length: 25 }, (_, i) => ({
      file: `src/file${i}.ts`,
      rule: 'test-rule',
      severity: 'low',
      message: `Finding ${i}`,
    }));
    const body = buildCommentBody(makeResult({ findings }));
    expect(body).toContain('...and 5 more findings');
  });

  it('renders category scores', () => {
    const body = buildCommentBody(makeResult());
    expect(body).toContain('`security: 92`');
    expect(body).toContain('`architecture: 85`');
  });

  it('hides findings section when empty', () => {
    const body = buildCommentBody(makeResult({ findings: [] }));
    expect(body).not.toContain('### New Findings');
  });

  it('includes footer links', () => {
    const body = buildCommentBody(makeResult());
    expect(body).toContain('forge-ai-init');
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
});
