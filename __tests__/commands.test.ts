import { jest } from '@jest/globals';

// Mock forge-ai-init module
const mockScanProject = jest.fn();
const mockAnalyzeDiff = jest.fn();
const mockAssessProject = jest.fn();
const mockDetectStack = jest.fn();

jest.unstable_mockModule('forge-ai-init', () => ({
  scanProject: mockScanProject,
  analyzeDiff: mockAnalyzeDiff,
  assessProject: mockAssessProject,
  detectStack: mockDetectStack,
}));

// Mock git-utils before importing commands
const { resolveDiffBase } = await import('../src/commands/git-utils.js');
jest.unstable_mockModule('../src/commands/git-utils.js', () => ({
  resolveDiffBase: jest.fn(() => 'origin/main'),
}));

const { runGateCommand } = await import('../src/commands/gate.js');
const { runScanCommand } = await import('../src/commands/scan.js');
const { runDiffCommand } = await import('../src/commands/diff.js');
const { runAssessCommand } = await import('../src/commands/assess.js');

describe('Gate Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes when score meets threshold', () => {
    mockScanProject.mockReturnValue({
      score: 75,
      summary: [
        { category: 'Security', critical: 0, high: 0, count: 0 },
        { category: 'Performance', critical: 0, high: 1, count: 2 },
      ],
      findings: [],
    });

    mockAnalyzeDiff.mockReturnValue({
      newFindings: [],
      delta: 5,
      improved: true,
      changedFiles: ['src/index.ts'],
    });

    const result = runGateCommand('/cwd', 60);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(75);
    expect(result.grade).toBe('B');
    expect(result.delta).toBe(5);
    expect(result.findings).toHaveLength(0);
    expect(result.summary).toContain('Passed');
  });

  it('fails when score below threshold', () => {
    mockScanProject.mockReturnValue({
      score: 45,
      summary: [
        { category: 'Security', critical: 2, high: 1, count: 3 },
      ],
      findings: [],
    });

    mockAnalyzeDiff.mockReturnValue({
      newFindings: [
        {
          file: 'src/dangerous.ts',
          rule: 'hardcoded-secret',
          severity: 'critical',
          message: 'Hardcoded API key',
        },
      ],
      delta: -10,
      improved: false,
      changedFiles: ['src/dangerous.ts'],
    });

    const result = runGateCommand('/cwd', 60);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(45);
    expect(result.grade).toBe('F');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].rule).toBe('hardcoded-secret');
    expect(result.summary).toContain('Failed');
  });

  it('calculates category scores correctly', () => {
    mockScanProject.mockReturnValue({
      score: 70,
      summary: [
        { category: 'Security', critical: 1, high: 2, count: 3 },
        { category: 'Maintainability', critical: 0, high: 0, count: 0 },
      ],
      findings: [],
    });

    mockAnalyzeDiff.mockReturnValue({
      newFindings: [],
      delta: 0,
      improved: false,
      changedFiles: [],
    });

    const result = runGateCommand('/cwd', 60);

    expect(result.categories).toHaveLength(2);
    expect(result.categories[0].name).toBe('Security');
    // Score calculation: Math.max(0, 100 - 1*10 - 2*5 - 3) = 100 - 10 - 10 - 3 = 77
    expect(result.categories[0].score).toBe(77);
    expect(result.categories[1].name).toBe('Maintainability');
    expect(result.categories[1].score).toBe(100);
  });

  it('handles zero findings correctly', () => {
    mockScanProject.mockReturnValue({
      score: 85,
      summary: [{ category: 'Code Quality', critical: 0, high: 0, count: 0 }],
      findings: [],
    });

    mockAnalyzeDiff.mockReturnValue({
      newFindings: [],
      delta: 3,
      improved: true,
      changedFiles: ['src/clean.ts'],
    });

    const result = runGateCommand('/cwd', 60);

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toContain('0 new findings');
  });

  it('handles multiple findings with singular/plural grammar', () => {
    mockScanProject.mockReturnValue({
      score: 60,
      summary: [{ category: 'Security', critical: 0, high: 0, count: 0 }],
      findings: [],
    });

    mockAnalyzeDiff.mockReturnValue({
      newFindings: [
        {
          file: 'src/one.ts',
          rule: 'rule1',
          severity: 'high',
          message: 'Issue 1',
        },
      ],
      delta: -5,
      improved: false,
      changedFiles: [],
    });

    const result = runGateCommand('/cwd', 60);

    expect(result.summary).toContain('1 new finding');
  });
});

