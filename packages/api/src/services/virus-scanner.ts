import { createLogger } from '@contractor-ops/logger';
import { getServerEnv } from '@contractor-ops/validators';
import NodeClam from 'clamscan';

const log = createLogger({ service: 'virus-scanner' });

// ---------------------------------------------------------------------------
// ClamAV virus scanner singleton
// ---------------------------------------------------------------------------

let clamInstance: Awaited<ReturnType<InstanceType<typeof NodeClam>['init']>> | null = null;

async function getClamInstance() {
  if (!clamInstance) {
    const { CLAMAV_HOST, CLAMAV_PORT } = getServerEnv();
    const clam = new NodeClam();
    clamInstance = await clam.init({
      clamdscan: {
        host: CLAMAV_HOST,
        port: CLAMAV_PORT,
        timeout: 60000,
      },
      preference: 'clamdscan',
    });
  }
  return clamInstance;
}

// ---------------------------------------------------------------------------
// Scanning functions
// ---------------------------------------------------------------------------

/**
 * Scans a buffer for viruses using ClamAV (via clamd daemon).
 * Returns whether the content is clean, and if infected, the virus name.
 */
export async function scanBuffer(
  buffer: Buffer,
): Promise<{ isClean: boolean; virusName?: string }> {
  try {
    const clam = await getClamInstance();
    const { Readable } = await import('node:stream');
    const stream = Readable.from(buffer);
    const { isInfected, viruses } = await clam.scanStream(stream);
    return {
      isClean: !isInfected,
      virusName: viruses?.[0],
    };
  } catch (error) {
    log.error({ err: error }, 'scan failed');
    throw error;
  }
}

/**
 * Checks whether ClamAV daemon is reachable and initialized.
 */
export async function isClamAvailable(): Promise<boolean> {
  try {
    await getClamInstance();
    return true;
  } catch {
    return false;
  }
}
