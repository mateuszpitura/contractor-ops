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
  if (!label) return null;

  return (
    <div className="space-y-3">
      {label.format === 'IMAGE' ? (
        <img src={label.url} alt="Shipping label" className="max-w-full" />
      ) : (
        <object data={label.url} type="application/pdf" className="h-64 w-full">
          <a href={label.url}>Download label (PDF)</a>
        </object>
      )}
      {trackingNumber && (
        <p className="text-sm text-muted-foreground">Tracking: {trackingNumber}</p>
      )}
      {paczkomatName && <p className="text-sm text-muted-foreground">Drop-off: {paczkomatName}</p>}
      <div className="flex gap-2">
        <a href={label.url} download className="text-sm underline">
          Download
        </a>
        <button type="button" className="text-sm underline" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </div>
  );
}
