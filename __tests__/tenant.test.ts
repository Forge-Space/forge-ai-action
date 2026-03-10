import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTenantContext } from '../src/tenant.js';

function createTempDir(): string {
  const dir = join(tmpdir(), `forge-ai-action-tenant-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const PROFILE_YAML = `
tenant_id: acme-sandbox
github_owner: acme-org
sonar_org: acme-org
npm_scope: "@acme"
quality_policy:
  min_quality_score: 80
  block_on_critical: true
  block_on_high: true
ci_policy:
  require_sonar: true
  require_security_scan: true
  enforce_pr_checks: true
`.trimStart();

const ENTERPRISE_PROFILE = `
tenant_id: acme-enterprise
github_owner: acme-enterprise
sonar_org: acme-enterprise
npm_scope: "@acme-enterprise"
quality_policy:
  min_quality_score: 80
  block_on_critical: true
  block_on_high: true
ci_policy:
  require_sonar: true
  require_security_scan: true
  enforce_pr_checks: true
`.trimStart();

describe('resolveTenantContext', () => {
  let dir = '';

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('loads a valid tenant profile', () => {
    dir = createTempDir();
    const profile = join(dir, 'profile.yaml');
    writeFileSync(profile, PROFILE_YAML);

    const context = resolveTenantContext(dir, 'acme-sandbox', profile);
    expect(context.profile.github_owner).toBe('acme-org');
  });

  it('fails on tenant mismatch', () => {
    dir = createTempDir();
    const profile = join(dir, 'profile.yaml');
    writeFileSync(profile, PROFILE_YAML);

    expect(() => resolveTenantContext(dir, 'wrong', profile)).toThrow(
      'Tenant mismatch',
    );
  });

  it('resolves different tenant profiles with a shared validator', () => {
    dir = createTempDir();
    const acmePath = join(dir, 'acme.yaml');
    const enterprisePath = join(dir, 'enterprise.yaml');
    writeFileSync(acmePath, PROFILE_YAML);
    writeFileSync(enterprisePath, ENTERPRISE_PROFILE);

    const acme = resolveTenantContext(dir, 'acme-sandbox', acmePath);
    const enterprise = resolveTenantContext(dir, 'acme-enterprise', enterprisePath);

    expect(acme.profile.github_owner).toBe('acme-org');
    expect(enterprise.profile.github_owner).toBe('acme-enterprise');
  });
});
