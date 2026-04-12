import { InviteAcceptForm } from '@/components/auth/invite-accept-form';

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ email?: string; orgName?: string }>;
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const { email, orgName } = await searchParams;

  return <InviteAcceptForm token={token} email={email} orgName={orgName} />;
}
