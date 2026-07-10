import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the R2 client, MIME validator, and ClamAV scanner are all stubbed so
// the test exercises only the fetch/scan orchestration in document-virus-scan.
// ---------------------------------------------------------------------------

const { validateMimeTypeMock, isClamAvailableMock, scanBufferMock, sendMock } = vi.hoisted(() => ({
  validateMimeTypeMock: vi.fn(),
  isClamAvailableMock: vi.fn(),
  scanBufferMock: vi.fn(),
  sendMock: vi.fn(),
}));

// 4 KB MIME-sniff head vs. a full object whose malware would live past the head.
const HEAD_BYTES = new Uint8Array(Buffer.from('PDF-HEADER-BYTES'));
const FULL_BYTES = new Uint8Array(
  Buffer.concat([Buffer.from('PDF-HEADER-BYTES'), Buffer.alloc(9000, 0x41)]),
);

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class {
    input: { Range?: string };
    constructor(input: { Range?: string }) {
      this.input = input;
    }
  },
}));

vi.mock('../r2', () => ({
  getR2BucketName: () => 'test-bucket',
  createR2Client: () => ({ send: sendMock }),
}));

vi.mock('../mime-validator', () => ({
  validateMimeType: validateMimeTypeMock,
}));

vi.mock('../virus-scanner', () => ({
  isClamAvailable: isClamAvailableMock,
  scanBuffer: scanBufferMock,
}));

const { scanDocumentAndUpdateStatus } = await import('../document-virus-scan');

function makeDb() {
  return { document: { update: vi.fn().mockResolvedValue({}) } };
}

describe('scanDocumentAndUpdateStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateMimeTypeMock.mockResolvedValue({ valid: true, detectedMime: 'application/pdf' });
    isClamAvailableMock.mockResolvedValue(true);
    scanBufferMock.mockResolvedValue({ isClean: true });
    // Range read → 4 KB head; no Range → the full object.
    sendMock.mockImplementation(async (command: { input: { Range?: string } }) => ({
      Body: {
        transformToByteArray: async () => (command.input.Range ? HEAD_BYTES : FULL_BYTES),
      },
    }));
  });

  it('scans the FULL object, not just the 4 KB MIME-sniff head', async () => {
    const db = makeDb();

    await scanDocumentAndUpdateStatus(db, 'doc-1', 'org/doc-1/file.pdf');

    // ClamAV must receive every byte of the object — otherwise malware placed
    // past the first 4 KB would pass undetected.
    expect(scanBufferMock).toHaveBeenCalledOnce();
    const scanned = scanBufferMock.mock.calls[0][0] as Buffer;
    expect(scanned.length).toBe(FULL_BYTES.length);
    expect(scanned.length).toBeGreaterThan(HEAD_BYTES.length);

    // The 4 KB head is fetched for the MIME sniff; the full object (no Range)
    // is fetched separately for the scan.
    const ranges = sendMock.mock.calls.map(
      ([c]) => (c as { input: { Range?: string } }).input.Range,
    );
    expect(ranges).toContain('bytes=0-4099');
    expect(ranges).toContain(undefined);

    // MIME sniff runs against the head slice, not the full object.
    expect((validateMimeTypeMock.mock.calls[0][0] as Buffer).length).toBe(HEAD_BYTES.length);

    expect(db.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { virusScanStatus: 'CLEAN' },
    });
  });

  it('marks INFECTED when the full-object scan finds a virus past the head', async () => {
    scanBufferMock.mockResolvedValue({ isClean: false, virusName: 'Eicar-Test-Signature' });
    const db = makeDb();

    await scanDocumentAndUpdateStatus(db, 'doc-2', 'org/doc-2/file.pdf');

    expect(db.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-2' },
      data: { virusScanStatus: 'INFECTED' },
    });
  });

  it('does not fetch the full object when the MIME sniff rejects the head', async () => {
    validateMimeTypeMock.mockResolvedValue({
      valid: false,
      detectedMime: 'application/x-msdownload',
    });
    const db = makeDb();

    await scanDocumentAndUpdateStatus(db, 'doc-3', 'org/doc-3/file.exe');

    expect(scanBufferMock).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledOnce(); // only the head read
    expect(db.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-3' },
      data: { virusScanStatus: 'FAILED' },
    });
  });
});
