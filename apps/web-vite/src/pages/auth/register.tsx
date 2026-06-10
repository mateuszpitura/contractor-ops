import { RegisterForm } from '../../components/auth/register-form.js';
import { AuthLayout } from '../../components/layout/auth-layout.js';

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
