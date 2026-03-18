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

const inviteSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type InviteValues = z.infer<typeof inviteSchema>;

interface InviteAcceptFormProps {
  token: string;
  email?: string;
  orgName?: string;
}

/**
 * Invite acceptance form.
 * Pre-filled email from invite. User creates account or uses social auth,
 * then accepts the organization invitation.
 */
export function InviteAcceptForm({
  token,
  email = "",
  orgName = "the organization",
}: InviteAcceptFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = async (values: InviteValues) => {
    setIsLoading(true);
    try {
      // Step 1: Create user account
      const { error: signUpError } = await authClient.signUp.email({
        email,
        password: values.password,
        name: email.split("@")[0],
      });

      if (signUpError) {
        toast.error(signUpError.message ?? "Failed to create account");
        setIsLoading(false);
        return;
      }

      // Step 2: Accept invitation
      const { error: acceptError } =
        await authClient.organization.acceptInvitation({
          invitationId: token,
        });

      if (acceptError) {
        toast.error(acceptError.message ?? "Failed to accept invitation");
        setIsLoading(false);
        return;
      }

      router.push("/en/dashboard");
    } catch {
      toast.error("Connection error. Check your internet and try again.");
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight">
          Join {orgName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Create your account to join the team
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
              value={email}
              disabled
              className="bg-muted"
            />
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
                Joining...
              </>
            ) : (
              "Accept and join"
            )}
          </Button>
        </form>

        <div className="mt-6">
          <SocialButtons />
        </div>
      </CardContent>
    </Card>
  );
}
