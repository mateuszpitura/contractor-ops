import { revalidateTag } from 'next/cache';
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
} from 'payload';

import { slugify } from '../lib/slugify';

const REVALIDATE_PROFILE = 'max';

const onAfterChange: CollectionAfterChangeHook = ({ doc }) => {
  revalidateTag('categories:list', REVALIDATE_PROFILE);
  if (doc?.slug) {
    revalidateTag(`category:${doc.slug}`, REVALIDATE_PROFILE);
  }
  return doc;
};

const onAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateTag('categories:list', REVALIDATE_PROFILE);
  if (doc?.slug) {
    revalidateTag(`category:${doc.slug}`, REVALIDATE_PROFILE);
  }
  return doc;
};

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'color'],
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
        if (data?.name && !data.slug) {
          data.slug = slugify(String(data.name));
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'description',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'color',
      type: 'select',
      defaultValue: 'neutral',
      options: [
        { label: 'Neutral', value: 'neutral' },
        { label: 'Teal', value: 'teal' },
        { label: 'Amber', value: 'amber' },
        { label: 'Rose', value: 'rose' },
        { label: 'Indigo', value: 'indigo' },
        { label: 'Emerald', value: 'emerald' },
      ],
    },
  ],
};
