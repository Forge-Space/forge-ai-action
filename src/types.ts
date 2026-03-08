export interface ActionFinding {
  file: string;
  rule: string;
  severity: string;
  message: string;
  line?: number;
}

export interface CategoryResult {
  name: string;
  score: number;
}

export interface ActionResult {
  score: number;
  grade: string;
  delta: number;
  passed: boolean;
  findings: ActionFinding[];
  categories: CategoryResult[];
  summary: string;
  migrationReadiness?: string;
  migrationStrategy?: string;
}

export function scoreToGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}
