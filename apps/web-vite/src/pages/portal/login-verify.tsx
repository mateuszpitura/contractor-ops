/**
 * Portal magic-link verify — route shell with inlined page content.
 */

import type { PortalAppRouter } from '@contractor-ops/api';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { usePortalLoginVerify } from '../../components/portal/hooks/use-portal-login-verify.js';
import type { PortalSubjectOrgInfo } from '../../components/portal/org-picker.js';
import { OrgPicker } from '../../components/portal/org-picker.js';
import { PageLoadingSpinner } from '../../components/shared/page-loading-spinner.js';
import { getClientEnv } from '../../env.js';
import { useRouter } from '../../i18n/navigation.js';

type PortalInputs = inferRouterInputs<PortalAppRouter>;
type PortalOutputs = inferRouterOutputs<PortalAppRouter>;

type VerifyMagicLinkResult = PortalOutputs['portal']['verifyMagicLink'];
type OrgPickerResult = Extract<VerifyMagicLinkResult, { needsOrgPicker: true }>;
type SelectOrgInput = PortalInputs['portal']['selectOrg'];

type OrgInfo = OrgPickerResult['orgs'][number];

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
  const response = await fetch(`${getClientEnv().VITE_API_URL}/portal/set-session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, expiresAt, signature }),
  });

  if (!response.ok) {
    throw new Error('Failed to set session cookie');
  }
}

function portalHomeForSubject(
  subjects: VerifyMagicLinkResult['subjects'] | undefined,
): '/portal' | '/portal/employee' {
  const subject = subjects?.[0];
  return subject?.subjectType === 'EMPLOYEE' ? '/portal/employee' : '/portal';
}

function PortalLoginVerifyPageContent() {
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
            await router.push(portalHomeForSubject(result.subjects));
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
            verificationNonce: result.verificationNonce,
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
    async (org: PortalSubjectOrgInfo) => {
      if (state.status !== 'org-picker' || !state.verificationNonce) {
        setState({ status: 'error', message: t('verify.errors.unexpectedResponse') });
        return;
      }

      const input: SelectOrgInput = {
        verificationNonce: state.verificationNonce,
        subjectType: org.subjectType,
        organizationId: org.organizationId,
        ...(org.subjectType === 'EMPLOYEE'
          ? { workerId: org.workerId ?? org.subjectId }
          : { contractorId: org.contractorId ?? org.subjectId }),
      };

      try {
        const result = await selectOrg.mutateAsync(input);

        await setSessionCookie(result.rawToken, result.expiresAt.toISOString(), result.signature);
        await router.push(org.subjectType === 'EMPLOYEE' ? '/portal/employee' : '/portal');
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
        orgs={state.orgs as PortalSubjectOrgInfo[]}
        email={state.email}
        onSelect={handleOrgSelect}
        loading={selectOrg.isPending}
      />
    </div>
  );
}

export default function PortalVerifyPage() {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <PortalLoginVerifyPageContent />
    </Suspense>
  );
}
