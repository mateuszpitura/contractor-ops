import type { ReactNode } from 'react';

import { cn } from '../lib/utils.js';

/**
 * Payload Lexical serialized editor state — minimal structural contract.
 * Full node typing lives in app-specific renderers (landing/cms).
 */
export type LexicalSerializedState = {
  root?: {
    children?: LexicalSerializedNode[];
  };
};

export type LexicalSerializedNode = {
  type?: string;
  text?: string;
  tag?: string;
  children?: LexicalSerializedNode[];
};

export type LexicalRendererProps = {
  /** Serialized Lexical JSON from Payload CMS. */
  data: unknown;
  className?: string;
  /** Called when an unsupported node type is encountered. */
  onUnsupportedNode?: (nodeType: string) => void;
};

function isLexicalState(data: unknown): data is LexicalSerializedState {
  return (
    typeof data === 'object' &&
    data !== null &&
    'root' in data &&
    typeof (data as LexicalSerializedState).root === 'object'
  );
}

function renderInline(nodes: LexicalSerializedNode[] | undefined): ReactNode {
  if (!nodes?.length) return null;
  return nodes.map((node, index) => {
    if (node.type === 'text' && typeof node.text === 'string') {
      // biome-ignore lint/suspicious/noArrayIndexKey: static lexical parse tree, never reordered — nodes have no stable id
      return <span key={index}>{node.text}</span>;
    }
    if (node.children?.length) {
      // biome-ignore lint/suspicious/noArrayIndexKey: static lexical parse tree, never reordered — nodes have no stable id
      return <span key={index}>{renderInline(node.children)}</span>;
    }
    return null;
  });
}

function renderBlock(
  node: LexicalSerializedNode,
  index: number,
  onUnsupportedNode?: (nodeType: string) => void,
): ReactNode {
  const type = node.type ?? 'unknown';

  switch (type) {
    case 'paragraph':
      return (
        <p key={index} className="mb-4 leading-relaxed">
          {renderInline(node.children)}
        </p>
      );
    case 'heading': {
      const tag = node.tag ?? 'h2';
      const content = renderInline(node.children);
      if (tag === 'h1') return <h1 key={index}>{content}</h1>;
      if (tag === 'h3') return <h3 key={index}>{content}</h3>;
      if (tag === 'h4') return <h4 key={index}>{content}</h4>;
      if (tag === 'h5') return <h5 key={index}>{content}</h5>;
      if (tag === 'h6') return <h6 key={index}>{content}</h6>;
      return <h2 key={index}>{content}</h2>;
    }
    case 'quote':
      return (
        <blockquote
          key={index}
          className="border-s-4 border-border ps-4 italic text-muted-foreground">
          {renderInline(node.children)}
        </blockquote>
      );
    case 'linebreak':
      return <br key={index} />;
    default:
      onUnsupportedNode?.(type);
      return null;
  }
}

/**
 * Minimal shared Lexical renderer — covers paragraph/heading/quote/text nodes.
 * Apps with richer editor configs should wrap or replace via their own renderer.
 */
export function LexicalRenderer({
  data,
  className,
  onUnsupportedNode,
}: LexicalRendererProps): ReactNode {
  if (!isLexicalState(data)) {
    return null;
  }

  const blocks = data.root?.children ?? [];
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={cn('lexical-content', className)}>
      {blocks.map((node, index) => renderBlock(node, index, onUnsupportedNode))}
    </div>
  );
}
