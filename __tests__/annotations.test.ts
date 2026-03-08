import { jest } from '@jest/globals';

const mockError = jest.fn();
const mockWarning = jest.fn();
const mockNotice = jest.fn();

jest.unstable_mockModule('@actions/core', () => ({
  error: mockError,
  warning: mockWarning,
  notice: mockNotice,
}));

const { addAnnotations } = await import('../src/annotations.js');

import type { ActionFinding } from '../src/types.js';

describe('addAnnotations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates error annotation for critical severity', () => {
    const findings: ActionFinding[] = [
      {
        file: 'src/db.ts',
        rule: 'sql-injection',
        severity: 'critical',
        message: 'Possible SQL injection',
      },
    ];
    addAnnotations(findings);
    expect(mockError).toHaveBeenCalledWith(
      'Possible SQL injection',
      expect.objectContaining({ file: 'src/db.ts' }),
    );
  });

  it('creates error annotation for high severity', () => {
    const findings: ActionFinding[] = [
      {
        file: 'src/auth.ts',
        rule: 'hardcoded-secret',
        severity: 'high',
        message: 'Hardcoded secret',
      },
    ];
    addAnnotations(findings);
    expect(mockError).toHaveBeenCalled();
  });

  it('creates warning annotation for medium severity', () => {
    const findings: ActionFinding[] = [
      {
        file: 'src/api.ts',
        rule: 'empty-catch',
        severity: 'medium',
        message: 'Empty catch block',
      },
    ];
    addAnnotations(findings);
    expect(mockWarning).toHaveBeenCalledWith(
      'Empty catch block',
      expect.objectContaining({ file: 'src/api.ts' }),
    );
  });

  it('creates notice annotation for low severity', () => {
    const findings: ActionFinding[] = [
      {
        file: 'src/util.ts',
        rule: 'any-type',
        severity: 'low',
        message: 'Avoid any type',
      },
    ];
    addAnnotations(findings);
    expect(mockNotice).toHaveBeenCalledWith(
      'Avoid any type',
      expect.objectContaining({ file: 'src/util.ts' }),
    );
  });

  it('includes line number when available', () => {
    const findings: ActionFinding[] = [
      {
        file: 'src/app.ts',
        line: 42,
        rule: 'todo-fixme',
        severity: 'low',
        message: 'TODO found',
      },
    ];
    addAnnotations(findings);
    expect(mockNotice).toHaveBeenCalledWith(
      'TODO found',
      expect.objectContaining({ startLine: 42 }),
    );
  });

  it('handles multiple findings', () => {
    const findings: ActionFinding[] = [
      {
        file: 'a.ts',
        rule: 'r1',
        severity: 'critical',
        message: 'm1',
      },
      {
        file: 'b.ts',
        rule: 'r2',
        severity: 'medium',
        message: 'm2',
      },
      {
        file: 'c.ts',
        rule: 'r3',
        severity: 'low',
        message: 'm3',
      },
    ];
    addAnnotations(findings);
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockWarning).toHaveBeenCalledTimes(1);
    expect(mockNotice).toHaveBeenCalledTimes(1);
  });

  it('defaults to warning for unknown severity', () => {
    const findings: ActionFinding[] = [
      {
        file: 'x.ts',
        rule: 'custom',
        severity: 'unknown',
        message: 'Custom finding',
      },
    ];
    addAnnotations(findings);
    expect(mockWarning).toHaveBeenCalled();
  });
});
