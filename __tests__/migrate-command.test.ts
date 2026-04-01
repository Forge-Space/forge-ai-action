import { jest } from '@jest/globals';

const mockDetectStack = jest.fn();
const mockAssessProject = jest.fn();
const mockAnalyzeMigration = jest.fn();

jest.unstable_mockModule('forge-ai-init', () => ({
  detectStack: mockDetectStack,
  assessProject: mockAssessProject,
  analyzeMigration: mockAnalyzeMigration,
}));

const { runMigrateCommand } = await import('../src/commands/migrate.js');

describe('Migrate Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns complete migration plan with phases', () => {
    mockDetectStack.mockReturnValue({ framework: 'node.js', version: '16' });

    mockAssessProject.mockReturnValue({
      overallScore: 68,
      categories: [
        { category: 'Type Coverage', score: 45 },
        { category: 'Documentation', score: 70 },
      ],
      findings: [
        {
          file: 'src/index.ts',
          title: 'partial-types',
          severity: 'high',
          detail: 'Some exports lack types',
        },
      ],
      migrationReadiness: 'Partial',
    });

    mockAnalyzeMigration.mockReturnValue({
      strategy: {
        name: 'Incremental Typing',
        description: 'Convert files module by module',
      },
      boundaries: [
        {
          module: 'src/api',
          type: 'API Layer',
          complexity: 'medium',
          reason: 'Public interface',
        },
        {
          module: 'src/utils',
          type: 'Utilities',
          complexity: 'low',
          reason: 'Helper functions',
        },
      ],
      typingPlan: [
        {
          file: 'src/types.ts',
          priority: 'high',
          reason: 'Shared type definitions',
        },
        {
          file: 'src/api/index.ts',
          priority: 'high',
          reason: 'Public API',
        },
      ],
      dependencyRisks: [
        {
          name: '@types/express',
          issue: 'Type stubs out of sync',
          severity: 'medium',
          recommendation: 'Update to latest version',
        },
      ],
      phases: [
        {
          name: 'Phase 1: Preparation',
          description: 'Set up TypeScript configuration',
          tasks: ['Update tsconfig.json', 'Add type stubs'],
          gate: 'Compilation passes',
        },
        {
          name: 'Phase 2: Core',
          description: 'Type core modules',
          tasks: ['Type shared utilities', 'Type API layer'],
          gate: 'Coverage > 50%',
        },
      ],
      estimatedEffort: '4-6 weeks',
    });

    const result = runMigrateCommand('/cwd', 70);

    expect(result.score).toBe(68);
    expect(result.grade).toBe('C+');
    expect(result.passed).toBe(false);
    expect(result.delta).toBe(0);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].rule).toBe('partial-types');
    expect(result.migrationReadiness).toBe('Partial');
    expect(result.migrationStrategy).toBe('Incremental Typing');
    expect(result.migrationPlan).toBeDefined();
    expect(result.migrationPlan.phases).toHaveLength(2);
    expect(result.migrationPlan.phases[0].name).toBe('Phase 1: Preparation');
    expect(result.migrationPlan.estimatedEffort).toBe('4-6 weeks');
    expect(result.summary).toContain('Migration Assessment: 68/100');
    expect(result.summary).toContain('Readiness: Partial');
    expect(result.summary).toContain('2 phases');
  });

  it('passes when score meets threshold', () => {
    mockDetectStack.mockReturnValue({ framework: 'node.js' });

    mockAssessProject.mockReturnValue({
      overallScore: 85,
      categories: [{ category: 'Type Coverage', score: 85 }],
      findings: [],
      migrationReadiness: 'Ready',
    });

    mockAnalyzeMigration.mockReturnValue({
      strategy: { name: 'Direct Conversion', description: 'Convert directly' },
      boundaries: [],
      typingPlan: [],
      dependencyRisks: [],
      phases: [
        {
          name: 'Final',
          description: 'Clean up',
          tasks: [],
          gate: 'All tests pass',
        },
      ],
      estimatedEffort: '2-3 weeks',
    });

    const result = runMigrateCommand('/cwd', 80);

    expect(result.passed).toBe(true);
    expect(result.grade).toBe('A-');
    expect(result.summary).toContain('Migration Assessment: 85/100');
  });

  it('limits boundaries and typing steps to 10 items', () => {
    mockDetectStack.mockReturnValue({ framework: 'node.js' });

    mockAssessProject.mockReturnValue({
      overallScore: 75,
      categories: [],
      findings: [],
      migrationReadiness: 'Ready',
    });

    const manyBoundaries = Array.from({ length: 15 }, (_, i) => ({
      module: `module-${i}`,
      type: 'type',
      complexity: 'low',
      reason: 'reason',
    }));

    const manyTypingSteps = Array.from({ length: 15 }, (_, i) => ({
      file: `file-${i}.ts`,
      priority: 'medium',
      reason: 'reason',
    }));

    mockAnalyzeMigration.mockReturnValue({
      strategy: { name: 'Test', description: 'Test' },
      boundaries: manyBoundaries,
      typingPlan: manyTypingSteps,
      dependencyRisks: [],
      phases: [],
      estimatedEffort: '1 week',
    });

    const result = runMigrateCommand('/cwd', 60);

    expect(result.migrationPlan.boundaries).toHaveLength(10);
    expect(result.migrationPlan.typingSteps).toHaveLength(10);
  });

  it('includes all dependency risks', () => {
    mockDetectStack.mockReturnValue({ framework: 'node.js' });

    mockAssessProject.mockReturnValue({
      overallScore: 70,
      categories: [],
      findings: [],
      migrationReadiness: 'Ready',
    });

    const manyRisks = Array.from({ length: 5 }, (_, i) => ({
      name: `package-${i}`,
      issue: 'issue',
      severity: 'high',
      recommendation: 'Update',
    }));

    mockAnalyzeMigration.mockReturnValue({
      strategy: { name: 'Test', description: 'Test' },
      boundaries: [],
      typingPlan: [],
      dependencyRisks: manyRisks,
      phases: [],
      estimatedEffort: '1 week',
    });

    const result = runMigrateCommand('/cwd', 60);

    expect(result.migrationPlan.dependencyRisks).toHaveLength(5);
  });

  it('handles findings with null file', () => {
    mockDetectStack.mockReturnValue({ framework: 'node.js' });

    mockAssessProject.mockReturnValue({
      overallScore: 60,
      categories: [],
      findings: [
        {
          file: null,
          title: 'global-issue',
          severity: 'medium',
          detail: 'System-wide problem',
        },
      ],
      migrationReadiness: 'Not Ready',
    });

    mockAnalyzeMigration.mockReturnValue({
      strategy: { name: 'Preparation', description: 'Prepare first' },
      boundaries: [],
      typingPlan: [],
      dependencyRisks: [],
      phases: [],
      estimatedEffort: '2 weeks',
    });

    const result = runMigrateCommand('/cwd', 70);

    expect(result.findings[0].file).toBe('');
  });

  it('maps all category scores correctly', () => {
    mockDetectStack.mockReturnValue({ framework: 'node.js' });

    mockAssessProject.mockReturnValue({
      overallScore: 72,
      categories: [
        { category: 'Architecture', score: 80 },
        { category: 'Types', score: 65 },
        { category: 'Documentation', score: 70 },
      ],
      findings: [],
      migrationReadiness: 'Partial',
    });

    mockAnalyzeMigration.mockReturnValue({
      strategy: { name: 'Multi-phase', description: 'Gradual migration' },
      boundaries: [],
      typingPlan: [],
      dependencyRisks: [],
      phases: [{ name: 'Phase 1', description: 'Start', tasks: [], gate: 'OK' }],
      estimatedEffort: '4 weeks',
    });

    const result = runMigrateCommand('/cwd', 60);

    expect(result.categories).toHaveLength(3);
    expect(result.categories[0]).toEqual({ name: 'Architecture', score: 80 });
    expect(result.categories[1]).toEqual({ name: 'Types', score: 65 });
    expect(result.categories[2]).toEqual({ name: 'Documentation', score: 70 });
  });
});
