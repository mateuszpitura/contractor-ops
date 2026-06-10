import { useParams, useSearchParams } from 'react-router-dom';

import { InviteAcceptForm } from '../../components/auth/invite-accept-form.js';
import { AuthLayout } from '../../components/layout/auth-layout.js';

export default function InvitePage() {
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
