import { assessProject, detectStack } from "forge-ai-init";
import {
  scoreToGrade,
  type ActionResult,
  type ActionFinding,
  type CategoryResult,
} from "../types.js";

export function runAssessCommand(cwd: string, threshold: number): ActionResult {
  const stack = detectStack(cwd);
  const report = assessProject(cwd, stack);

  const score = report.overallScore;
  const grade = scoreToGrade(score);
  const passed = score >= threshold;

  const findings: ActionFinding[] = report.findings.map((f) => ({
    file: f.file ?? "",
    rule: f.title,
    severity: f.severity,
    message: f.detail,
    line: f.line,
  }));

  const categories: CategoryResult[] = report.categories.map((c) => ({
    name: c.category,
    score: c.score,
  }));

  const readiness = report.migrationReadiness;
  const strategy = report.migrationStrategy;

  const summary =
    `Health: ${score}/100 (${grade}). ` +
    `Readiness: ${readiness}. ` +
    `Strategy: ${strategy}. ` +
    `${findings.length} finding${findings.length === 1 ? "" : "s"}.`;

  return {
    score,
    grade,
    delta: 0,
    passed,
    findings,
    categories,
    summary,
    migrationReadiness: readiness,
    migrationStrategy: strategy,
  };
}
