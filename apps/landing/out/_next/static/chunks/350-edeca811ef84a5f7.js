(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [350],
  {
    2117: (e, t, o) => {
      var n = o(2081);
      o.o(n, "usePathname") && o.d(t, { usePathname: () => n.usePathname }),
        o.o(n, "useSearchParams") && o.d(t, { useSearchParams: () => n.useSearchParams });
    },
    2234: (e, t, o) => {
      o.d(t, { so: () => s });
      var n,
        r = o(2386),
        i = o(4260),
        a = (0, i.createContext)({
          get client() {
            return n;
          },
          bootstrap: void 0,
        });
      function s(e) {
        var t,
          o,
          r = e.children,
          s = e.client,
          l = e.apiKey,
          c = e.options,
          u = (0, i.useRef)(null),
          p = (0, i.useMemo)(() => {
            if (s)
              return (
                l &&
                  console.warn(
                    "[PostHog.js] You have provided both `client` and `apiKey` to `PostHogProvider`. `apiKey` will be ignored in favour of `client`.",
                  ),
                c &&
                  console.warn(
                    "[PostHog.js] You have provided both `client` and `options` to `PostHogProvider`. `options` will be ignored in favour of `client`.",
                  ),
                s
              );
            var e = n;
            return (
              l ||
                console.warn(
                  "[PostHog.js] No `apiKey` or `client` were provided to `PostHogProvider`. Using default global `window.posthog` instance. You must initialize it manually. This is not recommended behavior.",
                ),
              e
            );
          }, [s, l, JSON.stringify(c)]);
        return (
          (0, i.useEffect)(() => {
            if (!s) {
              var e = n,
                t = u.current;
              t
                ? (l !== t.apiKey &&
                    console.warn(
                      "[PostHog.js] You have provided a different `apiKey` to `PostHogProvider` than the one that was already initialized. This is not supported by our provider and we'll keep using the previous key. If you need to toggle between API Keys you need to control the `client` yourself and pass it in as a prop rather than an `apiKey` prop.",
                    ),
                  c &&
                    !(function e(t, o, n) {
                      if ((void 0 === n && (n = new WeakMap()), t === o)) return !0;
                      if ("object" != typeof t || null === t || "object" != typeof o || null === o)
                        return !1;
                      if (n.has(t) && n.get(t) === o) return !0;
                      n.set(t, o);
                      var r = Object.keys(t),
                        i = Object.keys(o);
                      if (r.length !== i.length) return !1;
                      for (var a = 0; a < r.length; a++) {
                        var s = r[a];
                        if (!i.includes(s) || !e(t[s], o[s], n)) return !1;
                      }
                      return !0;
                    })(c, t.options) &&
                    e.set_config(c))
                : (e.__loaded &&
                    console.warn(
                      "[PostHog.js] `posthog` was already loaded elsewhere. This may cause issues.",
                    ),
                  e.init(l, c)),
                (u.current = { apiKey: l, options: null != c ? c : {} });
            }
          }, [s, l, JSON.stringify(c)]),
          i.createElement(
            a.Provider,
            {
              value: {
                client: p,
                bootstrap:
                  null != (t = null == c ? void 0 : c.bootstrap)
                    ? t
                    : null == (o = null == s ? void 0 : s.config)
                      ? void 0
                      : o.bootstrap,
              },
            },
            r,
          )
        );
      }
      var l = (e) => "function" == typeof e,
        c = (e, t) =>
          (c =
            Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array &&
              ((e, t) => {
                e.__proto__ = t;
              })) ||
            ((e, t) => {
              for (var o in t) Object.hasOwn(t, o) && (e[o] = t[o]);
            }))(e, t);
      "function" == typeof SuppressedError && SuppressedError;
      var u = { componentStack: null, exceptionEvent: null, error: null },
        p = {
          INVALID_FALLBACK:
            "[PostHog.js][PostHogErrorBoundary] Invalid fallback prop, provide a valid React element or a function that returns a valid React element.",
        };
      !((e) => {
        if ("function" != typeof e && null !== e)
          throw TypeError("Class extends value " + String(e) + " is not a constructor or null");
        function t() {
          this.constructor = o;
        }
        function o(t) {
          var o = e.call(this, t) || this;
          return (o.state = u), o;
        }
        c(o, e),
          (o.prototype = null === e ? Object.create(e) : ((t.prototype = e.prototype), new t())),
          (o.prototype.componentDidCatch = function (e, t) {
            var o,
              n = this.props.additionalProperties;
            l(n) ? (o = n(e)) : "object" == typeof n && (o = n);
            var r = this.context.client.captureException(e, o),
              i = t.componentStack;
            this.setState({ error: e, componentStack: null != i ? i : null, exceptionEvent: r });
          }),
          (o.prototype.render = function () {
            var e = this.props,
              t = e.children,
              o = e.fallback,
              n = this.state;
            if (null == n.componentStack) return l(t) ? t() : t;
            var r = l(o)
              ? i.createElement(o, {
                  error: n.error,
                  componentStack: n.componentStack,
                  exceptionEvent: n.exceptionEvent,
                })
              : o;
            return i.isValidElement(r)
              ? r
              : (console.warn(p.INVALID_FALLBACK), i.createElement(i.Fragment, null));
          }),
          (o.contextType = a);
      })(i.Component),
        (n = r.Ay);
    },
  },
]);
