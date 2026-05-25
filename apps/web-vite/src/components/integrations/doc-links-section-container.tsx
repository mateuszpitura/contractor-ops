import { DocLinksSectionSkeleton, DocLinksSectionView } from './doc-links-section.js';
import { useDocLinksSection } from './hooks/use-doc-links-section.js';

interface DocLinksSectionProps {
  workflowTaskRunId: string;
  readOnly?: boolean;
}

export function DocLinksSection(props: DocLinksSectionProps) {
  const { listQuery, ...rest } = useDocLinksSection(props);
  if (listQuery.isLoading) return <DocLinksSectionSkeleton readOnly={rest.readOnly} t={rest.t} />;
  const variant = rest.docLinks.length === 0 ? 'empty' : 'list';
  return <DocLinksSectionView {...rest} variant={variant} />;
}
