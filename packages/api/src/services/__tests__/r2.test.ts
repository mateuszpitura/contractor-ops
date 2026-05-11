import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteObject,
  generateStorageKey,
  headObject,
  putObjectAndSignDownload,
  signExistingDownload,
} from '../r2';

describe('r2 generateStorageKey', () => {
  it('builds org-scoped path with extension', () => {
    expect(generateStorageKey('org-1', 'doc-2', 'file.pdf')).toBe('orgs/org-1/documents/doc-2.pdf');
  });

  it('strips unknown/unsafe extensions (security allowlist)', () => {
    // .gz not in ALLOWED_EXTENSIONS — stripped for path-traversal protection
    expect(generateStorageKey('o', 'd', 'archive.tar.gz')).toBe('orgs/o/documents/d');
  });

  it('strips non-allowlisted extension-like segments when no known extension found', () => {
    expect(generateStorageKey('o', 'd', 'readme')).toBe('orgs/o/documents/d');
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
      return;
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
  getSignedUrl: vi.fn(
    async (
      _client: unknown,
      command: { input: { Key: unknown } },
      opts?: { expiresIn?: number },
    ) => {
      mockState.signedUrlCalls.push({
        command: command as unknown as MockCommand,
        expiresIn: opts?.expiresIn,
      });
      return `https://r2.mock.test/${encodeURIComponent(String(command.input.Key))}?X-Amz-Expires=${opts?.expiresIn ?? 'default'}`;
    },
  ),
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
    await signExistingDownload('classification-documents/org_1/ca_1/sds-ir35-v2-abc123.pdf', 300);
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

  it('includes downloadFilename in disposition when provided', async () => {
    await signExistingDownload('key.pdf', 300, 'my-report.pdf');
    const lastGet = getObjectCalls.at(-1);
    expect(lastGet?.input.ResponseContentDisposition).toBe('attachment; filename="my-report.pdf"');
  });

  it('strips double quotes from downloadFilename for security', async () => {
    await signExistingDownload('key.pdf', 300, 'file"name.pdf');
    const lastGet = getObjectCalls.at(-1);
    expect(lastGet?.input.ResponseContentDisposition).toBe('attachment; filename="filename.pdf"');
  });
});

// -----------------------------------------------------------------------------
// createPresignedUploadUrl
// -----------------------------------------------------------------------------

describe('createPresignedUploadUrl', () => {
  beforeEach(() => {
    getObjectCalls.length = 0;
    putObjectCalls.length = 0;
    signedUrlCalls.length = 0;
  });

  it('returns a signed URL for PUT with correct content type', async () => {
    const url = await createPresignedUploadUrl('orgs/o1/documents/d1.pdf', 'application/pdf');
    expect(url).toContain(encodeURIComponent('orgs/o1/documents/d1.pdf'));
  });

  it('uses default expiry of 300 seconds', async () => {
    await createPresignedUploadUrl('key.pdf', 'application/pdf');
    const lastCall = signedUrlCalls.at(-1);
    expect(lastCall?.expiresIn).toBe(300);
  });

  it('accepts custom expiry', async () => {
    await createPresignedUploadUrl('key.pdf', 'application/pdf', 600);
    const lastCall = signedUrlCalls.at(-1);
    expect(lastCall?.expiresIn).toBe(600);
  });
});

// -----------------------------------------------------------------------------
// createPresignedDownloadUrl
// -----------------------------------------------------------------------------

describe('createPresignedDownloadUrl', () => {
  beforeEach(() => {
    getObjectCalls.length = 0;
    putObjectCalls.length = 0;
    signedUrlCalls.length = 0;
  });

  it('returns a signed URL for GET', async () => {
    const url = await createPresignedDownloadUrl('orgs/o1/documents/d1.pdf');
    expect(url).toContain(encodeURIComponent('orgs/o1/documents/d1.pdf'));
  });

  it('uses default expiry of 900 seconds', async () => {
    await createPresignedDownloadUrl('key.pdf');
    const lastCall = signedUrlCalls.at(-1);
    expect(lastCall?.expiresIn).toBe(900);
  });

  it('accepts custom expiry', async () => {
    await createPresignedDownloadUrl('key.pdf', 120);
    const lastCall = signedUrlCalls.at(-1);
    expect(lastCall?.expiresIn).toBe(120);
  });

  it('sets ResponseContentDisposition to attachment', async () => {
    await createPresignedDownloadUrl('key.pdf');
    const lastGet = getObjectCalls.at(-1);
    expect(lastGet?.input.ResponseContentDisposition).toBe('attachment');
  });
});

// -----------------------------------------------------------------------------
// putObjectAndSignDownload
// -----------------------------------------------------------------------------

describe('putObjectAndSignDownload', () => {
  beforeEach(() => {
    getObjectCalls.length = 0;
    putObjectCalls.length = 0;
    signedUrlCalls.length = 0;
  });

  it('uploads the body and returns a signed download URL', async () => {
    const body = Buffer.from('test content');
    const result = await putObjectAndSignDownload({
      key: 'orgs/o1/docs/cert.pdf',
      body,
      contentType: 'application/pdf',
    });

    expect(result.signedUrl).toContain(encodeURIComponent('orgs/o1/docs/cert.pdf'));
    expect(result.expiresInSeconds).toBe(300);
  });

  it('uses custom ttlSeconds', async () => {
    const result = await putObjectAndSignDownload({
      key: 'key.pdf',
      body: Buffer.from('x'),
      contentType: 'application/pdf',
      ttlSeconds: 600,
    });

    expect(result.expiresInSeconds).toBe(600);
    const lastCall = signedUrlCalls.at(-1);
    expect(lastCall?.expiresIn).toBe(600);
  });

  it('includes downloadFilename in disposition', async () => {
    await putObjectAndSignDownload({
      key: 'key.pdf',
      body: Buffer.from('x'),
      contentType: 'application/pdf',
      downloadFilename: 'report-2024.pdf',
    });

    const lastGet = getObjectCalls.at(-1);
    expect(lastGet?.input.ResponseContentDisposition).toBe(
      'attachment; filename="report-2024.pdf"',
    );
  });

  it('defaults disposition to attachment when no downloadFilename', async () => {
    await putObjectAndSignDownload({
      key: 'key.pdf',
      body: Buffer.from('x'),
      contentType: 'application/pdf',
    });

    const lastGet = getObjectCalls.at(-1);
    expect(lastGet?.input.ResponseContentDisposition).toBe('attachment');
  });
});

// -----------------------------------------------------------------------------
// headObject and deleteObject
// -----------------------------------------------------------------------------

describe('headObject', () => {
  it('sends HeadObjectCommand to the correct bucket and key', async () => {
    // headObject calls client.send() which returns undefined in mock
    const result = await headObject('orgs/o1/documents/d1.pdf');
    expect(result).toBeUndefined();
  });
});

describe('deleteObject', () => {
  it('sends DeleteObjectCommand to the correct bucket and key', async () => {
    const result = await deleteObject('orgs/o1/documents/d1.pdf');
    expect(result).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// generateStorageKey - additional edge cases
// -----------------------------------------------------------------------------

describe('generateStorageKey - additional edge cases', () => {
  it('handles path traversal attempts in filename', () => {
    expect(generateStorageKey('o', 'd', '../../etc/passwd')).toBe('orgs/o/documents/d');
  });

  it('strips non-alphanumeric characters from extension before matching allowlist', () => {
    // p-d_f -> pdf after stripping non-alphanumeric chars, which matches the allowlist
    expect(generateStorageKey('o', 'd', 'file.p-d_f')).toBe('orgs/o/documents/d.pdf');
    // x-y-z -> xyz which is NOT in the allowlist, so it's stripped entirely
    expect(generateStorageKey('o', 'd', 'file.x-y-z')).toBe('orgs/o/documents/d');
  });

  it('handles allowed extensions case-insensitively', () => {
    expect(generateStorageKey('o', 'd', 'file.PDF')).toBe('orgs/o/documents/d.pdf');
  });

  it('handles multiple dots, uses last segment as extension', () => {
    expect(generateStorageKey('o', 'd', 'archive.backup.pdf')).toBe('orgs/o/documents/d.pdf');
  });

  it('handles empty filename', () => {
    expect(generateStorageKey('o', 'd', '')).toBe('orgs/o/documents/d');
  });

  it('supports all common document extensions', () => {
    for (const ext of ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'png', 'jpg', 'xml', 'json']) {
      expect(generateStorageKey('o', 'd', `file.${ext}`)).toBe(`orgs/o/documents/d.${ext}`);
    }
  });
});
