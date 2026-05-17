import { redirect } from 'next/navigation';

import { DEFAULT_LOCALE } from '@/i18n/config';

export default function RootRedirect(): never {
  redirect(`/${DEFAULT_LOCALE}`);
}
