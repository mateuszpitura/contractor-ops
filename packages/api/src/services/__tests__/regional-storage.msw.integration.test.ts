/**
 * Integration: regional R2 operations + MSW (real AWS S3 client; no createR2Client mock).
 * Covers head/delete after PUT against in-memory R2 handlers in @contractor-ops/test-utils.
 */
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { minimalServerEnv } from '@contractor-ops/validators/minimal-server-env';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['r2']),
});

beforeAll(() => {
  Object.assign(process.env, minimalServerEnv(), {
    R2_BUCKET_NAME_EU: 'bucket-eu-msw',
    R2_BUCKET_NAME_ME: 'bucket-me-msw',
  });
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('regional-storage + MSW (R2)', () => {
  it('headRegionalObject and deleteRegionalObject hit mock R2 after PUT', async () => {
    const { createR2Client } = await import('../r2.js');
    const { deleteRegionalObject, headRegionalObject } = await import('../regional-storage.js');

    const client = createR2Client();
    const key = 'msw-integration/org/doc.txt';
    const bucket = process.env.R2_BUCKET_NAME_EU!;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: 'integration',
        ContentType: 'text/plain',
      }),
    );

    const head = await headRegionalObject(key, 'EU');
    expect(head.ContentLength).toBeGreaterThanOrEqual(1);

    await deleteRegionalObject(key, 'EU');

    await expect(headRegionalObject(key, 'EU')).rejects.toThrow();
  });
});
