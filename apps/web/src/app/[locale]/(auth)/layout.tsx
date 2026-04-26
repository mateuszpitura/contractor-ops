import type { ReactNode } from 'react';

/**
 * Auth layout: centered card over an animated aurora background.
 * Used for login, register, invite accept, and email verification screens.
 * No sidebar. Minimal chrome. Dramatic animated background.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="aurora-bg grain-overlay relative flex min-h-screen items-center justify-center bg-background px-4 py-16">
      {/* Floating orbs for depth */}
      <div className="orb orb-teal absolute top-[15%] left-[10%] h-[300px] w-[300px]" />
      <div className="orb orb-violet absolute top-[60%] right-[15%] h-[250px] w-[250px]" />
      <div className="orb orb-amber absolute bottom-[20%] left-[40%] h-[200px] w-[200px]" />

      {/* Gradient vignette — centers attention on the card */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_70%)]" />

      <div className="relative z-10 w-full max-w-md space-y-8">{children}</div>
    </div>
  );
}
