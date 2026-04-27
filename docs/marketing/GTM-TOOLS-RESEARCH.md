# Narzędzia GTM / sprzedaż / kampanie / A/B — research (notatka)

Notatka robocza: **online, SaaS, AI** wspierające koordynację sprzedaży, dem, spotkań, kampanii i testów A/B—głównie pod **solo founder / mały zespół B2B**. Ceny i limity zmieniają się często—**weryfikuj na stronie producenta** przed zakupem.

Powiązane: [MARKETING-SALES-LAUNCH-60D.md](./MARKETING-SALES-LAUNCH-60D.md), [LANDING-AB-STRATEGIES.md](./LANDING-AB-STRATEGIES.md).

---

## 1. Schemat: jeden „hub” kontra kilka warstw

Rzadko jedno narzędzie **zastępuje wszystko** sensownie. Typowy układ:

1. **Źródło prawdy o leadzie i dealu** (CRM lub arkusz na absolutny start).  
2. **Rezerwacja spotkań** (link, kalendarz, przypomnienia).  
3. **Kampanie płatne** w panelach reklamodawców + **UTM** w linkach.  
4. **Analityka** na stronie (lejek, źródło ruchu).  
5. **A/B** (osobny skrypt / feature flag w kodzie / narzędzie no-code).  
6. **AI** raczej do **wsparcia** (copy, notatki, research), a pełna „autonomiczna sprzedaż” wymaga procesu i kontroli jakości.

---

## 2. CRM i pipeline

