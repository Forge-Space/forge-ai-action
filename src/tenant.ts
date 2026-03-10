import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

interface TenantProfile {
  tenant_id: string;
  github_owner: string;
  sonar_org: string;
  npm_scope: string;
  quality_policy: Record<string, unknown>;
  ci_policy: Record<string, unknown>;
}

export interface TenantContext {
  tenantId: string;
  profileRef: string;
  profilePath: string;
  profile: TenantProfile;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseScalar(value: string): unknown {
  const normalized = value.trim();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function stripInlineComment(line: string): string {
  const marker = line.indexOf(' #');
  if (marker < 0) return line;
  return line.slice(0, marker);
}

function isSimpleYamlKey(key: string): boolean {
  if (!key) return false;
  for (const char of key) {
    const code = char.charCodeAt(0);
    const isAlphaNum =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122);
    if (!isAlphaNum && char !== '_' && char !== '.' && char !== '-') return false;
  }
  return true;
}

function parseSimpleYamlLine(rawLine: string): {
  indent: number;
  key: string;
  value: string;
} | null {
  const line = stripInlineComment(rawLine);
  const trimmed = line.trimStart();
  if (!trimmed) return null;

  const indent = line.length - trimmed.length;
  const separator = trimmed.indexOf(':');
  if (separator <= 0) return null;

  const key = trimmed.slice(0, separator).trim();
  if (!isSimpleYamlKey(key)) return null;

  const value = trimmed.slice(separator + 1).trim();
  return { indent, key, value };
}

function parseSimpleYaml(content: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; node: Record<string, unknown> }> = [
    { indent: -1, node: root },
  ];

  for (const rawLine of content.split('\n')) {
    const parsedLine = parseSimpleYamlLine(rawLine);
    if (!parsedLine) continue;
    const { indent, key, value } = parsedLine;

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]!.node;
    if (value.length === 0) {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, node: child });
      continue;
    }

    parent[key] = parseScalar(value);
  }

  return root;
}

function parseProfile(profilePath: string, content: string): unknown {
  const ext = extname(profilePath).toLowerCase();
  if (ext === '.json') return JSON.parse(content);
  if (ext === '.yml' || ext === '.yaml') return parseSimpleYaml(content);
  throw new Error(`Unsupported tenant profile format: ${ext}`);
}

function isTenantProfile(value: unknown): value is TenantProfile {
  if (!isRecord(value)) return false;
  return (
    typeof value['tenant_id'] === 'string' &&
    typeof value['github_owner'] === 'string' &&
    typeof value['sonar_org'] === 'string' &&
    typeof value['npm_scope'] === 'string' &&
    isRecord(value['quality_policy']) &&
    isRecord(value['ci_policy'])
  );
}

function resolveProfilePath(cwd: string, profileRef: string): string {
  const candidates = [resolve(cwd, profileRef), resolve(profileRef)];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    if (!statSync(candidate).isFile()) continue;
    return candidate;
  }
  throw new Error(
    `Tenant profile not found: ${profileRef}. Checkout the tenant profiles repo and pass a file path.`,
  );
}

function requiredInput(value: string, name: string): string {
  const normalized = value.trim();
  if (normalized.length > 0) return normalized;
  throw new Error(`Missing required input: ${name}.`);
}

export function resolveTenantContext(
  cwd: string,
  tenantInput: string,
  profileRefInput: string,
): TenantContext {
  const tenantId = requiredInput(tenantInput, 'tenant');
  const profileRef = requiredInput(profileRefInput, 'tenant_profile_ref');
  const profilePath = resolveProfilePath(cwd, profileRef);
  const parsed = parseProfile(profilePath, readFileSync(profilePath, 'utf-8'));

  if (!isTenantProfile(parsed)) {
    throw new Error(
      'Invalid tenant profile: required keys are tenant_id, github_owner, sonar_org, npm_scope, quality_policy, ci_policy.',
    );
  }

  if (parsed.tenant_id !== tenantId) {
    throw new Error(
      `Tenant mismatch: input tenant=${tenantId} but profile tenant_id=${parsed.tenant_id}.`,
    );
  }

  return {
    tenantId,
    profileRef,
    profilePath,
    profile: parsed,
  };
}
