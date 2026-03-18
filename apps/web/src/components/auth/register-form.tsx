"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SocialButtons } from "@/components/auth/social-buttons";
import { authClient } from "@/lib/auth-client";

const registerSchema = z.object({
  orgName: z.string().min(2, "Organization name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterValues = z.infer<typeof registerSchema>;

/**
 * Registration form with org name, email, password.
 * Creates account via authClient.signUp.email(), then creates organization,
 * and redirects to email verification.
 */
export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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
        toast.error(signUpError.message ?? "Failed to create account");
        setIsLoading(false);
        return;
      }

      // Step 2: Create organization
      const { error: orgError } = await authClient.organization.create({
        name: values.orgName,
        slug: values.orgName.toLowerCase().replace(/\s+/g, "-"),
      });

      if (orgError) {
        toast.error(orgError.message ?? "Failed to create organization");
        setIsLoading(false);
        return;
      }

      router.push("/en/verify-email");
    } catch {
      toast.error("Connection error. Check your internet and try again.");
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight">
          Create your organization
        </h1>
        <p className="text-sm text-muted-foreground">
          Set up your workspace to manage contractors
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName" className="text-[13px]">
              Organization name
            </Label>
            <Input
              id="orgName"
              placeholder="Acme Corp"
              disabled={isLoading}
              {...register("orgName")}
            />
            {errors.orgName && (
              <p className="text-sm text-destructive">
                {errors.orgName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px]">
              Work email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              disabled={isLoading}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[13px]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              disabled={isLoading}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create organization"
            )}
          </Button>
        </form>

        <div className="mt-6">
          <SocialButtons />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/en/login" className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
