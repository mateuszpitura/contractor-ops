/**
 * Typed client for the headless blog backend (Payload, apps/cms).
 *
 * Landing is a separate Next app from apps/cms, so we talk over REST.
 * Types intentionally mirror only the public read surface — keep them
 * narrow so changes in the CMS schema do not silently rot consumer code.
 */

const CMS_BASE = process.env.NEXT_PUBLIC_CMS_URL ?? 'https://blog.contractor-ops.io';

const REVALIDATE_SECONDS = 300;

/**
 * Landing-level locale set (6 entries: 4 CMS locales + en-GB + ar-SA).
 * Payload only serves content for the 4 base locales; the helper
 * `narrowToCmsLocale` folds en-GB → en and ar-SA → ar before each REST
 * call so UK / KSA visitors see the parent-locale blog content.
 */
export type Locale = 'en' | 'en-GB' | 'pl' | 'de' | 'ar' | 'ar-SA';

type CmsLocale = 'en' | 'pl' | 'de' | 'ar';

function narrowToCmsLocale(locale: Locale): CmsLocale {
  switch (locale) {
    case 'en-GB':
      return 'en';
    case 'ar-SA':
      return 'ar';
    default:
      return locale;
  }
}

export interface CmsMedia {
  id: number;
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface CmsAuthor {
  id: number;
  name: string;
  handle: string;
  bio?: unknown;
  avatar?: CmsMedia | number | null;
  email?: string | null;
  socials?: ReadonlyArray<{ label: string; url: string }> | null;
}

export interface CmsCategory {
  id: number;
  name: string;
  slug: string;
  color?: 'neutral' | 'teal' | 'amber' | 'rose' | 'indigo' | 'emerald';
  description?: string | null;
}

export interface CmsPostSummary {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  readingTimeMinutes: number | null;
  coverImage: CmsMedia | null;
  heroImage: CmsMedia | null;
  authors: readonly CmsAuthor[];
  categories: readonly CmsCategory[];
  tags: readonly string[];
}

export interface CmsPost extends CmsPostSummary {
  body: unknown;
  seo: { title?: string | null; description?: string | null; ogImage?: CmsMedia | null } | null;
}

export interface CmsPaginatedResponse<T> {
  docs: readonly T[];
  totalDocs: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface RawPayloadEnvelope<T> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  page: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function buildUrl(path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(`${CMS_BASE.replace(/\/$/, '')}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function fetchCms<T>(url: string, tag?: string): Promise<T> {
  const res = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS, tags: tag ? [tag] : undefined },
  });
  if (!res.ok) {
    throw new Error(`CMS request failed: ${res.status} ${res.statusText} (${url})`);
  }
  return (await res.json()) as T;
}

function mapMedia(value: unknown): CmsMedia | null {
  if (value === null || value === undefined || typeof value === 'number') {
    return null;
  }
  const v = value as Record<string, unknown>;
  return {
    id: Number(v.id),
    url: (v.url as string | undefined) ?? null,
    alt: (v.alt as string | undefined) ?? null,
    width: (v.width as number | undefined) ?? null,
    height: (v.height as number | undefined) ?? null,
  };
}

function mapAuthor(value: unknown): CmsAuthor | null {
  if (value === null || value === undefined || typeof value === 'number') {
    return null;
  }
  const v = value as Record<string, unknown>;
  return {
    id: Number(v.id),
    name: String(v.name ?? ''),
    handle: String(v.handle ?? ''),
    bio: v.bio,
    avatar: mapMedia(v.avatar) ?? (typeof v.avatar === 'number' ? v.avatar : null),
    email: (v.email as string | undefined) ?? null,
    socials: ((v.socials as Array<{ label: string; url: string }> | undefined) ?? []).map(s => ({
      label: s.label,
      url: s.url,
    })),
  };
}

function mapCategory(value: unknown): CmsCategory | null {
  if (value === null || value === undefined || typeof value === 'number') {
    return null;
  }
  const v = value as Record<string, unknown>;
  return {
    id: Number(v.id),
    name: String(v.name ?? ''),
    slug: String(v.slug ?? ''),
    color: (v.color as CmsCategory['color']) ?? 'neutral',
    description: (v.description as string | undefined) ?? null,
  };
}

function mapPostSummary(raw: Record<string, unknown>): CmsPostSummary {
  const tagsRaw = (raw.tags as Array<{ tag: string }> | undefined) ?? [];
  return {
    id: Number(raw.id),
    slug: String(raw.slug ?? ''),
    title: String(raw.title ?? ''),
    excerpt: (raw.excerpt as string | undefined) ?? null,
    publishedAt: (raw.publishedAt as string | undefined) ?? null,
    readingTimeMinutes: (raw.readingTimeMinutes as number | undefined) ?? null,
    coverImage: mapMedia(raw.coverImage),
    heroImage: mapMedia(raw.heroImage),
    authors: ((raw.authors as unknown[]) ?? [])
      .map(mapAuthor)
      .filter((a): a is CmsAuthor => a !== null),
    categories: ((raw.categories as unknown[]) ?? [])
      .map(mapCategory)
      .filter((c): c is CmsCategory => c !== null),
    tags: tagsRaw.map(t => t.tag).filter(Boolean),
  };
}

function mapPost(raw: Record<string, unknown>): CmsPost {
  const summary = mapPostSummary(raw);
  const seoRaw = (raw.seo as Record<string, unknown> | undefined) ?? null;
  return {
    ...summary,
    body: raw.body,
    seo: seoRaw
      ? {
          title: (seoRaw.title as string | undefined) ?? null,
          description: (seoRaw.description as string | undefined) ?? null,
          ogImage: mapMedia(seoRaw.ogImage),
        }
      : null,
  };
}

export interface GetPostsOptions {
  locale: Locale;
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  search?: string;
  authorHandle?: string;
}

export async function getPosts({
  locale,
  page = 1,
  limit = 10,
  category,
  tag,
  search,
  authorHandle,
}: GetPostsOptions): Promise<CmsPaginatedResponse<CmsPostSummary>> {
  const where: Record<string, unknown> = {
    status: { equals: 'published' },
    publishedAt: { less_than_equal: new Date().toISOString() },
  };
  if (category) {
    where['categories.slug'] = { equals: category };
  }
  if (tag) {
    where['tags.tag'] = { equals: tag };
  }
  if (authorHandle) {
    where['authors.handle'] = { equals: authorHandle };
  }
  if (search) {
    where.or = [{ title: { like: search } }, { excerpt: { like: search } }];
  }
  const url = buildUrl('/api/posts', {
    locale: narrowToCmsLocale(locale),
    depth: 2,
    sort: '-publishedAt',
    page,
    limit,
    where: JSON.stringify(where),
  });
  const data = await fetchCms<RawPayloadEnvelope<Record<string, unknown>>>(url, 'posts:list');
  return {
    docs: data.docs.map(mapPostSummary),
    totalDocs: data.totalDocs,
    totalPages: data.totalPages,
    page: data.page,
    hasNextPage: data.hasNextPage,
    hasPrevPage: data.hasPrevPage,
  };
}

export async function getPost({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}): Promise<CmsPost | null> {
  const where = {
    slug: { equals: slug },
    status: { equals: 'published' },
    publishedAt: { less_than_equal: new Date().toISOString() },
  };
  const url = buildUrl('/api/posts', {
    locale: narrowToCmsLocale(locale),
    depth: 2,
    limit: 1,
    where: JSON.stringify(where),
  });
  const data = await fetchCms<RawPayloadEnvelope<Record<string, unknown>>>(url, `post:${slug}`);
  const first = data.docs[0];
  return first ? mapPost(first) : null;
}

export async function getAuthor({
  handle,
  locale,
}: {
  handle: string;
  locale: Locale;
}): Promise<CmsAuthor | null> {
  const where = { handle: { equals: handle } };
  const url = buildUrl('/api/authors', {
    locale: narrowToCmsLocale(locale),
    depth: 1,
    limit: 1,
    where: JSON.stringify(where),
  });
  const data = await fetchCms<RawPayloadEnvelope<Record<string, unknown>>>(url, `author:${handle}`);
  return data.docs[0] ? mapAuthor(data.docs[0]) : null;
}

export async function getRelatedPosts({
  postId,
  categorySlug,
  locale,
  limit = 3,
}: {
  postId: number;
  categorySlug?: string;
  locale: Locale;
  limit?: number;
}): Promise<readonly CmsPostSummary[]> {
  const where: Record<string, unknown> = {
    status: { equals: 'published' },
    publishedAt: { less_than_equal: new Date().toISOString() },
    id: { not_equals: postId },
  };
  if (categorySlug) {
    where['categories.slug'] = { equals: categorySlug };
  }
  const url = buildUrl('/api/posts', {
    locale: narrowToCmsLocale(locale),
    depth: 2,
    sort: '-publishedAt',
    limit,
    where: JSON.stringify(where),
  });
  const data = await fetchCms<RawPayloadEnvelope<Record<string, unknown>>>(url, 'posts:related');
  return data.docs.map(mapPostSummary);
}

export async function listCategories(locale: Locale): Promise<readonly CmsCategory[]> {
  const url = buildUrl('/api/categories', {
    locale: narrowToCmsLocale(locale),
    depth: 0,
    limit: 100,
  });
  const data = await fetchCms<RawPayloadEnvelope<Record<string, unknown>>>(url, 'categories:list');
  return data.docs.map(d => mapCategory(d)).filter((c): c is CmsCategory => c !== null);
}
