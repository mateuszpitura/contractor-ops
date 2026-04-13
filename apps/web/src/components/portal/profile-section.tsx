'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Info, Lock, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PendingChangeBanner } from './pending-change-banner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reusable collapsible section with view/edit toggle for profile fields.
 * Used for both Personal Information and Financial Details sections.
 *
 * Per D-14 and UI-SPEC:
 * - View mode: label + value pairs
 * - Edit mode: inline form with Save Changes / Discard Changes
 * - Financial section shows "Requires Approval" badge and info banner
 */
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

  // Build Zod schema dynamically from editable fields
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

  const handleDiscard = () => {
    form.reset(defaultValues);
    setEditing(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Trigger row */}
        <div className="flex min-h-[48px] items-center gap-3 px-4 py-3">
          <CollapsibleTrigger
            // biome-ignore lint/nursery/noJsxPropsBind: render-prop pattern for headless UI
            render={props => (
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
            )}
          />
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 text-muted-foreground"
              // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
              onClick={handleEditClick}>
              <Pencil className="h-3.5 w-3.5" />
              {t('editSection')}
            </Button>
          )}
        </div>

        {/* Content */}
        <CollapsibleContent>
          <div className="border-t px-4 pb-4 pt-3">
            {/* Pending change banner for financial section */}
            {!!pendingChangeRequest && (
              <div className="mb-4">
                <PendingChangeBanner pendingChangeRequest={pendingChangeRequest} />
              </div>
            )}

            {editing ? (
              /* Edit mode */
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

                  {/* Financial section info banner */}
                  {!!requiresApproval && (
                    <div className="flex items-start gap-2 rounded-md bg-blue-500/10 p-3">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400" />
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        {t('financialApprovalNote')}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? t('saving') : t('saveChanges')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
                      onClick={handleDiscard}
                      disabled={saving}>
                      {t('discardChanges')}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              /* View mode */
              <div className="space-y-4">
                {fields.map(field => (
                  <div key={field.key} className="space-y-1">
                    <dt className="text-sm text-muted-foreground">{field.label}</dt>
                    <dd className="flex items-center gap-2 text-sm">
                      {!!field.readOnly && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span>{field.value || t('fallbackValue')}</span>
                    </dd>
                    {!!field.readOnly && !!field.readOnlyCaption && (
                      <p className="text-xs text-muted-foreground">{field.readOnlyCaption}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
