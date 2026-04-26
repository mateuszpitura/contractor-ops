/**
 * Deterministic transliteration table mapping common European diacritics to
 * BACS-safe uppercase ASCII characters.
 *
 * The BACS Standard 18 character set is strictly uppercase A-Z, digits 0-9,
 * plus 14 punctuation characters. Anything outside that set must be either
 * mapped to a BACS-safe equivalent or replaced with `?` (and surfaced as a
 * warning in the UI before the file is downloaded).
 *
 * Coverage (per Phase 63 D-05):
 * - German:        ä/Ä, ö/Ö, ü/Ü, ß
 * - Polish:        ą/Ą, ć/Ć, ę/Ę, ł/Ł, ń/Ń, ó/Ó, ś/Ś, ź/Ź, ż/Ż
 * - French:        é/É, è/È, ê/Ê, ë/Ë, á/Á, à/À, â/Â, ç/Ç
 * - Nordic:        ø/Ø, å/Å
 * - Italian/Spanish: í/Í, ì/Ì, î/Î, ï/Ï, ñ/Ñ, ú/Ú, ù/Ù, û/Û, ô/Ô, ò/Ò
 *
 * Both lower- and uppercase inputs map to the uppercase ASCII output.
 */
export const TRANSLITERATION_TABLE: Map<string, string> = new Map([
  // German -------------------------------------------------------------------
  ['ä', 'A'],
  ['Ä', 'A'],
  ['ö', 'O'],
  ['Ö', 'O'],
  ['ü', 'U'],
  ['Ü', 'U'],
  ['ß', 'SS'],

  // Polish -------------------------------------------------------------------
  ['ą', 'A'],
  ['Ą', 'A'],
  ['ć', 'C'],
  ['Ć', 'C'],
  ['ę', 'E'],
  ['Ę', 'E'],
  ['ł', 'L'],
  ['Ł', 'L'],
  ['ń', 'N'],
  ['Ń', 'N'],
  ['ó', 'O'],
  ['Ó', 'O'],
  ['ś', 'S'],
  ['Ś', 'S'],
  ['ź', 'Z'],
  ['Ź', 'Z'],
  ['ż', 'Z'],
  ['Ż', 'Z'],

  // French -------------------------------------------------------------------
  ['é', 'E'],
  ['É', 'E'],
  ['è', 'E'],
  ['È', 'E'],
  ['ê', 'E'],
  ['Ê', 'E'],
  ['ë', 'E'],
  ['Ë', 'E'],
  ['á', 'A'],
  ['Á', 'A'],
  ['à', 'A'],
  ['À', 'A'],
  ['â', 'A'],
  ['Â', 'A'],
  ['ç', 'C'],
  ['Ç', 'C'],

  // Nordic -------------------------------------------------------------------
  ['ø', 'O'],
  ['Ø', 'O'],
  ['å', 'A'],
  ['Å', 'A'],

  // Italian / Spanish --------------------------------------------------------
  ['í', 'I'],
  ['Í', 'I'],
  ['ì', 'I'],
  ['Ì', 'I'],
  ['î', 'I'],
  ['Î', 'I'],
  ['ï', 'I'],
  ['Ï', 'I'],
  ['ñ', 'N'],
  ['Ñ', 'N'],
  ['ú', 'U'],
  ['Ú', 'U'],
  ['ù', 'U'],
  ['Ù', 'U'],
  ['û', 'U'],
  ['Û', 'U'],
  ['ô', 'O'],
  ['Ô', 'O'],
  ['ò', 'O'],
  ['Ò', 'O'],
]);
