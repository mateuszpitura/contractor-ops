"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CarrierCredentialFormProps {
  carrier: "dpd" | "ups";
  carrierLabel: string;
}

interface DpdCredentials {
  username: string;
  password: string;
  fid: string;
  sandbox: boolean;
}

interface UpsCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  sandbox: boolean;
}

// ---------------------------------------------------------------------------
// Password field with show/hide toggle
// ---------------------------------------------------------------------------

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide" : "Show"}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Carrier credential setup card for DPD or UPS.
 * Renders carrier-specific credential fields with test/save actions.
 * Uses saveCourierConfig and getCourierConfigs from the equipment router.
 */
export function CarrierCredentialForm({
  carrier,
  carrierLabel,
}: CarrierCredentialFormProps) {
  const t = useTranslations("Settings.carriers");
  const queryClient = useQueryClient();

  // Check if this carrier is already configured
  const configsQuery = useQuery(trpc.equipment.getCourierConfigs.queryOptions());
  const configs = (configsQuery.data ?? []) as unknown as Array<{ carrier: string }>;
  const isConnected = configs.some(
    (c) => c.carrier.toLowerCase() === carrier,
  );

  // DPD credentials state
  const [dpdCreds, setDpdCreds] = useState<DpdCredentials>({
    username: "",
    password: "",
    fid: "",
    sandbox: false,
  });

  // UPS credentials state
  const [upsCreds, setUpsCreds] = useState<UpsCredentials>({
    clientId: "",
    clientSecret: "",
    accountNumber: "",
    sandbox: false,
  });

  // Save mutation
  const saveMutation = useMutation(
    trpc.equipment.saveCourierConfig.mutationOptions({
      onSuccess: () => {
        toast.success(t("credentialsSaved"));
        queryClient.invalidateQueries({
          queryKey: trpc.equipment.getCourierConfigs.queryKey(),
        });
      },
      onError: () => {
        toast.error(t("saveFailed"));
      },
    }),
  );

  // Test connection mutation
  const testMutation = useMutation(
    trpc.equipment.testCourierConnection.mutationOptions({
      onSuccess: () => {
        toast.success(t("connectionVerified"));
      },
      onError: () => {
        toast.error(t("connectionFailed"));
      },
    }),
  );

  const handleSave = useCallback(() => {
    const credentials =
      carrier === "dpd"
        ? { carrier: "dpd" as const, ...dpdCreds }
        : { carrier: "ups" as const, ...upsCreds };
    saveMutation.mutate(credentials);
  }, [carrier, dpdCreds, upsCreds, saveMutation]);

  const handleTest = useCallback(() => {
    const credentials =
      carrier === "dpd"
        ? { carrier: "dpd" as const, ...dpdCreds }
        : { carrier: "ups" as const, ...upsCreds };
    testMutation.mutate(credentials);
  }, [carrier, dpdCreds, upsCreds, testMutation]);

  const isPending = saveMutation.isPending || testMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Truck className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <CardTitle>{carrierLabel}</CardTitle>
          </div>
          <Badge variant={isConnected ? "success" : "secondary"}>
            {isConnected ? t("connected") : t("notConfigured")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {carrier === "dpd" ? (
          <>
            <PasswordField
              label={t("username")}
              value={dpdCreds.username}
              onChange={(v) =>
                setDpdCreds((prev) => ({ ...prev, username: v }))
              }
            />
            <PasswordField
              label={t("password")}
              value={dpdCreds.password}
              onChange={(v) =>
                setDpdCreds((prev) => ({ ...prev, password: v }))
              }
            />
            <PasswordField
              label={t("fid")}
              value={dpdCreds.fid}
              onChange={(v) =>
                setDpdCreds((prev) => ({ ...prev, fid: v }))
              }
            />
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={dpdCreds.sandbox}
                onCheckedChange={(checked) =>
                  setDpdCreds((prev) => ({
                    ...prev,
                    sandbox: checked === true,
                  }))
                }
              />
              <span className="text-sm">{t("sandbox")}</span>
            </label>
          </>
        ) : (
          <>
            <PasswordField
              label={t("clientId")}
              value={upsCreds.clientId}
              onChange={(v) =>
                setUpsCreds((prev) => ({ ...prev, clientId: v }))
              }
            />
            <PasswordField
              label={t("clientSecret")}
              value={upsCreds.clientSecret}
              onChange={(v) =>
                setUpsCreds((prev) => ({ ...prev, clientSecret: v }))
              }
            />
            <PasswordField
              label={t("accountNumber")}
              value={upsCreds.accountNumber}
              onChange={(v) =>
                setUpsCreds((prev) => ({ ...prev, accountNumber: v }))
              }
            />
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={upsCreds.sandbox}
                onCheckedChange={(checked) =>
                  setUpsCreds((prev) => ({
                    ...prev,
                    sandbox: checked === true,
                  }))
                }
              />
              <span className="text-sm">{t("sandbox")}</span>
            </label>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isPending}
          >
            {testMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("testConnection")}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("saveCredentials")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
