"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Truck } from "lucide-react";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleComponent,
} from "@/components/ui/dialog";
import { CarrierCredentialForm } from "./carrier-credential-form";

// ---------------------------------------------------------------------------
// DpdProviderSection
// ---------------------------------------------------------------------------

export function DpdProviderSection() {
  const t = useTranslations("Equipment.carrier");
  const tCarriers = useTranslations("Settings.carriers");
  const [configOpen, setConfigOpen] = useState(false);

  const configsQuery = useQuery(trpc.equipment.getCourierConfigs.queryOptions());
  const configs = (configsQuery.data ?? []) as unknown as Array<{ carrier: string }>;
  const isConfigured = configs.some(
    (c) => c.carrier.toLowerCase() === "dpd",
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Truck className="size-8 text-red-600" />
          <div className="flex-1">
            <CardTitle className="text-base">DPD</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("dpdDescription")}
            </p>
          </div>
          <Badge variant={isConfigured ? "default" : "secondary"}>
            {isConfigured ? tCarriers("connected") : tCarriers("notConfigured")}
          </Badge>
        </CardHeader>
      </Card>

      <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
        {t("configureDpd")}
      </Button>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitleComponent>
              {t("configureDpd")}
            </DialogTitleComponent>
          </DialogHeader>
          <CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
