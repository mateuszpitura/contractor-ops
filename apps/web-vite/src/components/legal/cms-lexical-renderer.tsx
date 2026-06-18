import { LexicalRenderer as SharedLexicalRenderer } from '@contractor-ops/ui';
import type { ReactNode } from 'react';

import { A, H1, H2, H3, Li, Ol, P, Strong, Ul } from './privacy-prose.js';

type AnyNode = {
  type: string;
  tag?: string;
  text?: string;
  format?: number | string;
  listType?: 'bullet' | 'number';
  children?: AnyNode[];
  fields?: { url?: string; newTab?: boolean };
};

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 1 << 1;

function renderInline(node: AnyNode, index: number): ReactNode {
  if (node.type === 'text') {
    const format = typeof node.format === 'number' ? node.format : 0;
    let element: ReactNode = node.text ?? '';
    if (format & FORMAT_BOLD) {
      element = <Strong key={`b-${index}`}>{element}</Strong>;
    }
    if (format & FORMAT_ITALIC) {
      element = <em key={`i-${index}`}>{element}</em>;
    }
    return <span key={index}>{element}</span>;
  }
  if (node.type === 'link') {
    const url = node.fields?.url ?? '#';
    const newTab = node.fields?.newTab ?? true;
    return (
      <A
        key={index}
        href={url}
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noopener noreferrer' : undefined}>
        {(node.children ?? []).map(renderInline)}
      </A>
    );
  }
  return null;
}

function renderBlock(node: AnyNode, index: number): ReactNode {
  const children = (node.children ?? []).map(renderInline);
  switch (node.type) {
    case 'heading':
      if (node.tag === 'h1') return <H1 key={index}>{children}</H1>;
      if (node.tag === 'h2') return <H2 key={index}>{children}</H2>;
      return <H3 key={index}>{children}</H3>;
    case 'paragraph':
      return <P key={index}>{children}</P>;
    case 'list':
      if (node.listType === 'number') {
        return (
          <Ol key={index}>
            {(node.children ?? []).map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static lexical parse tree, never reordered — nodes have no stable id
              <Li key={j}>{(item.children ?? []).map(renderInline)}</Li>
            ))}
          </Ol>
        );
      }
      return (
        <Ul key={index}>
          {(node.children ?? []).map((item, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static lexical parse tree, never reordered — nodes have no stable id
            <Li key={j}>{(item.children ?? []).map(renderInline)}</Li>
          ))}
        </Ul>
      );
    default:
      return null;
  }
}

export function CmsLexicalRenderer({ data }: { data: unknown }): ReactNode {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const root = (data as { root?: AnyNode }).root;
  if (!(root && Array.isArray(root.children))) {
    return null;
  }

  const hasLegalProseNodes = root.children.some(node => {
    const type = node.type;
    return type === 'list' || type === 'link' || (type === 'heading' && node.tag === 'h1');
  });

  if (hasLegalProseNodes) {
    return <>{root.children.map(renderBlock)}</>;
  }

  return <SharedLexicalRenderer data={data} />;
}
