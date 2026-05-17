import type { CollectionConfig } from 'payload';

import { getCmsEnv } from '../lib/env.js';

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name'],
  },
  auth: {
    tokenExpiration: 7200,
    cookies: {
      sameSite: 'Lax',
      secure: getCmsEnv().NODE_ENV === 'production',
    },
    maxLoginAttempts: 5,
    lockTime: 600 * 1000,
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: false,
    },
  ],
};
