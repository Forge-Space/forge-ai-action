import { scanProject } from 'forge-ai-init';
import {
  scoreToGrade,
  type ActionResult,
  type ActionFinding,
  type CategoryResult,
} from '../types.js';

export function runScanCommand(cwd: string): ActionResult {
  const scan = scanProject(cwd);

  const score = scan.score;
  const grade = scoreToGrade(score);

  const findings: ActionFinding[] = scan.findings.map((f) => ({
    file: f.file,
    rule: f.rule,
    severity: f.severity,
    message: f.message,
  }));

  const categories: CategoryResult[] = scan.summary.map((c) => ({
    name: c.category,
    score: Math.max(0, 100 - c.critical * 10 - c.high * 5 - c.count),
  }));

  const summary =
    `Score: ${score}/100 (${grade}). ` +
    `${findings.length} finding${findings.length === 1 ? '' : 's'} across ` +
    `${scan.filesScanned} files.`;

  return {
    score,
    grade,
    delta: 0,
    passed: true,
    findings,
    categories,
    summary,
  };
}
