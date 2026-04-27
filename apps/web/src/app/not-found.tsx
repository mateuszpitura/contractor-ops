import Link from 'next/link';

/**
 * Root-level App Router 404. Intentionally dependency-free (no next-intl, no
 * theme provider, no tRPC) so it can render outside any [locale] segment.
 *
 * Without this file Next.js 15 falls back to its synthesized Pages-Router
 * /_error + /404 during `next build`, which imports `<Html>` from
 * `next/document` and surfaces the misleading
 * "Html should not be imported outside of pages/_document" prerender error.
 */
export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 1rem',
        gap: '1rem',
      }}>
      <p style={{ fontSize: '3rem', fontWeight: 700, opacity: 0.2 }}>404</p>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 600 }}>Page not found</h1>
      <p style={{ maxWidth: '32rem', fontSize: '0.875rem', opacity: 0.7 }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          background: '#0a0a0a',
          color: '#fafafa',
          textDecoration: 'none',
        }}>
        Go home
      </Link>
    </div>
  );
}
