// Minimal builder for Payload Lexical serialized JSON. Only emits the node
// shapes the headless CMS UI roundtrips losslessly. Suitable for migration
// seeds; new content should be authored in the admin UI.

import type { LegalDocument } from '../payload-types';

// Pin the builder output to the exact body shape Payload generates for the
// `legal-documents` collection. Posts.body uses the identical structure, so
// the alias is shared.
export type LexicalBody = LegalDocument['body'];

// `BuilderBlock` is the narrowed shape every builder helper actually returns.
// Each block is assignable to the looser generated `LexicalBlock` envelope
// `{ type: any; version: number; [k: string]: unknown }` — the wider type
// flows through `doc()` so the catalog still type-checks against
// `LegalDocument['body']` without `as unknown`.
export type BuilderBlock = {
  type: 'heading' | 'paragraph' | 'list' | 'listitem';
  version: number;
  tag?: 'h1' | 'h2' | 'h3';
  listType?: 'bullet' | 'number';
  start?: number;
  direction: 'ltr';
  format: '';
  indent: 0;
  children: ReadonlyArray<LexicalInlineNode | BuilderBlock>;
};

export type LexicalText = {
  type: 'text';
  text: string;
  format: number;
  detail: number;
  mode: 'normal';
  style: '';
  version: 1;
};

export type LexicalLink = {
  type: 'link';
  fields: { url: string; newTab?: boolean; linkType: 'custom' };
  children: LexicalInlineNode[];
  format: '';
  indent: 0;
  version: 3;
};

export type LexicalInlineNode = LexicalText | LexicalLink;

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 1 << 1;

export type InlineSpec =
  | string
  | { text: string; bold?: boolean; italic?: boolean }
  | { link: string; text: string; newTab?: boolean };

function text(spec: InlineSpec): LexicalInlineNode {
  if (typeof spec === 'string') {
    return baseText(spec, 0);
  }
  if ('link' in spec) {
    return {
      type: 'link',
      fields: { url: spec.link, newTab: spec.newTab ?? true, linkType: 'custom' },
      children: [baseText(spec.text, 0)],
      format: '',
      indent: 0,
      version: 3,
    };
  }
  let format = 0;
  if (spec.bold) format |= FORMAT_BOLD;
  if (spec.italic) format |= FORMAT_ITALIC;
  return baseText(spec.text, format);
}

function baseText(value: string, format: number): LexicalText {
  return { type: 'text', text: value, format, detail: 0, mode: 'normal', style: '', version: 1 };
}

function blockOf(
  type: BuilderBlock['type'],
  tag: BuilderBlock['tag'] | undefined,
  children: BuilderBlock['children'],
  version = 1,
): BuilderBlock {
  return {
    type,
    version,
    ...(tag ? { tag } : {}),
    direction: 'ltr',
    format: '',
    indent: 0,
    children,
  };
}

export function h1(...inlines: InlineSpec[]): BuilderBlock {
  return blockOf('heading', 'h1', inlines.map(text));
}

export function h2(...inlines: InlineSpec[]): BuilderBlock {
  return blockOf('heading', 'h2', inlines.map(text));
}

export function h3(...inlines: InlineSpec[]): BuilderBlock {
  return blockOf('heading', 'h3', inlines.map(text));
}

export function p(...inlines: InlineSpec[]): BuilderBlock {
  return blockOf('paragraph', undefined, inlines.map(text));
}

type ListItem = InlineSpec[];

function listOf(listType: 'bullet' | 'number', items: ListItem[]): BuilderBlock {
  const children: BuilderBlock[] = items.map((row, index) => ({
    type: 'listitem',
    version: 1,
    start: index + 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children: row.map(text),
  }));
  return {
    type: 'list',
    version: 1,
    listType,
    start: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children,
  };
}

export function ul(...items: ListItem[]): BuilderBlock {
  return listOf('bullet', items);
}

export function ol(...items: ListItem[]): BuilderBlock {
  return listOf('number', items);
}

export function doc(...blocks: BuilderBlock[]): LexicalBody {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: blocks,
    },
  };
}

export const b = (value: string): InlineSpec => ({ text: value, bold: true });
export const i = (value: string): InlineSpec => ({ text: value, italic: true });
export const a = (text: string, href: string, newTab = true): InlineSpec => ({
  link: href,
  text,
  newTab,
});
