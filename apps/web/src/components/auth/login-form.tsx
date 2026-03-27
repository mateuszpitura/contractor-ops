"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SocialButtons } from "@/components/auth/social-buttons";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

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
  const redirectTo = searchParams.get("redirectTo") ?? "/";
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
    if (!email || !z.string().email().safeParse(email).success) {
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
              <span className="font-medium text-foreground">
                {getValues("email")}
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            className="mt-6"
            onClick={() => setIsMagicLinkSent(false)}
          >
            {t("magicLinkBack")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <h1 className="font-display text-[28px] font-semibold leading-[1.2] tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
  );
}
