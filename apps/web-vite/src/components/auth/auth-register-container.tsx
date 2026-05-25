import { AuthLayout } from '../layout/auth-layout.js';
import { RegisterForm } from './register-form.js';

export function AuthRegisterContainer() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
