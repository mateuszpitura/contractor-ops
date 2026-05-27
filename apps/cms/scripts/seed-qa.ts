/**
 * scripts/seed-qa.ts — Payload content seed for the QA walk-and-fix loop.
 *
 * Idempotent. Re-running upserts by stable keys (Author.handle,
 * Category.slug, Post.slug per locale, LegalDocument.(type, jurisdiction)).
 *
 * Seeds:
 *   - 2 Authors (avatars omitted — Media seed is out of scope for v1)
 *   - 2 Categories
 *   - 5 published Posts × 4 locales (en, pl, de, ar), spread across
 *     2 categories and tagged with 3 distinct tags
 *   - 4 LegalDocuments (privacy + terms × eu + gb) when the
 *     `migrate:legal` seed has not already populated them
 *
 * Media (Posts.coverImage, Authors.avatar) is intentionally left blank for
 * v1. Adding real image binaries belongs in a follow-up step once the walk
 * surfaces concrete needs (e.g. blog hero rendering).
 *
 * Invoked from the repo-level `pnpm seed:qa` script after seed-dev.
 */

import { getBaseLoggerOptions } from '@contractor-ops/logger';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import pino from 'pino';
import { doc, h1, h2, p } from '../src/lib/lexical';
import config from '../src/payload.config';

const log = pino(getBaseLoggerOptions()).child({ service: 'cms', script: 'seed-qa' });

// Quiet the legal-docs revalidate webhook + post hooks during the seed —
// the API is typically offline when this runs the first time; later tag
// flips happen on real edits anyway.
process.env.CMS_SUPPRESS_WEBHOOKS = '1';

type Locale = 'en' | 'pl' | 'de' | 'ar';
const LOCALES: readonly Locale[] = ['en', 'pl', 'de', 'ar'];

