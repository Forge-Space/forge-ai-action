import * as core from '@actions/core';
import type { ActionFinding } from './types.js';

const SEVERITY_MAP: Record<string, 'error' | 'warning' | 'notice'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'notice',
  info: 'notice',
};

export function addAnnotations(findings: ActionFinding[]): void {
  for (const f of findings) {
    const level = SEVERITY_MAP[f.severity] ?? 'warning';
    const props: core.AnnotationProperties = {
      file: f.file,
      title: `[${f.rule}] ${f.severity}`,
    };

    if (f.line) {
      props.startLine = f.line;
    }

    switch (level) {
      case 'error':
        core.error(f.message, props);
        break;
      case 'warning':
        core.warning(f.message, props);
        break;
      case 'notice':
        core.notice(f.message, props);
        break;
    }
  }
}
