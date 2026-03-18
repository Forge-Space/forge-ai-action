import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const SAFE_GIT_REF = /^[A-Za-z0-9._/-]+$/;
const GIT_CANDIDATES = [
  '/usr/bin/git',
  '/usr/local/bin/git',
  '/bin/git',
  String.raw`C:\Program Files\Git\cmd\git.exe`,
];

export function sanitizeGitRef(ref?: string): string | undefined {
  if (!ref) return undefined;
  if (!SAFE_GIT_REF.test(ref)) return undefined;
  if (ref.startsWith('-')) return undefined;
  return ref;
}

export function resolveGitBinary(): string {
  for (const candidate of GIT_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Git binary not found in expected locations');
}

export function hasRef(cwd: string, ref: string): boolean {
  try {
    execFileSync(resolveGitBinary(), ['rev-parse', '--verify', '--quiet', ref], {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

export function resolveDiffBase(cwd: string): string {
  const baseRef = sanitizeGitRef(process.env.GITHUB_BASE_REF);
  const candidates = [
    baseRef ? `origin/${baseRef}` : undefined,
    baseRef,
    'origin/main',
    'main',
    'HEAD~1',
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (hasRef(cwd, candidate)) {
      return candidate;
    }
  }

  return 'HEAD';
}
