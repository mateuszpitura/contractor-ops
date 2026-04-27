import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

// LoginForm reads ?redirectTo via useSearchParams(), which Next.js 15 requires
// inside a Suspense boundary so the surrounding shell can be statically
// prerendered while the search params resolve at request time.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
