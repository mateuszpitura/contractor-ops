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

/**
 * Registration form with org name, email, password.
 * Creates account via authClient.signUp.email(), then creates organization,
 * and redirects to email verification.
 */
export function RegisterForm() {
  const t = useTranslations("Auth.register");
  const tv = useTranslations("Validation");
  const tc = useTranslations("Common");
  const tToast = useTranslations("Auth.toast");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const registerSchema = z.object({
    orgName: z.string().min(2, tv("orgNameTooShort")),
    email: z.string().email(tv("invalidEmail")),
    password: z.string().min(8, tv("passwordTooShort")),
  });

  type RegisterValues = z.infer<typeof registerSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      orgName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: RegisterValues) => {
    setIsLoading(true);
    try {
      // Step 1: Create user account
      const { error: signUpError } = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.email.split("@")[0],
      });

      if (signUpError) {
        toast.error(signUpError.message ?? tToast("createAccountFailed"));
        setIsLoading(false);
        return;
      }

      // Step 2: Create organization
      const { error: orgError } = await authClient.organization.create({
        name: values.orgName,
        slug: values.orgName.toLowerCase().replace(/\s+/g, "-"),
      });

      if (orgError) {
        toast.error(orgError.message ?? tToast("createOrgFailed"));
        setIsLoading(false);
        return;
      }

      router.push("/");
    } catch {
      toast.error(tc("networkError"));
      setIsLoading(false);
    }
  };

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
            <Label htmlFor="orgName" className="text-[13px]">
              {t("orgNameLabel")}
            </Label>
            <Input
              id="orgName"
              placeholder={t("orgNamePlaceholder")}
              disabled={isLoading}
              aria-invalid={!!errors.orgName}
              aria-describedby={errors.orgName ? "orgName-error" : undefined}
              {...register("orgName")}
            />
            {errors.orgName && (
              <p id="orgName-error" role="alert" className="text-sm text-destructive">
                {errors.orgName.message}
              </p>
            )}
          </div>

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
              aria-describedby={errors.email ? "reg-email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="reg-email-error" role="alert" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[13px]">
              {t("passwordLabel")}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={t("passwordPlaceholder")}
              disabled={isLoading}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "reg-password-error" : undefined}
              {...register("password")}
            />
            {errors.password && (
              <p id="reg-password-error" role="alert" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t("creating")}
              </>
            ) : (
              t("cta")
            )}
          </Button>
        </form>

        <div className="mt-6">
          <SocialButtons />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("signInLink")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
