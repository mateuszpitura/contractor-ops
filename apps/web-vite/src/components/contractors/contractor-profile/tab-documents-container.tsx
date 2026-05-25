import { useContractorTabDocuments } from '../hooks/use-contractor-tab-documents.js';
import { TabDocuments, TabDocumentsEmpty, TabDocumentsSkeleton } from './tab-documents.js';

type TabDocumentsContainerProps = {
  contractorId: string;
};

export function TabDocumentsContainer({ contractorId }: TabDocumentsContainerProps) {
  const { documents, isLoading } = useContractorTabDocuments(contractorId);

  if (isLoading) return <TabDocumentsSkeleton contractorId={contractorId} />;
  if (documents.length === 0) return <TabDocumentsEmpty contractorId={contractorId} />;

  return <TabDocuments contractorId={contractorId} documents={documents} />;
}
