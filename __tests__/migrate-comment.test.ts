import {
  buildMigrateCommentBody,
  MIGRATE_MARKER,
} from '../src/comment.js';
import type { MigrateResult } from '../src/commands/migrate.js';

function makeMigrateResult(
  overrides: Partial<MigrateResult> = {},
): MigrateResult {
  return {
    score: 45,
    grade: 'D',
    delta: 0,
    passed: false,
    findings: [
      {
        file: 'src/app.js',
        rule: 'No type checking',
        severity: 'high',
        message: 'No type checker — type errors reach production',
      },
      {
        file: '',
        rule: 'Legacy dependency: jquery',
        severity: 'medium',
        message: 'jQuery — migrate to modern framework',
      },
    ],
    categories: [
      { name: 'dependencies', score: 60 },
      { name: 'architecture', score: 40 },
      { name: 'security', score: 30 },
      { name: 'quality', score: 50 },
      { name: 'migration-readiness', score: 45 },
    ],
    summary: 'Migration Assessment: 45/100 (D). Readiness: needs-work.',
    migrationReadiness: 'needs-work',
    migrationStrategy: 'Branch by Abstraction',
    migrationPlan: {
      strategy: 'Branch by Abstraction',
      strategyDescription:
        'Abstract component boundaries, swap implementations behind stable interfaces',
      boundaries: [
        {
          module: 'src/god-file.js',
          type: 'service',
          complexity: 'high',
          reason: 'God file — too many responsibilities',
        },
      ],
      typingSteps: [
        {
          file: 'src/utils.js',
          priority: 'high',
          reason: 'Utility module — shared across codebase',
        },
        {
          file: 'src/config.js',
          priority: 'medium',
          reason: 'Config file — type safety for env',
        },
      ],
      dependencyRisks: [
        {
          name: 'jquery',
          issue: 'Legacy dependency',
          severity: 'high',
          recommendation: 'Replace with native DOM APIs',
        },
      ],
      phases: [
        {
          name: 'Phase 1: Stabilize',
          description: 'Fix critical issues, add safety net',
          tasks: [
            'Add characterization tests',
            'Set up CI pipeline',
            'Save quality baseline',
          ],
          gate: 'Score >= 40, zero critical findings',
        },
        {
          name: 'Phase 2: Modernize',
          description: 'Decompose modules, add types',
          tasks: [
            'Define interfaces for 1 boundary module(s)',
            'Convert 1 high-priority files to TypeScript',
          ],
          gate: 'Score >= 60, type checking passes',
        },
      ],
      estimatedEffort: '1-2 weeks',
    },
    ...overrides,
  };
}

describe('buildMigrateCommentBody', () => {
  it('includes migrate marker', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain(MIGRATE_MARKER);
  });

  it('shows readiness status', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('**Readiness: needs-work**');
  });

  it('shows strategy and description', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('Branch by Abstraction');
    expect(body).toContain('Abstract component boundaries');
  });

  it('shows estimated effort', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('1-2 weeks');
  });

  it('renders health categories with grades', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('dependencies');
    expect(body).toContain('| 60 |');
    expect(body).toContain('security');
    expect(body).toContain('| 30 |');
  });

  it('renders migration roadmap with phases', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('Migration Roadmap (2 phases)');
    expect(body).toContain('Phase 1: Stabilize');
    expect(body).toContain('Phase 2: Modernize');
    expect(body).toContain('Add characterization tests');
    expect(body).toContain('Score >= 40');
  });

  it('renders tasks as checkboxes', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('- [ ] Add characterization tests');
    expect(body).toContain('- [ ] Set up CI pipeline');
  });

  it('renders dependency risks', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('Dependency risks (1)');
    expect(body).toContain('`jquery`');
    expect(body).toContain('Replace with native DOM APIs');
  });

  it('renders strangler boundaries', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('Strangler boundaries (1)');
    expect(body).toContain('`src/god-file.js`');
    expect(body).toContain('service');
    expect(body).toContain('high');
  });

  it('renders typing steps with priority icons', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('TypeScript migration (2 files)');
    expect(body).toContain('`src/utils.js`');
    expect(body).toContain('high');
    expect(body).toContain('`src/config.js`');
  });

  it('renders findings section', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('All findings (2)');
    expect(body).toContain('No type checking');
  });

  it('shows ready icon for ready projects', () => {
    const body = buildMigrateCommentBody(
      makeMigrateResult({ migrationReadiness: 'ready' }),
    );
    expect(body).toContain('\u2705');
    expect(body).toContain('**Readiness: ready**');
  });

  it('shows red icon for high-risk projects', () => {
    const body = buildMigrateCommentBody(
      makeMigrateResult({ migrationReadiness: 'high-risk' }),
    );
    expect(body).toContain('\u274C');
    expect(body).toContain('**Readiness: high-risk**');
  });

  it('escapes pipe characters in table cells', () => {
    const result = makeMigrateResult();
    result.migrationPlan.dependencyRisks = [
      {
        name: 'bad|pkg',
        issue: 'test|issue',
        severity: 'high',
        recommendation: 'fix|it',
      },
    ];
    const body = buildMigrateCommentBody(result);
    expect(body).toContain('`bad\\|pkg`');
    expect(body).toContain('fix\\|it');
  });

  it('omits empty sections', () => {
    const result = makeMigrateResult();
    result.migrationPlan.boundaries = [];
    result.migrationPlan.typingSteps = [];
    result.migrationPlan.dependencyRisks = [];
    result.findings = [];
    const body = buildMigrateCommentBody(result);
    expect(body).not.toContain('Strangler boundaries');
    expect(body).not.toContain('TypeScript migration');
    expect(body).not.toContain('Dependency risks');
    expect(body).not.toContain('All findings');
  });

  it('includes footer with links', () => {
    const body = buildMigrateCommentBody(makeMigrateResult());
    expect(body).toContain('Forge AI Action');
    expect(body).toContain('forgespace.co');
  });
});
