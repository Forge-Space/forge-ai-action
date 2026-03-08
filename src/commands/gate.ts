import { scanProject, analyzeDiff } from 'forge-ai-init';
import {
  scoreToGrade,
  type ActionResult,
  type ActionFinding,
  type CategoryResult,
} from '../types.js';

export function runGateCommand(
  cwd: string,
  threshold: number,
): ActionResult {
  const scan = scanProject(cwd);
  const diff = analyzeDiff(cwd, { staged: false });

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
