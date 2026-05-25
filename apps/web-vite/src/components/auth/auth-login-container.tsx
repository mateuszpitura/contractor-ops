import { LoginForm } from '../auth/login-form.js';
import { AuthLayout } from '../layout/auth-layout.js';

export function AuthLoginContainer() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
