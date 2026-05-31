/**
 * Root React Router `ErrorBoundary` component.
 *
 * Replaces React Router's default boundary so dev-time errors land in the
 * Vite terminal with full context (message, stack, route, status). The
 * default boundary calls `console.error('Error handled by React Router
 * default ErrorBoundary:', error)`, and `vite-plugin-terminal` JSON-stringifies
 * the Error instance — Error properties are non-enumerable, so the terminal
 * just shows `{}`. Eagerly logging the resolved fields here turns that into an
 * actionable line.
 *
 * The user-facing UI stays intentionally minimal — the design system's
 * `error` empty-state owns the polished surface; this is the last-resort
 * fallback for thrown loader/component errors.
 */

import { useEffect } from 'react';
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router-dom';
import { Sentry } from '../../sentry.js';

interface NormalizedError {
  kind: 'response' | 'error' | 'unknown';
  status?: number;
  statusText?: string;
  message: string;
  stack?: string;
  data?: unknown;
}

const reloadPage = () => {
  window.location.reload();
};

function normalizeError(error: unknown): NormalizedError {
  if (isRouteErrorResponse(error)) {
    return {
      kind: 'response',
      status: error.status,
      statusText: error.statusText,
      message: `${error.status} ${error.statusText}`,
      data: error.data,
    };
  }
  if (error instanceof Error) {
    return {
      kind: 'error',
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    kind: 'unknown',
    message: typeof error === 'string' ? error : 'Unknown route error',
    data: error,
  };
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  const normalized = normalizeError(error);

  useEffect(() => {
    // Build a plain object so `vite-plugin-terminal`'s JSON serializer keeps
    // all fields (Error's `message`/`stack` are non-enumerable, so plain
    // `console.error(err)` shows `{}` in the terminal).
    // biome-ignore lint/suspicious/noConsole: error boundary intentionally writes to the browser console so devtools and the dev terminal mirror catch the failure
    console.error('[route-error]', {
      kind: normalized.kind,
      pathname: location.pathname,
      search: location.search,
      status: normalized.status,
      statusText: normalized.statusText,
      message: normalized.message,
      stack: normalized.stack,
      data: normalized.data,
    });

    // Report genuine render/loader failures to Sentry so production crashes
    // are visible to on-call. Skip expected routing responses (404 and other
    // loader-thrown HTTP responses) — those are not exceptions worth alerting on.
    if (normalized.kind !== 'response') {
      Sentry.captureException(error, {
        tags: { 'react.boundary': 'route', pathname: location.pathname },
      });
    }
  }, [error, normalized, location.pathname, location.search]);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        {normalized.status
          ? `${normalized.status} — ${normalized.statusText ?? 'Error'}`
          : 'Something went wrong'}
      </h1>
      <p style={{ marginBottom: '1.5rem', color: '#555' }}>{normalized.message}</p>
      <button
        onClick={reloadPage}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          border: '1px solid #d4d4d8',
          background: '#fafafa',
          cursor: 'pointer',
        }}
        type="button">
        Reload
      </button>
    </main>
  );
}
