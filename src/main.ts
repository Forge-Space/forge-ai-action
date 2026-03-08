import * as core from '@actions/core';
import * as github from '@actions/github';
import { runGateCommand } from './commands/gate.js';
import { runScanCommand } from './commands/scan.js';
import { runDiffCommand } from './commands/diff.js';
import { postComment } from './comment.js';
import { addAnnotations } from './annotations.js';
import type { ActionResult } from './types.js';

async function run(): Promise<void> {
  try {
    const command = core.getInput('command') || 'gate';
    const threshold = parseInt(core.getInput('threshold') || '60', 10);
    const shouldComment = core.getInput('comment') !== 'false';
    const shouldAnnotate = core.getInput('annotations') !== 'false';
    const cwd = process.cwd();

    core.info(`Forge AI — running "${command}" command`);

    let result: ActionResult;

    switch (command) {
      case 'gate':
        result = runGateCommand(cwd, threshold);
        break;
      case 'scan':
        result = runScanCommand(cwd);
        break;
      case 'diff':
        result = runDiffCommand(cwd);
        break;
      default:
        core.setFailed(`Unknown command: ${command}`);
        return;
    }

    core.setOutput('score', result.score.toString());
    core.setOutput('delta', result.delta.toString());
    core.setOutput('passed', result.passed.toString());
    core.setOutput('findings-count', result.findings.length.toString());

    core.info(`Score: ${result.score}/100 (${result.grade})`);
    core.info(`Delta: ${result.delta >= 0 ? '+' : ''}${result.delta}`);
    core.info(`Gate: ${result.passed ? 'PASSED' : 'FAILED'}`);
    core.info(`Findings: ${result.findings.length}`);

    const token = process.env.GITHUB_TOKEN || core.getInput('token');
    const context = github.context;
    const isPR = !!context.payload.pull_request;

    if (isPR && token) {
      const octokit = github.getOctokit(token);

      if (shouldComment) {
        await postComment(octokit, context, result);
      }

      if (shouldAnnotate && result.findings.length > 0) {
        addAnnotations(result.findings);
      }
    }

    if (!result.passed) {
      core.setFailed(
        `Quality gate failed: score ${result.score} < threshold ${threshold}`,
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
