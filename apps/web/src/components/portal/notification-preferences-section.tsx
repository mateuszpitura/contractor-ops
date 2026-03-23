"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Receipt,
  Banknote,
  FileText,
  FolderOpen,
  Shield,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { trpc } from "@/trpc/init";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

type NotificationCategory =
  | "INVOICE_UPDATES"
  | "PAYMENT_CONFIRMATIONS"
  | "CONTRACT_CHANGES"
  | "DOCUMENT_UPLOADS"
  | "SECURITY_ALERTS";

interface CategoryConfig {
  category: NotificationCategory;
  icon: LucideIcon;
  label: string;
  description: string;
  locked?: boolean;
}

const CATEGORIES: CategoryConfig[] = [
  {
    category: "INVOICE_UPDATES",
    icon: Receipt,
    label: "Invoice Updates",
    description: "Get notified when your invoice status changes",
  },
  {
    category: "PAYMENT_CONFIRMATIONS",
    icon: Banknote,
    label: "Payment Confirmations",
    description: "Get notified when a payment is processed",
  },
  {
    category: "CONTRACT_CHANGES",
    icon: FileText,
    label: "Contract Changes",
    description: "Get notified about contract renewals or amendments",
  },
  {
    category: "DOCUMENT_UPLOADS",
    icon: FolderOpen,
    label: "Document Uploads",
    description: "Get notified when new documents are shared",
  },
  {
    category: "SECURITY_ALERTS",
    icon: Shield,
    label: "Security Alerts",
    description: "Get notified about sign-in activity",
    locked: true,
  },
];

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PreferencesSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[48px] items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="h-[18px] w-[32px] rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Notification preferences section with 5 toggle rows.
 * Each toggle saves immediately with optimistic updates.
 * Security alerts toggle is always on and disabled.
 *
 * Per D-06, D-07, and UI-SPEC.
 */
export function NotificationPreferencesSection() {
  const [isOpen, setIsOpen] = useState(true);
  const queryClient = useQueryClient();

  const prefsQuery = useQuery(
    trpc.portal.getNotificationPreferences.queryOptions(),
  );

  type PreferenceItem = { category: NotificationCategory; emailEnabled: boolean };

  const queryKey =
    trpc.portal.getNotificationPreferences.queryOptions().queryKey;

  const updatePrefBase = trpc.portal.updateNotificationPreference.mutationOptions();

  const updatePref = useMutation({
    mutationFn: updatePrefBase.mutationFn,
    onMutate: async (newPref: { category: NotificationCategory; emailEnabled: boolean }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousPrefs = queryClient.getQueryData<PreferenceItem[]>(queryKey);

      queryClient.setQueryData<PreferenceItem[]>(
        queryKey,
        (old) =>
          old?.map((p) =>
            p.category === newPref.category
              ? { ...p, emailEnabled: newPref.emailEnabled }
              : p,
          ) ?? [],
      );

      return { previousPrefs };
    },
    onError: (
      _err: unknown,
      _newPref: { category: NotificationCategory; emailEnabled: boolean },
      context: { previousPrefs: PreferenceItem[] | undefined } | undefined,
    ) => {
      if (context?.previousPrefs) {
        queryClient.setQueryData<PreferenceItem[]>(queryKey, context.previousPrefs);
      }
      toast.error("Failed to update preference. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const preferences = prefsQuery.data;

  const getChecked = (category: NotificationCategory): boolean => {
    const pref = preferences?.find((p) => p.category === category);
    return pref?.emailEnabled ?? true;
  };

  const handleToggle = (category: NotificationCategory, checked: boolean) => {
    updatePref.mutate({ category, emailEnabled: checked });
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Trigger row */}
        <CollapsibleTrigger
          render={(props) => (
            <button
              {...props}
              type="button"
              className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left outline-none"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
              <span className="text-sm font-semibold">
                Notification Preferences
              </span>
            </button>
          )}
        />

        {/* Content */}
        <CollapsibleContent>
          <div className="border-t">
            {prefsQuery.isPending ? (
              <PreferencesSkeleton />
            ) : (
              <div className="divide-y">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const checked = cat.locked ? true : getChecked(cat.category);

                  return (
                    <div
                      key={cat.category}
                      className="flex min-h-[48px] items-center justify-between gap-4 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{cat.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {cat.description}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Switch
                          checked={checked}
                          onCheckedChange={(val) =>
                            handleToggle(cat.category, val)
                          }
                          disabled={cat.locked}
                          aria-label={cat.label}
                        />
                        {cat.locked && (
                          <p className="mt-1 text-right text-xs text-muted-foreground">
                            Security alerts cannot be disabled
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
