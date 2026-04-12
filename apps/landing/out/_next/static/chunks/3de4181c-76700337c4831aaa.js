(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [34],
  {
    2386: (e, t, i) => {
      i.d(t, { Ay: () => nM });
      var s = "undefined" != typeof window ? window : void 0,
        r = "undefined" != typeof globalThis ? globalThis : s;
      "undefined" == typeof self && (r.self = r), "undefined" == typeof File && (r.File = () => {});
      var n = null == r ? void 0 : r.navigator,
        o = null == r ? void 0 : r.document,
        a = null == r ? void 0 : r.location,
        l = null == r ? void 0 : r.fetch,
        u =
          null != r && r.XMLHttpRequest && "withCredentials" in new r.XMLHttpRequest()
            ? r.XMLHttpRequest
            : void 0,
        c = null == r ? void 0 : r.AbortController,
        h = null == r ? void 0 : r.CompressionStream,
        d = null == n ? void 0 : n.userAgent,
        p = null != s ? s : {},
        v = "1.367.0",
        g = { DEBUG: !1, LIB_VERSION: v, LIB_NAME: "web", JS_SDK_VERSION: v };
      function _(e, t, i, s, r, n, o) {
        try {
          var a = e[n](o),
            l = a.value;
        } catch (e) {
          return void i(e);
        }
        a.done ? t(l) : Promise.resolve(l).then(s, r);
      }
      function f(e) {
        return function () {
          var i = arguments;
          return new Promise((s, r) => {
            var n = e.apply(this, i);
            function o(e) {
              _(n, s, r, o, a, "next", e);
            }
            function a(e) {
              _(n, s, r, o, a, "throw", e);
            }
            o(void 0);
          });
        };
      }
      function m() {
        return (m = Object.assign
          ? Object.assign.bind()
          : function (e) {
              for (var t = 1; arguments.length > t; t++) {
                var i = arguments[t];
                for (var s in i) Object.hasOwn(i, s) && (e[s] = i[s]);
              }
              return e;
            }).apply(null, arguments);
      }
      function y(e, t) {
        if (null == e) return {};
        var i = {};
        for (var s in e)
          if (Object.hasOwn(e, s)) {
            if (-1 !== t.indexOf(s)) continue;
            i[s] = e[s];
          }
        return i;
      }
      function b() {
        return (b = f(function* (e, t) {
          void 0 === t && (t = !0);
          try {
            var i = new Blob([e], { type: "text/plain" })
              .stream()
              .pipeThrough(new CompressionStream("gzip"));
            return yield new Response(i).blob();
          } catch (e) {
            return t && console.error("Failed to gzip compress data", e), null;
          }
        })).apply(this, arguments);
      }
      var w = [
          "$snapshot",
          "$pageview",
          "$pageleave",
          "$set",
          "survey dismissed",
          "survey sent",
          "survey shown",
          "$identify",
          "$groupidentify",
          "$create_alias",
          "$$client_ingestion_warning",
          "$web_experiment_applied",
          "$feature_enrollment_update",
          "$feature_flag_called",
        ],
        x = [
          "amazonbot",
          "amazonproductbot",
          "app.hypefactors.com",
          "applebot",
          "archive.org_bot",
          "awariobot",
          "backlinksextendedbot",
          "baiduspider",
          "bingbot",
          "bingpreview",
          "chrome-lighthouse",
          "dataforseobot",
          "deepscan",
          "duckduckbot",
          "facebookexternal",
          "facebookcatalog",
          "http://yandex.com/bots",
          "hubspot",
          "ia_archiver",
          "leikibot",
          "linkedinbot",
          "meta-externalagent",
          "mj12bot",
          "msnbot",
          "nessus",
          "petalbot",
          "pinterest",
          "prerender",
          "rogerbot",
          "screaming frog",
          "sebot-wa",
          "sitebulb",
          "slackbot",
          "slurp",
          "trendictionbot",
          "turnitin",
          "twitterbot",
          "vercel-screenshot",
          "vercelbot",
          "yahoo! slurp",
          "yandexbot",
          "zoombot",
          "bot.htm",
          "bot.php",
          "(bot;",
          "bot/",
          "crawler",
          "ahrefsbot",
          "ahrefssiteaudit",
          "semrushbot",
          "siteauditbot",
          "splitsignalbot",
          "gptbot",
          "oai-searchbot",
          "chatgpt-user",
          "perplexitybot",
          "better uptime bot",
          "sentryuptimebot",
          "uptimerobot",
          "headlesschrome",
          "cypress",
          "google-hoteladsverifier",
          "adsbot-google",
          "apis-google",
          "duplexweb-google",
          "feedfetcher-google",
          "google favicon",
          "google web preview",
          "google-read-aloud",
          "googlebot",
          "googleother",
          "google-cloudvertexbot",
          "googleweblight",
          "mediapartners-google",
          "storebot-google",
          "google-inspectiontool",
          "bytespider",
        ],
        E = (e, t) => {
          if ((void 0 === t && (t = []), !e)) return !1;
          var i = e.toLowerCase();
          return x.concat(t).some((e) => {
            var t = e.toLowerCase();
            return -1 !== i.indexOf(t);
          });
        };
      function k(e, t) {
        return -1 !== e.indexOf(t);
      }
      var S = (e) => e.trim(),
        P = (e) => e.replace(/^\$/, ""),
        R = Object.prototype,
        F = R.hasOwnProperty,
        $ = R.toString,
        T = Array.isArray || ((e) => "[object Array]" === $.call(e)),
        C = (e) => "function" == typeof e,
        I = (e) => e === Object(e) && !T(e),
        O = (e) => {
          if (I(e)) {
            for (var t in e) if (F.call(e, t)) return !1;
            return !0;
          }
          return !1;
        },
        M = (e) => void 0 === e,
        A = (e) => "[object String]" == $.call(e),
        L = (e) => A(e) && 0 === e.trim().length,
        D = (e) => M(e) || null === e,
        j = (e) => "[object Number]" == $.call(e) && e == e,
        N = (e) => j(e) && e > 0,
        q = (e) => "[object Boolean]" === $.call(e),
        U = (e) => k(w, e);
      function W(e) {
        return null === e || "object" != typeof e;
      }
      function H(e, t) {
        return {}.toString.call(e) === "[object " + t + "]";
      }
      function z(e) {
        return (
          "undefined" != typeof Event &&
          ((e, t) => {
            try {
              return e instanceof t;
            } catch (e) {
              return !1;
            }
          })(e, Event)
        );
      }
      var B = [!0, "true", 1, "1", "yes"],
        V = (e) => k(B, e),
        G = [!1, "false", 0, "0", "no"];
      function K(e, t, i, s, r) {
        return (
          t > i && (s.warn("min cannot be greater than max."), (t = i)),
          j(e)
            ? e > i
              ? (s.warn(" cannot be  greater than max: " + i + ". Using max value instead."), i)
              : t > e
                ? (s.warn(" cannot be less than min: " + t + ". Using min value instead."), t)
                : e
            : (s.warn(" must be a number. using max or fallback. max: " + i + ", fallback: " + r),
              K(r || i, t, i, s))
        );
      }
      class Y {
        constructor(e) {
          (this.Pt = {}),
            (this.Dt = e.Dt),
            (this.jt = K(e.bucketSize, 0, 100, e.qt)),
            (this.$t = K(e.refillRate, 0, this.jt, e.qt)),
            (this.Ht = K(e.refillInterval, 0, 864e5, e.qt));
        }
        Vt(e, t) {
          var i = Math.floor((t - e.lastAccess) / this.Ht);
          i > 0 &&
            ((e.tokens = Math.min(e.tokens + i * this.$t, this.jt)),
            (e.lastAccess = e.lastAccess + i * this.Ht));
        }
        consumeRateLimit(e) {
          var t,
            i = Date.now(),
            s = String(e),
            r = this.Pt[s];
          return (
            r ? this.Vt(r, i) : (this.Pt[s] = r = { tokens: this.jt, lastAccess: i }),
            0 === r.tokens ||
              (r.tokens--,
              0 === r.tokens && (null == (t = this.Dt) || t.call(this, e)),
              0 === r.tokens)
          );
        }
        stop() {
          this.Pt = {};
        }
      }
      var J,
        X,
        Z,
        Q = "Mobile",
        ee = "Android",
        et = "Tablet",
        ei = ee + " " + et,
        es = "iPad",
        er = "Apple",
        en = er + " Watch",
        eo = "Safari",
        ea = "BlackBerry",
        el = "Samsung",
        eu = el + "Browser",
        ec = el + " Internet",
        eh = "Chrome",
        ed = eh + " OS",
        ep = eh + " iOS",
        ev = "Internet Explorer",
        eg = ev + " " + Q,
        e_ = "Opera",
        ef = e_ + " Mini",
        em = "Edge",
        ey = "Microsoft " + em,
        eb = "Firefox",
        ew = eb + " iOS",
        ex = "Nintendo",
        eE = "PlayStation",
        ek = "Xbox",
        eS = ee + " " + Q,
        eP = Q + " " + eo,
        eR = "Windows",
        eF = eR + " Phone",
        e$ = "Nokia",
        eT = "Ouya",
        eC = "Generic",
        eI = eC + " " + Q.toLowerCase(),
        eO = eC + " " + et.toLowerCase(),
        eM = "Konqueror",
        eA = "(\\d+(\\.\\d+)?)",
        eL = RegExp("Version/" + eA),
        eD = RegExp(ek, "i"),
        ej = RegExp(eE + " \\w+", "i"),
        eN = RegExp(ex + " \\w+", "i"),
        eq = RegExp(ea + "|PlayBook|BB10", "i"),
        eU = {
          "NT3.51": "NT 3.11",
          "NT4.0": "NT 4.0",
          "5.0": "2000",
          5.1: "XP",
          5.2: "XP",
          "6.0": "Vista",
          6.1: "7",
          6.2: "8",
          6.3: "8.1",
          6.4: "10",
          "10.0": "10",
        },
        eW = (e, t) => {
          var i;
          return (
            (t = t || ""),
            k(e, " OPR/") && k(e, "Mini")
              ? ef
              : k(e, " OPR/")
                ? e_
                : eq.test(e)
                  ? ea
                  : k(e, "IE" + Q) || k(e, "WPDesktop")
                    ? eg
                    : k(e, eu)
                      ? ec
                      : k(e, em) || k(e, "Edg/")
                        ? ey
                        : k(e, "FBIOS")
                          ? "Facebook " + Q
                          : k(e, "UCWEB") || k(e, "UCBrowser")
                            ? "UC Browser"
                            : k(e, "CriOS")
                              ? ep
                              : k(e, "CrMo") || k(e, eh)
                                ? eh
                                : k(e, ee) && k(e, eo)
                                  ? eS
                                  : k(e, "FxiOS")
                                    ? ew
                                    : k(e.toLowerCase(), eM.toLowerCase())
                                      ? eM
                                      : ((i = t) && k(i, er)) ||
                                          (k(e, eo) && !k(e, eh) && !k(e, ee))
                                        ? k(e, Q)
                                          ? eP
                                          : eo
                                        : k(e, eb)
                                          ? eb
                                          : k(e, "MSIE") || k(e, "Trident/")
                                            ? ev
                                            : k(e, "Gecko")
                                              ? eb
                                              : ""
          );
        },
        eH = {
          [eg]: [RegExp("rv:" + eA)],
          [ey]: [RegExp(em + "?\\/" + eA)],
          [eh]: [RegExp("(" + eh + "|CrMo)\\/" + eA)],
          [ep]: [RegExp("CriOS\\/" + eA)],
          "UC Browser": [RegExp("(UCBrowser|UCWEB)\\/" + eA)],
          [eo]: [eL],
          [eP]: [eL],
          [e_]: [RegExp("(Opera|OPR)\\/" + eA)],
          [eb]: [RegExp(eb + "\\/" + eA)],
          [ew]: [RegExp("FxiOS\\/" + eA)],
          [eM]: [RegExp("Konqueror[:/]?" + eA, "i")],
          [ea]: [RegExp(ea + " " + eA), eL],
          [eS]: [RegExp("android\\s" + eA, "i")],
          [ec]: [RegExp(eu + "\\/" + eA)],
          [ev]: [RegExp("(rv:|MSIE )" + eA)],
          Mozilla: [RegExp("rv:" + eA)],
        },
        ez = (e, t) => {
          var i = eH[eW(e, t)];
          if (M(i)) return null;
          for (var s = 0; i.length > s; s++) {
            var r = e.match(i[s]);
            if (r) return parseFloat(r[r.length - 2]);
          }
          return null;
        },
        eB = [
          [RegExp(ek + "; " + ek + " (.*?)[);]", "i"), (e) => [ek, (e && e[1]) || ""]],
          [RegExp(ex, "i"), [ex, ""]],
          [RegExp(eE, "i"), [eE, ""]],
          [eq, [ea, ""]],
          [
            RegExp(eR, "i"),
            (e, t) => {
              if (/Phone/.test(t) || /WPDesktop/.test(t)) return [eF, ""];
              if (new RegExp(Q).test(t) && !/IEMobile\b/.test(t)) return [eR + " " + Q, ""];
              var i = /Windows NT ([0-9.]+)/i.exec(t);
              if (i && i[1]) {
                var s = eU[i[1]] || "";
                return /arm/i.test(t) && (s = "RT"), [eR, s];
              }
              return [eR, ""];
            },
          ],
          [
            /((iPhone|iPad|iPod).*?OS (\d+)_(\d+)_?(\d+)?|iPhone)/,
            (e) => (e && e[3] ? ["iOS", [e[3], e[4], e[5] || "0"].join(".")] : ["iOS", ""]),
          ],
          [
            /(watch.*\/(\d+\.\d+\.\d+)|watch os,(\d+\.\d+),)/i,
            (e) => {
              var t = "";
              return e && e.length >= 3 && (t = M(e[2]) ? e[3] : e[2]), ["watchOS", t];
            },
          ],
          [
            RegExp("(" + ee + " (\\d+)\\.(\\d+)\\.?(\\d+)?|" + ee + ")", "i"),
            (e) => (e && e[2] ? [ee, [e[2], e[3], e[4] || "0"].join(".")] : [ee, ""]),
          ],
          [
            /Mac OS X (\d+)[_.](\d+)[_.]?(\d+)?/i,
            (e) => {
              var t = ["Mac OS X", ""];
              return e && e[1] && (t[1] = [e[1], e[2], e[3] || "0"].join(".")), t;
            },
          ],
          [/Mac/i, ["Mac OS X", ""]],
          [/CrOS/, [ed, ""]],
          [/Linux|debian/i, ["Linux", ""]],
        ],
        eV = (e) =>
          eN.test(e)
            ? ex
            : ej.test(e)
              ? eE
              : eD.test(e)
                ? ek
                : RegExp(eT, "i").test(e)
                  ? eT
                  : RegExp("(" + eF + "|WPDesktop)", "i").test(e)
                    ? eF
                    : /iPad/.test(e)
                      ? es
                      : /iPod/.test(e)
                        ? "iPod Touch"
                        : /iPhone/.test(e)
                          ? "iPhone"
                          : /(watch)(?: ?os[,/]|\d,\d\/)[\d.]+/i.test(e)
                            ? en
                            : eq.test(e)
                              ? ea
                              : /(kobo)\s(ereader|touch)/i.test(e)
                                ? "Kobo"
                                : RegExp(e$, "i").test(e)
                                  ? e$
                                  : /(kf[a-z]{2}wi|aeo[c-r]{2})( bui|\))/i.test(e) ||
                                      /(kf[a-z]+)( bui|\)).+silk\//i.test(e)
                                    ? "Kindle Fire"
                                    : /(Android|ZTE)/i.test(e)
                                      ? (new RegExp(Q).test(e) &&
                                          !/(9138B|TB782B|Nexus [97]|pixel c|HUAWEISHT|BTV|noble nook|smart ultra 6)/i.test(
                                            e,
                                          )) ||
                                        (/pixel[\daxl ]{1,6}/i.test(e) && !/pixel c/i.test(e)) ||
                                        /(huaweimed-al00|tah-|APA|SM-G92|i980|zte|U304AA)/i.test(
                                          e,
                                        ) ||
                                        (/lmy47v/i.test(e) && !/QTAQZ3/i.test(e))
                                        ? ee
                                        : ei
                                      : RegExp("(pda|" + Q + ")", "i").test(e)
                                        ? eI
                                        : RegExp(et, "i").test(e) &&
                                            !RegExp(et + " pc", "i").test(e)
                                          ? eO
                                          : "",
        eG = (e) => e instanceof Error;
      class eK {
        constructor(e, t, i) {
          void 0 === i && (i = []),
            (this.coercers = e),
            (this.stackParser = t),
            (this.modifiers = i);
        }
        buildFromUnknown(e, t) {
          void 0 === t && (t = {});
          var i = (t && t.mechanism) || { handled: !0, type: "generic" },
            s = this.buildCoercingContext(i, t, 0).apply(e),
            r = this.buildParsingContext(t),
            n = this.parseStacktrace(s, r);
          return { $exception_list: this.convertToExceptionList(n, i), $exception_level: "error" };
        }
        modifyFrames(e) {
          var t = this;
          return f(function* () {
            for (var i of e)
              i.stacktrace &&
                i.stacktrace.frames &&
                T(i.stacktrace.frames) &&
                (i.stacktrace.frames = yield t.applyModifiers(i.stacktrace.frames));
            return e;
          })();
        }
        coerceFallback(e) {
          var t;
          return {
            type: "Error",
            value: "Unknown error",
            stack: null == (t = e.syntheticException) ? void 0 : t.stack,
            synthetic: !0,
          };
        }
        parseStacktrace(e, t) {
          var i, s;
          return (
            null != e.cause && (i = this.parseStacktrace(e.cause, t)),
            "" != e.stack &&
              null != e.stack &&
              (s = this.applyChunkIds(
                this.stackParser(e.stack, e.synthetic ? t.skipFirstLines : 0),
                t.chunkIdMap,
              )),
            m({}, e, { cause: i, stack: s })
          );
        }
        applyChunkIds(e, t) {
          return e.map((e) => (e.filename && t && (e.chunk_id = t[e.filename]), e));
        }
        applyCoercers(e, t) {
          for (var i of this.coercers) if (i.match(e)) return i.coerce(e, t);
          return this.coerceFallback(t);
        }
        applyModifiers(e) {
          var t = this;
          return f(function* () {
            var i = e;
            for (var s of t.modifiers) i = yield s(i);
            return i;
          })();
        }
        convertToExceptionList(e, t) {
          var i,
            s,
            r,
            n = {
              type: e.type,
              value: e.value,
              mechanism: {
                type: null != (i = t.type) ? i : "generic",
                handled: null == (s = t.handled) || s,
                synthetic: null != (r = e.synthetic) && r,
              },
            };
          e.stack && (n.stacktrace = { type: "raw", frames: e.stack });
          var o = [n];
          return (
            null != e.cause &&
              o.push(...this.convertToExceptionList(e.cause, m({}, t, { handled: !0 }))),
            o
          );
        }
        buildParsingContext(e) {
          var t;
          return {
            chunkIdMap: ((e) => {
              var t = globalThis._posthogChunkIds;
              if (t) {
                var i = Object.keys(t);
                return (
                  (Z && i.length === X) ||
                    ((X = i.length),
                    (Z = i.reduce((i, s) => {
                      J || (J = {});
                      var r = J[s];
                      if (r) i[r[0]] = r[1];
                      else
                        for (var n = e(s), o = n.length - 1; o >= 0; o--) {
                          var a = n[o],
                            l = null == a ? void 0 : a.filename,
                            u = t[s];
                          if (l && u) {
                            (i[l] = u), (J[s] = [l, u]);
                            break;
                          }
                        }
                      return i;
                    }, {}))),
                  Z
                );
              }
            })(this.stackParser),
            skipFirstLines: null != (t = e.skipFirstLines) ? t : 1,
          };
        }
        buildCoercingContext(e, t, i) {
          void 0 === i && (i = 0);
          var s = (i, s) => {
            if (4 >= s) {
              var r = this.buildCoercingContext(e, t, s);
              return this.applyCoercers(i, r);
            }
          };
          return m({}, t, {
            syntheticException: 0 == i ? t.syntheticException : void 0,
            mechanism: e,
            apply: (e) => s(e, i),
            next: (e) => s(e, i + 1),
          });
        }
      }
      function eY(e, t, i, s, r) {
        var n = { platform: e, filename: t, function: "<anonymous>" === i ? "?" : i, in_app: !0 };
        return M(s) || (n.lineno = s), M(r) || (n.colno = r), n;
      }
      var eJ = (e, t) => {
          var i = -1 !== e.indexOf("safari-extension"),
            s = -1 !== e.indexOf("safari-web-extension");
          return i || s
            ? [
                -1 !== e.indexOf("@") ? e.split("@")[0] : "?",
                i ? "safari-extension:" + t : "safari-web-extension:" + t,
              ]
            : [e, t];
        },
        eX = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i,
        eZ =
          /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i,
        eQ = /\((\S*)(?::(\d+))(?::(\d+))\)/,
        e0 = (e, t) => {
          var i = eX.exec(e);
          if (i) {
            var [, s, r, n] = i;
            return eY(t, s, "?", +r, +n);
          }
          var o = eZ.exec(e);
          if (o) {
            if (o[2] && 0 === o[2].indexOf("eval")) {
              var a = eQ.exec(o[2]);
              a && ((o[2] = a[1]), (o[3] = a[2]), (o[4] = a[3]));
            }
            var [l, u] = eJ(o[1] || "?", o[2]);
            return eY(t, u, l, o[3] ? +o[3] : void 0, o[4] ? +o[4] : void 0);
          }
        },
        e1 =
          /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i,
        e2 = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i,
        e3 = (e, t) => {
          var i = e1.exec(e);
          if (i) {
            if (i[3] && i[3].indexOf(" > eval") > -1) {
              var s = e2.exec(i[3]);
              s && ((i[1] = i[1] || "eval"), (i[3] = s[1]), (i[4] = s[2]), (i[5] = ""));
            }
            var r = i[3],
              n = i[1] || "?";
            return ([n, r] = eJ(n, r)), eY(t, r, n, i[4] ? +i[4] : void 0, i[5] ? +i[5] : void 0);
          }
        },
        e5 = /\(error: (.*)\)/;
      class e6 {
        match(e) {
          return this.isDOMException(e) || this.isDOMError(e);
        }
        coerce(e, t) {
          var i = A(e.stack);
          return {
            type: this.getType(e),
            value: this.getValue(e),
            stack: i ? e.stack : void 0,
            cause: e.cause ? t.next(e.cause) : void 0,
            synthetic: !1,
          };
        }
        getType(e) {
          return this.isDOMError(e) ? "DOMError" : "DOMException";
        }
        getValue(e) {
          var t = e.name || (this.isDOMError(e) ? "DOMError" : "DOMException");
          return e.message ? t + ": " + e.message : t;
        }
        isDOMException(e) {
          return H(e, "DOMException");
        }
        isDOMError(e) {
          return H(e, "DOMError");
        }
      }
      class e8 {
        match(e) {
          return e instanceof Error;
        }
        coerce(e, t) {
          return {
            type: this.getType(e),
            value: this.getMessage(e, t),
            stack: this.getStack(e),
            cause: e.cause ? t.next(e.cause) : void 0,
            synthetic: !1,
          };
        }
        getType(e) {
          return e.name || e.constructor.name;
        }
        getMessage(e, t) {
          var i = e.message;
          return String(i.error && "string" == typeof i.error.message ? i.error.message : i);
        }
        getStack(e) {
          return e.stacktrace || e.stack || void 0;
        }
      }
      class e4 {
        constructor() {}
        match(e) {
          return H(e, "ErrorEvent") && null != e.error;
        }
        coerce(e, t) {
          var i;
          return (
            t.apply(e.error) || {
              type: "ErrorEvent",
              value: e.message,
              stack: null == (i = t.syntheticException) ? void 0 : i.stack,
              synthetic: !0,
            }
          );
        }
      }
      var e7 =
        /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i;
      class e9 {
        match(e) {
          return "string" == typeof e;
        }
        coerce(e, t) {
          var i,
            [s, r] = this.getInfos(e);
          return {
            type: null != s ? s : "Error",
            value: null != r ? r : e,
            stack: null == (i = t.syntheticException) ? void 0 : i.stack,
            synthetic: !0,
          };
        }
        getInfos(e) {
          var t = "Error",
            i = e,
            s = e.match(e7);
          return s && ((t = s[1]), (i = s[2])), [t, i];
        }
      }
      var te = ["fatal", "error", "warning", "log", "info", "debug"];
      function tt(e, t) {
        void 0 === t && (t = 40);
        var i = Object.keys(e);
        if ((i.sort(), !i.length)) return "[object has no keys]";
        for (var s = i.length; s > 0; s--) {
          var r = i.slice(0, s).join(", ");
          if (t >= r.length) return s === i.length ? r : r.length > t ? r.slice(0, t) + "..." : r;
        }
        return "";
      }
      class ti {
        match(e) {
          return "object" == typeof e && null !== e;
        }
        coerce(e, t) {
          var i,
            s = this.getErrorPropertyFromObject(e);
          return s
            ? t.apply(s)
            : {
                type: this.getType(e),
                value: this.getValue(e),
                stack: null == (i = t.syntheticException) ? void 0 : i.stack,
                level: this.isSeverityLevel(e.level) ? e.level : "error",
                synthetic: !0,
              };
        }
        getType(e) {
          return z(e) ? e.constructor.name : "Error";
        }
        getValue(e) {
          if ("name" in e && "string" == typeof e.name) {
            var t = "'" + e.name + "' captured as exception";
            return (
              "message" in e &&
                "string" == typeof e.message &&
                (t += " with message: '" + e.message + "'"),
              t
            );
          }
          if ("message" in e && "string" == typeof e.message) return e.message;
          var i = this.getObjectClassName(e);
          return (
            (i && "Object" !== i ? "'" + i + "'" : "Object") +
            " captured as exception with keys: " +
            tt(e)
          );
        }
        isSeverityLevel(e) {
          return A(e) && !L(e) && te.indexOf(e) >= 0;
        }
        getErrorPropertyFromObject(e) {
          for (var t in e)
            if (Object.hasOwn(e, t)) {
              var i = e[t];
              if (eG(i)) return i;
            }
        }
        getObjectClassName(e) {
          try {
            var t = Object.getPrototypeOf(e);
            return t ? t.constructor.name : void 0;
          } catch (e) {
            return;
          }
        }
      }
      class ts {
        match(e) {
          return z(e);
        }
        coerce(e, t) {
          var i,
            s = e.constructor.name;
          return {
            type: s,
            value: s + " captured as exception with keys: " + tt(e),
            stack: null == (i = t.syntheticException) ? void 0 : i.stack,
            synthetic: !0,
          };
        }
      }
      class tr {
        match(e) {
          return W(e);
        }
        coerce(e, t) {
          var i;
          return {
            type: "Error",
            value: "Primitive value captured as exception: " + String(e),
            stack: null == (i = t.syntheticException) ? void 0 : i.stack,
            synthetic: !0,
          };
        }
      }
      class tn {
        match(e) {
          return H(e, "PromiseRejectionEvent") || this.isCustomEventWrappingRejection(e);
        }
        isCustomEventWrappingRejection(e) {
          if (!z(e)) return !1;
          try {
            var t = e.detail;
            return null != t && "object" == typeof t && "reason" in t;
          } catch (e) {
            return !1;
          }
        }
        coerce(e, t) {
          var i,
            s = this.getUnhandledRejectionReason(e);
          return W(s)
            ? {
                type: "UnhandledRejection",
                value: "Non-Error promise rejection captured with value: " + String(s),
                stack: null == (i = t.syntheticException) ? void 0 : i.stack,
                synthetic: !0,
              }
            : t.apply(s);
        }
        getUnhandledRejectionReason(e) {
          try {
            if ("reason" in e) return e.reason;
            if (
              "detail" in e &&
              null != e.detail &&
              "object" == typeof e.detail &&
              "reason" in e.detail
            )
              return e.detail.reason;
          } catch (e) {}
          return e;
        }
      }
      var to = (e, t) => {
          var { debugEnabled: i } = void 0 === t ? {} : t,
            r = {
              C(t) {
                if (s && (g.DEBUG || p.POSTHOG_DEBUG || i) && !M(s.console) && s.console) {
                  for (
                    var r =
                        ("__rrweb_original__" in s.console[t])
                          ? s.console[t].__rrweb_original__
                          : s.console[t],
                      n = arguments.length,
                      o = Array(n > 1 ? n - 1 : 0),
                      a = 1;
                    n > a;
                    a++
                  )
                    o[a - 1] = arguments[a];
                  r(e, ...o);
                }
              },
              info() {
                for (var e = arguments.length, t = Array(e), i = 0; e > i; i++) t[i] = arguments[i];
                r.C("log", ...t);
              },
              warn() {
                for (var e = arguments.length, t = Array(e), i = 0; e > i; i++) t[i] = arguments[i];
                r.C("warn", ...t);
              },
              error() {
                for (var e = arguments.length, t = Array(e), i = 0; e > i; i++) t[i] = arguments[i];
                r.C("error", ...t);
              },
              critical() {
                for (var t = arguments.length, i = Array(t), s = 0; t > s; s++) i[s] = arguments[s];
                console.error(e, ...i);
              },
              uninitializedWarning(e) {
                r.error("You must initialize PostHog before calling " + e);
              },
              createLogger: (t, i) => to(e + " " + t, i),
            };
          return r;
        },
        ta = to("[PostHog.js]"),
        tl = ta.createLogger,
        tu = tl("[ExternalScriptsLoader]"),
        tc = (e, t, i) => {
          if (e.config.disable_external_dependency_loading)
            return (
              tu.warn(t + " was requested but loading of external scripts is disabled."),
              i("Loading of external scripts is disabled")
            );
          var s = null == o ? void 0 : o.querySelectorAll("script");
          if (s) {
            for (var r, n = 0; s.length > n; n++)
              if (
                (r = (() => {
                  if (s[n].src === t) {
                    var e = s[n];
                    return e.__posthog_loading_callback_fired
                      ? { v: i() }
                      : (e.addEventListener("load", (t) => {
                          (e.__posthog_loading_callback_fired = !0), i(void 0, t);
                        }),
                        (e.onerror = (e) => i(e)),
                        { v: void 0 });
                  }
                })())
              )
                return r.v;
          }
          var a = () => {
            if (!o) return i("document not found");
            var s = o.createElement("script");
            if (
              ((s.type = "text/javascript"),
              (s.crossOrigin = "anonymous"),
              (s.src = t),
              (s.onload = (e) => {
                (s.__posthog_loading_callback_fired = !0), i(void 0, e);
              }),
              (s.onerror = (e) => i(e)),
              e.config.prepare_external_dependency_script &&
                (s = e.config.prepare_external_dependency_script(s)),
              !s)
            )
              return i("prepare_external_dependency_script returned null");
            if ("head" === e.config.external_scripts_inject_target) o.head.appendChild(s);
            else {
              var r,
                n = o.querySelectorAll("body > script");
              n.length > 0
                ? null == (r = n[0].parentNode) || r.insertBefore(s, n[0])
                : o.body.appendChild(s);
            }
          };
          null != o && o.body ? a() : null == o || o.addEventListener("DOMContentLoaded", a);
        };
      (p.__PosthogExtensions__ = p.__PosthogExtensions__ || {}),
        (p.__PosthogExtensions__.loadExternalDependency = (e, t, i) => {
          if ("remote-config" !== t)
            if (e._resolvedSdkVersion) {
              var s = e.requestRouter.endpointFor(
                "assets",
                "/static/" + e._resolvedSdkVersion + "/" + t + ".js",
              );
              tc(e, s, i);
            } else {
              var r = "/static/" + t + ".js?v=" + e.version;
              "toolbar" === t && (r = r + "&t=" + 3e5 * Math.floor(Date.now() / 3e5));
              var n = e.requestRouter.endpointFor("assets", r);
              tc(e, n, i);
            }
          else {
            var o = e.requestRouter.endpointFor(
              "assets",
              "/array/" + e.config.token + "/config.js",
            );
            tc(e, o, i);
          }
        }),
        (p.__PosthogExtensions__.loadSiteApp = (e, t, i) => {
          var s = e.requestRouter.endpointFor("api", t);
          tc(e, s, i);
        });
      var th = "$people_distinct_id",
        td = "$device_id",
        tp = "__alias",
        tv = "__timers",
        tg = "$autocapture_disabled_server_side",
        t_ = "$heatmaps_enabled_server_side",
        tf = "$exception_capture_enabled_server_side",
        tm = "$error_tracking_suppression_rules",
        ty = "$error_tracking_capture_extension_exceptions",
        tb = "$web_vitals_enabled_server_side",
        tw = "$dead_clicks_enabled_server_side",
        tx = "$product_tours_enabled_server_side",
        tE = "$web_vitals_allowed_metrics",
        tk = "$session_recording_remote_config",
        tS = "$sesid",
        tP = "$session_is_sampled",
        tR = "$enabled_feature_flags",
        tF = "$early_access_features",
        t$ = "$feature_flag_details",
        tT = "$stored_person_properties",
        tC = "$stored_group_properties",
        tI = "$surveys",
        tO = "$flag_call_reported",
        tM = "$flag_call_reported_session_id",
        tA = "$feature_flag_errors",
        tL = "$feature_flag_evaluated_at",
        tD = "$user_state",
        tj = "$client_session_props",
        tN = "$capture_rate_limit",
        tq = "$initial_campaign_params",
        tU = "$initial_referrer_info",
        tW = "$initial_person_info",
        tH = "$epp",
        tz = "__POSTHOG_TOOLBAR__",
        tB = "$posthog_cookieless",
        tV = [
          th,
          tp,
          "__cmpns",
          tv,
          "$session_recording_enabled_server_side",
          t_,
          tS,
          tR,
          tm,
          tD,
          tF,
          t$,
          tC,
          tT,
          tI,
          tO,
          tM,
          tA,
          tL,
          tj,
          tN,
          tq,
          tU,
          tH,
          tW,
        ],
        tG = "PostHog loadExternalDependency extension not found.",
        tK = "on_reject",
        tY = "always",
        tJ = "anonymous",
        tX = "identified",
        tZ = "identified_only",
        tQ = "visibilitychange",
        t0 = "beforeunload",
        t1 = "$pageview",
        t2 = "$pageleave",
        t3 = "$identify",
        t5 = "$groupidentify";
      function t6(e, t) {
        T(e) && e.forEach(t);
      }
      function t8(e, t) {
        if (!D(e))
          if (T(e)) e.forEach(t);
          else if (e instanceof FormData) e.forEach((e, i) => t(e, i));
          else for (var i in e) F.call(e, i) && t(e[i], i);
      }
      var t4 = function (e) {
        for (var t = arguments.length, i = Array(t > 1 ? t - 1 : 0), s = 1; t > s; s++)
          i[s - 1] = arguments[s];
        for (var r of i) for (var n in r) void 0 !== r[n] && (e[n] = r[n]);
        return e;
      };
      function t7(e) {
        for (var t = Object.keys(e), i = t.length, s = Array(i); i--; ) s[i] = [t[i], e[t[i]]];
        return s;
      }
      var t9 = (e) => {
          try {
            return e();
          } catch (e) {
            return;
          }
        },
        ie = (e) =>
          function () {
            try {
              for (var t = arguments.length, i = Array(t), s = 0; t > s; s++) i[s] = arguments[s];
              return e.apply(this, i);
            } catch (e) {
              ta.critical(
                "Implementation error. Please turn on debug mode and open a ticket on https://app.posthog.com/home#panel=support%3Asupport%3A.",
              ),
                ta.critical(e);
            }
          },
        it = (e) => {
          var t = {};
          return (
            t8(e, (e, i) => {
              ((A(e) && e.length > 0) || j(e)) && (t[i] = e);
            }),
            t
          );
        },
        ii = ["herokuapp.com", "vercel.app", "netlify.app"];
      function is(e, t, i, s) {
        var { capture: r = !1, passive: n = !0 } = null != s ? s : {};
        null == e || e.addEventListener(t, i, { capture: r, passive: n });
      }
      function ir(e) {
        return "ph_toolbar_internal" === e.name;
      }
      Math.trunc || (Math.trunc = (e) => (0 > e ? Math.ceil(e) : Math.floor(e))),
        Number.isInteger || (Number.isInteger = (e) => j(e) && isFinite(e) && Math.floor(e) === e);
      class io {
        constructor(e) {
          if (((this.bytes = e), 16 !== e.length)) throw TypeError("not 128-bit length");
        }
        static fromFieldsV7(e, t, i, s) {
          if (
            !Number.isInteger(e) ||
            !Number.isInteger(t) ||
            !Number.isInteger(i) ||
            !Number.isInteger(s) ||
            0 > e ||
            0 > t ||
            0 > i ||
            0 > s ||
            e > 0xffffffffffff ||
            t > 4095 ||
            i > 0x3fffffff ||
            s > 0xffffffff
          )
            throw RangeError("invalid field value");
          var r = new Uint8Array(16);
          return (
            (r[0] = e / 0x10000000000),
            (r[1] = e / 0x100000000),
            (r[2] = e / 0x1000000),
            (r[3] = e / 65536),
            (r[4] = e / 256),
            (r[5] = e),
            (r[6] = 112 | (t >>> 8)),
            (r[7] = t),
            (r[8] = 128 | (i >>> 24)),
            (r[9] = i >>> 16),
            (r[10] = i >>> 8),
            (r[11] = i),
            (r[12] = s >>> 24),
            (r[13] = s >>> 16),
            (r[14] = s >>> 8),
            (r[15] = s),
            new io(r)
          );
        }
        toString() {
          for (var e = "", t = 0; this.bytes.length > t; t++)
            (e = e + (this.bytes[t] >>> 4).toString(16) + (15 & this.bytes[t]).toString(16)),
              (3 !== t && 5 !== t && 7 !== t && 9 !== t) || (e += "-");
          if (36 !== e.length) throw Error("Invalid UUIDv7 was generated");
          return e;
        }
        clone() {
          return new io(this.bytes.slice(0));
        }
        equals(e) {
          return 0 === this.compareTo(e);
        }
        compareTo(e) {
          for (var t = 0; 16 > t; t++) {
            var i = this.bytes[t] - e.bytes[t];
            if (0 !== i) return Math.sign(i);
          }
          return 0;
        }
      }
      class ia {
        constructor() {
          (this.I = 0), (this.S = 0), (this.k = new ic());
        }
        generate() {
          var e = this.generateOrAbort();
          if (M(e)) {
            this.I = 0;
            var t = this.generateOrAbort();
            if (M(t)) throw Error("Could not generate UUID after timestamp reset");
            return t;
          }
          return e;
        }
        generateOrAbort() {
          var e = Date.now();
          if (e > this.I) (this.I = e), this.A();
          else {
            if (this.I >= e + 1e4) return;
            this.S++, this.S > 0x3ffffffffff && (this.I++, this.A());
          }
          return io.fromFieldsV7(
            this.I,
            Math.trunc(this.S / 0x40000000),
            0x3fffffff & this.S,
            this.k.nextUint32(),
          );
        }
        A() {
          this.S = 1024 * this.k.nextUint32() + (1023 & this.k.nextUint32());
        }
      }
      var il,
        iu = (e) => {
          if ("undefined" != typeof UUIDV7_DENY_WEAK_RNG && UUIDV7_DENY_WEAK_RNG)
            throw Error("no cryptographically strong RNG available");
          for (var t = 0; e.length > t; t++)
            e[t] = 65536 * Math.trunc(65536 * Math.random()) + Math.trunc(65536 * Math.random());
          return e;
        };
      s && !M(s.crypto) && crypto.getRandomValues && (iu = (e) => crypto.getRandomValues(e));
      class ic {
        constructor() {
          (this.T = new Uint32Array(8)), (this.N = 1 / 0);
        }
        nextUint32() {
          return this.T.length > this.N || (iu(this.T), (this.N = 0)), this.T[this.N++];
        }
      }
      var ih = () => id().toString(),
        id = () => (il || (il = new ia())).generate(),
        ip = "",
        iv = /[a-z0-9][a-z0-9-]+\.[a-z]{2,}$/i,
        ig = {
          Yt: () => !!o,
          Ut(e) {
            ta.error("cookieStore error: " + e);
          },
          Wt(e) {
            if (o) {
              try {
                for (
                  var t = e + "=", i = o.cookie.split(";").filter((e) => e.length), s = 0;
                  i.length > s;
                  s++
                ) {
                  for (var r = i[s]; " " == r.charAt(0); ) r = r.substring(1, r.length);
                  if (0 === r.indexOf(t))
                    return decodeURIComponent(r.substring(t.length, r.length));
                }
              } catch (e) {}
              return null;
            }
          },
          Gt(e) {
            var t;
            try {
              t = JSON.parse(ig.Wt(e)) || {};
            } catch (e) {}
            return t;
          },
          Xt(e, t, i, s, r) {
            if (o)
              try {
                var n = "",
                  a = "",
                  l = ((e, t) => {
                    if (t) {
                      var i = ((e, t) => {
                        if ((void 0 === t && (t = o), ip)) return ip;
                        if (!t || ["localhost", "127.0.0.1"].includes(e)) return "";
                        for (
                          var i = e.split("."), s = Math.min(i.length, 8), r = "dmn_chk_" + ih();
                          !ip && s--;
                        ) {
                          var n = i.slice(s).join("."),
                            a = r + "=1;domain=." + n + ";path=/";
                          (t.cookie = a + ";max-age=3"),
                            t.cookie.includes(r) && ((t.cookie = a + ";max-age=0"), (ip = n));
                        }
                        return ip;
                      })(e);
                      if (!i) {
                        var s,
                          r = (s = e.match(iv)) ? s[0] : "";
                        r !== i && ta.info("Warning: cookie subdomain discovery mismatch", r, i),
                          (i = r);
                      }
                      return i ? "; domain=." + i : "";
                    }
                    return "";
                  })(o.location.hostname, s);
                if (i) {
                  var u = new Date();
                  u.setTime(u.getTime() + 864e5 * i), (n = "; expires=" + u.toUTCString());
                }
                r && (a = "; secure");
                var c =
                  e +
                  "=" +
                  encodeURIComponent(JSON.stringify(t)) +
                  n +
                  "; SameSite=Lax; path=/" +
                  l +
                  a;
                return (
                  c.length > 3686.4 &&
                    ta.warn("cookieStore warning: large cookie, len=" + c.length),
                  (o.cookie = c),
                  c
                );
              } catch (e) {
                return;
              }
          },
          Jt(e, t) {
            if (null != o && o.cookie)
              try {
                ig.Xt(e, "", -1, t);
              } catch (e) {
                return;
              }
          },
        },
        i_ = null,
        im = {
          Yt() {
            if (null !== i_) return i_;
            var e = !0;
            if (M(s)) e = !1;
            else
              try {
                var t = "__mplssupport__";
                im.Xt(t, "xyz"), '"xyz"' !== im.Wt(t) && (e = !1), im.Jt(t);
              } catch (t) {
                e = !1;
              }
            return (
              e || ta.error("localStorage unsupported; falling back to cookie store"), (i_ = e), e
            );
          },
          Ut(e) {
            ta.error("localStorage error: " + e);
          },
          Wt(e) {
            try {
              return null == s ? void 0 : s.localStorage.getItem(e);
            } catch (e) {
              im.Ut(e);
            }
            return null;
          },
          Gt(e) {
            try {
              return JSON.parse(im.Wt(e)) || {};
            } catch (e) {}
            return null;
          },
          Xt(e, t) {
            try {
              null == s || s.localStorage.setItem(e, JSON.stringify(t));
            } catch (e) {
              im.Ut(e);
            }
          },
          Jt(e) {
            try {
              null == s || s.localStorage.removeItem(e);
            } catch (e) {
              im.Ut(e);
            }
          },
        },
        iy = [td, "distinct_id", tS, tP, tH, tW, tD],
        ib = {},
        iw = {
          Yt: () => !0,
          Ut(e) {
            ta.error("memoryStorage error: " + e);
          },
          Wt: (e) => ib[e] || null,
          Gt: (e) => ib[e] || null,
          Xt(e, t) {
            ib[e] = t;
          },
          Jt(e) {
            delete ib[e];
          },
        },
        ix = null,
        iE = {
          Yt() {
            if (null !== ix) return ix;
            if (((ix = !0), M(s))) ix = !1;
            else
              try {
                var e = "__support__";
                iE.Xt(e, "xyz"), '"xyz"' !== iE.Wt(e) && (ix = !1), iE.Jt(e);
              } catch (e) {
                ix = !1;
              }
            return ix;
          },
          Ut(e) {
            ta.error("sessionStorage error: ", e);
          },
          Wt(e) {
            try {
              return null == s ? void 0 : s.sessionStorage.getItem(e);
            } catch (e) {
              iE.Ut(e);
            }
            return null;
          },
          Gt(e) {
            try {
              return JSON.parse(iE.Wt(e)) || null;
            } catch (e) {}
            return null;
          },
          Xt(e, t) {
            try {
              null == s || s.sessionStorage.setItem(e, JSON.stringify(t));
            } catch (e) {
              iE.Ut(e);
            }
          },
          Jt(e) {
            try {
              null == s || s.sessionStorage.removeItem(e);
            } catch (e) {
              iE.Ut(e);
            }
          },
        };
      class ik {
        constructor(e) {
          this._instance = e;
        }
        get Rt() {
          return this._instance.config;
        }
        get consent() {
          return this.Kt() ? 0 : this.Qt;
        }
        isOptedOut() {
          return (
            this.Rt.cookieless_mode === tY ||
            0 === this.consent ||
            (-1 === this.consent &&
              (this.Rt.opt_out_capturing_by_default || this.Rt.cookieless_mode === tK))
          );
        }
        isOptedIn() {
          return !this.isOptedOut();
        }
        isExplicitlyOptedOut() {
          return 0 === this.consent;
        }
        optInOut(e) {
          this.tr.Xt(
            this.er,
            +!!e,
            this.Rt.cookie_expiration,
            this.Rt.cross_subdomain_cookie,
            this.Rt.secure_cookie,
          );
        }
        reset() {
          this.tr.Jt(this.er, this.Rt.cross_subdomain_cookie);
        }
        get er() {
          var {
            token: e,
            opt_out_capturing_cookie_prefix: t,
            consent_persistence_name: i,
          } = this._instance.config;
          return i || (t ? t + e : "__ph_opt_in_out_" + e);
        }
        get Qt() {
          var e = this.tr.Wt(this.er);
          return V(e) ? 1 : k(G, e) ? 0 : -1;
        }
        get tr() {
          var e = this.Rt.opt_out_capturing_persistence_type,
            t = "localStorage" === e ? im : ig;
          if (!this.rr || this.rr !== t) {
            this.rr = t;
            var i = "localStorage" === e ? ig : im;
            i.Wt(this.er) &&
              (this.rr.Wt(this.er) || this.optInOut(V(i.Wt(this.er))),
              i.Jt(this.er, this.Rt.cross_subdomain_cookie));
          }
          return this.rr;
        }
        Kt() {
          return (
            !!this.Rt.respect_dnt &&
            [
              null == n ? void 0 : n.doNotTrack,
              null == n ? void 0 : n.msDoNotTrack,
              p.doNotTrack,
            ].some((e) => V(e))
          );
        }
      }
      var iS = tl("[Dead Clicks]"),
        iP = () => !0,
        iR = (e) => {
          var t,
            i = !(null == (t = e.instance.persistence) || !t.get_property(tw)),
            s = e.instance.config.capture_dead_clicks;
          return q(s) ? s : !!I(s) || i;
        };
      class iF {
        get lazyLoadedDeadClicksAutocapture() {
          return this.ir;
        }
        constructor(e, t, i) {
          (this.instance = e),
            (this.isEnabled = t),
            (this.onCapture = i),
            this.startIfEnabledOrStop();
        }
        onRemoteConfig(e) {
          "captureDeadClicks" in e &&
            (this.instance.persistence &&
              this.instance.persistence.register({ [tw]: e.captureDeadClicks }),
            this.startIfEnabledOrStop());
        }
        startIfEnabledOrStop() {
          this.isEnabled(this)
            ? this.nr(() => {
                this.sr();
              })
            : this.stop();
        }
        nr(e) {
          var t, i;
          null != (t = p.__PosthogExtensions__) && t.initDeadClicksAutocapture && e(),
            null == (i = p.__PosthogExtensions__) ||
              null == i.loadExternalDependency ||
              i.loadExternalDependency(this.instance, "dead-clicks-autocapture", (t) => {
                t ? iS.error("failed to load script", t) : e();
              });
        }
        sr() {
          var e;
          if (o) {
            if (!this.ir && null != (e = p.__PosthogExtensions__) && e.initDeadClicksAutocapture) {
              var t = I(this.instance.config.capture_dead_clicks)
                ? this.instance.config.capture_dead_clicks
                : {};
              (t.__onCapture = this.onCapture),
                (this.ir = p.__PosthogExtensions__.initDeadClicksAutocapture(this.instance, t)),
                this.ir.start(o),
                iS.info("starting...");
            }
          } else iS.error("`document` not found. Cannot start.");
        }
        stop() {
          this.ir && (this.ir.stop(), (this.ir = void 0), iS.info("stopping..."));
        }
      }
      var i$ = tl("[SegmentIntegration]"),
        iT = "posthog-js";
      function iC(e, t) {
        var {
          organization: i,
          projectId: s,
          prefix: r,
          severityAllowList: n = ["error"],
          sendExceptionsToPostHog: o = !0,
        } = void 0 === t ? {} : t;
        return (t) => {
          if (("*" !== n && !n.includes(t.level)) || !e.__loaded) return t;
          t.tags || (t.tags = {});
          var a = e.requestRouter.endpointFor(
            "ui",
            "/project/" + e.config.token + "/person/" + e.get_distinct_id(),
          );
          (t.tags["PostHog Person URL"] = a),
            e.sessionRecordingStarted() &&
              (t.tags["PostHog Recording URL"] = e.get_session_replay_url({ withTimestamp: !0 }));
          var l,
            u,
            c,
            h,
            d,
            p,
            v = (null == (l = t.exception) ? void 0 : l.values) || [],
            g = v.map((e) =>
              m({}, e, {
                stacktrace: e.stacktrace
                  ? m({}, e.stacktrace, {
                      type: "raw",
                      frames: (e.stacktrace.frames || []).map((e) =>
                        m({}, e, { platform: "web:javascript" }),
                      ),
                    })
                  : void 0,
              }),
            ),
            _ = {
              $exception_message: (null == (u = v[0]) ? void 0 : u.value) || t.message,
              $exception_type: null == (c = v[0]) ? void 0 : c.type,
              $exception_level: t.level,
              $exception_list: g,
              $sentry_event_id: t.event_id,
              $sentry_exception: t.exception,
              $sentry_exception_message: (null == (h = v[0]) ? void 0 : h.value) || t.message,
              $sentry_exception_type: null == (d = v[0]) ? void 0 : d.type,
              $sentry_tags: t.tags,
            };
          return (
            i &&
              s &&
              (_.$sentry_url =
                (r || "https://sentry.io/organizations/") +
                i +
                "/issues/?project=" +
                s +
                "&query=" +
                t.event_id),
            o && (null == (p = e.exceptions) || p.sendExceptionEvent(_)),
            t
          );
        };
      }
      class iI {
        constructor(e, t, i, s, r, n) {
          (this.name = iT),
            (this.setupOnce = (o) => {
              o(
                iC(e, {
                  organization: t,
                  projectId: i,
                  prefix: s,
                  severityAllowList: r,
                  sendExceptionsToPostHog: null == n || n,
                }),
              );
            });
        }
      }
      class iO {
        constructor(e) {
          (this.ar = (e, t, i) => {
            i &&
              (i.noSessionId || i.activityTimeout || i.sessionPastMaximumLength) &&
              (ta.info("[PageViewManager] Session rotated, clearing pageview state", {
                sessionId: e,
                changeReason: i,
              }),
              (this.lr = void 0),
              this._instance.scrollManager.resetContext());
          }),
            (this._instance = e),
            this.ur();
        }
        ur() {
          var e;
          this.hr = null == (e = this._instance.sessionManager) ? void 0 : e.onSessionId(this.ar);
        }
        destroy() {
          var e;
          null == (e = this.hr) || e.call(this), (this.hr = void 0);
        }
        doPageView(e, t) {
          var i,
            r = this.cr(e, t);
          return (
            (this.lr = {
              pathname: null != (i = null == s ? void 0 : s.location.pathname) ? i : "",
              pageViewId: t,
              timestamp: e,
            }),
            this._instance.scrollManager.resetContext(),
            r
          );
        }
        doPageLeave(e) {
          var t;
          return this.cr(e, null == (t = this.lr) ? void 0 : t.pageViewId);
        }
        doEvent() {
          var e;
          return { $pageview_id: null == (e = this.lr) ? void 0 : e.pageViewId };
        }
        cr(e, t) {
          var i = this.lr;
          if (!i) return { $pageview_id: t };
          var s = { $pageview_id: t, $prev_pageview_id: i.pageViewId },
            r = this._instance.scrollManager.getContext();
          if (r && !this._instance.config.disable_scroll_properties) {
            var {
              maxScrollHeight: n,
              lastScrollY: o,
              maxScrollY: a,
              maxContentHeight: l,
              lastContentY: u,
              maxContentY: c,
            } = r;
            if (!(M(n) || M(o) || M(a) || M(l) || M(u) || M(c))) {
              (n = Math.ceil(n)),
                (o = Math.ceil(o)),
                (a = Math.ceil(a)),
                (l = Math.ceil(l)),
                (u = Math.ceil(u)),
                (c = Math.ceil(c));
              var h = n > 1 ? K(o / n, 0, 1, ta) : 1,
                d = n > 1 ? K(a / n, 0, 1, ta) : 1,
                p = l > 1 ? K(u / l, 0, 1, ta) : 1,
                v = l > 1 ? K(c / l, 0, 1, ta) : 1;
              s = t4(s, {
                $prev_pageview_last_scroll: o,
                $prev_pageview_last_scroll_percentage: h,
                $prev_pageview_max_scroll: a,
                $prev_pageview_max_scroll_percentage: d,
                $prev_pageview_last_content: u,
                $prev_pageview_last_content_percentage: p,
                $prev_pageview_max_content: c,
                $prev_pageview_max_content_percentage: v,
              });
            }
          }
          return (
            i.pathname && (s.$prev_pageview_pathname = i.pathname),
            i.timestamp &&
              (s.$prev_pageview_duration = (e.getTime() - i.timestamp.getTime()) / 1e3),
            s
          );
        }
      }
      var iM = (e) => {
          var t = null == o ? void 0 : o.createElement("a");
          return M(t) ? null : ((t.href = e), t);
        },
        iA = (e, t) => {
          for (
            var i,
              s = ((e.split("#")[0] || "").split(/\?(.*)/)[1] || "")
                .replace(/^\?+/g, "")
                .split("&"),
              r = 0;
            s.length > r;
            r++
          ) {
            var n = s[r].split("=");
            if (n[0] === t) {
              i = n;
              break;
            }
          }
          if (!T(i) || 2 > i.length) return "";
          var o = i[1];
          try {
            o = decodeURIComponent(o);
          } catch (e) {
            ta.error("Skipping decoding for malformed query param: " + o);
          }
          return o.replace(/\+/g, " ");
        },
        iL = (e, t, i) => {
          if (!e || !t || !t.length) return e;
          for (
            var s = e.split("#"),
              r = s[1],
              n = (s[0] || "").split("?"),
              o = n[1],
              a = n[0],
              l = (o || "").split("&"),
              u = [],
              c = 0;
            l.length > c;
            c++
          ) {
            var h = l[c].split("=");
            T(h) && (t.includes(h[0]) ? u.push(h[0] + "=" + i) : u.push(l[c]));
          }
          var d = a;
          return null != o && (d += "?" + u.join("&")), null != r && (d += "#" + r), d;
        },
        iD = (e, t) => {
          var i = e.match(RegExp(t + "=([^&]*)"));
          return i ? i[1] : null;
        },
        ij = "https?://(.*)",
        iN = [
          "gclid",
          "gclsrc",
          "dclid",
          "gbraid",
          "wbraid",
          "fbclid",
          "msclkid",
          "twclid",
          "li_fat_id",
          "igshid",
          "ttclid",
          "rdt_cid",
          "epik",
          "qclid",
          "sccid",
          "irclid",
          "_kx",
        ],
        iq = [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_content",
          "utm_term",
          "gad_source",
          "mc_cid",
          ...iN,
        ],
        iU = "<masked>",
        iW = ["li_fat_id"];
      function iH(e, t, i) {
        if (!o) return {};
        var s,
          r = t ? [...iN, ...(i || [])] : [],
          n = iz(iL(o.URL, r, iU), e);
        return t4(
          ((s = {}),
          t8(iW, (e) => {
            var t = ig.Wt(e);
            s[e] = t || null;
          }),
          s),
          n,
        );
      }
      function iz(e, t) {
        var i = iq.concat(t || []),
          s = {};
        return (
          t8(i, (t) => {
            var i = iA(e, t);
            s[t] = i || null;
          }),
          s
        );
      }
      function iB(e) {
        var t = e
            ? 0 === e.search(ij + "google.([^/?]*)")
              ? "google"
              : 0 === e.search(ij + "bing.com")
                ? "bing"
                : 0 === e.search(ij + "yahoo.com")
                  ? "yahoo"
                  : 0 === e.search(ij + "duckduckgo.com")
                    ? "duckduckgo"
                    : null
            : null,
          i = {};
        if (null !== t) {
          i.$search_engine = t;
          var s = o ? iA(o.referrer, "yahoo" != t ? "q" : "p") : "";
          s.length && (i.ph_keyword = s);
        }
        return i;
      }
      function iV() {
        return navigator.language || navigator.userLanguage;
      }
      var iG = "$direct";
      function iK() {
        return (null == o ? void 0 : o.referrer) || iG;
      }
      function iY(e, t) {
        var i = e ? [...iN, ...(t || [])] : [],
          s = null == a ? void 0 : a.href.substring(0, 1e3);
        return { r: iK().substring(0, 1e3), u: s ? iL(s, i, iU) : void 0 };
      }
      function iJ(e) {
        var t,
          { r: i, u: s } = e,
          r = {
            $referrer: i,
            $referring_domain:
              null == i ? void 0 : i == iG ? iG : null == (t = iM(i)) ? void 0 : t.host,
          };
        if (s) {
          r.$current_url = s;
          var n = iM(s);
          (r.$host = null == n ? void 0 : n.host),
            (r.$pathname = null == n ? void 0 : n.pathname),
            t4(r, iz(s));
        }
        return i && t4(r, iB(i)), r;
      }
      function iX() {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (e) {
          return;
        }
      }
      var iZ = ["cookie", "localstorage", "localstorage+cookie", "sessionstorage", "memory"];
      class iQ {
        constructor(e, t) {
          (this.Rt = e),
            (this.props = {}),
            (this.dr = !1),
            (this.vr = ((e) => {
              var t = "";
              return (
                e.token &&
                  (t = e.token.replace(/\+/g, "PL").replace(/\//g, "SL").replace(/=/g, "EQ")),
                e.persistence_name ? "ph_" + e.persistence_name : "ph_" + t + "_posthog"
              );
            })(e)),
            (this.tr = this.pr(e)),
            this.load(),
            e.debug && ta.info("Persistence loaded", e.persistence, m({}, this.props)),
            this.update_config(e, e, t),
            this.save();
        }
        isDisabled() {
          return !!this.gr;
        }
        pr(e) {
          -1 === iZ.indexOf(e.persistence.toLowerCase()) &&
            (ta.critical(
              "Unknown persistence type " + e.persistence + "; falling back to localStorage+cookie",
            ),
            (e.persistence = "localStorage+cookie"));
          var t,
            i,
            r =
              (void 0 === (t = e.cookie_persisted_properties || []) && (t = []),
              (i = [...iy, ...t]),
              m({}, im, {
                Gt(e) {
                  try {
                    var t = {};
                    try {
                      t = ig.Gt(e) || {};
                    } catch (e) {}
                    var i = t4(t, JSON.parse(im.Wt(e) || "{}"));
                    return im.Xt(e, i), i;
                  } catch (e) {}
                  return null;
                },
                Xt(e, t, s, r, n, o) {
                  try {
                    im.Xt(e, t, void 0, void 0, o);
                    var a = {};
                    i.forEach((e) => {
                      t[e] && (a[e] = t[e]);
                    }),
                      Object.keys(a).length && ig.Xt(e, a, s, r, n, o);
                  } catch (e) {
                    im.Ut(e);
                  }
                },
                Jt(e, t) {
                  try {
                    null == s || s.localStorage.removeItem(e), ig.Jt(e, t);
                  } catch (e) {
                    im.Ut(e);
                  }
                },
              })),
            n = e.persistence.toLowerCase();
          return "localstorage" === n && im.Yt()
            ? im
            : "localstorage+cookie" === n && r.Yt()
              ? r
              : "sessionstorage" === n && iE.Yt()
                ? iE
                : "memory" === n
                  ? iw
                  : "cookie" === n
                    ? ig
                    : r.Yt()
                      ? r
                      : ig;
        }
        mr(e) {
          var t = null != e ? e : this.Rt.feature_flag_cache_ttl_ms;
          if (!t || 0 >= t) return !1;
          var i = this.props[tL];
          return !i || "number" != typeof i || Date.now() - i > t;
        }
        properties() {
          var e = {};
          return (
            t8(this.props, (t, i) => {
              if (i === tR && I(t)) {
                if (!this.mr())
                  for (var s = Object.keys(t), r = 0; s.length > r; r++)
                    e["$feature/" + s[r]] = t[s[r]];
              } else -1 === tV.indexOf(i) && (e[i] = t);
            }),
            e
          );
        }
        load() {
          if (!this.gr) {
            var e = this.tr.Gt(this.vr);
            e && (this.props = t4({}, e));
          }
        }
        save() {
          this.gr || this.tr.Xt(this.vr, this.props, this.yr, this.br, this.wr, this.Rt.debug);
        }
        remove() {
          this.tr.Jt(this.vr, !1), this.tr.Jt(this.vr, !0);
        }
        clear() {
          this.remove(), (this.props = {});
        }
        register_once(e, t, i) {
          if (I(e)) {
            M(t) && (t = "None"), (this.yr = M(i) ? this._r : i);
            var s = !1;
            if (
              (t8(e, (e, i) => {
                (Object.hasOwn(this.props, i) && this.props[i] !== t) ||
                  ((this.props[i] = e), (s = !0));
              }),
              s)
            )
              return this.save(), !0;
          }
          return !1;
        }
        register(e, t) {
          if (I(e)) {
            this.yr = M(t) ? this._r : t;
            var i = !1;
            if (
              (t8(e, (t, s) => {
                Object.hasOwn(e, s) && this.props[s] !== t && ((this.props[s] = t), (i = !0));
              }),
              i)
            )
              return this.save(), !0;
          }
          return !1;
        }
        unregister(e) {
          e in this.props && (delete this.props[e], this.save());
        }
        update_campaign_params() {
          if (!this.dr) {
            var e = iH(
              this.Rt.custom_campaign_params,
              this.Rt.mask_personal_data_properties,
              this.Rt.custom_personal_data_properties,
            );
            O(it(e)) || this.register(e), (this.dr = !0);
          }
        }
        update_search_keyword() {
          var e;
          this.register((e = null == o ? void 0 : o.referrer) ? iB(e) : {});
        }
        update_referrer_info() {
          var e;
          this.register_once(
            {
              $referrer: iK(),
              $referring_domain:
                (null != o && o.referrer && (null == (e = iM(o.referrer)) ? void 0 : e.host)) || iG,
            },
            void 0,
          );
        }
        set_initial_person_info() {
          this.props[tq] ||
            this.props[tU] ||
            this.register_once(
              {
                [tW]: iY(
                  this.Rt.mask_personal_data_properties,
                  this.Rt.custom_personal_data_properties,
                ),
              },
              void 0,
            );
        }
        get_initial_props() {
          var e = {};
          t8([tU, tq], (t) => {
            var i = this.props[t];
            i &&
              t8(i, (t, i) => {
                e["$initial_" + P(i)] = t;
              });
          });
          var t,
            i,
            s = this.props[tW];
          return (
            s &&
              t4(
                e,
                ((t = iJ(s)),
                (i = {}),
                t8(t, (e, t) => {
                  i["$initial_" + P(t)] = e;
                }),
                i),
              ),
            e
          );
        }
        safe_merge(e) {
          return (
            t8(this.props, (t, i) => {
              i in e || (e[i] = t);
            }),
            e
          );
        }
        update_config(e, t, i) {
          if (
            ((this._r = this.yr = e.cookie_expiration),
            this.set_disabled(e.disable_persistence || !!i),
            this.set_cross_subdomain(e.cross_subdomain_cookie),
            this.set_secure(e.secure_cookie),
            e.persistence !== t.persistence ||
              !((e, t) => {
                if (e.length !== t.length) return !1;
                var i = [...e].sort(),
                  s = [...t].sort();
                return i.every((e, t) => e === s[t]);
              })(e.cookie_persisted_properties || [], t.cookie_persisted_properties || []))
          ) {
            var s = this.pr(e),
              r = this.props;
            this.clear(), (this.tr = s), (this.props = r), this.save();
          }
        }
        set_disabled(e) {
          (this.gr = e), this.gr ? this.remove() : this.save();
        }
        set_cross_subdomain(e) {
          e !== this.br && ((this.br = e), this.remove(), this.save());
        }
        set_secure(e) {
          e !== this.wr && ((this.wr = e), this.remove(), this.save());
        }
        set_event_timer(e, t) {
          var i = this.props[tv] || {};
          (i[e] = t), (this.props[tv] = i), this.save();
        }
        remove_event_timer(e) {
          var t = (this.props[tv] || {})[e];
          return M(t) || (delete this.props[tv][e], this.save()), t;
        }
        get_property(e) {
          return this.props[e];
        }
        set_property(e, t) {
          (this.props[e] = t), this.save();
        }
      }
      var i0 = { Activation: "events", Cancellation: "cancelEvents" },
        i1 = { Popover: "popover", API: "api", Widget: "widget" },
        i2 = { SHOWN: "survey shown", DISMISSED: "survey dismissed", SENT: "survey sent" },
        i3 = {
          SURVEY_ID: "$survey_id",
          SURVEY_ITERATION: "$survey_iteration",
          SURVEY_LAST_SEEN_DATE: "$survey_last_seen_date",
        },
        i5 = { Popover: "popover", Inline: "inline" },
        i6 = { SHOWN: "product tour shown" },
        i8 = {
          TOUR_LAST_SEEN_DATE: "$product_tour_last_seen_date",
          TOUR_TYPE: "$product_tour_type",
        },
        i4 = tl("[RateLimiter]");
      class i7 {
        constructor(e) {
          (this.serverLimits = {}),
            (this.lastEventRateLimited = !1),
            (this.checkForLimiting = (e) => {
              var t = e.text;
              if (t && t.length)
                try {
                  (JSON.parse(t).quota_limited || []).forEach((e) => {
                    i4.info((e || "events") + " is quota limited."),
                      (this.serverLimits[e] = new Date().getTime() + 6e4);
                  });
                } catch (e) {
                  return void i4.warn(
                    'could not rate limit - continuing. Error: "' +
                      (null == e ? void 0 : e.message) +
                      '"',
                    { text: t },
                  );
                }
            }),
            (this.instance = e),
            (this.lastEventRateLimited = this.clientRateLimitContext(!0).isRateLimited);
        }
        get captureEventsPerSecond() {
          var e;
          return (
            (null == (e = this.instance.config.rate_limiting) ? void 0 : e.events_per_second) || 10
          );
        }
        get captureEventsBurstLimit() {
          var e;
          return Math.max(
            (null == (e = this.instance.config.rate_limiting) ? void 0 : e.events_burst_limit) ||
              10 * this.captureEventsPerSecond,
            this.captureEventsPerSecond,
          );
        }
        clientRateLimitContext(e) {
          void 0 === e && (e = !1);
          var t,
            i,
            s,
            { captureEventsBurstLimit: r, captureEventsPerSecond: n } = this,
            o = new Date().getTime(),
            a =
              null != (t = null == (i = this.instance.persistence) ? void 0 : i.get_property(tN))
                ? t
                : { tokens: r, last: o };
          (a.tokens += ((o - a.last) / 1e3) * n), (a.last = o), a.tokens > r && (a.tokens = r);
          var l = 1 > a.tokens;
          return (
            l || e || (a.tokens = Math.max(0, a.tokens - 1)),
            !l ||
              this.lastEventRateLimited ||
              e ||
              this.instance.capture(
                "$$client_ingestion_warning",
                {
                  $$client_ingestion_warning_message:
                    "posthog-js client rate limited. Config is set to " +
                    n +
                    " events per second and " +
                    r +
                    " events burst limit.",
                },
                { skip_client_rate_limiting: !0 },
              ),
            (this.lastEventRateLimited = l),
            null == (s = this.instance.persistence) || s.set_property(tN, a),
            { isRateLimited: l, remainingTokens: a.tokens }
          );
        }
        isServerRateLimited(e) {
          var t = this.serverLimits[e || "events"] || !1;
          return !1 !== t && new Date().getTime() < t;
        }
      }
      var i9 = tl("[RemoteConfig]");
      class se {
        constructor(e) {
          this._instance = e;
        }
        get remoteConfig() {
          var e;
          return null == (e = p._POSTHOG_REMOTE_CONFIG) ||
            null == (e = e[this._instance.config.token])
            ? void 0
            : e.config;
        }
        Ir(e) {
          var t, i;
          null != (t = p.__PosthogExtensions__) && t.loadExternalDependency
            ? null == (i = p.__PosthogExtensions__) ||
              null == i.loadExternalDependency ||
              i.loadExternalDependency(this._instance, "remote-config", () => e(this.remoteConfig))
            : e();
        }
        Cr(e) {
          this._instance._send_request({
            method: "GET",
            url: this._instance.requestRouter.endpointFor(
              "assets",
              "/array/" + this._instance.config.token + "/config",
            ),
            callback(t) {
              e(t.json);
            },
          });
        }
        load() {
          try {
            if (this.remoteConfig)
              return (
                i9.info("Using preloaded remote config", this.remoteConfig),
                this.Sr(this.remoteConfig),
                void this.kr()
              );
            if (this._instance.Tr())
              return void i9.warn("Remote config is disabled. Falling back to local config.");
            this.Ir((e) => {
              if (!e)
                return (
                  i9.info("No config found after loading remote JS config. Falling back to JSON."),
                  void this.Cr((e) => {
                    this.Sr(e), this.kr();
                  })
                );
              this.Sr(e), this.kr();
            });
          } catch (e) {
            i9.error("Error loading remote config", e);
          }
        }
        stop() {
          this.Ar && (clearInterval(this.Ar), (this.Ar = void 0));
        }
        refresh() {
          this._instance.Tr() ||
            "hidden" === (null == o ? void 0 : o.visibilityState) ||
            this._instance.reloadFeatureFlags();
        }
        kr() {
          var e;
          if (!this.Ar) {
            var t = null != (e = this._instance.config.remote_config_refresh_interval_ms) ? e : 3e5;
            0 !== t &&
              (this.Ar = setInterval(() => {
                this.refresh();
              }, t));
          }
        }
        Sr(e) {
          var t;
          e || i9.error("Failed to fetch remote config from PostHog."),
            this._instance.Sr(null != e ? e : {}),
            !1 !== (null == e ? void 0 : e.hasFeatureFlags) &&
              (this._instance.config.advanced_disable_feature_flags_on_first_load ||
                null == (t = this._instance.featureFlags) ||
                t.ensureFlagsLoaded());
        }
      }
      var st = { GZipJS: "gzip-js", Base64: "base64" },
        si = Uint8Array,
        ss = Uint16Array,
        sr = Uint32Array,
        sn = new si([
          0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0,
          0, 0,
        ]),
        so = new si([
          0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12,
          13, 13, 0, 0,
        ]),
        sa = new si([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]),
        sl = (e, t) => {
          for (var i = new ss(31), s = 0; 31 > s; ++s) i[s] = t += 1 << e[s - 1];
          var r = new sr(i[30]);
          for (s = 1; 30 > s; ++s)
            for (var n = i[s]; i[s + 1] > n; ++n) r[n] = ((n - i[s]) << 5) | s;
          return [i, r];
        },
        su = sl(sn, 2),
        sc = su[1];
      (su[0][28] = 258), (sc[258] = 28);
      for (var sh = sl(so, 0)[1], sd = new ss(32768), sp = 0; 32768 > sp; ++sp) {
        var sv = ((43690 & sp) >>> 1) | ((21845 & sp) << 1);
        sd[sp] =
          (((65280 &
            (sv =
              ((61680 & (sv = ((52428 & sv) >>> 2) | ((13107 & sv) << 2))) >>> 4) |
              ((3855 & sv) << 4))) >>>
            8) |
            ((255 & sv) << 8)) >>>
          1;
      }
      var sg = (e, t, i) => {
          for (var s = e.length, r = 0, n = new ss(t); s > r; ++r) ++n[e[r] - 1];
          var o,
            a = new ss(t);
          for (r = 0; t > r; ++r) a[r] = (a[r - 1] + n[r - 1]) << 1;
          if (i) {
            o = new ss(1 << t);
            var l = 15 - t;
            for (r = 0; s > r; ++r)
              if (e[r])
                for (
                  var u = (r << 4) | e[r],
                    c = t - e[r],
                    h = a[e[r] - 1]++ << c,
                    d = h | ((1 << c) - 1);
                  d >= h;
                  ++h
                )
                  o[sd[h] >>> l] = u;
          } else for (o = new ss(s), r = 0; s > r; ++r) o[r] = sd[a[e[r] - 1]++] >>> (15 - e[r]);
          return o;
        },
        s_ = new si(288);
      for (sp = 0; 144 > sp; ++sp) s_[sp] = 8;
      for (sp = 144; 256 > sp; ++sp) s_[sp] = 9;
      for (sp = 256; 280 > sp; ++sp) s_[sp] = 7;
      for (sp = 280; 288 > sp; ++sp) s_[sp] = 8;
      var sf = new si(32);
      for (sp = 0; 32 > sp; ++sp) sf[sp] = 5;
      var sm = sg(s_, 9, 0),
        sy = sg(sf, 5, 0),
        sb = (e) => ((e / 8) | 0) + (7 & e && 1),
        sw = (e, t, i) => {
          (null == i || i > e.length) && (i = e.length);
          var s = new (e instanceof ss ? ss : e instanceof sr ? sr : si)(i - t);
          return s.set(e.subarray(t, i)), s;
        },
        sx = (e, t, i) => {
          var s = (t / 8) | 0;
          (e[s] |= i <<= 7 & t), (e[s + 1] |= i >>> 8);
        },
        sE = (e, t, i) => {
          var s = (t / 8) | 0;
          (e[s] |= i <<= 7 & t), (e[s + 1] |= i >>> 8), (e[s + 2] |= i >>> 16);
        },
        sk = (e, t) => {
          for (var i = [], s = 0; e.length > s; ++s) e[s] && i.push({ s: s, f: e[s] });
          var r = i.length,
            n = i.slice();
          if (!r) return [new si(0), 0];
          if (1 == r) {
            var o = new si(i[0].s + 1);
            return (o[i[0].s] = 1), [o, 1];
          }
          i.sort((e, t) => e.f - t.f), i.push({ s: -1, f: 25001 });
          var a = i[0],
            l = i[1],
            u = 0,
            c = 1,
            h = 2;
          for (i[0] = { s: -1, f: a.f + l.f, l: a, r: l }; c != r - 1; )
            (a = i[i[h].f > i[u].f ? u++ : h++]),
              (l = i[u != c && i[h].f > i[u].f ? u++ : h++]),
              (i[c++] = { s: -1, f: a.f + l.f, l: a, r: l });
          var d = n[0].s;
          for (s = 1; r > s; ++s) n[s].s > d && (d = n[s].s);
          var p = new ss(d + 1),
            v = sS(i[c - 1], p, 0);
          if (v > t) {
            s = 0;
            var g = 0,
              _ = v - t,
              f = 1 << _;
            for (n.sort((e, t) => p[t.s] - p[e.s] || e.f - t.f); r > s; ++s) {
              var m = n[s].s;
              if (t >= p[m]) break;
              (g += f - (1 << (v - p[m]))), (p[m] = t);
            }
            for (g >>>= _; g > 0; ) {
              var y = n[s].s;
              t > p[y] ? (g -= 1 << (t - p[y]++ - 1)) : ++s;
            }
            for (; s >= 0 && g; --s) {
              var b = n[s].s;
              p[b] == t && (--p[b], ++g);
            }
            v = t;
          }
          return [new si(p), v];
        },
        sS = (e, t, i) =>
          -1 == e.s ? Math.max(sS(e.l, t, i + 1), sS(e.r, t, i + 1)) : (t[e.s] = i),
        sP = (e) => {
          for (var t = e.length; t && !e[--t]; );
          for (
            var i = new ss(++t),
              s = 0,
              r = e[0],
              n = 1,
              o = (e) => {
                i[s++] = e;
              },
              a = 1;
            t >= a;
            ++a
          )
            if (e[a] == r && a != t) ++n;
            else {
              if (!r && n > 2) {
                for (; n > 138; n -= 138) o(32754);
                n > 2 && (o(n > 10 ? ((n - 11) << 5) | 28690 : ((n - 3) << 5) | 12305), (n = 0));
              } else if (n > 3) {
                for (o(r), --n; n > 6; n -= 6) o(8304);
                n > 2 && (o(((n - 3) << 5) | 8208), (n = 0));
              }
              for (; n--; ) o(r);
              (n = 1), (r = e[a]);
            }
          return [i.subarray(0, s), t];
        },
        sR = (e, t) => {
          for (var i = 0, s = 0; t.length > s; ++s) i += e[s] * t[s];
          return i;
        },
        sF = (e, t, i) => {
          var s = i.length,
            r = sb(t + 2);
          (e[r] = 255 & s),
            (e[r + 1] = s >>> 8),
            (e[r + 2] = 255 ^ e[r]),
            (e[r + 3] = 255 ^ e[r + 1]);
          for (var n = 0; s > n; ++n) e[r + n + 4] = i[n];
          return 8 * (r + 4 + s);
        },
        s$ = (e, t, i, s, r, n, o, a, l, u, c) => {
          sx(t, c++, i), ++r[256];
          for (
            var h = sk(r, 15),
              d = h[0],
              p = h[1],
              v = sk(n, 15),
              g = v[0],
              _ = v[1],
              f = sP(d),
              m = f[0],
              y = f[1],
              b = sP(g),
              w = b[0],
              x = b[1],
              E = new ss(19),
              k = 0;
            m.length > k;
            ++k
          )
            E[31 & m[k]]++;
          for (k = 0; w.length > k; ++k) E[31 & w[k]]++;
          for (var S = sk(E, 7), P = S[0], R = S[1], F = 19; F > 4 && !P[sa[F - 1]]; --F);
          var $,
            T,
            C,
            I,
            O = (u + 5) << 3,
            M = sR(r, s_) + sR(n, sf) + o,
            A =
              sR(r, d) + sR(n, g) + o + 14 + 3 * F + sR(E, P) + (2 * E[16] + 3 * E[17] + 7 * E[18]);
          if (M >= O && A >= O) return sF(t, c, e.subarray(l, l + u));
          if ((sx(t, c, 1 + (M > A)), (c += 2), M > A)) {
            ($ = sg(d, p, 0)), (T = d), (C = sg(g, _, 0)), (I = g);
            var L = sg(P, R, 0);
            for (
              sx(t, c, y - 257), sx(t, c + 5, x - 1), sx(t, c + 10, F - 4), c += 14, k = 0;
              F > k;
              ++k
            )
              sx(t, c + 3 * k, P[sa[k]]);
            c += 3 * F;
            for (var D = [m, w], j = 0; 2 > j; ++j) {
              var N = D[j];
              for (k = 0; N.length > k; ++k)
                sx(t, c, L[(q = 31 & N[k])]),
                  (c += P[q]),
                  q > 15 && (sx(t, c, (N[k] >>> 5) & 127), (c += N[k] >>> 12));
            }
          } else ($ = sm), (T = s_), (C = sy), (I = sf);
          for (k = 0; a > k; ++k)
            if (s[k] > 255) {
              sE(t, c, $[257 + (q = (s[k] >>> 18) & 31)]),
                (c += T[q + 257]),
                q > 7 && (sx(t, c, (s[k] >>> 23) & 31), (c += sn[q]));
              var q,
                U = 31 & s[k];
              sE(t, c, C[U]), (c += I[U]), U > 3 && (sE(t, c, (s[k] >>> 5) & 8191), (c += so[U]));
            } else sE(t, c, $[s[k]]), (c += T[s[k]]);
          return sE(t, c, $[256]), c + T[256];
        },
        sT = new sr([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]),
        sC = (() => {
          for (var e = new sr(256), t = 0; 256 > t; ++t) {
            for (var i = t, s = 9; --s; ) i = (1 & i && 0xedb88320) ^ (i >>> 1);
            e[t] = i;
          }
          return e;
        })(),
        sI = (e, t, i) => {
          for (; i; ++t) (e[t] = i), (i >>>= 8);
        },
        sO = !!u || !!l,
        sM = "text/plain",
        sA = (e, t, i) => {
          void 0 === i && (i = !0);
          var s,
            r,
            n,
            o,
            a,
            [l, u] = e.split("?"),
            c = m({}, t),
            h =
              null !=
              (a =
                null == u
                  ? void 0
                  : u.split("&").map((e) => {
                      var t,
                        [s, r] = e.split("="),
                        n = i && null != (t = c[s]) ? t : r;
                      return delete c[s], s + "=" + n;
                    }))
                ? a
                : [],
            d =
              (void 0 === s && (s = "&"),
              (o = []),
              t8(c, (e, t) => {
                M(e) ||
                  M(t) ||
                  "undefined" === t ||
                  ((r = encodeURIComponent(e instanceof File ? e.name : e.toString())),
                  (n = encodeURIComponent(t)),
                  (o[o.length] = n + "=" + r));
              }),
              o.join(s));
          return d && h.push(d), l + "?" + h.join("&");
        },
        sL = (e, t) => JSON.stringify(e, (e, t) => ("bigint" == typeof t ? t.toString() : t), t),
        sD = (e) => {
          if (e.zt) return e.zt;
          var { data: t, compression: i } = e;
          if (t) {
            if (i === st.GZipJS) {
              var s = ((e, t) => {
                void 0 === t && (t = {});
                var i =
                    ((r = 0xffffffff),
                    {
                      p(e) {
                        for (var t = r, i = 0; e.length > i; ++i)
                          t = sC[(255 & t) ^ e[i]] ^ (t >>> 8);
                        r = t;
                      },
                      d: () => 0xffffffff ^ r,
                    }),
                  s = e.length;
                i.p(e);
                var r,
                  n,
                  o,
                  a,
                  l =
                    ((a = 10 + (((n = t).filename && n.filename.length + 1) || 0)),
                    ((e, t, i, s, r, n) => {
                      var o = e.length,
                        a = new si(s + o + 5 * (1 + Math.floor(o / 7e3)) + 8),
                        l = a.subarray(s, a.length - 8),
                        u = 0;
                      if (!t || 8 > o)
                        for (var c = 0; o >= c; c += 65535) {
                          var h = c + 65535;
                          o > h
                            ? (u = sF(l, u, e.subarray(c, h)))
                            : ((l[c] = !0), (u = sF(l, u, e.subarray(c, o))));
                        }
                      else {
                        for (
                          var d = sT[t - 1],
                            p = d >>> 13,
                            v = 8191 & d,
                            g = (1 << i) - 1,
                            _ = new ss(32768),
                            f = new ss(g + 1),
                            m = Math.ceil(i / 3),
                            y = 2 * m,
                            b = (t) => (e[t] ^ (e[t + 1] << m) ^ (e[t + 2] << y)) & g,
                            w = new sr(25e3),
                            x = new ss(288),
                            E = new ss(32),
                            k = 0,
                            S = 0,
                            P = ((c = 0), 0),
                            R = 0,
                            F = 0;
                          o > c;
                          ++c
                        ) {
                          var $ = b(c),
                            T = 32767 & c,
                            C = f[$];
                          if (((_[T] = C), (f[$] = T), c >= R)) {
                            var I = o - c;
                            if ((k > 7e3 || P > 24576) && I > 423) {
                              (u = s$(e, l, 0, w, x, E, S, P, F, c - F, u)),
                                (P = k = S = 0),
                                (F = c);
                              for (var O = 0; 286 > O; ++O) x[O] = 0;
                              for (O = 0; 30 > O; ++O) E[O] = 0;
                            }
                            var M = 2,
                              A = 0,
                              L = v,
                              D = (T - C) & 32767;
                            if (I > 2 && $ == b(c - D))
                              for (
                                var j = Math.min(p, I) - 1,
                                  N = Math.min(32767, c),
                                  q = Math.min(258, I);
                                N >= D && --L && T != C;
                              ) {
                                if (e[c + M] == e[c + M - D]) {
                                  for (var U = 0; q > U && e[c + U] == e[c + U - D]; ++U);
                                  if (U > M) {
                                    if (((M = U), (A = D), U > j)) break;
                                    var W = Math.min(D, U - 2),
                                      H = 0;
                                    for (O = 0; W > O; ++O) {
                                      var z = (c - D + O + 32768) & 32767,
                                        B = (z - _[z] + 32768) & 32767;
                                      B > H && ((H = B), (C = z));
                                    }
                                  }
                                }
                                D += ((T = C) - (C = _[T]) + 32768) & 32767;
                              }
                            if (A) {
                              w[P++] = 0x10000000 | (sc[M] << 18) | sh[A];
                              var V = 31 & sc[M],
                                G = 31 & sh[A];
                              (S += sn[V] + so[G]), ++x[257 + V], ++E[G], (R = c + M), ++k;
                            } else (w[P++] = e[c]), ++x[e[c]];
                          }
                        }
                        u = s$(e, l, !0, w, x, E, S, P, F, c - F, u);
                      }
                      return sw(a, 0, s + sb(u) + r);
                    })(
                      e,
                      null == (o = t).level ? 6 : o.level,
                      null == o.mem
                        ? Math.ceil(1.5 * Math.max(8, Math.min(13, Math.log(e.length))))
                        : 12 + o.mem,
                      a,
                      8,
                    )),
                  u = l.length;
                return (
                  ((e, t) => {
                    var i = t.filename;
                    if (
                      ((e[0] = 31),
                      (e[1] = 139),
                      (e[2] = 8),
                      (e[8] = 2 > t.level ? 4 : 2 * (9 == t.level)),
                      (e[9] = 3),
                      0 != t.mtime && sI(e, 4, Math.floor(new Date(t.mtime || Date.now()) / 1e3)),
                      i)
                    ) {
                      e[3] = 8;
                      for (var s = 0; i.length >= s; ++s) e[s + 10] = i.charCodeAt(s);
                    }
                  })(l, t),
                  sI(l, u - 8, i.d()),
                  sI(l, u - 4, s),
                  l
                );
              })(
                ((e, t) => {
                  var i = e.length;
                  if ("undefined" != typeof TextEncoder) return new TextEncoder().encode(e);
                  for (
                    var s = new si(e.length + (e.length >>> 1)),
                      r = 0,
                      n = (e) => {
                        s[r++] = e;
                      },
                      o = 0;
                    i > o;
                    ++o
                  ) {
                    if (r + 5 > s.length) {
                      var a = new si(r + 8 + ((i - o) << 1));
                      a.set(s), (s = a);
                    }
                    var l = e.charCodeAt(o);
                    128 > l
                      ? n(l)
                      : (2048 > l
                          ? n(192 | (l >>> 6))
                          : (l > 55295 && 57344 > l
                              ? (n(
                                  240 |
                                    ((l = (65536 + (1047552 & l)) | (1023 & e.charCodeAt(++o))) >>>
                                      18),
                                ),
                                n(128 | ((l >>> 12) & 63)))
                              : n(224 | (l >>> 12)),
                            n(128 | ((l >>> 6) & 63))),
                        n(128 | (63 & l)));
                  }
                  return sw(s, 0, r);
                })(sL(t)),
                { mtime: 0 },
              );
              return {
                contentType: sM,
                body: s.buffer.slice(s.byteOffset, s.byteOffset + s.byteLength),
                estimatedSize: s.byteLength,
              };
            }
            if (i === st.Base64) {
              var r = ((e) => "data=" + encodeURIComponent("string" == typeof e ? e : sL(e)))(
                ((e) =>
                  e
                    ? btoa(
                        encodeURIComponent(e).replace(/%([0-9A-F]{2})/g, (e, t) =>
                          String.fromCharCode(parseInt(t, 16)),
                        ),
                      )
                    : e)(sL(t)),
              );
              return {
                contentType: "application/x-www-form-urlencoded",
                body: r,
                estimatedSize: new Blob([r]).size,
              };
            }
            var n = sL(t);
            return { contentType: "application/json", body: n, estimatedSize: new Blob([n]).size };
          }
        },
        sj = (() => {
          var e = f(function* (e) {
            var t = sL(e.data),
              i = yield (function (e, t) {
                return b.apply(this, arguments);
              })(t, g.DEBUG);
            if (!i) return e;
            var s = yield i.arrayBuffer();
            return m({}, e, { zt: { contentType: sM, body: s, estimatedSize: s.byteLength } });
          });
          return function (t) {
            return e.apply(this, arguments);
          };
        })(),
        sN = [];
      l &&
        sN.push({
          transport: "fetch",
          method(e) {
            var t,
              i,
              { contentType: s, body: r, estimatedSize: n } = null != (t = sD(e)) ? t : {},
              o = new Headers();
            t8(e.headers, (e, t) => {
              o.append(t, e);
            }),
              s && o.append("Content-Type", s);
            var a = e.url,
              u = null;
            if (c) {
              var h = new c();
              u = { signal: h.signal, timeout: setTimeout(() => h.abort(), e.timeout) };
            }
            l(
              a,
              m(
                {
                  method: (null == e ? void 0 : e.method) || "GET",
                  headers: o,
                  keepalive: "POST" === e.method && 52428.8 > (n || 0),
                  body: r,
                  signal: null == (i = u) ? void 0 : i.signal,
                },
                e.fetchOptions,
              ),
            )
              .then((t) =>
                t.text().then((i) => {
                  var s = { statusCode: t.status, text: i };
                  if (200 === t.status)
                    try {
                      s.json = JSON.parse(i);
                    } catch (e) {
                      ta.error(e);
                    }
                  null == e.callback || e.callback(s);
                }),
              )
              .catch((t) => {
                ta.error(t), null == e.callback || e.callback({ statusCode: 0, error: t });
              })
              .finally(() => (u ? clearTimeout(u.timeout) : null));
          },
        }),
        u &&
          sN.push({
            transport: "XHR",
            method(e) {
              var t,
                i = new u();
              i.open(e.method || "GET", e.url, !0);
              var { contentType: s, body: r } = null != (t = sD(e)) ? t : {};
              t8(e.headers, (e, t) => {
                i.setRequestHeader(t, e);
              }),
                s && i.setRequestHeader("Content-Type", s),
                e.timeout && (i.timeout = e.timeout),
                e.disableXHRCredentials || (i.withCredentials = !0),
                (i.onreadystatechange = () => {
                  if (4 === i.readyState) {
                    var t = { statusCode: i.status, text: i.responseText };
                    if (200 === i.status)
                      try {
                        t.json = JSON.parse(i.responseText);
                      } catch (e) {}
                    null == e.callback || e.callback(t);
                  }
                }),
                i.send(r);
            },
          }),
        null != n &&
          n.sendBeacon &&
          sN.push({
            transport: "sendBeacon",
            method(e) {
              var t = sA(e.url, { beacon: "1" });
              try {
                var i,
                  { contentType: s, body: r } = null != (i = sD(e)) ? i : {};
                if (!r) return;
                var o = r instanceof Blob ? r : new Blob([r], { type: s });
                n.sendBeacon(t, o);
              } catch (e) {}
            },
          });
      class sq {
        constructor(e, t) {
          (this.Er = !0),
            (this.Rr = []),
            (this.Nr = K(
              (null == t ? void 0 : t.flush_interval_ms) || 3e3,
              250,
              5e3,
              ta.createLogger("flush interval"),
              3e3,
            )),
            (this.Mr = e);
        }
        enqueue(e) {
          this.Rr.push(e), this.Fr || this.Or();
        }
        unload() {
          this.Pr();
          var e = Object.values(this.Rr.length > 0 ? this.Lr() : {});
          [
            ...e.filter((e) => 0 === e.url.indexOf("/e")),
            ...e.filter((e) => 0 !== e.url.indexOf("/e")),
          ].map((e) => {
            this.Mr(m({}, e, { transport: "sendBeacon" }));
          });
        }
        enable() {
          (this.Er = !1), this.Or();
        }
        Or() {
          this.Er ||
            (this.Fr = setTimeout(() => {
              if ((this.Pr(), this.Rr.length > 0)) {
                var t = this.Lr();
                for (var i in t)
                  !(() => {
                    var s = t[i],
                      r = new Date().getTime();
                    s.data &&
                      T(s.data) &&
                      t8(s.data, (e) => {
                        (e.offset = Math.abs(e.timestamp - r)), delete e.timestamp;
                      }),
                      this.Mr(s);
                  })();
              }
            }, this.Nr));
        }
        Pr() {
          clearTimeout(this.Fr), (this.Fr = void 0);
        }
        Lr() {
          var e = {};
          return (
            t8(this.Rr, (t) => {
              var i,
                s = (t ? t.batchKey : null) || t.url;
              M(e[s]) && (e[s] = m({}, t, { data: [] })), null == (i = e[s].data) || i.push(t.data);
            }),
            (this.Rr = []),
            e
          );
        }
      }
      var sU = ["retriesPerformedSoFar"];
      class sW {
        constructor(e) {
          (this.Dr = !1),
            (this.Br = 3e3),
            (this.Rr = []),
            (this._instance = e),
            (this.Rr = []),
            (this.jr = !0),
            !M(s) &&
              "onLine" in s.navigator &&
              ((this.jr = s.navigator.onLine),
              (this.qr = () => {
                (this.jr = !0), this.Zr();
              }),
              (this.$r = () => {
                this.jr = !1;
              }),
              is(s, "online", this.qr),
              is(s, "offline", this.$r));
        }
        get length() {
          return this.Rr.length;
        }
        retriableRequest(e) {
          var { retriesPerformedSoFar: t } = e,
            i = y(e, sU);
          N(t) && (i.url = sA(i.url, { retry_count: t })),
            this._instance._send_request(
              m({}, i, {
                callback: (e) => {
                  200 === e.statusCode ||
                  (e.statusCode >= 400 && 500 > e.statusCode) ||
                  (null != t ? t : 0) >= 10
                    ? null == i.callback || i.callback(e)
                    : this.Hr(m({ retriesPerformedSoFar: t }, i));
                },
              }),
            );
        }
        Hr(e) {
          var t,
            i,
            s = e.retriesPerformedSoFar || 0;
          e.retriesPerformedSoFar = s + 1;
          var r = Math.ceil(
              (i = Math.min(18e5, (t = 3e3 * 2 ** s))) + (Math.random() - 0.5) * (i - t / 2),
            ),
            n = Date.now() + r;
          this.Rr.push({ retryAt: n, requestOptions: e });
          var o = "Enqueued failed request for retry in " + r;
          navigator.onLine || (o += " (Browser is offline)"),
            ta.warn(o),
            this.Dr || ((this.Dr = !0), this.Vr());
        }
        Vr() {
          if ((this.zr && clearTimeout(this.zr), 0 === this.Rr.length))
            return (this.Dr = !1), void (this.zr = void 0);
          this.zr = setTimeout(() => {
            this.jr && this.Rr.length > 0 && this.Zr(), this.Vr();
          }, this.Br);
        }
        Zr() {
          var e = Date.now(),
            t = [],
            i = this.Rr.filter((i) => e > i.retryAt || (t.push(i), !1));
          if (((this.Rr = t), i.length > 0))
            for (var { requestOptions: s } of i) this.retriableRequest(s);
        }
        unload() {
          for (var { requestOptions: e } of (this.zr && (clearTimeout(this.zr), (this.zr = void 0)),
          (this.Dr = !1),
          M(s) ||
            (this.qr && (s.removeEventListener("online", this.qr), (this.qr = void 0)),
            this.$r && (s.removeEventListener("offline", this.$r), (this.$r = void 0))),
          this.Rr))
            try {
              this._instance._send_request(m({}, e, { transport: "sendBeacon" }));
            } catch (e) {
              ta.error(e);
            }
          this.Rr = [];
        }
      }
      class sH {
        constructor(e) {
          (this.Yr = () => {
            this.Ur || (this.Ur = {});
            var e,
              t,
              i,
              s,
              r = this.scrollElement(),
              n = this.scrollY(),
              o = r ? Math.max(0, r.scrollHeight - r.clientHeight) : 0,
              a = n + ((null == r ? void 0 : r.clientHeight) || 0),
              l = (null == r ? void 0 : r.scrollHeight) || 0;
            (this.Ur.lastScrollY = Math.ceil(n)),
              (this.Ur.maxScrollY = Math.max(n, null != (e = this.Ur.maxScrollY) ? e : 0)),
              (this.Ur.maxScrollHeight = Math.max(
                o,
                null != (t = this.Ur.maxScrollHeight) ? t : 0,
              )),
              (this.Ur.lastContentY = a),
              (this.Ur.maxContentY = Math.max(a, null != (i = this.Ur.maxContentY) ? i : 0)),
              (this.Ur.maxContentHeight = Math.max(
                l,
                null != (s = this.Ur.maxContentHeight) ? s : 0,
              ));
          }),
            (this._instance = e);
        }
        get Wr() {
          return this._instance.config.scroll_root_selector;
        }
        getContext() {
          return this.Ur;
        }
        resetContext() {
          var e = this.Ur;
          return setTimeout(this.Yr, 0), e;
        }
        startMeasuringScrollPosition() {
          is(s, "scroll", this.Yr, { capture: !0 }),
            is(s, "scrollend", this.Yr, { capture: !0 }),
            is(s, "resize", this.Yr);
        }
        scrollElement() {
          if (!this.Wr) return null == s ? void 0 : s.document.documentElement;
          for (var e of T(this.Wr) ? this.Wr : [this.Wr]) {
            var t = null == s ? void 0 : s.document.querySelector(e);
            if (t) return t;
          }
        }
        scrollY() {
          if (this.Wr) {
            var e = this.scrollElement();
            return (e && e.scrollTop) || 0;
          }
          return (s && (s.scrollY || s.pageYOffset || s.document.documentElement.scrollTop)) || 0;
        }
        scrollX() {
          if (this.Wr) {
            var e = this.scrollElement();
            return (e && e.scrollLeft) || 0;
          }
          return (s && (s.scrollX || s.pageXOffset || s.document.documentElement.scrollLeft)) || 0;
        }
      }
      var sz = (e) =>
        iY(
          null == e ? void 0 : e.config.mask_personal_data_properties,
          null == e ? void 0 : e.config.custom_personal_data_properties,
        );
      class sB {
        constructor(e, t, i, s) {
          (this.Gr = (e) => {
            var t = this.Xr();
            if (!t || t.sessionId !== e) {
              var i = { sessionId: e, props: this.Jr(this._instance) };
              this.Kr.register({ [tj]: i });
            }
          }),
            (this._instance = e),
            (this.Qr = t),
            (this.Kr = i),
            (this.Jr = s || sz),
            this.Qr.onSessionId(this.Gr);
        }
        Xr() {
          return this.Kr.props[tj];
        }
        getSetOnceProps() {
          var e,
            t = null == (e = this.Xr()) ? void 0 : e.props;
          return t
            ? "r" in t
              ? iJ(t)
              : {
                  $referring_domain: t.referringDomain,
                  $pathname: t.initialPathName,
                  utm_source: t.utm_source,
                  utm_campaign: t.utm_campaign,
                  utm_medium: t.utm_medium,
                  utm_content: t.utm_content,
                  utm_term: t.utm_term,
                }
            : {};
        }
        getSessionProps() {
          var e = {};
          return (
            t8(it(this.getSetOnceProps()), (t, i) => {
              "$current_url" === i && (i = "url"), (e["$session_entry_" + P(i)] = t);
            }),
            e
          );
        }
      }
      class sV {
        constructor() {
          this.ti = {};
        }
        on(e, t) {
          return (
            this.ti[e] || (this.ti[e] = []),
            this.ti[e].push(t),
            () => {
              this.ti[e] = this.ti[e].filter((e) => e !== t);
            }
          );
        }
        emit(e, t) {
          for (var i of this.ti[e] || []) i(t);
          for (var s of this.ti["*"] || []) s(e, t);
        }
      }
      var sG = tl("[SessionId]");
      class sK {
        on(e, t) {
          return this.ei.on(e, t);
        }
        constructor(e, t, i) {
          if (
            ((this.ri = []),
            (this.ii = void 0),
            (this.ei = new sV()),
            (this.ni = (e, t) => !(!N(e) || !N(t)) && Math.abs(e - t) > this.sessionTimeoutMs),
            !e.persistence)
          )
            throw Error("SessionIdManager requires a PostHogPersistence instance");
          if (e.config.cookieless_mode === tY)
            throw Error('SessionIdManager cannot be used with cookieless_mode="always"');
          (this.Rt = e.config),
            (this.Kr = e.persistence),
            (this.si = void 0),
            (this.oi = void 0),
            (this._sessionStartTimestamp = null),
            (this._sessionActivityTimestamp = null),
            (this.ai = t || ih),
            (this.li = i || ih);
          var s,
            r = this.Rt.persistence_name || this.Rt.token;
          if (
            ((this._sessionTimeoutMs =
              1e3 *
              K(
                this.Rt.session_idle_timeout_seconds || 1800,
                60,
                36e3,
                sG.createLogger("session_idle_timeout_seconds"),
                1800,
              )),
            e.register({ $configured_session_timeout_ms: this._sessionTimeoutMs }),
            this.ui(),
            (this.hi = "ph_" + r + "_window_id"),
            (this.ci = "ph_" + r + "_primary_window_exists"),
            this.di())
          ) {
            var n = iE.Gt(this.hi),
              o = iE.Gt(this.ci);
            n && !o ? (this.si = n) : iE.Jt(this.hi), iE.Xt(this.ci, !0);
          }
          if (null != (s = this.Rt.bootstrap) && s.sessionID)
            try {
              var a = ((e) => {
                var t = this.Rt.bootstrap.sessionID.replace(/-/g, "");
                if (32 !== t.length) throw Error("Not a valid UUID");
                if ("7" !== t[12]) throw Error("Not a UUIDv7");
                return parseInt(t.substring(0, 12), 16);
              })();
              this.vi(this.Rt.bootstrap.sessionID, new Date().getTime(), a);
            } catch (e) {
              sG.error("Invalid sessionID in bootstrap", e);
            }
          this.fi();
        }
        get sessionTimeoutMs() {
          return this._sessionTimeoutMs;
        }
        onSessionId(e) {
          return (
            M(this.ri) && (this.ri = []),
            this.ri.push(e),
            this.oi && e(this.oi, this.si),
            () => {
              this.ri = this.ri.filter((t) => t !== e);
            }
          );
        }
        di() {
          return "memory" !== this.Rt.persistence && !this.Kr.gr && iE.Yt();
        }
        pi(e) {
          e !== this.si && ((this.si = e), this.di() && iE.Xt(this.hi, e));
        }
        gi() {
          return this.si ? this.si : this.di() ? iE.Gt(this.hi) : null;
        }
        vi(e, t, i) {
          (e === this.oi &&
            t === this._sessionActivityTimestamp &&
            i === this._sessionStartTimestamp) ||
            ((this._sessionStartTimestamp = i),
            (this._sessionActivityTimestamp = t),
            (this.oi = e),
            this.Kr.register({ [tS]: [t, e, i] }));
        }
        mi() {
          var e = this.Kr.props[tS];
          return T(e) && 2 === e.length && e.push(e[0]), e || [0, null, 0];
        }
        resetSessionId() {
          this.vi(null, null, null);
        }
        destroy() {
          clearTimeout(this.yi),
            (this.yi = void 0),
            this.ii &&
              s &&
              (s.removeEventListener(t0, this.ii, { capture: !1 }), (this.ii = void 0)),
            (this.ri = []);
        }
        fi() {
          (this.ii = () => {
            this.di() && iE.Jt(this.ci);
          }),
            is(s, t0, this.ii, { capture: !1 });
        }
        checkAndGetSessionAndWindowId(e, t) {
          if (
            (void 0 === e && (e = !1), void 0 === t && (t = null), this.Rt.cookieless_mode === tY)
          )
            throw Error(
              'checkAndGetSessionAndWindowId should not be called with cookieless_mode="always"',
            );
          var i = t || new Date().getTime(),
            [s, r, n] = this.mi(),
            o = this.gi(),
            a = N(n) && Math.abs(i - n) > 864e5,
            l = !1,
            u = !r,
            c = !u && !e && this.ni(i, s);
          u || c || a
            ? ((r = this.ai()),
              (o = this.li()),
              sG.info("new session ID generated", {
                sessionId: r,
                windowId: o,
                changeReason: { noSessionId: u, activityTimeout: c, sessionPastMaximumLength: a },
              }),
              (n = i),
              (l = !0))
            : o || ((o = this.li()), (l = !0));
          var h = N(s) && e && !a ? s : i,
            d = N(n) ? n : new Date().getTime();
          return (
            this.pi(o),
            this.vi(r, h, d),
            e || this.ui(),
            l &&
              this.ri.forEach((e) =>
                e(
                  r,
                  o,
                  l ? { noSessionId: u, activityTimeout: c, sessionPastMaximumLength: a } : void 0,
                ),
              ),
            {
              sessionId: r,
              windowId: o,
              sessionStartTimestamp: d,
              changeReason: l
                ? { noSessionId: u, activityTimeout: c, sessionPastMaximumLength: a }
                : void 0,
              lastActivityTimestamp: s,
            }
          );
        }
        ui() {
          clearTimeout(this.yi),
            (this.yi = setTimeout(() => {
              var [e] = this.mi();
              if (this.ni(new Date().getTime(), e)) {
                var t = this.oi;
                this.resetSessionId(), this.ei.emit("forcedIdleReset", { idleSessionId: t });
              }
            }, 1.1 * this.sessionTimeoutMs));
        }
      }
      var sY = (e, t) => {
          if (!e) return !1;
          var i = e.userAgent;
          if (i && E(i, t)) return !0;
          try {
            var s = null == e ? void 0 : e.userAgentData;
            if (null != s && s.brands && s.brands.some((e) => E(null == e ? void 0 : e.brand, t)))
              return !0;
          } catch (e) {}
          return !!e.webdriver;
        },
        sJ = (e, t) => {
          if (
            !((e) => {
              try {
                new RegExp(e);
              } catch (e) {
                return !1;
              }
              return !0;
            })(t)
          )
            return !1;
          try {
            return new RegExp(t).test(e);
          } catch (e) {
            return !1;
          }
        };
      function sX(e, t, i) {
        return sL({ distinct_id: e, userPropertiesToSet: t, userPropertiesToSetOnce: i });
      }
      var sZ = {
          exact: (e, t) => t.some((t) => e.some((e) => t === e)),
          is_not: (e, t) => t.every((t) => e.every((e) => t !== e)),
          regex: (e, t) => t.some((t) => e.some((e) => sJ(t, e))),
          not_regex: (e, t) => t.every((t) => e.every((e) => !sJ(t, e))),
          icontains: (e, t) => t.map(sQ).some((t) => e.map(sQ).some((e) => t.includes(e))),
          not_icontains: (e, t) => t.map(sQ).every((t) => e.map(sQ).every((e) => !t.includes(e))),
          gt: (e, t) =>
            t.some((t) => {
              var i = parseFloat(t);
              return !isNaN(i) && e.some((e) => i > parseFloat(e));
            }),
          lt: (e, t) =>
            t.some((t) => {
              var i = parseFloat(t);
              return !isNaN(i) && e.some((e) => i < parseFloat(e));
            }),
        },
        sQ = (e) => e.toLowerCase();
      function s0(e, t) {
        return (
          !e ||
          Object.entries(e).every((e) => {
            var [i, s] = e,
              r = null == t ? void 0 : t[i];
            if (M(r) || null === r) return !1;
            var n = [String(r)],
              o = sZ[s.operator];
            return !!o && o(s.values, n);
          })
        );
      }
      var s1 = "custom",
        s2 = "i.posthog.com";
      class s3 {
        constructor(e) {
          (this.bi = {}), (this.instance = e);
        }
        get apiHost() {
          var e = this.instance.config.api_host.trim().replace(/\/$/, "");
          return "https://app.posthog.com" === e ? "https://us.i.posthog.com" : e;
        }
        get flagsApiHost() {
          var e = this.instance.config.flags_api_host;
          return e ? e.trim().replace(/\/$/, "") : this.apiHost;
        }
        get uiHost() {
          var e,
            t = null == (e = this.instance.config.ui_host) ? void 0 : e.replace(/\/$/, "");
          return (
            t || (t = this.apiHost.replace("." + s2, ".posthog.com")),
            "https://app.posthog.com" === t ? "https://us.posthog.com" : t
          );
        }
        get region() {
          return (
            this.bi[this.apiHost] ||
              (this.bi[this.apiHost] = /https:\/\/(app|us|us-assets)(\.i)?\.posthog\.com/i.test(
                this.apiHost,
              )
                ? "us"
                : /https:\/\/(eu|eu-assets)(\.i)?\.posthog\.com/i.test(this.apiHost)
                  ? "eu"
                  : s1),
            this.bi[this.apiHost]
          );
        }
        endpointFor(e, t) {
          if ((void 0 === t && (t = ""), t && (t = "/" === t[0] ? t : "/" + t), "ui" === e))
            return this.uiHost + t;
          if ("flags" === e) return this.flagsApiHost + t;
          if (this.region === s1) return this.apiHost + t;
          var i = s2 + t;
          switch (e) {
            case "assets":
              return "https://" + this.region + "-assets." + i;
            case "api":
              return "https://" + this.region + "." + i;
          }
        }
      }
      var s5 = tl("[Surveys]"),
        s6 = "seenSurvey_",
        s8 = (e) =>
          ((e, t) => {
            var i = "" + s6 + t.id;
            return (
              t.current_iteration &&
                t.current_iteration > 0 &&
                (i = "" + s6 + t.id + "_" + t.current_iteration),
              i
            );
          })(0, e),
        s4 = [i1.Popover, i1.Widget, i1.API],
        s7 = { ignoreConditions: !1, ignoreDelay: !1, displayType: i5.Popover },
        s9 = tl("[PostHog ExternalIntegrations]"),
        re = { intercom: "intercom-integration", crispChat: "crisp-chat-integration" };
      class rt {
        constructor(e) {
          this._instance = e;
        }
        nr(e, t) {
          var i;
          null == (i = p.__PosthogExtensions__) ||
            null == i.loadExternalDependency ||
            i.loadExternalDependency(this._instance, e, (e) => {
              if (e) return s9.error("failed to load script", e);
              t();
            });
        }
        startIfEnabledOrStop() {
          var e,
            i = (e) => {
              var i, s, n;
              !r ||
                (null != (i = p.__PosthogExtensions__) && null != (i = i.integrations) && i[e]) ||
                this.nr(re[e], () => {
                  var i;
                  null == (i = p.__PosthogExtensions__) ||
                    null == (i = i.integrations) ||
                    null == (i = i[e]) ||
                    i.start(this._instance);
                }),
                !r &&
                  null != (s = p.__PosthogExtensions__) &&
                  null != (s = s.integrations) &&
                  s[e] &&
                  (null == (n = p.__PosthogExtensions__) ||
                    null == (n = n.integrations) ||
                    null == (n = n[e]) ||
                    n.stop());
            };
          for (var [s, r] of Object.entries(
            null != (e = this._instance.config.integrations) ? e : {},
          ))
            i(s);
        }
      }
      var ri = {},
        rs = 0,
        rr = () => {},
        rn = 'Consent opt in/out is not valid with cookieless_mode="always" and will be ignored',
        ro = "Surveys module not available",
        ra = "sanitize_properties is deprecated. Use before_send instead",
        rl = "Invalid value for property_denylist config: ",
        ru = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
        rc = "posthog",
        rh =
          !sO &&
          -1 === (null == d ? void 0 : d.indexOf("MSIE")) &&
          -1 === (null == d ? void 0 : d.indexOf("Mozilla")),
        rd = (e) => {
          var t;
          return m(
            {
              api_host: "https://us.i.posthog.com",
              flags_api_host: null,
              ui_host: null,
              token: "",
              autocapture: !0,
              cross_subdomain_cookie: ((e) => {
                var t = null == e ? void 0 : e.hostname;
                if (!A(t)) return !1;
                var i = t.split(".").slice(-2).join(".");
                for (var s of ii) if (i === s) return !1;
                return !0;
              })(null == o ? void 0 : o.location),
              persistence: "localStorage+cookie",
              persistence_name: "",
              cookie_persisted_properties: [],
              loaded: rr,
              save_campaign_params: !0,
              custom_campaign_params: [],
              custom_blocked_useragents: [],
              save_referrer: !0,
              capture_pageleave: "if_capture_pageview",
              defaults: null != e ? e : "unset",
              __preview_deferred_init_extensions: !1,
              debug:
                (a &&
                  A(null == a ? void 0 : a.search) &&
                  -1 !== a.search.indexOf("__posthog_debug=true")) ||
                !1,
              cookie_expiration: 365,
              upgrade: !1,
              disable_session_recording: !1,
              disable_persistence: !1,
              disable_web_experiments: !0,
              disable_surveys: !1,
              disable_surveys_automatic_display: !1,
              disable_conversations: !1,
              disable_product_tours: !1,
              disable_external_dependency_loading: !1,
              enable_recording_console_log: void 0,
              secure_cookie:
                "https:" === (null == s || null == (t = s.location) ? void 0 : t.protocol),
              ip: !1,
              opt_out_capturing_by_default: !1,
              opt_out_persistence_by_default: !1,
              opt_out_useragent_filter: !1,
              opt_out_capturing_persistence_type: "localStorage",
              consent_persistence_name: null,
              opt_out_capturing_cookie_prefix: null,
              opt_in_site_apps: !1,
              property_denylist: [],
              respect_dnt: !1,
              sanitize_properties: null,
              request_headers: {},
              request_batching: !0,
              properties_string_max_length: 65535,
              mask_all_element_attributes: !1,
              mask_all_text: !1,
              mask_personal_data_properties: !1,
              custom_personal_data_properties: [],
              advanced_disable_flags: !1,
              advanced_disable_decide: !1,
              advanced_disable_feature_flags: !1,
              advanced_disable_feature_flags_on_first_load: !1,
              advanced_only_evaluate_survey_feature_flags: !1,
              advanced_feature_flags_dedup_per_session: !1,
              advanced_enable_surveys: !1,
              advanced_disable_toolbar_metrics: !1,
              feature_flag_request_timeout_ms: 3e3,
              surveys_request_timeout_ms: 1e4,
              on_request_error(e) {
                ta.error("Bad HTTP status: " + e.statusCode + " " + e.text);
              },
              get_device_id: (e) => e,
              capture_performance: void 0,
              name: "posthog",
              bootstrap: {},
              disable_compression: !1,
              session_idle_timeout_seconds: 1800,
              person_profiles: tZ,
              before_send: void 0,
              request_queue_config: { flush_interval_ms: 3e3 },
              error_tracking: {},
              _onCapture: rr,
              __preview_eager_load_replay: !1,
            },
            ((e) => ({
              rageclick: !e || "2025-11-30" > e || { content_ignorelist: !0 },
              capture_pageview: !e || "2025-05-24" > e || "history_change",
              session_recording: e && e >= "2025-11-30" ? { strictMinimumDuration: !0 } : {},
              external_scripts_inject_target: e && e >= "2026-01-30" ? "head" : "body",
              internal_or_test_user_hostname:
                e && e >= "2026-01-30" ? /^(localhost|127\.0\.0\.1)$/ : void 0,
            }))(e),
          );
        },
        rp = [
          ["process_person", "person_profiles"],
          ["xhr_headers", "request_headers"],
          ["cookie_name", "persistence_name"],
          ["disable_cookie", "disable_persistence"],
          ["store_google", "save_campaign_params"],
          ["verbose", "debug"],
        ],
        rv = (e) => {
          var t = {};
          for (var [i, s] of rp) M(e[i]) || (t[s] = e[i]);
          var r = t4({}, t, e);
          return (
            T(e.property_blacklist) &&
              (M(e.property_denylist)
                ? (r.property_denylist = e.property_blacklist)
                : T(e.property_denylist)
                  ? (r.property_denylist = [...e.property_blacklist, ...e.property_denylist])
                  : ta.error(rl + e.property_denylist)),
            r
          );
        };
      class rg {
        constructor() {
          this.__forceAllowLocalhost = !1;
        }
        get wi() {
          return this.__forceAllowLocalhost;
        }
        set wi(e) {
          ta.error(
            "WebPerformanceObserver is deprecated and has no impact on network capture. Use `_forceAllowLocalhostNetworkCapture` on `posthog.sessionRecording`",
          ),
            (this.__forceAllowLocalhost = e);
        }
      }
      class r_ {
        Ii(e, t) {
          if (e) {
            var i = this.Ci.indexOf(e);
            -1 !== i && this.Ci.splice(i, 1);
          }
          return this.Ci.push(t), null == t.initialize || t.initialize(), t;
        }
        get decideEndpointWasHit() {
          var e, t;
          return null != (e = null == (t = this.featureFlags) ? void 0 : t.hasLoadedFlags) && e;
        }
        get flagsEndpointWasHit() {
          var e, t;
          return null != (e = null == (t = this.featureFlags) ? void 0 : t.hasLoadedFlags) && e;
        }
        constructor() {
          (this.webPerformance = new rg()),
            (this.Si = !1),
            (this.version = g.LIB_VERSION),
            (this.ki = new sV()),
            (this.Ci = []),
            (this._calculate_event_properties = this.calculateEventProperties.bind(this)),
            (this.config = rd()),
            (this.SentryIntegration = iI),
            (this.sentryIntegration = (e) =>
              ((e, t) => {
                var i = iC(e, t);
                return { name: iT, processEvent: (e) => i(e) };
              })(this, e)),
            (this.__request_queue = []),
            (this.__loaded = !1),
            (this.analyticsDefaultEndpoint = "/e/"),
            (this.xi = !1),
            (this.Ti = null),
            (this.Ai = null),
            (this.Ei = null),
            (this.scrollManager = new sH(this)),
            (this.pageViewManager = new iO(this)),
            (this.rateLimiter = new i7(this)),
            (this.requestRouter = new s3(this)),
            (this.consent = new ik(this)),
            (this.externalIntegrations = new rt(this));
          var e,
            t = null != (e = r_.__defaultExtensionClasses) ? e : {};
          (this.featureFlags = t.featureFlags && new t.featureFlags(this)),
            (this.toolbar = t.toolbar && new t.toolbar(this)),
            (this.surveys = t.surveys && new t.surveys(this)),
            (this.conversations = t.conversations && new t.conversations(this)),
            (this.logs = t.logs && new t.logs(this)),
            (this.experiments = t.experiments && new t.experiments(this)),
            (this.exceptions = t.exceptions && new t.exceptions(this)),
            (this.people = {
              set: (e, t, i) => {
                var s = A(e) ? { [e]: t } : e;
                this.setPersonProperties(s), null == i || i({});
              },
              set_once: (e, t, i) => {
                var s = A(e) ? { [e]: t } : e;
                this.setPersonProperties(void 0, s), null == i || i({});
              },
            }),
            this.on("eventCaptured", (e) =>
              ta.info('send "' + (null == e ? void 0 : e.event) + '"', e),
            );
        }
        init(e, t, i) {
          if (i && i !== rc) {
            var s,
              r = null != (s = ri[i]) ? s : new r_();
            return r._init(e, t, i), (ri[i] = r), (ri[rc][i] = r), r;
          }
          return this._init(e, t, i);
        }
        _init(e, t, i) {
          if ((void 0 === t && (t = {}), M(e) || L(e)))
            return (
              ta.critical(
                "PostHog was initialized without a token. This likely indicates a misconfiguration. Please check the first argument passed to posthog.init()",
              ),
              this
            );
          if (this.__loaded)
            return (
              console.warn(
                "[PostHog.js]",
                "You have already initialized PostHog! Re-initializing is a no-op",
              ),
              this
            );
          (this.__loaded = !0),
            (this.config = {}),
            (t.debug = this.Ri(t.debug)),
            (this.Ni = t),
            (this.Mi = []),
            t.person_profiles
              ? (this.Ai = t.person_profiles)
              : t.process_person && (this.Ai = t.process_person),
            this.set_config(t4({}, rd(t.defaults), rv(t), { name: i, token: e })),
            this.config.on_xhr_error &&
              ta.error("on_xhr_error is deprecated. Use on_request_error instead"),
            (this.compression = t.disable_compression ? void 0 : st.GZipJS);
          var r,
            n,
            o,
            a,
            l = this.Fi();
          (this.persistence = new iQ(this.config, l)),
            (this.sessionPersistence =
              "sessionStorage" === this.config.persistence || "memory" === this.config.persistence
                ? this.persistence
                : new iQ(m({}, this.config, { persistence: "sessionStorage" }), l));
          var u = m({}, this.persistence.props),
            c = m({}, this.sessionPersistence.props);
          this.register({ $initialization_time: new Date().toISOString() }),
            (this.Oi = new sq((e) => this.Pi(e), this.config.request_queue_config)),
            (this.Li = new sW(this)),
            (this.__request_queue = []);
          var h =
            this.config.cookieless_mode === tY ||
            (this.config.cookieless_mode === tK && this.consent.isExplicitlyOptedOut());
          h ||
            ((this.sessionManager = new sK(this)),
            (this.sessionPropsManager = new sB(this, this.sessionManager, this.persistence)));
          var d =
              null == (r = p._POSTHOG_REMOTE_CONFIG) || null == (r = r[this.config.token])
                ? void 0
                : r.config,
            v = null == d || null == (n = d.sdkVersion) ? void 0 : n.resolved;
          if (
            (v &&
              (ru.test(v)
                ? (this._resolvedSdkVersion = v)
                : ta.warn(
                    "Ignoring invalid preloaded sdkVersion.resolved from remote config: " + v,
                  )),
            this.config.__preview_deferred_init_extensions
              ? (ta.info("Deferring extension initialization to improve startup performance"),
                setTimeout(() => {
                  this.Di(h);
                }, 0))
              : (ta.info("Initializing extensions synchronously"), this.Di(h)),
            (g.DEBUG = g.DEBUG || this.config.debug),
            g.DEBUG &&
              ta.info("Starting in debug mode", {
                this: this,
                config: t,
                thisC: m({}, this.config),
                p: u,
                s: c,
              }),
            !this.config.identity_distinct_id ||
              (null != (o = t.bootstrap) && o.distinctID) ||
              (t.bootstrap = m({}, t.bootstrap, {
                distinctID: this.config.identity_distinct_id,
                isIdentifiedID: !0,
              })),
            void 0 !== (null == (a = t.bootstrap) ? void 0 : a.distinctID))
          ) {
            var _ = t.bootstrap.distinctID,
              f = this.get_distinct_id(),
              y = this.persistence.get_property(tD);
            if (t.bootstrap.isIdentifiedID && null != f && f !== _ && y === tJ) this.identify(_);
            else if (t.bootstrap.isIdentifiedID && null != f && f !== _ && y === tX)
              ta.warn(
                "Bootstrap distinctID differs from an already-identified user. The existing identity is preserved. Call reset() before reinitializing if you intend to switch users.",
              );
            else {
              var b = this.config.get_device_id(ih()),
                w = t.bootstrap.isIdentifiedID ? b : _;
              this.persistence.set_property(tD, t.bootstrap.isIdentifiedID ? tX : tJ),
                this.register({ distinct_id: _, $device_id: w });
            }
          }
          if (h) this.register_once({ distinct_id: tB, $device_id: null }, "");
          else if (!this.get_distinct_id()) {
            var x = this.config.get_device_id(ih());
            this.register_once({ distinct_id: x, $device_id: x }, ""),
              this.persistence.set_property(tD, tJ);
          }
          return (
            is(s, "onpagehide" in self ? "pagehide" : "unload", this._handle_unload.bind(this), {
              passive: !1,
            }),
            t.segment
              ? ((e, t) => {
                  var i = e.config.segment;
                  if (!i) return t();
                  !((e, t) => {
                    var i = e.config.segment;
                    if (!i) return t();
                    var s = (i) => {
                        var s = () => i.anonymousId() || ih();
                        (e.config.get_device_id = s),
                          i.id() &&
                            (e.register({ distinct_id: i.id(), $device_id: s() }),
                            e.persistence.set_property(tD, tX)),
                          t();
                      },
                      r = i.user();
                    "then" in r && C(r.then) ? r.then(s) : s(r);
                  })(e, () => {
                    var s;
                    i.register(
                      ((Promise && Promise.resolve) ||
                        i$.warn(
                          "This browser does not have Promise support, and can not use the segment integration",
                        ),
                      (s = (t, i) => {
                        if (!i) return t;
                        t.event.userId ||
                          t.event.anonymousId === e.get_distinct_id() ||
                          (i$.info("No userId set, resetting PostHog"), e.reset()),
                          t.event.userId &&
                            t.event.userId !== e.get_distinct_id() &&
                            (i$.info("UserId set, identifying with PostHog"),
                            e.identify(t.event.userId));
                        var s = e.calculateEventProperties(i, t.event.properties);
                        return (t.event.properties = Object.assign({}, s, t.event.properties)), t;
                      }),
                      {
                        name: "PostHog JS",
                        type: "enrichment",
                        version: "1.0.0",
                        isLoaded: () => !0,
                        load: () => Promise.resolve(),
                        track: (e) => s(e, e.event.event),
                        page: (e) => s(e, t1),
                        identify: (e) => s(e, t3),
                        screen: (e) => s(e, "$screen"),
                      }),
                    ).then(() => {
                      t();
                    });
                  });
                })(this, () => this.Bi())
              : this.Bi(),
            C(this.config._onCapture) &&
              this.config._onCapture !== rr &&
              (ta.warn("onCapture is deprecated. Please use `before_send` instead"),
              this.on("eventCaptured", (e) => this.config._onCapture(e.event, e))),
            this.config.ip &&
              ta.warn(
                'The `ip` config option has NO EFFECT AT ALL and has been deprecated. Use a custom transformation or "Discard IP data" project setting instead. See https://posthog.com/tutorials/web-redact-properties#hiding-customer-ip-address for more information.',
              ),
            this
          );
        }
        Di(e) {
          var t,
            i,
            s,
            r,
            n,
            o,
            a,
            l = performance.now(),
            u = m({}, r_.__defaultExtensionClasses, this.config.__extensionClasses),
            c = [];
          u.featureFlags &&
            this.Ci.push(
              (this.featureFlags = null != (t = this.featureFlags) ? t : new u.featureFlags(this)),
            ),
            u.exceptions &&
              this.Ci.push(
                (this.exceptions = null != (i = this.exceptions) ? i : new u.exceptions(this)),
              ),
            u.historyAutocapture &&
              this.Ci.push((this.historyAutocapture = new u.historyAutocapture(this))),
            u.tracingHeaders && this.Ci.push(new u.tracingHeaders(this)),
            u.siteApps && this.Ci.push((this.siteApps = new u.siteApps(this))),
            u.sessionRecording &&
              !e &&
              this.Ci.push((this.sessionRecording = new u.sessionRecording(this))),
            this.config.disable_scroll_properties ||
              c.push(() => {
                this.scrollManager.startMeasuringScrollPosition();
              }),
            u.autocapture && this.Ci.push((this.autocapture = new u.autocapture(this))),
            u.surveys &&
              this.Ci.push((this.surveys = null != (s = this.surveys) ? s : new u.surveys(this))),
            u.logs && this.Ci.push((this.logs = null != (r = this.logs) ? r : new u.logs(this))),
            u.conversations &&
              this.Ci.push(
                (this.conversations =
                  null != (n = this.conversations) ? n : new u.conversations(this)),
              ),
            u.productTours && this.Ci.push((this.productTours = new u.productTours(this))),
            u.heatmaps && this.Ci.push((this.heatmaps = new u.heatmaps(this))),
            u.webVitalsAutocapture &&
              this.Ci.push((this.webVitalsAutocapture = new u.webVitalsAutocapture(this))),
            u.exceptionObserver &&
              this.Ci.push((this.exceptionObserver = new u.exceptionObserver(this))),
            u.deadClicksAutocapture &&
              this.Ci.push((this.deadClicksAutocapture = new u.deadClicksAutocapture(this, iR))),
            u.toolbar &&
              this.Ci.push((this.toolbar = null != (o = this.toolbar) ? o : new u.toolbar(this))),
            u.experiments &&
              this.Ci.push(
                (this.experiments = null != (a = this.experiments) ? a : new u.experiments(this)),
              ),
            this.Ci.forEach((e) => {
              e.initialize &&
                c.push(() => {
                  null == e.initialize || e.initialize();
                });
            }),
            c.push(() => {
              if (this.ji) {
                var e = this.ji;
                (this.ji = void 0), this.Sr(e);
              }
            }),
            this.qi(c, l);
        }
        qi(e, t) {
          for (; e.length > 0; ) {
            if (
              this.config.__preview_deferred_init_extensions &&
              performance.now() - t >= 30 &&
              e.length > 0
            )
              return void setTimeout(() => {
                this.qi(e, t);
              }, 0);
            var i = e.shift();
            if (i)
              try {
                i();
              } catch (e) {
                ta.error("Error initializing extension:", e);
              }
          }
          var s = Math.round(performance.now() - t);
          this.register_for_session({
            $sdk_debug_extensions_init_method: this.config.__preview_deferred_init_extensions
              ? "deferred"
              : "synchronous",
            $sdk_debug_extensions_init_time_ms: s,
          }),
            this.config.__preview_deferred_init_extensions &&
              ta.info("PostHog extensions initialized (" + s + "ms)");
        }
        Sr(e) {
          var t;
          if (!o || !o.body)
            return (
              ta.info("document not ready yet, trying again in 500 milliseconds..."),
              void setTimeout(() => {
                this.Sr(e);
              }, 500)
            );
          this.config.__preview_deferred_init_extensions && (this.ji = e),
            (this.compression = void 0),
            e.supportedCompression &&
              !this.config.disable_compression &&
              (this.compression = k(e.supportedCompression, st.GZipJS)
                ? st.GZipJS
                : k(e.supportedCompression, st.Base64)
                  ? st.Base64
                  : void 0),
            null != (t = e.analytics) &&
              t.endpoint &&
              (this.analyticsDefaultEndpoint = e.analytics.endpoint),
            this.set_config({ person_profiles: this.Ai ? this.Ai : tZ }),
            this.Ci.forEach((t) => (null == t.onRemoteConfig ? void 0 : t.onRemoteConfig(e)));
        }
        Bi() {
          try {
            this.config.loaded(this);
          } catch (e) {
            ta.critical("`loaded` function failed", e);
          }
          if ((this.Zi(), this.config.internal_or_test_user_hostname && null != a && a.hostname)) {
            var e = a.hostname,
              t = this.config.internal_or_test_user_hostname;
            ("string" == typeof t ? e === t : t.test(e)) && this.setInternalOrTestUser();
          }
          this.config.capture_pageview &&
            setTimeout(() => {
              (this.consent.isOptedIn() || this.config.cookieless_mode === tY) && this.$i();
            }, 1),
            (this.Hi = new se(this)),
            this.Hi.load();
        }
        Zi() {
          var e;
          this.is_capturing() &&
            this.config.request_batching &&
            (null == (e = this.Oi) || e.enable());
        }
        _dom_loaded() {
          this.is_capturing() && t6(this.__request_queue, (e) => this.Pi(e)),
            (this.__request_queue = []),
            this.Zi();
        }
        _handle_unload() {
          var e, t, i;
          null == (e = this.surveys) || e.handlePageUnload(),
            this.config.request_batching
              ? (this.Vi() && this.capture(t2),
                null == (t = this.Oi) || t.unload(),
                null == (i = this.Li) || i.unload())
              : this.Vi() && this.capture(t2, null, { transport: "sendBeacon" });
        }
        _send_request(e) {
          this.__loaded &&
            (rh
              ? this.__request_queue.push(e)
              : this.rateLimiter.isServerRateLimited(e.batchKey) ||
                ((e.transport = e.transport || this.config.api_transport),
                (e.url = sA(e.url, { ip: +!!this.config.ip })),
                (e.headers = m({}, this.config.request_headers, e.headers)),
                (e.compression =
                  "best-available" === e.compression ? this.compression : e.compression),
                (e.disableXHRCredentials = this.config.__preview_disable_xhr_credentials),
                this.config.__preview_disable_beacon && (e.disableTransport = ["sendBeacon"]),
                (e.fetchOptions = e.fetchOptions || this.config.fetch_options),
                ((e) => {
                  var t,
                    i,
                    s,
                    r = m({}, e);
                  (r.timeout = r.timeout || 6e4),
                    (r.url = sA(r.url, {
                      _: new Date().getTime().toString(),
                      ver: g.JS_SDK_VERSION,
                      compression: r.compression,
                    }));
                  var n = null != (t = r.transport) ? t : "fetch",
                    o = sN.filter(
                      (e) =>
                        !r.disableTransport ||
                        !e.transport ||
                        !r.disableTransport.includes(e.transport),
                    ),
                    a =
                      null !=
                      (i =
                        null ==
                        (s = ((e, t) => {
                          for (var i = 0; e.length > i; i++) if (e[i].transport === n) return e[i];
                        })(o))
                          ? void 0
                          : s.method)
                        ? i
                        : o[0].method;
                  if (!a) throw Error("No available transport method");
                  "sendBeacon" !== n && r.data && r.compression === st.GZipJS && h
                    ? sj(r)
                        .then((e) => {
                          a(e);
                        })
                        .catch(() => {
                          a(r);
                        })
                    : a(r);
                })(
                  m({}, e, {
                    callback: (t) => {
                      var i, s;
                      this.rateLimiter.checkForLimiting(t),
                        400 > t.statusCode ||
                          null == (i = (s = this.config).on_request_error) ||
                          i.call(s, t),
                        null == e.callback || e.callback(t);
                    },
                  }),
                )));
        }
        Pi(e) {
          this.Li ? this.Li.retriableRequest(e) : this._send_request(e);
        }
        _execute_array(e) {
          rs++;
          try {
            var t,
              i = [],
              s = [],
              r = [];
            t6(e, (e) => {
              e &&
                (T((t = e[0]))
                  ? r.push(e)
                  : C(e)
                    ? e.call(this)
                    : T(e) && "alias" === t
                      ? i.push(e)
                      : T(e) && -1 !== t.indexOf("capture") && C(this[t])
                        ? r.push(e)
                        : s.push(e));
            });
            var n = (e, t) => {
              t6(e, (e) => {
                if (T(e[0])) {
                  var i = t;
                  t8(e, (e) => {
                    i = i[e[0]].apply(i, e.slice(1));
                  });
                } else t[e[0]].apply(t, e.slice(1));
              });
            };
            n(i, this), n(s, this), n(r, this);
          } finally {
            rs--;
          }
        }
        push(e) {
          if (rs > 0 && T(e) && A(e[0])) {
            var t = r_.prototype[e[0]];
            C(t) && t.apply(this, e.slice(1));
          } else this._execute_array([e]);
        }
        capture(e, t, i) {
          var s, r, n, o, a;
          if (this.__loaded && this.persistence && this.sessionPersistence && this.Oi) {
            if (this.is_capturing())
              if (!M(e) && A(e)) {
                var l = !this.config.opt_out_useragent_filter && this._is_bot();
                if (!l || this.config.__preview_capture_bot_pageviews) {
                  var u =
                    null != i && i.skip_client_rate_limiting
                      ? void 0
                      : this.rateLimiter.clientRateLimitContext();
                  if (null == u || !u.isRateLimited) {
                    null != t &&
                      t.$current_url &&
                      !A(null == t ? void 0 : t.$current_url) &&
                      (ta.error(
                        "Invalid `$current_url` property provided to `posthog.capture`. Input must be a string. Ignoring provided value.",
                      ),
                      null == t || delete t.$current_url),
                      "$exception" !== e ||
                        (null != i && i.zi) ||
                        ta.warn(
                          "Using `posthog.capture('$exception')` is unreliable because it does not attach required metadata. Use `posthog.captureException(error)` instead, which attaches required metadata automatically.",
                        ),
                      this.sessionPersistence.update_search_keyword(),
                      this.config.save_campaign_params &&
                        this.sessionPersistence.update_campaign_params(),
                      this.config.save_referrer && this.sessionPersistence.update_referrer_info(),
                      (this.config.save_campaign_params || this.config.save_referrer) &&
                        this.persistence.set_initial_person_info();
                    var c = new Date(),
                      h = (null == i ? void 0 : i.timestamp) || c,
                      d = ih(),
                      p = {
                        uuid: d,
                        event: e,
                        properties: this.calculateEventProperties(e, t || {}, h, d),
                      };
                    e === t1 &&
                      this.config.__preview_capture_bot_pageviews &&
                      l &&
                      ((p.event = "$bot_pageview"), (p.properties.$browser_type = "bot")),
                      u && (p.properties.$lib_rate_limit_remaining_tokens = u.remainingTokens),
                      (null == i ? void 0 : i.$set) && (p.$set = null == i ? void 0 : i.$set);
                    var v,
                      g = this.Yi(null == i ? void 0 : i.$set_once, e !== t5, e === t3);
                    if (
                      (g && (p.$set_once = g),
                      (null != i && i._noTruncate) ||
                        ((r = this.config.properties_string_max_length),
                        (n = p),
                        (o = (e) => (A(e) ? e.slice(0, r) : e)),
                        (a = new Set()),
                        (p = (function e(t, i) {
                          var s;
                          return t !== Object(t)
                            ? o
                              ? o(t)
                              : t
                            : a.has(t)
                              ? void 0
                              : (a.add(t),
                                T(t)
                                  ? ((s = []),
                                    t6(t, (t) => {
                                      s.push(e(t));
                                    }))
                                  : ((s = {}),
                                    t8(t, (t, i) => {
                                      a.has(t) || (s[i] = e(t, i));
                                    })),
                                s);
                        })(n))),
                      (p.timestamp = h),
                      M(null == i ? void 0 : i.timestamp) ||
                        ((p.properties.$event_time_override_provided = !0),
                        (p.properties.$event_time_override_system_time = c)),
                      e === i2.DISMISSED || e === i2.SENT)
                    ) {
                      var _,
                        f,
                        y,
                        b = null == t ? void 0 : t[i3.SURVEY_ID],
                        w = null == t ? void 0 : t[i3.SURVEY_ITERATION];
                      (v = { id: b, current_iteration: w }),
                        localStorage.getItem(s8(v)) || localStorage.setItem(s8(v), "true"),
                        (p.$set = m({}, p.$set, {
                          [((_ = { id: b, current_iteration: w }),
                          (y =
                            "$survey_" +
                            (f = e === i2.SENT ? "responded" : "dismissed") +
                            "/" +
                            _.id),
                          _.current_iteration &&
                            _.current_iteration > 0 &&
                            (y = "$survey_" + f + "/" + _.id + "/" + _.current_iteration),
                          y)]: !0,
                        }));
                    } else
                      e === i2.SHOWN &&
                        (p.$set = m({}, p.$set, {
                          [i3.SURVEY_LAST_SEEN_DATE]: new Date().toISOString(),
                        }));
                    if (e === i6.SHOWN) {
                      var x = null == t ? void 0 : t[i8.TOUR_TYPE];
                      x &&
                        (p.$set = m({}, p.$set, {
                          [i8.TOUR_LAST_SEEN_DATE + "/" + x]: new Date().toISOString(),
                        }));
                    }
                    var E = m({}, p.properties.$set, p.$set);
                    if (
                      (O(E) || this.setPersonPropertiesForFlags(E), !D(this.config.before_send))
                    ) {
                      var k = this.Ui(p);
                      if (!k) return;
                      p = k;
                    }
                    this.ki.emit("eventCaptured", p);
                    var S = {
                      method: "POST",
                      url:
                        null != (s = null == i ? void 0 : i._url)
                          ? s
                          : this.requestRouter.endpointFor("api", this.analyticsDefaultEndpoint),
                      data: p,
                      compression: "best-available",
                      batchKey: null == i ? void 0 : i._batchKey,
                    };
                    return (
                      !this.config.request_batching ||
                      (i && (null == i || !i._batchKey)) ||
                      (null != i && i.send_instantly)
                        ? this.Pi(S)
                        : this.Oi.enqueue(S),
                      p
                    );
                  }
                  ta.critical("This capture call is ignored due to client rate limiting.");
                }
              } else ta.error("No event name provided to posthog.capture");
          } else ta.uninitializedWarning("posthog.capture");
        }
        _addCaptureHook(e) {
          return this.on("eventCaptured", (t) => e(t.event, t));
        }
        calculateEventProperties(e, t, i, r, n) {
          if (((i = i || new Date()), !this.persistence || !this.sessionPersistence)) return t;
          var l,
            u = n ? void 0 : this.persistence.remove_event_timer(e),
            c = m({}, t);
          if (
            ((c.token = this.config.token),
            (c.$config_defaults = this.config.defaults),
            (this.config.cookieless_mode == tY ||
              (this.config.cookieless_mode == tK && this.consent.isExplicitlyOptedOut())) &&
              (c.$cookieless_mode = !0),
            "$snapshot" === e)
          ) {
            var h = m({}, this.persistence.properties(), this.sessionPersistence.properties());
            return (
              (c.distinct_id = h.distinct_id),
              ((!A(c.distinct_id) && !j(c.distinct_id)) || L(c.distinct_id)) &&
                ta.error(
                  "Invalid distinct_id for replay event. This indicates a bug in your implementation",
                ),
              c
            );
          }
          var p,
            v = ((e, t) => {
              if (!d) return {};
              var i,
                r,
                n,
                o,
                l,
                u,
                c,
                h,
                p,
                v,
                _,
                f = e ? [...iN, ...(t || [])] : [],
                [m, y] = ((e) => {
                  for (var t = 0; eB.length > t; t++) {
                    var [i, s] = eB[t],
                      r = i.exec(e),
                      n = r && (C(s) ? s(r, e) : s);
                    if (n) return n;
                  }
                  return ["", ""];
                })(d);
              return t4(
                it({
                  $os: m,
                  $os_version: y,
                  $browser: eW(d, navigator.vendor),
                  $device: eV(d),
                  $device_type:
                    ((u = {
                      userAgentDataPlatform:
                        null == (i = navigator) || null == (i = i.userAgentData)
                          ? void 0
                          : i.platform,
                      maxTouchPoints: null == (r = navigator) ? void 0 : r.maxTouchPoints,
                      screenWidth: null == s || null == (n = s.screen) ? void 0 : n.width,
                      screenHeight: null == s || null == (o = s.screen) ? void 0 : o.height,
                      devicePixelRatio: null == s ? void 0 : s.devicePixelRatio,
                    }),
                    (_ = eV(d)) === es ||
                    _ === ei ||
                    "Kobo" === _ ||
                    "Kindle Fire" === _ ||
                    _ === eO
                      ? et
                      : _ === ex || _ === ek || _ === eE || _ === eT
                        ? "Console"
                        : _ === en
                          ? "Wearable"
                          : _
                            ? Q
                            : "Android" === (null == u ? void 0 : u.userAgentDataPlatform) &&
                                (null != (c = null == u ? void 0 : u.maxTouchPoints) ? c : 0) > 0
                              ? 600 >
                                Math.min(
                                  null != (h = null == u ? void 0 : u.screenWidth) ? h : 0,
                                  null != (p = null == u ? void 0 : u.screenHeight) ? p : 0,
                                ) /
                                  (null != (v = null == u ? void 0 : u.devicePixelRatio) ? v : 1)
                                ? Q
                                : et
                              : "Desktop"),
                  $timezone: iX(),
                  $timezone_offset: (() => {
                    try {
                      return new Date().getTimezoneOffset();
                    } catch (e) {
                      return;
                    }
                  })(),
                }),
                {
                  $current_url: iL(null == a ? void 0 : a.href, f, iU),
                  $host: null == a ? void 0 : a.host,
                  $pathname: null == a ? void 0 : a.pathname,
                  $raw_user_agent: d.length > 1e3 ? d.substring(0, 997) + "..." : d,
                  $browser_version: ez(d, navigator.vendor),
                  $browser_language: iV(),
                  $browser_language_prefix:
                    "string" == typeof (l = iV()) ? l.split("-")[0] : void 0,
                  $screen_height: null == s ? void 0 : s.screen.height,
                  $screen_width: null == s ? void 0 : s.screen.width,
                  $viewport_height: null == s ? void 0 : s.innerHeight,
                  $viewport_width: null == s ? void 0 : s.innerWidth,
                  $lib: g.LIB_NAME,
                  $lib_version: g.LIB_VERSION,
                  $insert_id:
                    Math.random().toString(36).substring(2, 10) +
                    Math.random().toString(36).substring(2, 10),
                  $time: Date.now() / 1e3,
                },
              );
            })(
              this.config.mask_personal_data_properties,
              this.config.custom_personal_data_properties,
            );
          if (this.sessionManager) {
            var { sessionId: _, windowId: f } = this.sessionManager.checkAndGetSessionAndWindowId(
              n,
              i.getTime(),
            );
            (c.$session_id = _), (c.$window_id = f);
          }
          this.sessionPropsManager && t4(c, this.sessionPropsManager.getSessionProps());
          try {
            this.sessionRecording && t4(c, this.sessionRecording.sdkDebugProperties),
              (c.$sdk_debug_retry_queue_size = null == (l = this.Li) ? void 0 : l.length);
          } catch (e) {
            c.$sdk_debug_error_capturing_properties = String(e);
          }
          if (
            (this.requestRouter.region === s1 && (c.$lib_custom_api_host = this.config.api_host),
            (p =
              e !== t1 || n
                ? e !== t2 || n
                  ? this.pageViewManager.doEvent()
                  : this.pageViewManager.doPageLeave(i)
                : this.pageViewManager.doPageView(i, r)),
            (c = t4(c, p)),
            e === t1 && o && (c.title = o.title),
            !M(u))
          ) {
            var y = i.getTime() - u;
            c.$duration = parseFloat((y / 1e3).toFixed(3));
          }
          d &&
            this.config.opt_out_useragent_filter &&
            (c.$browser_type = this._is_bot() ? "bot" : "browser"),
            ((c = t4(
              {},
              v,
              this.persistence.properties(),
              this.sessionPersistence.properties(),
              c,
            )).$is_identified = this._isIdentified()),
            T(this.config.property_denylist)
              ? t8(this.config.property_denylist, (e) => {
                  delete c[e];
                })
              : ta.error(
                  rl +
                    this.config.property_denylist +
                    " or property_blacklist config: " +
                    this.config.property_blacklist,
                );
          var b = this.config.sanitize_properties;
          b && (ta.error(ra), (c = b(c, e)));
          var w = this.Wi();
          return (
            (c.$process_person_profile = w), w && !n && this.Gi("_calculate_event_properties"), c
          );
        }
        Yi(e, t, i) {
          if (
            (void 0 === t && (t = !0),
            void 0 === i && (i = !1),
            !this.persistence || !this.Wi() || (this.Si && !i))
          )
            return e;
          var s,
            r = t4(
              {},
              this.persistence.get_initial_props(),
              (null == (s = this.sessionPropsManager) ? void 0 : s.getSetOnceProps()) || {},
              e || {},
            ),
            n = this.config.sanitize_properties;
          return (
            n && (ta.error(ra), (r = n(r, "$set_once"))), t && (this.Si = !0), O(r) ? void 0 : r
          );
        }
        register(e, t) {
          var i;
          null == (i = this.persistence) || i.register(e, t);
        }
        register_once(e, t, i) {
          var s;
          null == (s = this.persistence) || s.register_once(e, t, i);
        }
        register_for_session(e) {
          var t;
          null == (t = this.sessionPersistence) || t.register(e);
        }
        unregister(e) {
          var t;
          null == (t = this.persistence) || t.unregister(e);
        }
        unregister_for_session(e) {
          var t;
          null == (t = this.sessionPersistence) || t.unregister(e);
        }
        Xi(e, t) {
          this.register({ [e]: t });
        }
        getFeatureFlag(e, t) {
          var i;
          return null == (i = this.featureFlags) ? void 0 : i.getFeatureFlag(e, t);
        }
        getFeatureFlagPayload(e) {
          var t;
          return null == (t = this.featureFlags) ? void 0 : t.getFeatureFlagPayload(e);
        }
        getFeatureFlagResult(e, t) {
          var i;
          return null == (i = this.featureFlags) ? void 0 : i.getFeatureFlagResult(e, t);
        }
        isFeatureEnabled(e, t) {
          var i;
          return null == (i = this.featureFlags) ? void 0 : i.isFeatureEnabled(e, t);
        }
        reloadFeatureFlags() {
          var e;
          null == (e = this.featureFlags) || e.reloadFeatureFlags();
        }
        updateFlags(e, t, i) {
          var s;
          null == (s = this.featureFlags) || s.updateFlags(e, t, i);
        }
        updateEarlyAccessFeatureEnrollment(e, t, i) {
          var s;
          null == (s = this.featureFlags) || s.updateEarlyAccessFeatureEnrollment(e, t, i);
        }
        getEarlyAccessFeatures(e, t, i) {
          var s;
          return (
            void 0 === t && (t = !1),
            null == (s = this.featureFlags) ? void 0 : s.getEarlyAccessFeatures(e, t, i)
          );
        }
        on(e, t) {
          return this.ki.on(e, t);
        }
        onFeatureFlags(e) {
          return this.featureFlags
            ? this.featureFlags.onFeatureFlags(e)
            : (e([], {}, { errorsLoading: !0 }), () => {});
        }
        onSurveysLoaded(e) {
          return this.surveys
            ? this.surveys.onSurveysLoaded(e)
            : (e([], { isLoaded: !1, error: ro }), () => {});
        }
        onSessionId(e) {
          var t, i;
          return null != (t = null == (i = this.sessionManager) ? void 0 : i.onSessionId(e))
            ? t
            : () => {};
        }
        getSurveys(e, t) {
          void 0 === t && (t = !1),
            this.surveys ? this.surveys.getSurveys(e, t) : e([], { isLoaded: !1, error: ro });
        }
        getActiveMatchingSurveys(e, t) {
          void 0 === t && (t = !1),
            this.surveys
              ? this.surveys.getActiveMatchingSurveys(e, t)
              : e([], { isLoaded: !1, error: ro });
        }
        renderSurvey(e, t) {
          var i;
          null == (i = this.surveys) || i.renderSurvey(e, t);
        }
        displaySurvey(e, t) {
          var i;
          void 0 === t && (t = s7), null == (i = this.surveys) || i.displaySurvey(e, t);
        }
        cancelPendingSurvey(e) {
          var t;
          null == (t = this.surveys) || t.cancelPendingSurvey(e);
        }
        canRenderSurvey(e) {
          var t, i;
          return null != (t = null == (i = this.surveys) ? void 0 : i.canRenderSurvey(e))
            ? t
            : { visible: !1, disabledReason: ro };
        }
        canRenderSurveyAsync(e, t) {
          var i, s;
          return (
            void 0 === t && (t = !1),
            null != (i = null == (s = this.surveys) ? void 0 : s.canRenderSurveyAsync(e, t))
              ? i
              : Promise.resolve({ visible: !1, disabledReason: ro })
          );
        }
        Ji(e) {
          return !e || L(e)
            ? (ta.critical("Unique user id has not been set in posthog.identify"), !1)
            : e === tB
              ? (ta.critical(
                  'The string "' +
                    e +
                    '" was set in posthog.identify which indicates an error. This ID is only used as a sentinel value.',
                ),
                !1)
              : (!["distinct_id", "distinctid"].includes(e.toLowerCase()) &&
                  !["undefined", "null"].includes(e.toLowerCase())) ||
                (ta.critical(
                  'The string "' +
                    e +
                    '" was set in posthog.identify which indicates an error. This ID should be unique to the user and not a hardcoded string.',
                ),
                !1);
        }
        identify(e, t, i) {
          if (!this.__loaded || !this.persistence)
            return ta.uninitializedWarning("posthog.identify");
          if (
            (j(e) &&
              ((e = e.toString()),
              ta.warn(
                "The first argument to posthog.identify was a number, but it should be a string. It has been converted to a string.",
              )),
            this.Ji(e) && this.Gi("posthog.identify"))
          ) {
            var s = this.get_distinct_id();
            this.register({ $user_id: e }),
              this.get_property(td) ||
                this.register_once({ $had_persisted_distinct_id: !0, $device_id: s }, ""),
              e !== s &&
                e !== this.get_property(tp) &&
                (this.unregister(tp), this.register({ distinct_id: e }));
            var r,
              n = (this.persistence.get_property(tD) || tJ) === tJ;
            e !== s && n
              ? (this.persistence.set_property(tD, tX),
                this.setPersonPropertiesForFlags({ $set: t || {}, $set_once: i || {} }, !1),
                this.capture(
                  t3,
                  { distinct_id: e, $anon_distinct_id: s },
                  { $set: t || {}, $set_once: i || {} },
                ),
                (this.Ei = sX(e, t, i)),
                null == (r = this.featureFlags) || r.setAnonymousDistinctId(s))
              : (t || i) && this.setPersonProperties(t, i),
              e !== s && (this.reloadFeatureFlags(), this.unregister(tO));
          }
        }
        setPersonProperties(e, t) {
          if ((e || t) && this.Gi("posthog.setPersonProperties")) {
            var i = sX(this.get_distinct_id(), e, t);
            this.Ei !== i
              ? (this.setPersonPropertiesForFlags({ $set: e || {}, $set_once: t || {} }, !0),
                this.capture("$set", { $set: e || {}, $set_once: t || {} }),
                (this.Ei = i))
              : ta.info(
                  "A duplicate setPersonProperties call was made with the same properties. It has been ignored.",
                );
          }
        }
        group(e, t, i) {
          if (e && t) {
            var s = this.getGroups(),
              r = s[e] !== t;
            if (
              (r && this.resetGroupPropertiesForFlags(e),
              this.register({ $groups: m({}, s, { [e]: t }) }),
              r || i)
            ) {
              var n = { $group_type: e, $group_key: t };
              i && (n.$group_set = i), this.capture(t5, n);
            }
            i && this.setGroupPropertiesForFlags({ [e]: i }), r && !i && this.reloadFeatureFlags();
          } else ta.error("posthog.group requires a group type and group key");
        }
        resetGroups() {
          this.register({ $groups: {} }),
            this.resetGroupPropertiesForFlags(),
            this.reloadFeatureFlags();
        }
        setPersonPropertiesForFlags(e, t) {
          var i;
          void 0 === t && (t = !0),
            null == (i = this.featureFlags) || i.setPersonPropertiesForFlags(e, t);
        }
        resetPersonPropertiesForFlags() {
          var e;
          null == (e = this.featureFlags) || e.resetPersonPropertiesForFlags();
        }
        setGroupPropertiesForFlags(e, t) {
          var i;
          void 0 === t && (t = !0),
            this.Gi("posthog.setGroupPropertiesForFlags") &&
              (null == (i = this.featureFlags) || i.setGroupPropertiesForFlags(e, t));
        }
        resetGroupPropertiesForFlags(e) {
          var t;
          null == (t = this.featureFlags) || t.resetGroupPropertiesForFlags(e);
        }
        reset(e) {
          if ((ta.info("reset"), !this.__loaded)) return ta.uninitializedWarning("posthog.reset");
          var t,
            i,
            s,
            r,
            n,
            o,
            a,
            l,
            u = this.get_property(td);
          if (
            (this.consent.reset(),
            null == (t = this.persistence) || t.clear(),
            null == (i = this.sessionPersistence) || i.clear(),
            null == (s = this.surveys) || s.reset(),
            null == (r = this.Hi) || r.stop(),
            null == (n = this.featureFlags) || n.reset(),
            null == (o = this.conversations) || o.reset(),
            null == (a = this.persistence) || a.set_property(tD, tJ),
            null == (l = this.sessionManager) || l.resetSessionId(),
            (this.Ei = null),
            this.config.cookieless_mode === tY)
          )
            this.register_once({ distinct_id: tB, $device_id: null }, "");
          else {
            var c = this.config.get_device_id(ih());
            this.register_once({ distinct_id: c, $device_id: e ? c : u }, "");
          }
          this.register({ $last_posthog_reset: new Date().toISOString() }, 1),
            delete this.config.identity_distinct_id,
            delete this.config.identity_hash,
            this.reloadFeatureFlags();
        }
        setIdentity(e, t) {
          var i;
          (this.config.identity_distinct_id = e),
            (this.config.identity_hash = t),
            this.alias(e),
            null == (i = this.conversations) || i.Ki();
        }
        clearIdentity() {
          var e;
          delete this.config.identity_distinct_id,
            delete this.config.identity_hash,
            null == (e = this.conversations) || e.Qi();
        }
        get_distinct_id() {
          return this.get_property("distinct_id");
        }
        getGroups() {
          return this.get_property("$groups") || {};
        }
        get_session_id() {
          var e, t;
          return null !=
            (e =
              null == (t = this.sessionManager)
                ? void 0
                : t.checkAndGetSessionAndWindowId(!0).sessionId)
            ? e
            : "";
        }
        get_session_replay_url(e) {
          if (!this.sessionManager) return "";
          var { sessionId: t, sessionStartTimestamp: i } =
              this.sessionManager.checkAndGetSessionAndWindowId(!0),
            s = this.requestRouter.endpointFor(
              "ui",
              "/project/" + this.config.token + "/replay/" + t,
            );
          if (null != e && e.withTimestamp && i) {
            var r,
              n = null != (r = e.timestampLookBack) ? r : 10;
            if (!i) return s;
            s += "?t=" + Math.max(Math.floor((new Date().getTime() - i) / 1e3) - n, 0);
          }
          return s;
        }
        alias(e, t) {
          return e === this.get_property(th)
            ? (ta.critical("Attempting to create alias for existing People user - aborting."), -2)
            : this.Gi("posthog.alias")
              ? (M(t) && (t = this.get_distinct_id()),
                e !== t
                  ? (this.Xi(tp, e), this.capture("$create_alias", { alias: e, distinct_id: t }))
                  : (ta.warn("alias matches current distinct_id - skipping api call."),
                    this.identify(e),
                    -1))
              : void 0;
        }
        set_config(e) {
          var t = m({}, this.config);
          if (I(e)) {
            t4(this.config, rv(e));
            var i,
              s,
              r,
              n,
              o,
              a,
              l,
              u,
              c,
              h = this.Fi();
            null == (i = this.persistence) || i.update_config(this.config, t, h),
              (this.sessionPersistence =
                "sessionStorage" === this.config.persistence || "memory" === this.config.persistence
                  ? this.persistence
                  : new iQ(m({}, this.config, { persistence: "sessionStorage" }), h));
            var d = this.Ri(this.config.debug);
            q(d) && (this.config.debug = d),
              q(this.config.debug) &&
                (this.config.debug
                  ? ((g.DEBUG = !0),
                    im.Yt() && im.Xt("ph_debug", !0),
                    ta.info("set_config", {
                      config: e,
                      oldConfig: t,
                      newConfig: m({}, this.config),
                    }))
                  : ((g.DEBUG = !1), im.Yt() && im.Jt("ph_debug"))),
              null == (s = this.exceptionObserver) || s.onConfigChange(),
              null == (r = this.sessionRecording) || r.startIfEnabledOrStop(),
              null == (n = this.autocapture) || n.startIfEnabled(),
              null == (o = this.heatmaps) || o.startIfEnabled(),
              null == (a = this.exceptionObserver) || a.startIfEnabledOrStop(),
              null == (l = this.deadClicksAutocapture) || l.startIfEnabledOrStop(),
              null == (u = this.surveys) || u.loadIfEnabled(),
              this.tn(),
              null == (c = this.externalIntegrations) || c.startIfEnabledOrStop();
          }
        }
        _overrideSDKInfo(e, t) {
          (g.LIB_NAME = e), (g.LIB_VERSION = t);
        }
        startSessionRecording(e) {
          var t,
            i,
            s,
            r,
            n,
            o = !0 === e,
            a = {
              sampling: o || !(null == e || !e.sampling),
              linked_flag: o || !(null == e || !e.linked_flag),
              url_trigger: o || !(null == e || !e.url_trigger),
              event_trigger: o || !(null == e || !e.event_trigger),
            };
          Object.values(a).some(Boolean) &&
            (null == (t = this.sessionManager) || t.checkAndGetSessionAndWindowId(),
            a.sampling && (null == (i = this.sessionRecording) || i.overrideSampling()),
            a.linked_flag && (null == (s = this.sessionRecording) || s.overrideLinkedFlag()),
            a.url_trigger && (null == (r = this.sessionRecording) || r.overrideTrigger("url")),
            a.event_trigger && (null == (n = this.sessionRecording) || n.overrideTrigger("event"))),
            this.set_config({ disable_session_recording: !1 });
        }
        stopSessionRecording() {
          this.set_config({ disable_session_recording: !0 });
        }
        sessionRecordingStarted() {
          var e;
          return !(null == (e = this.sessionRecording) || !e.started);
        }
        captureException(e, t) {
          if (this.exceptions) {
            var i = Error("PostHog syntheticException"),
              s = this.exceptions.buildProperties(e, { handled: !0, syntheticException: i });
            return this.exceptions.sendExceptionEvent(m({}, s, t));
          }
        }
        startExceptionAutocapture(e) {
          this.set_config({ capture_exceptions: null == e || e });
        }
        stopExceptionAutocapture() {
          this.set_config({ capture_exceptions: !1 });
        }
        loadToolbar(e) {
          var t, i;
          return null != (t = null == (i = this.toolbar) ? void 0 : i.loadToolbar(e)) && t;
        }
        get_property(e) {
          var t;
          return null == (t = this.persistence) ? void 0 : t.props[e];
        }
        getSessionProperty(e) {
          var t;
          return null == (t = this.sessionPersistence) ? void 0 : t.props[e];
        }
        toString() {
          var e,
            t = null != (e = this.config.name) ? e : rc;
          return t !== rc && (t = rc + "." + t), t;
        }
        _isIdentified() {
          var e, t;
          return (
            (null == (e = this.persistence) ? void 0 : e.get_property(tD)) === tX ||
            (null == (t = this.sessionPersistence) ? void 0 : t.get_property(tD)) === tX
          );
        }
        Wi() {
          var e, t;
          return !(
            "never" === this.config.person_profiles ||
            (this.config.person_profiles === tZ &&
              !this._isIdentified() &&
              O(this.getGroups()) &&
              (null == (e = this.persistence) || null == (e = e.props) || !e[tp]) &&
              (null == (t = this.persistence) || null == (t = t.props) || !t[tH]))
          );
        }
        Vi() {
          return (
            !0 === this.config.capture_pageleave ||
            ("if_capture_pageview" === this.config.capture_pageleave &&
              (!0 === this.config.capture_pageview ||
                "history_change" === this.config.capture_pageview))
          );
        }
        createPersonProfile() {
          this.Wi() || (this.Gi("posthog.createPersonProfile") && this.setPersonProperties({}, {}));
        }
        setInternalOrTestUser() {
          this.Gi("posthog.setInternalOrTestUser") &&
            this.setPersonProperties({ $internal_or_test_user: !0 });
        }
        Gi(e) {
          return "never" === this.config.person_profiles
            ? (ta.error(
                e + ' was called, but process_person is set to "never". This call will be ignored.',
              ),
              !1)
            : (this.Xi(tH, !0), !0);
        }
        Fi() {
          if ("always" === this.config.cookieless_mode) return !0;
          var e = this.consent.isOptedOut();
          return (
            this.config.disable_persistence ||
            (e &&
              !(!this.config.opt_out_persistence_by_default && this.config.cookieless_mode !== tK))
          );
        }
        tn() {
          var e,
            t,
            i,
            s,
            r = this.Fi();
          return (
            (null == (e = this.persistence) ? void 0 : e.gr) !== r &&
              (null == (i = this.persistence) || i.set_disabled(r)),
            (null == (t = this.sessionPersistence) ? void 0 : t.gr) !== r &&
              (null == (s = this.sessionPersistence) || s.set_disabled(r)),
            r
          );
        }
        opt_in_capturing(e) {
          var t;
          if (this.config.cookieless_mode !== tY) {
            if (this.config.cookieless_mode === tK && this.consent.isExplicitlyOptedOut()) {
              this.reset(!0),
                null == (r = this.sessionManager) || r.destroy(),
                null == (n = this.pageViewManager) || n.destroy(),
                (this.sessionManager = new sK(this)),
                (this.pageViewManager = new iO(this)),
                this.persistence &&
                  (this.sessionPropsManager = new sB(this, this.sessionManager, this.persistence));
              var i,
                s,
                r,
                n,
                o,
                a,
                l,
                u =
                  null !=
                  (o = null == (a = this.config.__extensionClasses) ? void 0 : a.sessionRecording)
                    ? o
                    : null == (l = r_.__defaultExtensionClasses)
                      ? void 0
                      : l.sessionRecording;
              u && (this.sessionRecording = this.Ii(this.sessionRecording, new u(this)));
            }
            this.consent.optInOut(!0),
              this.tn(),
              this.Zi(),
              null == (t = this.sessionRecording) || t.startIfEnabledOrStop(),
              this.config.cookieless_mode == tK &&
                (null == (i = this.surveys) || i.loadIfEnabled()),
              (M(null == e ? void 0 : e.captureEventName) || (null != e && e.captureEventName)) &&
                this.capture(
                  null != (s = null == e ? void 0 : e.captureEventName) ? s : "$opt_in",
                  null == e ? void 0 : e.captureProperties,
                  { send_instantly: !0 },
                ),
              this.config.capture_pageview && this.$i();
          } else ta.warn(rn);
        }
        opt_out_capturing() {
          var e, t, i;
          this.config.cookieless_mode !== tY
            ? (this.config.cookieless_mode === tK && this.consent.isOptedIn() && this.reset(!0),
              this.consent.optInOut(!1),
              this.tn(),
              this.config.cookieless_mode === tK &&
                (this.register({ distinct_id: tB, $device_id: null }),
                null == (e = this.sessionManager) || e.destroy(),
                null == (t = this.pageViewManager) || t.destroy(),
                (this.sessionManager = void 0),
                (this.sessionPropsManager = void 0),
                null == (i = this.sessionRecording) || i.stopRecording(),
                (this.sessionRecording = void 0),
                this.$i()))
            : ta.warn(rn);
        }
        has_opted_in_capturing() {
          return this.consent.isOptedIn();
        }
        has_opted_out_capturing() {
          return this.consent.isOptedOut();
        }
        get_explicit_consent_status() {
          var e = this.consent.consent;
          return 1 === e ? "granted" : 0 === e ? "denied" : "pending";
        }
        is_capturing() {
          return (
            this.config.cookieless_mode === tY ||
            (this.config.cookieless_mode === tK
              ? this.consent.isExplicitlyOptedOut() || this.consent.isOptedIn()
              : !this.has_opted_out_capturing())
          );
        }
        clear_opt_in_out_capturing() {
          this.consent.reset(), this.tn();
        }
        _is_bot() {
          return n ? sY(n, this.config.custom_blocked_useragents) : void 0;
        }
        $i() {
          o &&
            ("visible" === o.visibilityState
              ? this.xi ||
                ((this.xi = !0),
                this.capture(t1, { title: o.title }, { send_instantly: !0 }),
                this.Ti && (o.removeEventListener(tQ, this.Ti), (this.Ti = null)))
              : this.Ti || ((this.Ti = this.$i.bind(this)), is(o, tQ, this.Ti)));
        }
        debug(e) {
          !1 === e
            ? (null == s || s.console.log("You've disabled debug mode."),
              this.set_config({ debug: !1 }))
            : (null == s ||
                s.console.log(
                  "You're now in debug mode. All calls to PostHog will be logged in your console.\nYou can disable this with `posthog.debug(false)`.",
                ),
              this.set_config({ debug: !0 }));
        }
        Tr() {
          var e,
            t,
            i,
            s,
            r = this.Ni || {};
          return "advanced_disable_flags" in r
            ? !!r.advanced_disable_flags
            : !1 !== this.config.advanced_disable_flags
              ? !!this.config.advanced_disable_flags
              : !0 === this.config.advanced_disable_decide
                ? (ta.warn(
                    "Config field 'advanced_disable_decide' is deprecated. Please use 'advanced_disable_flags' instead. The old field will be removed in a future major version.",
                  ),
                  !0)
                : ((t = "advanced_disable_decide"),
                  (i = (e = "advanced_disable_flags") in r && !D(r[e])),
                  (s = t in r && !D(r[t])),
                  i
                    ? r[e]
                    : !!s &&
                      (ta &&
                        ta.warn(
                          "Config field '" +
                            t +
                            "' is deprecated. Please use '" +
                            e +
                            "' instead. The old field will be removed in a future major version.",
                        ),
                      r[t]));
        }
        Ui(e) {
          if (D(this.config.before_send)) return e;
          var t = T(this.config.before_send) ? this.config.before_send : [this.config.before_send],
            i = e;
          for (var s of t) {
            if (D((i = s(i)))) {
              var r = "Event '" + e.event + "' was rejected in beforeSend function";
              return (
                U(e.event) ? ta.warn(r + ". This can cause unexpected behavior.") : ta.info(r), null
              );
            }
            (i.properties && !O(i.properties)) ||
              ta.warn(
                "Event '" +
                  e.event +
                  "' has no properties after beforeSend function, this is likely an error.",
              );
          }
          return i;
        }
        getPageViewId() {
          var e;
          return null == (e = this.pageViewManager.lr) ? void 0 : e.pageViewId;
        }
        captureTraceFeedback(e, t) {
          this.capture("$ai_feedback", { $ai_trace_id: String(e), $ai_feedback_text: t });
        }
        captureTraceMetric(e, t, i) {
          this.capture("$ai_metric", {
            $ai_trace_id: String(e),
            $ai_metric_name: t,
            $ai_metric_value: String(i),
          });
        }
        Ri(e) {
          var t = q(e) && !e,
            i = im.Yt() && "true" === im.Wt("ph_debug");
          return !t && (!!i || e);
        }
      }
      function rf(e) {
        return (
          e instanceof Element &&
          (e.id === tz || !(null == e.closest || !e.closest(".toolbar-global-fade-container")))
        );
      }
      function rm(e) {
        return !!e && 1 === e.nodeType;
      }
      function ry(e, t) {
        return !!e && !!e.tagName && e.tagName.toLowerCase() === t.toLowerCase();
      }
      function rb(e) {
        return !!e && 3 === e.nodeType;
      }
      function rw(e) {
        return !!e && 11 === e.nodeType;
      }
      function rx(e) {
        return e ? S(e).split(/\s+/) : [];
      }
      function rE(e) {
        var t = null == s ? void 0 : s.location.href;
        return !!(t && e && e.some((e) => t.match(e)));
      }
      function rk(e) {
        var t = "";
        switch (typeof e.className) {
          case "string":
            t = e.className;
            break;
          case "object":
            t =
              (e.className && "baseVal" in e.className ? e.className.baseVal : null) ||
              e.getAttribute("class") ||
              "";
            break;
          default:
            t = "";
        }
        return rx(t);
      }
      function rS(e) {
        return D(e)
          ? null
          : S(e)
              .split(/(\s+)/)
              .filter((e) => rH(e))
              .join("")
              .replace(/[\r\n]/g, " ")
              .replace(/[ ]+/g, " ")
              .substring(0, 255);
      }
      function rP(e) {
        var t = "";
        return (
          rA(e) &&
            !rL(e) &&
            e.childNodes &&
            e.childNodes.length &&
            t8(e.childNodes, (e) => {
              var i;
              rb(e) && e.textContent && (t += null != (i = rS(e.textContent)) ? i : "");
            }),
          S(t)
        );
      }
      function rR(e) {
        var t;
        return M(e.target)
          ? e.srcElement || null
          : null != (t = e.target) && t.shadowRoot
            ? e.composedPath()[0] || null
            : e.target || null;
      }
      (r_.__defaultExtensionClasses = {}),
        ((e, t) => {
          for (var i = 0; t.length > i; i++) e.prototype[t[i]] = ie(e.prototype[t[i]]);
        })(r_, ["identify"]);
      var rF = ["a", "button", "form", "input", "select", "textarea", "label"];
      function r$(e, t) {
        if (M(t)) return !0;
        var i,
          s = (e) => {
            if (t.some((t) => e.matches(t))) return { v: !0 };
          };
        for (var r of e) if ((i = s(r))) return i.v;
        return !1;
      }
      function rT(e) {
        var t = e.parentNode;
        return !(!t || !rm(t)) && t;
      }
      var rC = ["next", "previous", "prev", ">", "<"],
        rI = [".ph-no-rageclick", ".ph-no-capture"],
        rO = (e) => !e || ry(e, "html") || !rm(e),
        rM = (e, t) => {
          if (!s || rO(e)) return { parentIsUsefulElement: !1, targetElementList: [] };
          for (var i = !1, r = [e], n = e; n.parentNode && !ry(n, "body"); )
            if (rw(n.parentNode)) r.push(n.parentNode.host), (n = n.parentNode.host);
            else {
              var o = rT(n);
              if (!o) break;
              if (t || rF.indexOf(o.tagName.toLowerCase()) > -1) i = !0;
              else {
                var a = s.getComputedStyle(o);
                a && "pointer" === a.getPropertyValue("cursor") && (i = !0);
              }
              r.push(o), (n = o);
            }
          return { parentIsUsefulElement: i, targetElementList: r };
        };
      function rA(e) {
        for (var t = e; t.parentNode && !ry(t, "body"); t = t.parentNode) {
          var i = rk(t);
          if (k(i, "ph-sensitive") || k(i, "ph-no-capture")) return !1;
        }
        if (k(rk(e), "ph-include")) return !0;
        var s = e.type || "";
        if (A(s))
          switch (s.toLowerCase()) {
            case "hidden":
            case "password":
              return !1;
          }
        var r = e.name || e.id || "";
        return (
          !A(r) ||
          !/^cc|cardnum|ccnum|creditcard|csc|cvc|cvv|exp|pass|pwd|routing|seccode|securitycode|securitynum|socialsec|socsec|ssn/i.test(
            r.replace(/[^a-zA-Z0-9]/g, ""),
          )
        );
      }
      function rL(e) {
        return !!(
          (ry(e, "input") && !["button", "checkbox", "submit", "reset"].includes(e.type)) ||
          ry(e, "select") ||
          ry(e, "textarea") ||
          "true" === e.getAttribute("contenteditable")
        );
      }
      var rD =
          "(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11})",
        rj = RegExp("^(?:" + rD + ")$"),
        rN = new RegExp(rD),
        rq = "\\d{3}-?\\d{2}-?\\d{4}",
        rU = RegExp("^(" + rq + ")$"),
        rW = RegExp("(" + rq + ")");
      function rH(e, t) {
        return (
          void 0 === t && (t = !0),
          !(
            D(e) ||
            (A(e) &&
              ((e = S(e)),
              (t ? rj : rN).test((e || "").replace(/[- ]/g, "")) || (t ? rU : rW).test(e)))
          ) && !0
        );
      }
      function rz(e) {
        var t = rP(e);
        return rH(
          (t = (
            t +
            " " +
            (function e(t) {
              var i = "";
              return (
                t &&
                  t.childNodes &&
                  t.childNodes.length &&
                  t8(t.childNodes, (t) => {
                    var s;
                    if (t && "span" === (null == (s = t.tagName) ? void 0 : s.toLowerCase()))
                      try {
                        var r = rP(t);
                        (i = (i + " " + r).trim()),
                          t.childNodes && t.childNodes.length && (i = (i + " " + e(t)).trim());
                      } catch (e) {
                        ta.error("[AutoCapture]", e);
                      }
                  }),
                i
              );
            })(e)
          ).trim()),
        )
          ? t
          : "";
      }
      function rB(e) {
        return e.replace(/"|\\"/g, '\\"');
      }
      class rV {
        constructor(e) {
          this.disabled = !1 === e;
          var t = I(e) ? e : {};
          (this.thresholdPx = t.threshold_px || 30),
            (this.timeoutMs = t.timeout_ms || 1e3),
            (this.clickCount = t.click_count || 3),
            (this.clicks = []);
        }
        isRageClick(e, t, i) {
          if (this.disabled) return !1;
          var s = this.clicks[this.clicks.length - 1];
          if (
            s &&
            Math.abs(e - s.x) + Math.abs(t - s.y) < this.thresholdPx &&
            this.timeoutMs > i - s.timestamp
          ) {
            if (
              (this.clicks.push({ x: e, y: t, timestamp: i }),
              this.clicks.length === this.clickCount)
            )
              return !0;
          } else this.clicks = [{ x: e, y: t, timestamp: i }];
          return !1;
        }
      }
      var rG = "$copy_autocapture",
        rK = tl("[AutoCapture]");
      function rY(e, t) {
        return t.length > e ? t.slice(0, e) + "..." : t;
      }
      var rJ = tl("[ExceptionAutocapture]");
      function rX(e, t, i) {
        try {
          if (!(t in e)) return () => {};
          var s = e[t],
            r = i(s);
          return (
            C(r) &&
              ((r.prototype = r.prototype || {}),
              Object.defineProperties(r, { __posthog_wrapped__: { enumerable: !1, value: !0 } })),
            (e[t] = r),
            () => {
              e[t] = s;
            }
          );
        } catch (e) {
          return () => {};
        }
      }
      var rZ = tl("[TracingHeaders]"),
        rQ = tl("[Web Vitals]"),
        r0 = "disabled",
        r1 = "lazy_loading",
        r2 = "awaiting_config",
        r3 = "missing_config";
      tl("[SessionRecording]");
      var r5 = "[SessionRecording]",
        r6 = tl(r5),
        r8 = tl("[Heatmaps]");
      function r4(e) {
        return I(e) && "clientX" in e && "clientY" in e && j(e.clientX) && j(e.clientY);
      }
      var r7 = tl("[Product Tours]"),
        r9 = "ph_product_tours",
        ne = ["$set_once", "$set"],
        nt = tl("[SiteApps]"),
        ni = "Error while initializing PostHog app with config id ";
      function ns(e, t, i) {
        if (D(e)) return !1;
        switch (i) {
          case "exact":
            return e === t;
          case "contains":
            return RegExp(
              t
                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                .replace(/_/g, ".")
                .replace(/%/g, ".*"),
              "i",
            ).test(e);
          case "regex":
            try {
              return new RegExp(t).test(e);
            } catch (e) {
              return !1;
            }
          default:
            return !1;
        }
      }
      class nr {
        constructor(e) {
          (this.en = new sV()),
            (this.rn = (e, t) => this.nn(e, t) && this.sn(e, t) && this.an(e, t) && this.ln(e, t)),
            (this.nn = (e, t) =>
              null == t ||
              !t.event ||
              (null == e ? void 0 : e.event) === (null == t ? void 0 : t.event)),
            (this._instance = e),
            (this.un = new Set()),
            (this.hn = new Set());
        }
        init() {
          var e, t;
          M(null == (e = this._instance) ? void 0 : e._addCaptureHook) ||
            null == (t = this._instance) ||
            t._addCaptureHook((e, t) => {
              this.on(e, t);
            });
        }
        register(e) {
          var t, i;
          if (
            !M(null == (t = this._instance) ? void 0 : t._addCaptureHook) &&
            (e.forEach((e) => {
              var t, i;
              null == (t = this.hn) || t.add(e),
                null == (i = e.steps) ||
                  i.forEach((e) => {
                    var t;
                    null == (t = this.un) || t.add((null == e ? void 0 : e.event) || "");
                  });
            }),
            null != (i = this._instance) && i.autocapture)
          ) {
            var s,
              r = new Set();
            e.forEach((e) => {
              var t;
              null == (t = e.steps) ||
                t.forEach((e) => {
                  null != e && e.selector && r.add(null == e ? void 0 : e.selector);
                });
            }),
              null == (s = this._instance) || s.autocapture.setElementSelectors(r);
          }
        }
        on(e, t) {
          var i;
          null != t &&
            0 != e.length &&
            (this.un.has(e) || this.un.has(null == t ? void 0 : t.event)) &&
            this.hn &&
            (null == (i = this.hn) ? void 0 : i.size) > 0 &&
            this.hn.forEach((e) => {
              this.cn(t, e) && this.en.emit("actionCaptured", e.name);
            });
        }
        dn(e) {
          this.onAction("actionCaptured", (t) => e(t));
        }
        cn(e, t) {
          if (null == (null == t ? void 0 : t.steps)) return !1;
          for (var i of t.steps) if (this.rn(e, i)) return !0;
          return !1;
        }
        onAction(e, t) {
          return this.en.on(e, t);
        }
        sn(e, t) {
          if (null != t && t.url) {
            var i,
              s = null == e || null == (i = e.properties) ? void 0 : i.$current_url;
            if (!s || "string" != typeof s || !ns(s, t.url, t.url_matching || "contains"))
              return !1;
          }
          return !0;
        }
        an(e, t) {
          return !!this.vn(e, t) && !!this.fn(e, t) && !!this.pn(e, t);
        }
        vn(e, t) {
          if (null == t || !t.href) return !0;
          var i = this.gn(e);
          if (i.length > 0) return i.some((e) => ns(e.href, t.href, t.href_matching || "exact"));
          var s,
            r,
            n = (null == e || null == (s = e.properties) ? void 0 : s.$elements_chain) || "";
          return (
            !!n &&
            ns((r = n.match(/(?::|")href="(.*?)"/)) ? r[1] : "", t.href, t.href_matching || "exact")
          );
        }
        fn(e, t) {
          if (null == t || !t.text) return !0;
          var i = this.gn(e);
          if (i.length > 0)
            return i.some(
              (e) =>
                ns(e.text, t.text, t.text_matching || "exact") ||
                ns(e.$el_text, t.text, t.text_matching || "exact"),
            );
          var s,
            r,
            n,
            o,
            a = (null == e || null == (s = e.properties) ? void 0 : s.$elements_chain) || "";
          return (
            !!a &&
            ((r = ((e) => {
              for (var t, i = [], s = /(?::|")text="(.*?)"/g; !D((t = s.exec(e))); )
                i.includes(t[1]) || i.push(t[1]);
              return i;
            })(a)),
            (n = t.text),
            (o = t.text_matching || "exact"),
            r.some((e) => ns(e, n, o)))
          );
        }
        pn(e, t) {
          if (null == t || !t.selector) return !0;
          var i,
            s,
            r = null == e || null == (i = e.properties) ? void 0 : i.$element_selectors;
          if (null != r && r.includes(t.selector)) return !0;
          var n = (null == e || null == (s = e.properties) ? void 0 : s.$elements_chain) || "";
          if (t.selector_regex && n)
            try {
              return new RegExp(t.selector_regex).test(n);
            } catch (e) {}
          return !1;
        }
        gn(e) {
          var t;
          return null == (null == e || null == (t = e.properties) ? void 0 : t.$elements)
            ? []
            : null == e
              ? void 0
              : e.properties.$elements;
        }
        ln(e, t) {
          return (
            null == t ||
            !t.properties ||
            0 === t.properties.length ||
            s0(
              t.properties.reduce((e, t) => {
                var i = T(t.value) ? t.value.map(String) : null != t.value ? [String(t.value)] : [];
                return (e[t.key] = { values: i, operator: t.operator || "exact" }), e;
              }, {}),
              null == e ? void 0 : e.properties,
            )
          );
        }
      }
      class nn {
        constructor(e) {
          (this._instance = e), (this.mn = new Map()), (this.yn = new Map()), (this.bn = new Map());
        }
        wn(e, t) {
          return !!e && s0(e.propertyFilters, null == t ? void 0 : t.properties);
        }
        _n(e, t) {
          var i = new Map();
          return (
            e.forEach((e) => {
              var s;
              null == (s = e.conditions) ||
                null == (s = s[t]) ||
                null == (s = s.values) ||
                s.forEach((t) => {
                  if (null != t && t.name) {
                    var s = i.get(t.name) || [];
                    s.push(e.id), i.set(t.name, s);
                  }
                });
            }),
            i
          );
        }
        In(e, t, i) {
          var s = (i === i0.Activation ? this.mn : this.yn).get(e),
            r = [];
          return (
            this.Cn((e) => {
              r = e.filter((e) => (null == s ? void 0 : s.includes(e.id)));
            }),
            r.filter((s) => {
              var r,
                n =
                  null == (r = s.conditions) || null == (r = r[i]) || null == (r = r.values)
                    ? void 0
                    : r.find((t) => t.name === e);
              return this.wn(n, t);
            })
          );
        }
        register(e) {
          var t;
          M(null == (t = this._instance) ? void 0 : t._addCaptureHook) || (this.Sn(e), this.kn(e));
        }
        kn(e) {
          var t = e.filter((e) => {
            var t, i;
            return (
              (null == (t = e.conditions) ? void 0 : t.actions) &&
              (null == (i = e.conditions) || null == (i = i.actions) || null == (i = i.values)
                ? void 0
                : i.length) > 0
            );
          });
          0 !== t.length &&
            (null == this.xn &&
              ((this.xn = new nr(this._instance)),
              this.xn.init(),
              this.xn.dn((e) => {
                this.onAction(e);
              })),
            t.forEach((e) => {
              var t, i, s, r, n;
              e.conditions &&
                null != (t = e.conditions) &&
                t.actions &&
                null != (i = e.conditions) &&
                null != (i = i.actions) &&
                i.values &&
                (null == (s = e.conditions) || null == (s = s.actions) || null == (s = s.values)
                  ? void 0
                  : s.length) > 0 &&
                (null == (r = this.xn) || r.register(e.conditions.actions.values),
                null == (n = e.conditions) ||
                  null == (n = n.actions) ||
                  null == (n = n.values) ||
                  n.forEach((t) => {
                    if (t && t.name) {
                      var i = this.bn.get(t.name);
                      i && i.push(e.id), this.bn.set(t.name, i || [e.id]);
                    }
                  }));
            }));
        }
        Sn(e) {
          var t,
            i = e.filter((e) => {
              var t, i;
              return (
                (null == (t = e.conditions) ? void 0 : t.events) &&
                (null == (i = e.conditions) || null == (i = i.events) || null == (i = i.values)
                  ? void 0
                  : i.length) > 0
              );
            }),
            s = e.filter((e) => {
              var t, i;
              return (
                (null == (t = e.conditions) ? void 0 : t.cancelEvents) &&
                (null == (i = e.conditions) ||
                null == (i = i.cancelEvents) ||
                null == (i = i.values)
                  ? void 0
                  : i.length) > 0
              );
            });
          (0 === i.length && 0 === s.length) ||
            (null == (t = this._instance) ||
              t._addCaptureHook((e, t) => {
                this.onEvent(e, t);
              }),
            (this.mn = this._n(e, i0.Activation)),
            (this.yn = this._n(e, i0.Cancellation)));
        }
        onEvent(e, t) {
          var i,
            s = this.re(),
            r = this.Tn(),
            n = this.An(),
            o =
              (null == (i = this._instance) || null == (i = i.persistence) ? void 0 : i.props[r]) ||
              [];
          if (n === e && t && o.length > 0) {
            s.info("event matched, removing item from activated items", {
              event: e,
              eventPayload: t,
              existingActivatedItems: o,
            });
            var a,
              l,
              u =
                (null == t || null == (a = t.properties) ? void 0 : a.$survey_id) ||
                (null == t || null == (l = t.properties) ? void 0 : l.$product_tour_id);
            if (u) {
              var c = o.indexOf(u);
              0 > c || (o.splice(c, 1), this.En(o));
            }
          } else {
            if (this.yn.has(e)) {
              var h = this.In(e, t, i0.Cancellation);
              h.length > 0 &&
                (s.info("cancel event matched, cancelling items", {
                  event: e,
                  itemsToCancel: h.map((e) => e.id),
                }),
                h.forEach((e) => {
                  var t = o.indexOf(e.id);
                  0 > t || o.splice(t, 1), this.Rn(e.id);
                }),
                this.En(o));
            }
            if (this.mn.has(e)) {
              s.info("event name matched", { event: e, eventPayload: t, items: this.mn.get(e) });
              var d = this.In(e, t, i0.Activation);
              this.En(o.concat(d.map((e) => e.id) || []));
            }
          }
        }
        onAction(e) {
          var t,
            i = this.Tn(),
            s =
              (null == (t = this._instance) || null == (t = t.persistence) ? void 0 : t.props[i]) ||
              [];
          this.bn.has(e) && this.En(s.concat(this.bn.get(e) || []));
        }
        En(e) {
          var t,
            i = this.re(),
            s = this.Tn(),
            r = [...new Set(e)].filter((e) => !this.Nn(e));
          i.info("updating activated items", { activatedItems: r }),
            null == (t = this._instance) || null == (t = t.persistence) || t.register({ [s]: r });
        }
        getActivatedIds() {
          var e,
            t = this.Tn();
          return (
            (null == (e = this._instance) || null == (e = e.persistence) ? void 0 : e.props[t]) ||
            []
          );
        }
        getEventToItemsMap() {
          return this.mn;
        }
        Mn() {
          return this.xn;
        }
      }
      class no extends nn {
        constructor(e) {
          super(e);
        }
        Tn() {
          return "$surveys_activated";
        }
        An() {
          return i2.SHOWN;
        }
        Cn(e) {
          var t;
          null == (t = this._instance) || t.getSurveys(e);
        }
        Rn(e) {
          var t;
          null == (t = this._instance) || t.cancelPendingSurvey(e);
        }
        re() {
          return s5;
        }
        Nn() {
          return !1;
        }
        getSurveys() {
          return this.getActivatedIds();
        }
        getEventToSurveys() {
          return this.getEventToItemsMap();
        }
      }
      var na = "SDK is not enabled or survey functionality is not yet loaded",
        nl = "Disabled. Not loading surveys.",
        nu =
          null != s && s.location
            ? iD(s.location.hash, "__posthog") || iD(location.hash, "state")
            : null,
        nc = "_postHogToolbarParams",
        nh = tl("[Toolbar]"),
        nd = tl("[FeatureFlags]"),
        np = tl("[FeatureFlags]", { debugEnabled: !0 }),
        nv = "\" failed. Feature flags didn't load in time.",
        ng = "$active_feature_flags",
        n_ = "$override_feature_flags",
        nf = "$feature_flag_payloads",
        nm = "$override_feature_flag_payloads",
        ny = "$feature_flag_request_id",
        nb = (e) => {
          for (var t = {}, i = 0; e.length > i; i++) t[e[i]] = !0;
          return t;
        },
        nw = (e) => {
          var t = {};
          for (var [i, s] of t7(e || {})) s && (t[i] = s);
          return t;
        },
        nx = tl("[Error tracking]"),
        nE = "Refusing to render web experiment since the viewer is a likely bot",
        nk = {
          icontains: (e, t) => !!s && t.href.toLowerCase().indexOf(e.toLowerCase()) > -1,
          not_icontains: (e, t) => !!s && -1 === t.href.toLowerCase().indexOf(e.toLowerCase()),
          regex: (e, t) => !!s && sJ(t.href, e),
          not_regex: (e, t) => !!s && !sJ(t.href, e),
          exact: (e, t) => t.href === e,
          is_not: (e, t) => t.href !== e,
        };
      class nS {
        get Rt() {
          return this._instance.config;
        }
        constructor(e) {
          (this.getWebExperimentsAndEvaluateDisplayLogic = (e) => {
            void 0 === e && (e = !1),
              this.getWebExperiments((e) => {
                nS.Fn("retrieved web experiments from the server"),
                  (this.On = new Map()),
                  e.forEach((e) => {
                    if (e.feature_flag_key) {
                      this.On &&
                        (nS.Fn("setting flag key ", e.feature_flag_key, " to web experiment ", e),
                        null == (i = this.On) || i.set(e.feature_flag_key, e));
                      var i,
                        s = this._instance.getFeatureFlag(e.feature_flag_key);
                      A(s) && e.variants[s] && this.Pn(e.name, s, e.variants[s].transforms);
                    } else if (e.variants)
                      for (var r in e.variants) {
                        var n = e.variants[r];
                        nS.Ln(n) && this.Pn(e.name, r, n.transforms);
                      }
                  });
              }, e);
          }),
            (this._instance = e),
            this._instance.onFeatureFlags((e) => {
              this.onFeatureFlags(e);
            });
        }
        initialize() {}
        onFeatureFlags(e) {
          if (this._is_bot()) nS.Fn(nE);
          else if (!this.Rt.disable_web_experiments) {
            if (D(this.On))
              return (this.On = new Map()), this.loadIfEnabled(), void this.previewWebExperiment();
            nS.Fn("applying feature flags", e),
              e.forEach((e) => {
                var t;
                if (this.On && null != (t = this.On) && t.has(e)) {
                  var i,
                    s = this._instance.getFeatureFlag(e),
                    r = null == (i = this.On) ? void 0 : i.get(e);
                  s && null != r && r.variants[s] && this.Pn(r.name, s, r.variants[s].transforms);
                }
              });
          }
        }
        previewWebExperiment() {
          var e = nS.getWindowLocation();
          if (null != e && e.search) {
            var t = iA(null == e ? void 0 : e.search, "__experiment_id"),
              i = iA(null == e ? void 0 : e.search, "__experiment_variant");
            t &&
              i &&
              (nS.Fn("previewing web experiments " + t + " && " + i),
              this.getWebExperiments(
                (e) => {
                  this.Dn(parseInt(t), i, e);
                },
                !1,
                !0,
              ));
          }
        }
        loadIfEnabled() {
          this.Rt.disable_web_experiments || this.getWebExperimentsAndEvaluateDisplayLogic();
        }
        getWebExperiments(e, t, i) {
          if (this.Rt.disable_web_experiments && !i) return e([]);
          var s = this._instance.get_property("$web_experiments");
          if (s && !t) return e(s);
          this._instance._send_request({
            url: this._instance.requestRouter.endpointFor(
              "api",
              "/api/web_experiments/?token=" + this.Rt.token,
            ),
            method: "GET",
            callback: (t) => e((200 === t.statusCode && t.json && t.json.experiments) || []),
          });
        }
        Dn(e, t, i) {
          var s = i.filter((t) => t.id === e);
          s &&
            s.length > 0 &&
            (nS.Fn("Previewing web experiment [" + s[0].name + "] with variant [" + t + "]"),
            this.Pn(s[0].name, t, s[0].variants[t].transforms));
        }
        static Ln(e) {
          return !D(e.conditions) && nS.Bn(e) && nS.jn(e);
        }
        static Bn(e) {
          if (D(e.conditions) || D(null == (t = e.conditions) ? void 0 : t.url)) return !0;
          var t,
            i,
            s,
            r,
            n = nS.getWindowLocation();
          return (
            !!n &&
            (null == (i = e.conditions) ||
              !i.url ||
              nk[
                null != (s = null == (r = e.conditions) ? void 0 : r.urlMatchType) ? s : "icontains"
              ](e.conditions.url, n))
          );
        }
        static getWindowLocation() {
          return null == s ? void 0 : s.location;
        }
        static jn(e) {
          if (D(e.conditions) || D(null == (i = e.conditions) ? void 0 : i.utm)) return !0;
          var t = iH();
          if (t.utm_source) {
            var i,
              s,
              r,
              n,
              o,
              a,
              l,
              u,
              c,
              h =
                null == (s = e.conditions) ||
                null == (s = s.utm) ||
                !s.utm_campaign ||
                (null == (r = e.conditions) || null == (r = r.utm) ? void 0 : r.utm_campaign) ==
                  t.utm_campaign,
              d =
                null == (n = e.conditions) ||
                null == (n = n.utm) ||
                !n.utm_source ||
                (null == (o = e.conditions) || null == (o = o.utm) ? void 0 : o.utm_source) ==
                  t.utm_source,
              p =
                null == (a = e.conditions) ||
                null == (a = a.utm) ||
                !a.utm_medium ||
                (null == (l = e.conditions) || null == (l = l.utm) ? void 0 : l.utm_medium) ==
                  t.utm_medium,
              v =
                null == (u = e.conditions) ||
                null == (u = u.utm) ||
                !u.utm_term ||
                (null == (c = e.conditions) || null == (c = c.utm) ? void 0 : c.utm_term) ==
                  t.utm_term;
            return h && p && v && d;
          }
          return !1;
        }
        static Fn(e) {
          for (var t = arguments.length, i = Array(t > 1 ? t - 1 : 0), s = 1; t > s; s++)
            i[s - 1] = arguments[s];
          ta.info("[WebExperiments] " + e, i);
        }
        Pn(e, t, i) {
          this._is_bot()
            ? nS.Fn(nE)
            : "control" !== t
              ? i.forEach((i) => {
                  if (i.selector) {
                    nS.Fn("applying transform of variant " + t + " for experiment " + e + " ", i);
                    var s,
                      r = null == (s = document) ? void 0 : s.querySelectorAll(i.selector);
                    null == r ||
                      r.forEach((e) => {
                        i.html && (e.innerHTML = i.html), i.css && e.setAttribute("style", i.css);
                      });
                  }
                })
              : nS.Fn("Control variants leave the page unmodified.");
        }
        _is_bot() {
          return n && this._instance ? sY(n, this.Rt.custom_blocked_useragents) : void 0;
        }
      }
      var nP = tl("[Conversations]"),
        nR = "Conversations not available yet.",
        nF = {
          featureFlags: class {
            constructor(e) {
              (this.qn = !1),
                (this.Zn = !1),
                (this.$n = !1),
                (this.Hn = !1),
                (this.Vn = !1),
                (this.zn = !1),
                (this.Yn = !1),
                (this.Un = !1),
                (this._instance = e),
                (this.featureFlagEventHandlers = []);
            }
            get Rt() {
              return this._instance.config;
            }
            get Kr() {
              return this._instance.persistence;
            }
            Wn(e) {
              return this._instance.get_property(e);
            }
            Gn() {
              var e, t;
              return (
                null !=
                  (e = null == (t = this.Kr) ? void 0 : t.mr(this.Rt.feature_flag_cache_ttl_ms)) &&
                e
              );
            }
            Xn() {
              return (
                !!this.Gn() &&
                (this.Un ||
                  this.$n ||
                  ((this.Un = !0),
                  nd.warn("Feature flag cache is stale, triggering refresh..."),
                  this.reloadFeatureFlags()),
                !0)
              );
            }
            Jn() {
              var e,
                t = null != (e = this.Rt.evaluation_contexts) ? e : this.Rt.evaluation_environments;
              return (
                !this.Rt.evaluation_environments ||
                  this.Rt.evaluation_contexts ||
                  this.Yn ||
                  (nd.warn(
                    "evaluation_environments is deprecated. Use evaluation_contexts instead. evaluation_environments will be removed in a future version.",
                  ),
                  (this.Yn = !0)),
                null != t && t.length
                  ? t.filter((e) => {
                      var t = e && "string" == typeof e && e.trim().length > 0;
                      return (
                        t ||
                          nd.error(
                            "Invalid evaluation context found:",
                            e,
                            "Expected non-empty string",
                          ),
                        t
                      );
                    })
                  : []
              );
            }
            Kn() {
              return this.Jn().length > 0;
            }
            initialize() {
              var e,
                t,
                { config: i } = this._instance,
                s = null != (e = null == (t = i.bootstrap) ? void 0 : t.featureFlags) ? e : {};
              if (Object.keys(s).length) {
                var r,
                  n,
                  o =
                    null != (r = null == (n = i.bootstrap) ? void 0 : n.featureFlagPayloads)
                      ? r
                      : {},
                  a = Object.keys(s)
                    .filter((e) => !!s[e])
                    .reduce((e, t) => ((e[t] = s[t] || !1), e), {}),
                  l = Object.keys(o)
                    .filter((e) => a[e])
                    .reduce((e, t) => (o[t] && (e[t] = o[t]), e), {});
                this.receivedFeatureFlags({ featureFlags: a, featureFlagPayloads: l });
              }
            }
            updateFlags(e, t, i) {
              var s = null != i && i.merge ? this.getFlagVariants() : {},
                r = null != i && i.merge ? this.getFlagPayloads() : {},
                n = m({}, s, e),
                o = m({}, r, t),
                a = {};
              for (var [l, u] of Object.entries(n)) {
                var c = "string" == typeof u;
                a[l] = {
                  key: l,
                  enabled: !!c || !!u,
                  variant: c ? u : void 0,
                  reason: void 0,
                  metadata: M(null == o ? void 0 : o[l])
                    ? void 0
                    : { id: 0, version: void 0, description: void 0, payload: o[l] },
                };
              }
              this.receivedFeatureFlags({ flags: a });
            }
            get hasLoadedFlags() {
              return this.Zn;
            }
            getFlags() {
              return Object.keys(this.getFlagVariants());
            }
            getFlagsWithDetails() {
              var e = this.Wn(t$),
                t = this.Wn(n_),
                i = this.Wn(nm);
              if (!i && !t) return e || {};
              var s = t4({}, e || {});
              for (var r of [...new Set([...Object.keys(i || {}), ...Object.keys(t || {})])]) {
                var n,
                  o,
                  a = s[r],
                  l = null == t ? void 0 : t[r],
                  u = M(l) ? null != (n = null == a ? void 0 : a.enabled) && n : !!l,
                  c = M(l) ? a.variant : "string" == typeof l ? l : void 0,
                  h = null == i ? void 0 : i[r],
                  d = m({}, a, {
                    enabled: u,
                    variant: u ? (null != c ? c : null == a ? void 0 : a.variant) : void 0,
                  });
                u !== (null == a ? void 0 : a.enabled) &&
                  (d.original_enabled = null == a ? void 0 : a.enabled),
                  c !== (null == a ? void 0 : a.variant) &&
                    (d.original_variant = null == a ? void 0 : a.variant),
                  h &&
                    (d.metadata = m({}, null == a ? void 0 : a.metadata, {
                      payload: h,
                      original_payload: null == a || null == (o = a.metadata) ? void 0 : o.payload,
                    })),
                  (s[r] = d);
              }
              return (
                this.qn ||
                  (nd.warn(" Overriding feature flag details!", {
                    flagDetails: e,
                    overriddenPayloads: i,
                    finalDetails: s,
                  }),
                  (this.qn = !0)),
                s
              );
            }
            getFlagVariants() {
              var e = this.Wn(tR),
                t = this.Wn(n_);
              if (!t) return e || {};
              for (var i = t4({}, e), s = Object.keys(t), r = 0; s.length > r; r++)
                i[s[r]] = t[s[r]];
              return (
                this.qn ||
                  (nd.warn(" Overriding feature flags!", {
                    enabledFlags: e,
                    overriddenFlags: t,
                    finalFlags: i,
                  }),
                  (this.qn = !0)),
                i
              );
            }
            getFlagPayloads() {
              var e = this.Wn(nf),
                t = this.Wn(nm);
              if (!t) return e || {};
              for (var i = t4({}, e || {}), s = Object.keys(t), r = 0; s.length > r; r++)
                i[s[r]] = t[s[r]];
              return (
                this.qn ||
                  (nd.warn(" Overriding feature flag payloads!", {
                    flagPayloads: e,
                    overriddenPayloads: t,
                    finalPayloads: i,
                  }),
                  (this.qn = !0)),
                i
              );
            }
            reloadFeatureFlags() {
              this.Hn ||
                this.Rt.advanced_disable_feature_flags ||
                this.Qn ||
                (this._instance.ki.emit("featureFlagsReloading", !0),
                (this.Qn = setTimeout(() => {
                  this.ts();
                }, 5)));
            }
            es() {
              clearTimeout(this.Qn), (this.Qn = void 0);
            }
            ensureFlagsLoaded() {
              this.Zn || this.$n || this.Qn || this.reloadFeatureFlags();
            }
            setAnonymousDistinctId(e) {
              this.$anon_distinct_id = e;
            }
            setReloadingPaused(e) {
              this.Hn = e;
            }
            ts(e) {
              var t;
              if ((this.es(), !this._instance.Tr()))
                if (this.$n) this.Vn = !0;
                else {
                  var i = this.Rt.token,
                    s = this.Wn(td),
                    r = {
                      token: i,
                      distinct_id: this._instance.get_distinct_id(),
                      groups: this._instance.getGroups(),
                      $anon_distinct_id: this.$anon_distinct_id,
                      person_properties: m(
                        {},
                        (null == (t = this.Kr) ? void 0 : t.get_initial_props()) || {},
                        this.Wn(tT) || {},
                      ),
                      group_properties: this.Wn(tC),
                      timezone: iX(),
                    };
                  null === s || M(s) || (r.$device_id = s),
                    ((null != e && e.disableFlags) || this.Rt.advanced_disable_feature_flags) &&
                      (r.disable_flags = !0),
                    this.Kn() && (r.evaluation_contexts = this.Jn());
                  var n = this._instance.requestRouter.endpointFor(
                    "flags",
                    "/flags/?v=2" +
                      (this.Rt.advanced_only_evaluate_survey_feature_flags
                        ? "&only_evaluate_survey_feature_flags=true"
                        : ""),
                  );
                  (this.$n = !0),
                    this._instance._send_request({
                      method: "POST",
                      url: n,
                      data: r,
                      compression: this.Rt.disable_compression ? void 0 : st.Base64,
                      timeout: this.Rt.feature_flag_request_timeout_ms,
                      callback: (e) => {
                        var t,
                          i,
                          s,
                          n = !0;
                        if (
                          (200 === e.statusCode &&
                            (this.Vn || (this.$anon_distinct_id = void 0), (n = !1)),
                          (this.$n = !1),
                          !r.disable_flags || this.Vn)
                        ) {
                          this.zn = !n;
                          var o = [];
                          e.error
                            ? e.error instanceof Error
                              ? o.push(
                                  "AbortError" === e.error.name ? "timeout" : "connection_error",
                                )
                              : o.push("unknown_error")
                            : 200 !== e.statusCode && o.push("api_error_" + e.statusCode),
                            null != (t = e.json) &&
                              t.errorsWhileComputingFlags &&
                              o.push("errors_while_computing_flags");
                          var a,
                            l = !(
                              null == (i = e.json) ||
                              null == (i = i.quotaLimited) ||
                              !i.includes("feature_flags")
                            );
                          (l && o.push("quota_limited"),
                          null == (s = this.Kr) || s.register({ [tA]: o }),
                          l)
                            ? nd.warn(
                                "You have hit your feature flags quota limit, and will not be able to load feature flags until the quota is reset.  Please visit https://posthog.com/docs/billing/limits-alerts to learn more.",
                              )
                            : (r.disable_flags ||
                                this.receivedFeatureFlags(null != (a = e.json) ? a : {}, n),
                              this.Vn && ((this.Vn = !1), this.ts()));
                        }
                      },
                    });
                }
            }
            getFeatureFlag(e, t) {
              var i;
              if ((void 0 === t && (t = {}), !t.fresh || this.zn))
                if (this.Zn || (this.getFlags() && this.getFlags().length > 0)) {
                  if (!this.Xn()) {
                    var s = this.getFeatureFlagResult(e, t);
                    return null != (i = null == s ? void 0 : s.variant)
                      ? i
                      : null == s
                        ? void 0
                        : s.enabled;
                  }
                } else nd.warn('getFeatureFlag for key "' + e + nv);
            }
            getFeatureFlagDetails(e) {
              return this.getFlagsWithDetails()[e];
            }
            getFeatureFlagPayload(e) {
              var t = this.getFeatureFlagResult(e, { send_event: !1 });
              return null == t ? void 0 : t.payload;
            }
            getFeatureFlagResult(e, t) {
              if ((void 0 === t && (t = {}), !t.fresh || this.zn))
                if (this.Zn || (this.getFlags() && this.getFlags().length > 0)) {
                  if (!this.Xn()) {
                    var i = this.getFlagVariants(),
                      s = e in i,
                      r = i[e],
                      n = this.getFlagPayloads()[e],
                      o = String(r),
                      a = this.Wn(ny) || void 0,
                      l = this.Wn(tL) || void 0,
                      u = this.Wn(tO) || {};
                    if (this.Rt.advanced_feature_flags_dedup_per_session) {
                      var c,
                        h = this._instance.get_session_id(),
                        d = this.Wn(tM);
                      h &&
                        h !== d &&
                        ((u = {}), null == (c = this.Kr) || c.register({ [tO]: u, [tM]: h }));
                    }
                    if (
                      (t.send_event || !("send_event" in t)) &&
                      (!(e in u) || !u[e].includes(o))
                    ) {
                      T(u[e]) ? u[e].push(o) : (u[e] = [o]),
                        null == (_ = this.Kr) || _.register({ [tO]: u });
                      var p = this.getFeatureFlagDetails(e),
                        v = [...(null != (f = this.Wn(tA)) ? f : [])];
                      M(r) && v.push("flag_missing");
                      var g = {
                        $feature_flag: e,
                        $feature_flag_response: r,
                        $feature_flag_payload: n || null,
                        $feature_flag_request_id: a,
                        $feature_flag_evaluated_at: l,
                        $feature_flag_bootstrapped_response:
                          (null == (m = this.Rt.bootstrap) || null == (m = m.featureFlags)
                            ? void 0
                            : m[e]) || null,
                        $feature_flag_bootstrapped_payload:
                          (null == (y = this.Rt.bootstrap) || null == (y = y.featureFlagPayloads)
                            ? void 0
                            : y[e]) || null,
                        $used_bootstrap_value: !this.zn,
                      };
                      M(null == p || null == (b = p.metadata) ? void 0 : b.version) ||
                        (g.$feature_flag_version = p.metadata.version);
                      var _,
                        f,
                        m,
                        y,
                        b,
                        w,
                        x,
                        E,
                        k,
                        S,
                        P,
                        R =
                          null != (w = null == p || null == (x = p.reason) ? void 0 : x.description)
                            ? w
                            : null == p || null == (E = p.reason)
                              ? void 0
                              : E.code;
                      R && (g.$feature_flag_reason = R),
                        null != p &&
                          null != (k = p.metadata) &&
                          k.id &&
                          (g.$feature_flag_id = p.metadata.id),
                        (M(null == p ? void 0 : p.original_variant) &&
                          M(null == p ? void 0 : p.original_enabled)) ||
                          (g.$feature_flag_original_response = M(p.original_variant)
                            ? p.original_enabled
                            : p.original_variant),
                        null != p &&
                          null != (S = p.metadata) &&
                          S.original_payload &&
                          (g.$feature_flag_original_payload =
                            null == p || null == (P = p.metadata) ? void 0 : P.original_payload),
                        v.length && (g.$feature_flag_error = v.join(",")),
                        this._instance.capture("$feature_flag_called", g);
                    }
                    if (s) {
                      var F = n;
                      if (!M(n))
                        try {
                          F = JSON.parse(n);
                        } catch (e) {}
                      return {
                        key: e,
                        enabled: !!r,
                        variant: "string" == typeof r ? r : void 0,
                        payload: F,
                      };
                    }
                  }
                } else nd.warn('getFeatureFlagResult for key "' + e + nv);
            }
            getRemoteConfigPayload(e, t) {
              var i = this.Rt.token,
                s = { distinct_id: this._instance.get_distinct_id(), token: i };
              this.Kn() && (s.evaluation_contexts = this.Jn()),
                this._instance._send_request({
                  method: "POST",
                  url: this._instance.requestRouter.endpointFor("flags", "/flags/?v=2"),
                  data: s,
                  compression: this.Rt.disable_compression ? void 0 : st.Base64,
                  timeout: this.Rt.feature_flag_request_timeout_ms,
                  callback(i) {
                    var s,
                      r = null == (s = i.json) ? void 0 : s.featureFlagPayloads;
                    t((null == r ? void 0 : r[e]) || void 0);
                  },
                });
            }
            isFeatureEnabled(e, t) {
              if ((void 0 === t && (t = {}), !t.fresh || this.zn)) {
                if (this.Zn || (this.getFlags() && this.getFlags().length > 0)) {
                  var i = this.getFeatureFlag(e, t);
                  return M(i) ? void 0 : !!i;
                }
                nd.warn('isFeatureEnabled for key "' + e + nv);
              }
            }
            addFeatureFlagsHandler(e) {
              this.featureFlagEventHandlers.push(e);
            }
            removeFeatureFlagsHandler(e) {
              this.featureFlagEventHandlers = this.featureFlagEventHandlers.filter((t) => t !== e);
            }
            receivedFeatureFlags(e, t) {
              if (this.Kr) {
                this.Zn = !0;
                var i = this.getFlagVariants(),
                  s = this.getFlagPayloads(),
                  r = this.getFlagsWithDetails();
                !((e, t, i, s, r) => {
                  void 0 === i && (i = {}), void 0 === s && (s = {}), void 0 === r && (r = {});
                  var n,
                    o =
                      ((n = e.flags)
                        ? ((e.featureFlags = Object.fromEntries(
                            Object.keys(n).map((e) => {
                              var t;
                              return [e, null != (t = n[e].variant) ? t : n[e].enabled];
                            }),
                          )),
                          (e.featureFlagPayloads = Object.fromEntries(
                            Object.keys(n)
                              .filter((e) => n[e].enabled)
                              .filter((e) => {
                                var t;
                                return null == (t = n[e].metadata) ? void 0 : t.payload;
                              })
                              .map((e) => {
                                var t;
                                return [e, null == (t = n[e].metadata) ? void 0 : t.payload];
                              }),
                          )))
                        : nd.warn(
                            "Using an older version of the feature flags endpoint. Please upgrade your PostHog server to the latest version",
                          ),
                      e),
                    a = o.flags,
                    l = o.featureFlags,
                    u = o.featureFlagPayloads;
                  if (l) {
                    var c = e.requestId,
                      h = e.evaluatedAt;
                    if (T(l)) {
                      nd.warn(
                        "v1 of the feature flags endpoint is deprecated. Please use the latest version.",
                      );
                      var d = {};
                      if (l) for (var p = 0; l.length > p; p++) d[l[p]] = !0;
                      t && t.register({ [ng]: l, [tR]: d });
                    } else {
                      var v = l,
                        g = u,
                        _ = a;
                      if (e.errorsWhileComputingFlags)
                        if (a) {
                          var f = new Set(
                            Object.keys(a).filter((e) => {
                              var t;
                              return !(null != (t = a[e]) && t.failed);
                            }),
                          );
                          (v = m(
                            {},
                            i,
                            Object.fromEntries(
                              Object.entries(v).filter((e) => {
                                var [t] = e;
                                return f.has(t);
                              }),
                            ),
                          )),
                            (g = m(
                              {},
                              s,
                              Object.fromEntries(
                                Object.entries(g || {}).filter((e) => {
                                  var [t] = e;
                                  return f.has(t);
                                }),
                              ),
                            )),
                            (_ = m(
                              {},
                              r,
                              Object.fromEntries(
                                Object.entries(_ || {}).filter((e) => {
                                  var [t] = e;
                                  return f.has(t);
                                }),
                              ),
                            ));
                        } else (v = m({}, i, v)), (g = m({}, s, g)), (_ = m({}, r, _));
                      t &&
                        t.register(
                          m(
                            {
                              [ng]: Object.keys(nw(v)),
                              [tR]: v || {},
                              [nf]: g || {},
                              [t$]: _ || {},
                            },
                            c ? { [ny]: c } : {},
                            h ? { [tL]: h } : {},
                          ),
                        );
                    }
                  }
                })(e, this.Kr, i, s, r),
                  t || (this.Un = !1),
                  this.rs(t);
              }
            }
            override(e, t) {
              void 0 === t && (t = !1),
                nd.warn("override is deprecated. Please use overrideFeatureFlags instead."),
                this.overrideFeatureFlags({ flags: e, suppressWarning: t });
            }
            overrideFeatureFlags(e) {
              if (!this._instance.__loaded || !this.Kr)
                return nd.uninitializedWarning("posthog.featureFlags.overrideFeatureFlags");
              if (!1 === e)
                return (
                  this.Kr.unregister(n_),
                  this.Kr.unregister(nm),
                  this.rs(),
                  np.info("All overrides cleared")
                );
              if (T(e)) {
                var t,
                  i = nb(e);
                return (
                  this.Kr.register({ [n_]: i }),
                  this.rs(),
                  np.info("Flag overrides set", { flags: e })
                );
              }
              if (e && "object" == typeof e && ("flags" in e || "payloads" in e)) {
                if (((this.qn = !!(null != (t = e.suppressWarning) && t)), "flags" in e)) {
                  if (!1 === e.flags) this.Kr.unregister(n_), np.info("Flag overrides cleared");
                  else if (e.flags) {
                    if (T(e.flags)) {
                      var s = nb(e.flags);
                      this.Kr.register({ [n_]: s });
                    } else this.Kr.register({ [n_]: e.flags });
                    np.info("Flag overrides set", { flags: e.flags });
                  }
                }
                return (
                  "payloads" in e &&
                    (!1 === e.payloads
                      ? (this.Kr.unregister(nm), np.info("Payload overrides cleared"))
                      : e.payloads &&
                        (this.Kr.register({ [nm]: e.payloads }),
                        np.info("Payload overrides set", { payloads: e.payloads }))),
                  void this.rs()
                );
              }
              if (e && "object" == typeof e)
                return (
                  this.Kr.register({ [n_]: e }),
                  this.rs(),
                  np.info("Flag overrides set", { flags: e })
                );
              nd.warn("Invalid overrideOptions provided to overrideFeatureFlags", {
                overrideOptions: e,
              });
            }
            onFeatureFlags(e) {
              if ((this.addFeatureFlagsHandler(e), this.Zn)) {
                var { flags: t, flagVariants: i } = this.ns();
                e(t, i);
              }
              return () => this.removeFeatureFlagsHandler(e);
            }
            updateEarlyAccessFeatureEnrollment(e, t, i) {
              var s,
                r = (this.Wn(tF) || []).find((t) => t.flagKey === e),
                n = { ["$feature_enrollment/" + e]: t },
                o = { $feature_flag: e, $feature_enrollment: t, $set: n };
              r && (o.$early_access_feature_name = r.name),
                i && (o.$feature_enrollment_stage = i),
                this._instance.capture("$feature_enrollment_update", o),
                this.setPersonPropertiesForFlags(n, !1);
              var a = m({}, this.getFlagVariants(), { [e]: t });
              null == (s = this.Kr) || s.register({ [ng]: Object.keys(nw(a)), [tR]: a }), this.rs();
            }
            getEarlyAccessFeatures(e, t, i) {
              void 0 === t && (t = !1);
              var s = this.Wn(tF),
                r = i ? "&" + i.map((e) => "stage=" + e).join("&") : "";
              if (s && !t) return e(s);
              this._instance._send_request({
                url: this._instance.requestRouter.endpointFor(
                  "api",
                  "/api/early_access_features/?token=" + this.Rt.token + r,
                ),
                method: "GET",
                callback: (t) => {
                  var i, s;
                  if (t.json) {
                    var r = t.json.earlyAccessFeatures;
                    return (
                      null == (i = this.Kr) || i.unregister(tF),
                      null == (s = this.Kr) || s.register({ [tF]: r }),
                      e(r)
                    );
                  }
                },
              });
            }
            ns() {
              var e = this.getFlags(),
                t = this.getFlagVariants();
              return {
                flags: e.filter((e) => t[e]),
                flagVariants: Object.keys(t)
                  .filter((e) => t[e])
                  .reduce((e, i) => ((e[i] = t[i]), e), {}),
              };
            }
            rs(e) {
              var { flags: t, flagVariants: i } = this.ns();
              this.featureFlagEventHandlers.forEach((s) => s(t, i, { errorsLoading: e }));
            }
            setPersonPropertiesForFlags(e, t) {
              void 0 === t && (t = !0);
              var i = this.Wn(tT) || {},
                s = (null == e ? void 0 : e.$set) || (null != e && e.$set_once ? {} : e),
                r = null == e ? void 0 : e.$set_once,
                n = {};
              if (r) for (var o in r) Object.hasOwn(r, o) && (o in i || (n[o] = r[o]));
              this._instance.register({ [tT]: m({}, i, n, s) }),
                t && this._instance.reloadFeatureFlags();
            }
            resetPersonPropertiesForFlags() {
              this._instance.unregister(tT);
            }
            setGroupPropertiesForFlags(e, t) {
              void 0 === t && (t = !0);
              var i = this.Wn(tC) || {};
              0 !== Object.keys(i).length &&
                Object.keys(i).forEach((t) => {
                  (i[t] = m({}, i[t], e[t])), delete e[t];
                }),
                this._instance.register({ [tC]: m({}, i, e) }),
                t && this._instance.reloadFeatureFlags();
            }
            resetGroupPropertiesForFlags(e) {
              if (e) {
                var t = this.Wn(tC) || {};
                this._instance.register({ [tC]: m({}, t, { [e]: {} }) });
              } else this._instance.unregister(tC);
            }
            reset() {
              (this.Zn = !1),
                (this.$n = !1),
                (this.Hn = !1),
                (this.Vn = !1),
                (this.zn = !1),
                (this.$anon_distinct_id = void 0),
                this.es(),
                (this.qn = !1);
            }
          },
        },
        n$ = m(
          {
            productTours: class {
              get Kr() {
                return this._instance.persistence;
              }
              constructor(e) {
                (this.ho = null), (this.co = null), (this._instance = e);
              }
              initialize() {
                this.loadIfEnabled();
              }
              onRemoteConfig(e) {
                "productTours" in e &&
                  (this.Kr && this.Kr.register({ [tx]: !!e.productTours }), this.loadIfEnabled());
              }
              loadIfEnabled() {
                var e, t;
                this.ho ||
                  (e = this._instance).config.disable_product_tours ||
                  null == (t = e.persistence) ||
                  !t.get_property(tx) ||
                  this.nr(() => this.do());
              }
              nr(e) {
                var t, i;
                null != (t = p.__PosthogExtensions__) && t.generateProductTours
                  ? e()
                  : null == (i = p.__PosthogExtensions__) ||
                    null == i.loadExternalDependency ||
                    i.loadExternalDependency(this._instance, "product-tours", (t) => {
                      t ? r7.error("Could not load product tours script", t) : e();
                    });
              }
              do() {
                var e;
                !this.ho &&
                  null != (e = p.__PosthogExtensions__) &&
                  e.generateProductTours &&
                  (this.ho = p.__PosthogExtensions__.generateProductTours(this._instance, !0));
              }
              getProductTours(e, t) {
                if ((void 0 === t && (t = !1), !T(this.co) || t)) {
                  var i = this.Kr;
                  if (i) {
                    var s = i.props[r9];
                    if (T(s) && !t) return (this.co = s), void e(s, { isLoaded: !0 });
                  }
                  this._instance._send_request({
                    url: this._instance.requestRouter.endpointFor(
                      "api",
                      "/api/product_tours/?token=" + this._instance.config.token,
                    ),
                    method: "GET",
                    callback: (t) => {
                      var s = t.statusCode;
                      if (200 !== s || !t.json) {
                        var r = "Product Tours API could not be loaded, status: " + s;
                        return r7.error(r), void e([], { isLoaded: !1, error: r });
                      }
                      var n = T(t.json.product_tours) ? t.json.product_tours : [];
                      (this.co = n), i && i.register({ [r9]: n }), e(n, { isLoaded: !0 });
                    },
                  });
                } else e(this.co, { isLoaded: !0 });
              }
              getActiveProductTours(e) {
                D(this.ho)
                  ? e([], { isLoaded: !1, error: "Product tours not loaded" })
                  : this.ho.getActiveProductTours(e);
              }
              showProductTour(e) {
                var t;
                null == (t = this.ho) || t.showTourById(e);
              }
              previewTour(e) {
                this.ho
                  ? this.ho.previewTour(e)
                  : this.nr(() => {
                      var t;
                      this.do(), null == (t = this.ho) || t.previewTour(e);
                    });
              }
              dismissProductTour() {
                var e;
                null == (e = this.ho) || e.dismissTour("user_clicked_skip");
              }
              nextStep() {
                var e;
                null == (e = this.ho) || e.nextStep();
              }
              previousStep() {
                var e;
                null == (e = this.ho) || e.previousStep();
              }
              clearCache() {
                var e;
                (this.co = null), null == (e = this.Kr) || e.unregister(r9);
              }
              resetTour(e) {
                var t;
                null == (t = this.ho) || t.resetTour(e);
              }
              resetAllTours() {
                var e;
                null == (e = this.ho) || e.resetAllTours();
              }
              cancelPendingTour(e) {
                var t;
                null == (t = this.ho) || t.cancelPendingTour(e);
              }
            },
          },
          nF,
        ),
        nT = m(
          {
            surveys: class {
              get Rt() {
                return this._instance.config;
              }
              constructor(e) {
                (this._o = void 0),
                  (this._surveyManager = null),
                  (this.Io = !1),
                  (this.Co = []),
                  (this.So = null),
                  (this._instance = e),
                  (this._surveyEventReceiver = null);
              }
              initialize() {
                this.loadIfEnabled();
              }
              onRemoteConfig(e) {
                if (!this.Rt.disable_surveys) {
                  var t = e.surveys;
                  if (D(t)) return s5.warn("Flags not loaded yet. Not loading surveys.");
                  var i = T(t);
                  (this._o = i ? t.length > 0 : t),
                    s5.info("flags response received, isSurveysEnabled: " + this._o),
                    this.loadIfEnabled();
                }
              }
              reset() {
                localStorage.removeItem("lastSeenSurveyDate");
                for (var e = [], t = 0; t < localStorage.length; t++) {
                  var i = localStorage.key(t);
                  ((null != i && i.startsWith(s6)) ||
                    (null != i && i.startsWith("inProgressSurvey_"))) &&
                    e.push(i);
                }
                e.forEach((e) => localStorage.removeItem(e));
              }
              loadIfEnabled() {
                if (!this._surveyManager)
                  if (this.Io) s5.info("Already initializing surveys, skipping...");
                  else if (this.Rt.disable_surveys) s5.info(nl);
                  else if (this.Rt.cookieless_mode && this._instance.consent.isOptedOut())
                    s5.info("Not loading surveys in cookieless mode without consent.");
                  else {
                    var e = null == p ? void 0 : p.__PosthogExtensions__;
                    if (e) {
                      if (!M(this._o) || this.Rt.advanced_enable_surveys) {
                        var t = this._o || this.Rt.advanced_enable_surveys;
                        this.Io = !0;
                        try {
                          var i = e.generateSurveys;
                          if (i) return void this.ko(i, t);
                          var s = e.loadExternalDependency;
                          if (!s) return void this.xo(tG);
                          s(this._instance, "surveys", (i) => {
                            i || !e.generateSurveys
                              ? this.xo("Could not load surveys script", i)
                              : this.ko(e.generateSurveys, t);
                          });
                        } catch (e) {
                          throw (this.xo("Error initializing surveys", e), e);
                        } finally {
                          this.Io = !1;
                        }
                      }
                    } else s5.error("PostHog Extensions not found.");
                  }
              }
              ko(e, t) {
                (this._surveyManager = e(this._instance, t)),
                  (this._surveyEventReceiver = new no(this._instance)),
                  s5.info("Surveys loaded successfully"),
                  this.To({ isLoaded: !0 });
              }
              xo(e, t) {
                s5.error(e, t), this.To({ isLoaded: !1, error: e });
              }
              onSurveysLoaded(e) {
                return (
                  this.Co.push(e),
                  this._surveyManager && this.To({ isLoaded: !0 }),
                  () => {
                    this.Co = this.Co.filter((t) => t !== e);
                  }
                );
              }
              getSurveys(e, t) {
                if ((void 0 === t && (t = !1), this.Rt.disable_surveys)) return s5.info(nl), e([]);
                var i,
                  s = this._instance.get_property(tI);
                if (s && !t) return e(s, { isLoaded: !0 });
                "undefined" != typeof Promise && this.So
                  ? this.So.then((t) => {
                      var { surveys: i, context: s } = t;
                      return e(i, s);
                    })
                  : ("undefined" != typeof Promise &&
                      (this.So = new Promise((e) => {
                        i = e;
                      })),
                    this._instance._send_request({
                      url: this._instance.requestRouter.endpointFor(
                        "api",
                        "/api/surveys/?token=" + this.Rt.token,
                      ),
                      method: "GET",
                      timeout: this.Rt.surveys_request_timeout_ms,
                      callback: (t) => {
                        this.So = null;
                        var s = t.statusCode;
                        if (200 !== s || !t.json) {
                          var r = "Surveys API could not be loaded, status: " + s;
                          s5.error(r);
                          var n = { isLoaded: !1, error: r };
                          return e([], n), void (null == i || i({ surveys: [], context: n }));
                        }
                        var o,
                          a,
                          l = t.json.surveys || [],
                          u = l.filter((e) => {
                            var t, i;
                            return (
                              !(!e.start_date || e.end_date) &&
                              (!(
                                null == (t = e.conditions) ||
                                null == (t = t.events) ||
                                null == (t = t.values) ||
                                !t.length
                              ) ||
                                !(
                                  null == (i = e.conditions) ||
                                  null == (i = i.actions) ||
                                  null == (i = i.values) ||
                                  !i.length
                                ))
                            );
                          });
                        u.length > 0 && (null == (a = this._surveyEventReceiver) || a.register(u)),
                          null == (o = this._instance.persistence) || o.register({ [tI]: l });
                        var c = { isLoaded: !0 };
                        e(l, c), null == i || i({ surveys: l, context: c });
                      },
                    }));
              }
              To(e) {
                for (var t of this.Co)
                  try {
                    if (!e.isLoaded) return t([], e);
                    this.getSurveys(t);
                  } catch (e) {
                    s5.error("Error in survey callback", e);
                  }
              }
              getActiveMatchingSurveys(e, t) {
                if ((void 0 === t && (t = !1), !D(this._surveyManager)))
                  return this._surveyManager.getActiveMatchingSurveys(e, t);
                s5.warn("init was not called");
              }
              Ao(e) {
                var t = null;
                return (
                  this.getSurveys((i) => {
                    var s;
                    t = null != (s = i.find((t) => t.id === e)) ? s : null;
                  }),
                  t
                );
              }
              Eo(e) {
                if (D(this._surveyManager)) return { eligible: !1, reason: na };
                var t = "string" == typeof e ? this.Ao(e) : e;
                return t
                  ? this._surveyManager.checkSurveyEligibility(t)
                  : { eligible: !1, reason: "Survey not found" };
              }
              canRenderSurvey(e) {
                if (D(this._surveyManager))
                  return s5.warn("init was not called"), { visible: !1, disabledReason: na };
                var t = this.Eo(e);
                return { visible: t.eligible, disabledReason: t.reason };
              }
              canRenderSurveyAsync(e, t) {
                return D(this._surveyManager)
                  ? (s5.warn("init was not called"),
                    Promise.resolve({ visible: !1, disabledReason: na }))
                  : new Promise((i) => {
                      this.getSurveys((t) => {
                        var s,
                          r = null != (s = t.find((t) => t.id === e)) ? s : null;
                        if (r) {
                          var n = this.Eo(r);
                          i({ visible: n.eligible, disabledReason: n.reason });
                        } else i({ visible: !1, disabledReason: "Survey not found" });
                      }, t);
                    });
              }
              renderSurvey(e, t, i) {
                var s;
                if (D(this._surveyManager)) s5.warn("init was not called");
                else {
                  var r = "string" == typeof e ? this.Ao(e) : e;
                  if (null != r && r.id)
                    if (s4.includes(r.type)) {
                      var n = null == o ? void 0 : o.querySelector(t);
                      if (n)
                        return null != (s = r.appearance) && s.surveyPopupDelaySeconds
                          ? (s5.info(
                              "Rendering survey " +
                                r.id +
                                " with delay of " +
                                r.appearance.surveyPopupDelaySeconds +
                                " seconds",
                            ),
                            void setTimeout(() => {
                              var e, t;
                              s5.info(
                                "Rendering survey " +
                                  r.id +
                                  " with delay of " +
                                  (null == (e = r.appearance)
                                    ? void 0
                                    : e.surveyPopupDelaySeconds) +
                                  " seconds",
                              ),
                                null == (t = this._surveyManager) || t.renderSurvey(r, n, i),
                                s5.info("Survey " + r.id + " rendered");
                            }, 1e3 * r.appearance.surveyPopupDelaySeconds))
                          : void this._surveyManager.renderSurvey(r, n, i);
                      s5.warn("Survey element not found");
                    } else s5.warn("Surveys of type " + r.type + " cannot be rendered in the app");
                  else s5.warn("Survey not found");
                }
              }
              displaySurvey(e, t) {
                var i;
                if (D(this._surveyManager)) s5.warn("init was not called");
                else {
                  var s = this.Ao(e);
                  if (s) {
                    var r = s;
                    if (
                      (null != (i = s.appearance) &&
                        i.surveyPopupDelaySeconds &&
                        t.ignoreDelay &&
                        (r = m({}, s, {
                          appearance: m({}, s.appearance, { surveyPopupDelaySeconds: 0 }),
                        })),
                      t.displayType !== i5.Popover &&
                        t.initialResponses &&
                        s5.warn(
                          "initialResponses is only supported for popover surveys. prefill will not be applied.",
                        ),
                      !1 === t.ignoreConditions)
                    ) {
                      var n = this.canRenderSurvey(s);
                      if (!n.visible)
                        return void s5.warn(
                          "Survey is not eligible to be displayed: ",
                          n.disabledReason,
                        );
                    }
                    t.displayType !== i5.Inline
                      ? this._surveyManager.handlePopoverSurvey(r, t)
                      : this.renderSurvey(r, t.selector, t.properties);
                  } else s5.warn("Survey not found");
                }
              }
              cancelPendingSurvey(e) {
                D(this._surveyManager)
                  ? s5.warn("init was not called")
                  : this._surveyManager.cancelSurvey(e);
              }
              handlePageUnload() {
                var e;
                null == (e = this._surveyManager) || e.handlePageUnload();
              }
            },
          },
          nF,
        ),
        nC = m({ experiments: nS }, nF),
        nI = m(
          {},
          nF,
          {
            sessionRecording: class {
              get Rt() {
                return this._instance.config;
              }
              get Kr() {
                return this._instance.persistence;
              }
              get started() {
                var e;
                return !(null == (e = this.ss) || !e.isStarted);
              }
              get status() {
                var e, t;
                return this.os === r2 || this.os === r3
                  ? this.os
                  : null != (e = null == (t = this.ss) ? void 0 : t.status)
                    ? e
                    : this.os;
              }
              constructor(e) {
                if (
                  ((this._forceAllowLocalhostNetworkCapture = !1),
                  (this.os = r0),
                  (this.ls = void 0),
                  (this._instance = e),
                  !this._instance.sessionManager)
                )
                  throw (
                    (r6.error("started without valid sessionManager"),
                    Error(r5 + " started without valid sessionManager. This is a bug."))
                  );
                if (this.Rt.cookieless_mode === tY)
                  throw Error(r5 + ' cannot be used with cookieless_mode="always"');
              }
              initialize() {
                this.startIfEnabledOrStop();
              }
              get us() {
                var e,
                  t = !(null == (e = this._instance.get_property(tk)) || !e.enabled),
                  i = !this.Rt.disable_session_recording,
                  r = this.Rt.disable_session_recording || this._instance.consent.isOptedOut();
                return s && t && i && !r;
              }
              startIfEnabledOrStop(e) {
                var t;
                if (!this.us || null == (t = this.ss) || !t.isStarted) {
                  var i = !M(Object.assign) && !M(Array.from);
                  this.us && i
                    ? (this.hs(e), r6.info("starting"))
                    : ((this.os = r0), this.stopRecording());
                }
              }
              hs(e) {
                var t, i, s;
                this.us &&
                  (this.os !== r2 && this.os !== r3 && (this.os = r1),
                  null != p &&
                  null != (t = p.__PosthogExtensions__) &&
                  null != (t = t.rrweb) &&
                  t.record &&
                  null != (i = p.__PosthogExtensions__) &&
                  i.initSessionRecording
                    ? this.cs(e)
                    : null == (s = p.__PosthogExtensions__) ||
                      null == s.loadExternalDependency ||
                      s.loadExternalDependency(this._instance, this.ds, (t) => {
                        if (t) return r6.error("could not load recorder", t);
                        this.cs(e);
                      }));
              }
              stopRecording() {
                var e, t;
                null == (e = this.ls) || e.call(this),
                  (this.ls = void 0),
                  null == (t = this.ss) || t.stop();
              }
              vs() {
                var e, t;
                null == (e = this.ls) || e.call(this),
                  (this.ls = void 0),
                  null == (t = this.ss) || t.discard();
              }
              fs() {
                var e;
                null == (e = this.Kr) || e.unregister(tP);
              }
              ps(e, t) {
                if (D(e)) return null;
                var i = j(e) ? e : parseFloat(e);
                return "number" != typeof i || !Number.isFinite(i) || 0 > i || i > 1
                  ? (r6.warn(t + " must be between 0 and 1. Ignoring invalid value:", e), null)
                  : i;
              }
              gs(e) {
                if (this.Kr) {
                  var t,
                    i,
                    s = this.Kr,
                    r = () => {
                      var t,
                        i = !1 === e.sessionRecording ? void 0 : e.sessionRecording,
                        r = this.ps(
                          null == (t = this.Rt.session_recording) ? void 0 : t.sampleRate,
                          "session_recording.sampleRate",
                        ),
                        n = this.ps(null == i ? void 0 : i.sampleRate, "remote config sampleRate"),
                        o = null != r ? r : n;
                      D(o) && this.fs();
                      var a = null == i ? void 0 : i.minimumDurationMilliseconds;
                      s.register({
                        [tk]: m({ cache_timestamp: Date.now(), enabled: !!i }, i, {
                          networkPayloadCapture: m(
                            { capturePerformance: e.capturePerformance },
                            null == i ? void 0 : i.networkPayloadCapture,
                          ),
                          canvasRecording: {
                            enabled: null == i ? void 0 : i.recordCanvas,
                            fps: null == i ? void 0 : i.canvasFps,
                            quality: null == i ? void 0 : i.canvasQuality,
                          },
                          sampleRate: o,
                          minimumDurationMilliseconds: M(a) ? null : a,
                          endpoint: null == i ? void 0 : i.endpoint,
                          triggerMatchType: null == i ? void 0 : i.triggerMatchType,
                          masking: null == i ? void 0 : i.masking,
                          urlTriggers: null == i ? void 0 : i.urlTriggers,
                        }),
                      });
                    };
                  r(),
                    null == (t = this.ls) || t.call(this),
                    (this.ls =
                      null == (i = this._instance.sessionManager) ? void 0 : i.onSessionId(r));
                }
              }
              onRemoteConfig(e) {
                return "sessionRecording" in e
                  ? !1 === e.sessionRecording
                    ? (this.gs(e), void this.vs())
                    : (this.gs(e), void this.startIfEnabledOrStop())
                  : (this.os === r2 &&
                      ((this.os = r3),
                      r6.warn("config refresh failed, recording will not start until page reload")),
                    void this.startIfEnabledOrStop());
              }
              log(e, t) {
                var i;
                void 0 === t && (t = "log"),
                  null != (i = this.ss) && i.log
                    ? this.ss.log(e, t)
                    : r6.warn("log called before recorder was ready");
              }
              get ds() {
                var e,
                  t,
                  i =
                    null == (e = this._instance) || null == (e = e.persistence)
                      ? void 0
                      : e.get_property(tk);
                return (
                  (null == i || null == (t = i.scriptConfig) ? void 0 : t.script) || "lazy-recorder"
                );
              }
              ys() {
                var e,
                  t = this._instance.get_property(tk);
                if (!t) return !1;
                var i =
                  null != (e = ("object" == typeof t ? t : JSON.parse(t)).cache_timestamp)
                    ? e
                    : Date.now();
                return 36e5 >= Date.now() - i;
              }
              cs(e) {
                var t, i;
                if (null == (t = p.__PosthogExtensions__) || !t.initSessionRecording)
                  return (
                    r6.warn(
                      "Called on script loaded before session recording is available. This can be caused by adblockers.",
                    ),
                    void this._instance.register_for_session({
                      $sdk_debug_recording_script_not_loaded: !0,
                    })
                  );
                if (
                  (this.ss ||
                    ((this.ss =
                      null == (i = p.__PosthogExtensions__)
                        ? void 0
                        : i.initSessionRecording(this._instance)),
                    (this.ss._forceAllowLocalhostNetworkCapture =
                      this._forceAllowLocalhostNetworkCapture)),
                  !this.ys())
                ) {
                  if (this.os === r3 || this.os === r2) return;
                  return (
                    (this.os = r2),
                    r6.info(
                      "persisted remote config is stale, requesting fresh config before starting",
                    ),
                    void new se(this._instance).load()
                  );
                }
                (this.os = r1), this.ss.start(e);
              }
              onRRwebEmit(e) {
                var t;
                null == (t = this.ss) || null == t.onRRwebEmit || t.onRRwebEmit(e);
              }
              overrideLinkedFlag() {
                var e, t;
                this.ss ||
                  null == (t = this.Kr) ||
                  t.register({ $replay_override_linked_flag: !0 }),
                  null == (e = this.ss) || e.overrideLinkedFlag();
              }
              overrideSampling() {
                var e, t;
                this.ss || null == (t = this.Kr) || t.register({ $replay_override_sampling: !0 }),
                  null == (e = this.ss) || e.overrideSampling();
              }
              overrideTrigger(e) {
                var t, i;
                this.ss ||
                  null == (i = this.Kr) ||
                  i.register({
                    ["url" === e
                      ? "$replay_override_url_trigger"
                      : "$replay_override_event_trigger"]: !0,
                  }),
                  null == (t = this.ss) || t.overrideTrigger(e);
              }
              get sdkDebugProperties() {
                var e;
                return (
                  (null == (e = this.ss) ? void 0 : e.sdkDebugProperties) || {
                    $recording_status: this.status,
                  }
                );
              }
              tryAddCustomEvent(e, t) {
                var i;
                return !(null == (i = this.ss) || !i.tryAddCustomEvent(e, t));
              }
            },
          },
          {
            autocapture: class {
              constructor(e) {
                (this.bs = !1),
                  (this.ws = null),
                  (this._s = !1),
                  (this.instance = e),
                  (this.rageclicks = new rV(e.config.rageclick)),
                  (this.Is = null);
              }
              initialize() {
                this.startIfEnabled();
              }
              get Rt() {
                var e,
                  t,
                  i = I(this.instance.config.autocapture) ? this.instance.config.autocapture : {};
                return (
                  (i.url_allowlist =
                    null == (e = i.url_allowlist) ? void 0 : e.map((e) => new RegExp(e))),
                  (i.url_ignorelist =
                    null == (t = i.url_ignorelist) ? void 0 : t.map((e) => new RegExp(e))),
                  i
                );
              }
              Cs() {
                if (this.isBrowserSupported()) {
                  if (s && o) {
                    var e = (e) => {
                      e = e || (null == s ? void 0 : s.event);
                      try {
                        this.Ss(e);
                      } catch (e) {
                        rK.error("Failed to capture event", e);
                      }
                    };
                    if (
                      (is(o, "submit", e, { capture: !0 }),
                      is(o, "change", e, { capture: !0 }),
                      is(o, "click", e, { capture: !0 }),
                      this.Rt.capture_copied_text)
                    ) {
                      var t = (e) => {
                        this.Ss((e = e || (null == s ? void 0 : s.event)), rG);
                      };
                      is(o, "copy", t, { capture: !0 }), is(o, "cut", t, { capture: !0 });
                    }
                  }
                } else
                  rK.info(
                    "Disabling Automatic Event Collection because this browser is not supported",
                  );
              }
              startIfEnabled() {
                this.isEnabled && !this.bs && (this.Cs(), (this.bs = !0));
              }
              onRemoteConfig(e) {
                e.elementsChainAsString && (this._s = e.elementsChainAsString),
                  this.instance.persistence &&
                    this.instance.persistence.register({ [tg]: !!e.autocapture_opt_out }),
                  (this.ws = !!e.autocapture_opt_out),
                  this.startIfEnabled();
              }
              setElementSelectors(e) {
                this.Is = e;
              }
              getElementSelectors(e) {
                var t,
                  i = [];
                return (
                  null == (t = this.Is) ||
                    t.forEach((t) => {
                      var s = null == o ? void 0 : o.querySelectorAll(t);
                      null == s ||
                        s.forEach((s) => {
                          e === s && i.push(t);
                        });
                    }),
                  i
                );
              }
              get isEnabled() {
                var e,
                  t,
                  i = null == (e = this.instance.persistence) ? void 0 : e.props[tg];
                if (null === this.ws && !q(i) && !this.instance.Tr()) return !1;
                var s = null != (t = this.ws) ? t : !!i;
                return !!this.instance.config.autocapture && !s;
              }
              Ss(e, t) {
                if ((void 0 === t && (t = "$autocapture"), this.isEnabled)) {
                  var i,
                    r = rR(e);
                  rb(r) && (r = r.parentNode || null),
                    "$autocapture" === t &&
                      "click" === e.type &&
                      e instanceof MouseEvent &&
                      this.instance.config.rageclick &&
                      null != (i = this.rageclicks) &&
                      i.isRageClick(e.clientX, e.clientY, e.timeStamp || new Date().getTime()) &&
                      ((e, t) => {
                        if (
                          !s ||
                          rO(e) ||
                          (q(t)
                            ? ((i = !!t && rI), (r = void 0))
                            : ((i =
                                null != (n = null == t ? void 0 : t.css_selector_ignorelist)
                                  ? n
                                  : rI),
                              (r = null == t ? void 0 : t.content_ignorelist)),
                          !1 === i)
                        )
                          return !1;
                        var i,
                          r,
                          n,
                          { targetElementList: o } = rM(e, !1);
                        return (
                          !((e, t) => {
                            var i;
                            if (!1 === e || M(e)) return !1;
                            if (!0 === e) i = rC;
                            else {
                              if (!T(e)) return !1;
                              if (e.length > 10)
                                return (
                                  ta.error(
                                    "[PostHog] content_ignorelist array cannot exceed 10 items. Use css_selector_ignorelist for more complex matching.",
                                  ),
                                  !1
                                );
                              i = e.map((e) => e.toLowerCase());
                            }
                            return t.some((e) => {
                              var { safeText: t, ariaLabel: s } = e;
                              return i.some((e) => t.includes(e) || s.includes(e));
                            });
                          })(
                            r,
                            o.map((e) => {
                              var t;
                              return {
                                safeText: rP(e).toLowerCase(),
                                ariaLabel:
                                  (null == (t = e.getAttribute("aria-label"))
                                    ? void 0
                                    : t.toLowerCase().trim()) || "",
                              };
                            }),
                          ) && !r$(o, i)
                        );
                      })(r, this.instance.config.rageclick) &&
                      this.Ss(e, "$rageclick");
                  var n = t === rG;
                  if (
                    r &&
                    ((e, t, i, r, n) => {
                      if (
                        (void 0 === i && (i = void 0),
                        !s ||
                          rO(e) ||
                          (null != (o = i) && o.url_allowlist && !rE(i.url_allowlist)) ||
                          (null != (a = i) && a.url_ignorelist && rE(i.url_ignorelist)))
                      )
                        return !1;
                      if (null != (l = i) && l.dom_event_allowlist) {
                        var o,
                          a,
                          l,
                          u,
                          c = i.dom_event_allowlist;
                        if (c && !c.some((e) => t.type === e)) return !1;
                      }
                      var { parentIsUsefulElement: h, targetElementList: d } = rM(e, r);
                      if (
                        !((e, t) => {
                          var i = null == t ? void 0 : t.element_allowlist;
                          if (M(i)) return !0;
                          var s,
                            r = (e) => {
                              if (i.some((t) => e.tagName.toLowerCase() === t)) return { v: !0 };
                            };
                          for (var n of e) if ((s = r(n))) return s.v;
                          return !1;
                        })(d, i) ||
                        !r$(d, null == (u = i) ? void 0 : u.css_selector_allowlist)
                      )
                        return !1;
                      var p = s.getComputedStyle(e);
                      if (p && "pointer" === p.getPropertyValue("cursor") && "click" === t.type)
                        return !0;
                      var v = e.tagName.toLowerCase();
                      switch (v) {
                        case "html":
                          return !1;
                        case "form":
                          return (n || ["submit"]).indexOf(t.type) >= 0;
                        case "input":
                        case "select":
                        case "textarea":
                          return (n || ["change", "click"]).indexOf(t.type) >= 0;
                        default:
                          return h
                            ? (n || ["click"]).indexOf(t.type) >= 0
                            : (n || ["click"]).indexOf(t.type) >= 0 &&
                                (rF.indexOf(v) > -1 ||
                                  "true" === e.getAttribute("contenteditable"));
                      }
                    })(r, e, this.Rt, n, n ? ["copy", "cut"] : void 0)
                  ) {
                    var { props: o, explicitNoCapture: a } = ((e, t) => {
                      for (
                        var i,
                          r,
                          {
                            e: n,
                            maskAllElementAttributes: o,
                            maskAllText: a,
                            elementAttributeIgnoreList: l,
                            elementsChainAsString: u,
                          } = t,
                          c = [e],
                          h = e;
                        h.parentNode && !ry(h, "body");
                      )
                        rw(h.parentNode)
                          ? (c.push(h.parentNode.host), (h = h.parentNode.host))
                          : (c.push(h.parentNode), (h = h.parentNode));
                      var d,
                        p = [],
                        v = {},
                        g = !1,
                        _ = !1;
                      if (
                        (t8(c, (e) => {
                          var t = rA(e);
                          "a" === e.tagName.toLowerCase() &&
                            ((g = e.getAttribute("href")), (g = t && g && rH(g) && g)),
                            k(rk(e), "ph-no-capture") && (_ = !0),
                            p.push(
                              ((e, t, i, s) => {
                                var r = e.tagName.toLowerCase(),
                                  n = { tag_name: r };
                                rF.indexOf(r) > -1 &&
                                  !i &&
                                  (n.$el_text =
                                    "a" === r.toLowerCase() || "button" === r.toLowerCase()
                                      ? rY(1024, rz(e))
                                      : rY(1024, rP(e)));
                                var o = rk(e);
                                o.length > 0 && (n.classes = o.filter((e) => "" !== e)),
                                  t8(e.attributes, (i) => {
                                    var r;
                                    if (
                                      (!rL(e) ||
                                        -1 !==
                                          ["name", "id", "class", "aria-label"].indexOf(i.name)) &&
                                      (null == s || !s.includes(i.name)) &&
                                      !t &&
                                      rH(i.value) &&
                                      (!A((r = i.name)) ||
                                        ("_ngcontent" !== r.substring(0, 10) &&
                                          "_nghost" !== r.substring(0, 7)))
                                    ) {
                                      var o = i.value;
                                      "class" === i.name && (o = rx(o).join(" ")),
                                        (n["attr__" + i.name] = rY(1024, o));
                                    }
                                  });
                                for (
                                  var a = 1, l = 1, u = e;
                                  (u = ((e) => {
                                    if (e.previousElementSibling) return e.previousElementSibling;
                                    var t = e;
                                    do t = t.previousSibling;
                                    while (t && !rm(t));
                                    return t;
                                  })(u));
                                )
                                  a++, u.tagName === e.tagName && l++;
                                return (n.nth_child = a), (n.nth_of_type = l), n;
                              })(e, o, a, l),
                            ),
                            t4(
                              v,
                              ((e) => {
                                if (!rA(e)) return {};
                                var t = {};
                                return (
                                  t8(e.attributes, (e) => {
                                    if (
                                      e.name &&
                                      0 === e.name.indexOf("data-ph-capture-attribute")
                                    ) {
                                      var i = e.name.replace("data-ph-capture-attribute-", ""),
                                        s = e.value;
                                      i && s && rH(s) && (t[i] = s);
                                    }
                                  }),
                                  t
                                );
                              })(e),
                            );
                        }),
                        _)
                      )
                        return { props: {}, explicitNoCapture: _ };
                      if (
                        (a ||
                          (p[0].$el_text =
                            "a" === e.tagName.toLowerCase() || "button" === e.tagName.toLowerCase()
                              ? rz(e)
                              : rP(e)),
                        g)
                      ) {
                        p[0].attr__href = g;
                        var f,
                          y,
                          b = null == (f = iM(g)) ? void 0 : f.host,
                          w = null == s || null == (y = s.location) ? void 0 : y.host;
                        b && w && b !== w && (d = g);
                      }
                      return {
                        props: t4(
                          { $event_type: n.type, $ce_version: 1 },
                          u ? {} : { $elements: p },
                          {
                            $elements_chain: p
                              .map((e) => {
                                var t,
                                  i,
                                  s,
                                  r = {
                                    text: null == (i = e.$el_text) ? void 0 : i.slice(0, 400),
                                    tag_name: e.tag_name,
                                    href: null == (s = e.attr__href) ? void 0 : s.slice(0, 2048),
                                    attr_class: (t = e.attr__class) ? (T(t) ? t : rx(t)) : void 0,
                                    attr_id: e.attr__id,
                                    nth_child: e.nth_child,
                                    nth_of_type: e.nth_of_type,
                                    attributes: {},
                                  };
                                return (
                                  t7(e)
                                    .filter((e) => {
                                      var [t] = e;
                                      return 0 === t.indexOf("attr__");
                                    })
                                    .forEach((e) => {
                                      var [t, i] = e;
                                      return (r.attributes[t] = i);
                                    }),
                                  r
                                );
                              })
                              .map((e) => {
                                var t,
                                  i,
                                  s = "";
                                if ((e.tag_name && (s += e.tag_name), e.attr_class))
                                  for (var r of (e.attr_class.sort(), e.attr_class))
                                    s += "." + r.replace(/"/g, "");
                                var n = m(
                                    {},
                                    e.text ? { text: e.text } : {},
                                    {
                                      "nth-child": null != (t = e.nth_child) ? t : 0,
                                      "nth-of-type": null != (i = e.nth_of_type) ? i : 0,
                                    },
                                    e.href ? { href: e.href } : {},
                                    e.attr_id ? { attr_id: e.attr_id } : {},
                                    e.attributes,
                                  ),
                                  o = {};
                                return (
                                  t7(n)
                                    .sort((e, t) => {
                                      var [i] = e,
                                        [s] = t;
                                      return i.localeCompare(s);
                                    })
                                    .forEach((e) => {
                                      var [t, i] = e;
                                      return (o[rB(t.toString())] = rB(i.toString()));
                                    }),
                                  (s += ":") +
                                    t7(o)
                                      .map((e) => {
                                        var [t, i] = e;
                                        return t + '="' + i + '"';
                                      })
                                      .join("")
                                );
                              })
                              .join(";"),
                          },
                          null != (i = p[0]) && i.$el_text
                            ? { $el_text: null == (r = p[0]) ? void 0 : r.$el_text }
                            : {},
                          d && "click" === n.type ? { $external_click_url: d } : {},
                          v,
                        ),
                      };
                    })(r, {
                      e: e,
                      maskAllElementAttributes: this.instance.config.mask_all_element_attributes,
                      maskAllText: this.instance.config.mask_all_text,
                      elementAttributeIgnoreList: this.Rt.element_attribute_ignorelist,
                      elementsChainAsString: this._s,
                    });
                    if (a) return !1;
                    var l = this.getElementSelectors(r);
                    if ((l && l.length > 0 && (o.$element_selectors = l), t === rG)) {
                      var u,
                        c = rS(null == s || null == (u = s.getSelection()) ? void 0 : u.toString()),
                        h = e.type || "clipboard";
                      if (!c) return !1;
                      (o.$selected_content = c), (o.$copy_type = h);
                    }
                    return this.instance.capture(t, o), !0;
                  }
                }
              }
              isBrowserSupported() {
                return C(null == o ? void 0 : o.querySelectorAll);
              }
            },
            historyAutocapture: class {
              constructor(e) {
                var t;
                (this._instance = e),
                  (this.ks = (null == s || null == (t = s.location) ? void 0 : t.pathname) || "");
              }
              initialize() {
                this.startIfEnabled();
              }
              get isEnabled() {
                return "history_change" === this._instance.config.capture_pageview;
              }
              startIfEnabled() {
                this.isEnabled &&
                  (ta.info("History API monitoring enabled, starting..."),
                  this.monitorHistoryChanges());
              }
              stop() {
                this.xs && this.xs(), (this.xs = void 0), ta.info("History API monitoring stopped");
              }
              monitorHistoryChanges() {
                var e, t;
                if (s && s.history) {
                  var i = this;
                  (null != (e = s.history.pushState) && e.__posthog_wrapped__) ||
                    rX(
                      s.history,
                      "pushState",
                      (e) =>
                        function (t, s, r) {
                          e.call(this, t, s, r), i.Ts("pushState");
                        },
                    ),
                    (null != (t = s.history.replaceState) && t.__posthog_wrapped__) ||
                      rX(
                        s.history,
                        "replaceState",
                        (e) =>
                          function (t, s, r) {
                            e.call(this, t, s, r), i.Ts("replaceState");
                          },
                      ),
                    this.As();
                }
              }
              Ts(e) {
                try {
                  var t,
                    i = null == s || null == (t = s.location) ? void 0 : t.pathname;
                  if (!i) return;
                  i !== this.ks &&
                    this.isEnabled &&
                    this._instance.capture(t1, { navigation_type: e }),
                    (this.ks = i);
                } catch (t) {
                  ta.error("Error capturing " + e + " pageview", t);
                }
              }
              As() {
                if (!this.xs) {
                  var e = () => {
                    this.Ts("popstate");
                  };
                  is(s, "popstate", e),
                    (this.xs = () => {
                      s && s.removeEventListener("popstate", e);
                    });
                }
              }
            },
            heatmaps: class {
              get Rt() {
                return this.instance.config;
              }
              constructor(e) {
                var t;
                (this.Es = !1),
                  (this.bs = !1),
                  (this.Rs = null),
                  (this.instance = e),
                  (this.Es = !(null == (t = this.instance.persistence) || !t.props[t_])),
                  (this.rageclicks = new rV(e.config.rageclick));
              }
              initialize() {
                this.startIfEnabled();
              }
              get flushIntervalMilliseconds() {
                var e = 5e3;
                return (
                  I(this.Rt.capture_heatmaps) &&
                    this.Rt.capture_heatmaps.flush_interval_milliseconds &&
                    (e = this.Rt.capture_heatmaps.flush_interval_milliseconds),
                  e
                );
              }
              get isEnabled() {
                return D(this.Rt.capture_heatmaps)
                  ? D(this.Rt.enable_heatmaps)
                    ? this.Es
                    : this.Rt.enable_heatmaps
                  : !1 !== this.Rt.capture_heatmaps;
              }
              startIfEnabled() {
                if (this.isEnabled) this.bs || (r8.info("starting..."), this.Ns(), this.Tt());
                else {
                  var e;
                  clearInterval(null != (e = this.Rs) ? e : void 0),
                    this.Ms(),
                    this.getAndClearBuffer();
                }
              }
              onRemoteConfig(e) {
                if ("heatmaps" in e) {
                  var t = !!e.heatmaps;
                  this.instance.persistence && this.instance.persistence.register({ [t_]: t }),
                    (this.Es = t),
                    this.startIfEnabled();
                }
              }
              getAndClearBuffer() {
                var e = this.T;
                return (this.T = void 0), e;
              }
              Fs(e) {
                this.wt(e.originalEvent, "deadclick");
              }
              Tt() {
                this.Rs && clearInterval(this.Rs),
                  (this.Rs =
                    "visible" === (null == o ? void 0 : o.visibilityState)
                      ? setInterval(this.Zr.bind(this), this.flushIntervalMilliseconds)
                      : null);
              }
              Ns() {
                s &&
                  o &&
                  ((this.Os = this.Zr.bind(this)),
                  is(s, t0, this.Os),
                  (this.Ps = (e) => this.wt(e || (null == s ? void 0 : s.event))),
                  is(o, "click", this.Ps, { capture: !0 }),
                  (this.Ls = (e) => this.Ds(e || (null == s ? void 0 : s.event))),
                  is(o, "mousemove", this.Ls, { capture: !0 }),
                  (this.Bs = new iF(this.instance, iP, this.Fs.bind(this))),
                  this.Bs.startIfEnabledOrStop(),
                  (this.js = this.Tt.bind(this)),
                  is(o, tQ, this.js),
                  (this.bs = !0));
              }
              Ms() {
                var e;
                s &&
                  o &&
                  (this.Os && s.removeEventListener(t0, this.Os),
                  this.Ps && o.removeEventListener("click", this.Ps, { capture: !0 }),
                  this.Ls && o.removeEventListener("mousemove", this.Ls, { capture: !0 }),
                  this.js && o.removeEventListener(tQ, this.js),
                  clearTimeout(this.qs),
                  null == (e = this.Bs) || e.stop(),
                  (this.bs = !1));
              }
              Zs(e, t) {
                var i = this.instance.scrollManager.scrollY(),
                  r = this.instance.scrollManager.scrollX(),
                  n = this.instance.scrollManager.scrollElement(),
                  o = ((e, t, i) => {
                    for (var r = e; r && rm(r) && !ry(r, "body") && r !== i; ) {
                      if (k(t, null == s ? void 0 : s.getComputedStyle(r).position)) return !0;
                      r = rT(r);
                    }
                    return !1;
                  })(rR(e), ["fixed", "sticky"], n);
                return {
                  x: e.clientX + (o ? 0 : r),
                  y: e.clientY + (o ? 0 : i),
                  target_fixed: o,
                  type: t,
                };
              }
              wt(e, t) {
                var i;
                if ((void 0 === t && (t = "click"), !rf(e.target) && r4(e))) {
                  var s = this.Zs(e, t);
                  null != (i = this.rageclicks) &&
                    i.isRageClick(e.clientX, e.clientY, new Date().getTime()) &&
                    this.$s(m({}, s, { type: "rageclick" })),
                    this.$s(s);
                }
              }
              Ds(e) {
                !rf(e.target) &&
                  r4(e) &&
                  (clearTimeout(this.qs),
                  (this.qs = setTimeout(() => {
                    this.$s(this.Zs(e, "mousemove"));
                  }, 500)));
              }
              $s(e) {
                if (s) {
                  var t = s.location.href,
                    i = this.Rt.custom_personal_data_properties,
                    r = iL(
                      t,
                      this.Rt.mask_personal_data_properties ? [...iN, ...(i || [])] : [],
                      iU,
                    );
                  (this.T = this.T || {}), this.T[r] || (this.T[r] = []), this.T[r].push(e);
                }
              }
              Zr() {
                this.T &&
                  !O(this.T) &&
                  this.instance.capture("$$heatmap", { $heatmap_data: this.getAndClearBuffer() });
              }
            },
            deadClicksAutocapture: iF,
            webVitalsAutocapture: class {
              constructor(e) {
                var t;
                (this.Es = !1),
                  (this.bs = !1),
                  (this.T = { url: void 0, metrics: [], firstMetricTimestamp: void 0 }),
                  (this.Hs = () => {
                    clearTimeout(this.Vs),
                      0 !== this.T.metrics.length &&
                        (this._instance.capture(
                          "$web_vitals",
                          this.T.metrics.reduce(
                            (e, t) =>
                              m({}, e, {
                                ["$web_vitals_" + t.name + "_event"]: m({}, t),
                                ["$web_vitals_" + t.name + "_value"]: t.value,
                              }),
                            {},
                          ),
                        ),
                        (this.T = { url: void 0, metrics: [], firstMetricTimestamp: void 0 }));
                  }),
                  (this.nt = (e) => {
                    var t,
                      i =
                        null == (t = this._instance.sessionManager)
                          ? void 0
                          : t.checkAndGetSessionAndWindowId(!0);
                    if (M(i)) rQ.error("Could not read session ID. Dropping metrics!");
                    else {
                      this.T = this.T || { url: void 0, metrics: [], firstMetricTimestamp: void 0 };
                      var s = this.zs();
                      M(s) ||
                        (D(null == e ? void 0 : e.name) || D(null == e ? void 0 : e.value)
                          ? rQ.error("Invalid metric received", e)
                          : !this.Ys || this.Ys > e.value
                            ? (this.T.url !== s &&
                                (this.Hs(),
                                (this.Vs = setTimeout(this.Hs, this.flushToCaptureTimeoutMs))),
                              M(this.T.url) && (this.T.url = s),
                              (this.T.firstMetricTimestamp = M(this.T.firstMetricTimestamp)
                                ? Date.now()
                                : this.T.firstMetricTimestamp),
                              e.attribution &&
                                e.attribution.interactionTargetElement &&
                                (e.attribution.interactionTargetElement = void 0),
                              this.T.metrics.push(
                                m({}, e, {
                                  $current_url: s,
                                  $session_id: i.sessionId,
                                  $window_id: i.windowId,
                                  timestamp: Date.now(),
                                }),
                              ),
                              this.T.metrics.length === this.allowedMetrics.length && this.Hs())
                            : rQ.error("Ignoring metric with value >= " + this.Ys, e));
                    }
                  }),
                  (this.Us = () => {
                    if (!this.bs) {
                      var e,
                        t,
                        i,
                        s,
                        r = p.__PosthogExtensions__;
                      M(r) ||
                        M(r.postHogWebVitalsCallbacks) ||
                        ({ onLCP: e, onCLS: t, onFCP: i, onINP: s } = r.postHogWebVitalsCallbacks),
                        e && t && i && s
                          ? (this.allowedMetrics.indexOf("LCP") > -1 && e(this.nt.bind(this)),
                            this.allowedMetrics.indexOf("CLS") > -1 && t(this.nt.bind(this)),
                            this.allowedMetrics.indexOf("FCP") > -1 && i(this.nt.bind(this)),
                            this.allowedMetrics.indexOf("INP") > -1 && s(this.nt.bind(this)),
                            (this.bs = !0))
                          : rQ.error("web vitals callbacks not loaded - not starting");
                    }
                  }),
                  (this._instance = e),
                  (this.Es = !(null == (t = this._instance.persistence) || !t.props[tb])),
                  this.startIfEnabled();
              }
              get Ws() {
                return this._instance.config.capture_performance;
              }
              get allowedMetrics() {
                var e,
                  t,
                  i = I(this.Ws)
                    ? null == (e = this.Ws)
                      ? void 0
                      : e.web_vitals_allowed_metrics
                    : void 0;
                return D(i)
                  ? (null == (t = this._instance.persistence) ? void 0 : t.props[tE]) || [
                      "CLS",
                      "FCP",
                      "INP",
                      "LCP",
                    ]
                  : i;
              }
              get flushToCaptureTimeoutMs() {
                return (I(this.Ws) ? this.Ws.web_vitals_delayed_flush_ms : void 0) || 5e3;
              }
              get useAttribution() {
                var e = I(this.Ws) ? this.Ws.web_vitals_attribution : void 0;
                return null != e && e;
              }
              get Ys() {
                var e =
                  I(this.Ws) && j(this.Ws.__web_vitals_max_value)
                    ? this.Ws.__web_vitals_max_value
                    : 9e5;
                return e > 0 && 6e4 >= e ? 9e5 : e;
              }
              get isEnabled() {
                var e = null == a ? void 0 : a.protocol;
                if ("http:" !== e && "https:" !== e)
                  return rQ.info("Web Vitals are disabled on non-http/https protocols"), !1;
                var t = I(this.Ws) ? this.Ws.web_vitals : q(this.Ws) ? this.Ws : void 0;
                return q(t) ? t : this.Es;
              }
              startIfEnabled() {
                this.isEnabled && !this.bs && (rQ.info("enabled, starting..."), this.nr(this.Us));
              }
              onRemoteConfig(e) {
                if ("capturePerformance" in e) {
                  var t = I(e.capturePerformance) && !!e.capturePerformance.web_vitals,
                    i = I(e.capturePerformance)
                      ? e.capturePerformance.web_vitals_allowed_metrics
                      : void 0;
                  this._instance.persistence &&
                    (this._instance.persistence.register({ [tb]: t }),
                    this._instance.persistence.register({ [tE]: i })),
                    (this.Es = t),
                    this.startIfEnabled();
                }
              }
              nr(e) {
                var t, i;
                null != (t = p.__PosthogExtensions__) && t.postHogWebVitalsCallbacks
                  ? e()
                  : null == (i = p.__PosthogExtensions__) ||
                    null == i.loadExternalDependency ||
                    i.loadExternalDependency(
                      this._instance,
                      this.useAttribution ? "web-vitals-with-attribution" : "web-vitals",
                      (t) => {
                        t ? rQ.error("failed to load script", t) : e();
                      },
                    );
              }
              zs() {
                var e = s ? s.location.href : void 0;
                if (e) {
                  var t = this._instance.config.custom_personal_data_properties;
                  return iL(
                    e,
                    this._instance.config.mask_personal_data_properties
                      ? [...iN, ...(t || [])]
                      : [],
                    iU,
                  );
                }
                rQ.error("Could not determine current URL");
              }
            },
          },
          {
            exceptionObserver: class {
              constructor(e) {
                var t, i, r;
                (this.Us = () => {
                  var e;
                  if (
                    s &&
                    this.isEnabled &&
                    null != (e = p.__PosthogExtensions__) &&
                    e.errorWrappingFunctions
                  ) {
                    var t = p.__PosthogExtensions__.errorWrappingFunctions.wrapOnError,
                      i = p.__PosthogExtensions__.errorWrappingFunctions.wrapUnhandledRejection,
                      r = p.__PosthogExtensions__.errorWrappingFunctions.wrapConsoleError;
                    try {
                      !this.Gs &&
                        this.Rt.capture_unhandled_errors &&
                        (this.Gs = t(this.captureException.bind(this))),
                        !this.Xs &&
                          this.Rt.capture_unhandled_rejections &&
                          (this.Xs = i(this.captureException.bind(this))),
                        !this.Js &&
                          this.Rt.capture_console_errors &&
                          (this.Js = r(this.captureException.bind(this)));
                    } catch (e) {
                      rJ.error("failed to start", e), this.Ks();
                    }
                  }
                }),
                  (this._instance = e),
                  (this.Qs = !(null == (t = this._instance.persistence) || !t.props[tf])),
                  (this.eo = new Y({
                    refillRate:
                      null !=
                      (i = this._instance.config.error_tracking.__exceptionRateLimiterRefillRate)
                        ? i
                        : 1,
                    bucketSize:
                      null !=
                      (r = this._instance.config.error_tracking.__exceptionRateLimiterBucketSize)
                        ? r
                        : 10,
                    refillInterval: 1e4,
                    qt: rJ,
                  })),
                  (this.Rt = this.ro()),
                  this.startIfEnabledOrStop();
              }
              ro() {
                var e = this._instance.config.capture_exceptions,
                  t = {
                    capture_unhandled_errors: !1,
                    capture_unhandled_rejections: !1,
                    capture_console_errors: !1,
                  };
                return (
                  I(e)
                    ? (t = m({}, t, e))
                    : (M(e) ? this.Qs : e) &&
                      (t = m({}, t, {
                        capture_unhandled_errors: !0,
                        capture_unhandled_rejections: !0,
                      })),
                  t
                );
              }
              get isEnabled() {
                return (
                  this.Rt.capture_console_errors ||
                  this.Rt.capture_unhandled_errors ||
                  this.Rt.capture_unhandled_rejections
                );
              }
              startIfEnabledOrStop() {
                this.isEnabled ? (rJ.info("enabled"), this.Ks(), this.nr(this.Us)) : this.Ks();
              }
              nr(e) {
                var t, i;
                null != (t = p.__PosthogExtensions__) && t.errorWrappingFunctions && e(),
                  null == (i = p.__PosthogExtensions__) ||
                    null == i.loadExternalDependency ||
                    i.loadExternalDependency(this._instance, "exception-autocapture", (t) => {
                      if (t) return rJ.error("failed to load script", t);
                      e();
                    });
              }
              Ks() {
                var e, t, i;
                null == (e = this.Gs) || e.call(this),
                  (this.Gs = void 0),
                  null == (t = this.Xs) || t.call(this),
                  (this.Xs = void 0),
                  null == (i = this.Js) || i.call(this),
                  (this.Js = void 0);
              }
              onRemoteConfig(e) {
                "autocaptureExceptions" in e &&
                  ((this.Qs = !!e.autocaptureExceptions),
                  this._instance.persistence &&
                    this._instance.persistence.register({ [tf]: this.Qs }),
                  (this.Rt = this.ro()),
                  this.startIfEnabledOrStop());
              }
              onConfigChange() {
                this.Rt = this.ro();
              }
              captureException(e) {
                var t,
                  i,
                  s,
                  r =
                    null !=
                    (t =
                      null == e || null == (i = e.$exception_list) || null == (i = i[0])
                        ? void 0
                        : i.type)
                      ? t
                      : "Exception";
                this.eo.consumeRateLimit(r)
                  ? rJ.info("Skipping exception capture because of client rate limiting.", {
                      exception: r,
                    })
                  : null == (s = this._instance.exceptions) || s.sendExceptionEvent(e);
              }
            },
            exceptions: class {
              constructor(e) {
                var t, i;
                (this.io = []),
                  (this.no = new eK(
                    [
                      new e6(),
                      new tn(),
                      new e4(),
                      new e8(),
                      new ts(),
                      new ti(),
                      new e9(),
                      new tr(),
                    ],
                    (function (e) {
                      for (
                        var t = arguments.length, i = Array(t > 1 ? t - 1 : 0), s = 1;
                        t > s;
                        s++
                      )
                        i[s - 1] = arguments[s];
                      return (t, s) => {
                        void 0 === s && (s = 0);
                        for (var r = [], n = t.split("\n"), o = s; n.length > o; o++) {
                          var a = n[o];
                          if (1024 >= a.length) {
                            var l = e5.test(a) ? a.replace(e5, "$1") : a;
                            if (!l.match(/\S*Error: /)) {
                              for (var u of i) {
                                var c = u(l, e);
                                if (c) {
                                  r.push(c);
                                  break;
                                }
                              }
                              if (r.length >= 50) break;
                            }
                          }
                        }
                        if (!r.length) return [];
                        var h = Array.from(r);
                        return (
                          h.reverse(),
                          h.slice(0, 50).map((e) =>
                            m({}, e, {
                              filename: e.filename || (h[h.length - 1] || {}).filename,
                              function: e.function || "?",
                            }),
                          )
                        );
                      };
                    })("web:javascript", e0, e3),
                  )),
                  (this._instance = e),
                  (this.io =
                    null !=
                    (t = null == (i = this._instance.persistence) ? void 0 : i.get_property(tm))
                      ? t
                      : []);
              }
              onRemoteConfig(e) {
                var t, i, s;
                if ("errorTracking" in e) {
                  var r =
                      null != (t = null == (i = e.errorTracking) ? void 0 : i.suppressionRules)
                        ? t
                        : [],
                    n = null == (s = e.errorTracking) ? void 0 : s.captureExtensionExceptions;
                  (this.io = r),
                    this._instance.persistence &&
                      this._instance.persistence.register({ [tm]: this.io, [ty]: n });
                }
              }
              get so() {
                var e,
                  t = !!this._instance.get_property(ty),
                  i = this._instance.config.error_tracking.captureExtensionExceptions;
                return null != (e = null != i ? i : t) && e;
              }
              buildProperties(e, t) {
                return this.no.buildFromUnknown(e, {
                  syntheticException: null == t ? void 0 : t.syntheticException,
                  mechanism: { handled: null == t ? void 0 : t.handled },
                });
              }
              sendExceptionEvent(e) {
                var t = e.$exception_list;
                if (this.oo(t)) {
                  if (this.ao(t))
                    return void nx.info(
                      "Skipping exception capture because a suppression rule matched",
                    );
                  if (!this.so && this.lo(t))
                    return void nx.info(
                      "Skipping exception capture because it was thrown by an extension",
                    );
                  if (
                    !this._instance.config.error_tracking.__capturePostHogExceptions &&
                    this.uo(t)
                  )
                    return void nx.info(
                      "Skipping exception capture because it was thrown by the PostHog SDK",
                    );
                }
                return this._instance.capture("$exception", e, {
                  _noTruncate: !0,
                  _batchKey: "exceptionEvent",
                  zi: !0,
                });
              }
              ao(e) {
                if (0 === e.length) return !1;
                var t = e.reduce(
                  (e, t) => {
                    var { type: i, value: s } = t;
                    return (
                      A(i) && i.length > 0 && e.$exception_types.push(i),
                      A(s) && s.length > 0 && e.$exception_values.push(s),
                      e
                    );
                  },
                  { $exception_types: [], $exception_values: [] },
                );
                return this.io.some((e) => {
                  var i = e.values.map((e) => {
                    var i,
                      s = sZ[e.operator],
                      r = T(e.value) ? e.value : [e.value],
                      n = null != (i = t[e.key]) ? i : [];
                    return r.length > 0 && s(r, n);
                  });
                  return "OR" === e.type ? i.some(Boolean) : i.every(Boolean);
                });
              }
              lo(e) {
                return e
                  .flatMap((e) => {
                    var t, i;
                    return null != (t = null == (i = e.stacktrace) ? void 0 : i.frames) ? t : [];
                  })
                  .some((e) => e.filename && e.filename.startsWith("chrome-extension://"));
              }
              uo(e) {
                if (e.length > 0) {
                  var t,
                    i,
                    s,
                    r,
                    n = null != (t = null == (i = e[0].stacktrace) ? void 0 : i.frames) ? t : [],
                    o = n[n.length - 1];
                  return (
                    null !=
                      (s =
                        null == o || null == (r = o.filename)
                          ? void 0
                          : r.includes("posthog.com/static")) && s
                  );
                }
                return !1;
              }
              oo(e) {
                return !D(e) && T(e);
              }
            },
          },
          n$,
          {
            siteApps: class {
              constructor(e) {
                (this._instance = e), (this.vo = []), (this.apps = {});
              }
              get isEnabled() {
                return !!this._instance.config.opt_in_site_apps;
              }
              fo(e, t) {
                if (t) {
                  var i = this.globalsForEvent(t);
                  this.vo.push(i), this.vo.length > 1e3 && (this.vo = this.vo.slice(10));
                }
              }
              get siteAppLoaders() {
                var e;
                return null == (e = p._POSTHOG_REMOTE_CONFIG) ||
                  null == (e = e[this._instance.config.token])
                  ? void 0
                  : e.siteApps;
              }
              initialize() {
                if (this.isEnabled) {
                  var e = this._instance._addCaptureHook(this.fo.bind(this));
                  this.po = () => {
                    e(), (this.vo = []), (this.po = void 0);
                  };
                }
              }
              globalsForEvent(e) {
                if (!e) throw Error("Event payload is required");
                var t,
                  i,
                  s,
                  r,
                  n,
                  o,
                  a,
                  l = {},
                  u = this._instance.get_property("$groups") || [];
                for (var [c, h] of Object.entries(
                  this._instance.get_property("$stored_group_properties") || {},
                ))
                  l[c] = { id: u[c], type: c, properties: h };
                var { $set_once: d, $set: p } = e;
                return {
                  event: m({}, y(e, ne), {
                    properties: m(
                      {},
                      e.properties,
                      p
                        ? {
                            $set: m(
                              {},
                              null != (t = null == (i = e.properties) ? void 0 : i.$set) ? t : {},
                              p,
                            ),
                          }
                        : {},
                      d
                        ? {
                            $set_once: m(
                              {},
                              null != (s = null == (r = e.properties) ? void 0 : r.$set_once)
                                ? s
                                : {},
                              d,
                            ),
                          }
                        : {},
                    ),
                    elements_chain:
                      null != (n = null == (o = e.properties) ? void 0 : o.$elements_chain)
                        ? n
                        : "",
                    distinct_id: null == (a = e.properties) ? void 0 : a.distinct_id,
                  }),
                  person: { properties: this._instance.get_property("$stored_person_properties") },
                  groups: l,
                };
              }
              setupSiteApp(e) {
                var t = this.apps[e.id],
                  i = () => {
                    var i;
                    !t.errored &&
                      this.vo.length &&
                      (nt.info(
                        "Processing " + this.vo.length + " events for site app with id " + e.id,
                      ),
                      this.vo.forEach((e) => (null == t.processEvent ? void 0 : t.processEvent(e))),
                      (t.processedBuffer = !0)),
                      Object.values(this.apps).every((e) => e.processedBuffer || e.errored) &&
                        (null == (i = this.po) || i.call(this));
                  },
                  s = !1,
                  r = (r) => {
                    (t.errored = !r),
                      (t.loaded = !0),
                      nt.info("Site app with id " + e.id + " " + (r ? "loaded" : "errored")),
                      s && i();
                  };
                try {
                  var { processEvent: n } = e.init({
                    posthog: this._instance,
                    callback(e) {
                      r(e);
                    },
                  });
                  n && (t.processEvent = n), (s = !0);
                } catch (t) {
                  nt.error(ni + e.id, t), r(!1);
                }
                if (s && t.loaded)
                  try {
                    i();
                  } catch (i) {
                    nt.error(
                      "Error while processing buffered events PostHog app with config id " + e.id,
                      i,
                    ),
                      (t.errored = !0);
                  }
              }
              mo() {
                var e = this.siteAppLoaders || [];
                for (var t of e)
                  this.apps[t.id] = { id: t.id, loaded: !1, errored: !1, processedBuffer: !1 };
                for (var i of e) this.setupSiteApp(i);
              }
              yo(e) {
                if (0 !== Object.keys(this.apps).length) {
                  var t = this.globalsForEvent(e);
                  for (var i of Object.values(this.apps))
                    try {
                      null == i.processEvent || i.processEvent(t);
                    } catch (t) {
                      nt.error(
                        "Error while processing event " + e.event + " for site app " + i.id,
                        t,
                      );
                    }
                }
              }
              onRemoteConfig(e) {
                var t, i, s;
                if (null != (t = this.siteAppLoaders) && t.length)
                  return this.isEnabled
                    ? (this.mo(), void this._instance.on("eventCaptured", (e) => this.yo(e)))
                    : void nt.error(
                        'PostHog site apps are disabled. Enable the "opt_in_site_apps" config to proceed.',
                      );
                if ((null == (i = this.po) || i.call(this), null != (s = e.siteApps) && s.length))
                  if (this.isEnabled) {
                    var n = (e) => {
                      var t;
                      (p["__$$ph_site_app_" + e] = this._instance),
                        null == (t = p.__PosthogExtensions__) ||
                          null == t.loadSiteApp ||
                          t.loadSiteApp(this._instance, a, (t) => {
                            if (t) return nt.error(ni + e, t);
                          });
                    };
                    for (var { id: o, url: a } of e.siteApps) n(o);
                  } else
                    nt.error(
                      'PostHog site apps are disabled. Enable the "opt_in_site_apps" config to proceed.',
                    );
              }
            },
          },
          nT,
          {
            tracingHeaders: class {
              constructor(e) {
                (this.bo = void 0),
                  (this.wo = void 0),
                  (this.Us = () => {
                    var e, t;
                    M(this.bo) &&
                      (null == (e = p.__PosthogExtensions__) ||
                        null == (e = e.tracingHeadersPatchFns) ||
                        e._patchXHR(
                          this._instance.config.__add_tracing_headers || [],
                          this._instance.get_distinct_id(),
                          this._instance.sessionManager,
                        )),
                      M(this.wo) &&
                        (null == (t = p.__PosthogExtensions__) ||
                          null == (t = t.tracingHeadersPatchFns) ||
                          t._patchFetch(
                            this._instance.config.__add_tracing_headers || [],
                            this._instance.get_distinct_id(),
                            this._instance.sessionManager,
                          ));
                  }),
                  (this._instance = e);
              }
              initialize() {
                this.startIfEnabledOrStop();
              }
              nr(e) {
                var t, i;
                null != (t = p.__PosthogExtensions__) && t.tracingHeadersPatchFns && e(),
                  null == (i = p.__PosthogExtensions__) ||
                    null == i.loadExternalDependency ||
                    i.loadExternalDependency(this._instance, "tracing-headers", (t) => {
                      if (t) return rZ.error("failed to load script", t);
                      e();
                    });
              }
              startIfEnabledOrStop() {
                var e, t;
                this._instance.config.__add_tracing_headers
                  ? this.nr(this.Us)
                  : (null == (e = this.bo) || e.call(this),
                    null == (t = this.wo) || t.call(this),
                    (this.bo = void 0),
                    (this.wo = void 0));
              }
            },
          },
          {
            toolbar: class {
              constructor(e) {
                this.instance = e;
              }
              Ro(e) {
                p.ph_toolbar_state = e;
              }
              No() {
                var e;
                return null != (e = p.ph_toolbar_state) ? e : 0;
              }
              initialize() {
                return this.maybeLoadToolbar();
              }
              maybeLoadToolbar(e, t, i) {
                if (
                  (void 0 === e && (e = void 0),
                  void 0 === t && (t = void 0),
                  void 0 === i && (i = void 0),
                  ir(this.instance.config) || !s || !o)
                )
                  return !1;
                (e = null != e ? e : s.location), (i = null != i ? i : s.history);
                try {
                  if (!t) {
                    try {
                      s.localStorage.setItem("test", "test"), s.localStorage.removeItem("test");
                    } catch (e) {
                      return !1;
                    }
                    t = null == s ? void 0 : s.localStorage;
                  }
                  var r,
                    n = nu || iD(e.hash, "__posthog") || iD(e.hash, "state"),
                    a = n
                      ? t9(() => JSON.parse(atob(decodeURIComponent(n)))) ||
                        t9(() => JSON.parse(decodeURIComponent(n)))
                      : null;
                  return (
                    a && "ph_authorize" === a.action
                      ? (((r = a).source = "url"),
                        r &&
                          Object.keys(r).length > 0 &&
                          (a.desiredHash
                            ? (e.hash = a.desiredHash)
                            : i
                              ? i.replaceState(i.state, "", e.pathname + e.search)
                              : (e.hash = "")))
                      : (((r = JSON.parse(t.getItem(nc) || "{}")).source = "localstorage"),
                        delete r.userIntent),
                    !(
                      !r.token ||
                      this.instance.config.token !== r.token ||
                      (this.loadToolbar(r), 0)
                    )
                  );
                } catch (e) {
                  return !1;
                }
              }
              Mo(e) {
                var t = p.ph_load_toolbar || p.ph_load_editor;
                !D(t) && C(t) ? t(e, this.instance) : nh.warn("No toolbar load function found");
              }
              loadToolbar(e) {
                var t,
                  i = !(null == o || !o.getElementById(tz));
                if (!s || i) return !1;
                var r =
                    "custom" === this.instance.requestRouter.region &&
                    this.instance.config.advanced_disable_toolbar_metrics,
                  n = m(
                    { token: this.instance.config.token },
                    e,
                    { apiURL: this.instance.requestRouter.endpointFor("ui") },
                    r ? { instrument: !1 } : {},
                  );
                return (
                  (s.localStorage.setItem(nc, JSON.stringify(m({}, n, { source: void 0 }))),
                  2 === this.No())
                    ? this.Mo(n)
                    : 0 === this.No() &&
                      (this.Ro(1),
                      null == (t = p.__PosthogExtensions__) ||
                        null == t.loadExternalDependency ||
                        t.loadExternalDependency(this.instance, "toolbar", (e) => {
                          if (e) return nh.error("[Toolbar] Failed to load", e), void this.Ro(0);
                          this.Ro(2), this.Mo(n);
                        }),
                      is(s, "turbolinks:load", () => {
                        this.Ro(0), this.loadToolbar(n);
                      })),
                  !0
                );
              }
              Fo(e) {
                return this.loadToolbar(e);
              }
              maybeLoadEditor(e, t, i) {
                return (
                  void 0 === e && (e = void 0),
                  void 0 === t && (t = void 0),
                  void 0 === i && (i = void 0),
                  this.maybeLoadToolbar(e, t, i)
                );
              }
            },
          },
          nC,
          {
            conversations: class {
              constructor(e) {
                (this.Oo = void 0),
                  (this._conversationsManager = null),
                  (this.Po = !1),
                  (this.Lo = null),
                  (this._instance = e);
              }
              initialize() {
                this.loadIfEnabled();
              }
              onRemoteConfig(e) {
                if (!this._instance.config.disable_conversations) {
                  var t = e.conversations;
                  D(t) ||
                    (q(t) ? (this.Oo = t) : ((this.Oo = t.enabled), (this.Lo = t)),
                    this.loadIfEnabled());
                }
              }
              reset() {
                var e;
                null == (e = this._conversationsManager) || e.reset(),
                  (this._conversationsManager = null),
                  (this.Oo = void 0),
                  (this.Lo = null);
              }
              loadIfEnabled() {
                if (
                  !(
                    this._conversationsManager ||
                    this.Po ||
                    this._instance.config.disable_conversations ||
                    ir(this._instance.config) ||
                    (this._instance.config.cookieless_mode && this._instance.consent.isOptedOut())
                  )
                ) {
                  var e = null == p ? void 0 : p.__PosthogExtensions__;
                  if (e && !M(this.Oo) && this.Oo)
                    if (this.Lo && this.Lo.token) {
                      this.Po = !0;
                      try {
                        var t = e.initConversations;
                        if (t) return this.Do(t), void (this.Po = !1);
                        var i = e.loadExternalDependency;
                        if (!i) return void this.Bo(tG);
                        i(this._instance, "conversations", (t) => {
                          t || !e.initConversations
                            ? this.Bo("Could not load conversations script", t)
                            : this.Do(e.initConversations),
                            (this.Po = !1);
                        });
                      } catch (e) {
                        this.Bo("Error initializing conversations", e), (this.Po = !1);
                      }
                    } else nP.error("Conversations enabled but missing token in remote config.");
                }
              }
              Do(e) {
                if (this.Lo)
                  try {
                    (this._conversationsManager = e(this.Lo, this._instance)),
                      nP.info("Conversations loaded successfully");
                  } catch (e) {
                    this.Bo("Error completing conversations initialization", e);
                  }
                else nP.error("Cannot complete initialization: remote config is null");
              }
              Bo(e, t) {
                nP.error(e, t), (this._conversationsManager = null), (this.Po = !1);
              }
              show() {
                this._conversationsManager
                  ? this._conversationsManager.show()
                  : nP.warn("Conversations not loaded yet.");
              }
              hide() {
                this._conversationsManager && this._conversationsManager.hide();
              }
              isAvailable() {
                return !0 === this.Oo && null !== this._conversationsManager;
              }
              isVisible() {
                var e, t;
                return (
                  null != (e = null == (t = this._conversationsManager) ? void 0 : t.isVisible()) &&
                  e
                );
              }
              sendMessage(e, t, i) {
                var s = this;
                return f(function* () {
                  return s._conversationsManager
                    ? s._conversationsManager.sendMessage(e, t, i)
                    : (nP.warn(nR), null);
                })();
              }
              getMessages(e, t) {
                var i = this;
                return f(function* () {
                  return i._conversationsManager
                    ? i._conversationsManager.getMessages(e, t)
                    : (nP.warn(nR), null);
                })();
              }
              markAsRead(e) {
                var t = this;
                return f(function* () {
                  return t._conversationsManager
                    ? t._conversationsManager.markAsRead(e)
                    : (nP.warn(nR), null);
                })();
              }
              getTickets(e) {
                var t = this;
                return f(function* () {
                  return t._conversationsManager
                    ? t._conversationsManager.getTickets(e)
                    : (nP.warn(nR), null);
                })();
              }
              requestRestoreLink(e) {
                var t = this;
                return f(function* () {
                  return t._conversationsManager
                    ? t._conversationsManager.requestRestoreLink(e)
                    : (nP.warn(nR), null);
                })();
              }
              restoreFromToken(e) {
                var t = this;
                return f(function* () {
                  return t._conversationsManager
                    ? t._conversationsManager.restoreFromToken(e)
                    : (nP.warn(nR), null);
                })();
              }
              restoreFromUrlToken() {
                var e = this;
                return f(function* () {
                  return e._conversationsManager
                    ? e._conversationsManager.restoreFromUrlToken()
                    : (nP.warn(nR), null);
                })();
              }
              getCurrentTicketId() {
                var e, t;
                return null !=
                  (e = null == (t = this._conversationsManager) ? void 0 : t.getCurrentTicketId())
                  ? e
                  : null;
              }
              getWidgetSessionId() {
                var e, t;
                return null !=
                  (e = null == (t = this._conversationsManager) ? void 0 : t.getWidgetSessionId())
                  ? e
                  : null;
              }
              Ki() {
                var e;
                null == (e = this._conversationsManager) || e.setIdentity();
              }
              Qi() {
                var e;
                null == (e = this._conversationsManager) || e.clearIdentity();
              }
            },
          },
          {
            logs: class {
              constructor(e) {
                var t;
                (this.jo = !1),
                  (this.qo = !1),
                  (this._instance = e),
                  this._instance &&
                    null != (t = this._instance.config.logs) &&
                    t.captureConsoleLogs &&
                    (this.jo = !0);
              }
              initialize() {
                this.loadIfEnabled();
              }
              onRemoteConfig(e) {
                var t,
                  i = null == (t = e.logs) ? void 0 : t.captureConsoleLogs;
                !D(i) && i && ((this.jo = !0), this.loadIfEnabled());
              }
              reset() {}
              loadIfEnabled() {
                if (this.jo && !this.qo) {
                  var e = tl("[logs]"),
                    t = null == p ? void 0 : p.__PosthogExtensions__;
                  if (t) {
                    var i = t.loadExternalDependency;
                    i
                      ? i(this._instance, "logs", (i) => {
                          var s;
                          i || null == (s = t.logs) || !s.initializeLogs
                            ? e.error("Could not load logs script", i)
                            : (t.logs.initializeLogs(this._instance), (this.qo = !0));
                        })
                      : e.error(tG);
                  } else e.error("PostHog Extensions not found.");
                }
              }
            },
          },
        );
      r_.__defaultExtensionClasses = m({}, nI);
      var nO,
        nM =
          ((nO = ri[rc] = new r_()),
          (() => {
            function e() {
              e.done ||
                ((e.done = !0),
                (rh = !1),
                t8(ri, (e) => {
                  e._dom_loaded();
                }));
            }
            null != o && o.addEventListener
              ? "complete" === o.readyState
                ? e()
                : is(o, "DOMContentLoaded", e, { capture: !1 })
              : s &&
                ta.error(
                  "Browser doesn't support `document.addEventListener` so PostHog couldn't be initialized",
                );
          })(),
          nO);
    },
  },
]);
