import { scanProject, analyzeDiff } from "forge-ai-init";
import { resolveDiffBase } from "./git-utils.js";
import {
  scoreToGrade,
  type ActionResult,
  type ActionFinding,
  type CategoryResult,
} from "../types.js";

export function runDiffCommand(cwd: string): ActionResult {
  const scan = scanProject(cwd);
  const diff = analyzeDiff(cwd, {
    staged: false,
    base: resolveDiffBase(cwd),
    head: "HEAD",
  });

  const score = scan.score;
  const grade = scoreToGrade(score);

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

  const deltaSign = diff.delta >= 0 ? "+" : "";
  const trend = diff.improved ? "improved" : "degraded";
  const summary =
    `Delta: ${deltaSign}${diff.delta} (${trend}). ` +
    `${diff.changedFiles.length} file${diff.changedFiles.length === 1 ? "" : "s"} changed. ` +
    `${findings.length} new finding${findings.length === 1 ? "" : "s"}.`;

  return {
    score,
    grade,
    delta: diff.delta,
    passed: diff.improved,
    findings,
    categories,
    summary,
  };
}
