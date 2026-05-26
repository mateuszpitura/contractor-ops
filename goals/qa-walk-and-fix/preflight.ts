/**
 * Pre-walk health checks — fail fast before opening the matrix.
 */

const PAGE_LOAD_TIMEOUT_MS = 15_000;

export interface PreflightConfig {
  webUrl: string;
  landingUrl: string;
  cmsUrl: string;
  needsAdmin: boolean;
  needsOrg: boolean;
  skip: boolean;
}

export async function runPreflight(config: PreflightConfig): Promise<void> {
  if (config.skip) {
    process.stderr.write('! --skip-preflight: skipping health checks\n');
    return;
  }

  const checks: { name: string; url: string; optional?: boolean }[] = [
    { name: 'web', url: `${config.webUrl}/en/login` },
    { name: 'landing', url: `${config.landingUrl}/en` },
    { name: 'cms', url: `${config.cmsUrl}/` },
  ];

  for (const check of checks) {
    try {
      const res = await fetch(check.url, {
        method: 'GET',
        signal: AbortSignal.timeout(PAGE_LOAD_TIMEOUT_MS),
      });
      if (res.status >= 500) {
        throw new Error(`${check.name} returned HTTP ${res.status} for ${check.url}`);
      }
      process.stdout.write(`· preflight ${check.name} OK (${res.status})\n`);
    } catch (err) {
      if (check.optional) continue;
      throw new Error(
        `Preflight failed for ${check.name} (${check.url}): ${(err as Error).message}. ` +
          'Start dev servers (web, landing, cms) and ensure QA_WALK_*_URL env vars match.',
      );
    }
  }

  if (config.needsAdmin && !(process.env.QA_ADMIN_EMAIL && process.env.QA_ADMIN_PASSWORD)) {
    throw new Error(
      'Preflight: QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD required for admin routes. ' +
        'Set in .env or run with --app=landing only.',
    );
  }

  if (config.needsOrg && !process.env.QA_DEFAULT_ORG_ID) {
    process.stderr.write(
      '! QA_DEFAULT_ORG_ID not set — entity detail routes may render not-found.\n',
    );
  }
}
