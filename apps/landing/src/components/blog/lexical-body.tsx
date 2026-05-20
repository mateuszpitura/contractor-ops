import { cn } from '@contractor-ops/ui/lib/utils';
import type { ReactNode } from 'react';
import { sanitizeHref } from '@/lib/sanitize-href';

/**
 * Narrow renderer for the Payload Lexical rich-text JSON shape.
 *
 * Lexical emits a `{ root: { children: [...] } }` envelope where each node
 * carries a `type` plus type-specific fields. We only render the node types
 * we actually expose in the editor — anything unknown is dropped with a
 * caller-side log opportunity (server console in dev, Sentry in prod). The
 * goal is "good-enough" output for the small subset of formatting our
 * authors can produce; do NOT extend this without checking the schema in
 * apps/cms/src/payload-types.ts.
 *
 * Source format reference: https://payloadcms.com/docs/lexical/overview
 */

type LexicalFormat = number;

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 1 << 1;
const FORMAT_STRIKETHROUGH = 1 << 2;
const FORMAT_UNDERLINE = 1 << 3;
const FORMAT_CODE = 1 << 4;
const FORMAT_SUBSCRIPT = 1 << 5;
const FORMAT_SUPERSCRIPT = 1 << 6;

interface LexicalRootNode {
  type: 'root';
  children?: LexicalNode[];
}

interface LexicalParagraph {
  type: 'paragraph';
  children?: LexicalNode[];
  format?: string;
}

interface LexicalHeading {
  type: 'heading';
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children?: LexicalNode[];
}

interface LexicalList {
  type: 'list';
  listType: 'bullet' | 'number';
  start?: number;
  children?: LexicalListItem[];
}

interface LexicalListItem {
  type: 'listitem';
  children?: LexicalNode[];
}

interface LexicalQuote {
  type: 'quote';
  children?: LexicalNode[];
}

interface LexicalLink {
  type: 'link';
  fields?: { url?: string; newTab?: boolean; linkType?: 'internal' | 'custom' };
  url?: string;
  children?: LexicalNode[];
}

interface LexicalText {
  type: 'text';
  text: string;
  format?: LexicalFormat;
}

interface LexicalLineBreak {
  type: 'linebreak';
}

interface LexicalHorizontalRule {
  type: 'horizontalrule';
}

interface LexicalUnknown {
  type: string;
  children?: LexicalNode[];
}

type LexicalNode =
  | LexicalParagraph
  | LexicalHeading
  | LexicalList
  | LexicalListItem
  | LexicalQuote
  | LexicalLink
  | LexicalText
  | LexicalLineBreak
  | LexicalHorizontalRule
  | LexicalUnknown;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// sanitizeHref now lives in '@/lib/sanitize-href' so other consumers share one implementation.

/**
 * Heading slug helper. Tracks IDs already emitted in this body so duplicate
 * heading text doesn't collapse to the same anchor — second occurrence gets
 * `-2`, third gets `-3`, and so on. Full text is preserved (no truncation)
 * because long slugs are still cheap and survive collisions exactly.
 */
function makeHeadingSlug(text: string, seen: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!base) {
    return '';
  }
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  return count === 1 ? base : `${base}-${count}`;
}

function applyTextFormat(text: string, format: LexicalFormat | undefined): ReactNode {
  if (!format) {
    return text;
  }
  let node: ReactNode = text;
  if (format & FORMAT_CODE) {
    node = <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.92em]">{node}</code>;
  }
  if (format & FORMAT_SUBSCRIPT) {
    node = <sub>{node}</sub>;
  }
  if (format & FORMAT_SUPERSCRIPT) {
    node = <sup>{node}</sup>;
  }
  if (format & FORMAT_STRIKETHROUGH) {
    node = <s>{node}</s>;
  }
  if (format & FORMAT_UNDERLINE) {
    node = <u>{node}</u>;
  }
  if (format & FORMAT_ITALIC) {
    node = <em>{node}</em>;
  }
  if (format & FORMAT_BOLD) {
    node = <strong>{node}</strong>;
  }
  return node;
}

interface RenderCtx {
  seen: Map<string, number>;
}

function renderChildren(children: LexicalNode[] | undefined, ctx: RenderCtx): ReactNode[] {
  if (!children) {
    return [];
  }
  return children.map((child, index) => renderNode(child, index, ctx));
}