interface Outcome {
  authors: { created: number; updated: number };
  categories: { created: number; updated: number };
  posts: { created: number; updated: number };
  legalDocuments: { created: number; updated: number; skipped: number };
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

interface AuthorSeed {
  handle: string;
  name: Record<Locale, string>;
  email: string;
  bioByLocale: Record<Locale, string>;
}

const AUTHORS: readonly AuthorSeed[] = [
  {
    handle: 'amelia-stone',
    name: {
      en: 'Amelia Stone',
      pl: 'Amelia Stone',
      de: 'Amelia Stone',
      ar: 'أميليا ستون',
    },
    email: 'amelia.stone@seed.local',
    bioByLocale: {
      en: 'Senior staff writer covering compliance and contractor classification.',
      pl: 'Starsza redaktorka pisząca o zgodności i klasyfikacji wykonawców.',
      de: 'Leitende Autorin für Compliance und Auftragnehmer-Klassifizierung.',
      ar: 'كاتبة كبيرة تغطي الامتثال وتصنيف المقاولين.',
    },
  },
  {
    handle: 'rashid-osman',
    name: {
      en: 'Rashid Osman',
      pl: 'Rashid Osman',
      de: 'Rashid Osman',
      ar: 'راشد عثمان',
    },
    email: 'rashid.osman@seed.local',
    bioByLocale: {
      en: 'Editor on regional taxation and e-invoicing topics.',
      pl: 'Redaktor zajmujący się podatkami regionalnymi i e-fakturowaniem.',
      de: 'Redakteur für regionale Besteuerung und E-Rechnung.',
      ar: 'محرر يغطي الضرائب الإقليمية والفوترة الإلكترونية.',
    },
  },
];

async function upsertAuthors(payload: Payload): Promise<{
  created: number;
  updated: number;
  idByHandle: Record<string, number>;
}> {
  let created = 0;
  let updated = 0;
  const idByHandle: Record<string, number> = {};

  for (const author of AUTHORS) {
    const existing = await payload.find({
      collection: 'authors',
      where: { handle: { equals: author.handle } },
      limit: 1,
      depth: 0,
    });

    let id: number;
    if (existing.totalDocs > 0) {
      const current = existing.docs[0] as { id: number };
      id = current.id;
      for (const locale of LOCALES) {
        await payload.update({
          collection: 'authors',
          id,
          locale,
          data: {
            name: author.name[locale],
            bio: doc(p(author.bioByLocale[locale])),
          },
        });
      }
      await payload.update({
        collection: 'authors',
        id,
        data: { email: author.email },
      });
      updated += 1;
    } else {
      const initial = await payload.create({
        collection: 'authors',
        locale: 'en',
        data: {
          handle: author.handle,
          name: author.name.en,
          email: author.email,
          bio: doc(p(author.bioByLocale.en)),
        },
      });
      id = (initial as { id: number }).id;
      for (const locale of LOCALES.filter(l => l !== 'en')) {
        await payload.update({
          collection: 'authors',
          id,
          locale,
          data: {
            name: author.name[locale],
            bio: doc(p(author.bioByLocale[locale])),
          },
        });
      }
      created += 1;
    }
    idByHandle[author.handle] = id;
  }

  return { created, updated, idByHandle };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

interface CategorySeed {
  slug: string;
  color: 'neutral' | 'teal' | 'amber' | 'rose' | 'indigo' | 'emerald';
  name: Record<Locale, string>;
  descriptionByLocale: Record<Locale, string>;
}

const CATEGORIES: readonly CategorySeed[] = [
  {
    slug: 'compliance',
    color: 'teal',
    name: {
      en: 'Compliance',
      pl: 'Zgodność',
      de: 'Compliance',
      ar: 'الامتثال',
    },
    descriptionByLocale: {
      en: 'Articles on tax, labor, and data-protection compliance.',
      pl: 'Artykuły o zgodności podatkowej, pracowniczej i ochronie danych.',
      de: 'Artikel zu Steuer-, Arbeits- und Datenschutzkonformität.',
      ar: 'مقالات حول الامتثال الضريبي والعمالي وحماية البيانات.',
    },
  },
  {
    slug: 'operations',
    color: 'indigo',
    name: {
      en: 'Operations',
      pl: 'Operacje',
      de: 'Betrieb',
      ar: 'العمليات',
    },
    descriptionByLocale: {
      en: 'Workflow patterns and operations playbooks for contractor teams.',
      pl: 'Wzorce procesów i podręczniki dla zespołów wykonawców.',
      de: 'Workflow-Muster und Playbooks für Auftragnehmer-Teams.',
      ar: 'أنماط سير العمل وأدلة العمليات لفرق المقاولين.',
    },
  },
];

async function upsertCategories(payload: Payload): Promise<{
  created: number;
  updated: number;
  idBySlug: Record<string, number>;
}> {
  let created = 0;
  let updated = 0;
  const idBySlug: Record<string, number> = {};

  for (const category of CATEGORIES) {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: category.slug } },
      limit: 1,
      depth: 0,
    });

    let id: number;
    if (existing.totalDocs > 0) {
      const current = existing.docs[0] as { id: number };
      id = current.id;
      await payload.update({
        collection: 'categories',
        id,
        data: { color: category.color },
      });
      for (const locale of LOCALES) {
        await payload.update({
          collection: 'categories',
          id,
          locale,
          data: {
            name: category.name[locale],
            description: category.descriptionByLocale[locale],
          },
        });
      }
      updated += 1;
    } else {
      const initial = await payload.create({
        collection: 'categories',
        locale: 'en',
        data: {
          slug: category.slug,
          color: category.color,
          name: category.name.en,
          description: category.descriptionByLocale.en,
        },
      });
      id = (initial as { id: number }).id;
      for (const locale of LOCALES.filter(l => l !== 'en')) {
        await payload.update({
          collection: 'categories',
          id,
          locale,
          data: {
            name: category.name[locale],
            description: category.descriptionByLocale[locale],
          },
        });
      }
      created += 1;
    }
    idBySlug[category.slug] = id;
  }

  return { created, updated, idBySlug };
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

