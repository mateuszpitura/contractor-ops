import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { useCsrGeneration as UseCsrGeneration } from './hooks/use-csr-generation.js';
import { useCsrGeneration } from './hooks/use-csr-generation.js';

type HookResult = ReturnType<typeof UseCsrGeneration>;
type T = HookResult['t'];
type TAria = HookResult['tAria'];

function StepShell({ body, footer, t }: { body: ReactNode; footer: ReactNode; t: T }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{t('keyType')}</span> {t('keyTypeValue')}
        </p>
        <p>{t('privateKeyNote')}</p>
      </div>

      {body}

      <div className="flex justify-end gap-2 pt-2">{footer}</div>
    </div>
  );
}

export type CsrGenerationIdleProps = {
  onBack: () => void;
  generateCsr: () => void;
  isPending: boolean;
  t: T;
  tAria: TAria;
};

export function CsrGenerationIdle({
  onBack,
  generateCsr,
  isPending,
  t,
  tAria,
}: CsrGenerationIdleProps) {
  return (
    <StepShell
      t={t}
      body={null}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('back')}
          </Button>
          <Button onClick={generateCsr} disabled={isPending}>
            {!!isPending && (
              <Loader2
                className="me-1.5 h-3.5 w-3.5 animate-spin"
                aria-label={tAria('loading')}
                aria-hidden="true"
              />
            )}
            {t('generateCsr')}
          </Button>
        </>
      }
    />
  );
}

export type CsrGenerationGeneratedProps = {
  onSuccess: () => void;
  onBack: () => void;
  csrPem: string;
  t: T;
};

export function CsrGenerationGenerated({
  onSuccess,
  onBack,
  csrPem,
  t,
}: CsrGenerationGeneratedProps) {
  return (
    <StepShell
      t={t}
      body={
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t('csrPreviewLabel')}</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
            {csrPem}
          </pre>
        </div>
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('back')}
          </Button>
          <Button onClick={onSuccess}>
            {t('next')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </>
      }
    />
  );
}

export type CsrGenerationViewProps = {
  onSuccess: () => void;
  onBack: () => void;
} & HookResult;

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
