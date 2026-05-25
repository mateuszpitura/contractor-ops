import { useDefaultSkonto } from '../hooks/use-default-skonto.js';
import type { DefaultSkontoSectionProps } from './default-skonto-section.js';
import { DefaultSkontoSectionView } from './default-skonto-section.js';

export function DefaultSkontoSectionContainer(props: DefaultSkontoSectionProps) {
  const skonto = useDefaultSkonto(props.billingProfileId);

  if (!props.featureEnabled) return null;

  return <DefaultSkontoSectionView {...props} {...skonto} />;
}
