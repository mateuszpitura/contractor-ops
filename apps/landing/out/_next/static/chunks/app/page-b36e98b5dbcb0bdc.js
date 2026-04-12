(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [450, 974],
  {
    522: (e, t, r) => {
      Promise.resolve().then(r.bind(r, 1110));
    },
    1110: (e, t, r) => {
      r.d(t, { TranslationProvider: () => u, useLocale: () => l, useTranslations: () => i });
      var n = r(1944),
        s = r(4260);
      const o = (0, s.createContext)(null);
      function u(e) {
        const { children: t, translations: r, locale: s } = e;
        return (0, n.jsx)(o, { value: { t: r, locale: s }, children: t });
      }
      function i() {
        const e = (0, s.useContext)(o);
        if (!e) throw Error("useTranslations must be used within TranslationProvider");
        return e.t;
      }
      function l() {
        const e = (0, s.useContext)(o);
        if (!e) throw Error("useLocale must be used within TranslationProvider");
        return e.locale;
      }
    },
  },
  (e) => {
    e.O(0, [179, 794, 358], () => e((e.s = 522))), (_N_E = e.O());
  },
]);
