import { useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useCourierConfigs } from './use-courier-configs.js';

export function useDpdProviderSection() {
  const t = useTranslations('Equipment.carrier');
  const tCarriers = useTranslations('Settings.carriers');
  const [configOpen, setConfigOpen] = useState(false);
  const { isLoading, isConfigured } = useCourierConfigs();

  return {
    t,
    tCarriers,
    configOpen,
    setConfigOpen,
    isLoading,
    isConfigured: isConfigured('dpd'),
  } as const;
}
