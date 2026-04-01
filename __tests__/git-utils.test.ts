import { jest } from '@jest/globals';

const mockExecFileSync = jest.fn();
const mockExistsSync = jest.fn();

jest.unstable_mockModule('node:child_process', () => ({
  execFileSync: mockExecFileSync,
}));

jest.unstable_mockModule('node:fs', () => ({
  existsSync: mockExistsSync,
}));

const { sanitizeGitRef, resolveGitBinary, hasRef, resolveDiffBase } = await import(
  '../src/commands/git-utils.js'
);

describe('Git Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GITHUB_BASE_REF;
  });

  describe('sanitizeGitRef', () => {
    it('returns ref when valid', () => {
      expect(sanitizeGitRef('main')).toBe('main');
      expect(sanitizeGitRef('feature/test-123')).toBe('feature/test-123');
      expect(sanitizeGitRef('release/v1.0.0')).toBe('release/v1.0.0');
      expect(sanitizeGitRef('hotfix_patch')).toBe('hotfix_patch');
      expect(sanitizeGitRef('branch.v1')).toBe('branch.v1');
    });

    it('returns undefined for unsafe refs', () => {
      expect(sanitizeGitRef('-main')).toBeUndefined();
      expect(sanitizeGitRef('--dangerous')).toBeUndefined();
      expect(sanitizeGitRef('feature@branch')).toBeUndefined();
      expect(sanitizeGitRef('feature$(git rev-parse HEAD)')).toBeUndefined();
      expect(sanitizeGitRef('feature`;rm -rf`')).toBeUndefined();
    });

    it('returns undefined for undefined input', () => {
      expect(sanitizeGitRef(undefined)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(sanitizeGitRef('')).toBeUndefined();
    });

    it('rejects refs with spaces', () => {
      expect(sanitizeGitRef('feature branch')).toBeUndefined();
    });

    it('rejects refs with special characters', () => {
      expect(sanitizeGitRef('feature~1')).toBeUndefined();
      expect(sanitizeGitRef('feature^')).toBeUndefined();
      expect(sanitizeGitRef('feature:name')).toBeUndefined();
    });

    it('accepts refs with numbers and slashes', () => {
      expect(sanitizeGitRef('v1.2.3')).toBe('v1.2.3');
      expect(sanitizeGitRef('PR-123/feature')).toBe('PR-123/feature');
    });
  });

  describe('resolveGitBinary', () => {
    it('returns first available git binary', () => {
      (mockExistsSync as any).mockImplementation((path: string) => {
        return path === '/usr/bin/git';
      });

      expect(resolveGitBinary()).toBe('/usr/bin/git');
    });

    it('checks all candidates until one exists', () => {
      (mockExistsSync as any).mockImplementation((path: string) => {
        return path === '/usr/local/bin/git';
      });

      expect(resolveGitBinary()).toBe('/usr/local/bin/git');
      expect(mockExistsSync).toHaveBeenCalledWith('/usr/bin/git');
      expect(mockExistsSync).toHaveBeenCalledWith('/usr/local/bin/git');
    });

    it('throws when no git binary found', () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => resolveGitBinary()).toThrow('Git binary not found');
    });

    it('checks Windows git path', () => {
      (mockExistsSync as any).mockImplementation((path: string) => {
        return path.includes('Program Files');
      });

      expect(resolveGitBinary()).toContain('Program Files');
    });

    it('returns /bin/git when available', () => {
      (mockExistsSync as any).mockImplementation((path: string) => {
        return path === '/bin/git';
      });

      expect(resolveGitBinary()).toBe('/bin/git');
    });
  });

  describe('hasRef', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    it('returns true when ref exists', () => {
      mockExecFileSync.mockReturnValue('');

      expect(hasRef('/cwd', 'main')).toBe(true);
    });

    it('returns false when ref does not exist', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('fatal: Needed a single revision');
      });

      expect(hasRef('/cwd', 'nonexistent-branch')).toBe(false);
    });

    it('uses correct git command', () => {
      mockExecFileSync.mockReturnValue('');

      hasRef('/cwd', 'feature/test');

      expect(mockExecFileSync).toHaveBeenCalledWith(
        expect.any(String),
        ['rev-parse', '--verify', '--quiet', 'feature/test'],
        expect.objectContaining({ cwd: '/cwd' })
      );
    });

    it('ignores stdio', () => {
      mockExecFileSync.mockReturnValue('');

      hasRef('/cwd', 'main');

      expect(mockExecFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          stdio: ['ignore', 'ignore', 'ignore'],
        })
      );
    });

    it('handles different ref types', () => {
      mockExecFileSync.mockReturnValue('');

      expect(hasRef('/cwd', 'origin/main')).toBe(true);
      expect(hasRef('/cwd', 'HEAD~1')).toBe(true);
      expect(hasRef('/cwd', 'v1.0.0')).toBe(true);
    });
  });

  describe('resolveDiffBase', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
    });

    it('uses GITHUB_BASE_REF when available', () => {
      process.env.GITHUB_BASE_REF = 'develop';
      (mockExecFileSync as any).mockImplementation((bin: unknown, args: unknown) => {
        const argArray = args as string[];
        if (argArray.includes('origin/develop')) return '';
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('origin/develop');
    });

    it('prefers origin/baseref over baseref', () => {
      process.env.GITHUB_BASE_REF = 'staging';
      (mockExecFileSync as any).mockImplementation((bin: unknown, args: unknown) => {
        const argArray = args as string[];
        if (argArray.includes('origin/staging')) return '';
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('origin/staging');
    });

    it('falls back to unsanitized baseref when origin/ unavailable', () => {
      process.env.GITHUB_BASE_REF = 'custom-base';
      (mockExecFileSync as any).mockImplementation((bin: unknown, args: unknown) => {
        const argArray = args as string[];
        if (argArray.includes('custom-base')) return '';
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('custom-base');
    });

    it('tries origin/main next', () => {
      delete process.env.GITHUB_BASE_REF;
      (mockExecFileSync as any).mockImplementation((bin: unknown, args: unknown) => {
        const argArray = args as string[];
        if (argArray.includes('origin/main')) return '';
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('origin/main');
    });

    it('tries main next', () => {
      delete process.env.GITHUB_BASE_REF;
      (mockExecFileSync as any).mockImplementation((bin: unknown, args: unknown) => {
        const argArray = args as string[];
        if (argArray.includes('main')) return '';
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('main');
    });

    it('tries HEAD~1 as fallback', () => {
      delete process.env.GITHUB_BASE_REF;
      (mockExecFileSync as any).mockImplementation((bin: unknown, args: unknown) => {
        const argArray = args as string[];
        if (argArray.includes('HEAD~1')) return '';
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('HEAD~1');
    });

    it('returns HEAD when no refs found', () => {
      delete process.env.GITHUB_BASE_REF;
      mockExecFileSync.mockImplementation(() => {
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('HEAD');
    });

    it('ignores invalid GITHUB_BASE_REF', () => {
      process.env.GITHUB_BASE_REF = '$(evil-command)';
      (mockExecFileSync as any).mockImplementation((bin: unknown, args: unknown) => {
        const argArray = args as string[];
        if (argArray.includes('origin/main')) return '';
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('origin/main');
    });

    it('handles empty GITHUB_BASE_REF', () => {
      process.env.GITHUB_BASE_REF = '';
      (mockExecFileSync as any).mockImplementation((bin: unknown, args: unknown) => {
        const argArray = args as string[];
        if (argArray.includes('origin/main')) return '';
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('origin/main');
    });

    it('prefers first available ref in order', () => {
      process.env.GITHUB_BASE_REF = 'feature';
      (mockExecFileSync as any).mockImplementation((bin: unknown, args: unknown) => {
        const argArray = args as string[];
        const arg = argArray[3];
        if (arg === 'origin/feature') return '';
        throw new Error('not found');
      });

      expect(resolveDiffBase('/cwd')).toBe('origin/feature');
    });
  });
});
