import NodeClam from "clamscan";

// ---------------------------------------------------------------------------
// ClamAV virus scanner singleton
// ---------------------------------------------------------------------------

let clamInstance: Awaited<
  ReturnType<InstanceType<typeof NodeClam>["init"]>
> | null = null;

async function getClamInstance() {
  if (!clamInstance) {
    const clam = new NodeClam();
    clamInstance = await clam.init({
      clamdscan: {
        host: process.env.CLAMAV_HOST ?? "127.0.0.1",
        port: Number(process.env.CLAMAV_PORT ?? 3310),
        timeout: 60000,
      },
      preference: "clamdscan",
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
    const { Readable } = await import("node:stream");
    const stream = Readable.from(buffer);
    const { isInfected, viruses } = await clam.scanStream(stream);
    return {
      isClean: !isInfected,
      virusName: viruses?.[0],
    };
  } catch (error) {
    console.error("[virus-scanner] Scan failed:", error);
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
