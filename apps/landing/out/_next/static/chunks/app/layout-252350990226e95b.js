(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [177],
  {
    762: (e) => {
      e.exports = {
        style: { fontFamily: "'Outfit', 'Outfit Fallback'", fontStyle: "normal" },
        className: "__className_1cdedc",
        variable: "__variable_1cdedc",
      };
    },
    940: (e, a, t) => {
      t.d(a, { PostHogProvider: () => _, b: () => s.Ay });
      var r = t(1944),
        s = t(2386),
        l = t(2234),
        n = t(4260),
        o = t(2117),
        c = t(7923);
      function i() {
        const e = (0, o.usePathname)(),
          a = (0, o.useSearchParams)(),
          t = (0, n.useRef)("");
        return (
          (0, n.useEffect)(() => {
            if (!s.Ay.__loaded) return;
            const r = "".concat(e).concat(a.toString() ? "?".concat(a.toString()) : "");
            t.current !== r && ((t.current = r), s.Ay.capture("$pageview", { $current_url: r }));
          }, [e, a]),
          null
        );
      }
      function _(e) {
        const { children: a } = e,
          t = (0, n.useRef)(!1);
        return (
          (0, n.useEffect)(() => {
            if (t.current) return;
            t.current = !0;
            const e = c.env.NEXT_PUBLIC_POSTHOG_KEY,
              a = c.env.NEXT_PUBLIC_POSTHOG_HOST;
            if (!e)
              return void console.warn(
                "[posthog] NEXT_PUBLIC_POSTHOG_KEY not set — analytics disabled",
              );
            try {
              s.Ay.init(e, {
                api_host: null != a ? a : "https://us.i.posthog.com",
                defaults: "2026-01-30",
                capture_pageview: !1,
                capture_pageleave: !0,
                autocapture: !0,
                session_recording: { recordCrossOriginIframes: !0 },
              });
            } catch (e) {}
          }, []),
          (0, r.jsxs)(l.so, {
            client: s.Ay,
            children: [(0, r.jsx)(n.Suspense, { fallback: null, children: (0, r.jsx)(i, {}) }), a],
          })
        );
      }
    },
    4143: (e) => {
      e.exports = {
        style: {
          fontFamily: "'Noto Sans Arabic', 'Noto Sans Arabic Fallback'",
          fontStyle: "normal",
        },
        className: "__className_2beded",
        variable: "__variable_2beded",
      };
    },
    5760: (e, a, t) => {
      Promise.resolve().then(t.bind(t, 940)),
        Promise.resolve().then(t.t.bind(t, 762, 23)),
        Promise.resolve().then(t.t.bind(t, 9588, 23)),
        Promise.resolve().then(t.t.bind(t, 6335, 23)),
        Promise.resolve().then(t.t.bind(t, 4143, 23)),
        Promise.resolve().then(t.t.bind(t, 5977, 23));
    },
    5977: () => {},
    6335: (e) => {
      e.exports = {
        style: { fontFamily: "'JetBrains Mono', 'JetBrains Mono Fallback'", fontStyle: "normal" },
        className: "__className_3c557b",
        variable: "__variable_3c557b",
      };
    },
    9588: (e) => {
      e.exports = {
        style: {
          fontFamily: "'Bricolage Grotesque', 'Bricolage Grotesque Fallback'",
          fontStyle: "normal",
        },
        className: "__className_ac327c",
        variable: "__variable_ac327c",
      };
    },
  },
  (e) => {
    e.O(0, [595, 394, 34, 350, 179, 794, 358], () => e((e.s = 5760))), (_N_E = e.O());
  },
]);
