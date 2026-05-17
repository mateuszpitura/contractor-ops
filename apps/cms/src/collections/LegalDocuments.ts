import { createHmac, timingSafeEqual } from 'node:crypto';
import { createLogger } from '@contractor-ops/logger';
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload';

import { getCmsEnv } from '../lib/env.js';

const log = createLogger({ service: 'cms', module: 'legal-documents' });

export const LEGAL_DOC_TYPES = [
  'privacy',
  'terms',
  'sub-processors',
  'breach-notification',
] as const;

export const LEGAL_JURISDICTIONS = ['gb', 'de', 'eu', 'ae', 'sa'] as const;

type LegalDocPayload = {
  type: string;
  jurisdiction: string;
  locale?: string;
};

function buildSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

async function dispatchWebhook(payload: LegalDocPayload): Promise<void> {
  // Bypass during the one-shot seed (apps/web is typically offline at that
  // point — the noisy ECONNREFUSED log is misleading). Set by
  // scripts/migrate-legal-from-tsx.ts before any payload.create/update call.
  if (process.env.CMS_SUPPRESS_WEBHOOKS === '1') {
    return;
  }
  const env = getCmsEnv();
  const target = env.WEB_APP_URL;
  const secret = env.CMS_WEBHOOK_SECRET;
  if (!(target && secret)) {
    return;
  }
  const body = JSON.stringify(payload);
  const signature = buildSignature(body, secret);
  try {
    const response = await fetch(`${target.replace(/\/$/, '')}/api/revalidate-legal`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cms-signature': signature,
      },
      body,
    });
    if (!response.ok) {
      log.warn(
        { status: response.status, target, payload },
        'revalidate-legal webhook returned non-2xx',
      );
    }
  } catch (error) {
    log.warn({ err: error, target, payload }, 'revalidate-legal webhook unreachable');
  }
}

const onChange: CollectionAfterChangeHook = async ({ doc }) => {
  const value = doc as LegalDocPayload;
  if (value?.type && value?.jurisdiction) {
    await dispatchWebhook({
      type: value.type,
      jurisdiction: value.jurisdiction,
    });
  }
  return doc;
};

const onDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  const value = doc as LegalDocPayload;
  if (value?.type && value?.jurisdiction) {
    await dispatchWebhook({
      type: value.type,
      jurisdiction: value.jurisdiction,
    });
  }
  return doc;
};

export function verifyLegalWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = buildSignature(rawBody, secret);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export const LegalDocuments: CollectionConfig = {
  slug: 'legal-documents',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['type', 'jurisdiction', 'version', 'effectiveDate', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  versions: {
    drafts: {
      schedulePublish: true,
    },
    maxPerDoc: 20,
  },
  hooks: {
    afterChange: [onChange],
    afterDelete: [onDelete],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: LEGAL_DOC_TYPES.map(value => ({ label: value, value })),
        },
        {
          name: 'jurisdiction',
          type: 'select',
          required: true,
          options: LEGAL_JURISDICTIONS.map(value => ({ label: value, value })),
        },
      ],
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'version',
      type: 'text',
      required: true,
      defaultValue: '1.0.0',
    },
    {
      name: 'effectiveDate',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
      localized: true,
    },
  ],
  indexes: [
    {
      fields: ['type', 'jurisdiction'],
      unique: true,
    },
  ],
};
