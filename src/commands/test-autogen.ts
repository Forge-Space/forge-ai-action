import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import {
  scoreToGrade,
  type ActionFinding,
  type ActionResult,
  type CategoryResult,
} from '../types.js';

interface RawAutogenResult {
  changedFiles: string[];
  requirements: unknown[];
  created: string[];
  missing: string[];
  passed: boolean;
}

type PhaseMode = 'warn' | 'phase1' | 'phase2';

type TestScope = 'unit' | 'integration' | 'e2e';

const SAFE_GIT_REF = /^[A-Za-z0-9._/-]+$/;
const NPX_BIN = process.platform === 'win32' ? 'npx.cmd' : 'npx';
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

function normalizePhase(input?: string): PhaseMode {
  if (input === 'phase1' || input === 'phase2') return input;
  return 'warn';
}

function isE2EMissing(path: string): boolean {
  return path.includes('.e2e.') || path.includes('/e2e/');
}

function shouldBlock(path: string, phase: PhaseMode): boolean {
  if (phase === 'warn') return false;
  if (phase === 'phase1') return !isE2EMissing(path);
  return true;
}

function buildCommandArgs(baseRef?: string): string[] {
  const args = ['forge-ai-init', 'test-autogen', '--check', '--json'];
  if (baseRef) {
    args.push('--base', baseRef);
  }
  return args;
}

function resolveBaseRef(): string | undefined {
  const baseRef = sanitizeGitRef(process.env.GITHUB_BASE_REF);
  if (!baseRef) return undefined;
  return `origin/${baseRef}`;
}

function findingFromMissing(file: string): ActionFinding {
  const e2e = isE2EMissing(file);
  return {
    file,
    rule: e2e ? 'test-autogen-missing-e2e' : 'test-autogen-missing-required',
    severity: e2e ? 'medium' : 'high',
    message: `Required generated test is missing: ${file}`,
  };
}

function safeParseResult(raw: string): RawAutogenResult {
  const parsed = JSON.parse(raw) as RawAutogenResult;
  return {
    changedFiles: parsed.changedFiles ?? [],
    requirements: parsed.requirements ?? [],
    created: parsed.created ?? [],
    missing: parsed.missing ?? [],
    passed: parsed.passed ?? true,
  };
}

function scoreFromMissing(missing: string[], blocked: string[]): number {
  const score = 100 - missing.length * 8 - blocked.length * 20;
  return Math.max(0, score);
}

function isFallbackEligible(message: string): boolean {
  return (
    message.includes('Unknown command') ||
    message.includes('test-autogen') ||
    message.includes('could not determine executable') ||
    message.includes('not found')
  );
}

