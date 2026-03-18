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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "This field is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * Login form with email/password, magic link option, and social OAuth.
 */
export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

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
        toast.error(error.message ?? "Invalid email or password");
        setIsLoading(false);
        return;
      }

      router.push("/en/dashboard");
    } catch {
      toast.error("Connection error. Check your internet and try again.");
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    const email = getValues("email");
    if (!email || !z.string().email().safeParse(email).success) {
      toast.error("Enter a valid email address first");
      return;
    }

    setMagicLinkLoading(true);
    try {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: "/en/dashboard",
      });

      if (error) {
        toast.error(error.message ?? "Failed to send magic link");
        setMagicLinkLoading(false);
        return;
      }

      setIsMagicLinkSent(true);
    } catch {
      toast.error("Connection error. Check your internet and try again.");
    } finally {
      setMagicLinkLoading(false);
    }
  };

  if (isMagicLinkSent) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="space-y-2">
            <h2 className="text-[20px] font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to{" "}
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
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight">
          Sign in to Contractor Ops
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your workspace
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[13px]">
                Password
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              disabled={isLoading}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
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
                  Sending link...
                </>
              ) : (
                "Sign in with email link"
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6">
          <SocialButtons />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <a href="/en/register" className="text-primary hover:underline">
            Create organization
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
