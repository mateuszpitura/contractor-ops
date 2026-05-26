import { AuthLayout } from '../layout/auth-layout.js';
import { RegisterForm } from './register-form.js';

// Decision: composition — wraps RegisterForm in AuthLayout chrome for the
// /register page shell. Sign-up + Turnstile state live in RegisterForm.
export function AuthRegisterContainer() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
