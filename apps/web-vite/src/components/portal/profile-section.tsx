import { PhoneNumberInput } from '@contractor-ops/ui/components/origin/phone-number-input';
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card } from '@contractor-ops/ui/components/shadcn/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Info, Loader2, Lock, Pencil, Save } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useTranslations } from '../../i18n/useTranslations.js';
import { PendingChangeBanner } from './pending-change-banner.js';

export interface ProfileField {
  key: string;
  label: string;
  value: string | null;
  readOnly?: boolean;
  readOnlyCaption?: string;
}

interface ProfileSectionProps {
  title: string;
  fields: ProfileField[];
  requiresApproval?: boolean;
  onSave: (values: Record<string, string | null>) => Promise<void>;
  pendingChangeRequest?: {
    id: string;
    requestedChanges: Record<string, unknown>;
    createdAt: Date;
  } | null;
  defaultOpen?: boolean;
}

interface PhoneFieldProps {
  fieldKey: string;
  label: string;
  form: UseFormReturn<FieldValues>;
}

function PhoneField({ fieldKey, label, form }: PhoneFieldProps) {
  const handleValueChange = useCallback(
    (value: string) => form.setValue(fieldKey, value, { shouldDirty: true }),
    [form, fieldKey],
  );
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldKey} className="text-sm">
        {label}
      </Label>
      <PhoneNumberInput
        id={fieldKey}
        value={String(form.watch(fieldKey) ?? '')}
        onValueChange={handleValueChange}
        aria-label={label}
      />
    </div>
  );
}

export function ProfileSection({
  title,
  fields,
  requiresApproval = false,
  onSave,
  pendingChangeRequest,
  defaultOpen = true,
}: ProfileSectionProps) {
  const t = useTranslations('Portal.settings');
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const editableFields = useMemo(() => fields.filter(f => !f.readOnly), [fields]);

  const schema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const field of editableFields) {
      shape[field.key] = z.string().optional().nullable();
    }
    return z.object(shape);
  }, [editableFields]);

  type FormValues = z.infer<typeof schema>;

  const defaultValues = useMemo(() => {
    const values: Record<string, string | null> = {};
    for (const field of editableFields) {
      values[field.key] = field.value ?? '';
    }
    return values;
  }, [editableFields]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handleSave = async (values: FormValues) => {
    setSaving(true);
    try {
      await onSave(values as Record<string, string | null>);
      setEditing(false);
    } catch {
      toast.error(t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = useCallback(() => {
    form.reset(defaultValues);
    setEditing(false);
  }, [form, defaultValues]);

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditing(true);
      if (!isOpen) {
        setIsOpen(true);
      }
    },
    [isOpen],
  );

  const renderTrigger = useCallback(
    (props: ComponentPropsWithoutRef<'button'>) => (
      <button
        {...props}
        type="button"
        className="flex flex-1 items-center gap-3 text-start outline-none">
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
        <span className="text-sm font-semibold">{title}</span>
        {!!requiresApproval && <Badge variant="info">{t('requiresApproval')}</Badge>}
      </button>
    ),
    [isOpen, title, requiresApproval, t],
  );

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex min-h-[48px] items-center gap-3 px-4 py-3">
          <CollapsibleTrigger render={renderTrigger} />
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 text-muted-foreground"
              onClick={handleEditClick}>
              <Pencil className="h-3.5 w-3.5" />
              {t('editSection')}
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <div className="border-t px-4 pb-4 pt-3">
            {!!pendingChangeRequest && (
              <div className="mb-4">
                <PendingChangeBanner pendingChangeRequest={pendingChangeRequest} />
              </div>
            )}

            {editing ? (
              <form onSubmit={form.handleSubmit(handleSave)}>
                <div className="space-y-4">
                  {fields.map(field => {
                    if (field.readOnly) {
                      return (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-sm text-muted-foreground">{field.label}</Label>
                          <div className="flex items-center gap-2 text-sm">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{field.value || t('fallbackValue')}</span>
                          </div>
                          {!!field.readOnlyCaption && (
                            <p className="text-xs text-muted-foreground">{field.readOnlyCaption}</p>
                          )}
                        </div>
                      );
                    }

                    if (field.key === 'phone') {
                      return (
                        <PhoneField
                          key={field.key}
                          fieldKey={field.key}
                          label={field.label}
                          form={form as UseFormReturn<FieldValues>}
                        />
                      );
                    }

                    return (
                      <div key={field.key} className="space-y-1.5">
                        <Label htmlFor={field.key} className="text-sm">
                          {field.label}
                        </Label>
                        <Input
                          id={field.key}
                          {...form.register(field.key)}
                          placeholder={field.label}
                        />
                      </div>
                    );
                  })}

                  {!!requiresApproval && (
                    <div className="flex items-start gap-2 rounded-md bg-blue-500/10 p-3">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        {t('financialApprovalNote')}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {saving ? t('saving') : t('saveChanges')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDiscard}
                      disabled={saving}>
                      {t('discardChanges')}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <dl className="space-y-4">
                {fields.map(field => (
                  <div key={field.key} className="space-y-1">
                    <dt className="text-sm text-muted-foreground">{field.label}</dt>
                    <dd className="flex items-center gap-2 text-sm">
                      {!!field.readOnly && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span>{field.value || t('fallbackValue')}</span>
                    </dd>
                    {!!field.readOnly && !!field.readOnlyCaption && (
                      <dd className="text-xs text-muted-foreground">{field.readOnlyCaption}</dd>
                    )}
                  </div>
                ))}
              </dl>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
