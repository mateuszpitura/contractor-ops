'use client';

import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { ArrowRight } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

// Tight ASCII subset of RFC 5321/5322: local@domain.tld. Intentionally
// rejects unicode + quoted local-parts (`"a b"@x.y`) because our server
// pipeline downstream (newsletter ESP, deliverability checks) only handles
// punycode + plain ASCII. The server endpoint MUST re-validate on submit —
// this regex is a UX gate, not a security boundary. No `+`/`?` chains on
// the same `[…]` class, so ReDoS exposure is bounded.
//
// Constraints baked in (catches the most common malformed addresses):
//   - local-part:   no leading / trailing dot, no consecutive dots
//   - domain label: leading/trailing alphanumeric, optional hyphens inside
//   - TLD:          2–24 ASCII letters only
const LOCAL = `[A-Za-z0-9!#$%&'*+/=?^_\`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_\`{|}~-]+)*`;
const LABEL = `[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?`;
const DOMAIN = `(?:${LABEL}\\.)+[A-Za-z]{2,24}`;
const EMAIL_RE = new RegExp(`^${LOCAL}@${DOMAIN}$`);

interface NewsletterCtaProps {
  headline: string;
  description: string;
  placeholder: string;
  submit: string;
  success: string;
  errorInvalid?: string;
}

export function NewsletterCta({
  headline,
  description,
  placeholder,
  submit,
  success,
  errorInvalid = 'Please enter a valid email address.',
}: NewsletterCtaProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = email.trim();
      if (trimmed.length === 0 || trimmed.length > 254 || !EMAIL_RE.test(trimmed)) {
        setError(errorInvalid);
        return;
      }
      setError(null);
      setSubmitted(true);
    },
    [email, errorInvalid],
  );

  const onEmailChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(event.currentTarget.value);
      if (error) {
        setError(null);
      }
    },
    [error],
  );

  return (
    <aside className="rounded-2xl border border-border/60 bg-card/60 p-6 backdrop-blur md:p-8">
      <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">{headline}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
        {description}
      </p>

      {submitted ? (
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          {success}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            required
            inputMode="email"
            placeholder={placeholder}
            value={email}
            onChange={onEmailChange}
            className="flex-1"
            aria-label={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            autoComplete="email"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            {submit}
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </form>
      )}
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-xs font-medium text-rose-300">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
