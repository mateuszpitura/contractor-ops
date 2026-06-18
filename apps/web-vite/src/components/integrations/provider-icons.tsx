/**
 * Provider marks for docs/calendar integrations.
 * Implementations live in `brand-icons.tsx` (vendor-aligned SVGs).
 */

// biome-ignore lint/performance/noBarrelFile: intentional public aggregator — provider brand-icon set re-export
export {
  ConfluenceBrandIcon as ConfluenceIcon,
  GoogleCalendarBrandIcon as GoogleCalendarIcon,
  LinearBrandIcon as LinearIcon,
  NotionBrandIcon as NotionIcon,
  OutlookCalendarBrandIcon as OutlookCalendarIcon,
} from './brand-icons';