describe('Scan Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns complete scan results', () => {
    mockScanProject.mockReturnValue({
      score: 82,
      filesScanned: 45,
      summary: [
        { category: 'Security', critical: 0, high: 1, count: 2 },
        { category: 'Performance', critical: 0, high: 0, count: 1 },
      ],
      findings: [
        {
          file: 'src/api.ts',
          rule: 'no-console',
          severity: 'low',
          message: 'Found console.log',
        },
        {
          file: 'src/db.ts',
          rule: 'sql-injection-risk',
          severity: 'high',
          message: 'SQL string concatenation',
        },
        {
          file: 'src/utils.ts',
          rule: 'missing-error-handling',
          severity: 'medium',
          message: 'Unhandled promise rejection',
        },
      ],
    });

    const result = runScanCommand('/cwd');

    expect(result.score).toBe(82);
    expect(result.grade).toBe('B+');
    expect(result.passed).toBe(true);
    expect(result.delta).toBe(0);
    expect(result.findings).toHaveLength(3);
    expect(result.findings[0].file).toBe('src/api.ts');
    expect(result.findings[1].severity).toBe('high');
    expect(result.summary).toContain('Score: 82/100 (B+)');
    expect(result.summary).toContain('3 findings');
    expect(result.summary).toContain('45 files');
  });

  it('handles zero findings', () => {
    mockScanProject.mockReturnValue({
      score: 95,
      filesScanned: 32,
      summary: [{ category: 'Code Quality', critical: 0, high: 0, count: 0 }],
      findings: [],
    });

    const result = runScanCommand('/cwd');

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toContain('0 findings');
  });

  it('handles single finding grammar', () => {
    mockScanProject.mockReturnValue({
      score: 90,
      filesScanned: 1,
      summary: [{ category: 'Test', critical: 0, high: 0, count: 0 }],
      findings: [
        {
          file: 'src/only.ts',
          rule: 'test-rule',
          severity: 'low',
          message: 'One issue',
        },
      ],
    });

    const result = runScanCommand('/cwd');

    expect(result.summary).toContain('1 finding');
    expect(result.summary).toContain('1 file');
  });
});

describe('Diff Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns improved diff results', () => {
    mockScanProject.mockReturnValue({
      score: 80,
      summary: [
        { category: 'Security', critical: 0, high: 0, count: 0 },
      ],
      findings: [],
    });

    mockAnalyzeDiff.mockReturnValue({
      newFindings: [
        {
          file: 'src/new-feature.ts',
          rule: 'missing-tests',
          severity: 'medium',
          message: 'No test file',
        },
      ],
      delta: 8,
      improved: true,
      changedFiles: ['src/feature.ts', 'src/feature.test.ts'],
    });

    const result = runDiffCommand('/cwd');

    expect(result.score).toBe(80);
    expect(result.grade).toBe('B+');
    expect(result.passed).toBe(true);
    expect(result.delta).toBe(8);
    expect(result.findings).toHaveLength(1);
    expect(result.summary).toContain('improved');
    expect(result.summary).toContain('+8');
    expect(result.summary).toContain('2 files changed');
  });

  it('returns degraded diff results', () => {
    mockScanProject.mockReturnValue({
      score: 65,
      summary: [
        { category: 'Code Quality', critical: 1, high: 2, count: 4 },
      ],
      findings: [],
    });

    mockAnalyzeDiff.mockReturnValue({
      newFindings: [
        {
          file: 'src/bad.ts',
          rule: 'unused-variables',
          severity: 'low',
          message: 'Variable declared but not used',
        },
        {
          file: 'src/worse.ts',
          rule: 'complexity',
          severity: 'medium',
          message: 'Function too complex',
        },
      ],
      delta: -15,
      improved: false,
      changedFiles: ['src/bad.ts', 'src/worse.ts', 'src/worse.test.ts'],
    });

    const result = runDiffCommand('/cwd');

    expect(result.passed).toBe(false);
    expect(result.delta).toBe(-15);
    expect(result.summary).toContain('degraded');
    expect(result.summary).toContain('-15');
    expect(result.summary).toContain('3 files changed');
    expect(result.summary).toContain('2 new findings');
  });

  it('handles single file change grammar', () => {
    mockScanProject.mockReturnValue({
      score: 75,
      summary: [{ category: 'Test', critical: 0, high: 0, count: 0 }],
      findings: [],
    });

    mockAnalyzeDiff.mockReturnValue({
      newFindings: [],
      delta: 0,
      improved: true,
      changedFiles: ['src/only.ts'],
    });

    const result = runDiffCommand('/cwd');

    expect(result.summary).toContain('1 file changed');
    expect(result.summary).toContain('0 new findings');
  });
});

