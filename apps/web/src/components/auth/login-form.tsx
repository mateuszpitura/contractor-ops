"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Login form with email/password, magic link option, and social OAuth.
 */
export function LoginForm() {
  const t = useTranslations("Auth.login");
  const tv = useTranslations("Validation");
  const tc = useTranslations("Common");
  const tToast = useTranslations("Auth.toast");
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirectTo = searchParams.get("redirectTo") ?? "/";
  // Validate redirectTo is a safe relative path to prevent open redirect attacks
  const redirectTo =
    rawRedirectTo.startsWith("/") && !rawRedirectTo.startsWith("//") && !rawRedirectTo.includes(":")
      ? rawRedirectTo
      : "/";
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  const loginSchema = z.object({
    email: z.string().email(tv("invalidEmail")),
    password: z.string().min(1, tv("required")),
  });

  type LoginValues = z.infer<typeof loginSchema>;

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginValues) => {
    setIsLoading(true);
    try {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message ?? tToast("invalidCredentials"));
        setIsLoading(false);
        return;
      }

      router.push(redirectTo);
    } catch {
      toast.error(tc("networkError"));
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    const email = getValues("email");
    if (!(email && z.string().email().safeParse(email).success)) {
      toast.error(tv("invalidEmail"));
      return;
    }

    setMagicLinkLoading(true);
    try {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: redirectTo,
      });

      if (error) {
        toast.error(error.message ?? tToast("magicLinkFailed"));
        setMagicLinkLoading(false);
        return;
      }

      setIsMagicLinkSent(true);
    } catch {
      toast.error(tc("networkError"));
    } finally {
      setMagicLinkLoading(false);
    }
  };

  if (isMagicLinkSent) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="space-y-2">
            <h2 className="font-display text-[20px] font-semibold">{t("magicLinkSent")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("magicLinkSentBody")}{" "}
              <span className="font-medium text-foreground">{getValues("email")}</span>
            </p>
          </div>
          <Button variant="ghost" className="mt-6" onClick={() => setIsMagicLinkSent(false)}>
            {t("magicLinkBack")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="conic-border rounded-xl">
      <Card className="glass-medium border-0 ring-0 shadow-2xl hover:ring-0 hover:shadow-2xl">
        <CardHeader className="space-y-1.5 text-center">
          <h1 className="gradient-text font-display text-2xl font-bold leading-[1.2] tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px]">
                {t("emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                disabled={isLoading}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px]">
                  {t("passwordLabel")}
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={isLoading}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t("signingIn")}
                  </>
                ) : (
                  t("cta")
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={magicLinkLoading || isLoading}
                onClick={handleMagicLink}
              >
                {magicLinkLoading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    {t("magicLinkSending")}
                  </>
                ) : (
                  t("magicLinkCta")
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <SocialButtons />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {t("createOrgLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
