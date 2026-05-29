/**
 * Shipment label display. Step 11 codemod port from
 * apps/web/src/components/equipment/shipment-label-view.tsx:
 *   - `next/image` → `@unpic/react` <Image> (label.url is a signed R2 URL;
 *     R2 image transforms negotiate format/size in CSR — no server-side
 *     optimizer needed).
 *   - `next-intl`  → `../../i18n/useTranslations.js`
 */

import { Image } from '@unpic/react';

import { useTranslations } from '../../i18n/useTranslations.js';

function handlePrint() {
  window.print();
}

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
        <button type="button" className="text-sm underline" onClick={handlePrint}>
          {t('shipmentLabel.print')}
        </button>
      </div>
    </div>
  );
}