interface PostSeed {
  slugBase: string;
  /** Deterministic published-at date so the listing order is stable. */
  publishedAt: string;
  authorHandle: string;
  categorySlug: string;
  tags: readonly string[];
  title: Record<Locale, string>;
  excerpt: Record<Locale, string>;
  /** Two-paragraph body — enough to drive the read-time + listing snippets. */
  bodyByLocale: Record<Locale, { headline: string; lead: string; tail: string }>;
}

const POSTS: readonly PostSeed[] = [
  {
    slugBase: 'classification-checklist',
    publishedAt: '2026-04-01T09:00:00.000Z',
    authorHandle: 'amelia-stone',
    categorySlug: 'compliance',
    tags: ['classification', 'eu', 'gdpr'],
    title: {
      en: 'A practical classification checklist for European contractors',
      pl: 'Praktyczna lista klasyfikacji dla europejskich wykonawców',
      de: 'Eine praktische Klassifizierungs-Checkliste für europäische Auftragnehmer',
      ar: 'قائمة تحقق عملية لتصنيف المقاولين الأوروبيين',
    },
    excerpt: {
      en: 'A nine-step checklist to keep contractor classification audit-ready.',
      pl: 'Dziewięciopunktowa lista, która utrzyma klasyfikację wykonawców w gotowości do audytu.',
      de: 'Eine neunstufige Checkliste, um die Klassifizierung prüfbereit zu halten.',
      ar: 'قائمة من تسع خطوات لإبقاء تصنيف المقاولين جاهزًا للتدقيق.',
    },
    bodyByLocale: {
      en: {
        headline: 'Audit-ready classification',
        lead: 'Classifying a contractor correctly is the single most common audit trigger across our European customer base. The cost of a misclassification varies by jurisdiction, but the shape of the decision is portable.',
        tail: 'This checklist distils the nine repeatable questions every team should be able to answer in writing before a new contractor signs an agreement.',
      },
      pl: {
        headline: 'Klasyfikacja gotowa do audytu',
        lead: 'Prawidłowa klasyfikacja wykonawcy to najczęstsza przyczyna audytu wśród europejskich klientów.',
        tail: 'Ta lista kontrolna sprowadza decyzję do dziewięciu powtarzalnych pytań, na które każdy zespół powinien odpowiedzieć pisemnie.',
      },
      de: {
        headline: 'Prüfbereite Klassifizierung',
        lead: 'Die korrekte Einstufung eines Auftragnehmers ist der häufigste Prüfungsanlass in unserem europäischen Kundenstamm.',
        tail: 'Diese Checkliste destilliert die Entscheidung in neun wiederkehrende Fragen.',
      },
      ar: {
        headline: 'تصنيف جاهز للتدقيق',
        lead: 'يعد التصنيف الصحيح للمقاول السبب الأكثر شيوعًا لتدقيقات الامتثال لدى عملائنا الأوروبيين.',
        tail: 'تلخص قائمة التحقق هذه القرار في تسعة أسئلة متكررة.',
      },
    },
  },
  {
    slugBase: 'invoice-intake-patterns',
    publishedAt: '2026-04-08T09:00:00.000Z',
    authorHandle: 'rashid-osman',
    categorySlug: 'operations',
    tags: ['invoicing', 'operations'],
    title: {
      en: 'Three invoice-intake patterns that actually scale',
      pl: 'Trzy wzorce odbioru faktur, które naprawdę się skalują',
      de: 'Drei Rechnungseingangs-Muster, die wirklich skalieren',
      ar: 'ثلاثة أنماط لاستلام الفواتير تتسع فعلاً',
    },
    excerpt: {
      en: 'How fast-growing teams ingest invoices without dropping audit history.',
      pl: 'Jak szybko rosnące zespoły przyjmują faktury bez utraty historii audytu.',
      de: 'Wie schnell wachsende Teams Rechnungen erfassen, ohne Audit-Daten zu verlieren.',
      ar: 'كيف تستوعب الفرق سريعة النمو الفواتير دون فقدان سجل التدقيق.',
    },
    bodyByLocale: {
      en: {
        headline: 'Three patterns',
        lead: 'Three intake patterns dominate in production: email forwarding, portal submission, and Peppol direct.',
        tail: 'Each pattern trades latency for control. The right pattern is the one that matches your finance close cadence.',
      },
      pl: {
        headline: 'Trzy wzorce',
        lead: 'Trzy wzorce dominują w produkcji: przekazywanie e-mail, zgłoszenie portalowe i Peppol bezpośredni.',
        tail: 'Każdy wzorzec to kompromis między opóźnieniem a kontrolą.',
      },
      de: {
        headline: 'Drei Muster',
        lead: 'Drei Eingangsmuster dominieren in der Produktion: E-Mail-Weiterleitung, Portal und Peppol-Direkt.',
        tail: 'Jedes Muster ist ein Kompromiss zwischen Latenz und Kontrolle.',
      },
      ar: {
        headline: 'ثلاثة أنماط',
        lead: 'تسيطر ثلاثة أنماط على بيئات الإنتاج: تحويل البريد الإلكتروني والتقديم عبر البوابة والتسليم المباشر عبر Peppol.',
        tail: 'كل نمط هو مقايضة بين زمن الاستجابة والتحكم.',
      },
    },
  },
  {
    slugBase: 'ksef-transition',
    publishedAt: '2026-04-15T09:00:00.000Z',
    authorHandle: 'amelia-stone',
    categorySlug: 'compliance',
    tags: ['ksef', 'pl', 'e-invoicing'],
    title: {
      en: 'KSeF transition: a one-page playbook',
      pl: 'Przejście na KSeF: jednostronicowy podręcznik',
      de: 'KSeF-Umstellung: ein einseitiges Playbook',
      ar: 'الانتقال إلى KSeF: دليل من صفحة واحدة',
    },
    excerpt: {
      en: 'What every Polish contractor needs in place before the KSeF cutover.',
      pl: 'Co każdy polski wykonawca musi mieć przed przełączeniem KSeF.',
      de: 'Was jeder polnische Auftragnehmer vor dem KSeF-Cutover braucht.',
      ar: 'ما يحتاجه كل مقاول بولندي قبل التحول إلى KSeF.',
    },
    bodyByLocale: {
      en: {
        headline: 'Cutover checklist',
        lead: 'KSeF flips Polish B2B invoicing onto the central platform. The cutover has a hard date.',
        tail: 'This one-page playbook lists the seven prerequisites we expect every customer to confirm before flipping the switch.',
      },
      pl: {
        headline: 'Lista kontrolna cutover',
        lead: 'KSeF przełącza fakturowanie B2B w Polsce na centralną platformę. Cutover ma sztywny termin.',
        tail: 'Ten jednostronicowy podręcznik wymienia siedem warunków wstępnych.',
      },
      de: {
        headline: 'Cutover-Checkliste',
        lead: 'KSeF schaltet die polnische B2B-Rechnungsstellung auf die zentrale Plattform um.',
        tail: 'Dieses einseitige Playbook listet die sieben Voraussetzungen auf.',
      },
      ar: {
        headline: 'قائمة التحقق للتحول',
        lead: 'يحوّل KSeF فوترة B2B البولندية إلى المنصة المركزية وفق موعد محدد.',
        tail: 'يسرد هذا الدليل المتطلبات السبعة قبل التحويل.',
      },
    },
  },
  {
    slugBase: 'sad-path-design',
    publishedAt: '2026-04-22T09:00:00.000Z',
    authorHandle: 'rashid-osman',
    categorySlug: 'operations',
    tags: ['ux', 'design', 'operations'],
    title: {
      en: 'Designing for the sad path, not the demo',
      pl: 'Projektowanie pod ścieżki błędu, nie pod demo',
      de: 'Designen für den Fehlerpfad, nicht für die Demo',
      ar: 'التصميم للمسار الفاشل، لا للعرض التوضيحي',
    },
    excerpt: {
      en: 'Why error states deserve as much craft as the success path.',
      pl: 'Dlaczego stany błędów zasługują na taką samą staranność co ścieżka sukcesu.',
      de: 'Warum Fehlerzustände dieselbe Sorgfalt verdienen wie der Glückspfad.',
      ar: 'لماذا تستحق حالات الخطأ نفس العناية التي يحظى بها مسار النجاح.',
    },
    bodyByLocale: {
      en: {
        headline: 'Sad-path craftsmanship',
        lead: 'Most demos walk the happy path. Production walks every path, every day.',
        tail: 'Design budget should be split between the success path and the four most likely failure paths — your error UI is the part real users see.',
      },
      pl: {
        headline: 'Rzemiosło ścieżek błędu',
        lead: 'Większość dem pokazuje szczęśliwą ścieżkę. Produkcja chodzi wszystkimi ścieżkami codziennie.',
        tail: 'Budżet projektowy dzielić pomiędzy sukces a cztery najbardziej prawdopodobne ścieżki błędu.',
      },
      de: {
        headline: 'Handwerk für den Fehlerpfad',
        lead: 'Die meisten Demos zeigen den glücklichen Pfad. Produktion läuft jeden Pfad, jeden Tag.',
        tail: 'Design-Budget zwischen Erfolgs- und vier Fehlerpfaden aufteilen.',
      },
      ar: {
        headline: 'حرفة المسار الفاشل',
        lead: 'تركز معظم العروض على المسار السعيد بينما تسلك بيئات الإنتاج كل المسارات يوميًا.',
        tail: 'يجب تقسيم ميزانية التصميم بين النجاح وأكثر أربع طرق فشل احتمالًا.',
      },
    },
  },
  {
    slugBase: 'observability-budget',
    publishedAt: '2026-04-29T09:00:00.000Z',
    authorHandle: 'amelia-stone',
    categorySlug: 'operations',
    tags: ['observability', 'reliability'],
    title: {
      en: 'An observability budget for small teams',
      pl: 'Budżet obserwowalności dla małych zespołów',
      de: 'Ein Observability-Budget für kleine Teams',
      ar: 'ميزانية المراقبة للفرق الصغيرة',
    },
    excerpt: {
      en: 'A two-figure budget that buys real signal for a five-person team.',
      pl: 'Dwucyfrowy budżet, który daje realny sygnał pięcioosobowemu zespołowi.',
      de: 'Ein zweistelliges Budget, das einem Fünf-Personen-Team echte Signale liefert.',
      ar: 'ميزانية من رقمين توفر إشارة حقيقية لفريق من خمسة أفراد.',
    },
    bodyByLocale: {
      en: {
        headline: 'Minimal but real signal',
        lead: 'Observability is often pitched as an enterprise concern, but small teams pay the highest opportunity cost for being blind in production.',
        tail: 'Three line items cover 80% of the value: structured logs, a synthetic probe per critical path, and one error-tracker integration.',
      },
      pl: {
        headline: 'Minimalny, ale prawdziwy sygnał',
        lead: 'Obserwowalność bywa traktowana jako problem przedsiębiorstw, ale małe zespoły płacą najwyższy koszt ślepoty produkcyjnej.',
        tail: 'Trzy pozycje zamykają 80% wartości.',
      },
      de: {
        headline: 'Minimal, aber echtes Signal',
        lead: 'Observability gilt oft als Enterprise-Thema; kleine Teams zahlen jedoch den höchsten Preis für Blindheit in Produktion.',
        tail: 'Drei Posten decken 80% des Werts ab.',
      },
      ar: {
        headline: 'إشارة حقيقية بأقل قدر',
        lead: 'كثيرًا ما تُقدَّم المراقبة كقضية مؤسسية، إلا أن الفرق الصغيرة تدفع الثمن الأكبر للعمى الإنتاجي.',
        tail: 'تغطي ثلاثة بنود 80% من القيمة.',
      },
    },
  },
];

