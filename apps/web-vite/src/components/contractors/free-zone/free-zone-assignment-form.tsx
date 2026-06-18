import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { Loader2, Save, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useId, useMemo, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { FreeZoneAssignmentInput } from './hooks/use-free-zone-assignment.js';

/**
 * The 11 recordable UaeFreeZoneCode values (Plan 02 gulf.prisma / Plan 05 Zod enum):
 * 10 free zones + MAINLAND. Codes are the source of truth; the human label per zone
 * is resolved from an i18n key (Plan 08 populates en/de/pl/ar). The zone Select is
 * the surface focal point (UI-SPEC) — the first interactive element of the form.
 */
const ZONE_CODES = [
  'DIFC',
  'DMCC',
  'IFZA',
  'DUBAI_INTERNET_CITY',
  'DUBAI_MEDIA_CITY',
  'MEYDAN_FZ',
  'JAFZA',
  'SHAMS',
  'RAKEZ',
  'ADGM',
  'MAINLAND',
] as const;

type ZoneCode = (typeof ZONE_CODES)[number];

export interface FreeZoneAssignmentFormProps {
  initial: {
    zone: ZoneCode | null;
    licenseNumber: string | null;
    licenseCategory: string | null;
    licenseExpiresAt: string | null;
    permittedActivitiesText: string | null;
    permittedActivityIsicCodes: string[];
  };
  isSaving: boolean;
  onSave: (input: FreeZoneAssignmentInput) => void;
}

/** Trim an ISO datetime down to the yyyy-MM-dd a native date input expects. */
function toDateInputValue(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function IsicCodeChip({
  code,
  isSaving,
  removeLabel,
  onRemove,
}: {
  code: string;
  isSaving: boolean;
  removeLabel: string;
  onRemove: (code: string) => void;
}) {
  const handleRemove = useCallback(() => onRemove(code), [onRemove, code]);
  return (
    <li>
      <Badge variant="secondary" className="gap-1 tabular-nums">
        {code}
        <button
          type="button"
          onClick={handleRemove}
          disabled={isSaving}
          className="-me-1 inline-flex size-4 items-center justify-center rounded-full hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          aria-label={removeLabel}>
          <X aria-hidden="true" className="size-3" />
        </button>
      </Badge>
    </li>
  );
}

export function FreeZoneAssignmentForm({ initial, isSaving, onSave }: FreeZoneAssignmentFormProps) {
  const t = useTranslations('Contractors.freeZone.form');
  const tZones = useTranslations('Contractors.freeZone.zones');
  const id = useId();

  const [zone, setZone] = useState<ZoneCode | null>(initial.zone);
  const [licenseNumber, setLicenseNumber] = useState(initial.licenseNumber ?? '');
  const [licenseCategory, setLicenseCategory] = useState(initial.licenseCategory ?? '');
  const [licenseExpiresAt, setLicenseExpiresAt] = useState(
    toDateInputValue(initial.licenseExpiresAt),
  );
  const [permittedActivitiesText, setPermittedActivitiesText] = useState(
    initial.permittedActivitiesText ?? '',
  );
  const [isicCodes, setIsicCodes] = useState<string[]>(initial.permittedActivityIsicCodes);
  const [isicDraft, setIsicDraft] = useState('');

  const zoneItems = useMemo(
    () => ZONE_CODES.map(code => ({ code, label: tZones(code) })),
    [tZones],
  );

  const addIsicCode = useCallback(() => {
    const next = isicDraft.trim();
    if (!next) return;
    setIsicCodes(prev => (prev.includes(next) ? prev : [...prev, next]));
    setIsicDraft('');
  }, [isicDraft]);

  const handleIsicKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addIsicCode();
      }
    },
    [addIsicCode],
  );

  const removeIsicCode = useCallback((code: string) => {
    setIsicCodes(prev => prev.filter(c => c !== code));
  }, []);

  const handleZoneChange = useCallback((value: ZoneCode | null) => setZone(value), []);
  const handleLicenseNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setLicenseNumber(e.target.value),
    [],
  );
  const handleLicenseCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setLicenseCategory(e.target.value),
    [],
  );
  const handleLicenseExpiresAtChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setLicenseExpiresAt(e.target.value),
    [],
  );
  const handlePermittedActivitiesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setPermittedActivitiesText(e.target.value),
    [],
  );
  const handleIsicDraftChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setIsicDraft(e.target.value),
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!zone) return;
      onSave({
        zone,
        licenseNumber: licenseNumber.trim() || null,
        licenseCategory: licenseCategory.trim() || null,
        licenseExpiresAt: licenseExpiresAt || null,
        permittedActivitiesText: permittedActivitiesText.trim() || null,
        permittedActivityIsicCodes: isicCodes,
      });
    },
    [
      zone,
      licenseNumber,
      licenseCategory,
      licenseExpiresAt,
      permittedActivitiesText,
      isicCodes,
      onSave,
    ],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Focal point — the zone Select is the first interactive element (UI-SPEC). */}
          <div className="space-y-2">
            <Label htmlFor={`${id}-zone`} className="text-base font-semibold">
              {t('zoneLabel')}
            </Label>
            <Select value={zone ?? undefined} onValueChange={handleZoneChange} disabled={isSaving}>
              <SelectTrigger id={`${id}-zone`} className="w-full">
                <SelectValue placeholder={t('zonePlaceholder')} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {zoneItems.map(item => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${id}-licenseNumber`} className="text-sm font-medium">
                {t('licenseNumberLabel')}
              </Label>
              <Input
                id={`${id}-licenseNumber`}
                value={licenseNumber}
                onChange={handleLicenseNumberChange}
                placeholder={t('licenseNumberPlaceholder')}
                disabled={isSaving}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-licenseCategory`} className="text-sm font-medium">
                {t('licenseCategoryLabel')}
              </Label>
              <Input
                id={`${id}-licenseCategory`}
                value={licenseCategory}
                onChange={handleLicenseCategoryChange}
                placeholder={t('licenseCategoryPlaceholder')}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-licenseExpiresAt`} className="text-sm font-medium">
              {t('licenseExpiresAtLabel')}
            </Label>
            <Input
              id={`${id}-licenseExpiresAt`}
              type="date"
              value={licenseExpiresAt}
              onChange={handleLicenseExpiresAtChange}
              disabled={isSaving}
              className="w-full tabular-nums sm:w-60"
            />
            <p className="text-xs text-muted-foreground">{t('licenseExpiresAtHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-permittedActivitiesText`} className="text-sm font-medium">
              {t('permittedActivitiesLabel')}
            </Label>
            <Textarea
              id={`${id}-permittedActivitiesText`}
              value={permittedActivitiesText}
              onChange={handlePermittedActivitiesChange}
              placeholder={t('permittedActivitiesPlaceholder')}
              disabled={isSaving}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${id}-isicDraft`} className="text-sm font-medium">
              {t('isicCodesLabel')}
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`${id}-isicDraft`}
                value={isicDraft}
                onChange={handleIsicDraftChange}
                onKeyDown={handleIsicKeyDown}
                placeholder={t('isicCodesPlaceholder')}
                disabled={isSaving}
                className="w-full tabular-nums sm:w-60"
                aria-describedby={`${id}-isicHelp`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addIsicCode}
                disabled={isSaving || !isicDraft.trim()}>
                {t('isicAddButton')}
              </Button>
            </div>
            <p id={`${id}-isicHelp`} className="text-xs text-muted-foreground">
              {t('isicCodesHelp')}
            </p>
            {isicCodes.length > 0 ? (
              <ul className="flex flex-wrap gap-2 pt-1" aria-label={t('isicCodesLabel')}>
                {isicCodes.map(code => (
                  <IsicCodeChip
                    key={code}
                    code={code}
                    isSaving={isSaving}
                    removeLabel={t('isicRemoveLabel', { code })}
                    onRemove={removeIsicCode}
                  />
                ))}
              </ul>
            ) : null}
          </div>

          {/* The single accent CTA per surface (UI-SPEC reserved-accent rule). */}
          <Button type="submit" disabled={isSaving || !zone} className="w-full sm:w-auto">
            {isSaving ? (
              <Loader2 aria-hidden="true" className="me-2 size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="me-2 size-4" />
            )}
            {t('saveButton')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
