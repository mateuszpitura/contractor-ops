(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [224],
  {
    954: (e, t, r) => {
      r.d(t, { PricingFAQ: () => m });
      var s = r(1944),
        a = r(4260),
        n = r(5015),
        o = r(1051);
      const i = (0, r(7690).A)("chevron-down", [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]]);
      var l = r(940);
      const c = [
        {
          q: "Can I start for free?",
          a: "Yes. The Starter plan is free for up to 5 contractors with no time limit. You get contractor profiles, basic onboarding checklists, invoice tracking, single-step approvals, and a full audit trail. No credit card required.",
        },
        {
          q: "What happens when my 14-day Pro trial ends?",
          a: "You’ll be downgraded to the Starter plan automatically — no charges, no surprises. All your data stays intact. You can upgrade to Pro anytime to re-enable advanced features like KSeF integration and multi-step approvals.",
        },
        {
          q: "How does per-contractor pricing work?",
          a: "You’re billed monthly for each active contractor in your system. If a contractor is offboarded or deactivated, they stop counting toward your bill at the next billing cycle. No charge for inactive records.",
        },
        {
          q: "What are credits and when do I need them?",
          a: "Credits are consumed by actions that involve third-party integrations or compute: e-signature requests (5 credits), KSeF invoice pulls (1 credit), onboarding flows (3 credits), and batch payment exports (2 credits). The Pro plan includes a monthly credit allowance. Buy extra packs if you need more — unused credits never expire.",
        },
        {
          q: "Can I switch between monthly and annual billing?",
          a: "Yes. You can switch at any time from your billing settings. When switching to annual, you’ll receive a prorated credit for the remainder of your current month. Annual plans save ~20%.",
        },
        {
          q: "Is my data safe? Where is it stored?",
          a: "All data is stored in EU data centers (AWS eu-central-1, Frankfurt). We’re GDPR-compliant by design with full data processing agreements available. All communication is encrypted in transit (TLS 1.3) and at rest (AES-256). SOC 2 Type II certification is in progress.",
        },
        {
          q: "What payment methods do you accept?",
          a: "We accept all major credit and debit cards (Visa, Mastercard, American Express) via Stripe. For Enterprise plans, we also support bank transfers and can issue proper VAT invoices through KSeF.",
        },
        {
          q: "Can I cancel anytime?",
          a: "Yes, no lock-in. Cancel from your billing settings and you’ll retain access until the end of your current billing period. Your data remains accessible for 90 days after cancellation for export.",
        },
        {
          q: "Do you offer discounts for startups or NGOs?",
          a: "Yes. We offer 50% off Pro for the first year for startups under 2 years old and registered NGOs. Contact us at hello@contractorops.com with proof of eligibility.",
        },
      ];
      function d(e) {
        const { q: t, a: r } = e,
          [n, c] = (0, a.useState)(!1);
        return (0, s.jsxs)("div", {
          className: "border-b border-border/30 last:border-b-0",
          children: [
            (0, s.jsxs)("button", {
              type: "button",
              onClick: () => {
                c((e) => {
                  const r = !e;
                  return r && l.b.capture("faq_opened", { question: t }), r;
                });
              },
              className:
                "flex w-full items-start justify-between gap-4 py-5 text-left transition-colors hover:text-primary",
              "aria-expanded": n,
              children: [
                (0, s.jsx)("span", {
                  className: "text-sm font-semibold text-foreground sm:text-base",
                  children: t,
                }),
                (0, s.jsx)(o.P.div, {
                  animate: { rotate: 180 * !!n },
                  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
                  className: "mt-0.5 shrink-0",
                  children: (0, s.jsx)(i, { className: "h-4 w-4 text-muted-foreground" }),
                }),
              ],
            }),
            (0, s.jsx)(o.P.div, {
              initial: !1,
              animate: { height: n ? "auto" : 0, opacity: +!!n },
              transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
              className: "overflow-hidden",
              children: (0, s.jsx)("p", {
                className: "pb-5 text-sm leading-relaxed text-muted-foreground pr-8",
                children: r,
              }),
            }),
          ],
        });
      }
      function m() {
        return (0, s.jsx)("section", {
          className: "relative py-28 sm:py-36",
          children: (0, s.jsxs)("div", {
            className: "mx-auto max-w-3xl px-6",
            children: [
              (0, s.jsxs)(n.Mk, {
                className: "text-center",
                children: [
                  (0, s.jsx)("p", {
                    className: "text-sm font-semibold uppercase tracking-wider text-primary",
                    children: "FAQ",
                  }),
                  (0, s.jsxs)("h2", {
                    className: "mx-auto mt-4 font-display text-display",
                    children: [
                      "Common",
                      " ",
                      (0, s.jsx)("span", { className: "gradient-text", children: "questions" }),
                    ],
                  }),
                ],
              }),
              (0, s.jsx)(n.JX, {
                className: "mt-14",
                staggerDelay: 0.06,
                children: (0, s.jsx)("div", {
                  className:
                    "rounded-2xl border border-border/50 bg-surface-1/60 px-6 sm:px-8 backdrop-blur-sm",
                  children: c.map((e) =>
                    (0, s.jsx)(n.Tc, { children: (0, s.jsx)(d, { q: e.q, a: e.a }) }, e.q),
                  ),
                }),
              }),
              (0, s.jsx)(n.Mk, {
                className: "mt-12 text-center",
                delay: 0.2,
                children: (0, s.jsxs)("p", {
                  className: "text-sm text-muted-foreground",
                  children: [
                    "Still have questions?",
                    " ",
                    (0, s.jsx)("a", {
                      href: "mailto:hello@contractorops.com",
                      className:
                        "font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80",
                      children: "Get in touch",
                    }),
                  ],
                }),
              }),
            ],
          }),
        });
      }
    },
    4129: (e, t, r) => {
      r.d(t, { PricingHero: () => x });
      var s = r(1944),
        a = r(5015),
        n = r(1898),
        o = r(7081),
        i = r(9529);
      const l = (0, r(7690).A)("arrow-left", [
        ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
        ["path", { d: "M19 12H5", key: "x3x0zl" }],
      ]);
      var c = r(7207),
        d = r(9060),
        m = r(2130);
      function x(e) {
        const { plans: t } = e,
          r = (0, i.Ym)();
        return (0, s.jsxs)("section", {
          className: "hero-mesh noise-overlay relative pt-32 pb-20 overflow-hidden",
          children: [
            (0, s.jsx)("div", {
              className: "orb orb-teal absolute -top-24 -right-32 h-[450px] w-[450px]",
            }),
            (0, s.jsx)("div", {
              className: "orb orb-amber absolute bottom-0 -left-20 h-[350px] w-[350px]",
            }),
            (0, s.jsxs)("div", {
              className: "relative z-10 mx-auto max-w-6xl px-6",
              children: [
                (0, s.jsx)(a.Mk, {
                  children: (0, s.jsxs)("a", {
                    href: "/".concat(r),
                    className:
                      "inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground mb-10",
                    children: [(0, s.jsx)(l, { className: "h-3.5 w-3.5" }), "Back to home"],
                  }),
                }),
                (0, s.jsxs)(a.Mk, {
                  className: "text-center",
                  delay: 0.1,
                  children: [
                    (0, s.jsx)("p", {
                      className: "text-sm font-semibold uppercase tracking-wider text-primary",
                      children: "Pricing",
                    }),
                    (0, s.jsxs)("h1", {
                      className:
                        "mx-auto mt-4 max-w-3xl font-display text-hero leading-[1.05] tracking-[-0.035em]",
                      children: [
                        "Choose your",
                        " ",
                        (0, s.jsx)("span", { className: "gradient-text", children: "plan" }),
                      ],
                    }),
                    (0, s.jsx)("p", {
                      className: "mx-auto mt-5 max-w-2xl text-subhead text-muted-foreground",
                      children:
                        "Start free, upgrade when you’re ready. Every plan includes a 14-day Pro trial so you can explore everything before committing.",
                    }),
                  ],
                }),
                (0, s.jsx)(a.JX, {
                  className:
                    "mt-14 grid grid-cols-1 gap-5 md:grid-cols-3 items-stretch max-w-4xl mx-auto",
                  staggerDelay: 0.1,
                  children: t.map((e) =>
                    (0, s.jsx)(
                      a.Tc,
                      {
                        children: (0, s.jsxs)("div", {
                          className:
                            "card-glow relative flex h-full flex-col rounded-2xl border bg-surface-1/70 p-7 backdrop-blur-sm ".concat(
                              e.popular ? "border-primary/40 shadow-lg" : "border-border/50",
                            ),
                          children: [
                            e.popular &&
                              (0, s.jsxs)("div", {
                                className:
                                  "absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow-md",
                                children: [
                                  (0, s.jsx)(c.A, { className: "h-3 w-3" }),
                                  "Most popular",
                                ],
                              }),
                            (0, s.jsxs)("div", {
                              className: "mb-6",
                              children: [
                                (0, s.jsx)("h3", {
                                  className: "font-display text-lg font-bold text-foreground",
                                  children: e.name,
                                }),
                                (0, s.jsxs)("div", {
                                  className: "mt-3 flex items-baseline gap-1.5",
                                  children: [
                                    (0, s.jsx)("span", {
                                      className:
                                        "font-display text-4xl font-extrabold tracking-tight text-foreground",
                                      children: (0, o.$g)(e.monthlyPrice, e.currency),
                                    }),
                                    null !== e.monthlyPrice &&
                                      e.monthlyPrice > 0 &&
                                      (0, s.jsx)("span", {
                                        className: "text-sm text-muted-foreground",
                                        children: "/ contractor / mo",
                                      }),
                                    0 === e.monthlyPrice &&
                                      (0, s.jsx)("span", {
                                        className: "text-sm text-muted-foreground",
                                        children: "up to 5 contractors",
                                      }),
                                  ],
                                }),
                                null !== e.annualPrice &&
                                  e.annualPrice > 0 &&
                                  (0, s.jsxs)("p", {
                                    className: "mt-1.5 text-xs text-muted-foreground",
                                    children: [
                                      "or ",
                                      (0, o.$g)(e.annualPrice, e.currency),
                                      "/year (save ~20%)",
                                    ],
                                  }),
                                (0, s.jsx)("p", {
                                  className: "mt-3 text-sm text-muted-foreground leading-relaxed",
                                  children: e.description,
                                }),
                              ],
                            }),
                            (0, s.jsx)("ul", {
                              className: "mb-8 flex-1 space-y-3",
                              children: e.features.map((e) =>
                                (0, s.jsxs)(
                                  "li",
                                  {
                                    className: "flex items-start gap-2.5",
                                    children: [
                                      (0, s.jsx)(d.A, {
                                        className: "mt-0.5 h-4 w-4 shrink-0 text-primary",
                                      }),
                                      (0, s.jsx)("span", {
                                        className: "text-sm text-foreground/85",
                                        children: e,
                                      }),
                                    ],
                                  },
                                  e,
                                ),
                              ),
                            }),
                            (0, s.jsx)(n.w, {
                              event: "pricing_hero_cta",
                              properties: { plan: e.name },
                              children: (0, s.jsxs)("a", {
                                href: e.ctaHref,
                                className:
                                  "group inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-[0.98] ".concat(
                                    e.popular
                                      ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                                      : "border border-border bg-surface-1 text-foreground hover:bg-muted/50",
                                  ),
                                children: [
                                  0 === e.monthlyPrice
                                    ? "Start free"
                                    : null === e.monthlyPrice
                                      ? "Talk to sales"
                                      : "Start 14-day trial",
                                  (0, s.jsx)(m.A, {
                                    className:
                                      "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                                  }),
                                ],
                              }),
                            }),
                          ],
                        }),
                      },
                      e.id,
                    ),
                  ),
                }),
                (0, s.jsx)(a.Mk, {
                  className: "mt-8 text-center",
                  delay: 0.35,
                  children: (0, s.jsx)("p", {
                    className: "text-xs text-muted-foreground/60",
                    children:
                      "Prices shown in PLN \xb7 VAT added where applicable \xb7 Cancel anytime \xb7 No lock-in",
                  }),
                }),
              ],
            }),
          ],
        });
      }
    },
    5932: (e, t, r) => {
      r.d(t, { CreditsSection: () => g });
      var s = r(1944),
        a = r(4260),
        n = r(5015),
        o = r(1898),
        i = r(7081),
        l = r(1553),
        c = r(2140),
        d = r(2230),
        m = r(7690);
      const x = (0, m.A)("send", [
          [
            "path",
            {
              d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
              key: "1ffxy3",
            },
          ],
          ["path", { d: "m21.854 2.147-10.94 10.939", key: "12cjpa" }],
        ]),
        p = (0, m.A)("zap", [
          [
            "path",
            {
              d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
              key: "1xq2db",
            },
          ],
        ]);
      var u = r(2130);
      const h = [
          {
            icon: l.A,
            action: "E-signature request",
            cost: 5,
            description: "Send a contract for signing via DocuSign",
          },
          {
            icon: c.A,
            action: "KSeF invoice pull",
            cost: 1,
            description: "Auto-fetch and match one invoice from KSeF",
          },
          {
            icon: d.A,
            action: "Onboarding flow",
            cost: 3,
            description: "Full onboarding checklist for one contractor",
          },
          {
            icon: x,
            action: "Batch payment export",
            cost: 2,
            description: "Export one batch of approved invoices",
          },
        ],
        f = [10, 25, 50, 100, 200, 500];
      function g(e) {
        const { creditPacks: t } = e,
          [r, l] = (0, a.useState)(2),
          c = f[r],
          d = (0, a.useMemo)(() => {
            var e;
            const r = Math.ceil(c * (6.5 + 0.3 * 3)),
              s = null != (e = t.find((e) => e.credits >= r)) ? e : t[t.length - 1];
            return { credits: r, pack: s };
          }, [c, t]);
        return (0, s.jsxs)("section", {
          className: "relative py-28 sm:py-36 overflow-hidden",
          children: [
            (0, s.jsx)("div", {
              className:
                "absolute inset-0 bg-gradient-to-b from-transparent via-surface-2/30 to-transparent pointer-events-none",
            }),
            (0, s.jsxs)("div", {
              className: "relative mx-auto max-w-6xl px-6",
              children: [
                (0, s.jsxs)(n.Mk, {
                  className: "text-center",
                  children: [
                    (0, s.jsx)("div", {
                      className:
                        "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-warm/10",
                      children: (0, s.jsx)(p, { className: "h-6 w-6 text-accent-warm" }),
                    }),
                    (0, s.jsx)("p", {
                      className: "text-sm font-semibold uppercase tracking-wider text-accent-warm",
                      children: "Credits & Pay-as-you-go",
                    }),
                    (0, s.jsxs)("h2", {
                      className: "mx-auto mt-4 max-w-3xl font-display text-display",
                      children: [
                        "Pay only for",
                        " ",
                        (0, s.jsx)("span", {
                          className: "gradient-text",
                          children: "what you use",
                        }),
                      ],
                    }),
                    (0, s.jsx)("p", {
                      className: "mx-auto mt-5 max-w-2xl text-lg text-muted-foreground",
                      children:
                        "Some actions consume credits — e-signatures, KSeF pulls, batch exports. Buy credit packs upfront at a discount, or pay as you go. Unused credits never expire.",
                    }),
                  ],
                }),
                (0, s.jsx)(n.JX, {
                  className: "mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
                  staggerDelay: 0.07,
                  children: h.map((e) =>
                    (0, s.jsx)(
                      n.Tc,
                      {
                        children: (0, s.jsxs)("div", {
                          className:
                            "flex flex-col items-center rounded-2xl border border-border/40 bg-surface-1/60 p-5 text-center backdrop-blur-sm",
                          children: [
                            (0, s.jsx)("div", {
                              className:
                                "flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8",
                              children: (0, s.jsx)(e.icon, { className: "h-5 w-5 text-primary" }),
                            }),
                            (0, s.jsx)("span", {
                              className:
                                "mt-3 font-display text-2xl font-bold tracking-tight text-foreground",
                              children: e.cost,
                            }),
                            (0, s.jsx)("span", {
                              className:
                                "text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold",
                              children: "credits",
                            }),
                            (0, s.jsx)("p", {
                              className: "mt-2 text-sm font-medium text-foreground",
                              children: e.action,
                            }),
                            (0, s.jsx)("p", {
                              className: "mt-1 text-xs text-muted-foreground leading-relaxed",
                              children: e.description,
                            }),
                          ],
                        }),
                      },
                      e.action,
                    ),
                  ),
                }),
                (0, s.jsx)(n.Mk, {
                  className: "mt-16",
                  delay: 0.2,
                  children: (0, s.jsx)("div", {
                    className: "glass-medium rounded-3xl p-8 sm:p-10",
                    children: (0, s.jsxs)("div", {
                      className: "flex flex-col items-center text-center",
                      children: [
                        (0, s.jsx)("h3", {
                          className:
                            "font-display text-xl font-bold tracking-tight text-foreground",
                          children: "Estimate your monthly credits",
                        }),
                        (0, s.jsx)("p", {
                          className: "mt-2 text-sm text-muted-foreground",
                          children: "Drag the slider to match your team size",
                        }),
                        (0, s.jsxs)("div", {
                          className: "mt-8 w-full max-w-md",
                          children: [
                            (0, s.jsxs)("div", {
                              className: "flex items-center justify-between mb-2",
                              children: [
                                (0, s.jsx)("span", {
                                  className: "text-xs text-muted-foreground",
                                  children: "10 contractors",
                                }),
                                (0, s.jsx)("span", {
                                  className: "text-xs text-muted-foreground",
                                  children: "500 contractors",
                                }),
                              ],
                            }),
                            (0, s.jsx)("input", {
                              type: "range",
                              min: 0,
                              max: f.length - 1,
                              value: r,
                              onChange: (e) => l(Number(e.target.value)),
                              className:
                                "w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary",
                              "aria-label": "Number of contractors",
                            }),
                            (0, s.jsxs)("div", {
                              className: "mt-4 flex items-baseline justify-center gap-2",
                              children: [
                                (0, s.jsx)("span", {
                                  className:
                                    "font-display text-4xl font-extrabold tracking-tight text-foreground",
                                  children: c,
                                }),
                                (0, s.jsx)("span", {
                                  className: "text-sm text-muted-foreground",
                                  children: "contractors",
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, s.jsxs)("div", {
                          className: "mt-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-10",
                          children: [
                            (0, s.jsxs)("div", {
                              className: "text-center",
                              children: [
                                (0, s.jsxs)("div", {
                                  className:
                                    "font-display text-3xl font-bold text-primary metric-glow",
                                  children: ["~", d.credits],
                                }),
                                (0, s.jsx)("div", {
                                  className: "text-xs text-muted-foreground mt-1",
                                  children: "credits / month",
                                }),
                              ],
                            }),
                            (0, s.jsx)("div", {
                              className: "hidden sm:block h-10 w-px bg-border/40",
                            }),
                            (0, s.jsxs)("div", {
                              className: "text-center",
                              children: [
                                (0, s.jsx)("div", {
                                  className: "font-display text-3xl font-bold text-foreground",
                                  children: (0, i.$g)(d.pack.price, d.pack.currency),
                                }),
                                (0, s.jsxs)("div", {
                                  className: "text-xs text-muted-foreground mt-1",
                                  children: [
                                    d.pack.name,
                                    " (",
                                    d.pack.credits.toLocaleString(),
                                    " credits)",
                                  ],
                                }),
                              ],
                            }),
                            (0, s.jsx)("div", {
                              className: "hidden sm:block h-10 w-px bg-border/40",
                            }),
                            (0, s.jsxs)("div", {
                              className: "text-center",
                              children: [
                                (0, s.jsx)("div", {
                                  className: "font-display text-3xl font-bold text-accent-warm",
                                  children: (0, i.$g)(d.pack.perCredit, d.pack.currency),
                                }),
                                (0, s.jsx)("div", {
                                  className: "text-xs text-muted-foreground mt-1",
                                  children: "per credit",
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  }),
                }),
                (0, s.jsx)(n.JX, {
                  className: "mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
                  staggerDelay: 0.08,
                  children: t.map((e) =>
                    (0, s.jsx)(
                      n.Tc,
                      {
                        children: (0, s.jsxs)("div", {
                          className:
                            "card-glow relative flex flex-col rounded-2xl border p-6 backdrop-blur-sm ".concat(
                              e.popular
                                ? "border-accent-warm/40 bg-accent-warm/3 shadow-lg"
                                : "border-border/50 bg-surface-1/70",
                            ),
                          children: [
                            e.popular &&
                              (0, s.jsx)("div", {
                                className:
                                  "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-warm px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-warm-foreground shadow-sm",
                                children: "Best value",
                              }),
                            (0, s.jsx)("h4", {
                              className: "font-display text-base font-bold text-foreground",
                              children: e.name,
                            }),
                            (0, s.jsxs)("div", {
                              className: "mt-3 flex items-baseline gap-1",
                              children: [
                                (0, s.jsx)("span", {
                                  className:
                                    "font-display text-3xl font-extrabold tracking-tight text-foreground",
                                  children: e.credits.toLocaleString(),
                                }),
                                (0, s.jsx)("span", {
                                  className: "text-sm text-muted-foreground",
                                  children: "credits",
                                }),
                              ],
                            }),
                            (0, s.jsx)("div", {
                              className: "mt-1 flex items-baseline gap-1",
                              children: (0, s.jsx)("span", {
                                className: "text-lg font-bold text-foreground",
                                children: (0, i.$g)(e.price, e.currency),
                              }),
                            }),
                            (0, s.jsxs)("p", {
                              className: "mt-1 text-xs text-muted-foreground",
                              children: [(0, i.$g)(e.perCredit, e.currency), " per credit"],
                            }),
                            (0, s.jsx)(o.w, {
                              event: "credit_pack_click",
                              properties: { pack: e.name, credits: e.credits },
                              className: "mt-5",
                              children: (0, s.jsxs)("a", {
                                href: e.ctaHref,
                                className:
                                  "group inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ".concat(
                                    e.popular
                                      ? "bg-accent-warm text-accent-warm-foreground shadow-md hover:bg-accent-warm/90"
                                      : "border border-border bg-surface-1 text-foreground hover:bg-muted/50",
                                  ),
                                children: [
                                  "Buy credits",
                                  (0, s.jsx)(u.A, {
                                    className:
                                      "h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5",
                                  }),
                                ],
                              }),
                            }),
                          ],
                        }),
                      },
                      e.id,
                    ),
                  ),
                }),
              ],
            }),
          ],
        });
      }
    },
    6388: (e, t, r) => {
      Promise.resolve().then(r.bind(r, 7802)),
        Promise.resolve().then(r.bind(r, 4749)),
        Promise.resolve().then(r.bind(r, 5932)),
        Promise.resolve().then(r.bind(r, 8792)),
        Promise.resolve().then(r.bind(r, 954)),
        Promise.resolve().then(r.bind(r, 4129)),
        Promise.resolve().then(r.bind(r, 1110)),
        Promise.resolve().then(r.bind(r, 8729));
    },
    8792: (e, t, r) => {
      r.d(t, { FeatureComparison: () => d });
      var s = r(1944),
        a = r(4260),
        n = r(5015),
        o = r(9060);
      const i = (0, r(7690).A)("minus", [["path", { d: "M5 12h14", key: "1ays0h" }]]),
        l = [
          {
            category: "Contractor Management",
            features: [
              { name: "Contractor profiles", starter: !0, pro: !0, enterprise: !0 },
              {
                name: "Document storage",
                starter: "100 MB",
                pro: "10 GB",
                enterprise: "Unlimited",
              },
              {
                name: "Onboarding checklists",
                starter: "Basic",
                pro: "Custom",
                enterprise: "Custom + API",
              },
              { name: "Offboarding workflows", starter: !1, pro: !0, enterprise: !0 },
              { name: "Contractor self-service portal", starter: !1, pro: !0, enterprise: !0 },
            ],
          },
          {
            category: "Contracts & Compliance",
            features: [
              {
                name: "Contract templates",
                starter: "3",
                pro: "Unlimited",
                enterprise: "Unlimited",
              },
              { name: "E-signatures (DocuSign)", starter: !1, pro: !0, enterprise: !0 },
              { name: "Version history", starter: !1, pro: !0, enterprise: !0 },
              { name: "Renewal alerts", starter: !0, pro: !0, enterprise: !0 },
              { name: "Full audit trail", starter: !0, pro: !0, enterprise: !0 },
              { name: "Custom compliance gates", starter: !1, pro: !1, enterprise: !0 },
            ],
          },
          {
            category: "Invoicing & Payments",
            features: [
              { name: "Invoice upload & tracking", starter: !0, pro: !0, enterprise: !0 },
              { name: "KSeF auto-pull", starter: !1, pro: !0, enterprise: !0 },
              { name: "Contract rate matching", starter: !1, pro: !0, enterprise: !0 },
              { name: "Discrepancy flagging", starter: !1, pro: !0, enterprise: !0 },
              { name: "Multi-step approval chains", starter: !1, pro: !0, enterprise: !0 },
              { name: "Batch payment export", starter: !1, pro: !0, enterprise: !0 },
              { name: "Payment reconciliation", starter: !1, pro: !0, enterprise: !0 },
            ],
          },
          {
            category: "Analytics & Integrations",
            features: [
              { name: "Spend dashboard", starter: "Basic", pro: "Advanced", enterprise: "Custom" },
              { name: "Budget tracking", starter: !1, pro: !0, enterprise: !0 },
              { name: "Cost breakdowns", starter: !1, pro: !0, enterprise: !0 },
              { name: "API access", starter: !1, pro: !1, enterprise: !0 },
              { name: "Webhooks", starter: !1, pro: !1, enterprise: !0 },
              { name: "Custom integrations", starter: !1, pro: !1, enterprise: !0 },
              { name: "SSO / SAML", starter: !1, pro: !1, enterprise: !0 },
            ],
          },
          {
            category: "Support",
            features: [
              { name: "Community support", starter: !0, pro: !0, enterprise: !0 },
              { name: "Email support", starter: !0, pro: !0, enterprise: !0 },
              { name: "Priority support", starter: !1, pro: !0, enterprise: !0 },
              { name: "Dedicated account manager", starter: !1, pro: !1, enterprise: !0 },
              { name: "SLA guarantee", starter: !1, pro: !1, enterprise: !0 },
              { name: "Custom onboarding", starter: !1, pro: !1, enterprise: !0 },
            ],
          },
        ];
      function c(e) {
        const { value: t } = e;
        return !0 === t
          ? (0, s.jsx)("div", {
              className: "flex items-center justify-center",
              children: (0, s.jsx)("div", {
                className: "flex h-6 w-6 items-center justify-center rounded-full bg-primary/10",
                children: (0, s.jsx)(o.A, { className: "h-3.5 w-3.5 text-primary" }),
              }),
            })
          : !1 === t
            ? (0, s.jsx)("div", {
                className: "flex items-center justify-center",
                children: (0, s.jsx)(i, { className: "h-4 w-4 text-muted-foreground/30" }),
              })
            : (0, s.jsx)("span", { className: "text-sm font-medium text-foreground", children: t });
      }
      function d() {
        return (0, s.jsxs)("section", {
          className: "relative py-28 sm:py-36 overflow-hidden",
          children: [
            (0, s.jsx)("div", {
              className:
                "absolute inset-0 bg-gradient-to-b from-transparent via-surface-2/30 to-transparent pointer-events-none",
            }),
            (0, s.jsxs)("div", {
              className: "relative mx-auto max-w-5xl px-6",
              children: [
                (0, s.jsxs)(n.Mk, {
                  className: "text-center",
                  children: [
                    (0, s.jsx)("p", {
                      className: "text-sm font-semibold uppercase tracking-wider text-primary",
                      children: "Compare plans",
                    }),
                    (0, s.jsxs)("h2", {
                      className: "mx-auto mt-4 max-w-3xl font-display text-display",
                      children: [
                        "Every feature,",
                        " ",
                        (0, s.jsx)("span", {
                          className: "gradient-text",
                          children: "side by side",
                        }),
                      ],
                    }),
                    (0, s.jsx)("p", {
                      className: "mx-auto mt-5 max-w-2xl text-lg text-muted-foreground",
                      children:
                        "See exactly what you get at each tier. No surprises, no fine print.",
                    }),
                  ],
                }),
                (0, s.jsx)(n.YE, {
                  className: "mt-16",
                  delay: 0.15,
                  children: (0, s.jsx)("div", {
                    className:
                      "overflow-x-auto rounded-2xl border border-border/50 bg-surface-1/60 backdrop-blur-sm",
                    children: (0, s.jsxs)("table", {
                      className: "w-full min-w-[640px]",
                      children: [
                        (0, s.jsx)("thead", {
                          children: (0, s.jsxs)("tr", {
                            className: "border-b border-border/40",
                            children: [
                              (0, s.jsx)("th", {
                                className:
                                  "py-5 px-6 text-left text-sm font-medium text-muted-foreground w-[40%]",
                                children: "Feature",
                              }),
                              (0, s.jsxs)("th", {
                                className: "py-5 px-4 text-center w-[20%]",
                                children: [
                                  (0, s.jsx)("div", {
                                    className: "text-sm font-bold text-foreground",
                                    children: "Starter",
                                  }),
                                  (0, s.jsx)("div", {
                                    className: "text-xs text-muted-foreground mt-0.5",
                                    children: "Free",
                                  }),
                                ],
                              }),
                              (0, s.jsxs)("th", {
                                className: "py-5 px-4 text-center w-[20%] bg-primary/3",
                                children: [
                                  (0, s.jsx)("div", {
                                    className: "text-sm font-bold text-primary",
                                    children: "Pro",
                                  }),
                                  (0, s.jsx)("div", {
                                    className: "text-xs text-muted-foreground mt-0.5",
                                    children: "PLN 49/mo",
                                  }),
                                ],
                              }),
                              (0, s.jsxs)("th", {
                                className: "py-5 px-4 text-center w-[20%]",
                                children: [
                                  (0, s.jsx)("div", {
                                    className: "text-sm font-bold text-foreground",
                                    children: "Enterprise",
                                  }),
                                  (0, s.jsx)("div", {
                                    className: "text-xs text-muted-foreground mt-0.5",
                                    children: "Custom",
                                  }),
                                ],
                              }),
                            ],
                          }),
                        }),
                        (0, s.jsx)("tbody", {
                          children: l.map((e) =>
                            (0, s.jsxs)(
                              a.Fragment,
                              {
                                children: [
                                  (0, s.jsx)("tr", {
                                    className: "border-t border-border/30",
                                    children: (0, s.jsx)("td", {
                                      colSpan: 4,
                                      className:
                                        "py-3.5 px-6 text-xs font-bold uppercase tracking-wider text-muted-foreground bg-surface-2/40",
                                      children: e.category,
                                    }),
                                  }),
                                  e.features.map((e, t) =>
                                    (0, s.jsxs)(
                                      "tr",
                                      {
                                        className:
                                          "border-t border-border/20 transition-colors hover:bg-muted/20 ".concat(
                                            t % 2 == 0 ? "" : "bg-surface-2/10",
                                          ),
                                        children: [
                                          (0, s.jsx)("td", {
                                            className: "py-3 px-6 text-sm text-foreground/85",
                                            children: e.name,
                                          }),
                                          (0, s.jsx)("td", {
                                            className: "py-3 px-4 text-center",
                                            children: (0, s.jsx)(c, { value: e.starter }),
                                          }),
                                          (0, s.jsx)("td", {
                                            className: "py-3 px-4 text-center bg-primary/3",
                                            children: (0, s.jsx)(c, { value: e.pro }),
                                          }),
                                          (0, s.jsx)("td", {
                                            className: "py-3 px-4 text-center",
                                            children: (0, s.jsx)(c, { value: e.enterprise }),
                                          }),
                                        ],
                                      },
                                      e.name,
                                    ),
                                  ),
                                ],
                              },
                              e.category,
                            ),
                          ),
                        }),
                      ],
                    }),
                  }),
                }),
              ],
            }),
          ],
        });
      }
    },
  },
  (e) => {
    e.O(0, [34, 350, 848, 151, 179, 794, 358], () => e((e.s = 6388))), (_N_E = e.O());
  },
]);
