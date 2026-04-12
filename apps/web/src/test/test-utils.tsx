import type { RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import enMessages from '../../messages/en.json' with { type: 'json' };
import plMessages from '../../messages/pl.json' with { type: 'json' };

const messages: Record<string, typeof enMessages> = {
  en: enMessages,
  pl: plMessages,
};

type Locale = 'en' | 'pl';

interface WrapperOptions {
  locale?: Locale;
}

function createWrapper({ locale = 'en' }: WrapperOptions = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
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
