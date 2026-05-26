import { revalidateTag } from 'next/cache';
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload';

import { slugify } from '../lib/slugify';

const REVALIDATE_PROFILE = 'max';

// Skip revalidateTag during one-shot seed scripts. `next/cache`'s
// revalidateTag requires the Next.js request-scoped static-generation store;
// it throws "Invariant: static generation store missing" when invoked from a
// plain tsx script (see apps/cms/scripts/seed-qa.ts, seed-admin.ts,
// migrate-legal-from-tsx.ts). Set CMS_SUPPRESS_WEBHOOKS=1 in those scripts.
const isSuppressed = (): boolean => process.env.CMS_SUPPRESS_WEBHOOKS === '1';

const onAfterChange: CollectionAfterChangeHook = ({ doc }) => {
  if (isSuppressed()) return doc;
  revalidateTag('authors:list', REVALIDATE_PROFILE);
  if (doc?.handle) {
    revalidateTag(`author:${doc.handle}`, REVALIDATE_PROFILE);
  }
  return doc;
};

const onAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  if (isSuppressed()) return doc;
  revalidateTag('authors:list', REVALIDATE_PROFILE);
  if (doc?.handle) {
    revalidateTag(`author:${doc.handle}`, REVALIDATE_PROFILE);
  }
  return doc;
};

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'handle', 'email'],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.name && !data.handle) {
          data.handle = slugify(String(data.name));
        }
        return data;
      },
    ],
    afterChange: [onAfterChange],
    afterDelete: [onAfterDelete],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'handle',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bio',
      type: 'richText',
      localized: true,
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'socials',
      type: 'array',
      labels: { singular: 'Social link', plural: 'Social links' },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          validate: (value: unknown) => {
            if (typeof value !== 'string' || value.length === 0) {
              return 'URL is required.';
            }
            try {
              const url = new URL(value);
              if (!['http:', 'https:'].includes(url.protocol)) {
                return 'URL must be http or https.';
              }
              return true;
            } catch {
              return 'URL is malformed.';
            }
          },
        },
      ],
    },
  ],
};
