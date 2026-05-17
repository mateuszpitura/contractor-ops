// Minimal builder for Payload Lexical serialized JSON. Only emits the node
// shapes the headless CMS UI roundtrips losslessly. Suitable for migration
// seeds; new content should be authored in the admin UI.

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

type Block = {
  type: string;
  children: LexicalInlineNode[];
  direction: 'ltr';
  format: '';
  indent: 0;
  version: number;
  tag?: string;
  listType?: 'bullet' | 'number';
  start?: number;
};

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

function block(type: string, tag: string | null, inlines: InlineSpec[], version = 1): Block {
  const base: Block = {
    type,
    children: inlines.map(text),
    direction: 'ltr',
    format: '',
    indent: 0,
    version,
  };
  if (tag) {
    base.tag = tag;
  }
  return base;
}

export function h1(...inlines: InlineSpec[]): Block {
  return block('heading', 'h1', inlines, 1);
}

export function h2(...inlines: InlineSpec[]): Block {
  return block('heading', 'h2', inlines, 1);
}

export function h3(...inlines: InlineSpec[]): Block {
  return block('heading', 'h3', inlines, 1);
}

export function p(...inlines: InlineSpec[]): Block {
  return block('paragraph', null, inlines, 1);
}

type ListItem = InlineSpec[];

export function ul(...items: ListItem[]): Block {
  return {
    type: 'list',
    listType: 'bullet',
    start: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    children: items.map(
      (children, index) =>
        ({
          type: 'listitem',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          value: index + 1,
          children: children.map(text),
        }) as unknown as LexicalInlineNode,
    ),
  };
}

export function ol(...items: ListItem[]): Block {
  return {
    type: 'list',
    listType: 'number',
    start: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    children: items.map(
      (children, index) =>
        ({
          type: 'listitem',
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
          value: index + 1,
          children: children.map(text),
        }) as unknown as LexicalInlineNode,
    ),
  };
}

export function doc(...blocks: Block[]) {
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
