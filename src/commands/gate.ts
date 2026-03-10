import { scanProject, analyzeDiff } from 'forge-ai-init';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  scoreToGrade,
  type ActionResult,
  type ActionFinding,
  type CategoryResult,
} from '../types.js';

const SAFE_GIT_REF = /^[A-Za-z0-9._/-]+$/;
const GIT_CANDIDATES = [
  '/usr/bin/git',
  '/usr/local/bin/git',
  '/bin/git',
  'C:\\Program Files\\Git\\cmd\\git.exe',
];

function resolveGitBinary(): string {
  for (const candidate of GIT_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Git binary not found in expected locations');
}

function sanitizeGitRef(ref?: string): string | undefined {
  if (!ref) return undefined;
  if (!SAFE_GIT_REF.test(ref)) return undefined;
  if (ref.startsWith('-')) return undefined;
  return ref;
}

function hasRef(cwd: string, ref: string): boolean {
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

function resolveDiffBase(cwd: string): string {
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

export function runGateCommand(
  cwd: string,
  threshold: number,
): ActionResult {
  const scan = scanProject(cwd);
  const diff = analyzeDiff(cwd, {
    staged: false,
    base: resolveDiffBase(cwd),
    head: 'HEAD',
  });

  const score = scan.score;
  const grade = scoreToGrade(score);
  const passed = score >= threshold;

  const findings: ActionFinding[] = diff.newFindings.map((f) => ({
    file: f.file,
    rule: f.rule,
    severity: f.severity,
    message: f.message,
  }));

  const categories: CategoryResult[] = scan.summary.map((c) => ({
    name: c.category,
    score: Math.max(0, 100 - c.critical * 10 - c.high * 5 - c.count),
  }));

  const status = passed ? 'Passed' : 'Failed';
  const summary =
    `Gate ${status} (${score}/${threshold}). ` +
    `${findings.length} new finding${findings.length === 1 ? '' : 's'}.`;

  return {
    score,
    grade,
    delta: diff.delta,
    passed,
    findings,
    categories,
    summary,
  };
}
