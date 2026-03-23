"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { trpc } from "@/trpc/init";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrgPicker } from "@/components/portal/org-picker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgInfo {
  contractorId: string;
  organizationId: string;
  orgName: string;
  orgLogo?: string | null;
}

type VerifyState =
  | { status: "verifying" }
  | { status: "error"; message: string }
  | {
      status: "org-picker";
      orgs: OrgInfo[];
      email: string;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set the portal session cookie via the httpOnly API route.
 * This ensures the cookie is httpOnly and secure in production.
 */
async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const response = await fetch("/api/portal/set-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, expiresAt }),
  });

  if (!response.ok) {
    throw new Error("Failed to set session cookie");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Magic link verification page.
 *
 * URL: /portal/login/verify?token=xxx
 *
 * Flow:
 * 1. On mount, calls portal.verifyMagicLink with the token.
 * 2. If single org: sets session cookie and redirects to /portal.
 * 3. If multi-org: shows OrgPicker for contractor to choose.
 * 4. On org selection, calls portal.selectOrg, sets cookie, redirects.
 * 5. On error: shows error state with link back to login.
 */
export default function PortalVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const verifiedRef = useRef(false);

  const [state, setState] = useState<VerifyState>({ status: "verifying" });

  const verifyMagicLink = useMutation(
    trpc.portal.verifyMagicLink.mutationOptions(),
  );

  const selectOrg = useMutation(
    trpc.portal.selectOrg.mutationOptions(),
  );

  // Verify token on mount
  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    if (!token) {
      setState({
        status: "error",
        message: "No verification token found. Please request a new sign-in link.",
      });
      return;
    }

    verifyMagicLink.mutateAsync({ token }).then(
      async (result) => {
        if (!result.needsOrgPicker && result.session) {
          // Single org: set cookie and redirect
          try {
            await setSessionCookie(
              result.session.rawToken,
              result.session.expiresAt,
            );
            router.push("/portal");
          } catch {
            setState({
              status: "error",
              message: "Failed to create session. Please try again.",
            });
          }
        } else if (result.needsOrgPicker && result.orgs) {
          // Multi-org: show org picker
          setState({
            status: "org-picker",
            orgs: result.orgs,
            email: result.email ?? "",
          });
        } else {
          setState({
            status: "error",
            message: "Unexpected response. Please request a new sign-in link.",
          });
        }
      },
      () => {
        setState({
          status: "error",
          message: "This link has expired. Request a new sign-in link.",
        });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Handle org selection
  const handleOrgSelect = useCallback(
    async (contractorId: string, organizationId: string) => {
      if (state.status !== "org-picker") return;

      try {
        const result = await selectOrg.mutateAsync({
          email: state.email,
          contractorId,
          organizationId,
        });

        await setSessionCookie(result.rawToken, result.expiresAt);
        router.push("/portal");
      } catch {
        toast.error("Failed to select organization. Please try again.");
      }
    },
    [state, selectOrg, router],
  );

  // ----- Verifying state -----
  if (state.status === "verifying") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-[400px]">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Verifying your sign-in link...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Error state -----
  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-[400px]">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => router.push("/portal/login")}
            >
              Back to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Org picker state -----
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <OrgPicker
        orgs={state.orgs}
        email={state.email}
        onSelect={handleOrgSelect}
        loading={selectOrg.isPending}
      />
    </div>
  );
}
