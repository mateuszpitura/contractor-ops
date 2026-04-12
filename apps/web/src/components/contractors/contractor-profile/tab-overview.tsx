"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { ComplianceHealthBadge } from "@/components/contractors/compliance-health-badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { canViewSensitivePii, maskTaxId } from "@/lib/mask-pii";

type HealthFactor = {
  key: "documents" | "contract" | "tasks" | "invoices";
  status: "green" | "yellow" | "red";
  label: string;
  detail?: string;
};

type ComplianceHealth = {
  overall: "green" | "yellow" | "red";
  factors: HealthFactor[];
};

type BillingProfile = {
  id: string;
  legalEntityName: string;
  preferredCurrency: string;
  bankAccountMasked: string | null;
  paymentTermsDays: number | null;
  isDefault: boolean;
};

type Contract = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  billingModel: string | null;
};

type TabOverviewProps = {
  contractor: {
    id: string;
    legalName: string;
    displayName: string;
    type: string;
    taxId: string | null;
    vatId: string | null;
    registrationNumber: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postalCode: string | null;
    countryCode: string;
    currency: string;
    customFieldsJson: unknown;
    billingProfiles: BillingProfile[];
    contracts: Contract[];
    complianceHealth: ComplianceHealth;
    createdAt: string | Date;
    updatedAt: string | Date;
  };
};

const healthFactorTabMap: Record<string, string> = {
  documents: "compliance",
  contract: "contracts",
  tasks: "workflows",
  invoices: "invoices",
};

const healthStatusIcons = {
  green: CheckCircle2,
  yellow: AlertTriangle,
  red: XCircle,
} as const;

const healthStatusColors = {
  green: "text-green-600 dark:text-green-400",
  yellow: "text-amber-600 dark:text-amber-400",
  red: "text-red-500 dark:text-red-400",
} as const;

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
      <span className={`text-sm ${mono ? "font-mono text-[13px]" : ""}`}>{value}</span>
    </div>
  );
}

function formatDate(date: string | Date, locale?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale ?? "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TabOverview({ contractor }: TabOverviewProps) {
  const t = useTranslations("ContractorProfile.overview");
  const tc = useTranslations("Contractors");
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const switchTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const customFields = (contractor.customFieldsJson as Record<string, unknown>) ?? {};
  const billingModel = customFields.billingModel as string | undefined;
  const rateValueMinor = customFields.rateValueMinor as number | undefined;

  const defaultBilling = contractor.billingProfiles.find((bp) => bp.isDefault);
  const activeContract = contractor.contracts.find((c) => c.status === "ACTIVE");

  const formattedRate =
    rateValueMinor != null ? `${(rateValueMinor / 100).toFixed(2)} ${contractor.currency}` : null;

  const formattedAddress = [
    contractor.addressLine1,
    contractor.addressLine2,
    [contractor.postalCode, contractor.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Company details card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("companyDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FieldRow label={t("fields.legalName")} value={contractor.legalName} />
          <FieldRow label={t("fields.displayName")} value={contractor.displayName} />
          <FieldRow
            label={t("fields.type")}
            value={tc(`type.${contractor.type}` as Parameters<typeof tc>[0])}
          />
          <FieldRow
            label={t("fields.nip")}
            value={showPii ? contractor.taxId : maskTaxId(contractor.taxId)}
            mono
          />
          <FieldRow label={t("fields.vatEu")} value={contractor.vatId} mono />
          <FieldRow label={t("fields.regon")} value={contractor.registrationNumber} mono />
          {contractor.email && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{t("fields.email")}</span>
              <a
                href={`mailto:${contractor.email}`}
                className="text-sm text-primary hover:underline"
              >
                {contractor.email}
              </a>
            </div>
          )}
          <FieldRow label={t("fields.phone")} value={contractor.phone} />
          <FieldRow label={t("fields.address")} value={formattedAddress} />
          <FieldRow label={t("fields.country")} value={contractor.countryCode} />
        </CardContent>
      </Card>

      {/* Billing information card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("billingInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <FieldRow label={t("fields.billingModel")} value={billingModel} />
          <FieldRow label={t("fields.rate")} value={formattedRate} mono />
          <FieldRow label={t("fields.currency")} value={contractor.currency} />
          <FieldRow
            label={t("fields.bankAccount")}
            value={defaultBilling?.bankAccountMasked}
            mono
          />
          {defaultBilling?.paymentTermsDays != null && (
            <FieldRow
              label={t("fields.paymentTerms")}
              value={t("fields.paymentTermsDays", {
                days: defaultBilling.paymentTermsDays,
              })}
            />
          )}
        </CardContent>
      </Card>

      {/* Active contract card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("activeContract")}</CardTitle>
        </CardHeader>
        <CardContent>
          {activeContract ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {activeContract.title ?? activeContract.type}
                </span>
                <span className="rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-600">
                  {activeContract.status}
                </span>
              </div>
              {activeContract.startDate && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(activeContract.startDate)}
                  {activeContract.endDate ? ` - ${formatDate(activeContract.endDate)}` : ""}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noActiveContract")}</p>
          )}
        </CardContent>
      </Card>

      {/* Compliance health card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("healthCard")}</CardTitle>
          <CardAction>
            <ComplianceHealthBadge health={contractor.complianceHealth.overall} />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-2">
          {contractor.complianceHealth.factors.map((factor) => {
            const Icon = healthStatusIcons[factor.status];
            const colorClass = healthStatusColors[factor.status];
            const targetTab = healthFactorTabMap[factor.key];

            return (
              <button
                key={factor.key}
                type="button"
                onClick={() => targetTab && switchTab(targetTab)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-muted"
              >
                <Icon className={`size-4 shrink-0 ${colorClass}`} />
                <span className="text-sm">
                  {t(
                    `healthChecks.${factor.key}` as
                      | "healthChecks.documents"
                      | "healthChecks.contract"
                      | "healthChecks.tasks"
                      | "healthChecks.invoices",
                  )}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Key dates card */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t("keyDates")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldRow label={t("createdAt")} value={formatDate(contractor.createdAt)} />
          <FieldRow label={t("updatedAt")} value={formatDate(contractor.updatedAt)} />
          <FieldRow
            label={t("contractEndDate")}
            value={activeContract?.endDate ? formatDate(activeContract.endDate) : "\u2014"}
          />
          <FieldRow label={t("nextInvoice")} value={"\u2014"} />
        </CardContent>
      </Card>
    </div>
  );
}
