import { LoginForm } from '../auth/login-form.js';
import { AuthLayout } from '../layout/auth-layout.js';

// Decision: composes the auth chrome (`AuthLayout` with aurora background,
// orbs, max-width column) around the stateful `LoginForm`. The page shell
// (`src/pages/login.tsx`) only mounts containers; layout + form composition
// belongs here. Auth state and Better Auth wiring live inside `LoginForm`
// via `useLoginForm`.
export function AuthLoginContainer() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
