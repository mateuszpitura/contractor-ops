import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateStorageKey, signExistingDownload } from '../r2.js';

describe('r2 generateStorageKey', () => {
  it('builds org-scoped path with extension', () => {
    expect(generateStorageKey('org-1', 'doc-2', 'file.pdf')).toBe('orgs/org-1/documents/doc-2.pdf');
  });

  it('uses the substring after the last dot as the extension', () => {
    expect(generateStorageKey('o', 'd', 'archive.tar.gz')).toBe('orgs/o/documents/d.gz');
  });

  it('when filename has no dot, treats the whole name as the extension segment', () => {
    expect(generateStorageKey('o', 'd', 'readme')).toBe('orgs/o/documents/d.readme');
  });
});

// -----------------------------------------------------------------------------
// Phase 59 · D-05 — signExistingDownload signs a GET URL for an existing R2
// object without re-uploading. Used by classificationDocument.getDownloadUrl
// so the bytes of a persisted SDS / DRV bundle never change between downloads.
// -----------------------------------------------------------------------------

interface MockCommand {
  name: 'GetObjectCommand' | 'PutObjectCommand';
  input: Record<string, unknown>;
}

const mockState = vi.hoisted(() => ({
  getObjectCalls: [] as MockCommand[],
  putObjectCalls: [] as MockCommand[],
  signedUrlCalls: [] as Array<{ command: MockCommand; expiresIn?: number }>,
}));

const { getObjectCalls, putObjectCalls, signedUrlCalls } = mockState;

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    async send() {
      return undefined;
    }
  },
  GetObjectCommand: class {
    name = 'GetObjectCommand';
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
      mockState.getObjectCalls.push({ name: 'GetObjectCommand', input });
    }
  },
  PutObjectCommand: class {
    name = 'PutObjectCommand';
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
      mockState.putObjectCalls.push({ name: 'PutObjectCommand', input });
    }
  },
  HeadObjectCommand: class {},
  DeleteObjectCommand: class {},
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async (_client: unknown, command: { input: { Key: unknown } }, opts?: { expiresIn?: number }) => {
    mockState.signedUrlCalls.push({
      command: command as unknown as MockCommand,
      expiresIn: opts?.expiresIn,
    });
    return `https://r2.mock.test/${encodeURIComponent(String(command.input.Key))}?X-Amz-Expires=${opts?.expiresIn ?? 'default'}`;
  }),
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: () => ({
    R2_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET_NAME: 'bucket-test',
    R2_BUCKET_NAME_EU: 'bucket-eu',
  }),
}));

describe('signExistingDownload (Phase 59 D-05)', () => {
  beforeEach(() => {
    getObjectCalls.length = 0;
    putObjectCalls.length = 0;
    signedUrlCalls.length = 0;
  });

  it('returns a signed URL containing the key', async () => {
    const key = 'classification-documents/org_1/ca_1/sds-ir35-v2-abc123.pdf';
    const result = await signExistingDownload(key, 300);
    expect(result.signedUrl).toContain(encodeURIComponent(key));
    expect(result.expiresInSeconds).toBe(300);
  });

  it('does not call PutObjectCommand', async () => {
    await signExistingDownload(
      'classification-documents/org_1/ca_1/sds-ir35-v2-abc123.pdf',
      300,
    );
    expect(putObjectCalls).toHaveLength(0);
    expect(getObjectCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('defaults ttlSeconds to 300', async () => {
    const result = await signExistingDownload(
      'classification-documents/org_1/ca_1/sds-ir35-v2-abc123.pdf',
    );
    expect(result.expiresInSeconds).toBe(300);
    const lastSignCall = signedUrlCalls.at(-1);
    expect(lastSignCall?.expiresIn).toBe(300);
  });

  it('sets ResponseContentDisposition to attachment by default', async () => {
    await signExistingDownload('classification-documents/org_1/ca_1/sds-v2-abc.pdf');
    const lastGet = getObjectCalls.at(-1);
    expect(lastGet?.input.ResponseContentDisposition).toBe('attachment');
  });
});
