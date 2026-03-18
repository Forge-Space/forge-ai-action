import { assessProject, detectStack, analyzeMigration } from "forge-ai-init";
import {
  scoreToGrade,
  type ActionResult,
  type ActionFinding,
  type CategoryResult,
} from "../types.js";

export interface MigrateResult extends ActionResult {
  migrationPlan: {
    strategy: string;
    strategyDescription: string;
    boundaries: Array<{
      module: string;
      type: string;
      complexity: string;
      reason: string;
    }>;
    typingSteps: Array<{
      file: string;
      priority: string;
      reason: string;
    }>;
    dependencyRisks: Array<{
      name: string;
      issue: string;
      severity: string;
      recommendation: string;
    }>;
    phases: Array<{
      name: string;
      description: string;
      tasks: string[];
      gate: string;
    }>;
    estimatedEffort: string;
  };
}

export function runMigrateCommand(
  cwd: string,
  threshold: number,
): MigrateResult {
  const stack = detectStack(cwd);
  const report = assessProject(cwd, stack);
  const plan = analyzeMigration(cwd, stack);

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
  const strategy = plan.strategy.name;

  const summary =
    `Migration Assessment: ${score}/100 (${grade}). ` +
    `Readiness: ${readiness}. ` +
    `Strategy: ${strategy}. ` +
    `${plan.phases.length} phases, ` +
    `est. ${plan.estimatedEffort}.`;

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
    migrationPlan: {
      strategy: plan.strategy.name,
      strategyDescription: plan.strategy.description,
      boundaries: plan.boundaries.slice(0, 10).map((b) => ({
        module: b.module,
        type: b.type,
        complexity: b.complexity,
        reason: b.reason,
      })),
      typingSteps: plan.typingPlan.slice(0, 10).map((s) => ({
        file: s.file,
        priority: s.priority,
        reason: s.reason,
      })),
      dependencyRisks: plan.dependencyRisks.map((d) => ({
        name: d.name,
        issue: d.issue,
        severity: d.severity,
        recommendation: d.recommendation,
      })),
      phases: plan.phases.map((p) => ({
        name: p.name,
        description: p.description,
        tasks: p.tasks,
        gate: p.gate,
      })),
      estimatedEffort: plan.estimatedEffort,
    },
  };
}
