import { createHmac, timingSafeEqual } from 'node:crypto';
import { createLogger } from '@contractor-ops/logger';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const log = createLogger({ service: 'web', module: 'revalidate-legal' });

const REVALIDATE_PROFILE = 'max';

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CMS_WEBHOOK_SECRET;
  if (!secret) {
    log.error({}, 'CMS_WEBHOOK_SECRET not configured');
    return Response.json({ ok: false, reason: 'not_configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-cms-signature');
  if (!verifySignature(rawBody, signature, secret)) {
    log.warn({ signature }, 'rejected webhook: bad signature');
    return Response.json({ ok: false, reason: 'bad_signature' }, { status: 401 });
  }

  type Payload = { type?: string; jurisdiction?: string; locale?: string };
  let parsed: Payload | null = null;
  try {
    parsed = rawBody.length === 0 ? null : (JSON.parse(rawBody) as Payload);
  } catch {
    return Response.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }
  const type = parsed?.type;
  const jurisdiction = parsed?.jurisdiction;
  if (!(type && jurisdiction)) {
    return Response.json({ ok: false, reason: 'missing_fields' }, { status: 400 });
  }

  const tag = `legal:${type}:${jurisdiction}`;
  revalidateTag(tag, REVALIDATE_PROFILE);
  log.info({ tag }, 'revalidated legal tag');

  return Response.json({ ok: true, tag });
}
