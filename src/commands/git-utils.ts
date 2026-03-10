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
