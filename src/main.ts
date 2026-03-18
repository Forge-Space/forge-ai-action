import * as core from "@actions/core";
import * as github from "@actions/github";
import { runGateCommand } from "./commands/gate.js";
import { runScanCommand } from "./commands/scan.js";
import { runDiffCommand } from "./commands/diff.js";
import { runAssessCommand } from "./commands/assess.js";
import { runMigrateCommand, type MigrateResult } from "./commands/migrate.js";
import { runTestAutogenCheckCommand } from "./commands/test-autogen.js";
import { postComment, postMigrateComment } from "./comment.js";
import { addAnnotations } from "./annotations.js";
import { resolveTenantContext } from "./tenant.js";
import type { ActionResult } from "./types.js";

async function run(): Promise<void> {
  try {
    const command = core.getInput("command") || "gate";
    const threshold = parseInt(core.getInput("threshold") || "60", 10);
    const shouldComment = core.getInput("comment") !== "false";
    const shouldAnnotate = core.getInput("annotations") !== "false";
    const testAutogenPhase = core.getInput("test_autogen_phase") || "warn";
    const cwd = process.cwd();
    const tenantContext = resolveTenantContext(
      cwd,
      core.getInput("tenant"),
      core.getInput("tenant_profile_ref"),
    );

    process.env.FORGE_TENANT_ID = tenantContext.tenantId;
    process.env.FORGE_TENANT_PROFILE_REF = tenantContext.profilePath;

    core.info(`Forge AI — running "${command}" command`);
    core.info(`Tenant: ${tenantContext.tenantId}`);

    let result: ActionResult;
    let migrateResult: MigrateResult | undefined;

    switch (command) {
      case "gate":
        result = runGateCommand(cwd, threshold);
        break;
      case "scan":
        result = runScanCommand(cwd);
        break;
      case "diff":
        result = runDiffCommand(cwd);
        break;
      case "assess":
        result = runAssessCommand(cwd, threshold);
        break;
      case "migrate":
        migrateResult = runMigrateCommand(cwd, threshold);
        result = migrateResult;
        break;
      case "test-autogen-check":
        result = runTestAutogenCheckCommand(
          cwd,
          testAutogenPhase,
          tenantContext.tenantId,
          tenantContext.profilePath,
        );
        break;
      default:
        core.setFailed(`Unknown command: ${command}`);
        return;
    }

    core.setOutput("score", result.score.toString());
    core.setOutput("delta", result.delta.toString());
    core.setOutput("passed", result.passed.toString());
    core.setOutput("findings-count", result.findings.length.toString());

    if (result.migrationReadiness) {
      core.setOutput("readiness", result.migrationReadiness);
    }
    if (result.migrationStrategy) {
      core.setOutput("strategy", result.migrationStrategy);
    }

    core.info(`Score: ${result.score}/100 (${result.grade})`);
    core.info(`Delta: ${result.delta >= 0 ? "+" : ""}${result.delta}`);
    core.info(`Gate: ${result.passed ? "PASSED" : "FAILED"}`);
    core.info(`Findings: ${result.findings.length}`);

    if (result.migrationReadiness) {
      core.info(`Migration Readiness: ${result.migrationReadiness}`);
      core.info(`Strategy: ${result.migrationStrategy}`);
    }

    const token = process.env.GITHUB_TOKEN || core.getInput("token");
    const context = github.context;
    const isPR = !!context.payload.pull_request;

    if (isPR && token) {
      const octokit = github.getOctokit(token);

      if (shouldComment) {
        if (migrateResult) {
          await postMigrateComment(octokit, context, migrateResult);
        } else {
          await postComment(octokit, context, result);
        }
      }

      if (shouldAnnotate && result.findings.length > 0) {
        addAnnotations(result.findings);
      }
    }

    if (!result.passed) {
      const failureMessage =
        command === "test-autogen-check"
          ? `Test autogen check failed: ${result.summary}`
          : `Quality gate failed: score ${result.score} < threshold ${threshold}`;
      core.setFailed(failureMessage);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
