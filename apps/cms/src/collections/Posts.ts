import { revalidateTag } from 'next/cache';
import type {
  Access,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Where,
} from 'payload';

import { slugify } from '../lib/slugify.js';

const REVALIDATE_PROFILE = 'max';

const onAfterChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateTag('posts:list', REVALIDATE_PROFILE);
  if (doc?.id) {
    revalidateTag(`post:${doc.id}`, REVALIDATE_PROFILE);
  }
  return doc;
};

const onAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
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
              name: 'author',
              type: 'text',
              required: true,
              localized: true,
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
              ],
            },
          ],
        },
      ],
    },
  ],
};
