(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [151],
  {
    940: (e, t, r) => {
      r.d(t, { PostHogProvider: () => u, b: () => s.Ay });
      var n = r(1944),
        s = r(2386),
        i = r(2234),
        a = r(4260),
        l = r(2117),
        o = r(7923);
      function c() {
        const e = (0, l.usePathname)(),
          t = (0, l.useSearchParams)(),
          r = (0, a.useRef)("");
        return (
          (0, a.useEffect)(() => {
            if (!s.Ay.__loaded) return;
            const n = "".concat(e).concat(t.toString() ? "?".concat(t.toString()) : "");
            r.current !== n && ((r.current = n), s.Ay.capture("$pageview", { $current_url: n }));
          }, [e, t]),
          null
        );
      }
      function u(e) {
        const { children: t } = e,
          r = (0, a.useRef)(!1);
        return (
          (0, a.useEffect)(() => {
            if (r.current) return;
            r.current = !0;
            const e = o.env.NEXT_PUBLIC_POSTHOG_KEY,
              t = o.env.NEXT_PUBLIC_POSTHOG_HOST;
            if (!e)
              return void console.warn(
                "[posthog] NEXT_PUBLIC_POSTHOG_KEY not set — analytics disabled",
              );
            try {
              s.Ay.init(e, {
                api_host: null != t ? t : "https://us.i.posthog.com",
                defaults: "2026-01-30",
                capture_pageview: !1,
                capture_pageleave: !0,
                autocapture: !0,
                session_recording: { recordCrossOriginIframes: !0 },
              });
            } catch (e) {}
          }, []),
          (0, n.jsxs)(i.so, {
            client: s.Ay,
            children: [(0, n.jsx)(a.Suspense, { fallback: null, children: (0, n.jsx)(c, {}) }), t],
          })
        );
      }
    },
    1110: (e, t, r) => {
      r.d(t, { TranslationProvider: () => a, useLocale: () => o, useTranslations: () => l });
      var n = r(1944),
        s = r(4260);
      const i = (0, s.createContext)(null);
      function a(e) {
        const { children: t, translations: r, locale: s } = e;
        return (0, n.jsx)(i, { value: { t: r, locale: s }, children: t });
      }
      function l() {
        const e = (0, s.useContext)(i);
        if (!e) throw Error("useTranslations must be used within TranslationProvider");
        return e.t;
      }
      function o() {
        const e = (0, s.useContext)(i);
        if (!e) throw Error("useLocale must be used within TranslationProvider");
        return e.locale;
      }
    },
    1855: (e, t, r) => {
      var n = {
        "./ar.json": [4440, 440],
        "./de.json": [2628, 628],
        "./en.json": [6731, 112],
        "./pl.json": [2279, 279],
      };
      function s(e) {
        if (!r.o(n, e))
          return Promise.resolve().then(() => {
            var t = Error("Cannot find module '" + e + "'");
            throw ((t.code = "MODULE_NOT_FOUND"), t);
          });
        var t = n[e],
          s = t[0];
        return r.e(t[1]).then(() => r.t(s, 19));
      }
      (s.keys = () => Object.keys(n)), (s.id = 1855), (e.exports = s);
    },
    1898: (e, t, r) => {
      r.d(t, { w: () => a });
      var n = r(1944),
        s = r(4260),
        i = r(940);
      function a(e) {
        const { event: t, properties: r, children: a, className: l } = e,
          o = (0, s.useCallback)(
            (e) => {
              var n, s;
              const a = e.target instanceof HTMLElement ? e.target : null;
              i.b.capture(t, {
                element_text:
                  null != (s = null == a || null == (n = a.textContent) ? void 0 : n.slice(0, 100))
                    ? s
                    : "",
                ...r,
              });
            },
            [t, r],
          );
        return (0, n.jsx)("div", { onClick: o, role: "none", className: l, children: a });
      }
    },
    4749: (e, t, r) => {
      r.d(t, { Navbar: () => f });
      var n = r(1944),
        s = r(4260),
        i = r(9956),
        a = r(4586),
        l = r(1051),
        o = r(2130),
        c = r(7784),
        u = r(8631);
      const d = [
        { label: "Features", href: "#features" },
        { label: "How it works", href: "#how-it-works" },
        { label: "Pricing", href: "#pricing" },
      ];
      function f() {
        const [e, t] = (0, s.useState)(!1),
          [r, f] = (0, s.useState)(!1),
          { scrollY: m } = (0, i.L)();
        return (
          (0, a.L)(m, "change", (e) => {
            t(e > 40);
          }),
          (0, s.useEffect)(
            () => (
              (document.body.style.overflow = r ? "hidden" : ""),
              () => {
                document.body.style.overflow = "";
              }
            ),
            [r],
          ),
          (0, s.useEffect)(() => {
            if (!r) return;
            const e = (e) => {
              "Escape" === e.key && f(!1);
            };
            return (
              document.addEventListener("keydown", e),
              () => document.removeEventListener("keydown", e)
            );
          }, [r]),
          (0, n.jsxs)(n.Fragment, {
            children: [
              (0, n.jsx)(l.P.header, {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { duration: 0.5, ease: "easeOut" },
                className: "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ".concat(
                  e ? "glass-subtle py-3" : "py-5 bg-transparent",
                ),
                children: (0, n.jsxs)("nav", {
                  className: "mx-auto flex max-w-6xl items-center justify-between px-6",
                  children: [
                    (0, n.jsxs)("a", {
                      href: "#",
                      className: "flex items-center gap-2.5 group",
                      children: [
                        (0, n.jsx)("div", {
                          className:
                            "relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-105",
                          children: (0, n.jsxs)("svg", {
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            strokeWidth: 2.2,
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            className: "h-5 w-5",
                            "aria-hidden": "true",
                            children: [
                              (0, n.jsx)("path", { d: "M12 2L2 7l10 5 10-5-10-5z" }),
                              (0, n.jsx)("path", { d: "M2 17l10 5 10-5" }),
                              (0, n.jsx)("path", { d: "M2 12l10 5 10-5" }),
                            ],
                          }),
                        }),
                        (0, n.jsxs)("span", {
                          className: "font-display text-lg font-bold tracking-tight",
                          children: [
                            "Contractor",
                            (0, n.jsx)("span", { className: "text-primary", children: "Ops" }),
                          ],
                        }),
                      ],
                    }),
                    (0, n.jsx)("div", {
                      className: "hidden items-center gap-1 md:flex",
                      children: d.map((e) =>
                        (0, n.jsx)(
                          "a",
                          {
                            href: e.href,
                            className:
                              "rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50",
                            children: e.label,
                          },
                          e.href,
                        ),
                      ),
                    }),
                    (0, n.jsxs)("div", {
                      className: "hidden items-center gap-3 md:flex",
                      children: [
                        (0, n.jsx)("a", {
                          href: "#",
                          className:
                            "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                          children: "Log in",
                        }),
                        (0, n.jsxs)("a", {
                          href: "#cta",
                          className:
                            "group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]",
                          children: [
                            "Get started",
                            (0, n.jsx)(o.A, {
                              className: "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                            }),
                          ],
                        }),
                      ],
                    }),
                    (0, n.jsx)("button", {
                      type: "button",
                      onClick: () => f(!r),
                      className:
                        "flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted/50 md:hidden",
                      "aria-label": r ? "Close menu" : "Open menu",
                      children: r
                        ? (0, n.jsx)(c.A, { className: "h-5 w-5" })
                        : (0, n.jsx)(u.A, { className: "h-5 w-5" }),
                    }),
                  ],
                }),
              }),
              r &&
                (0, n.jsxs)(l.P.div, {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  exit: { opacity: 0 },
                  className:
                    "fixed inset-0 z-40 flex flex-col bg-background/98 backdrop-blur-xl pt-24 px-6 md:hidden",
                  children: [
                    (0, n.jsx)("nav", {
                      className: "flex flex-col gap-2",
                      children: d.map((e) =>
                        (0, n.jsx)(
                          "a",
                          {
                            href: e.href,
                            onClick: () => f(!1),
                            className:
                              "rounded-xl px-4 py-3.5 text-lg font-medium text-foreground transition-colors hover:bg-muted/50",
                            children: e.label,
                          },
                          e.href,
                        ),
                      ),
                    }),
                    (0, n.jsxs)("div", {
                      className: "mt-8 flex flex-col gap-3",
                      children: [
                        (0, n.jsx)("a", {
                          href: "#",
                          className:
                            "rounded-xl border border-border px-4 py-3 text-center text-base font-medium text-foreground",
                          children: "Log in",
                        }),
                        (0, n.jsx)("a", {
                          href: "#cta",
                          onClick: () => f(!1),
                          className:
                            "rounded-xl bg-primary px-4 py-3 text-center text-base font-semibold text-primary-foreground shadow-md",
                          children: "Get started free",
                        }),
                      ],
                    }),
                  ],
                }),
            ],
          })
        );
      }
    },
    5015: (e, t, r) => {
      r.d(t, { JX: () => m, Mk: () => d, Tc: () => h, YE: () => f });
      var n = r(1944),
        s = r(1777),
        i = r(3342),
        a = r(1051),
        l = r(4260);
      const o = {
          hidden: { opacity: 0, y: 32, filter: "blur(8px)" },
          visible: { opacity: 1, y: 0, filter: "blur(0px)" },
        },
        c = {
          hidden: { opacity: 0, scale: 0.92, filter: "blur(12px)" },
          visible: { opacity: 1, scale: 1, filter: "blur(0px)" },
        },
        u = { duration: 0 };
      function d(e) {
        const { children: t, className: r, delay: c = 0, once: d = !0 } = e,
          f = (0, l.useRef)(null),
          m = (0, s.W)(f, { once: d, margin: "-80px" }),
          h = (0, i.I)();
        return (0, n.jsx)(a.P.div, {
          ref: f,
          variants: o,
          initial: h ? "visible" : "hidden",
          animate: m ? "visible" : "hidden",
          transition: h ? u : { duration: 0.7, delay: c, ease: [0.16, 1, 0.3, 1] },
          className: r,
          children: t,
        });
      }
      function f(e) {
        const { children: t, className: r, delay: o = 0, once: d = !0 } = e,
          f = (0, l.useRef)(null),
          m = (0, s.W)(f, { once: d, margin: "-80px" }),
          h = (0, i.I)();
        return (0, n.jsx)(a.P.div, {
          ref: f,
          variants: c,
          initial: h ? "visible" : "hidden",
          animate: m ? "visible" : "hidden",
          transition: h ? u : { duration: 0.8, delay: o, ease: [0.16, 1, 0.3, 1] },
          className: r,
          children: t,
        });
      }
      function m(e) {
        const { children: t, className: r, staggerDelay: o = 0.1 } = e,
          c = (0, l.useRef)(null),
          u = (0, s.W)(c, { once: !0, margin: "-60px" }),
          d = (0, i.I)();
        return (0, n.jsx)(a.P.div, {
          ref: c,
          initial: d ? "visible" : "hidden",
          animate: u ? "visible" : "hidden",
          variants: { hidden: {}, visible: { transition: d ? {} : { staggerChildren: o } } },
          className: r,
          children: t,
        });
      }
      function h(e) {
        const { children: t, className: r } = e,
          s = (0, i.I)();
        return (0, n.jsx)(a.P.div, {
          variants: o,
          transition: s ? u : { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
          className: r,
          children: t,
        });
      }
    },
    7081: (e, t, r) => {
      function n(e, t) {
        return null === e
          ? "Custom"
          : 0 === e
            ? "Free"
            : new Intl.NumberFormat("pl-PL", {
                style: "currency",
                currency: t.toUpperCase(),
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(e);
      }
      r.d(t, { $g: () => n }), r(5316), r(7923);
    },
    7802: (e, t, r) => {
      r.d(t, { SectionTracker: () => a });
      var n = r(1944),
        s = r(4260),
        i = r(940);
      function a(e) {
        const { name: t, children: r, className: a } = e,
          l = (0, s.useRef)(null),
          o = (0, s.useRef)(null),
          c = (0, s.useRef)(!1);
        return (
          (0, s.useEffect)(() => {
            const e = l.current;
            if (!e) return;
            const r = new IntersectionObserver(
              (e) => {
                const [r] = e;
                if (r.isIntersecting)
                  c.current || ((c.current = !0), i.b.capture("section_viewed", { section: t })),
                    (o.current = Date.now());
                else if (o.current) {
                  const e = Math.round((Date.now() - o.current) / 1e3);
                  i.b.capture("section_left", { section: t, dwell_seconds: e }), (o.current = null);
                }
              },
              { threshold: 0.3 },
            );
            return (
              r.observe(e),
              () => {
                r.disconnect(), (c.current = !1), (o.current = null);
              }
            );
          }, [t]),
          (0, n.jsx)("div", { ref: l, className: a, children: r })
        );
      }
    },
    9529: (e, t, r) => {
      r.d(t, { Ym: () => n.useLocale });
      var n = r(1110);
    },
  },
]);
