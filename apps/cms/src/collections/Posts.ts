import { revalidateTag } from 'next/cache';
import type {
  Access,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Where,
} from 'payload';

import { slugify } from '../lib/slugify';

const REVALIDATE_PROFILE = 'max';

function estimateWordCount(value: unknown): number {
  if (!value) {
    return 0;
  }
  let count = 0;
  const visit = (node: unknown): void => {
    if (node === null || node === undefined) {
      return;
    }
    if (typeof node === 'string') {
      count += node.trim().split(/\s+/).filter(Boolean).length;
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }
      return;
    }
    if (typeof node === 'object') {
      for (const child of Object.values(node as Record<string, unknown>)) {
        visit(child);
      }
    }
  };
  visit(value);
  return count;
}

// See Authors.ts for rationale — revalidateTag needs the Next.js
// request-scoped store and crashes inside one-shot tsx seed scripts.
const isSuppressed = (): boolean => process.env.CMS_SUPPRESS_WEBHOOKS === '1';

const onAfterChange: CollectionAfterChangeHook = ({ doc }) => {
  if (isSuppressed()) return doc;
  revalidateTag('posts:list', REVALIDATE_PROFILE);
  if (doc?.id) {
    revalidateTag(`post:${doc.id}`, REVALIDATE_PROFILE);
  }
  return doc;
};

const onAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  if (isSuppressed()) return doc;
  revalidateTag('posts:list', REVALIDATE_PROFILE);
  if (doc?.id) {
    revalidateTag(`post:${doc.id}`, REVALIDATE_PROFILE);
  }
  return doc;
};

const publishedAccess: Access = ({ req }) => {
  if (req.user) {
    return true;
  }
  const filter: Where = {
    and: [
      { status: { equals: 'published' } },
      { publishedAt: { less_than_equal: new Date().toISOString() } },
    ],
  };
  return filter;
};

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'status', 'publishedAt'],
  },
  access: {
    read: publishedAccess,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  versions: {
    drafts: {
      autosave: { interval: 1500 },
      schedulePublish: true,
    },
    maxPerDoc: 10,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data?.title && !data.slug) {
          data.slug = slugify(String(data.title));
        }
        if (data?.body) {
          const wordCount = estimateWordCount(data.body);
          data.readingTimeMinutes =
            wordCount === 0 ? null : Math.max(1, Math.round(wordCount / 220));
        }
        return data;
      },
    ],
    afterChange: [onAfterChange],
    afterDelete: [onAfterDelete],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              localized: true,
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              localized: true,
              unique: true,
              index: true,
            },
            {
              name: 'excerpt',
              type: 'textarea',
              localized: true,
            },
            {
              name: 'body',
              type: 'richText',
              required: true,
              localized: true,
            },
            {
              name: 'coverImage',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  'Optional larger hero image rendered above the post body. Falls back to coverImage when empty.',
              },
            },
            {
              name: 'author',
              type: 'text',
              localized: true,
              admin: {
                description:
                  'Legacy plain-text author byline. Prefer the relation in “Authors” below.',
              },
            },
            {
              name: 'authors',
              type: 'relationship',
              relationTo: 'authors',
              hasMany: true,
              admin: {
                description: 'Linked Authors collection. Drives /blog/author/[handle] archives.',
              },
            },
            {
              name: 'categories',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
            },
            {
              name: 'tags',
              type: 'array',
              localized: true,
              fields: [
                {
                  name: 'tag',
                  type: 'text',
                  required: true,
                },
              ],
            },
            {
              name: 'readingTimeMinutes',
              type: 'number',
              admin: {
                readOnly: true,
                description: 'Computed from body word count by the beforeChange hook (≈220 wpm).',
              },
            },
          ],
        },
        {
          label: 'Publishing',
          fields: [
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'draft',
              options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' },
              ],
            },
            {
              name: 'publishedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'seo',
              type: 'group',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  localized: true,
                },
                {
                  name: 'description',
                  type: 'textarea',
                  localized: true,
                },
                {
                  name: 'ogImage',
                  type: 'upload',
                  relationTo: 'media',
                  admin: {
                    description:
                      'Optional override; defaults to heroImage / coverImage when empty.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
