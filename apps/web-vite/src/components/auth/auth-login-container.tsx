import { LoginForm } from '../auth/login-form.js';
import { AuthLayout } from '../layout/auth-layout.js';

// Decision: composition — wraps LoginForm in AuthLayout chrome for the
// /login page shell. Auth state lives in LoginForm via useLoginForm.
export function AuthLoginContainer() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
