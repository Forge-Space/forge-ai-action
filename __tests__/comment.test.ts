import {
  buildCommentBody,
  buildMigrateCommentBody,
  COMMENT_MARKER,
} from '../src/comment.js';
import type { ActionResult } from '../src/types.js';
import type { MigrateResult } from '../src/commands/migrate.js';

function makeResult(
  overrides: Partial<ActionResult> = {},
): ActionResult {
  return {
    score: 80,
    grade: 'B+',
    delta: 10,
    passed: true,
    findings: [],
    categories: [],
    summary: 'Test result',
    ...overrides,
  };
}

describe('Comment builder', () => {
  it('includes marker in comment', () => {
    const result = makeResult();
    const body = buildCommentBody(result);
    expect(body).toContain(COMMENT_MARKER);
  });

  it('includes gate status', () => {
    const passed = makeResult({ passed: true });
    expect(buildCommentBody(passed)).toContain('Passed');
    expect(buildCommentBody(passed)).toContain('\u2705');

    const failed = makeResult({ passed: false });
    expect(buildCommentBody(failed)).toContain('Failed');
    expect(buildCommentBody(failed)).toContain('\u274C');
  });

  it('includes score and grade', () => {
    const result = makeResult({ score: 75, grade: 'B' });
    const body = buildCommentBody(result);
    expect(body).toContain('75');
    expect(body).toContain('(B)');
  });

  it('includes delta with sign', () => {
    const positive = makeResult({ delta: 5 });
    expect(buildCommentBody(positive)).toContain('+5');

    const negative = makeResult({ delta: -3 });
    expect(buildCommentBody(negative)).toContain('-3');
  });

  it('includes findings count with singular', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/api.ts',
          rule: 'test-rule',
          severity: 'low',
          message: 'Test message',
        },
      ],
    });
    expect(buildCommentBody(result)).toContain('1 new finding');
  });

  it('includes findings count with plural', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/file1.ts',
          rule: 'rule1',
          severity: 'low',
          message: 'Message 1',
        },
        {
          file: 'src/file2.ts',
          rule: 'rule2',
          severity: 'medium',
          message: 'Message 2',
        },
      ],
    });
    expect(buildCommentBody(result)).toContain('2 new findings');
  });

  it('shows categories when present', () => {
    const result = makeResult({
      categories: [
        { name: 'Security', score: 85 },
        { name: 'Performance', score: 75 },
      ],
    });
    const body = buildCommentBody(result);
    expect(body).toContain('Category scores');
    expect(body).toContain('Security');
    expect(body).toContain('Performance');
  });

  it('hides categories when empty', () => {
    const result = makeResult({ categories: [] });
    const body = buildCommentBody(result);
    expect(body).not.toContain('Category scores');
  });

  it('displays findings table when present', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/api.ts',
          rule: 'no-console',
          severity: 'low',
          message: 'Found console.log',
        },
      ],
    });
    const body = buildCommentBody(result);
    expect(body).toContain('New findings');
    expect(body).toContain('no-console');
    expect(body).toContain('Found console.log');
    expect(body).toContain('<details open>');
  });

  it('hides findings when empty', () => {
    const result = makeResult({ findings: [] });
    const body = buildCommentBody(result);
    expect(body).not.toContain('<details open>');
  });

  it('escapes pipe characters in message', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/api.ts',
          rule: 'test|rule',
          severity: 'low',
          message: 'Message | with pipes',
        },
      ],
    });
    const body = buildCommentBody(result);
    expect(body).toContain('test\\|rule');
    expect(body).toContain('Message \\| with pipes');
  });

  it('escapes pipe characters in file names', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src|file.ts',
          rule: 'test',
          severity: 'low',
          message: 'Test',
        },
      ],
    });
    const body = buildCommentBody(result);
    expect(body).toContain('src\\|file.ts');
  });

  it('formats findings with line numbers', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/api.ts',
          rule: 'empty-catch',
          severity: 'medium',
          message: 'Empty catch block',
          line: 42,
        },
      ],
    });
    expect(buildCommentBody(result)).toContain('<details open>');
    expect(buildCommentBody(result)).toContain('New findings');
    expect(buildCommentBody(result)).toContain('`empty-catch`');
    expect(buildCommentBody(result)).toContain('`src/api.ts:42`');
  });

  it('truncates findings at 25', () => {
    const findings = Array.from({ length: 30 }, (_, i) => ({
      file: `src/file${i}.ts`,
      rule: 'test-rule',
      severity: 'low' as const,
      message: `Message ${i}`,
    }));
    const result = makeResult({ findings });
    const body = buildCommentBody(result);
    expect(body).toContain('and 5 more findings');
  });

  it('shows correct severity badge for critical', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/critical.ts',
          rule: 'critical-rule',
          severity: 'critical',
          message: 'Critical issue',
        },
      ],
    });
    expect(buildCommentBody(result)).toContain('\u{1F534}');
  });

  it('shows correct severity badge for high', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/high.ts',
          rule: 'high-rule',
          severity: 'high',
          message: 'High issue',
        },
      ],
    });
    expect(buildCommentBody(result)).toContain('\u{1F7E0}');
  });

  it('shows correct severity badge for medium', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/medium.ts',
          rule: 'medium-rule',
          severity: 'medium',
          message: 'Medium issue',
        },
      ],
    });
    expect(buildCommentBody(result)).toContain('\u{1F7E1}');
  });

  it('shows correct severity badge for low', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/low.ts',
          rule: 'low-rule',
          severity: 'low',
          message: 'Low issue',
        },
      ],
    });
    expect(buildCommentBody(result)).toContain('\u{1F535}');
  });

  it('shows default badge for unknown severity', () => {
    const result = makeResult({
      findings: [
        {
          file: 'src/unknown.ts',
          rule: 'unknown-rule',
          severity: 'unknown',
          message: 'Unknown',
        },
      ],
    });
    expect(buildCommentBody(result)).toContain('\u26AA');
  });

  it('truncates long messages', () => {
    const longMessage = 'a'.repeat(100);
    const result = makeResult({
      findings: [
        {
          file: 'src/api.ts',
          rule: 'test-rule',
          severity: 'low',
          message: longMessage,
        },
      ],
    });
    const body = buildCommentBody(result);
    expect(body).toContain('\u2026');
    expect(body).not.toContain(longMessage);
  });

  it('includes footer with links', () => {
    const result = makeResult();
    const body = buildCommentBody(result);
    expect(body).toContain('Forge AI Action');
    expect(body).toContain('forgespace.co');
  });
});

