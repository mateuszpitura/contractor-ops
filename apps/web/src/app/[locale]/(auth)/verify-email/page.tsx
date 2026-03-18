import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Email verification page shown after registration.
 * Instructs user to check their email. Auto-redirect happens
 * via Better Auth verification callback.
 */
export default function VerifyEmailPage() {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <div className="space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h2 className="text-[20px] font-semibold">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            Check your email to verify your account.
          </p>
          <p className="text-xs text-muted-foreground">
            You will be redirected to the dashboard after verification.
          </p>
        </div>
        <div className="mt-6">
          <Button variant="ghost" render={<a href="/en/login" />}>
            Back to sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
