import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { buildConfig } from 'payload';
import sharp from 'sharp';

import { LegalDocuments } from './collections/LegalDocuments.js';
import { Media } from './collections/Media.js';
import { Posts } from './collections/Posts.js';
import { Users } from './collections/Users.js';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './i18n/config.js';
import { getCmsEnv, hasR2Storage } from './lib/env.js';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const env = getCmsEnv();

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' — Contractor-Ops CMS',
    },
  },
  collections: [Posts, Media, LegalDocuments, Users],
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: env.CMS_DATABASE_URL,
    },
    migrationDir: path.resolve(dirname, '../migrations'),
  }),
  localization: {
    locales: [
      { code: 'en', label: 'English' },
      { code: 'pl', label: 'Polski' },
      { code: 'de', label: 'Deutsch' },
      { code: 'ar', label: 'العربية', rtl: true },
    ],
    defaultLocale: DEFAULT_LOCALE,
    fallback: true,
  },
  sharp,
  plugins: hasR2Storage(env)
    ? [
        s3Storage({
          collections: { media: true },
          bucket: env.R2_BUCKET_NAME as string,
          config: {
            endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
              accessKeyId: env.R2_ACCESS_KEY_ID as string,
              secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
            },
            region: 'auto',
            forcePathStyle: true,
          },
        }),
      ]
    : [],
  graphQL: {
    disable: false,
  },
});

export { SUPPORTED_LOCALES };