| Narzędzie | Krótko | Uwagi |
|-----------|--------|--------|
| [HubSpot CRM](https://www.hubspot.com/products/crm) | Darmowy tier, pipeline, zadania, formularze, ekosystem marketingowy. | Limity free tier (m.in. kontakty/branding)—sprawdź aktualnie. |
| [Pipedrive](https://www.pipedrive.com/) | Pipeline sprzedażowy „na pierwszym planie”. | Płatny; dobry, gdy głównie “deals”. |
| [Folk](https://www.folk.app/) / [Attio](https://attio.com/) | Nowsze, lżejsze relacyjne CRM. | Dla mniejszego wolumenu. |
| [Zoho Bigin](https://www.zoho.com/bigin/) | Uproszczony CRM, niski koszt. | Sensowny budżetowy. |
| [Streak](https://www.streak.com/) | CRM w Gmailu. | Gdy praca z inboxu. |
| [Less Annoying CRM](https://www.lessannoyingcrm.com/) | Bardzo proste, płaska cena. | Minimum funkcji, minimum narzutu. |
| [Capsule](https://capsulecrm.com/) | Lekki CRM, bywa free tier z limitami. | Dla “nie chcę HubSpota”. |
| [Notion](https://www.notion.so/) / [Airtable](https://www.airtable.com/) | Baza + widok lejka. | Dla developera: szybko; **ręczne** integracje. |
| [Plutio](https://www.plutio.com/) (all-in-one) | CRM + projekty, faktury, propozycje w jednym. | Często typ freelancer/agencja, nie tylko outbound. |
| Różne “AI-native CRM” (np. w rankingach) | Obiecują auto-logowanie, enrichment. | Weryfikuj integracje, prywatność, lock-in. |

**Priorytet:** jeden system: *skąd lead, etap, następny krok, data kontaktu*.

---

## 3. Spotkania, dema, rezerwacje

| Narzędzie | Rola / link |
|-----------|-------------|
| [Cal.com](https://cal.com/) | Open source, cloud lub self-host, API, embed na stronę. |
| [Calendly](https://calendly.com/) | Standard, dużo integracji kalendarza. |
| [Cal.diy](https://github.com/calcom/cal.diy) (fork) | Wariant community self-host; **własna odpowiedzialność** za bezpieczeństwo i produkcję. |
| Wbudowane linki w HubSpot itp. | Mniej narzędzi, jeśli CRM już jest centrum. |

Wideo: **Google Meet, Zoom, Microsoft Teams, Whereby**—wybierz **jedną** ścieżkę na dema.

---

## 4. Kampanie reklamowe i atrybucja

Kampanie **konfiguruje się w panelu reklamodawcy**; osobne “centrum kampanii” trzeciej strony bywa zbędne na starcie.

| Kanał | Typowo |
|-------|--------|
| [Google Ads](https://ads.google.com/) | Intencja wyszukiwania; ściśle słowa kluczowe + **negatywne** słowa. |
| [LinkedIn Campaign Manager](https://www.linkedin.com/campaignmanager/) | ICP: firma, stanowisko, geografia; zwykle wyższy CPL. |
| [Meta for Business](https://www.facebook.com/business) | Częściej retargeting / lookalike niż surowe cold B2B finanse. |

**Minimum do koordynacji:**

- UTM: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` (np. wariant LP).  
- Arkusz lub pole w CRM: *kampania → liczba leadów / rozmów* (jak w [MARKETING-SALES-LAUNCH-60D.md](./MARKETING-SALES-LAUNCH-60D.md)).  

**Analityka strony (wybierz 1 główne):**

- [PostHog](https://posthog.com/) (cloud lub self-host)  
- [Plausible](https://plausible.io/) / [Fathom](https://usefathom.com/) (privacy-friendly)  
- [Google Analytics 4](https://analytics.google.com/) (powszechny; cookies/zgody w EU według polityki)

Opcja „wiele w jednym” z CRO: [Humblytics](https://www.humblytics.com/) (w materiałach: A/B, lejki, atrybucja Stripe, AI)—sprawdź **cenę, RODO, cookies** w UE.

---

## 5. A/B i CRO (landing, nagłówki, CTA)

| Narzędzie | Uwaga |
|-----------|--------|
| [Tiny A/B Test](https://www.tinyabtest.com/) | Lekki skrypt, picker wizualny, plany od niskich kwot; bywa free tier z limitem wyświetleń. |
| [ExperimentHQ](https://www.experimenthq.io/) | Wizualne warianty, szybki start, free tier w materiałach producenta. |
| [Abify](https://abify.app/) | Lekki skrypt, warianty, AI w edycji (weryfikuj warunki i cenę). |
| [Humblytics](https://www.humblytics.com/) | A/B + analityka w jednym (wyższa cena). |
| **Kod własny** (Next.js, feature flags) | Pełna kontrola i wydajność; koszt: Twój czas. |

**Google Optimize** został **wycofany (2023)**—nie używaj starych tutoriali pod to narzędzie.

---

## 6. AI w sprzedaży — trzy nawyki (i ryzyka)

### A) AI SDR / outbound w skali (przykładowe kategorie / nazwy z rynku)

- Firmy typu: **Jeeva**, **Artisan (Ava)**, **Salesforge (Agent Frank)**, **11x**, **Vera** itd.—często: listy, e-maile, follow-up, czasem booking.  
- **Dla solo + reputacja marki:** ryzyko **niskiej jakości** leadów, **RODO/ePrivacy**, domena pod **spam** reputation. Użyteczne raczej gdy masz dedykowaną domenę, proces, **krótki** wolumen testowy, nie “milion maili”.

### B) Asystenci spotkań (transkrypcja, streszczenie)

- Kategorie: **Fireflies**, **Otter**, **wbudowane w Zoom/Meet**, itp.  
- Sprawdź **język polski** i politykę nagrań (zgoda stron, RODO).

### C) AI w CIEPŁYCH narzędziach (CRM)

- Przykłady: sugestie następnych kroków, enrichment w **Zoho (Zia)**, **HubSpot** (funkcje zależne od planu). Ułatwia, nie zastępuje Twojej decyzji ICP.

Inne: np. [Hermetic / Mia](https://www.hermetic.ai/) (SMS, eventy)—nisza; ostrożnie pod **UE** i zgodność prawną.

---

## 7. Proponowany „stack minimum” (solo, bez przepalania kasy)

1. **CRM:** HubSpot (free) *albo* Pipedrive *albo* Notion/Airtable.  
2. **Rezerwacje:** Cal.com *lub* Calendly.  
3. **Analityka** + **arkusz UTM** (albo PostHog z własnymi eventami).  
4. **A/B:** Tiny / ExperimentHQ *lub* test w repozytorium (flagi).  
5. **1 narzędzie** do notatek z dem (transkrypcja) jeśli robisz dużo rozmów.  
6. **Kampanie:** maks. **1–2** platformy reklamowe naraz (patrz [MARKETING-SALES-LAUNCH-60D.md](./MARKETING-SALES-LAUNCH-60D.md)).  

**Checklist wyboru narzędzia “na lata”:** eksport CSV/API, ewent. **DPA/UE**, integracja kalendarz ↔ CRM, **jedno** miejsce prawdy o leadzie.

---

## 8. Co celowo pominąć na wczesnym etapie

- Pakiety **G2/Clutch** płatne, **newswire** typu PR bez strategii.  
- **4 równoległe** płatne platformy reklamowe bez kogoś do optymalizacji.  
- “AI robi całą sprzedaż” bez **Twojego** ICP, skryptu i odpowiedzi w <24h.  

---

*Ostatnia aktualizacja notatki: 2026-04-27 — narzędzia i ceny w siebie się zmieniają; traktuj to jako mapę, nie cennik.*
