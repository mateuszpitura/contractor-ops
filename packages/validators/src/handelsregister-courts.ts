// packages/validators/src/handelsregister-courts.ts
//
// German Registergerichte (Amtsgerichte with Handelsregister competence).
// Source: https://de.wikipedia.org/wiki/Liste_deutscher_Registergerichte
// Cross-reference: https://www.handelsregister.de (Gemeinsames Registerportal der Länder)
// Last verified: 2026-04-12 (during Phase 56 research).
// Review cadence: annual (or on Steuerberater flag); Registergericht consolidations
// do happen — e.g. Baden-Württemberg centralised to Freiburg/Mannheim/Stuttgart/Ulm in
// 2009, and further mergers are possible.
//
// ASSUMPTION A5 (LOW confidence): community-maintained list; ~120 courts targeted.
// Each Bundesland has at least one Registergericht. Entries cover the registry courts
// that hold Handelsregister competence for their Landgerichtsbezirk; small-city
// Amtsgerichte without register competence are intentionally omitted.
//
// Maintainer responsibility: yearly cross-reference against Gemeinsames Registerportal
// (https://www.handelsregister.de) to catch consolidations.

import type { BundeslandCode } from './steuernummer-formats.js';

export interface HandelsregisterCourt {
  /** Stable machine-readable slug; lowercase ASCII with hyphens, umlauts transliterated. */
  code: string;
  /** Display name as it appears on German commercial documents ("Amtsgericht <city>"). */
  name: string;
  /** Bundesland where the court sits. */
  state: BundeslandCode;
  /** Canonical city name (German orthography). */
  city: string;
}