function runGitDiff(cwd: string, baseRef?: string): string[] {
  const args = baseRef
    ? ['diff', '--name-only', `${baseRef}...HEAD`]
    : ['diff', '--name-only', 'HEAD'];
  try {
    const output = execFileSync(resolveGitBinary(), args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

function isTestLikeFile(path: string): boolean {
  return (
    path.includes('/tests/') ||
    path.startsWith('tests/') ||
    path.includes('__tests__') ||
    path.endsWith('.test.ts') ||
    path.endsWith('.test.tsx') ||
    path.endsWith('.test.js') ||
    path.endsWith('.spec.ts') ||
    path.endsWith('.spec.js') ||
    path.endsWith('_test.py')
  );
}

function isProdSource(path: string): boolean {
  if (isTestLikeFile(path)) return false;
  if (path.startsWith('.')) return false;
  if (path.startsWith('docs/') || path.startsWith('.github/') || path.endsWith('.md')) {
    return false;
  }

  const ext = extname(path);
  return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'].includes(ext);
}

function isUiFile(path: string): boolean {
  const lower = path.toLowerCase();
  const ext = extname(lower);
  if (['.tsx', '.jsx', '.vue', '.svelte'].includes(ext)) return true;
  return (
    lower.includes('/ui/') ||
    lower.includes('/components/') ||
    lower.includes('/screens/') ||
    lower.includes('/pages/') ||
    lower.includes('/app/')
  );
}

function isApiFile(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes('/api/') ||
    lower.includes('/routes/') ||
    lower.includes('/route') ||
    lower.includes('/controller') ||
    lower.includes('/service') ||
    lower.includes('/repository') ||
    lower.includes('/db') ||
    lower.includes('/server')
  );
}

function isCriticalFlow(path: string): boolean {
  return /(auth|login|signup|checkout|payment|billing|security|admin)/i.test(path);
}

function stripExtension(path: string): string {
  return path.slice(0, path.length - extname(path).length);
}

function testExt(cwd: string): string {
  return existsSync(join(cwd, 'tsconfig.json')) ? 'ts' : 'js';
}

function buildTestPath(cwd: string, source: string, scope: TestScope): string {
  const ext = extname(source) === '.py' ? 'py' : testExt(cwd);
  const base = stripExtension(source);

  if (ext === 'py') {
    const normalized = base.replace(/\//g, '_');
    return join('tests', scope, `test_${normalized}.py`);
  }

  const suffix =
    scope === 'unit'
      ? 'unit.test'
      : scope === 'integration'
        ? 'integration.test'
        : 'e2e.test';

  return join('tests', scope, `${base}.${suffix}.${ext}`);
}

function buildFallbackResult(cwd: string, baseRef?: string): RawAutogenResult {
  const changedFiles = runGitDiff(cwd, baseRef).filter(isProdSource);
  const requirements: string[] = [];
  const missing: string[] = [];

  const hasUi = changedFiles.some(isUiFile);
  const hasApi = changedFiles.some(isApiFile);

  for (const source of changedFiles) {
    requirements.push(buildTestPath(cwd, source, 'unit'));

    if (isApiFile(source)) {
      requirements.push(buildTestPath(cwd, source, 'integration'));
    }

    const needsE2E = isCriticalFlow(source) || ((hasUi && hasApi) && (isUiFile(source) || isApiFile(source)));
    if (needsE2E) {
      requirements.push(buildTestPath(cwd, source, 'e2e'));
    }
  }

  for (const req of requirements) {
    if (!existsSync(join(cwd, req))) {
      missing.push(req);
    }
  }

  return {
    changedFiles,
    requirements,
    created: [],
    missing,
    passed: missing.length === 0,
  };
}

export function runTestAutogenCheckCommand(
  cwd: string,
  phaseInput?: string,
): ActionResult {
  const phase = normalizePhase(phaseInput);
  const baseRef = resolveBaseRef();

  let rawResult: RawAutogenResult;
  let fallbackUsed = false;

  try {
    const output = execFileSync(NPX_BIN, buildCommandArgs(baseRef), {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    rawResult = safeParseResult(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'test-autogen execution failed';
    if (!isFallbackEligible(message)) {
      return {
        score: 0,
        grade: 'F',
        delta: 0,
        passed: false,
        findings: [
          {
            file: '',
            rule: 'test-autogen-command-failed',
            severity: 'critical',
            message,
          },
        ],
        categories: [{ name: 'test-autogen', score: 0 }],
        summary: `test-autogen command failed: ${message}`,
      };
    }

    rawResult = buildFallbackResult(cwd, baseRef);
    fallbackUsed = true;
  }

  const findings = rawResult.missing.map(findingFromMissing);
  const blocked = rawResult.missing.filter((file) => shouldBlock(file, phase));
  const score = scoreFromMissing(rawResult.missing, blocked);
  const passed = blocked.length === 0;
  const grade = scoreToGrade(score);

  const categories: CategoryResult[] = [{ name: 'test-autogen', score }];
  const fallbackLabel = fallbackUsed ? ' (fallback)' : '';
  const summary =
    `Test autogen${fallbackLabel} (${phase}) — changed ${rawResult.changedFiles.length}, ` +
    `required ${rawResult.requirements.length}, missing ${rawResult.missing.length}, ` +
    `blocking ${blocked.length}.`;

  return {
    score,
    grade,
    delta: 0,
    passed,
    findings,
    categories,
    summary,
  };
}
