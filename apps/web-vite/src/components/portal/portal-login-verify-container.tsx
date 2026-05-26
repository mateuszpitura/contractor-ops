import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useRouter } from '../../i18n/navigation.js';
import { usePortalLoginVerify } from './hooks/use-portal-login-verify.js';
import { OrgPicker } from './org-picker.js';

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

async function setSessionCookie(
  token: string,
  expiresAt: string,
  signature: string,
): Promise<void> {
  const response = await fetch('/api/portal/set-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, expiresAt, signature }),
  });

  if (!response.ok) {
    throw new Error('Failed to set session cookie');
  }
}

export function PortalLoginVerifyContainer() {
  const { verifyMagicLink, selectOrg, t } = usePortalLoginVerify();
  const [searchParams] = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const verifiedRef = useRef(false);

  const [state, setState] = useState<VerifyState>({ status: 'verifying' });
  const goToLogin = useCallback(() => router.push('/portal/login'), [router]);

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
          try {
            await setSessionCookie(
              result.session.rawToken,
              result.session.expiresAt.toISOString(),
              result.session.signature,
            );
            router.push('/portal');
          } catch {
            setState({
              status: 'error',
              message: t('verify.errors.sessionFailed'),
            });
          }
        } else if (result.needsOrgPicker && result.orgs) {
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

  const handleOrgSelect = useCallback(
    async (contractorId: string, organizationId: string) => {
      if (state.status !== 'org-picker') return;

      try {
        const result = await selectOrg.mutateAsync({
          verificationNonce: state.status === 'org-picker' ? state.verificationNonce : '',
          contractorId,
          organizationId,
        } as unknown as Parameters<typeof selectOrg.mutateAsync>[0]);

        await setSessionCookie(result.rawToken, result.expiresAt.toISOString(), result.signature);
        router.push('/portal');
      } catch {
        toast.error(t('verify.errors.orgSelectFailed'));
      }
    },
    [state, selectOrg, router, t],
  );

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
