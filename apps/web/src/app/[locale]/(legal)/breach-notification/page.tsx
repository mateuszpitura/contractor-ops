import type { Metadata } from "next";
import { useTranslations } from "next-intl";

export const metadata: Metadata = {
  title: "Breach Notification Procedure — Contractor Ops",
};

export default function BreachNotificationPage() {
  const t = useTranslations("Legal.breachNotification");

  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>{t("title")}</h1>
      <p className="text-muted-foreground">{t("lastUpdated")}</p>

      <h2>{t("sections.introduction.heading")}</h2>
      <p>{t("sections.introduction.body")}</p>

      <h2>{t("sections.definition.heading")}</h2>
      <p>{t("sections.definition.body")}</p>

      <h2>{t("sections.detection.heading")}</h2>
      <p>{t("sections.detection.body")}</p>

      <h2>{t("sections.assessment.heading")}</h2>
      <p>{t("sections.assessment.body")}</p>

      <h2>{t("sections.authorityNotification.heading")}</h2>
      <p>{t("sections.authorityNotification.body")}</p>

      <h2>{t("sections.customerNotification.heading")}</h2>
      <p>{t("sections.customerNotification.body")}</p>

      <h2>{t("sections.timeline.heading")}</h2>
      <p>{t("sections.timeline.body")}</p>

      <h2>{t("sections.documentation.heading")}</h2>
      <p>{t("sections.documentation.body")}</p>

      <h2>{t("sections.contact.heading")}</h2>
      <p>{t("sections.contact.body")}</p>
    </article>
  );
}
