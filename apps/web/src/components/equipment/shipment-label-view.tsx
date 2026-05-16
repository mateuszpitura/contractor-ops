'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

/**
 * Stub for shipment label display.
 * TODO: implement or remove import from portal-return-flow.tsx
 */
export function LabelDisplay({
  label,
  trackingNumber,
  paczkomatName,
}: {
  label?: { url: string; format: 'PDF' | 'IMAGE' } | null;
  trackingNumber?: string | null;
  paczkomatName?: string | null;
}) {
  const t = useTranslations('Equipment');

  if (!label) return null;

  return (
    <div className="space-y-3">
      {label.format === 'IMAGE' ? (
        <Image
          src={label.url}
          alt={t('shipmentLabel.altText')}
          className="max-w-full"
          width={600}
          height={400}
          unoptimized
        />
      ) : (
        <object data={label.url} type="application/pdf" className="h-64 w-full">
          <a href={label.url}>{t('shipmentLabel.downloadPdf')}</a>
        </object>
      )}
      {!!trackingNumber && (
        <p className="text-sm text-muted-foreground">
          {t('shipmentLabel.tracking', { number: trackingNumber })}
        </p>
      )}
      {!!paczkomatName && (
        <p className="text-sm text-muted-foreground">
          {t('shipmentLabel.dropOff', { name: paczkomatName })}
        </p>
      )}
      <div className="flex gap-2">
        <a href={label.url} download className="text-sm underline">
          {t('shipmentLabel.download')}
        </a>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <button type="button" className="text-sm underline" onClick={() => window.print()}>
          {t('shipmentLabel.print')}
        </button>
      </div>
    </div>
  );
}
