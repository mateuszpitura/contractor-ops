import { useEinvoiceImportEnabled } from '../hooks/use-einvoice-import-enabled.js';
import { ImportSplitButtonCreateOnly, ImportSplitButtonView } from './import-split-button.js';

export interface ImportSplitButtonContainerProps {
  onCreateNewClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function ImportSplitButtonContainer({
  onCreateNewClick,
  className,
  disabled = false,
}: ImportSplitButtonContainerProps) {
  const importEnabled = useEinvoiceImportEnabled();

  if (!importEnabled) {
    return (
      <ImportSplitButtonCreateOnly
        onCreateNewClick={onCreateNewClick}
        className={className}
        disabled={disabled}
      />
    );
  }

  return (
    <ImportSplitButtonView
      onCreateNewClick={onCreateNewClick}
      className={className}
      disabled={disabled}
    />
  );
}
