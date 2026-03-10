import { jest } from '@jest/globals';

const PROJECT_DIR = '/workspace/project';
const mockExecFileSync = jest.fn();

jest.unstable_mockModule('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}));

const { runTestAutogenCheckCommand } = await import(
  '../src/commands/test-autogen.js'
);

describe('runTestAutogenCheckCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GITHUB_BASE_REF;
  });

  it('passes in warn mode even with missing tests', () => {
    mockExecFileSync.mockReturnValue(
      JSON.stringify({
        changedFiles: ['src/api/users.ts'],
        requirements: [{}, {}],
        created: [],
        missing: ['tests/unit/src/api/users.unit.test.ts'],
        passed: false,
      }),
    );

    const result = runTestAutogenCheckCommand(PROJECT_DIR, 'warn');

    expect(result.passed).toBe(true);
    expect(result.findings.length).toBe(1);
    expect(result.summary).toContain('blocking 0');
  });

  it('blocks unit/integration gaps in phase1', () => {
    mockExecFileSync.mockReturnValue(
      JSON.stringify({
        changedFiles: ['src/api/users.ts'],
        requirements: [{}, {}],
        created: [],
        missing: [
          'tests/unit/src/api/users.unit.test.ts',
          'tests/e2e/src/api/users.e2e.test.ts',
        ],
        passed: false,
      }),
    );

    const result = runTestAutogenCheckCommand(PROJECT_DIR, 'phase1');

    expect(result.passed).toBe(false);
    expect(result.summary).toContain('blocking 1');
  });

  it('blocks e2e gaps in phase2', () => {
    mockExecFileSync.mockReturnValue(
      JSON.stringify({
        changedFiles: ['src/ui/login.tsx', 'src/api/login.ts'],
        requirements: [{}, {}, {}],
        created: [],
        missing: ['tests/e2e/src/ui/login.e2e.test.ts'],
        passed: false,
      }),
    );

    const result = runTestAutogenCheckCommand(PROJECT_DIR, 'phase2');

    expect(result.passed).toBe(false);
    expect(result.findings[0]?.severity).toBe('medium');
  });

  it('uses base ref from GitHub environment when available', () => {
    process.env.GITHUB_BASE_REF = 'main';
    mockExecFileSync.mockReturnValue(
      JSON.stringify({
        changedFiles: [],
        requirements: [],
        created: [],
        missing: [],
        passed: true,
      }),
    );

    runTestAutogenCheckCommand(PROJECT_DIR, 'warn');

    expect(mockExecFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/npx(\.cmd)?$/),
      expect.arrayContaining(['--base', 'origin/main']),
      expect.any(Object),
    );
  });

  it('returns critical finding when command execution fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = runTestAutogenCheckCommand(PROJECT_DIR, 'phase2');

    expect(result.passed).toBe(false);
    expect(result.findings[0]?.rule).toBe('test-autogen-command-failed');
    expect(result.findings[0]?.severity).toBe('critical');
  });
});