function renderNode(node: LexicalNode, key: number, ctx: RenderCtx): ReactNode {
  if (!isObject(node) || typeof node.type !== 'string') {
    return null;
  }
  switch (node.type) {
    case 'text': {
      const tn = node as LexicalText;
      return <span key={key}>{applyTextFormat(tn.text ?? '', tn.format)}</span>;
    }
    case 'linebreak':
      return <br key={key} />;
    case 'horizontalrule':
      return <hr key={key} className="my-8 border-border/40" />;
    case 'paragraph': {
      const pn = node as LexicalParagraph;
      const alignToken = typeof pn.format === 'string' && pn.format.length > 0 ? pn.format : null;
      const align =
        alignToken && /^(left|center|right|justify)$/.test(alignToken)
          ? `text-${alignToken}`
          : undefined;
      return (
        <p key={key} className={cn('my-4 leading-relaxed', align)}>
          {renderChildren(pn.children, ctx)}
        </p>
      );
    }
    case 'heading': {
      const hn = node as LexicalHeading;
      const Tag = hn.tag;
      const headingText = collectText(hn.children);
      const id = headingText ? makeHeadingSlug(headingText, ctx.seen) : undefined;
      const headingClass = cn(
        'mt-10 mb-3 scroll-mt-32 font-semibold tracking-tight text-foreground',
        Tag === 'h1' && 'text-4xl',
        Tag === 'h2' && 'text-3xl',
        Tag === 'h3' && 'text-2xl',
        Tag === 'h4' && 'text-xl',
        Tag === 'h5' && 'text-lg',
        Tag === 'h6' && 'text-base',
      );
      return (
        <Tag key={key} id={id} className={headingClass}>
          {renderChildren(hn.children, ctx)}
        </Tag>
      );
    }
    case 'list': {
      const ln = node as LexicalList;
      const ordered = ln.listType === 'number';
      const ListTag = ordered ? 'ol' : 'ul';
      return (
        <ListTag
          key={key}
          className={cn(
            'my-4 ps-6',
            ordered ? 'list-decimal' : 'list-disc',
            'marker:text-muted-foreground',
          )}
          start={ordered ? ln.start : undefined}>
          {renderChildren(ln.children, ctx)}
        </ListTag>
      );
    }
    case 'listitem': {
      const lin = node as LexicalListItem;
      return (
        <li key={key} className="my-1 leading-relaxed">
          {renderChildren(lin.children, ctx)}
        </li>
      );
    }
    case 'quote': {
      const qn = node as LexicalQuote;
      return (
        <blockquote
          key={key}
          className="my-6 border-s-2 border-primary/60 bg-primary/5 ps-4 py-2 text-foreground/90 italic">
          {renderChildren(qn.children, ctx)}
        </blockquote>
      );
    }
    case 'link': {
      const linkNode = node as LexicalLink;
      const rawHref = linkNode.fields?.url ?? linkNode.url ?? '#';
      const href = sanitizeHref(rawHref);
      const isExternal = /^https?:\/\//i.test(href);
      const newTab = linkNode.fields?.newTab === true;
      return (
        <a
          key={key}
          href={href}
          className="text-primary underline-offset-4 hover:underline"
          target={newTab || isExternal ? '_blank' : undefined}
          rel={newTab || isExternal ? 'noopener noreferrer' : undefined}>
          {renderChildren(linkNode.children, ctx)}
        </a>
      );
    }
    default: {
      const unknown = node as LexicalUnknown;
      if (unknown.children && unknown.children.length > 0) {
        // Best-effort: keep walking children for unknown wrapper nodes.
        return <span key={key}>{renderChildren(unknown.children, ctx)}</span>;
      }
      return null;
    }
  }
}

function collectText(children: LexicalNode[] | undefined): string {
  if (!children) {
    return '';
  }
  const parts: string[] = [];
  // Cycle guard: malformed CMS payload that loops a child back at an
  // ancestor would otherwise blow the stack. WeakSet so we don't retain
  // node references after the walk finishes.
  const seen = new WeakSet<object>();
  const walk = (node: unknown): void => {
    if (!isObject(node) || seen.has(node)) {
      return;
    }
    seen.add(node);
    if (node.type === 'text' && typeof node.text === 'string') {
      parts.push(node.text);
      return;
    }
    if (Array.isArray((node as { children?: unknown[] }).children)) {
      for (const child of (node as { children: unknown[] }).children) {
        walk(child);
      }
    }
  };
  for (const child of children) {
    walk(child);
  }
  return parts.join(' ').trim();
}

export interface LexicalBodyProps {
  body: unknown;
  className?: string;
}

/**
 * Render a Payload Lexical body. Returns null if the value is missing or
 * malformed; the caller should provide a fallback (e.g. the excerpt).
 */
export function LexicalBody({ body, className }: LexicalBodyProps): ReactNode {
  if (!isObject(body)) {
    return null;
  }
  const rootEnvelope = (body as { root?: LexicalRootNode }).root;
  if (!(rootEnvelope && Array.isArray(rootEnvelope.children))) {
    return null;
  }
  const ctx: RenderCtx = { seen: new Map() };
  return (
    <div className={cn('text-base text-foreground/90', className)}>
      {renderChildren(rootEnvelope.children, ctx)}
    </div>
  );
}

/**
 * Extract level-2 + level-3 headings for the table of contents.
 * Mirrors `headingSlug` so anchor IDs stay in sync between TOC + headings.
 */
export interface ExtractedHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function extractHeadings(body: unknown): ExtractedHeading[] {
  if (!isObject(body)) {
    return [];
  }
  const root = (body as { root?: LexicalRootNode }).root;
  if (!(root && Array.isArray(root.children))) {
    return [];
  }
  // Share the same dedup map shape as the renderer so the (n+1)-th heading
  // suffix (`-2`, `-3`, …) stays in lock-step with the rendered anchor ID.
  const seen = new Map<string, number>();
  const out: ExtractedHeading[] = [];
  for (const child of root.children) {
    if (!isObject(child) || child.type !== 'heading') {
      continue;
    }
    const heading = child as LexicalHeading;
    if (heading.tag !== 'h2' && heading.tag !== 'h3') {
      continue;
    }
    const text = collectText(heading.children);
    if (!text) {
      continue;
    }
    const id = makeHeadingSlug(text, seen);
    if (!id) {
      continue;
    }
    out.push({ id, text, level: heading.tag === 'h2' ? 2 : 3 });
  }
  return out;
}