async function upsertPosts(
  payload: Payload,
  authorIds: Record<string, number>,
  categoryIds: Record<string, number>,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const post of POSTS) {
    // Posts.slug is localized + unique. Use the en slug as the lookup key.
    const enSlug = post.slugBase;
    const existing = await payload.find({
      collection: 'posts',
      where: { slug: { equals: enSlug } },
      locale: 'en',
      limit: 1,
      depth: 0,
    });

    const baseRelations = {
      authors: [authorIds[post.authorHandle]].filter((v): v is number => typeof v === 'number'),
      categories: [categoryIds[post.categorySlug]].filter(
        (v): v is number => typeof v === 'number',
      ),
      tags: post.tags.map(tag => ({ tag })),
      status: 'published' as const,
      publishedAt: post.publishedAt,
    };

    if (existing.totalDocs > 0) {
      const current = existing.docs[0] as { id: number };
      // Update relations + status once (not per-locale).
      await payload.update({
        collection: 'posts',
        id: current.id,
        data: baseRelations,
      });
      for (const locale of LOCALES) {
        const bodyParts = post.bodyByLocale[locale];
        await payload.update({
          collection: 'posts',
          id: current.id,
          locale,
          data: {
            title: post.title[locale],
            slug: locale === 'en' ? enSlug : `${enSlug}-${locale}`,
            excerpt: post.excerpt[locale],
            body: doc(
              h1(bodyParts.headline),
              h2(post.title[locale]),
              p(bodyParts.lead),
              p(bodyParts.tail),
            ),
          },
        });
      }
      updated += 1;
    } else {
      const initialBody = post.bodyByLocale.en;
      const initial = await payload.create({
        collection: 'posts',
        locale: 'en',
        data: {
          title: post.title.en,
          slug: enSlug,
          excerpt: post.excerpt.en,
          body: doc(
            h1(initialBody.headline),
            h2(post.title.en),
            p(initialBody.lead),
            p(initialBody.tail),
          ),
          ...baseRelations,
        },
      });
      const id = (initial as { id: number }).id;
      for (const locale of LOCALES.filter(l => l !== 'en')) {
        const bodyParts = post.bodyByLocale[locale];
        await payload.update({
          collection: 'posts',
          id,
          locale,
          data: {
            title: post.title[locale],
            slug: `${enSlug}-${locale}`,
            excerpt: post.excerpt[locale],
            body: doc(
              h1(bodyParts.headline),
              h2(post.title[locale]),
              p(bodyParts.lead),
              p(bodyParts.tail),
            ),
          },
        });
      }
      created += 1;
    }
  }

  return { created, updated };
}

