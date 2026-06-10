export type MarketingPostCoverImage = {
  url: string;
  alt?: string | null;
};

export type MarketingPostAuthor = {
  id?: string | number;
  name: string;
  handle?: string | null;
};

export type MarketingPostCategory = {
  id: string | number;
  name: string;
};

export type MarketingPostSummary = {
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | Date | null;
  /** Single byline (CMS) or first author name. */
  author?: string | null;
  authors?: readonly MarketingPostAuthor[];
  tags?: string[];
  coverImage?: MarketingPostCoverImage | null;
  categories?: readonly MarketingPostCategory[];
  readingTimeMinutes?: number | null;
};
