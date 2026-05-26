import { useParams, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../layout/auth-layout.js';
import { InviteAcceptForm } from './invite-accept-form.js';

// Decision: route-param resolution — extracts :token + ?email/?orgName via
// useParams/useSearchParams and forwards them into InviteAcceptForm.
export function AuthInviteContainer() {
  const params = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const token = params.token ?? '';
  const email = search.get('email') ?? undefined;
  const orgName = search.get('orgName') ?? undefined;

  return (
    <AuthLayout>
      <InviteAcceptForm token={token} email={email} orgName={orgName} />
    </AuthLayout>
  );
}