describe('Assess Command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns complete assessment with migration info', () => {
    mockDetectStack.mockReturnValue({ framework: 'node.js', version: '18' });

    mockAssessProject.mockReturnValue({
      overallScore: 72,
      categories: [
        { category: 'Architecture', score: 85 },
        { category: 'Testing', score: 60 },
        { category: 'Security', score: 75 },
      ],
      findings: [
        {
          file: 'src/old-patterns.ts',
          title: 'deprecated-api-usage',
          severity: 'medium',
          detail: 'Using deprecated Express methods',
          line: 42,
        },
        {
          file: 'src/database.ts',
          title: 'raw-sql-query',
          severity: 'high',
          detail: 'Raw SQL without parameterization',
          line: 138,
        },
      ],
      migrationReadiness: 'Ready',
      migrationStrategy: 'Phase-based migration over 3 sprints',
    });

    const result = runAssessCommand('/cwd', 70);

    expect(result.score).toBe(72);
    expect(result.grade).toBe('B-');
    expect(result.passed).toBe(true);
    expect(result.delta).toBe(0);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].rule).toBe('deprecated-api-usage');
    expect(result.findings[0].line).toBe(42);
    expect(result.findings[1].severity).toBe('high');
    expect(result.categories).toHaveLength(3);
    expect(result.migrationReadiness).toBe('Ready');
    expect(result.migrationStrategy).toContain('Phase-based');
    expect(result.summary).toContain('Health: 72/100 (B-)');
    expect(result.summary).toContain('Readiness: Ready');
    expect(result.summary).toContain('2 findings');
  });

  it('fails when score below threshold', () => {
    mockDetectStack.mockReturnValue({ framework: 'legacy-framework' });

    mockAssessProject.mockReturnValue({
      overallScore: 45,
      categories: [
        { category: 'Testing', score: 20 },
        { category: 'Documentation', score: 30 },
      ],
      findings: [
        {
          file: 'src/main.ts',
          title: 'no-test-coverage',
          severity: 'critical',
          detail: 'No test coverage found',
        },
        {
          file: null,
          title: 'missing-documentation',
          severity: 'high',
          detail: 'No API documentation',
        },
      ],
      migrationReadiness: 'Not Ready',
      migrationStrategy: 'Needs refactoring first',
    });

    const result = runAssessCommand('/cwd', 70);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(45);
    expect(result.grade).toBe('F');
    expect(result.findings[1].file).toBe('');
    expect(result.summary).toContain('Not Ready');
  });

  it('handles zero findings', () => {
    mockDetectStack.mockReturnValue({ framework: 'clean' });

    mockAssessProject.mockReturnValue({
      overallScore: 92,
      categories: [
        { category: 'Overall', score: 92 },
      ],
      findings: [],
      migrationReadiness: 'Excellent',
      migrationStrategy: 'Ready for production',
    });

    const result = runAssessCommand('/cwd', 80);

    expect(result.findings).toHaveLength(0);
    expect(result.summary).toContain('0 findings');
  });

  it('handles single finding grammar', () => {
    mockDetectStack.mockReturnValue({ framework: 'test' });

    mockAssessProject.mockReturnValue({
      overallScore: 85,
      categories: [{ category: 'Quality', score: 85 }],
      findings: [
        {
          file: 'src/single.ts',
          title: 'one-issue',
          severity: 'low',
          detail: 'Minor improvement',
        },
      ],
      migrationReadiness: 'Good',
      migrationStrategy: 'Incremental',
    });

    const result = runAssessCommand('/cwd', 70);

    expect(result.summary).toContain('1 finding');
  });
});