describe('Migrate Comment Builder', () => {
  const makeMigrateResult = (
    overrides: Partial<MigrateResult> = {},
  ): MigrateResult => {
    return {
      score: 75,
      grade: 'B',
      delta: 0,
      passed: true,
      findings: [],
      categories: [],
      summary: 'Test migration',
      migrationReadiness: 'ready',
      migrationStrategy: 'Incremental',
      migrationPlan: {
        strategy: 'Incremental',
        strategyDescription: 'Incremental typing',
        boundaries: [],
        typingSteps: [],
        dependencyRisks: [],
        phases: [],
        estimatedEffort: '2 weeks',
      },
      ...overrides,
    };
  };

  it('includes migration marker', () => {
    const result = makeMigrateResult();
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('<!-- forge-ai-migrate -->');
  });

  it('displays migration readiness status', () => {
    const result = makeMigrateResult({ migrationReadiness: 'ready' });
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('ready');
    expect(body).toContain('\u2705');
  });

  it('displays strategy and description', () => {
    const result = makeMigrateResult({
      migrationStrategy: 'Phased',
      migrationPlan: {
        strategy: 'Phased',
        strategyDescription: 'Phase-based migration',
        boundaries: [],
        typingSteps: [],
        dependencyRisks: [],
        phases: [],
        estimatedEffort: '4 weeks',
      },
    });
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('Phased');
    expect(body).toContain('Phase-based migration');
  });

  it('displays estimated effort', () => {
    const result = makeMigrateResult({
      migrationPlan: {
        strategy: 'Test',
        strategyDescription: 'Test',
        boundaries: [],
        typingSteps: [],
        dependencyRisks: [],
        phases: [],
        estimatedEffort: '6-8 weeks',
      },
    });
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('6-8 weeks');
  });

  it('displays health categories', () => {
    const result = makeMigrateResult({
      categories: [
        { name: 'Architecture', score: 85 },
        { name: 'Testing', score: 60 },
      ],
    });
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('Health Categories');
    expect(body).toContain('Architecture');
    expect(body).toContain('85');
  });

  it('shows migration phases', () => {
    const result = makeMigrateResult({
      migrationPlan: {
        strategy: 'Multi-phase',
        strategyDescription: 'Multi-phase',
        boundaries: [],
        typingSteps: [],
        dependencyRisks: [],
        phases: [
          {
            name: 'Phase 1',
            description: 'Setup',
            tasks: ['Update config'],
            gate: 'Compiles',
          },
        ],
        estimatedEffort: '1 week',
      },
    });
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('Phase 1');
    expect(body).toContain('Setup');
    expect(body).toContain('Update config');
  });

  it('shows dependency risks', () => {
    const result = makeMigrateResult({
      migrationPlan: {
        strategy: 'Test',
        strategyDescription: 'Test',
        boundaries: [],
        typingSteps: [],
        dependencyRisks: [
          {
            name: '@types/node',
            issue: 'Outdated',
            severity: 'high',
            recommendation: 'Update',
          },
        ],
        phases: [],
        estimatedEffort: '1 week',
      },
    });
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('Dependency risks');
    expect(body).toContain('@types/node');
    expect(body).toContain('Update');
  });

  it('shows strangler boundaries', () => {
    const result = makeMigrateResult({
      migrationPlan: {
        strategy: 'Test',
        strategyDescription: 'Test',
        boundaries: [
          {
            module: 'src/api',
            type: 'API',
            complexity: 'high',
            reason: 'Public interface',
          },
        ],
        typingSteps: [],
        dependencyRisks: [],
        phases: [],
        estimatedEffort: '1 week',
      },
    });
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('Strangler boundaries');
    expect(body).toContain('src/api');
  });

  it('shows TypeScript migration steps', () => {
    const result = makeMigrateResult({
      migrationPlan: {
        strategy: 'Test',
        strategyDescription: 'Test',
        boundaries: [],
        typingSteps: [
          {
            file: 'src/types.ts',
            priority: 'high',
            reason: 'Core types',
          },
        ],
        dependencyRisks: [],
        phases: [],
        estimatedEffort: '1 week',
      },
    });
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('TypeScript migration');
    expect(body).toContain('src/types.ts');
    expect(body).toContain('Core types');
  });

  it('displays findings', () => {
    const result = makeMigrateResult({
      findings: [
        {
          file: 'src/index.ts',
          rule: 'partial-types',
          severity: 'high',
          message: 'Type coverage incomplete',
        },
      ],
    });
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('All findings');
    expect(body).toContain('partial-types');
  });

  it('includes footer', () => {
    const result = makeMigrateResult();
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('Forge AI Action');
    expect(body).toContain('forgespace.co');
  });
});
