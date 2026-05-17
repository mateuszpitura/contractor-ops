import 'server-only';
import { getPayload } from 'payload';

import type { Locale } from '@/i18n/config';
import config from '@/payload.config';
import type { Media, Post } from '../payload-types';

export type PublishedPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  author: string;
  publishedAt: string | null;
  coverImage: PostMedia | null;
  tags: string[];
};

export type PublishedPost = PublishedPostSummary & {
  body: Post['body'];
  seo?: Post['seo'];
};

export type PostMedia = {
  id: string;
  url: string | null;
  alt: string;
  width: number | null;
  height: number | null;
};

type FetchOptions = {
  locale: Locale;
  page?: number;
  limit?: number;
};

let payloadPromise: ReturnType<typeof getPayload> | null = null;

async function payload() {
  if (!payloadPromise) {
    payloadPromise = getPayload({ config });
  }
  return payloadPromise;
}

function mapMedia(value: Post['coverImage']): PostMedia | null {
  if (value === null || value === undefined) {
    return null;
  }
  // `coverImage` is `number | Media | null` — when depth >= 1 Payload populates
  // the relation, otherwise we only receive the id and bail.
  if (typeof value === 'number') {
    return null;
  }
  const m = value as Media;
  return {
    id: String(m.id),
    url: m.url ?? null,
    alt: m.alt ?? '',
    width: m.width ?? null,
    height: m.height ?? null,
  };
}

function toSummary(post: Post): PublishedPostSummary {
  return {
    id: String(post.id),
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? null,
    author: post.author,
    publishedAt: post.publishedAt ?? null,
    coverImage: mapMedia(post.coverImage ?? null),
    tags: (post.tags ?? []).map(t => t.tag).filter(Boolean),
  };
}

function toFullPost(post: Post): PublishedPost {
  return {
    ...toSummary(post),
    body: post.body,
    seo: post.seo,
  };
}

const PUBLISHED_FILTER = {
  status: { equals: 'published' as const },
  publishedAt: { less_than_equal: new Date().toISOString() },
};

export async function fetchPublishedPosts(opts: FetchOptions): Promise<{
  docs: PublishedPostSummary[];
  totalDocs: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}> {
  const p = await payload();
  const result = await p.find({
    collection: 'posts',
    locale: opts.locale,
    where: { and: [PUBLISHED_FILTER] },
    sort: '-publishedAt',
    depth: 1,
    limit: opts.limit ?? 10,
    page: opts.page ?? 1,
  });
  return {
    docs: result.docs.map(toSummary),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page ?? 1,
    hasNextPage: result.hasNextPage,
    hasPrevPage: result.hasPrevPage,
  };
}

export async function fetchPublishedPostBySlug(
  slug: string,
  locale: Locale,
): Promise<PublishedPost | null> {
  const p = await payload();
  const result = await p.find({
    collection: 'posts',
    locale,
    where: {
      and: [PUBLISHED_FILTER, { slug: { equals: slug } }],
    },
    depth: 2,
    limit: 1,
  });
  const first = result.docs[0];
  return first ? toFullPost(first) : null;
}

export async function listLocalesForSlug(slug: string): Promise<Locale[]> {
  const p = await payload();
  const found: Locale[] = [];
  for (const locale of ['en', 'pl', 'de', 'ar'] as const) {
    const result = await p.find({
      collection: 'posts',
      locale,
      where: { and: [PUBLISHED_FILTER, { slug: { equals: slug } }] },
      limit: 1,
      depth: 0,
    });
    if (result.totalDocs > 0) {
      found.push(locale);
    }
  }
  return found;
}

export async function listAllPublishedSlugs(locale: Locale): Promise<string[]> {
  const p = await payload();
  const result = await p.find({
    collection: 'posts',
    locale,
    where: { and: [PUBLISHED_FILTER] },
    sort: '-publishedAt',
    depth: 0,
    limit: 500,
  });
  return result.docs.map(d => d.slug).filter(Boolean);
}