// ---------------------------------------------------------------------------
// LegalDocuments (only when the dedicated migrate-legal seed hasn't run)
// ---------------------------------------------------------------------------

interface LegalSeed {
  type: 'privacy' | 'terms';
  jurisdiction: 'eu' | 'gb';
  title: Record<Locale, string>;
}

const LEGAL_DOCS: readonly LegalSeed[] = [
  {
    type: 'privacy',
    jurisdiction: 'eu',
    title: {
      en: 'Privacy Notice (EU/EEA — QA placeholder)',
      pl: 'Informacja o prywatności (UE/EEA — szablon QA)',
      de: 'Datenschutzerklärung (EU/EWR — QA-Platzhalter)',
      ar: 'إشعار الخصوصية (الاتحاد الأوروبي / المنطقة الاقتصادية الأوروبية — قالب QA)',
    },
  },
  {
    type: 'privacy',
    jurisdiction: 'gb',
    title: {
      en: 'Privacy Notice (United Kingdom — QA placeholder)',
      pl: 'Informacja o prywatności (Wielka Brytania — szablon QA)',
      de: 'Datenschutzerklärung (Vereinigtes Königreich — QA-Platzhalter)',
      ar: 'إشعار الخصوصية (المملكة المتحدة — قالب QA)',
    },
  },
  {
    type: 'terms',
    jurisdiction: 'eu',
    title: {
      en: 'Terms of Service (EU/EEA — QA placeholder)',
      pl: 'Warunki świadczenia usług (UE/EEA — szablon QA)',
      de: 'Nutzungsbedingungen (EU/EWR — QA-Platzhalter)',
      ar: 'شروط الخدمة (الاتحاد الأوروبي / المنطقة الاقتصادية الأوروبية — قالب QA)',
    },
  },
  {
    type: 'terms',
    jurisdiction: 'gb',
    title: {
      en: 'Terms of Service (United Kingdom — QA placeholder)',
      pl: 'Warunki świadczenia usług (Wielka Brytania — szablon QA)',
      de: 'Nutzungsbedingungen (Vereinigtes Königreich — QA-Platzhalter)',
      ar: 'شروط الخدمة (المملكة المتحدة — قالب QA)',
    },
  },
];

