import { useEinvoiceImportEnabled } from '../hooks/use-einvoice-import-enabled.js';
import { ImportSplitButtonCreateOnly, ImportSplitButtonView } from './import-split-button.js';

export interface ImportSplitButtonContainerProps {
  onCreateNewClick: () => void;
  className?: string;
}

export function ImportSplitButtonContainer({
  onCreateNewClick,
  className,
}: ImportSplitButtonContainerProps) {
  const importEnabled = useEinvoiceImportEnabled();

  if (!importEnabled) {
    return (
      <ImportSplitButtonCreateOnly onCreateNewClick={onCreateNewClick} className={className} />
    );
  }

  return <ImportSplitButtonView onCreateNewClick={onCreateNewClick} className={className} />;
}
