'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { OrgPicker } from '@/components/portal/org-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { trpc } from '@/trpc/init';

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
  | { status: 'verifying' }
  | { status: 'error'; message: string }
  | {
      status: 'org-picker';
      orgs: OrgInfo[];
      email: string;
      verificationNonce: string;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set the portal session cookie via the httpOnly API route.
 * This ensures the cookie is httpOnly and secure in production.
 */
async function setSessionCookie(token: string, expiresAt: string): Promise<void> {
  const response = await fetch('/api/portal/set-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, expiresAt }),
  });

  if (!response.ok) {
    throw new Error('Failed to set session cookie');
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
  const t = useTranslations('Portal');
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const verifiedRef = useRef(false);

  const [state, setState] = useState<VerifyState>({ status: 'verifying' });
  const goToLogin = useCallback(() => router.push('/portal/login'), [router]);

  const verifyMagicLink = useMutation(trpc.portal.verifyMagicLink.mutationOptions());

  const selectOrg = useMutation(trpc.portal.selectOrg.mutationOptions());

  // Verify token on mount
  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;

    if (!token) {
      setState({
        status: 'error',
        message: t('verify.errors.noToken'),
      });
      return;
    }

    verifyMagicLink.mutateAsync({ token }).then(
      async result => {
        if (!result.needsOrgPicker && result.session) {
          // Single org: set cookie and redirect
          try {
            await setSessionCookie(result.session.rawToken, result.session.expiresAt.toISOString());
            router.push('/portal');
          } catch {
            setState({
              status: 'error',
              message: t('verify.errors.sessionFailed'),
            });
          }
        } else if (result.needsOrgPicker && result.orgs) {
          // Multi-org: show org picker with verification nonce
          setState({
            status: 'org-picker',
            orgs: result.orgs,
            email: result.email ?? '',
            verificationNonce: (result as { verificationNonce?: string }).verificationNonce ?? '',
          });
        } else {
          setState({
            status: 'error',
            message: t('verify.errors.unexpectedResponse'),
          });
        }
      },
      () => {
        setState({
          status: 'error',
          message: t('verify.errors.linkExpired'),
        });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, verifyMagicLink.mutateAsync, t, router.push]);

  // Handle org selection
  const handleOrgSelect = useCallback(
    async (contractorId: string, organizationId: string) => {
      if (state.status !== 'org-picker') return;

      try {
        const result = await selectOrg.mutateAsync({
          verificationNonce: state.status === 'org-picker' ? state.verificationNonce : '',
          contractorId,
          organizationId,
        } as unknown as Parameters<typeof selectOrg.mutateAsync>[0]);

        await setSessionCookie(result.rawToken, result.expiresAt.toISOString());
        router.push('/portal');
      } catch {
        toast.error(t('verify.errors.orgSelectFailed'));
      }
    },
    [state, selectOrg, router, t],
  );

  // ----- Verifying state -----
  if (state.status === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-[400px]">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('verify.verifying')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----- Error state -----
  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-[400px]">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">{state.message}</p>
            <Button variant="outline" className="mt-2" onClick={goToLogin}>
              {t('verify.backToLogin')}
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
