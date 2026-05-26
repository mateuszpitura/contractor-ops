import { useParams, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../layout/auth-layout.js';
import { InviteAcceptForm } from './invite-accept-form.js';

// Decision: container resolves invite route params (`token`, `email`, `orgName`
// from `useParams` + `useSearchParams`) and forwards them to the presentational
// `InviteAcceptForm`. Route-param resolution is the container's responsibility
// per the architecture rule; the page shell cannot read params.
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
