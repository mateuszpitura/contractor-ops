import 'server-only';
import { getPayload } from 'payload';
import type { Locale } from '@/i18n/config';
import config from '@/payload.config';

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
  body: unknown;
  seo?: {
    title?: string | null;
    description?: string | null;
  };
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

function mapMedia(value: unknown): PostMedia | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const m = value as {
    id?: string | number;
    url?: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  if (!m.id) {
    return null;
  }
  return {
    id: String(m.id),
    url: m.url ?? null,
    alt: m.alt ?? '',
    width: m.width ?? null,
    height: m.height ?? null,
  };
}

function toSummary(doc: Record<string, unknown>): PublishedPostSummary {
  const tagsArray = Array.isArray(doc.tags)
    ? (doc.tags as Array<{ tag: string }>).map(t => t.tag).filter(Boolean)
    : [];
  return {
    id: String(doc.id),
    slug: String(doc.slug ?? ''),
    title: String(doc.title ?? ''),
    excerpt: doc.excerpt ? String(doc.excerpt) : null,
    author: String(doc.author ?? ''),
    publishedAt: doc.publishedAt ? String(doc.publishedAt) : null,
    coverImage: mapMedia(doc.coverImage),
    tags: tagsArray,
  };
}

function toFullPost(doc: Record<string, unknown>): PublishedPost {
  const summary = toSummary(doc);
  return {
    ...summary,
    body: doc.body,
    seo: (doc.seo as PublishedPost['seo']) ?? undefined,
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
    docs: result.docs.map(d => toSummary(d as Record<string, unknown>)),
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
  return first ? toFullPost(first as Record<string, unknown>) : null;
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
  return result.docs.map(d => String((d as { slug?: unknown }).slug ?? '')).filter(Boolean);
}