async function upsertLegalDocuments(
  payload: Payload,
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of LEGAL_DOCS) {
    const existing = await payload.find({
      collection: 'legal-documents',
      where: {
        and: [{ type: { equals: entry.type } }, { jurisdiction: { equals: entry.jurisdiction } }],
      },
      limit: 1,
      depth: 0,
    });

    if (existing.totalDocs > 0) {
      // Don't clobber the canonical migrate-legal content; only the QA
      // run-once placeholders get touched.
      const current = existing.docs[0] as { id: number; title?: string };
      if (current.title?.includes('QA placeholder')) {
        for (const locale of LOCALES) {
          await payload.update({
            collection: 'legal-documents',
            id: current.id,
            locale,
            data: {
              title: entry.title[locale],
              body: doc(
                h1(entry.title[locale]),
                p('QA placeholder body — replace via migrate:legal.'),
              ),
            },
          });
        }
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const initial = await payload.create({
      collection: 'legal-documents',
      locale: 'en',
      data: {
        type: entry.type,
        jurisdiction: entry.jurisdiction,
        title: entry.title.en,
        version: 'qa-1.0.0',
        effectiveDate: '2026-01-01',
        body: doc(h1(entry.title.en), p('QA placeholder body — replace via migrate:legal.')),
      },
    });
    const id = (initial as { id: number }).id;
    for (const locale of LOCALES.filter(l => l !== 'en')) {
      await payload.update({
        collection: 'legal-documents',
        id,
        locale,
        data: {
          title: entry.title[locale],
          body: doc(h1(entry.title[locale]), p('QA placeholder body — replace via migrate:legal.')),
        },
      });
    }
    created += 1;
  }

  return { created, updated, skipped };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

async function run(): Promise<Outcome> {
  const payload = await getPayload({ config });
  const outcome: Outcome = {
    authors: { created: 0, updated: 0 },
    categories: { created: 0, updated: 0 },
    posts: { created: 0, updated: 0 },
    legalDocuments: { created: 0, updated: 0, skipped: 0 },
  };

  log.info('seed-qa: upserting authors');
  const authors = await upsertAuthors(payload);
  outcome.authors = { created: authors.created, updated: authors.updated };

  log.info('seed-qa: upserting categories');
  const categories = await upsertCategories(payload);
  outcome.categories = { created: categories.created, updated: categories.updated };

  log.info('seed-qa: upserting posts');
  outcome.posts = await upsertPosts(payload, authors.idByHandle, categories.idBySlug);

  log.info('seed-qa: upserting legal documents (QA placeholders only)');
  outcome.legalDocuments = await upsertLegalDocuments(payload);

  return outcome;
}

run()
  .then(outcome => {
    log.info(outcome, 'seed-qa complete');
    process.exit(0);
  })
  .catch(err => {
    log.error({ err }, 'seed-qa failed');
    process.exit(1);
  });
