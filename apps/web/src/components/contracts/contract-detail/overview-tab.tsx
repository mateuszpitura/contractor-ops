"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Pencil, Check, X } from "lucide-react";

import { trpc } from "@/trpc/init";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OverviewTabProps = {
  contract: {
    id: string;
    title: string | null;
    type: string;
    status: string;
    startDate: string | Date | null;
    endDate: string | Date | null;
    noticePeriodDays: number | null;
    autoRenewal: boolean;
    renewalTerms: string | null;
    currency: string;
    billingModel: string | null;
    rateType: string | null;
    rateValueGrosze: number | null;
    retainerAmountGrosze: number | null;
    paymentTermsDays: number | null;
    invoiceCycle: string | null;
    notes: string | null;
    metadataJson: unknown;
    contractor: {
      id: string;
      legalName: string;
      displayName: string;
      status: string;
    } | null;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(grosze: number, currency: string): string {
  return `${(grosze / 100).toFixed(2)} ${currency}`;
}

function getDaysRemaining(endDate: string | Date): number {
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? "font-mono text-[13px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expiry Reminders Editor
// ---------------------------------------------------------------------------

function ExpiryRemindersEditor({
  contractId,
  currentReminders,
}: {
  contractId: string;
  currentReminders: number[];
}) {
  const t = useTranslations("ContractDetail.overview");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [reminders, setReminders] = useState(currentReminders.join(", "));

  const mutation = useMutation(
    trpc.contract.updateExpiryReminders.mutationOptions({
      onSuccess: () => {
        toast.success(t("reminders.saved"));
        queryClient.invalidateQueries({
          queryKey: trpc.contract.getById.queryKey(),
        });
        setEditing(false);
      },
      onError: () => {
        toast.error(t("reminders.error"));
      },
    })
  );

  function handleSave() {
    const parsed = reminders
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    if (parsed.length === 0) return;

    mutation.mutate({
      contractId,
      reminderDaysBefore: parsed,
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {currentReminders.length > 0
            ? t("reminders.display", {
                days: currentReminders.join(", "),
              })
            : t("reminders.none")}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3" />
          <span className="sr-only">{t("reminders.edit")}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={reminders}
        onChange={(e) => setReminders(e.target.value)}
        className="h-7 w-40 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="30, 60, 90"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleSave}
        disabled={mutation.isPending}
      >
        <Check className="size-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          setEditing(false);
          setReminders(currentReminders.join(", "));
        }}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverviewTab({ contract }: OverviewTabProps) {
  const t = useTranslations("ContractDetail.overview");

  const metadata =
    (contract.metadataJson as Record<string, unknown>) ?? {};
  const reminderDaysBefore = (metadata.reminderDaysBefore as number[]) ?? [];

  const daysRemaining = contract.endDate
    ? getDaysRemaining(contract.endDate)
    : null;

  const daysColor =
    daysRemaining === null
      ? ""
      : daysRemaining > 60
        ? "text-green-600 dark:text-green-400"
        : daysRemaining > 30
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-500 dark:text-red-400";

  const noticeDays = contract.noticePeriodDays;
  const noticeDeadline =
    contract.endDate && noticeDays
      ? new Date(
          (typeof contract.endDate === "string"
            ? new Date(contract.endDate)
            : contract.endDate
          ).getTime() -
            noticeDays * 24 * 60 * 60 * 1000
        )
      : null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {/* Contract details card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("contractDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FieldRow label={t("fields.type")} value={contract.type} />
          <FieldRow
            label={t("fields.autoRenewal")}
            value={contract.autoRenewal ? t("fields.yes") : t("fields.no")}
          />
          {contract.noticePeriodDays != null && (
            <FieldRow
              label={t("fields.noticePeriod")}
              value={t("fields.noticePeriodDays", {
                days: contract.noticePeriodDays,
              })}
            />
          )}
          {contract.renewalTerms && (
            <FieldRow
              label={t("fields.renewalTerms")}
              value={contract.renewalTerms}
            />
          )}
          <FieldRow label={t("fields.notes")} value={contract.notes} />
        </CardContent>
      </Card>

      {/* Financial terms card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("financialTerms")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {contract.rateValueGrosze != null && (
            <FieldRow
              label={t("fields.rate")}
              value={formatCurrency(
                contract.rateValueGrosze,
                contract.currency
              )}
              mono
            />
          )}
          <FieldRow label={t("fields.currency")} value={contract.currency} />
          <FieldRow
            label={t("fields.billingModel")}
            value={contract.billingModel}
          />
          <FieldRow label={t("fields.rateType")} value={contract.rateType} />
          {contract.paymentTermsDays != null && (
            <FieldRow
              label={t("fields.paymentTerms")}
              value={t("fields.paymentTermsDays", {
                days: contract.paymentTermsDays,
              })}
            />
          )}
          <FieldRow
            label={t("fields.invoiceCycle")}
            value={contract.invoiceCycle}
          />
          {contract.retainerAmountGrosze != null && (
            <FieldRow
              label={t("fields.retainerAmount")}
              value={formatCurrency(
                contract.retainerAmountGrosze,
                contract.currency
              )}
              mono
            />
          )}
        </CardContent>
      </Card>

      {/* Key dates card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("keyDates")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {contract.startDate && (
            <FieldRow
              label={t("fields.startDate")}
              value={formatDate(contract.startDate)}
            />
          )}
          {contract.endDate && (
            <FieldRow
              label={t("fields.endDate")}
              value={formatDate(contract.endDate)}
            />
          )}
          {noticeDeadline && (
            <FieldRow
              label={t("fields.noticeDeadline")}
              value={formatDate(noticeDeadline)}
            />
          )}
          {daysRemaining !== null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                {t("fields.daysRemaining")}
              </span>
              <span className={`text-sm font-medium ${daysColor}`}>
                {daysRemaining > 0
                  ? t("expiresIn", { count: daysRemaining })
                  : t("expiredAgo", { count: Math.abs(daysRemaining) })}
              </span>
            </div>
          )}
          {/* Expiry reminders */}
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {t("reminders.label")}
            </span>
            <ExpiryRemindersEditor
              contractId={contract.id}
              currentReminders={reminderDaysBefore}
            />
          </div>
        </CardContent>
      </Card>

      {/* Linked contractor card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("linkedContractor")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {contract.contractor ? (
            <>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  {t("fields.contractorName")}
                </span>
                <Link
                  href={`/contractors/${contract.contractor.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {contract.contractor.displayName}
                </Link>
              </div>
              <FieldRow
                label={t("fields.legalName")}
                value={contract.contractor.legalName}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  {t("fields.contractorStatus")}
                </span>
                <Badge variant="secondary" className="w-fit">
                  {contract.contractor.status}
                </Badge>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("noContractor")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
