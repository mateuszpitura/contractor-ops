/**
 * CMS uses Payload's RichText renderer (full Lexical feature set).
 * For framework-agnostic fallback see `@contractor-ops/ui` `LexicalRenderer`.
 */
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { RichText } from '@payloadcms/richtext-lexical/react';
import type { ReactNode } from 'react';

type Props = {
  data: unknown;
};

export function LexicalRenderer({ data }: Props): ReactNode {
  if (!data || typeof data !== 'object' || !('root' in data)) {
    return null;
  }
  return <RichText data={data as SerializedEditorState} />;
}
