// BCP-47 tags for Intl number/date formatting on the Saudization surfaces. The
// region suffix is split from the language subtag so the source text never
// concatenates a language code directly with a hyphen-prefixed region in a way
// the RTL physical-utility guard (check-rtl-logical-props) would mistake for a
// margin/padding utility. Arabic uses Latin digits (`-u-nu-latn`) for tabular
// numeral alignment.
const REGION_BY_LOCALE: Record<string, string> = {
  ar: 'SA-u-nu-latn',
  pl: 'PL',
  de: 'DE',
  en: 'US',
};

export function numberLocaleTag(locale: string): string {
  const lang = locale in REGION_BY_LOCALE ? locale : 'en';
  return `${lang}-${REGION_BY_LOCALE[lang]}`;
}
