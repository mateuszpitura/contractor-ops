/**
 * WorkflowNavBadge — overdue task count for nav (wraps shared NavActionBadge).
 */

import { useTranslations } from '../../i18n/useTranslations.js';
import { NavActionBadge } from '../layout/nav-action-badge.js';

interface WorkflowNavBadgeProps {
  count: number;
}

export function WorkflowNavBadge({ count }: WorkflowNavBadgeProps) {
  const tAria = useTranslations('Common.aria');
  return <NavActionBadge count={count} ariaLabel={tAria('overdueTasks', { count })} />;
}
