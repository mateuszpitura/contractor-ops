import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import deMessages from '../../messages/de.json' with { type: 'json' };
import enMessages from '../../messages/en.json' with { type: 'json' };
import plMessages from '../../messages/pl.json' with { type: 'json' };

const messages: Record<string, typeof enMessages> = {
  en: enMessages,
  pl: plMessages,
  de: deMessages as typeof enMessages,
};

type Locale = 'en' | 'pl' | 'de';

interface WrapperOptions {
  locale?: Locale;
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper({ locale = 'en' }: WrapperOptions = {}) {
  // Fresh QueryClient per wrapper instance so parallel tests don't share cache.
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale={locale}
          messages={messages[locale]}
          timeZone="Europe/Warsaw"
          formats={{
            dateTime: {
              short: { day: 'numeric', month: 'short', year: 'numeric' },
              long: {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              },
            },
            number: {
              currency: { style: 'currency', currency: 'PLN' },
              percent: { style: 'percent' },
            },
          }}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  };
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  locale?: Locale;
}

function customRender(ui: ReactElement, { locale = 'en', ...options }: CustomRenderOptions = {}) {
  return render(ui, {
    wrapper: createWrapper({ locale }),
    ...options,
  });
}

function setup(ui: ReactElement, options?: CustomRenderOptions) {
  const user = userEvent.setup();
  const result = customRender(ui, options);
  return { user, ...result };
}

export { act, screen, waitFor, within } from '@testing-library/react';
export { createWrapper, customRender as render, setup };
