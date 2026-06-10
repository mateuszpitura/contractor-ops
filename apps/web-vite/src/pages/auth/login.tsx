import { LoginForm } from '../../components/auth/login-form.js';
import { AuthLayout } from '../../components/layout/auth-layout.js';

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
