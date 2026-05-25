import type { CsrGenerationViewProps } from './csr-generation.js';
import { CsrGenerationGenerated, CsrGenerationIdle } from './csr-generation.js';
import { useCsrGeneration } from './hooks/use-csr-generation.js';

export function CsrGeneration(props: Pick<CsrGenerationViewProps, 'onSuccess' | 'onBack'>) {
  const { csrPem, generateCsr, isPending, t, tAria } = useCsrGeneration();

  if (csrPem) {
    return (
      <CsrGenerationGenerated
        onSuccess={props.onSuccess}
        onBack={props.onBack}
        csrPem={csrPem}
        t={t}
      />
    );
  }

  return (
    <CsrGenerationIdle
      onBack={props.onBack}
      generateCsr={generateCsr}
      isPending={isPending}
      t={t}
      tAria={tAria}
    />
  );
}
