import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { RichText } from '@payloadcms/richtext-lexical/react';
import type { ReactNode } from 'react';

type Props = {
  data: unknown;
};

export function LexicalRenderer({ data }: Props): ReactNode {
  if (!data || typeof data !== 'object') {
    return null;
  }
  return <RichText data={data as SerializedEditorState} />;
}
