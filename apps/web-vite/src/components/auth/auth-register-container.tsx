import { AuthLayout } from '../layout/auth-layout.js';
import { RegisterForm } from './register-form.js';

// Decision: composes the auth chrome (`AuthLayout`) around the stateful
// `RegisterForm`. The page shell (`src/pages/register.tsx`) only mounts
// containers; layout + form composition belongs here. Sign-up, org-create
// chain, and Turnstile state live inside `RegisterForm` via `useRegisterForm`.
export function AuthRegisterContainer() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