export const HANDELSREGISTER_COURTS: readonly HandelsregisterCourt[] = [
  // Baden-Württemberg (4 Registergerichte)
  {
    code: 'amtsgericht-freiburg',
    name: 'Amtsgericht Freiburg',
    state: 'BW',
    city: 'Freiburg im Breisgau',
  },
  { code: 'amtsgericht-mannheim', name: 'Amtsgericht Mannheim', state: 'BW', city: 'Mannheim' },
  { code: 'amtsgericht-stuttgart', name: 'Amtsgericht Stuttgart', state: 'BW', city: 'Stuttgart' },
  { code: 'amtsgericht-ulm', name: 'Amtsgericht Ulm', state: 'BW', city: 'Ulm' },

  // Bayern (8 Registergerichte)
  { code: 'amtsgericht-muenchen', name: 'Amtsgericht München', state: 'BY', city: 'München' },
  { code: 'amtsgericht-augsburg', name: 'Amtsgericht Augsburg', state: 'BY', city: 'Augsburg' },
  { code: 'amtsgericht-nuernberg', name: 'Amtsgericht Nürnberg', state: 'BY', city: 'Nürnberg' },
  {
    code: 'amtsgericht-regensburg',
    name: 'Amtsgericht Regensburg',
    state: 'BY',
    city: 'Regensburg',
  },
  { code: 'amtsgericht-wuerzburg', name: 'Amtsgericht Würzburg', state: 'BY', city: 'Würzburg' },
  {
    code: 'amtsgericht-ingolstadt',
    name: 'Amtsgericht Ingolstadt',
    state: 'BY',
    city: 'Ingolstadt',
  },
  { code: 'amtsgericht-hof', name: 'Amtsgericht Hof', state: 'BY', city: 'Hof' },
  { code: 'amtsgericht-memmingen', name: 'Amtsgericht Memmingen', state: 'BY', city: 'Memmingen' },

  // Berlin (1 Registergericht)
  {
    code: 'amtsgericht-charlottenburg',
    name: 'Amtsgericht Charlottenburg',
    state: 'BE',
    city: 'Berlin',
  },

  // Brandenburg (4 Registergerichte)
  { code: 'amtsgericht-cottbus', name: 'Amtsgericht Cottbus', state: 'BB', city: 'Cottbus' },
  {
    code: 'amtsgericht-frankfurt-oder',
    name: 'Amtsgericht Frankfurt (Oder)',
    state: 'BB',
    city: 'Frankfurt (Oder)',
  },
  { code: 'amtsgericht-neuruppin', name: 'Amtsgericht Neuruppin', state: 'BB', city: 'Neuruppin' },
  { code: 'amtsgericht-potsdam', name: 'Amtsgericht Potsdam', state: 'BB', city: 'Potsdam' },

  // Bremen (1 Registergericht)
  { code: 'amtsgericht-bremen', name: 'Amtsgericht Bremen', state: 'HB', city: 'Bremen' },

  // Hamburg (1 Registergericht)
  { code: 'amtsgericht-hamburg', name: 'Amtsgericht Hamburg', state: 'HH', city: 'Hamburg' },

  // Hessen (7 Registergerichte)
  { code: 'amtsgericht-darmstadt', name: 'Amtsgericht Darmstadt', state: 'HE', city: 'Darmstadt' },
  {
    code: 'amtsgericht-frankfurt-am-main',
    name: 'Amtsgericht Frankfurt am Main',
    state: 'HE',
    city: 'Frankfurt am Main',
  },
  { code: 'amtsgericht-fulda', name: 'Amtsgericht Fulda', state: 'HE', city: 'Fulda' },
  { code: 'amtsgericht-giessen', name: 'Amtsgericht Gießen', state: 'HE', city: 'Gießen' },
  { code: 'amtsgericht-hanau', name: 'Amtsgericht Hanau', state: 'HE', city: 'Hanau' },
  { code: 'amtsgericht-kassel', name: 'Amtsgericht Kassel', state: 'HE', city: 'Kassel' },
  { code: 'amtsgericht-wetzlar', name: 'Amtsgericht Wetzlar', state: 'HE', city: 'Wetzlar' },

  // Mecklenburg-Vorpommern (4 Registergerichte)
  {
    code: 'amtsgericht-neubrandenburg',
    name: 'Amtsgericht Neubrandenburg',
    state: 'MV',
    city: 'Neubrandenburg',
  },
  { code: 'amtsgericht-rostock', name: 'Amtsgericht Rostock', state: 'MV', city: 'Rostock' },
  { code: 'amtsgericht-schwerin', name: 'Amtsgericht Schwerin', state: 'MV', city: 'Schwerin' },
  { code: 'amtsgericht-stralsund', name: 'Amtsgericht Stralsund', state: 'MV', city: 'Stralsund' },

  // Niedersachsen (10 Registergerichte)
  { code: 'amtsgericht-aurich', name: 'Amtsgericht Aurich', state: 'NI', city: 'Aurich' },
  {
    code: 'amtsgericht-braunschweig',
    name: 'Amtsgericht Braunschweig',
    state: 'NI',
    city: 'Braunschweig',
  },
  { code: 'amtsgericht-goettingen', name: 'Amtsgericht Göttingen', state: 'NI', city: 'Göttingen' },
  { code: 'amtsgericht-hannover', name: 'Amtsgericht Hannover', state: 'NI', city: 'Hannover' },
  {
    code: 'amtsgericht-hildesheim',
    name: 'Amtsgericht Hildesheim',
    state: 'NI',
    city: 'Hildesheim',
  },
  { code: 'amtsgericht-lueneburg', name: 'Amtsgericht Lüneburg', state: 'NI', city: 'Lüneburg' },
  { code: 'amtsgericht-oldenburg', name: 'Amtsgericht Oldenburg', state: 'NI', city: 'Oldenburg' },
  { code: 'amtsgericht-osnabrueck', name: 'Amtsgericht Osnabrück', state: 'NI', city: 'Osnabrück' },
  {
    code: 'amtsgericht-stadthagen',
    name: 'Amtsgericht Stadthagen',
    state: 'NI',
    city: 'Stadthagen',
  },
  { code: 'amtsgericht-tostedt', name: 'Amtsgericht Tostedt', state: 'NI', city: 'Tostedt' },
  { code: 'amtsgericht-walsrode', name: 'Amtsgericht Walsrode', state: 'NI', city: 'Walsrode' },

  // Nordrhein-Westfalen (22 Registergerichte)
  { code: 'amtsgericht-aachen', name: 'Amtsgericht Aachen', state: 'NW', city: 'Aachen' },
  { code: 'amtsgericht-arnsberg', name: 'Amtsgericht Arnsberg', state: 'NW', city: 'Arnsberg' },
  {
    code: 'amtsgericht-bad-oeynhausen',
    name: 'Amtsgericht Bad Oeynhausen',
    state: 'NW',
    city: 'Bad Oeynhausen',
  },
  { code: 'amtsgericht-bielefeld', name: 'Amtsgericht Bielefeld', state: 'NW', city: 'Bielefeld' },
  { code: 'amtsgericht-bochum', name: 'Amtsgericht Bochum', state: 'NW', city: 'Bochum' },
  { code: 'amtsgericht-bonn', name: 'Amtsgericht Bonn', state: 'NW', city: 'Bonn' },
  { code: 'amtsgericht-coesfeld', name: 'Amtsgericht Coesfeld', state: 'NW', city: 'Coesfeld' },
  { code: 'amtsgericht-dortmund', name: 'Amtsgericht Dortmund', state: 'NW', city: 'Dortmund' },
  { code: 'amtsgericht-duisburg', name: 'Amtsgericht Duisburg', state: 'NW', city: 'Duisburg' },
  { code: 'amtsgericht-dueren', name: 'Amtsgericht Düren', state: 'NW', city: 'Düren' },
  {
    code: 'amtsgericht-duesseldorf',
    name: 'Amtsgericht Düsseldorf',
    state: 'NW',
    city: 'Düsseldorf',
  },
  { code: 'amtsgericht-essen', name: 'Amtsgericht Essen', state: 'NW', city: 'Essen' },
  {
    code: 'amtsgericht-gelsenkirchen',
    name: 'Amtsgericht Gelsenkirchen',
    state: 'NW',
    city: 'Gelsenkirchen',
  },
  { code: 'amtsgericht-hagen', name: 'Amtsgericht Hagen', state: 'NW', city: 'Hagen' },
  { code: 'amtsgericht-iserlohn', name: 'Amtsgericht Iserlohn', state: 'NW', city: 'Iserlohn' },
  { code: 'amtsgericht-koeln', name: 'Amtsgericht Köln', state: 'NW', city: 'Köln' },
  { code: 'amtsgericht-krefeld', name: 'Amtsgericht Krefeld', state: 'NW', city: 'Krefeld' },
  {
    code: 'amtsgericht-moenchengladbach',
    name: 'Amtsgericht Mönchengladbach',
    state: 'NW',
    city: 'Mönchengladbach',
  },
  { code: 'amtsgericht-muenster', name: 'Amtsgericht Münster', state: 'NW', city: 'Münster' },
  { code: 'amtsgericht-paderborn', name: 'Amtsgericht Paderborn', state: 'NW', city: 'Paderborn' },
  { code: 'amtsgericht-siegen', name: 'Amtsgericht Siegen', state: 'NW', city: 'Siegen' },
  { code: 'amtsgericht-steinfurt', name: 'Amtsgericht Steinfurt', state: 'NW', city: 'Steinfurt' },
  { code: 'amtsgericht-wuppertal', name: 'Amtsgericht Wuppertal', state: 'NW', city: 'Wuppertal' },

  // Rheinland-Pfalz (7 Registergerichte)
  {
    code: 'amtsgericht-bad-kreuznach',
    name: 'Amtsgericht Bad Kreuznach',
    state: 'RP',
    city: 'Bad Kreuznach',
  },
  {
    code: 'amtsgericht-kaiserslautern',
    name: 'Amtsgericht Kaiserslautern',
    state: 'RP',
    city: 'Kaiserslautern',
  },
  { code: 'amtsgericht-koblenz', name: 'Amtsgericht Koblenz', state: 'RP', city: 'Koblenz' },
  {
    code: 'amtsgericht-ludwigshafen',
    name: 'Amtsgericht Ludwigshafen am Rhein',
    state: 'RP',
    city: 'Ludwigshafen am Rhein',
  },
  { code: 'amtsgericht-mainz', name: 'Amtsgericht Mainz', state: 'RP', city: 'Mainz' },
  { code: 'amtsgericht-montabaur', name: 'Amtsgericht Montabaur', state: 'RP', city: 'Montabaur' },
  { code: 'amtsgericht-wittlich', name: 'Amtsgericht Wittlich', state: 'RP', city: 'Wittlich' },
  {
    code: 'amtsgericht-zweibruecken',
    name: 'Amtsgericht Zweibrücken',
    state: 'RP',
    city: 'Zweibrücken',
  },

  // Saarland (1 Registergericht)
  {
    code: 'amtsgericht-saarbruecken',
    name: 'Amtsgericht Saarbrücken',
    state: 'SL',
    city: 'Saarbrücken',
  },

  // Sachsen (3 Registergerichte)
  { code: 'amtsgericht-chemnitz', name: 'Amtsgericht Chemnitz', state: 'SN', city: 'Chemnitz' },
  { code: 'amtsgericht-dresden', name: 'Amtsgericht Dresden', state: 'SN', city: 'Dresden' },
  { code: 'amtsgericht-leipzig', name: 'Amtsgericht Leipzig', state: 'SN', city: 'Leipzig' },

  // Sachsen-Anhalt (3 Registergerichte)
  {
    code: 'amtsgericht-halle-saale',
    name: 'Amtsgericht Halle (Saale)',
    state: 'ST',
    city: 'Halle (Saale)',
  },
  { code: 'amtsgericht-magdeburg', name: 'Amtsgericht Magdeburg', state: 'ST', city: 'Magdeburg' },
  { code: 'amtsgericht-stendal', name: 'Amtsgericht Stendal', state: 'ST', city: 'Stendal' },

  // Schleswig-Holstein (7 Registergerichte)
  { code: 'amtsgericht-flensburg', name: 'Amtsgericht Flensburg', state: 'SH', city: 'Flensburg' },
  { code: 'amtsgericht-itzehoe', name: 'Amtsgericht Itzehoe', state: 'SH', city: 'Itzehoe' },
  { code: 'amtsgericht-kiel', name: 'Amtsgericht Kiel', state: 'SH', city: 'Kiel' },
  { code: 'amtsgericht-luebeck', name: 'Amtsgericht Lübeck', state: 'SH', city: 'Lübeck' },
  {
    code: 'amtsgericht-neumuenster',
    name: 'Amtsgericht Neumünster',
    state: 'SH',
    city: 'Neumünster',
  },
  { code: 'amtsgericht-pinneberg', name: 'Amtsgericht Pinneberg', state: 'SH', city: 'Pinneberg' },
  { code: 'amtsgericht-reinbek', name: 'Amtsgericht Reinbek', state: 'SH', city: 'Reinbek' },

  // Thüringen (5 Registergerichte)
  { code: 'amtsgericht-eisenach', name: 'Amtsgericht Eisenach', state: 'TH', city: 'Eisenach' },
  { code: 'amtsgericht-gera', name: 'Amtsgericht Gera', state: 'TH', city: 'Gera' },
  { code: 'amtsgericht-jena', name: 'Amtsgericht Jena', state: 'TH', city: 'Jena' },
  { code: 'amtsgericht-meiningen', name: 'Amtsgericht Meiningen', state: 'TH', city: 'Meiningen' },
  {
    code: 'amtsgericht-muehlhausen',
    name: 'Amtsgericht Mühlhausen',
    state: 'TH',
    city: 'Mühlhausen',
  },

  // Additional Niedersachsen entries (register competence spread)
  {
    code: 'amtsgericht-verden',
    name: 'Amtsgericht Verden (Aller)',
    state: 'NI',
    city: 'Verden (Aller)',
  },
  { code: 'amtsgericht-nordhorn', name: 'Amtsgericht Nordhorn', state: 'NI', city: 'Nordhorn' },

  // Additional Bayern entries
  {
    code: 'amtsgericht-aschaffenburg',
    name: 'Amtsgericht Aschaffenburg',
    state: 'BY',
    city: 'Aschaffenburg',
  },
  { code: 'amtsgericht-bamberg', name: 'Amtsgericht Bamberg', state: 'BY', city: 'Bamberg' },
  { code: 'amtsgericht-bayreuth', name: 'Amtsgericht Bayreuth', state: 'BY', city: 'Bayreuth' },
  { code: 'amtsgericht-coburg', name: 'Amtsgericht Coburg', state: 'BY', city: 'Coburg' },
  {
    code: 'amtsgericht-deggendorf',
    name: 'Amtsgericht Deggendorf',
    state: 'BY',
    city: 'Deggendorf',
  },
  { code: 'amtsgericht-fuerth', name: 'Amtsgericht Fürth', state: 'BY', city: 'Fürth' },
  {
    code: 'amtsgericht-kempten',
    name: 'Amtsgericht Kempten (Allgäu)',
    state: 'BY',
    city: 'Kempten (Allgäu)',
  },
  { code: 'amtsgericht-landshut', name: 'Amtsgericht Landshut', state: 'BY', city: 'Landshut' },
  { code: 'amtsgericht-passau', name: 'Amtsgericht Passau', state: 'BY', city: 'Passau' },
  {
    code: 'amtsgericht-schweinfurt',
    name: 'Amtsgericht Schweinfurt',
    state: 'BY',
    city: 'Schweinfurt',
  },
  { code: 'amtsgericht-straubing', name: 'Amtsgericht Straubing', state: 'BY', city: 'Straubing' },
  {
    code: 'amtsgericht-traunstein',
    name: 'Amtsgericht Traunstein',
    state: 'BY',
    city: 'Traunstein',
  },
  {
    code: 'amtsgericht-weiden',
    name: 'Amtsgericht Weiden i.d.OPf.',
    state: 'BY',
    city: 'Weiden in der Oberpfalz',
  },

  // Additional Baden-Württemberg entries (via Landgerichtsbezirke)
  { code: 'amtsgericht-heilbronn', name: 'Amtsgericht Heilbronn', state: 'BW', city: 'Heilbronn' },
  { code: 'amtsgericht-karlsruhe', name: 'Amtsgericht Karlsruhe', state: 'BW', city: 'Karlsruhe' },
  { code: 'amtsgericht-offenburg', name: 'Amtsgericht Offenburg', state: 'BW', city: 'Offenburg' },
  {
    code: 'amtsgericht-ravensburg',
    name: 'Amtsgericht Ravensburg',
    state: 'BW',
    city: 'Ravensburg',
  },

  // Additional NRW courts
  { code: 'amtsgericht-hamm', name: 'Amtsgericht Hamm', state: 'NW', city: 'Hamm' },
  { code: 'amtsgericht-kleve', name: 'Amtsgericht Kleve', state: 'NW', city: 'Kleve' },
  {
    code: 'amtsgericht-leverkusen',
    name: 'Amtsgericht Leverkusen',
    state: 'NW',
    city: 'Leverkusen',
  },
  {
    code: 'amtsgericht-muelheim-ruhr',
    name: 'Amtsgericht Mülheim an der Ruhr',
    state: 'NW',
    city: 'Mülheim an der Ruhr',
  },
  { code: 'amtsgericht-neuss', name: 'Amtsgericht Neuss', state: 'NW', city: 'Neuss' },
  {
    code: 'amtsgericht-oberhausen',
    name: 'Amtsgericht Oberhausen',
    state: 'NW',
    city: 'Oberhausen',
  },
  {
    code: 'amtsgericht-recklinghausen',
    name: 'Amtsgericht Recklinghausen',
    state: 'NW',
    city: 'Recklinghausen',
  },
  { code: 'amtsgericht-solingen', name: 'Amtsgericht Solingen', state: 'NW', city: 'Solingen' },

  // Additional Hessen
  {
    code: 'amtsgericht-bad-homburg',
    name: 'Amtsgericht Bad Homburg v.d.H.',
    state: 'HE',
    city: 'Bad Homburg vor der Höhe',
  },
  {
    code: 'amtsgericht-offenbach',
    name: 'Amtsgericht Offenbach am Main',
    state: 'HE',
    city: 'Offenbach am Main',
  },

  // Additional Schleswig-Holstein
  { code: 'amtsgericht-meldorf', name: 'Amtsgericht Meldorf', state: 'SH', city: 'Meldorf' },
  {
    code: 'amtsgericht-norderstedt',
    name: 'Amtsgericht Norderstedt',
    state: 'SH',
    city: 'Norderstedt',
  },

  // Additional Baden-Württemberg broader register catchment
  { code: 'amtsgericht-tuebingen', name: 'Amtsgericht Tübingen', state: 'BW', city: 'Tübingen' },
  { code: 'amtsgericht-konstanz', name: 'Amtsgericht Konstanz', state: 'BW', city: 'Konstanz' },
  {
    code: 'amtsgericht-heidelberg',
    name: 'Amtsgericht Heidelberg',
    state: 'BW',
    city: 'Heidelberg',
  },
  { code: 'amtsgericht-pforzheim', name: 'Amtsgericht Pforzheim', state: 'BW', city: 'Pforzheim' },
];
