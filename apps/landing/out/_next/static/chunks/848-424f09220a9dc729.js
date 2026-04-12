(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [848],
  {
    31: (e, t, i) => {
      let n;
      i.d(t, { k: () => s });
      var a = i(1031),
        r = i(7562);
      function l() {
        n = void 0;
      }
      const s = {
        now: () => (
          void 0 === n &&
            s.set(r.uv.isProcessing || a.W.useManualTiming ? r.uv.timestamp : performance.now()),
          n
        ),
        set: (e) => {
          (n = e), queueMicrotask(l);
        },
      };
    },
    62: (e, t, i) => {
      i.d(t, { q: () => n });
      const n = (e, t, i) => {
        const n = t - e;
        return 0 === n ? 1 : (i - e) / n;
      };
    },
    860: (e, t, i) => {
      i.d(t, { Uu: () => r });
      var n = i(4539);
      const a = "undefined" != typeof window;
      function r() {
        if (((n.r.current = !0), a))
          if (window.matchMedia) {
            const e = window.matchMedia("(prefers-reduced-motion)"),
              t = () => (n.O.current = e.matches);
            e.addEventListener("change", t), t();
          } else n.O.current = !1;
      }
    },
    1031: (e, t, i) => {
      i.d(t, { W: () => n });
      const n = {};
    },
    1051: (e, t, i) => {
      i.d(t, { P: () => aB });
      const n = [
          "transformPerspective",
          "x",
          "y",
          "z",
          "translateX",
          "translateY",
          "translateZ",
          "scale",
          "scaleX",
          "scaleY",
          "rotate",
          "rotateX",
          "rotateY",
          "rotateZ",
          "skew",
          "skewX",
          "skewY",
        ],
        a = new Set(n);
      var r = i(8961),
        l = i(9142),
        s = i(7647);
      const o = new Set(["brightness", "contrast", "saturate", "opacity"]);
      function d(e) {
        const [t, i] = e.slice(0, -1).split("(");
        if ("drop-shadow" === t) return e;
        const [n] = i.match(s.S) || [];
        if (!n) return e;
        let a = i.replace(n, ""),
          r = +!!o.has(t);
        return n !== i && (r *= 100), t + "(" + r + a + ")";
      }
      const u = /\b([a-z-]*)\(.*?\)/gu,
        c = {
          ...l.f,
          getAnimatableNone: (e) => {
            const t = e.match(u);
            return t ? t.map(d).join(" ") : e;
          },
        },
        m = {
          ...l.f,
          getAnimatableNone: (e) => {
            const t = l.f.parse(e);
            return l.f.createTransformer(e)(
              t.map((e) =>
                "number" == typeof e ? 0 : "object" == typeof e ? { ...e, alpha: 1 } : e,
              ),
            );
          },
        };
      var h = i(8474);
      const f = { ...h.ai, transform: Math.round };
      var p = i(6191);
      const k = {
          rotate: p.uj,
          rotateX: p.uj,
          rotateY: p.uj,
          rotateZ: p.uj,
          scale: h.hs,
          scaleX: h.hs,
          scaleY: h.hs,
          scaleZ: h.hs,
          skew: p.uj,
          skewX: p.uj,
          skewY: p.uj,
          distance: p.px,
          translateX: p.px,
          translateY: p.px,
          translateZ: p.px,
          x: p.px,
          y: p.px,
          z: p.px,
          perspective: p.px,
          transformPerspective: p.px,
          opacity: h.X4,
          originX: p.gQ,
          originY: p.gQ,
          originZ: p.px,
        },
        _ = {
          borderWidth: p.px,
          borderTopWidth: p.px,
          borderRightWidth: p.px,
          borderBottomWidth: p.px,
          borderLeftWidth: p.px,
          borderRadius: p.px,
          borderTopLeftRadius: p.px,
          borderTopRightRadius: p.px,
          borderBottomRightRadius: p.px,
          borderBottomLeftRadius: p.px,
          width: p.px,
          maxWidth: p.px,
          height: p.px,
          maxHeight: p.px,
          top: p.px,
          right: p.px,
          bottom: p.px,
          left: p.px,
          inset: p.px,
          insetBlock: p.px,
          insetBlockStart: p.px,
          insetBlockEnd: p.px,
          insetInline: p.px,
          insetInlineStart: p.px,
          insetInlineEnd: p.px,
          padding: p.px,
          paddingTop: p.px,
          paddingRight: p.px,
          paddingBottom: p.px,
          paddingLeft: p.px,
          paddingBlock: p.px,
          paddingBlockStart: p.px,
          paddingBlockEnd: p.px,
          paddingInline: p.px,
          paddingInlineStart: p.px,
          paddingInlineEnd: p.px,
          margin: p.px,
          marginTop: p.px,
          marginRight: p.px,
          marginBottom: p.px,
          marginLeft: p.px,
          marginBlock: p.px,
          marginBlockStart: p.px,
          marginBlockEnd: p.px,
          marginInline: p.px,
          marginInlineStart: p.px,
          marginInlineEnd: p.px,
          fontSize: p.px,
          backgroundPositionX: p.px,
          backgroundPositionY: p.px,
          ...k,
          zIndex: f,
          fillOpacity: h.X4,
          strokeOpacity: h.X4,
          numOctaves: f,
        },
        b = {
          ..._,
          color: r.y,
          backgroundColor: r.y,
          outlineColor: r.y,
          fill: r.y,
          stroke: r.y,
          borderColor: r.y,
          borderTopColor: r.y,
          borderRightColor: r.y,
          borderBottomColor: r.y,
          borderLeftColor: r.y,
          filter: c,
          WebkitFilter: c,
          mask: m,
          WebkitMask: m,
        },
        g = (e) => b[e],
        y = () => ({ translate: 0, scale: 1, origin: 0, originPoint: 0 }),
        v = () => ({ x: y(), y: y() }),
        P = () => ({ min: 0, max: 0 }),
        T = () => ({ x: P(), y: P() }),
        j = (e) => !!(e && e.getVelocity),
        x = new Set(["width", "height", "top", "left", "right", "bottom", ...n]),
        S = (e) => (t) => t.test(e),
        E = [h.ai, p.px, p.KN, p.uj, p.vw, p.vh, { test: (e) => "auto" === e, parse: (e) => e }],
        w = (e) => E.find(S(e));
      var O = i(6826);
      const A = (e) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(e);
      var C = i(6883);
      const R = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u,
        M = (e) => (180 * e) / Math.PI,
        D = (e) => I(M(Math.atan2(e[1], e[0]))),
        G = {
          x: 4,
          y: 5,
          translateX: 4,
          translateY: 5,
          scaleX: 0,
          scaleY: 3,
          scale: (e) => (Math.abs(e[0]) + Math.abs(e[3])) / 2,
          rotate: D,
          rotateZ: D,
          skewX: (e) => M(Math.atan(e[1])),
          skewY: (e) => M(Math.atan(e[2])),
          skew: (e) => (Math.abs(e[1]) + Math.abs(e[2])) / 2,
        },
        I = (e) => ((e %= 360) < 0 && (e += 360), e),
        V = (e) => Math.sqrt(e[0] * e[0] + e[1] * e[1]),
        L = (e) => Math.sqrt(e[4] * e[4] + e[5] * e[5]),
        q = {
          x: 12,
          y: 13,
          z: 14,
          translateX: 12,
          translateY: 13,
          translateZ: 14,
          scaleX: V,
          scaleY: L,
          scale: (e) => (V(e) + L(e)) / 2,
          rotateX: (e) => I(M(Math.atan2(e[6], e[5]))),
          rotateY: (e) => I(M(Math.atan2(-e[2], e[0]))),
          rotateZ: D,
          rotate: D,
          skewX: (e) => M(Math.atan(e[4])),
          skewY: (e) => M(Math.atan(e[1])),
          skew: (e) => (Math.abs(e[1]) + Math.abs(e[4])) / 2,
        };
      function N(e) {
        return +!!e.includes("scale");
      }
      function F(e, t) {
        let i, n;
        if (!e || "none" === e) return N(t);
        const a = e.match(/^matrix3d\(([-\d.e\s,]+)\)$/u);
        if (a) (i = q), (n = a);
        else {
          const t = e.match(/^matrix\(([-\d.e\s,]+)\)$/u);
          (i = G), (n = t);
        }
        if (!n) return N(t);
        const r = i[t],
          l = n[1].split(",").map(B);
        return "function" == typeof r ? r(l) : l[r];
      }
      function B(e) {
        return parseFloat(e.trim());
      }
      const U = (e) => e === h.ai || e === p.px,
        $ = new Set(["x", "y", "z"]),
        W = n.filter((e) => !$.has(e)),
        H = {
          width: ({ x: e }, { paddingLeft: t = "0", paddingRight: i = "0", boxSizing: n }) => {
            const a = e.max - e.min;
            return "border-box" === n ? a : a - parseFloat(t) - parseFloat(i);
          },
          height: ({ y: e }, { paddingTop: t = "0", paddingBottom: i = "0", boxSizing: n }) => {
            const a = e.max - e.min;
            return "border-box" === n ? a : a - parseFloat(t) - parseFloat(i);
          },
          top: (e, { top: t }) => parseFloat(t),
          left: (e, { left: t }) => parseFloat(t),
          bottom: ({ y: e }, { top: t }) => parseFloat(t) + (e.max - e.min),
          right: ({ x: e }, { left: t }) => parseFloat(t) + (e.max - e.min),
          x: (e, { transform: t }) => F(t, "x"),
          y: (e, { transform: t }) => F(t, "y"),
        };
      (H.translateX = H.x), (H.translateY = H.y);
      var z = i(7562);
      let K = new Set(),
        X = !1,
        Y = !1,
        Q = !1;
      function J() {
        if (Y) {
          const e = Array.from(K).filter((e) => e.needsMeasurement),
            t = new Set(e.map((e) => e.element)),
            i = new Map();
          t.forEach((e) => {
            const t = ((e) => {
              const t = [];
              return (
                W.forEach((i) => {
                  const n = e.getValue(i);
                  void 0 !== n && (t.push([i, n.get()]), n.set(+!!i.startsWith("scale")));
                }),
                t
              );
            })(e);
            t.length && (i.set(e, t), e.render());
          }),
            e.forEach((e) => e.measureInitialState()),
            t.forEach((e) => {
              e.render();
              const t = i.get(e);
              t &&
                t.forEach(([t, i]) => {
                  e.getValue(t)?.set(i);
                });
            }),
            e.forEach((e) => e.measureEndState()),
            e.forEach((e) => {
              void 0 !== e.suspendedScrollY && window.scrollTo(0, e.suspendedScrollY);
            });
        }
        (Y = !1), (X = !1), K.forEach((e) => e.complete(Q)), K.clear();
      }
      function Z() {
        K.forEach((e) => {
          e.readKeyframes(), e.needsMeasurement && (Y = !0);
        });
      }
      class ee {
        constructor(e, t, i, n, a, r = !1) {
          (this.state = "pending"),
            (this.isAsync = !1),
            (this.needsMeasurement = !1),
            (this.unresolvedKeyframes = [...e]),
            (this.onComplete = t),
            (this.name = i),
            (this.motionValue = n),
            (this.element = a),
            (this.isAsync = r);
        }
        scheduleResolve() {
          (this.state = "scheduled"),
            this.isAsync
              ? (K.add(this), X || ((X = !0), z.Gt.read(Z), z.Gt.resolveKeyframes(J)))
              : (this.readKeyframes(), this.complete());
        }
        readKeyframes() {
          const { unresolvedKeyframes: e, name: t, element: i, motionValue: n } = this;
          if (null === e[0]) {
            const a = n?.get(),
              r = e[e.length - 1];
            if (void 0 !== a) e[0] = a;
            else if (i && t) {
              const n = i.readValue(t, r);
              null != n && (e[0] = n);
            }
            void 0 === e[0] && (e[0] = r), n && void 0 === a && n.set(e[0]);
          }
          for (let t = 1; t < e.length; t++) e[t] ?? (e[t] = e[t - 1]);
        }
        setFinalKeyframe() {}
        measureInitialState() {}
        renderEndStyles() {}
        measureEndState() {}
        complete(e = !1) {
          (this.state = "complete"),
            this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, e),
            K.delete(this);
        }
        cancel() {
          "scheduled" === this.state && (K.delete(this), (this.state = "pending"));
        }
        resume() {
          "pending" === this.state && this.scheduleResolve();
        }
      }
      const et = (e) => /^0[^.\s]+$/u.test(e),
        ei = new Set([c, m]);
      function en(e, t) {
        let i = g(e);
        return ei.has(i) || (i = l.f), i.getAnimatableNone ? i.getAnimatableNone(t) : void 0;
      }
      const ea = new Set(["auto", "none", "0"]);
      class er extends ee {
        constructor(e, t, i, n, a) {
          super(e, t, i, n, a, !0);
        }
        readKeyframes() {
          const { unresolvedKeyframes: e, element: t, name: i } = this;
          if (!t || !t.current) return;
          super.readKeyframes();
          for (let i = 0; i < e.length; i++) {
            let n = e[i];
            if ("string" == typeof n && ((n = n.trim()), (0, C.pG)(n))) {
              const a = (function e(t, i, n = 1) {
                (0, O.V)(
                  n <= 4,
                  `Max CSS variable fallback depth detected in property "${t}". This may indicate a circular fallback dependency.`,
                  "max-css-var-depth",
                );
                const [a, r] = ((e) => {
                  const t = R.exec(e);
                  if (!t) return [,];
                  const [, i, n, a] = t;
                  return [`--${i ?? n}`, a];
                })(t);
                if (!a) return;
                const l = window.getComputedStyle(i).getPropertyValue(a);
                if (l) {
                  const e = l.trim();
                  return A(e) ? parseFloat(e) : e;
                }
                return (0, C.pG)(r) ? e(r, i, n + 1) : r;
              })(n, t.current);
              void 0 !== a && (e[i] = a), i === e.length - 1 && (this.finalKeyframe = n);
            }
          }
          if ((this.resolveNoneKeyframes(), !x.has(i) || 2 !== e.length)) return;
          const [n, a] = e,
            r = w(n),
            l = w(a);
          if ((0, C.rm)(n) !== (0, C.rm)(a) && H[i]) {
            this.needsMeasurement = !0;
            return;
          }
          if (r !== l)
            if (U(r) && U(l))
              for (let t = 0; t < e.length; t++) {
                const i = e[t];
                "string" == typeof i && (e[t] = parseFloat(i));
              }
            else H[i] && (this.needsMeasurement = !0);
        }
        resolveNoneKeyframes() {
          const { unresolvedKeyframes: e, name: t } = this,
            i = [];
          for (let t = 0; t < e.length; t++) {
            var n;
            (null === e[t] ||
              ("number" == typeof (n = e[t])
                ? 0 === n
                : null === n || "none" === n || "0" === n || et(n))) &&
              i.push(t);
          }
          i.length &&
            ((e, t, i) => {
              let n,
                a = 0;
              for (; a < e.length && !n; ) {
                const t = e[a];
                "string" == typeof t && !ea.has(t) && (0, l.V)(t).values.length && (n = e[a]), a++;
              }
              if (n && i) for (const a of t) e[a] = en(i, n);
            })(e, i, t);
        }
        measureInitialState() {
          const { element: e, unresolvedKeyframes: t, name: i } = this;
          if (!e || !e.current) return;
          "height" === i && (this.suspendedScrollY = window.pageYOffset),
            (this.measuredOrigin = H[i](
              e.measureViewportBox(),
              window.getComputedStyle(e.current),
            )),
            (t[0] = this.measuredOrigin);
          const n = t[t.length - 1];
          void 0 !== n && e.getValue(i, n).jump(n, !1);
        }
        measureEndState() {
          const { element: e, name: t, unresolvedKeyframes: i } = this;
          if (!e || !e.current) return;
          const n = e.getValue(t);
          n && n.jump(this.measuredOrigin, !1);
          const a = i.length - 1,
            r = i[a];
          (i[a] = H[t](e.measureViewportBox(), window.getComputedStyle(e.current))),
            null !== r && void 0 === this.finalKeyframe && (this.finalKeyframe = r),
            this.removedTransforms?.length &&
              this.removedTransforms.forEach(([t, i]) => {
                e.getValue(t).set(i);
              }),
            this.resolveNoneKeyframes();
        }
      }
      const el = (e) => 1e3 * e;
      var es = i(5614),
        eo = i(5687);
      function ed(e, t, i) {
        t.startsWith("--") ? e.style.setProperty(t, i) : (e.style[t] = i);
      }
      var eu = i(2727);
      const ec = (e) => null !== e;
      function em(e, { repeat: t, repeatType: i = "loop" }, n, a = 1) {
        const r = e.filter(ec),
          l = a < 0 || (t && "loop" !== i && t % 2 == 1) ? 0 : r.length - 1;
        return l && void 0 !== n ? n : r[l];
      }
      class eh {
        constructor() {
          this.updateFinished();
        }
        get finished() {
          return this._finished;
        }
        updateFinished() {
          this._finished = new Promise((e) => {
            this.resolve = e;
          });
        }
        notifyFinished() {
          this.resolve();
        }
        then(e, t) {
          return this.finished.then(e, t);
        }
      }
      const ef = { layout: 0, mainThread: 0, waapi: 0 };
      var ep = i(4247);
      const ek = (e) => Array.isArray(e) && "number" == typeof e[0],
        e_ = (0, i(3223).J)(() => {
          try {
            document.createElement("div").animate({ opacity: 0 }, { easing: "linear(0, 1)" });
          } catch (e) {
            return !1;
          }
          return !0;
        }, "linearEasing"),
        eb = (e, t, i = 10) => {
          let n = "",
            a = Math.max(Math.round(t / i), 2);
          for (let t = 0; t < a; t++) n += Math.round(1e4 * e(t / (a - 1))) / 1e4 + ", ";
          return `linear(${n.substring(0, n.length - 2)})`;
        },
        eg = ([e, t, i, n]) => `cubic-bezier(${e}, ${t}, ${i}, ${n})`,
        ey = {
          linear: "linear",
          ease: "ease",
          easeIn: "ease-in",
          easeOut: "ease-out",
          easeInOut: "ease-in-out",
          circIn: eg([0, 0.65, 0.55, 1]),
          circOut: eg([0.55, 0, 1, 0.45]),
          backIn: eg([0.31, 0.01, 0.66, -0.59]),
          backOut: eg([0.33, 1.53, 0.69, 0.99]),
        };
      function ev(e) {
        return "function" == typeof e && "applyToOptions" in e;
      }
      class eP extends eh {
        constructor(e) {
          if (
            (super(),
            (this.finishedTime = null),
            (this.isStopped = !1),
            (this.manualStartTime = null),
            !e)
          )
            return;
          const {
            element: t,
            name: i,
            keyframes: n,
            pseudoElement: a,
            allowFlatten: r = !1,
            finalKeyframe: l,
            onComplete: s,
          } = e;
          (this.isPseudoElement = !!a),
            (this.allowFlatten = r),
            (this.options = e),
            (0, O.V)(
              "string" != typeof e.type,
              'Mini animate() doesn\'t support "type" as a string.',
              "mini-spring",
            );
          const o = (({ type: e, ...t }) =>
            ev(e) && e_()
              ? e.applyToOptions(t)
              : (t.duration ?? (t.duration = 300), t.ease ?? (t.ease = "easeOut"), t))(e);
          (this.animation = ((
            e,
            t,
            i,
            {
              delay: n = 0,
              duration: a = 300,
              repeat: r = 0,
              repeatType: l = "loop",
              ease: s = "easeOut",
              times: o,
            } = {},
            d,
          ) => {
            const u = { [t]: i };
            o && (u.offset = o);
            const c = (function e(t, i) {
              if (t)
                return "function" == typeof t
                  ? e_()
                    ? eb(t, i)
                    : "ease-out"
                  : ek(t)
                    ? eg(t)
                    : Array.isArray(t)
                      ? t.map((t) => e(t, i) || ey.easeOut)
                      : ey[t];
            })(s, a);
            Array.isArray(c) && (u.easing = c), ep.Q.value && ef.waapi++;
            const m = {
              delay: n,
              duration: a,
              easing: Array.isArray(c) ? "linear" : c,
              fill: "both",
              iterations: r + 1,
              direction: "reverse" === l ? "alternate" : "normal",
            };
            d && (m.pseudoElement = d);
            const h = e.animate(u, m);
            return (
              ep.Q.value &&
                h.finished.finally(() => {
                  ef.waapi--;
                }),
              h
            );
          })(t, i, n, o, a)),
            !1 === o.autoplay && this.animation.pause(),
            (this.animation.onfinish = () => {
              if (((this.finishedTime = this.time), !a)) {
                const e = em(n, this.options, l, this.speed);
                this.updateMotionValue && this.updateMotionValue(e),
                  ed(t, i, e),
                  this.animation.cancel();
              }
              s?.(), this.notifyFinished();
            });
        }
        play() {
          this.isStopped ||
            ((this.manualStartTime = null),
            this.animation.play(),
            "finished" === this.state && this.updateFinished());
        }
        pause() {
          this.animation.pause();
        }
        complete() {
          this.animation.finish?.();
        }
        cancel() {
          try {
            this.animation.cancel();
          } catch (e) {}
        }
        stop() {
          if (this.isStopped) return;
          this.isStopped = !0;
          const { state: e } = this;
          "idle" !== e &&
            "finished" !== e &&
            (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(),
            this.isPseudoElement || this.cancel());
        }
        commitStyles() {
          const e = this.options?.element;
          !this.isPseudoElement && e?.isConnected && this.animation.commitStyles?.();
        }
        get duration() {
          return Number(this.animation.effect?.getComputedTiming?.().duration || 0) / 1e3;
        }
        get iterationDuration() {
          const { delay: e = 0 } = this.options || {};
          return this.duration + e / 1e3;
        }
        get time() {
          return (Number(this.animation.currentTime) || 0) / 1e3;
        }
        set time(e) {
          const t = null !== this.finishedTime;
          (this.manualStartTime = null),
            (this.finishedTime = null),
            (this.animation.currentTime = el(e)),
            t && this.animation.pause();
        }
        get speed() {
          return this.animation.playbackRate;
        }
        set speed(e) {
          e < 0 && (this.finishedTime = null), (this.animation.playbackRate = e);
        }
        get state() {
          return null !== this.finishedTime ? "finished" : this.animation.playState;
        }
        get startTime() {
          return this.manualStartTime ?? Number(this.animation.startTime);
        }
        set startTime(e) {
          this.manualStartTime = this.animation.startTime = e;
        }
        attachTimeline({ timeline: e, rangeStart: t, rangeEnd: i, observe: n }) {
          return (this.allowFlatten && this.animation.effect?.updateTiming({ easing: "linear" }),
          (this.animation.onfinish = null),
          e && (0, eu.J)())
            ? ((this.animation.timeline = e),
              t && (this.animation.rangeStart = t),
              i && (this.animation.rangeEnd = i),
              eo.l)
            : n(this);
        }
      }
      const eT = new Set(["opacity", "clipPath", "filter", "transform"]),
        { schedule: ej } = (0, i(6692).I)(queueMicrotask, !1);
      var ex = i(31),
        eS = i(5843);
      const eE = [...E, r.y, l.f],
        ew = new WeakMap();
      function eO(e) {
        return null !== e && "object" == typeof e && "function" == typeof e.start;
      }
      function eA(e) {
        return "string" == typeof e || Array.isArray(e);
      }
      const eC = [
          "animate",
          "whileInView",
          "whileFocus",
          "whileHover",
          "whileTap",
          "whileDrag",
          "exit",
        ],
        eR = ["initial", ...eC];
      function eM(e) {
        return eO(e.animate) || eR.some((t) => eA(e[t]));
      }
      function eD(e) {
        return !!(eM(e) || e.variants);
      }
      var eG = i(860);
      function eI(e) {
        const t = [{}, {}];
        return (
          e?.values.forEach((e, i) => {
            (t[0][i] = e.get()), (t[1][i] = e.getVelocity());
          }),
          t
        );
      }
      function eV(e, t, i, n) {
        if ("function" == typeof t) {
          const [a, r] = eI(n);
          t = t(void 0 !== i ? i : e.custom, a, r);
        }
        if (("string" == typeof t && (t = e.variants && e.variants[t]), "function" == typeof t)) {
          const [a, r] = eI(n);
          t = t(void 0 !== i ? i : e.custom, a, r);
        }
        return t;
      }
      var eL = i(4539);
      let eq = [
          "AnimationStart",
          "AnimationComplete",
          "Update",
          "BeforeLayoutMeasure",
          "LayoutMeasure",
          "LayoutAnimationStart",
          "LayoutAnimationComplete",
        ],
        eN = {};
      class eF {
        scrapeMotionValuesFromProps(e, t, i) {
          return {};
        }
        constructor(
          {
            parent: e,
            props: t,
            presenceContext: i,
            reducedMotionConfig: n,
            skipAnimations: a,
            blockInitialAnimation: r,
            visualState: l,
          },
          s = {},
        ) {
          (this.current = null),
            (this.children = new Set()),
            (this.isVariantNode = !1),
            (this.isControllingVariants = !1),
            (this.shouldReduceMotion = null),
            (this.shouldSkipAnimations = !1),
            (this.values = new Map()),
            (this.KeyframeResolver = ee),
            (this.features = {}),
            (this.valueSubscriptions = new Map()),
            (this.prevMotionValues = {}),
            (this.hasBeenMounted = !1),
            (this.events = {}),
            (this.propEventSubscriptions = {}),
            (this.notifyUpdate = () => this.notify("Update", this.latestValues)),
            (this.render = () => {
              this.current &&
                (this.triggerBuild(),
                this.renderInstance(
                  this.current,
                  this.renderState,
                  this.props.style,
                  this.projection,
                ));
            }),
            (this.renderScheduledAt = 0),
            (this.scheduleRender = () => {
              const e = ex.k.now();
              this.renderScheduledAt < e &&
                ((this.renderScheduledAt = e), z.Gt.render(this.render, !1, !0));
            });
          const { latestValues: o, renderState: d } = l;
          (this.latestValues = o),
            (this.baseTarget = { ...o }),
            (this.initialValues = t.initial ? { ...o } : {}),
            (this.renderState = d),
            (this.parent = e),
            (this.props = t),
            (this.presenceContext = i),
            (this.depth = e ? e.depth + 1 : 0),
            (this.reducedMotionConfig = n),
            (this.skipAnimationsConfig = a),
            (this.options = s),
            (this.blockInitialAnimation = !!r),
            (this.isControllingVariants = eM(t)),
            (this.isVariantNode = eD(t)),
            this.isVariantNode && (this.variantChildren = new Set()),
            (this.manuallyAnimateOnMount = !!(e && e.current));
          const { willChange: u, ...c } = this.scrapeMotionValuesFromProps(t, {}, this);
          for (const e in c) {
            const t = c[e];
            void 0 !== o[e] && j(t) && t.set(o[e]);
          }
        }
        mount(e) {
          if (this.hasBeenMounted)
            for (const e in this.initialValues)
              this.values.get(e)?.jump(this.initialValues[e]),
                (this.latestValues[e] = this.initialValues[e]);
          (this.current = e),
            ew.set(e, this),
            this.projection && !this.projection.instance && this.projection.mount(e),
            this.parent &&
              this.isVariantNode &&
              !this.isControllingVariants &&
              (this.removeFromVariantTree = this.parent.addVariantChild(this)),
            this.values.forEach((e, t) => this.bindToMotionValue(t, e)),
            "never" === this.reducedMotionConfig
              ? (this.shouldReduceMotion = !1)
              : "always" === this.reducedMotionConfig
                ? (this.shouldReduceMotion = !0)
                : (eL.r.current || (0, eG.Uu)(), (this.shouldReduceMotion = eL.O.current)),
            (this.shouldSkipAnimations = this.skipAnimationsConfig ?? !1),
            this.parent?.addChild(this),
            this.update(this.props, this.presenceContext),
            (this.hasBeenMounted = !0);
        }
        unmount() {
          for (const e in (this.projection && this.projection.unmount(),
          (0, z.WG)(this.notifyUpdate),
          (0, z.WG)(this.render),
          this.valueSubscriptions.forEach((e) => e()),
          this.valueSubscriptions.clear(),
          this.removeFromVariantTree && this.removeFromVariantTree(),
          this.parent?.removeChild(this),
          this.events))
            this.events[e].clear();
          for (const e in this.features) {
            const t = this.features[e];
            t && (t.unmount(), (t.isMounted = !1));
          }
          this.current = null;
        }
        addChild(e) {
          this.children.add(e),
            this.enteringChildren ?? (this.enteringChildren = new Set()),
            this.enteringChildren.add(e);
        }
        removeChild(e) {
          this.children.delete(e), this.enteringChildren && this.enteringChildren.delete(e);
        }
        bindToMotionValue(e, t) {
          let i;
          if (
            (this.valueSubscriptions.has(e) && this.valueSubscriptions.get(e)(),
            t.accelerate && eT.has(e) && this.current instanceof HTMLElement)
          ) {
            const { factory: i, keyframes: n, times: a, ease: r, duration: l } = t.accelerate,
              s = new eP({
                element: this.current,
                name: e,
                keyframes: n,
                times: a,
                ease: r,
                duration: el(l),
              }),
              o = i(s);
            this.valueSubscriptions.set(e, () => {
              o(), s.cancel();
            });
            return;
          }
          const n = a.has(e);
          n && this.onBindTransform && this.onBindTransform();
          const r = t.on("change", (t) => {
            (this.latestValues[e] = t),
              this.props.onUpdate && z.Gt.preRender(this.notifyUpdate),
              n && this.projection && (this.projection.isTransformDirty = !0),
              this.scheduleRender();
          });
          "undefined" != typeof window &&
            window.MotionCheckAppearSync &&
            (i = window.MotionCheckAppearSync(this, e, t)),
            this.valueSubscriptions.set(e, () => {
              r(), i && i(), t.owner && t.stop();
            });
        }
        sortNodePosition(e) {
          return this.current && this.sortInstanceNodePosition && this.type === e.type
            ? this.sortInstanceNodePosition(this.current, e.current)
            : 0;
        }
        updateFeatures() {
          let e = "animation";
          for (e in eN) {
            const t = eN[e];
            if (!t) continue;
            const { isEnabled: i, Feature: n } = t;
            if (
              (!this.features[e] && n && i(this.props) && (this.features[e] = new n(this)),
              this.features[e])
            ) {
              const t = this.features[e];
              t.isMounted ? t.update() : (t.mount(), (t.isMounted = !0));
            }
          }
        }
        triggerBuild() {
          this.build(this.renderState, this.latestValues, this.props);
        }
        measureViewportBox() {
          return this.current ? this.measureInstanceViewportBox(this.current, this.props) : T();
        }
        getStaticValue(e) {
          return this.latestValues[e];
        }
        setStaticValue(e, t) {
          this.latestValues[e] = t;
        }
        update(e, t) {
          (e.transformTemplate || this.props.transformTemplate) && this.scheduleRender(),
            (this.prevProps = this.props),
            (this.props = e),
            (this.prevPresenceContext = this.presenceContext),
            (this.presenceContext = t);
          for (let t = 0; t < eq.length; t++) {
            const i = eq[t];
            this.propEventSubscriptions[i] &&
              (this.propEventSubscriptions[i](), delete this.propEventSubscriptions[i]);
            const n = e["on" + i];
            n && (this.propEventSubscriptions[i] = this.on(i, n));
          }
          (this.prevMotionValues = ((e, t, i) => {
            for (const n in t) {
              const a = t[n],
                r = i[n];
              if (j(a)) e.addValue(n, a);
              else if (j(r)) e.addValue(n, (0, eS.OQ)(a, { owner: e }));
              else if (r !== a)
                if (e.hasValue(n)) {
                  const t = e.getValue(n);
                  !0 === t.liveStyle ? t.jump(a) : t.hasAnimated || t.set(a);
                } else {
                  const t = e.getStaticValue(n);
                  e.addValue(n, (0, eS.OQ)(void 0 !== t ? t : a, { owner: e }));
                }
            }
            for (const n in i) void 0 === t[n] && e.removeValue(n);
            return t;
          })(
            this,
            this.scrapeMotionValuesFromProps(e, this.prevProps || {}, this),
            this.prevMotionValues,
          )),
            this.handleChildMotionValue && this.handleChildMotionValue();
        }
        getProps() {
          return this.props;
        }
        getVariant(e) {
          return this.props.variants ? this.props.variants[e] : void 0;
        }
        getDefaultTransition() {
          return this.props.transition;
        }
        getTransformPagePoint() {
          return this.props.transformPagePoint;
        }
        getClosestVariantNode() {
          return this.isVariantNode
            ? this
            : this.parent
              ? this.parent.getClosestVariantNode()
              : void 0;
        }
        addVariantChild(e) {
          const t = this.getClosestVariantNode();
          if (t)
            return t.variantChildren && t.variantChildren.add(e), () => t.variantChildren.delete(e);
        }
        addValue(e, t) {
          const i = this.values.get(e);
          t !== i &&
            (i && this.removeValue(e),
            this.bindToMotionValue(e, t),
            this.values.set(e, t),
            (this.latestValues[e] = t.get()));
        }
        removeValue(e) {
          this.values.delete(e);
          const t = this.valueSubscriptions.get(e);
          t && (t(), this.valueSubscriptions.delete(e)),
            delete this.latestValues[e],
            this.removeValueFromRenderState(e, this.renderState);
        }
        hasValue(e) {
          return this.values.has(e);
        }
        getValue(e, t) {
          if (this.props.values && this.props.values[e]) return this.props.values[e];
          let i = this.values.get(e);
          return (
            void 0 === i &&
              void 0 !== t &&
              ((i = (0, eS.OQ)(null === t ? void 0 : t, { owner: this })), this.addValue(e, i)),
            i
          );
        }
        readValue(e, t) {
          let i =
            void 0 === this.latestValues[e] && this.current
              ? (this.getBaseTargetFromProps(this.props, e) ??
                this.readValueFromInstance(this.current, e, this.options))
              : this.latestValues[e];
          if (null != i) {
            if ("string" == typeof i && (A(i) || et(i))) i = parseFloat(i);
            else {
              let n;
              (n = i), !eE.find(S(n)) && l.f.test(t) && (i = en(e, t));
            }
            this.setBaseTarget(e, j(i) ? i.get() : i);
          }
          return j(i) ? i.get() : i;
        }
        setBaseTarget(e, t) {
          this.baseTarget[e] = t;
        }
        getBaseTarget(e) {
          let t,
            { initial: i } = this.props;
          if ("string" == typeof i || "object" == typeof i) {
            const n = eV(this.props, i, this.presenceContext?.custom);
            n && (t = n[e]);
          }
          if (i && void 0 !== t) return t;
          const n = this.getBaseTargetFromProps(this.props, e);
          return void 0 === n || j(n)
            ? void 0 !== this.initialValues[e] && void 0 === t
              ? void 0
              : this.baseTarget[e]
            : n;
        }
        on(e, t) {
          return this.events[e] || (this.events[e] = new es.v()), this.events[e].add(t);
        }
        notify(e, ...t) {
          this.events[e] && this.events[e].notify(...t);
        }
        scheduleRenderMicrotask() {
          ej.render(this.render);
        }
      }
      class eB extends eF {
        constructor() {
          super(...arguments), (this.KeyframeResolver = er);
        }
        sortInstanceNodePosition(e, t) {
          return 2 & e.compareDocumentPosition(t) ? 1 : -1;
        }
        getBaseTargetFromProps(e, t) {
          const i = e.style;
          return i ? i[t] : void 0;
        }
        removeValueFromRenderState(e, { vars: t, style: i }) {
          delete t[e], delete i[e];
        }
        handleChildMotionValue() {
          this.childSubscription && (this.childSubscription(), delete this.childSubscription);
          const { children: e } = this.props;
          j(e) &&
            (this.childSubscription = e.on("change", (e) => {
              this.current && (this.current.textContent = `${e}`);
            }));
        }
      }
      function eU(e) {
        return e.replace(/([A-Z])/g, (e) => `-${e.toLowerCase()}`);
      }
      const e$ = (e, t) => (t && "number" == typeof e ? t.transform(e) : e),
        eW = {
          x: "translateX",
          y: "translateY",
          z: "translateZ",
          transformPerspective: "perspective",
        },
        eH = n.length;
      function ez(e, t, i) {
        let { style: r, vars: l, transformOrigin: s } = e,
          o = !1,
          d = !1;
        for (const e in t) {
          const i = t[e];
          if (a.has(e)) {
            o = !0;
            continue;
          }
          if ((0, C.j4)(e)) {
            l[e] = i;
            continue;
          }
          {
            const t = e$(i, _[e]);
            e.startsWith("origin") ? ((d = !0), (s[e] = t)) : (r[e] = t);
          }
        }
        if (
          (!t.transform &&
            (o || i
              ? (r.transform = ((e, t, i) => {
                  let a = "",
                    r = !0;
                  for (let l = 0; l < eH; l++) {
                    const s = n[l],
                      o = e[s];
                    if (void 0 === o) continue;
                    let d = !0;
                    if ("number" == typeof o) d = o === +!!s.startsWith("scale");
                    else {
                      const e = parseFloat(o);
                      d = s.startsWith("scale") ? 1 === e : 0 === e;
                    }
                    if (!d || i) {
                      const e = e$(o, _[s]);
                      if (!d) {
                        r = !1;
                        const t = eW[s] || s;
                        a += `${t}(${e}) `;
                      }
                      i && (t[s] = e);
                    }
                  }
                  return (a = a.trim()), i ? (a = i(t, r ? "" : a)) : r && (a = "none"), a;
                })(t, e.transform, i))
              : r.transform && (r.transform = "none")),
          d)
        ) {
          const { originX: e = "50%", originY: t = "50%", originZ: i = 0 } = s;
          r.transformOrigin = `${e} ${t} ${i}`;
        }
      }
      const eK = { offset: "stroke-dashoffset", array: "stroke-dasharray" },
        eX = { offset: "strokeDashoffset", array: "strokeDasharray" },
        eY = ["offsetDistance", "offsetPath", "offsetRotate", "offsetAnchor"];
      function eQ(
        e,
        {
          attrX: t,
          attrY: i,
          attrScale: n,
          pathLength: a,
          pathSpacing: r = 1,
          pathOffset: l = 0,
          ...s
        },
        o,
        d,
        u,
      ) {
        if ((ez(e, s, d), o)) {
          e.style.viewBox && (e.attrs.viewBox = e.style.viewBox);
          return;
        }
        (e.attrs = e.style), (e.style = {});
        const { attrs: c, style: m } = e;
        for (const e of (c.transform && ((m.transform = c.transform), delete c.transform),
        (m.transform || c.transformOrigin) &&
          ((m.transformOrigin = c.transformOrigin ?? "50% 50%"), delete c.transformOrigin),
        m.transform && ((m.transformBox = u?.transformBox ?? "fill-box"), delete c.transformBox),
        eY))
          void 0 !== c[e] && ((m[e] = c[e]), delete c[e]);
        void 0 !== t && (c.x = t),
          void 0 !== i && (c.y = i),
          void 0 !== n && (c.scale = n),
          void 0 !== a &&
            ((e, t, i = 1, n = 0, a = !0) => {
              e.pathLength = 1;
              const r = a ? eK : eX;
              (e[r.offset] = `${-n}`), (e[r.array] = `${t} ${i}`);
            })(c, a, r, l, !1);
      }
      const eJ = new Set([
          "baseFrequency",
          "diffuseConstant",
          "kernelMatrix",
          "kernelUnitLength",
          "keySplines",
          "keyTimes",
          "limitingConeAngle",
          "markerHeight",
          "markerWidth",
          "numOctaves",
          "targetX",
          "targetY",
          "surfaceScale",
          "specularConstant",
          "specularExponent",
          "stdDeviation",
          "tableValues",
          "viewBox",
          "gradientTransform",
          "pathLength",
          "startOffset",
          "textLength",
          "lengthAdjust",
        ]),
        eZ = (e) => "string" == typeof e && "svg" === e.toLowerCase();
      function e0(e, { style: t, vars: i }, n, a) {
        let r,
          l = e.style;
        for (r in t) l[r] = t[r];
        for (r in (a?.applyProjectionStyles(l, n), i)) l.setProperty(r, i[r]);
      }
      function e1(e, t) {
        return t.max === t.min ? 0 : (e / (t.max - t.min)) * 100;
      }
      const e2 = {
        correct: (e, t) => {
          if (!t.target) return e;
          if ("string" == typeof e)
            if (!p.px.test(e)) return e;
            else e = parseFloat(e);
          const i = e1(e, t.target.x),
            n = e1(e, t.target.y);
          return `${i}% ${n}%`;
        },
      };
      var e5 = i(4117);
      const e4 = {
        borderRadius: {
          ...e2,
          applyTo: [
            "borderTopLeftRadius",
            "borderTopRightRadius",
            "borderBottomLeftRadius",
            "borderBottomRightRadius",
          ],
        },
        borderTopLeftRadius: e2,
        borderTopRightRadius: e2,
        borderBottomLeftRadius: e2,
        borderBottomRightRadius: e2,
        boxShadow: {
          correct: (e, { treeScale: t, projectionDelta: i }) => {
            const n = l.f.parse(e);
            if (n.length > 5) return e;
            const a = l.f.createTransformer(e),
              r = +("number" != typeof n[0]),
              s = i.x.scale * t.x,
              o = i.y.scale * t.y;
            (n[0 + r] /= s), (n[1 + r] /= o);
            const d = (0, e5.k)(s, o, 0.5);
            return (
              "number" == typeof n[2 + r] && (n[2 + r] /= d),
              "number" == typeof n[3 + r] && (n[3 + r] /= d),
              a(n)
            );
          },
        },
      };
      function e6(e, { layout: t, layoutId: i }) {
        return (
          a.has(e) ||
          e.startsWith("origin") ||
          ((t || void 0 !== i) && (!!e4[e] || "opacity" === e))
        );
      }
      function e3(e, t, i) {
        const n = e.style,
          a = t?.style,
          r = {};
        if (!n) return r;
        for (const t in n)
          (j(n[t]) || (a && j(a[t])) || e6(t, e) || i?.getValue(t)?.liveStyle !== void 0) &&
            (r[t] = n[t]);
        return r;
      }
      function e9(e, t, i) {
        const a = e3(e, t, i);
        for (const i in e)
          (j(e[i]) || j(t[i])) &&
            (a[-1 !== n.indexOf(i) ? "attr" + i.charAt(0).toUpperCase() + i.substring(1) : i] =
              e[i]);
        return a;
      }
      class e7 extends eB {
        constructor() {
          super(...arguments),
            (this.type = "svg"),
            (this.isSVGTag = !1),
            (this.measureInstanceViewportBox = T);
        }
        getBaseTargetFromProps(e, t) {
          return e[t];
        }
        readValueFromInstance(e, t) {
          if (a.has(t)) {
            const e = g(t);
            return (e && e.default) || 0;
          }
          return (t = eJ.has(t) ? t : eU(t)), e.getAttribute(t);
        }
        scrapeMotionValuesFromProps(e, t, i) {
          return e9(e, t, i);
        }
        build(e, t, i) {
          eQ(e, t, this.isSVGTag, i.transformTemplate, i.style);
        }
        renderInstance(e, t, i, n) {
          for (const i in (e0(e, t, void 0, n), t.attrs))
            e.setAttribute(eJ.has(i) ? i : eU(i), t.attrs[i]);
        }
        mount(e) {
          (this.isSVGTag = eZ(e.tagName)), super.mount(e);
        }
      }
      function e8({ top: e, left: t, right: i, bottom: n }) {
        return { x: { min: t, max: i }, y: { min: e, max: n } };
      }
      function te(e) {
        return void 0 === e || 1 === e;
      }
      function tt({ scale: e, scaleX: t, scaleY: i }) {
        return !te(e) || !te(t) || !te(i);
      }
      function ti(e) {
        return tt(e) || tn(e) || e.z || e.rotate || e.rotateX || e.rotateY || e.skewX || e.skewY;
      }
      function tn(e) {
        var t, i;
        return ((t = e.x) && "0%" !== t) || ((i = e.y) && "0%" !== i);
      }
      function ta(e, t, i, n, a) {
        return void 0 !== a && (e = n + a * (e - n)), n + i * (e - n) + t;
      }
      function tr(e, t = 0, i = 1, n, a) {
        (e.min = ta(e.min, t, i, n, a)), (e.max = ta(e.max, t, i, n, a));
      }
      function tl(e, { x: t, y: i }) {
        tr(e.x, t.translate, t.scale, t.originPoint), tr(e.y, i.translate, i.scale, i.originPoint);
      }
      function ts(e, t) {
        (e.min += t), (e.max += t);
      }
      function to(e, t, i, n, a = 0.5) {
        const r = (0, e5.k)(e.min, e.max, a);
        tr(e, t, i, r, n);
      }
      function td(e, t) {
        return "string" == typeof e ? (parseFloat(e) / 100) * (t.max - t.min) : e;
      }
      function tu(e, t, i) {
        const n = i ?? e;
        to(e.x, td(t.x, n.x), t.scaleX, t.scale, t.originX),
          to(e.y, td(t.y, n.y), t.scaleY, t.scale, t.originY);
      }
      function tc(e, t) {
        return e8(
          ((e, t) => {
            if (!t) return e;
            const i = t({ x: e.left, y: e.top }),
              n = t({ x: e.right, y: e.bottom });
            return { top: i.y, left: i.x, bottom: n.y, right: n.x };
          })(e.getBoundingClientRect(), t),
        );
      }
      class tm extends eB {
        constructor() {
          super(...arguments), (this.type = "html"), (this.renderInstance = e0);
        }
        readValueFromInstance(e, t) {
          if (a.has(t))
            return this.projection?.isProjecting
              ? N(t)
              : ((e, t) => {
                  const { transform: i = "none" } = getComputedStyle(e);
                  return F(i, t);
                })(e, t);
          {
            const i = window.getComputedStyle(e),
              n = ((0, C.j4)(t) ? i.getPropertyValue(t) : i[t]) || 0;
            return "string" == typeof n ? n.trim() : n;
          }
        }
        measureInstanceViewportBox(e, { transformPagePoint: t }) {
          return tc(e, t);
        }
        build(e, t, i) {
          ez(e, t, i.transformTemplate);
        }
        scrapeMotionValuesFromProps(e, t, i) {
          return e3(e, t, i);
        }
      }
      var th = i(4260);
      const tf = [
        "animate",
        "circle",
        "defs",
        "desc",
        "ellipse",
        "g",
        "image",
        "line",
        "filter",
        "marker",
        "mask",
        "metadata",
        "path",
        "pattern",
        "polygon",
        "polyline",
        "rect",
        "stop",
        "switch",
        "symbol",
        "svg",
        "text",
        "tspan",
        "use",
        "view",
      ];
      function tp(e) {
        if ("string" != typeof e || e.includes("-"));
        else if (tf.indexOf(e) > -1 || /[A-Z]/u.test(e)) return !0;
        return !1;
      }
      var tk = i(1944);
      const t_ = (0, th.createContext)({}),
        tb = (0, th.createContext)({ strict: !1 }),
        tg = (0, th.createContext)({
          transformPagePoint: (e) => e,
          isStatic: !1,
          reducedMotion: "never",
        }),
        ty = (0, th.createContext)({});
      function tv(e) {
        return Array.isArray(e) ? e.join(" ") : e;
      }
      const tP = () => ({ style: {}, transform: {}, transformOrigin: {}, vars: {} });
      function tT(e, t, i) {
        for (const n in t) j(t[n]) || e6(n, i) || (e[n] = t[n]);
      }
      const tj = () => ({ ...tP(), attrs: {} }),
        tx = new Set([
          "animate",
          "exit",
          "variants",
          "initial",
          "style",
          "values",
          "variants",
          "transition",
          "transformTemplate",
          "custom",
          "inherit",
          "onBeforeLayoutMeasure",
          "onAnimationStart",
          "onAnimationComplete",
          "onUpdate",
          "onDragStart",
          "onDrag",
          "onDragEnd",
          "onMeasureDragConstraints",
          "onDirectionLock",
          "onDragTransitionEnd",
          "_dragX",
          "_dragY",
          "onHoverStart",
          "onHoverEnd",
          "onViewportEnter",
          "onViewportLeave",
          "globalTapTarget",
          "propagate",
          "ignoreStrict",
          "viewport",
        ]);
      function tS(e) {
        return (
          e.startsWith("while") ||
          (e.startsWith("drag") && "draggable" !== e) ||
          e.startsWith("layout") ||
          e.startsWith("onTap") ||
          e.startsWith("onPan") ||
          e.startsWith("onLayout") ||
          tx.has(e)
        );
      }
      let tE = (e) => !tS(e);
      try {
        !((e) => {
          "function" == typeof e && (tE = (t) => (t.startsWith("on") ? !tS(t) : e(t)));
        })(require("@emotion/is-prop-valid").default);
      } catch {}
      function tw(e) {
        return j(e) ? e.get() : e;
      }
      const tO = (0, th.createContext)(null);
      var tA = i(6203);
      let tC = (e) => (t, i) => {
          const n = (0, th.useContext)(ty),
            a = (0, th.useContext)(tO),
            r = () =>
              ((e, t, i, n) => {
                const { scrapeMotionValuesFromProps: a, createRenderState: r } = e;
                return {
                  latestValues: ((e, t, i, n) => {
                    const a = {},
                      r = n(e, {});
                    for (const e in r) a[e] = tw(r[e]);
                    let { initial: l, animate: s } = e,
                      o = eM(e),
                      d = eD(e);
                    t &&
                      d &&
                      !o &&
                      !1 !== e.inherit &&
                      (void 0 === l && (l = t.initial), void 0 === s && (s = t.animate));
                    let u = !!i && !1 === i.initial,
                      c = (u = u || !1 === l) ? s : l;
                    if (c && "boolean" != typeof c && !eO(c)) {
                      const t = Array.isArray(c) ? c : [c];
                      for (let i = 0; i < t.length; i++) {
                        const n = eV(e, t[i]);
                        if (n) {
                          const { transitionEnd: e, transition: t, ...i } = n;
                          for (const e in i) {
                            let t = i[e];
                            if (Array.isArray(t)) {
                              const e = u ? t.length - 1 : 0;
                              t = t[e];
                            }
                            null !== t && (a[e] = t);
                          }
                          for (const t in e) a[t] = e[t];
                        }
                      }
                    }
                    return a;
                  })(t, i, n, a),
                  renderState: r(),
                };
              })(e, t, n, a);
          return i ? r() : (0, tA.M)(r);
        },
        tR = tC({ scrapeMotionValuesFromProps: e3, createRenderState: tP }),
        tM = tC({ scrapeMotionValuesFromProps: e9, createRenderState: tj }),
        tD = {
          animation: [
            "animate",
            "variants",
            "whileHover",
            "whileTap",
            "exit",
            "whileInView",
            "whileFocus",
            "whileDrag",
          ],
          exit: ["exit"],
          drag: ["drag", "dragControls"],
          focus: ["whileFocus"],
          hover: ["whileHover", "onHoverStart", "onHoverEnd"],
          tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
          pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
          inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
          layout: ["layout", "layoutId"],
        },
        tG = !1;
      function tI() {
        return (
          !(() => {
            if (tG) return;
            const e = {};
            for (const t in tD) e[t] = { isEnabled: (e) => tD[t].some((t) => !!e[t]) };
            (eN = e), (tG = !0);
          })(),
          eN
        );
      }
      const tV = Symbol.for("motionComponentSymbol"),
        tL = "data-" + eU("framerAppearId"),
        tq = (0, th.createContext)({});
      function tN(e) {
        return e && "object" == typeof e && Object.hasOwn(e, "current");
      }
      var tF = i(1711);
      function tB(e) {
        var t, i;
        const { forwardMotionProps: n = !1, type: a } =
            arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
          r = arguments.length > 2 ? arguments[2] : void 0,
          l = arguments.length > 3 ? arguments[3] : void 0;
        r &&
          ((e) => {
            const t = tI();
            for (const i in e) t[i] = { ...t[i], ...e[i] };
            eN = t;
          })(r);
        const s = a ? "svg" === a : tp(e),
          o = s ? tM : tR;
        function d(t, i) {
          let a,
            r = {
              ...(0, th.useContext)(tg),
              ...t,
              layoutId: ((e) => {
                const { layoutId: t } = e,
                  i = (0, th.useContext)(t_).id;
                return i && void 0 !== t ? i + "-" + t : t;
              })(t),
            },
            { isStatic: d } = r,
            u = ((e) => {
              const { initial: t, animate: i } = ((e, t) => {
                if (eM(e)) {
                  const { initial: t, animate: i } = e;
                  return { initial: !1 === t || eA(t) ? t : void 0, animate: eA(i) ? i : void 0 };
                }
                return !1 !== e.inherit ? t : {};
              })(e, (0, th.useContext)(ty));
              return (0, th.useMemo)(() => ({ initial: t, animate: i }), [tv(t), tv(i)]);
            })(t),
            c = o(t, d);
          if (!d && "undefined" != typeof window) {
            (0, th.useContext)(tb).strict;
            const t = ((e) => {
              const { drag: t, layout: i } = tI();
              if (!t && !i) return {};
              const n = { ...t, ...i };
              return {
                MeasureLayout:
                  (null == t ? void 0 : t.isEnabled(e)) || (null == i ? void 0 : i.isEnabled(e))
                    ? n.MeasureLayout
                    : void 0,
                ProjectionNode: n.ProjectionNode,
              };
            })(r);
            (a = t.MeasureLayout),
              (u.visualElement = ((e, t, i, n, a, r) => {
                var l, s, o, d;
                const { visualElement: u } = (0, th.useContext)(ty),
                  c = (0, th.useContext)(tb),
                  m = (0, th.useContext)(tO),
                  h = (0, th.useContext)(tg),
                  f = h.reducedMotion,
                  p = h.skipAnimations,
                  k = (0, th.useRef)(null),
                  _ = (0, th.useRef)(!1);
                (n = n || c.renderer),
                  !k.current &&
                    n &&
                    ((k.current = n(e, {
                      visualState: t,
                      parent: u,
                      props: i,
                      presenceContext: m,
                      blockInitialAnimation: !!m && !1 === m.initial,
                      reducedMotionConfig: f,
                      skipAnimations: p,
                      isSVG: r,
                    })),
                    _.current && k.current && (k.current.manuallyAnimateOnMount = !0));
                const b = k.current,
                  g = (0, th.useContext)(tq);
                b &&
                  !b.projection &&
                  a &&
                  ("html" === b.type || "svg" === b.type) &&
                  ((e, t, i, n) => {
                    const {
                      layoutId: a,
                      layout: r,
                      drag: l,
                      dragConstraints: s,
                      layoutScroll: o,
                      layoutRoot: d,
                      layoutAnchor: u,
                      layoutCrossfade: c,
                    } = t;
                    (e.projection = new i(
                      e.latestValues,
                      t["data-framer-portal-id"]
                        ? void 0
                        : (function e(t) {
                            if (t)
                              return !1 !== t.options.allowProjection ? t.projection : e(t.parent);
                          })(e.parent),
                    )),
                      e.projection.setOptions({
                        layoutId: a,
                        layout: r,
                        alwaysMeasureLayout: !!l || (s && tN(s)),
                        visualElement: e,
                        animationType: "string" == typeof r ? r : "both",
                        initialPromotionConfig: n,
                        crossfade: c,
                        layoutScroll: o,
                        layoutRoot: d,
                        layoutAnchor: u,
                      });
                  })(k.current, i, a, g);
                const y = (0, th.useRef)(!1);
                (0, th.useInsertionEffect)(() => {
                  b && y.current && b.update(i, m);
                });
                const v = i[tL],
                  P = (0, th.useRef)(
                    !!v &&
                      "undefined" != typeof window &&
                      !(null == (l = (s = window).MotionHandoffIsComplete)
                        ? void 0
                        : l.call(s, v)) &&
                      (null == (o = (d = window).MotionHasOptimisedAnimation)
                        ? void 0
                        : o.call(d, v)),
                  );
                return (
                  (0, tF.E)(() => {
                    (_.current = !0),
                      b &&
                        ((y.current = !0),
                        (window.MotionIsMounted = !0),
                        b.updateFeatures(),
                        b.scheduleRenderMicrotask(),
                        P.current && b.animationState && b.animationState.animateChanges());
                  }),
                  (0, th.useEffect)(() => {
                    b &&
                      (!P.current && b.animationState && b.animationState.animateChanges(),
                      P.current &&
                        (queueMicrotask(() => {
                          var e, t;
                          null == (e = (t = window).MotionHandoffMarkAsComplete) || e.call(t, v);
                        }),
                        (P.current = !1)),
                      (b.enteringChildren = void 0));
                  }),
                  b
                );
              })(e, c, r, l, t.ProjectionNode, s));
          }
          return (0, tk.jsxs)(ty.Provider, {
            value: u,
            children: [
              a && u.visualElement
                ? (0, tk.jsx)(a, { visualElement: u.visualElement, ...r })
                : null,
              (function (e, t, i, n, a) {
                const { latestValues: r } = n,
                  l = arguments.length > 5 && void 0 !== arguments[5] && arguments[5],
                  s = arguments.length > 6 ? arguments[6] : void 0,
                  o = (
                    (null != s ? s : tp(e))
                      ? (e, t, i, n) => {
                          const a = (0, th.useMemo)(() => {
                            const i = tj();
                            return (
                              eQ(i, t, eZ(n), e.transformTemplate, e.style),
                              { ...i.attrs, style: { ...i.style } }
                            );
                          }, [t]);
                          if (e.style) {
                            const t = {};
                            tT(t, e.style, e), (a.style = { ...t, ...a.style });
                          }
                          return a;
                        }
                      : (e, t) => {
                          const i = {},
                            n = ((e, t) => {
                              const i = e.style || {},
                                n = {};
                              return (
                                tT(n, i, e),
                                Object.assign(
                                  n,
                                  ((e, t) => {
                                    const { transformTemplate: i } = e;
                                    return (0, th.useMemo)(() => {
                                      const e = tP();
                                      return ez(e, t, i), Object.assign({}, e.vars, e.style);
                                    }, [t]);
                                  })(e, t),
                                ),
                                n
                              );
                            })(e, t);
                          return (
                            e.drag &&
                              !1 !== e.dragListener &&
                              ((i.draggable = !1),
                              (n.userSelect = n.WebkitUserSelect = n.WebkitTouchCallout = "none"),
                              (n.touchAction =
                                !0 === e.drag
                                  ? "none"
                                  : "pan-".concat("x" === e.drag ? "y" : "x"))),
                            void 0 === e.tabIndex &&
                              (e.onTap || e.onTapStart || e.whileTap) &&
                              (i.tabIndex = 0),
                            (i.style = n),
                            i
                          );
                        }
                  )(t, r, a, e),
                  d = ((e, t, i) => {
                    const n = {};
                    for (const a in e)
                      ("values" !== a || "object" != typeof e.values) &&
                        !j(e[a]) &&
                        (tE(a) ||
                          (!0 === i && tS(a)) ||
                          (!t && !tS(a)) ||
                          (e.draggable && a.startsWith("onDrag"))) &&
                        (n[a] = e[a]);
                    return n;
                  })(t, "string" == typeof e, l),
                  u = e !== th.Fragment ? { ...d, ...o, ref: i } : {},
                  { children: c } = t,
                  m = (0, th.useMemo)(() => (j(c) ? c.get() : c), [c]);
                return (0, th.createElement)(e, { ...u, children: m });
              })(
                e,
                t,
                ((e, t, i) => {
                  const n = (0, th.useRef)(i);
                  (0, th.useInsertionEffect)(() => {
                    n.current = i;
                  });
                  const a = (0, th.useRef)(null);
                  return (0, th.useCallback)(
                    (i) => {
                      if (i) {
                        var r;
                        null == (r = e.onMount) || r.call(e, i);
                      }
                      const l = n.current;
                      if ("function" == typeof l)
                        if (i) {
                          const e = l(i);
                          "function" == typeof e && (a.current = e);
                        } else a.current ? (a.current(), (a.current = null)) : l(i);
                      else l && (l.current = i);
                      t && (i ? t.mount(i) : t.unmount());
                    },
                    [t],
                  );
                })(c, u.visualElement, i),
                c,
                d,
                n,
                s,
              ),
            ],
          });
        }
        d.displayName = "motion.".concat(
          "string" == typeof e
            ? e
            : "create(".concat(
                null != (i = null != (t = e.displayName) ? t : e.name) ? i : "",
                ")",
              ),
        );
        const u = (0, th.forwardRef)(d);
        return (u[tV] = e), u;
      }
      class tU {
        constructor(e) {
          (this.isMounted = !1), (this.node = e);
        }
        update() {}
      }
      function t$(e, t, i) {
        const n = e.getProps();
        return eV(n, t, void 0 !== i ? i : n.custom, e);
      }
      function tW(e, t) {
        if (e?.inherit && t) {
          const { inherit: i, ...n } = e;
          return { ...t, ...n };
        }
        return e;
      }
      function tH(e, t) {
        const i = e?.[t] ?? e?.default ?? e;
        return i !== e ? tW(i, e) : i;
      }
      const tz = (e) => Array.isArray(e);
      var tK = i(1031);
      function tX(e, t) {
        const i = e.getValue("willChange");
        if (j(i) && i.add) return i.add(t);
        if (!i && tK.W.WillChange) {
          const i = new tK.W.WillChange("auto");
          e.addValue("willChange", i), i.add(t);
        }
      }
      var tY = i(1211),
        tQ = i(9266),
        tJ = i(4075);
      const tZ = (e) => {
        const t = ({ timestamp: t }) => e(t);
        return {
          start: (e = !0) => z.Gt.update(t, e),
          stop: () => (0, z.WG)(t),
          now: () => (z.uv.isProcessing ? z.uv.timestamp : ex.k.now()),
        };
      };
      function t0(e) {
        let t = 0,
          i = e.next(t);
        for (; !i.done && t < 2e4; ) (t += 50), (i = e.next(t));
        return t >= 2e4 ? 1 / 0 : t;
      }
      const t1 = {
        stiffness: 100,
        damping: 10,
        mass: 1,
        velocity: 0,
        duration: 800,
        bounce: 0.3,
        visualDuration: 0.3,
        restSpeed: { granular: 0.01, default: 2 },
        restDelta: { granular: 0.005, default: 0.5 },
        minDuration: 0.01,
        maxDuration: 10,
        minDamping: 0.05,
        maxDamping: 1,
      };
      function t2(e, t) {
        return e * Math.sqrt(1 - t * t);
      }
      const t5 = ["duration", "bounce"],
        t4 = ["stiffness", "damping", "mass"];
      function t6(e, t) {
        return t.some((t) => void 0 !== e[t]);
      }
      function t3(e = t1.visualDuration, t = t1.bounce) {
        let i,
          n,
          a,
          r,
          l,
          s,
          o = "object" != typeof e ? { visualDuration: e, keyframes: [0, 1], bounce: t } : e,
          { restSpeed: d, restDelta: u } = o,
          c = o.keyframes[0],
          m = o.keyframes[o.keyframes.length - 1],
          h = { done: !1, value: c },
          {
            stiffness: f,
            damping: p,
            mass: k,
            duration: _,
            velocity: b,
            isResolvedFromDuration: g,
          } = ((e) => {
            let t = {
              velocity: t1.velocity,
              stiffness: t1.stiffness,
              damping: t1.damping,
              mass: t1.mass,
              isResolvedFromDuration: !1,
              ...e,
            };
            if (!t6(e, t4) && t6(e, t5))
              if (((t.velocity = 0), e.visualDuration)) {
                const i = (2 * Math.PI) / (1.2 * e.visualDuration),
                  n = i * i,
                  a = 2 * (0, tQ.q)(0.05, 1, 1 - (e.bounce || 0)) * Math.sqrt(n);
                t = { ...t, mass: t1.mass, stiffness: n, damping: a };
              } else {
                const i = (({
                  duration: e = t1.duration,
                  bounce: t = t1.bounce,
                  velocity: i = t1.velocity,
                  mass: n = t1.mass,
                }) => {
                  let a, r;
                  (0, O.$)(
                    e <= el(t1.maxDuration),
                    "Spring duration must be 10 seconds or less",
                    "spring-duration-limit",
                  );
                  let l = 1 - t;
                  (l = (0, tQ.q)(t1.minDamping, t1.maxDamping, l)),
                    (e = (0, tQ.q)(t1.minDuration, t1.maxDuration, e / 1e3)),
                    l < 1
                      ? ((a = (t) => {
                          const n = t * l,
                            a = n * e;
                          return 0.001 - ((n - i) / t2(t, l)) * Math.exp(-a);
                        }),
                        (r = (t) => {
                          const n = t * l * e,
                            r = l ** 2 * t ** 2 * e,
                            s = Math.exp(-n),
                            o = t2(t ** 2, l);
                          return ((n * i + i - r) * s * (-a(t) + 0.001 > 0 ? -1 : 1)) / o;
                        }))
                      : ((a = (t) => -0.001 + Math.exp(-t * e) * ((t - i) * e + 1)),
                        (r = (t) => e * e * (i - t) * Math.exp(-t * e)));
                  const s = ((e, t, i) => {
                    let n = i;
                    for (let i = 1; i < 12; i++) n -= e(n) / t(n);
                    return n;
                  })(a, r, 5 / e);
                  if (((e = el(e)), isNaN(s)))
                    return { stiffness: t1.stiffness, damping: t1.damping, duration: e };
                  {
                    const t = s ** 2 * n;
                    return { stiffness: t, damping: 2 * l * Math.sqrt(n * t), duration: e };
                  }
                })({ ...e, velocity: 0 });
                (t = { ...t, ...i, mass: t1.mass }).isResolvedFromDuration = !0;
              }
            return t;
          })({ ...o, velocity: -((o.velocity || 0) / 1e3) }),
          y = b || 0,
          v = p / (2 * Math.sqrt(f * k)),
          P = m - c,
          T = Math.sqrt(f / k) / 1e3,
          j = 5 > Math.abs(P);
        if (
          (d || (d = j ? t1.restSpeed.granular : t1.restSpeed.default),
          u || (u = j ? t1.restDelta.granular : t1.restDelta.default),
          v < 1)
        )
          (a = t2(T, v)),
            (r = (y + v * T * P) / a),
            (i = (e) => m - Math.exp(-v * T * e) * (r * Math.sin(a * e) + P * Math.cos(a * e))),
            (l = v * T * r + P * a),
            (s = v * T * P - r * a),
            (n = (e) => Math.exp(-v * T * e) * (l * Math.sin(a * e) + s * Math.cos(a * e)));
        else if (1 === v) {
          i = (e) => m - Math.exp(-T * e) * (P + (y + T * P) * e);
          const e = y + T * P;
          n = (t) => Math.exp(-T * t) * (T * e * t - y);
        } else {
          const e = T * Math.sqrt(v * v - 1);
          i = (t) => {
            const i = Math.exp(-v * T * t),
              n = Math.min(e * t, 300);
            return m - (i * ((y + v * T * P) * Math.sinh(n) + e * P * Math.cosh(n))) / e;
          };
          const t = (y + v * T * P) / e,
            a = v * T * t - P * e,
            r = v * T * P - t * e;
          n = (t) => {
            const i = Math.exp(-v * T * t),
              n = Math.min(e * t, 300);
            return i * (a * Math.sinh(n) + r * Math.cosh(n));
          };
        }
        const x = {
          calculatedDuration: (g && _) || null,
          velocity: (e) => el(n(e)),
          next: (e) => {
            if (!g && v < 1) {
              const t = Math.exp(-v * T * e),
                i = Math.sin(a * e),
                n = Math.cos(a * e),
                o = m - t * (r * i + P * n);
              return (
                (h.done = Math.abs(el(t * (l * i + s * n))) <= d && Math.abs(m - o) <= u),
                (h.value = h.done ? m : o),
                h
              );
            }
            const t = i(e);
            return (
              g ? (h.done = e >= _) : (h.done = Math.abs(el(n(e))) <= d && Math.abs(m - t) <= u),
              (h.value = h.done ? m : t),
              h
            );
          },
          toString: () => {
            const e = Math.min(t0(x), 2e4),
              t = eb((t) => x.next(e * t).value, e, 30);
            return e + "ms " + t;
          },
          toTransition: () => {},
        };
        return x;
      }
      t3.applyToOptions = (e) => {
        const t = ((e, t = 100, i) => {
          const n = i({ ...e, keyframes: [0, t] }),
            a = Math.min(t0(n), 2e4);
          return { type: "keyframes", ease: (e) => n.next(a * e).value / t, duration: a / 1e3 };
        })(e, 100, t3);
        return (e.ease = t.ease), (e.duration = el(t.duration)), (e.type = "keyframes"), e;
      };
      var t9 = i(4959);
      function t7(e, t, i) {
        const n = Math.max(t - 5, 0);
        return (0, t9.f)(i - e(n), t - n);
      }
      function t8({
        keyframes: e,
        velocity: t = 0,
        power: i = 0.8,
        timeConstant: n = 325,
        bounceDamping: a = 10,
        bounceStiffness: r = 500,
        modifyTarget: l,
        min: s,
        max: o,
        restDelta: d = 0.5,
        restSpeed: u,
      }) {
        let c,
          m,
          h = e[0],
          f = { done: !1, value: h },
          p = i * t,
          k = h + p,
          _ = void 0 === l ? k : l(k);
        _ !== k && (p = _ - h);
        const b = (e) => -p * Math.exp(-e / n),
          g = (e) => _ + b(e),
          y = (e) => {
            const t = b(e),
              i = g(e);
            (f.done = Math.abs(t) <= d), (f.value = f.done ? _ : i);
          },
          v = (e) => {
            let t;
            if (((t = f.value), (void 0 !== s && t < s) || (void 0 !== o && t > o))) {
              var i;
              (c = e),
                (m = t3({
                  keyframes: [
                    f.value,
                    ((i = f.value),
                    void 0 === s ? o : void 0 === o || Math.abs(s - i) < Math.abs(o - i) ? s : o),
                  ],
                  velocity: t7(g, e, f.value),
                  damping: a,
                  stiffness: r,
                  restDelta: d,
                  restSpeed: u,
                }));
            }
          };
        return (
          v(0),
          {
            calculatedDuration: null,
            next: (e) => {
              let t = !1;
              return (m || void 0 !== c || ((t = !0), y(e), v(e)), void 0 !== c && e >= c)
                ? m.next(e - c)
                : (t || y(e), f);
            },
          }
        );
      }
      const ie = (e, t, i) => (((1 - 3 * i + 3 * t) * e + (3 * i - 6 * t)) * e + 3 * t) * e;
      function it(e, t, i, n) {
        return e === t && i === n
          ? eo.l
          : (a) =>
              0 === a || 1 === a
                ? a
                : ie(
                    ((e, t, i, n, a) => {
                      let r,
                        l,
                        s = 0;
                      do (r = ie((l = t + (i - t) / 2), n, a) - e) > 0 ? (i = l) : (t = l);
                      while (Math.abs(r) > 1e-7 && ++s < 12);
                      return l;
                    })(a, 0, 1, e, i),
                    t,
                    n,
                  );
      }
      const ii = it(0.42, 0, 1, 1),
        ia = it(0, 0, 0.58, 1),
        ir = it(0.42, 0, 0.58, 1),
        il = (e) => (t) => (t <= 0.5 ? e(2 * t) / 2 : (2 - e(2 * (1 - t))) / 2),
        is = (e) => (t) => 1 - e(1 - t),
        io = it(0.33, 1.53, 0.69, 0.99),
        id = is(io),
        iu = il(id),
        ic = (e) => (e >= 1 ? 1 : (e *= 2) < 1 ? 0.5 * id(e) : 0.5 * (2 - 2 ** (-10 * (e - 1)))),
        im = (e) => 1 - Math.sin(Math.acos(e)),
        ih = is(im),
        ip = il(im),
        ik = {
          linear: eo.l,
          easeIn: ii,
          easeInOut: ir,
          easeOut: ia,
          circIn: im,
          circInOut: ip,
          circOut: ih,
          backIn: id,
          backInOut: iu,
          backOut: io,
          anticipate: ic,
        },
        i_ = (e) => {
          if (ek(e)) {
            (0, O.V)(
              4 === e.length,
              "Cubic bezier arrays must contain four numerical values.",
              "cubic-bezier-length",
            );
            const [t, i, n, a] = e;
            return it(t, i, n, a);
          }
          return "string" == typeof e
            ? ((0, O.V)(void 0 !== ik[e], `Invalid easing type '${e}'`, "invalid-easing-type"),
              ik[e])
            : e;
        };
      var ib = i(6214),
        ig = i(2656);
      function iy({ duration: e = 300, keyframes: t, times: i, ease: n = "easeInOut" }) {
        var a;
        const r = Array.isArray(n) && "number" != typeof n[0] ? n.map(i_) : i_(n),
          l = { done: !1, value: t[0] },
          s = ((a = i && i.length === t.length ? i : (0, ig.Z)(t)), a.map((t) => t * e)),
          o = (0, ib.G)(s, t, {
            ease: Array.isArray(r) ? r : t.map(() => r || ir).splice(0, t.length - 1),
          });
        return { calculatedDuration: e, next: (t) => ((l.value = o(t)), (l.done = t >= e), l) };
      }
      const iv = { decay: t8, inertia: t8, tween: iy, keyframes: iy, spring: t3 };
      function iP(e) {
        "string" == typeof e.type && (e.type = iv[e.type]);
      }
      const iT = (e) => e / 100;
      class ij extends eh {
        constructor(e) {
          super(),
            (this.state = "idle"),
            (this.startTime = null),
            (this.isStopped = !1),
            (this.currentTime = 0),
            (this.holdTime = null),
            (this.playbackSpeed = 1),
            (this.delayState = { done: !1, value: void 0 }),
            (this.stop = () => {
              const { motionValue: e } = this.options;
              e && e.updatedAt !== ex.k.now() && this.tick(ex.k.now()),
                (this.isStopped = !0),
                "idle" !== this.state && (this.teardown(), this.options.onStop?.());
            }),
            ef.mainThread++,
            (this.options = e),
            this.initAnimation(),
            this.play(),
            !1 === e.autoplay && this.pause();
        }
        initAnimation() {
          const { options: e } = this;
          iP(e);
          let {
              type: t = iy,
              repeat: i = 0,
              repeatDelay: n = 0,
              repeatType: a,
              velocity: r = 0,
            } = e,
            { keyframes: l } = e,
            s = t || iy;
          s !== iy &&
            "number" != typeof l[0] &&
            ((this.mixKeyframes = (0, tY.F)(iT, (0, tJ.j)(l[0], l[1]))), (l = [0, 100]));
          const o = s({ ...e, keyframes: l });
          "mirror" === a &&
            (this.mirroredGenerator = s({ ...e, keyframes: [...l].reverse(), velocity: -r })),
            null === o.calculatedDuration && (o.calculatedDuration = t0(o));
          const { calculatedDuration: d } = o;
          (this.calculatedDuration = d),
            (this.resolvedDuration = d + n),
            (this.totalDuration = this.resolvedDuration * (i + 1) - n),
            (this.generator = o);
        }
        updateTime(e) {
          const t = Math.round(e - this.startTime) * this.playbackSpeed;
          null !== this.holdTime ? (this.currentTime = this.holdTime) : (this.currentTime = t);
        }
        tick(e, t = !1) {
          let i,
            {
              generator: n,
              totalDuration: a,
              mixKeyframes: r,
              mirroredGenerator: l,
              resolvedDuration: s,
              calculatedDuration: o,
            } = this;
          if (null === this.startTime) return n.next(0);
          const {
            delay: d = 0,
            keyframes: u,
            repeat: c,
            repeatType: m,
            repeatDelay: h,
            type: f,
            onUpdate: p,
            finalKeyframe: k,
          } = this.options;
          this.speed > 0
            ? (this.startTime = Math.min(this.startTime, e))
            : this.speed < 0 && (this.startTime = Math.min(e - a / this.speed, this.startTime)),
            t ? (this.currentTime = e) : this.updateTime(e);
          const _ = this.currentTime - d * (this.playbackSpeed >= 0 ? 1 : -1),
            b = this.playbackSpeed >= 0 ? _ < 0 : _ > a;
          (this.currentTime = Math.max(_, 0)),
            "finished" === this.state && null === this.holdTime && (this.currentTime = a);
          let g = this.currentTime,
            y = n;
          if (c) {
            let e = Math.min(this.currentTime, a) / s,
              t = Math.floor(e),
              i = e % 1;
            !i && e >= 1 && (i = 1),
              1 === i && t--,
              (t = Math.min(t, c + 1)) % 2 &&
                ("reverse" === m ? ((i = 1 - i), h && (i -= h / s)) : "mirror" === m && (y = l)),
              (g = (0, tQ.q)(0, 1, i) * s);
          }
          b ? ((this.delayState.value = u[0]), (i = this.delayState)) : (i = y.next(g)),
            r && !b && (i.value = r(i.value));
          let { done: v } = i;
          b ||
            null === o ||
            (v = this.playbackSpeed >= 0 ? this.currentTime >= a : this.currentTime <= 0);
          const P =
            null === this.holdTime &&
            ("finished" === this.state || ("running" === this.state && v));
          return (
            P && f !== t8 && (i.value = em(u, this.options, k, this.speed)),
            p && p(i.value),
            P && this.finish(),
            i
          );
        }
        then(e, t) {
          return this.finished.then(e, t);
        }
        get duration() {
          return this.calculatedDuration / 1e3;
        }
        get iterationDuration() {
          const { delay: e = 0 } = this.options || {};
          return this.duration + e / 1e3;
        }
        get time() {
          return this.currentTime / 1e3;
        }
        set time(e) {
          (e = el(e)),
            (this.currentTime = e),
            null === this.startTime || null !== this.holdTime || 0 === this.playbackSpeed
              ? (this.holdTime = e)
              : this.driver && (this.startTime = this.driver.now() - e / this.playbackSpeed),
            this.driver
              ? this.driver.start(!1)
              : ((this.startTime = 0), (this.state = "paused"), (this.holdTime = e), this.tick(e));
        }
        getGeneratorVelocity() {
          const e = this.currentTime;
          if (e <= 0) return this.options.velocity || 0;
          if (this.generator.velocity) return this.generator.velocity(e);
          const t = this.generator.next(e).value;
          return t7((e) => this.generator.next(e).value, e, t);
        }
        get speed() {
          return this.playbackSpeed;
        }
        set speed(e) {
          const t = this.playbackSpeed !== e;
          t && this.driver && this.updateTime(ex.k.now()),
            (this.playbackSpeed = e),
            t && this.driver && (this.time = this.currentTime / 1e3);
        }
        play() {
          if (this.isStopped) return;
          const { driver: e = tZ, startTime: t } = this.options;
          this.driver || (this.driver = e((e) => this.tick(e))), this.options.onPlay?.();
          const i = this.driver.now();
          "finished" === this.state
            ? (this.updateFinished(), (this.startTime = i))
            : null !== this.holdTime
              ? (this.startTime = i - this.holdTime)
              : this.startTime || (this.startTime = t ?? i),
            "finished" === this.state &&
              this.speed < 0 &&
              (this.startTime += this.calculatedDuration),
            (this.holdTime = null),
            (this.state = "running"),
            this.driver.start();
        }
        pause() {
          (this.state = "paused"), this.updateTime(ex.k.now()), (this.holdTime = this.currentTime);
        }
        complete() {
          "running" !== this.state && this.play(),
            (this.state = "finished"),
            (this.holdTime = null);
        }
        finish() {
          this.notifyFinished(),
            this.teardown(),
            (this.state = "finished"),
            this.options.onComplete?.();
        }
        cancel() {
          (this.holdTime = null),
            (this.startTime = 0),
            this.tick(0),
            this.teardown(),
            this.options.onCancel?.();
        }
        teardown() {
          (this.state = "idle"),
            this.stopDriver(),
            (this.startTime = this.holdTime = null),
            ef.mainThread--;
        }
        stopDriver() {
          this.driver && (this.driver.stop(), (this.driver = void 0));
        }
        sample(e) {
          return (this.startTime = 0), this.tick(e, !0);
        }
        attachTimeline(e) {
          return (
            this.options.allowFlatten &&
              ((this.options.type = "keyframes"),
              (this.options.ease = "linear"),
              this.initAnimation()),
            this.driver?.stop(),
            e.observe(this)
          );
        }
      }
      const ix = { anticipate: ic, backInOut: iu, circInOut: ip };
      class iS extends eP {
        constructor(e) {
          !((e) => {
            "string" == typeof e.ease && e.ease in ix && (e.ease = ix[e.ease]);
          })(e),
            iP(e),
            super(e),
            void 0 !== e.startTime && !1 !== e.autoplay && (this.startTime = e.startTime),
            (this.options = e);
        }
        updateMotionValue(e) {
          const { motionValue: t, onUpdate: i, onComplete: n, element: a, ...r } = this.options;
          if (!t) return;
          if (void 0 !== e) return void t.set(e);
          const l = new ij({ ...r, autoplay: !1 }),
            s = Math.max(10, ex.k.now() - this.startTime),
            o = (0, tQ.q)(0, 10, s - 10),
            d = l.sample(s).value,
            { name: u } = this.options;
          a && u && ed(a, u, d),
            t.setWithVelocity(l.sample(Math.max(0, s - o)).value, d, o),
            l.stop();
        }
      }
      const iE = (e, t) =>
        "zIndex" !== t &&
        !!(
          "number" == typeof e ||
          Array.isArray(e) ||
          ("string" == typeof e && (l.f.test(e) || "0" === e) && !e.startsWith("url("))
        );
      function iw(e) {
        (e.duration = 0), (e.type = "keyframes");
      }
      var iO = i(5577);
      const iA = /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/,
        iC = new Set([
          "color",
          "backgroundColor",
          "outlineColor",
          "fill",
          "stroke",
          "borderColor",
          "borderTopColor",
          "borderRightColor",
          "borderBottomColor",
          "borderLeftColor",
        ]),
        iR = (0, iO.p)(() => Object.hasOwn(Element.prototype, "animate"));
      class iM extends eh {
        constructor({
          autoplay: e = !0,
          delay: t = 0,
          type: i = "keyframes",
          repeat: n = 0,
          repeatDelay: a = 0,
          repeatType: r = "loop",
          keyframes: l,
          name: s,
          motionValue: o,
          element: d,
          ...u
        }) {
          super(),
            (this.stop = () => {
              this._animation && (this._animation.stop(), this.stopTimeline?.()),
                this.keyframeResolver?.cancel();
            }),
            (this.createdAt = ex.k.now());
          const c = {
              autoplay: e,
              delay: t,
              type: i,
              repeat: n,
              repeatDelay: a,
              repeatType: r,
              name: s,
              motionValue: o,
              element: d,
              ...u,
            },
            m = d?.KeyframeResolver || ee;
          (this.keyframeResolver = new m(
            l,
            (e, t, i) => this.onKeyframesResolved(e, t, c, !i),
            s,
            o,
            d,
          )),
            this.keyframeResolver?.scheduleResolve();
        }
        onKeyframesResolved(e, t, i, n) {
          let a;
          this.keyframeResolver = void 0;
          const { name: r, type: l, velocity: s, delay: o, isHandoff: d, onUpdate: u } = i;
          this.resolvedAt = ex.k.now();
          let c = !0;
          !((e, t, i, n) => {
            const a = e[0];
            if (null === a) return !1;
            if ("display" === t || "visibility" === t) return !0;
            const r = e[e.length - 1],
              l = iE(a, t),
              s = iE(r, t);
            return (
              (0, O.$)(
                l === s,
                `You are trying to animate ${t} from "${a}" to "${r}". "${l ? r : a}" is not an animatable value.`,
                "value-not-animatable",
              ),
              !!l &&
                !!s &&
                (((e) => {
                  const t = e[0];
                  if (1 === e.length) return !0;
                  for (let i = 0; i < e.length; i++) if (e[i] !== t) return !0;
                })(e) ||
                  (("spring" === i || ev(i)) && n))
            );
          })(e, r, l, s) &&
            ((c = !1),
            (tK.W.instantAnimations || !o) && u?.(em(e, i, t)),
            (e[0] = e[e.length - 1]),
            iw(i),
            (i.repeat = 0));
          const m = {
              startTime: n
                ? this.resolvedAt && this.resolvedAt - this.createdAt > 40
                  ? this.resolvedAt
                  : this.createdAt
                : void 0,
              finalKeyframe: t,
              ...i,
              keyframes: e,
            },
            h =
              c &&
              !d &&
              ((e) => {
                const {
                  motionValue: t,
                  name: i,
                  repeatDelay: n,
                  repeatType: a,
                  damping: r,
                  type: l,
                  keyframes: s,
                } = e;
                if (!(t?.owner?.current instanceof HTMLElement)) return !1;
                const { onUpdate: o, transformTemplate: d } = t.owner.getProps();
                return (
                  iR() &&
                  i &&
                  (eT.has(i) ||
                    (iC.has(i) &&
                      ((e) => {
                        for (let t = 0; t < e.length; t++)
                          if ("string" == typeof e[t] && iA.test(e[t])) return !0;
                        return !1;
                      })(s))) &&
                  ("transform" !== i || !d) &&
                  !o &&
                  !n &&
                  "mirror" !== a &&
                  0 !== r &&
                  "inertia" !== l
                );
              })(m),
            f = m.motionValue?.owner?.current;
          if (h)
            try {
              a = new iS({ ...m, element: f });
            } catch {
              a = new ij(m);
            }
          else a = new ij(m);
          a.finished
            .then(() => {
              this.notifyFinished();
            })
            .catch(eo.l),
            this.pendingTimeline &&
              ((this.stopTimeline = a.attachTimeline(this.pendingTimeline)),
              (this.pendingTimeline = void 0)),
            (this._animation = a);
        }
        get finished() {
          return this._animation ? this.animation.finished : this._finished;
        }
        then(e, t) {
          return this.finished.finally(e).then(() => {});
        }
        get animation() {
          return (
            this._animation || (this.keyframeResolver?.resume(), (Q = !0), Z(), J(), (Q = !1)),
            this._animation
          );
        }
        get duration() {
          return this.animation.duration;
        }
        get iterationDuration() {
          return this.animation.iterationDuration;
        }
        get time() {
          return this.animation.time;
        }
        set time(e) {
          this.animation.time = e;
        }
        get speed() {
          return this.animation.speed;
        }
        get state() {
          return this.animation.state;
        }
        set speed(e) {
          this.animation.speed = e;
        }
        get startTime() {
          return this.animation.startTime;
        }
        attachTimeline(e) {
          return (
            this._animation
              ? (this.stopTimeline = this.animation.attachTimeline(e))
              : (this.pendingTimeline = e),
            () => this.stop()
          );
        }
        play() {
          this.animation.play();
        }
        pause() {
          this.animation.pause();
        }
        complete() {
          this.animation.complete();
        }
        cancel() {
          this._animation && this.animation.cancel(), this.keyframeResolver?.cancel();
        }
      }
      const iD = { type: "spring", stiffness: 500, damping: 25, restSpeed: 10 },
        iG = { type: "keyframes", duration: 0.8 },
        iI = { type: "keyframes", ease: [0.25, 0.1, 0.35, 1], duration: 0.3 },
        iV = new Set([
          "when",
          "delay",
          "delayChildren",
          "staggerChildren",
          "staggerDirection",
          "repeat",
          "repeatType",
          "repeatDelay",
          "from",
          "elapsed",
        ]),
        iL =
          (e, t, i, n = {}, r, l) =>
          (s) => {
            let o = tH(n, e) || {},
              d = o.delay || n.delay || 0,
              { elapsed: u = 0 } = n;
            u -= el(d);
            const c = {
              keyframes: Array.isArray(i) ? i : [null, i],
              ease: "easeOut",
              velocity: t.getVelocity(),
              ...o,
              delay: -u,
              onUpdate: (e) => {
                t.set(e), o.onUpdate && o.onUpdate(e);
              },
              onComplete: () => {
                s(), o.onComplete && o.onComplete();
              },
              name: e,
              motionValue: t,
              element: l ? void 0 : r,
            };
            !((e) => {
              for (const t in e) if (!iV.has(t)) return !0;
              return !1;
            })(o) &&
              Object.assign(
                c,
                ((e, { keyframes: t }) =>
                  t.length > 2
                    ? iG
                    : a.has(e)
                      ? e.startsWith("scale")
                        ? {
                            type: "spring",
                            stiffness: 550,
                            damping: 0 === t[1] ? 2 * Math.sqrt(550) : 30,
                            restSpeed: 10,
                          }
                        : iD
                      : iI)(e, c),
              ),
              c.duration && (c.duration = el(c.duration)),
              c.repeatDelay && (c.repeatDelay = el(c.repeatDelay)),
              void 0 !== c.from && (c.keyframes[0] = c.from);
            let m = !1;
            if (
              ((!1 !== c.type && (0 !== c.duration || c.repeatDelay)) ||
                (iw(c), 0 === c.delay && (m = !0)),
              (tK.W.instantAnimations || tK.W.skipAnimations || r?.shouldSkipAnimations) &&
                ((m = !0), iw(c), (c.delay = 0)),
              (c.allowFlatten = !o.type && !o.ease),
              m && !l && void 0 !== t.get())
            ) {
              const e = em(c.keyframes, o);
              if (void 0 !== e)
                return void z.Gt.update(() => {
                  c.onUpdate(e), c.onComplete();
                });
            }
            return o.isSync ? new ij(c) : new iM(c);
          };
      function iq(e, t, { delay: i = 0, transitionOverride: n, type: a } = {}) {
        let { transition: r, transitionEnd: l, ...s } = t,
          o = e.getDefaultTransition();
        r = r ? tW(r, o) : o;
        const d = r?.reduceMotion;
        n && (r = n);
        const u = [],
          c = a && e.animationState && e.animationState.getState()[a];
        for (const t in s) {
          const n = e.getValue(t, e.latestValues[t] ?? null),
            a = s[t];
          if (
            void 0 === a ||
            (c &&
              (({ protectedKeys: e, needsAnimating: t }, i) => {
                const n = Object.hasOwn(e, i) && !0 !== t[i];
                return (t[i] = !1), n;
              })(c, t))
          )
            continue;
          const l = { delay: i, ...tH(r || {}, t) },
            o = n.get();
          if (void 0 !== o && !n.isAnimating() && !Array.isArray(a) && a === o && !l.velocity) {
            z.Gt.update(() => n.set(a));
            continue;
          }
          let m = !1;
          if (window.MotionHandoffAnimation) {
            const i = e.props[tL];
            if (i) {
              const e = window.MotionHandoffAnimation(i, t, z.Gt);
              null !== e && ((l.startTime = e), (m = !0));
            }
          }
          tX(e, t);
          const h = d ?? e.shouldReduceMotion;
          n.start(iL(t, n, a, h && x.has(t) ? { type: !1 } : l, e, m));
          const f = n.animation;
          f && u.push(f);
        }
        if (l) {
          const t = () =>
            z.Gt.update(() => {
              l &&
                ((e, t) => {
                  let { transitionEnd: i = {}, transition: n = {}, ...a } = t$(e, t) || {};
                  for (const t in (a = { ...a, ...i })) {
                    var r;
                    const i = tz((r = a[t])) ? r[r.length - 1] || 0 : r;
                    e.hasValue(t) ? e.getValue(t).set(i) : e.addValue(t, (0, eS.OQ)(i));
                  }
                })(e, l);
            });
          u.length ? Promise.all(u).then(t) : t();
        }
        return u;
      }
      function iN(e, t, i, n = 0, a = 1) {
        const r = Array.from(e)
            .sort((e, t) => e.sortNodePosition(t))
            .indexOf(t),
          l = e.size,
          s = (l - 1) * n;
        return "function" == typeof i ? i(r, l) : 1 === a ? r * n : s - r * n;
      }
      function iF(e, t, i = {}) {
        let n = t$(e, t, "exit" === i.type ? e.presenceContext?.custom : void 0),
          { transition: a = e.getDefaultTransition() || {} } = n || {};
        i.transitionOverride && (a = i.transitionOverride);
        const r = n ? () => Promise.all(iq(e, n, i)) : () => Promise.resolve(),
          l =
            e.variantChildren && e.variantChildren.size
              ? (n = 0) => {
                  const { delayChildren: r = 0, staggerChildren: l, staggerDirection: s } = a;
                  return ((e, t, i = 0, n = 0, a = 0, r = 1, l) => {
                    const s = [];
                    for (const o of e.variantChildren)
                      o.notify("AnimationStart", t),
                        s.push(
                          iF(o, t, {
                            ...l,
                            delay:
                              i +
                              ("function" == typeof n ? 0 : n) +
                              iN(e.variantChildren, o, n, a, r),
                          }).then(() => o.notify("AnimationComplete", t)),
                        );
                    return Promise.all(s);
                  })(e, t, n, r, l, s, i);
                }
              : () => Promise.resolve(),
          { when: s } = a;
        if (!s) return Promise.all([r(), l(i.delay)]);
        {
          const [e, t] = "beforeChildren" === s ? [r, l] : [l, r];
          return e().then(() => t());
        }
      }
      const iB = eR.length;
      function iU(e, t) {
        if (!Array.isArray(t)) return !1;
        const i = t.length;
        if (i !== e.length) return !1;
        for (let n = 0; n < i; n++) if (t[n] !== e[n]) return !1;
        return !0;
      }
      const i$ = [...eC].reverse(),
        iW = eC.length;
      function iH(e = !1) {
        return { isActive: e, protectedKeys: {}, needsAnimating: {}, prevResolvedValues: {} };
      }
      function iz() {
        return {
          animate: iH(!0),
          whileInView: iH(),
          whileHover: iH(),
          whileTap: iH(),
          whileDrag: iH(),
          whileFocus: iH(),
          exit: iH(),
        };
      }
      class iK extends tU {
        constructor(e) {
          super(e),
            e.animationState ||
              (e.animationState = ((e) => {
                let t = (t) =>
                    Promise.all(
                      t.map(({ animation: t, options: i }) =>
                        ((e, t, i = {}) => {
                          let n;
                          if ((e.notify("AnimationStart", t), Array.isArray(t)))
                            n = Promise.all(t.map((t) => iF(e, t, i)));
                          else if ("string" == typeof t) n = iF(e, t, i);
                          else {
                            const a = "function" == typeof t ? t$(e, t, i.custom) : t;
                            n = Promise.all(iq(e, a, i));
                          }
                          return n.then(() => {
                            e.notify("AnimationComplete", t);
                          });
                        })(e, t, i),
                      ),
                    ),
                  i = iz(),
                  n = !0,
                  a = !1,
                  r = (t) => (i, n) => {
                    const a = t$(e, n, "exit" === t ? e.presenceContext?.custom : void 0);
                    if (a) {
                      const { transition: e, transitionEnd: t, ...n } = a;
                      i = { ...i, ...n, ...t };
                    }
                    return i;
                  };
                function l(l) {
                  let { props: s } = e,
                    o =
                      (function e(t) {
                        if (!t) return;
                        if (!t.isControllingVariants) {
                          const i = (t.parent && e(t.parent)) || {};
                          return void 0 !== t.props.initial && (i.initial = t.props.initial), i;
                        }
                        const i = {};
                        for (let e = 0; e < iB; e++) {
                          const n = eR[e],
                            a = t.props[n];
                          (eA(a) || !1 === a) && (i[n] = a);
                        }
                        return i;
                      })(e.parent) || {},
                    d = [],
                    u = new Set(),
                    c = {},
                    m = 1 / 0;
                  for (let t = 0; t < iW; t++) {
                    var h, f;
                    const p = i$[t],
                      k = i[p],
                      _ = void 0 !== s[p] ? s[p] : o[p],
                      b = eA(_),
                      g = p === l ? k.isActive : null;
                    !1 === g && (m = t);
                    let y = _ === o[p] && _ !== s[p] && b;
                    if (
                      (y && (n || a) && e.manuallyAnimateOnMount && (y = !1),
                      (k.protectedKeys = { ...c }),
                      (!k.isActive && null === g) ||
                        (!_ && !k.prevProp) ||
                        eO(_) ||
                        "boolean" == typeof _)
                    )
                      continue;
                    if ("exit" === p && k.isActive && !0 !== g) {
                      k.prevResolvedValues && (c = { ...c, ...k.prevResolvedValues });
                      continue;
                    }
                    let v =
                        ((h = k.prevProp),
                        "string" == typeof (f = _) ? f !== h : !!Array.isArray(f) && !iU(f, h)),
                      P = v || (p === l && k.isActive && !y && b) || (t > m && b),
                      T = !1,
                      j = Array.isArray(_) ? _ : [_],
                      x = j.reduce(r(p), {});
                    !1 === g && (x = {});
                    const { prevResolvedValues: S = {} } = k,
                      E = { ...S, ...x },
                      w = (t) => {
                        (P = !0), u.has(t) && ((T = !0), u.delete(t)), (k.needsAnimating[t] = !0);
                        const i = e.getValue(t);
                        i && (i.liveStyle = !1);
                      };
                    for (const e in E) {
                      const t = x[e],
                        i = S[e];
                      if (!Object.hasOwn(c, e))
                        (tz(t) && tz(i) ? iU(t, i) : t === i)
                          ? void 0 !== t && u.has(e)
                            ? w(e)
                            : (k.protectedKeys[e] = !0)
                          : null != t
                            ? w(e)
                            : u.add(e);
                    }
                    (k.prevProp = _),
                      (k.prevResolvedValues = x),
                      k.isActive && (c = { ...c, ...x }),
                      (n || a) && e.blockInitialAnimation && (P = !1);
                    const O = y && v,
                      A = !O || T;
                    P &&
                      A &&
                      d.push(
                        ...j.map((t) => {
                          const i = { type: p };
                          if (
                            "string" == typeof t &&
                            (n || a) &&
                            !O &&
                            e.manuallyAnimateOnMount &&
                            e.parent
                          ) {
                            const { parent: n } = e,
                              a = t$(n, t);
                            if (n.enteringChildren && a) {
                              const { delayChildren: t } = a.transition || {};
                              i.delay = iN(n.enteringChildren, e, t);
                            }
                          }
                          return { animation: t, options: i };
                        }),
                      );
                  }
                  if (u.size) {
                    const t = {};
                    if ("boolean" != typeof s.initial) {
                      const i = t$(e, Array.isArray(s.initial) ? s.initial[0] : s.initial);
                      i && i.transition && (t.transition = i.transition);
                    }
                    u.forEach((i) => {
                      const n = e.getBaseTarget(i),
                        a = e.getValue(i);
                      a && (a.liveStyle = !0), (t[i] = n ?? null);
                    }),
                      d.push({ animation: t });
                  }
                  let p = !!d.length;
                  return (
                    n &&
                      (!1 === s.initial || s.initial === s.animate) &&
                      !e.manuallyAnimateOnMount &&
                      (p = !1),
                    (n = !1),
                    (a = !1),
                    p ? t(d) : Promise.resolve()
                  );
                }
                return {
                  animateChanges: l,
                  setActive: (t, n) => {
                    if (i[t].isActive === n) return Promise.resolve();
                    e.variantChildren?.forEach((e) => e.animationState?.setActive(t, n)),
                      (i[t].isActive = n);
                    const a = l(t);
                    for (const e in i) i[e].protectedKeys = {};
                    return a;
                  },
                  setAnimateFunction: (i) => {
                    t = i(e);
                  },
                  getState: () => i,
                  reset: () => {
                    (i = iz()), (a = !0);
                  },
                };
              })(e));
        }
        updateAnimationControlsSubscription() {
          const { animate: e } = this.node.getProps();
          eO(e) && (this.unmountControls = e.subscribe(this.node));
        }
        mount() {
          this.updateAnimationControlsSubscription();
        }
        update() {
          const { animate: e } = this.node.getProps(),
            { animate: t } = this.node.prevProps || {};
          e !== t && this.updateAnimationControlsSubscription();
        }
        unmount() {
          this.node.animationState.reset(), this.unmountControls?.();
        }
      }
      let iX = 0;
      class iY extends tU {
        constructor() {
          super(...arguments), (this.id = iX++), (this.isExitComplete = !1);
        }
        update() {
          if (!this.node.presenceContext) return;
          const { isPresent: e, onExitComplete: t } = this.node.presenceContext,
            { isPresent: i } = this.node.prevPresenceContext || {};
          if (!this.node.animationState || e === i) return;
          if (e && !1 === i) {
            if (this.isExitComplete) {
              const { initial: e, custom: t } = this.node.getProps();
              if ("string" == typeof e) {
                const i = t$(this.node, e, t);
                if (i) {
                  const { transition: e, transitionEnd: t, ...n } = i;
                  for (const e in n) this.node.getValue(e)?.jump(n[e]);
                }
              }
              this.node.animationState.reset(), this.node.animationState.animateChanges();
            } else this.node.animationState.setActive("exit", !1);
            this.isExitComplete = !1;
            return;
          }
          const n = this.node.animationState.setActive("exit", !e);
          t &&
            !e &&
            n.then(() => {
              (this.isExitComplete = !0), t(this.id);
            });
        }
        mount() {
          const { register: e, onExitComplete: t } = this.node.presenceContext || {};
          t && t(this.id), e && (this.unmount = e(this.id));
        }
        unmount() {}
      }
      const iQ = { x: !1, y: !1 };
      function iJ(e) {
        return [e("x"), e("y")];
      }
      function iZ(e) {
        return e.max - e.min;
      }
      function i0(e, t, i, n = 0.5) {
        (e.origin = n),
          (e.originPoint = (0, e5.k)(t.min, t.max, e.origin)),
          (e.scale = iZ(i) / iZ(t)),
          (e.translate = (0, e5.k)(i.min, i.max, e.origin) - e.originPoint),
          ((e.scale >= 0.9999 && e.scale <= 1.0001) || isNaN(e.scale)) && (e.scale = 1),
          ((e.translate >= -0.01 && e.translate <= 0.01) || isNaN(e.translate)) &&
            (e.translate = 0);
      }
      function i1(e, t, i, n) {
        i0(e.x, t.x, i.x, n ? n.originX : void 0), i0(e.y, t.y, i.y, n ? n.originY : void 0);
      }
      function i2(e, t, i, n = 0) {
        (e.min = (n ? (0, e5.k)(i.min, i.max, n) : i.min) + t.min), (e.max = e.min + iZ(t));
      }
      function i5(e, t, i, n = 0) {
        const a = n ? (0, e5.k)(i.min, i.max, n) : i.min;
        (e.min = t.min - a), (e.max = e.min + iZ(t));
      }
      function i4(e, t, i, n) {
        i5(e.x, t.x, i.x, n?.x), i5(e.y, t.y, i.y, n?.y);
      }
      const i6 = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"]),
        i3 = new Set(["INPUT", "SELECT", "TEXTAREA"]);
      function i9(e, t, i, n = { passive: !0 }) {
        return e.addEventListener(t, i, n), () => e.removeEventListener(t, i);
      }
      var i7 = i(7842);
      const i8 = (e) =>
        "mouse" === e.pointerType
          ? "number" != typeof e.button || e.button <= 0
          : !1 !== e.isPrimary;
      function ne(e) {
        return { point: { x: e.pageX, y: e.pageY } };
      }
      function nt(e, t, i, n) {
        return i9(e, t, (e) => i8(e) && i(e, ne(e)), n);
      }
      const ni = ({ current: e }) => (e ? e.ownerDocument.defaultView : null),
        nn = (e, t) => Math.abs(e - t),
        na = new Set(["auto", "scroll"]);
      class nr {
        constructor(
          e,
          t,
          {
            transformPagePoint: i,
            contextWindow: n = window,
            dragSnapToOrigin: a = !1,
            distanceThreshold: r = 3,
            element: l,
          } = {},
        ) {
          if (
            ((this.startEvent = null),
            (this.lastMoveEvent = null),
            (this.lastMoveEventInfo = null),
            (this.lastRawMoveEventInfo = null),
            (this.handlers = {}),
            (this.contextWindow = window),
            (this.scrollPositions = new Map()),
            (this.removeScrollListeners = null),
            (this.onElementScroll = (e) => {
              this.handleScroll(e.target);
            }),
            (this.onWindowScroll = () => {
              this.handleScroll(window);
            }),
            (this.updatePoint = () => {
              if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return;
              this.lastRawMoveEventInfo &&
                (this.lastMoveEventInfo = nl(this.lastRawMoveEventInfo, this.transformPagePoint));
              const e = no(this.lastMoveEventInfo, this.history),
                t = null !== this.startEvent,
                i =
                  ((e, t) => Math.sqrt(nn(e.x, t.x) ** 2 + nn(e.y, t.y) ** 2))(e.offset, {
                    x: 0,
                    y: 0,
                  }) >= this.distanceThreshold;
              if (!t && !i) return;
              const { point: n } = e,
                { timestamp: a } = z.uv;
              this.history.push({ ...n, timestamp: a });
              const { onStart: r, onMove: l } = this.handlers;
              t || (r && r(this.lastMoveEvent, e), (this.startEvent = this.lastMoveEvent)),
                l && l(this.lastMoveEvent, e);
            }),
            (this.handlePointerMove = (e, t) => {
              (this.lastMoveEvent = e),
                (this.lastRawMoveEventInfo = t),
                (this.lastMoveEventInfo = nl(t, this.transformPagePoint)),
                z.Gt.update(this.updatePoint, !0);
            }),
            (this.handlePointerUp = (e, t) => {
              this.end();
              const { onEnd: i, onSessionEnd: n, resumeAnimation: a } = this.handlers;
              if (
                ((this.dragSnapToOrigin || !this.startEvent) && a && a(),
                !(this.lastMoveEvent && this.lastMoveEventInfo))
              )
                return;
              const r = no(
                "pointercancel" === e.type
                  ? this.lastMoveEventInfo
                  : nl(t, this.transformPagePoint),
                this.history,
              );
              this.startEvent && i && i(e, r), n && n(e, r);
            }),
            !i8(e))
          )
            return;
          (this.dragSnapToOrigin = a),
            (this.handlers = t),
            (this.transformPagePoint = i),
            (this.distanceThreshold = r),
            (this.contextWindow = n || window);
          const s = nl(ne(e), this.transformPagePoint),
            { point: o } = s,
            { timestamp: d } = z.uv;
          this.history = [{ ...o, timestamp: d }];
          const { onSessionStart: u } = t;
          u && u(e, no(s, this.history)),
            (this.removeListeners = (0, tY.F)(
              nt(this.contextWindow, "pointermove", this.handlePointerMove),
              nt(this.contextWindow, "pointerup", this.handlePointerUp),
              nt(this.contextWindow, "pointercancel", this.handlePointerUp),
            )),
            l && this.startScrollTracking(l);
        }
        startScrollTracking(e) {
          let t = e.parentElement;
          for (; t; ) {
            const e = getComputedStyle(t);
            (na.has(e.overflowX) || na.has(e.overflowY)) &&
              this.scrollPositions.set(t, { x: t.scrollLeft, y: t.scrollTop }),
              (t = t.parentElement);
          }
          this.scrollPositions.set(window, { x: window.scrollX, y: window.scrollY }),
            window.addEventListener("scroll", this.onElementScroll, { capture: !0 }),
            window.addEventListener("scroll", this.onWindowScroll),
            (this.removeScrollListeners = () => {
              window.removeEventListener("scroll", this.onElementScroll, { capture: !0 }),
                window.removeEventListener("scroll", this.onWindowScroll);
            });
        }
        handleScroll(e) {
          const t = this.scrollPositions.get(e);
          if (!t) return;
          const i = e === window,
            n = i ? { x: window.scrollX, y: window.scrollY } : { x: e.scrollLeft, y: e.scrollTop },
            a = { x: n.x - t.x, y: n.y - t.y };
          (0 !== a.x || 0 !== a.y) &&
            (i
              ? this.lastMoveEventInfo &&
                ((this.lastMoveEventInfo.point.x += a.x), (this.lastMoveEventInfo.point.y += a.y))
              : this.history.length > 0 && ((this.history[0].x -= a.x), (this.history[0].y -= a.y)),
            this.scrollPositions.set(e, n),
            z.Gt.update(this.updatePoint, !0));
        }
        updateHandlers(e) {
          this.handlers = e;
        }
        end() {
          this.removeListeners && this.removeListeners(),
            this.removeScrollListeners && this.removeScrollListeners(),
            this.scrollPositions.clear(),
            (0, z.WG)(this.updatePoint);
        }
      }
      function nl(e, t) {
        return t ? { point: t(e.point) } : e;
      }
      function ns(e, t) {
        return { x: e.x - t.x, y: e.y - t.y };
      }
      function no({ point: e }, t) {
        return {
          point: e,
          delta: ns(e, nd(t)),
          offset: ns(e, t[0]),
          velocity: ((e, t) => {
            if (e.length < 2) return { x: 0, y: 0 };
            let i = e.length - 1,
              n = null,
              a = nd(e);
            for (; i >= 0 && ((n = e[i]), !(a.timestamp - n.timestamp > el(0.1))); ) i--;
            if (!n) return { x: 0, y: 0 };
            n === e[0] && e.length > 2 && a.timestamp - n.timestamp > 2 * el(t) && (n = e[1]);
            const r = (a.timestamp - n.timestamp) / 1e3;
            if (0 === r) return { x: 0, y: 0 };
            const l = { x: (a.x - n.x) / r, y: (a.y - n.y) / r };
            return l.x === 1 / 0 && (l.x = 0), l.y === 1 / 0 && (l.y = 0), l;
          })(t, 0.1),
        };
      }
      function nd(e) {
        return e[e.length - 1];
      }
      var nu = i(62);
      function nc(e, t, i) {
        return {
          min: void 0 !== t ? e.min + t : void 0,
          max: void 0 !== i ? e.max + i - (e.max - e.min) : void 0,
        };
      }
      function nm(e, t) {
        let i = t.min - e.min,
          n = t.max - e.max;
        return t.max - t.min < e.max - e.min && ([i, n] = [n, i]), { min: i, max: n };
      }
      function nh(e, t, i) {
        return { min: nf(e, t), max: nf(e, i) };
      }
      function nf(e, t) {
        return "number" == typeof e ? e : e[t] || 0;
      }
      const np = new WeakMap();
      class nk {
        constructor(e) {
          (this.openDragLock = null),
            (this.isDragging = !1),
            (this.currentDirection = null),
            (this.originPoint = { x: 0, y: 0 }),
            (this.constraints = !1),
            (this.hasMutatedConstraints = !1),
            (this.elastic = T()),
            (this.latestPointerEvent = null),
            (this.latestPanInfo = null),
            (this.visualElement = e);
        }
        start(e, { snapToCursor: t = !1, distanceThreshold: i } = {}) {
          const { presenceContext: n } = this.visualElement;
          if (n && !1 === n.isPresent) return;
          const a = (e) => {
              t && this.snapToCursor(ne(e).point), this.stopAnimation();
            },
            r = (e, t) => {
              const { drag: i, dragPropagation: n, onDragStart: a } = this.getProps();
              if (
                i &&
                !n &&
                (this.openDragLock && this.openDragLock(),
                (this.openDragLock = ((e) => {
                  if ("x" === e || "y" === e)
                    if (iQ[e]) return null;
                    else
                      return (
                        (iQ[e] = !0),
                        () => {
                          iQ[e] = !1;
                        }
                      );
                  return iQ.x || iQ.y
                    ? null
                    : ((iQ.x = iQ.y = !0),
                      () => {
                        iQ.x = iQ.y = !1;
                      });
                })(i)),
                !this.openDragLock)
              )
                return;
              (this.latestPointerEvent = e),
                (this.latestPanInfo = t),
                (this.isDragging = !0),
                (this.currentDirection = null),
                this.resolveConstraints(),
                this.visualElement.projection &&
                  ((this.visualElement.projection.isAnimationBlocked = !0),
                  (this.visualElement.projection.target = void 0)),
                iJ((e) => {
                  let t = this.getAxisMotionValue(e).get() || 0;
                  if (p.KN.test(t)) {
                    const { projection: i } = this.visualElement;
                    if (i && i.layout) {
                      const n = i.layout.layoutBox[e];
                      n && (t = iZ(n) * (parseFloat(t) / 100));
                    }
                  }
                  this.originPoint[e] = t;
                }),
                a && z.Gt.update(() => a(e, t), !1, !0),
                tX(this.visualElement, "transform");
              const { animationState: r } = this.visualElement;
              r && r.setActive("whileDrag", !0);
            },
            l = (e, t) => {
              (this.latestPointerEvent = e), (this.latestPanInfo = t);
              const {
                dragPropagation: i,
                dragDirectionLock: n,
                onDirectionLock: a,
                onDrag: r,
              } = this.getProps();
              if (!i && !this.openDragLock) return;
              const { offset: l } = t;
              if (n && null === this.currentDirection) {
                (this.currentDirection = ((e, t = 10) => {
                  let i = null;
                  return Math.abs(e.y) > t ? (i = "y") : Math.abs(e.x) > t && (i = "x"), i;
                })(l)),
                  null !== this.currentDirection && a && a(this.currentDirection);
                return;
              }
              this.updateAxis("x", t.point, l),
                this.updateAxis("y", t.point, l),
                this.visualElement.render(),
                r && z.Gt.update(() => r(e, t), !1, !0);
            },
            s = (e, t) => {
              (this.latestPointerEvent = e),
                (this.latestPanInfo = t),
                this.stop(e, t),
                (this.latestPointerEvent = null),
                (this.latestPanInfo = null);
            },
            o = () => {
              const { dragSnapToOrigin: e } = this.getProps();
              (e || this.constraints) && this.startAnimation({ x: 0, y: 0 });
            },
            { dragSnapToOrigin: d } = this.getProps();
          this.panSession = new nr(
            e,
            { onSessionStart: a, onStart: r, onMove: l, onSessionEnd: s, resumeAnimation: o },
            {
              transformPagePoint: this.visualElement.getTransformPagePoint(),
              dragSnapToOrigin: d,
              distanceThreshold: i,
              contextWindow: ni(this.visualElement),
              element: this.visualElement.current,
            },
          );
        }
        stop(e, t) {
          const i = e || this.latestPointerEvent,
            n = t || this.latestPanInfo,
            a = this.isDragging;
          if ((this.cancel(), !a || !n || !i)) return;
          const { velocity: r } = n;
          this.startAnimation(r);
          const { onDragEnd: l } = this.getProps();
          l && z.Gt.postRender(() => l(i, n));
        }
        cancel() {
          this.isDragging = !1;
          const { projection: e, animationState: t } = this.visualElement;
          e && (e.isAnimationBlocked = !1), this.endPanSession();
          const { dragPropagation: i } = this.getProps();
          !i && this.openDragLock && (this.openDragLock(), (this.openDragLock = null)),
            t && t.setActive("whileDrag", !1);
        }
        endPanSession() {
          this.panSession && this.panSession.end(), (this.panSession = void 0);
        }
        updateAxis(e, t, i) {
          const { drag: n } = this.getProps();
          if (!i || !nb(e, n, this.currentDirection)) return;
          let a = this.getAxisMotionValue(e),
            r = this.originPoint[e] + i[e];
          this.constraints &&
            this.constraints[e] &&
            (r = ((e, { min: t, max: i }, n) => (
              void 0 !== t && e < t
                ? (e = n ? (0, e5.k)(t, e, n.min) : Math.max(e, t))
                : void 0 !== i && e > i && (e = n ? (0, e5.k)(i, e, n.max) : Math.min(e, i)),
              e
            ))(r, this.constraints[e], this.elastic[e])),
            a.set(r);
        }
        resolveConstraints() {
          const { dragConstraints: e, dragElastic: t } = this.getProps(),
            i =
              this.visualElement.projection && !this.visualElement.projection.layout
                ? this.visualElement.projection.measure(!1)
                : this.visualElement.projection?.layout,
            n = this.constraints;
          e && tN(e)
            ? this.constraints || (this.constraints = this.resolveRefConstraints())
            : e && i
              ? (this.constraints = ((e, { top: t, left: i, bottom: n, right: a }) => ({
                  x: nc(e.x, i, a),
                  y: nc(e.y, t, n),
                }))(i.layoutBox, e))
              : (this.constraints = !1),
            (this.elastic = ((e = 0.35) => (
              !1 === e ? (e = 0) : !0 === e && (e = 0.35),
              { x: nh(e, "left", "right"), y: nh(e, "top", "bottom") }
            ))(t)),
            n !== this.constraints &&
              !tN(e) &&
              i &&
              this.constraints &&
              !this.hasMutatedConstraints &&
              iJ((e) => {
                !1 !== this.constraints &&
                  this.getAxisMotionValue(e) &&
                  (this.constraints[e] = ((e, t) => {
                    const i = {};
                    return (
                      void 0 !== t.min && (i.min = t.min - e.min),
                      void 0 !== t.max && (i.max = t.max - e.min),
                      i
                    );
                  })(i.layoutBox[e], this.constraints[e]));
              });
        }
        resolveRefConstraints() {
          var e;
          const { dragConstraints: t, onMeasureDragConstraints: i } = this.getProps();
          if (!t || !tN(t)) return !1;
          const n = t.current;
          (0, O.V)(
            null !== n,
            "If `dragConstraints` is set as a React ref, that ref must be passed to another component's `ref` prop.",
            "drag-constraints-ref",
          );
          const { projection: a } = this.visualElement;
          if (!a || !a.layout) return !1;
          let r = ((e, t, i) => {
              const n = tc(e, i),
                { scroll: a } = t;
              return a && (ts(n.x, a.offset.x), ts(n.y, a.offset.y)), n;
            })(n, a.root, this.visualElement.getTransformPagePoint()),
            l = ((e = a.layout.layoutBox), { x: nm(e.x, r.x), y: nm(e.y, r.y) });
          if (i) {
            const e = i(
              (({ x: e, y: t }) => ({ top: t.min, right: e.max, bottom: t.max, left: e.min }))(l),
            );
            (this.hasMutatedConstraints = !!e), e && (l = e8(e));
          }
          return l;
        }
        startAnimation(e) {
          const {
              drag: t,
              dragMomentum: i,
              dragElastic: n,
              dragTransition: a,
              dragSnapToOrigin: r,
              onDragTransitionEnd: l,
            } = this.getProps(),
            s = this.constraints || {};
          return Promise.all(
            iJ((l) => {
              if (!nb(l, t, this.currentDirection)) return;
              let o = (s && s[l]) || {};
              (!0 === r || r === l) && (o = { min: 0, max: 0 });
              const d = {
                type: "inertia",
                velocity: i ? e[l] : 0,
                bounceStiffness: n ? 200 : 1e6,
                bounceDamping: n ? 40 : 1e7,
                timeConstant: 750,
                restDelta: 1,
                restSpeed: 10,
                ...a,
                ...o,
              };
              return this.startAxisValueAnimation(l, d);
            }),
          ).then(l);
        }
        startAxisValueAnimation(e, t) {
          const i = this.getAxisMotionValue(e);
          return tX(this.visualElement, e), i.start(iL(e, i, 0, t, this.visualElement, !1));
        }
        stopAnimation() {
          iJ((e) => this.getAxisMotionValue(e).stop());
        }
        getAxisMotionValue(e) {
          const t = `_drag${e.toUpperCase()}`,
            i = this.visualElement.getProps();
          return i[t] || this.visualElement.getValue(e, (i.initial ? i.initial[e] : void 0) || 0);
        }
        snapToCursor(e) {
          iJ((t) => {
            const { drag: i } = this.getProps();
            if (!nb(t, i, this.currentDirection)) return;
            const { projection: n } = this.visualElement,
              a = this.getAxisMotionValue(t);
            if (n && n.layout) {
              const { min: i, max: r } = n.layout.layoutBox[t],
                l = a.get() || 0;
              a.set(e[t] - (0, e5.k)(i, r, 0.5) + l);
            }
          });
        }
        scalePositionWithinConstraints() {
          if (!this.visualElement.current) return;
          const { drag: e, dragConstraints: t } = this.getProps(),
            { projection: i } = this.visualElement;
          if (!tN(t) || !i || !this.constraints) return;
          this.stopAnimation();
          const n = { x: 0, y: 0 };
          iJ((e) => {
            const t = this.getAxisMotionValue(e);
            if (t && !1 !== this.constraints) {
              const i = t.get();
              n[e] = ((e, t) => {
                let i = 0.5,
                  n = iZ(e),
                  a = iZ(t);
                return (
                  a > n
                    ? (i = (0, nu.q)(t.min, t.max - n, e.min))
                    : n > a && (i = (0, nu.q)(e.min, e.max - a, t.min)),
                  (0, tQ.q)(0, 1, i)
                );
              })({ min: i, max: i }, this.constraints[e]);
            }
          });
          const { transformTemplate: a } = this.visualElement.getProps();
          (this.visualElement.current.style.transform = a ? a({}, "") : "none"),
            i.root && i.root.updateScroll(),
            i.updateLayout(),
            (this.constraints = !1),
            this.resolveConstraints(),
            iJ((t) => {
              if (!nb(t, e, null)) return;
              const i = this.getAxisMotionValue(t),
                { min: a, max: r } = this.constraints[t];
              i.set((0, e5.k)(a, r, n[t]));
            }),
            this.visualElement.render();
        }
        addListeners() {
          let e;
          if (!this.visualElement.current) return;
          np.set(this.visualElement, this);
          const t = this.visualElement.current,
            i = nt(t, "pointerdown", (e) => {
              const { drag: i, dragListener: n = !0 } = this.getProps(),
                a = e.target,
                r = a !== t && (i3.has(a.tagName) || !0 === a.isContentEditable);
              i && n && !r && this.start(e);
            }),
            n = () => {
              const { dragConstraints: i } = this.getProps();
              tN(i) &&
                i.current &&
                ((this.constraints = this.resolveRefConstraints()),
                e ||
                  (e = ((e, t, i) => {
                    const n = (0, i7.X)(e, n_(i)),
                      a = (0, i7.X)(t, n_(i));
                    return () => {
                      n(), a();
                    };
                  })(t, i.current, () => this.scalePositionWithinConstraints())));
            },
            { projection: a } = this.visualElement,
            r = a.addEventListener("measure", n);
          a && !a.layout && (a.root && a.root.updateScroll(), a.updateLayout()), z.Gt.read(n);
          const l = i9(window, "resize", () => this.scalePositionWithinConstraints()),
            s = a.addEventListener("didUpdate", ({ delta: e, hasLayoutChanged: t }) => {
              this.isDragging &&
                t &&
                (iJ((t) => {
                  const i = this.getAxisMotionValue(t);
                  i && ((this.originPoint[t] += e[t].translate), i.set(i.get() + e[t].translate));
                }),
                this.visualElement.render());
            });
          return () => {
            l(), i(), r(), s && s(), e && e();
          };
        }
        getProps() {
          const e = this.visualElement.getProps(),
            {
              drag: t = !1,
              dragDirectionLock: i = !1,
              dragPropagation: n = !1,
              dragConstraints: a = !1,
              dragElastic: r = 0.35,
              dragMomentum: l = !0,
            } = e;
          return {
            ...e,
            drag: t,
            dragDirectionLock: i,
            dragPropagation: n,
            dragConstraints: a,
            dragElastic: r,
            dragMomentum: l,
          };
        }
      }
      function n_(e) {
        let t = !0;
        return () => {
          if (t) {
            t = !1;
            return;
          }
          e();
        };
      }
      function nb(e, t, i) {
        return (!0 === t || t === e) && (null === i || i === e);
      }
      class ng extends tU {
        constructor(e) {
          super(e),
            (this.removeGroupControls = eo.l),
            (this.removeListeners = eo.l),
            (this.controls = new nk(e));
        }
        mount() {
          const { dragControls: e } = this.node.getProps();
          e && (this.removeGroupControls = e.subscribe(this.controls)),
            (this.removeListeners = this.controls.addListeners() || eo.l);
        }
        update() {
          const { dragControls: e } = this.node.getProps(),
            { dragControls: t } = this.node.prevProps || {};
          e !== t &&
            (this.removeGroupControls(),
            e && (this.removeGroupControls = e.subscribe(this.controls)));
        }
        unmount() {
          this.removeGroupControls(),
            this.removeListeners(),
            this.controls.isDragging || this.controls.endPanSession();
        }
      }
      const ny = (e) => (t, i) => {
        e && z.Gt.update(() => e(t, i), !1, !0);
      };
      class nv extends tU {
        constructor() {
          super(...arguments), (this.removePointerDownListener = eo.l);
        }
        onPointerDown(e) {
          this.session = new nr(e, this.createPanHandlers(), {
            transformPagePoint: this.node.getTransformPagePoint(),
            contextWindow: ni(this.node),
          });
        }
        createPanHandlers() {
          const {
            onPanSessionStart: e,
            onPanStart: t,
            onPan: i,
            onPanEnd: n,
          } = this.node.getProps();
          return {
            onSessionStart: ny(e),
            onStart: ny(t),
            onMove: ny(i),
            onEnd: (e, t) => {
              delete this.session, n && z.Gt.postRender(() => n(e, t));
            },
          };
        }
        mount() {
          this.removePointerDownListener = nt(this.node.current, "pointerdown", (e) =>
            this.onPointerDown(e),
          );
        }
        update() {
          this.session && this.session.updateHandlers(this.createPanHandlers());
        }
        unmount() {
          this.removePointerDownListener(), this.session && this.session.end();
        }
      }
      let nP = { hasAnimatedSinceResize: !0, hasEverUpdated: !1 },
        nT = !1;
      class nj extends th.Component {
        componentDidMount() {
          const {
              visualElement: e,
              layoutGroup: t,
              switchLayoutGroup: i,
              layoutId: n,
            } = this.props,
            { projection: a } = e;
          a &&
            (t.group && t.group.add(a),
            i && i.register && n && i.register(a),
            nT && a.root.didUpdate(),
            a.addEventListener("animationComplete", () => {
              this.safeToRemove();
            }),
            a.setOptions({
              ...a.options,
              layoutDependency: this.props.layoutDependency,
              onExitComplete: () => this.safeToRemove(),
            })),
            (nP.hasEverUpdated = !0);
        }
        getSnapshotBeforeUpdate(e) {
          const { layoutDependency: t, visualElement: i, drag: n, isPresent: a } = this.props,
            { projection: r } = i;
          return (
            r &&
              ((r.isPresent = a),
              e.layoutDependency !== t && r.setOptions({ ...r.options, layoutDependency: t }),
              (nT = !0),
              n || e.layoutDependency !== t || void 0 === t || e.isPresent !== a
                ? r.willUpdate()
                : this.safeToRemove(),
              e.isPresent !== a &&
                (a
                  ? r.promote()
                  : r.relegate() ||
                    z.Gt.postRender(() => {
                      const e = r.getStack();
                      (e && e.members.length) || this.safeToRemove();
                    }))),
            null
          );
        }
        componentDidUpdate() {
          const { visualElement: e, layoutAnchor: t } = this.props,
            { projection: i } = e;
          i &&
            ((i.options.layoutAnchor = t),
            i.root.didUpdate(),
            ej.postRender(() => {
              !i.currentAnimation && i.isLead() && this.safeToRemove();
            }));
        }
        componentWillUnmount() {
          const { visualElement: e, layoutGroup: t, switchLayoutGroup: i } = this.props,
            { projection: n } = e;
          (nT = !0),
            n &&
              (n.scheduleCheckAfterUnmount(),
              t && t.group && t.group.remove(n),
              i && i.deregister && i.deregister(n));
        }
        safeToRemove() {
          const { safeToRemove: e } = this.props;
          e && e();
        }
        render() {
          return null;
        }
      }
      function nx(e) {
        const [t, i] = (function () {
            const e = !(arguments.length > 0) || void 0 === arguments[0] || arguments[0],
              t = (0, th.useContext)(tO);
            if (null === t) return [!0, null];
            const { isPresent: i, onExitComplete: n, register: a } = t,
              r = (0, th.useId)();
            (0, th.useEffect)(() => {
              if (e) return a(r);
            }, [e]);
            const l = (0, th.useCallback)(() => e && n && n(r), [r, n, e]);
            return !i && n ? [!1, l] : [!0];
          })(),
          n = (0, th.useContext)(t_);
        return (0, tk.jsx)(nj, {
          ...e,
          layoutGroup: n,
          switchLayoutGroup: (0, th.useContext)(tq),
          isPresent: t,
          safeToRemove: i,
        });
      }
      var nS = i(6477);
      const nE = [
          "borderTopLeftRadius",
          "borderTopRightRadius",
          "borderBottomLeftRadius",
          "borderBottomRightRadius",
        ],
        nw = nE.length,
        nO = (e) => ("string" == typeof e ? parseFloat(e) : e),
        nA = (e) => "number" == typeof e || p.px.test(e);
      function nC(e, t) {
        return void 0 !== e[t] ? e[t] : e.borderRadius;
      }
      const nR = nD(0, 0.5, ih),
        nM = nD(0.5, 0.95, eo.l);
      function nD(e, t, i) {
        return (n) => (n < e ? 0 : n > t ? 1 : i((0, nu.q)(e, t, n)));
      }
      function nG(e, t) {
        (e.min = t.min), (e.max = t.max);
      }
      function nI(e, t) {
        nG(e.x, t.x), nG(e.y, t.y);
      }
      function nV(e, t) {
        (e.translate = t.translate),
          (e.scale = t.scale),
          (e.originPoint = t.originPoint),
          (e.origin = t.origin);
      }
      function nL(e, t, i, n, a) {
        return (
          (e -= t), (e = n + (1 / i) * (e - n)), void 0 !== a && (e = n + (1 / a) * (e - n)), e
        );
      }
      function nq(e, t, [i, n, a], r, l) {
        !((e, t = 0, i = 1, n = 0.5, a, r = e, l = e) => {
          if (
            (p.KN.test(t) && ((t = parseFloat(t)), (t = (0, e5.k)(l.min, l.max, t / 100) - l.min)),
            "number" != typeof t)
          )
            return;
          let s = (0, e5.k)(r.min, r.max, n);
          e === r && (s -= t), (e.min = nL(e.min, t, i, s, a)), (e.max = nL(e.max, t, i, s, a));
        })(e, t[i], t[n], t[a], t.scale, r, l);
      }
      const nN = ["x", "scaleX", "originX"],
        nF = ["y", "scaleY", "originY"];
      function nB(e, t, i, n) {
        nq(e.x, t, nN, i ? i.x : void 0, n ? n.x : void 0),
          nq(e.y, t, nF, i ? i.y : void 0, n ? n.y : void 0);
      }
      function nU(e) {
        return 0 === e.translate && 1 === e.scale;
      }
      function n$(e) {
        return nU(e.x) && nU(e.y);
      }
      function nW(e, t) {
        return e.min === t.min && e.max === t.max;
      }
      function nH(e, t) {
        return Math.round(e.min) === Math.round(t.min) && Math.round(e.max) === Math.round(t.max);
      }
      function nz(e, t) {
        return nH(e.x, t.x) && nH(e.y, t.y);
      }
      function nK(e) {
        return iZ(e.x) / iZ(e.y);
      }
      function nX(e, t) {
        return (
          e.translate === t.translate && e.scale === t.scale && e.originPoint === t.originPoint
        );
      }
      var nY = i(5920);
      class nQ {
        constructor() {
          this.members = [];
        }
        add(e) {
          (0, nY.Kq)(this.members, e);
          for (let t = this.members.length - 1; t >= 0; t--) {
            const i = this.members[t];
            if (i === e || i === this.lead || i === this.prevLead) continue;
            const n = i.instance;
            (n && !1 !== n.isConnected) || i.snapshot || ((0, nY.Ai)(this.members, i), i.unmount());
          }
          e.scheduleRender();
        }
        remove(e) {
          if (
            ((0, nY.Ai)(this.members, e),
            e === this.prevLead && (this.prevLead = void 0),
            e === this.lead)
          ) {
            const e = this.members[this.members.length - 1];
            e && this.promote(e);
          }
        }
        relegate(e) {
          for (let t = this.members.indexOf(e) - 1; t >= 0; t--) {
            const e = this.members[t];
            if (!1 !== e.isPresent && e.instance?.isConnected !== !1) return this.promote(e), !0;
          }
          return !1;
        }
        promote(e, t) {
          const i = this.lead;
          if (e !== i && ((this.prevLead = i), (this.lead = e), e.show(), i)) {
            i.updateSnapshot(), e.scheduleRender();
            const { layoutDependency: n } = i.options,
              { layoutDependency: a } = e.options;
            (void 0 === n || n !== a) &&
              ((e.resumeFrom = i),
              t && (i.preserveOpacity = !0),
              i.snapshot &&
                ((e.snapshot = i.snapshot),
                (e.snapshot.latestValues = i.animationValues || i.latestValues)),
              e.root?.isUpdating && (e.isLayoutDirty = !0)),
              !1 === e.options.crossfade && i.hide();
          }
        }
        exitAnimationComplete() {
          this.members.forEach((e) => {
            e.options.onExitComplete?.(), e.resumingFrom?.options.onExitComplete?.();
          });
        }
        scheduleRender() {
          this.members.forEach((e) => e.instance && e.scheduleRender(!1));
        }
        removeLeadSnapshot() {
          this.lead?.snapshot && (this.lead.snapshot = void 0);
        }
      }
      const nJ = (e, t) => e.depth - t.depth;
      class nZ {
        constructor() {
          (this.children = []), (this.isDirty = !1);
        }
        add(e) {
          (0, nY.Kq)(this.children, e), (this.isDirty = !0);
        }
        remove(e) {
          (0, nY.Ai)(this.children, e), (this.isDirty = !0);
        }
        forEach(e) {
          this.isDirty && this.children.sort(nJ), (this.isDirty = !1), this.children.forEach(e);
        }
      }
      let n0 = { nodes: 0, calculatedTargetDeltas: 0, calculatedProjections: 0 },
        n1 = ["", "X", "Y", "Z"],
        n2 = 0;
      function n5(e, t, i, n) {
        const { latestValues: a } = t;
        a[e] && ((i[e] = a[e]), t.setStaticValue(e, 0), n && (n[e] = 0));
      }
      function n4({
        attachResizeListener: e,
        defaultParent: t,
        measureScroll: i,
        checkIsScrollRoot: n,
        resetTransform: a,
      }) {
        return class {
          constructor(e = {}, i = t?.()) {
            (this.id = n2++),
              (this.animationId = 0),
              (this.animationCommitId = 0),
              (this.children = new Set()),
              (this.options = {}),
              (this.isTreeAnimating = !1),
              (this.isAnimationBlocked = !1),
              (this.isLayoutDirty = !1),
              (this.isProjectionDirty = !1),
              (this.isSharedProjectionDirty = !1),
              (this.isTransformDirty = !1),
              (this.updateManuallyBlocked = !1),
              (this.updateBlockedByResize = !1),
              (this.isUpdating = !1),
              (this.isSVG = !1),
              (this.needsReset = !1),
              (this.shouldResetTransform = !1),
              (this.hasCheckedOptimisedAppear = !1),
              (this.treeScale = { x: 1, y: 1 }),
              (this.eventHandlers = new Map()),
              (this.hasTreeAnimated = !1),
              (this.layoutVersion = 0),
              (this.updateScheduled = !1),
              (this.scheduleUpdate = () => this.update()),
              (this.projectionUpdateScheduled = !1),
              (this.checkUpdateFailed = () => {
                this.isUpdating && ((this.isUpdating = !1), this.clearAllSnapshots());
              }),
              (this.updateProjection = () => {
                (this.projectionUpdateScheduled = !1),
                  ep.Q.value &&
                    (n0.nodes = n0.calculatedTargetDeltas = n0.calculatedProjections = 0),
                  this.nodes.forEach(n9),
                  this.nodes.forEach(al),
                  this.nodes.forEach(as),
                  this.nodes.forEach(n7),
                  ep.Q.addProjectionMetrics && ep.Q.addProjectionMetrics(n0);
              }),
              (this.resolvedRelativeTargetAt = 0),
              (this.linkedParentVersion = 0),
              (this.hasProjected = !1),
              (this.isVisible = !0),
              (this.animationProgress = 0),
              (this.sharedNodes = new Map()),
              (this.latestValues = e),
              (this.root = i ? i.root || i : this),
              (this.path = i ? [...i.path, i] : []),
              (this.parent = i),
              (this.depth = i ? i.depth + 1 : 0);
            for (let e = 0; e < this.path.length; e++) this.path[e].shouldResetTransform = !0;
            this.root === this && (this.nodes = new nZ());
          }
          addEventListener(e, t) {
            return (
              this.eventHandlers.has(e) || this.eventHandlers.set(e, new es.v()),
              this.eventHandlers.get(e).add(t)
            );
          }
          notifyListeners(e, ...t) {
            const i = this.eventHandlers.get(e);
            i && i.notify(...t);
          }
          hasListeners(e) {
            return this.eventHandlers.has(e);
          }
          mount(t) {
            if (this.instance) return;
            (this.isSVG = (0, nS.x)(t) && (!(0, nS.x)(t) || "svg" !== t.tagName)),
              (this.instance = t);
            const { layoutId: i, layout: n, visualElement: a } = this.options;
            if (
              (a && !a.current && a.mount(t),
              this.root.nodes.add(this),
              this.parent && this.parent.children.add(this),
              this.root.hasTreeAnimated && (n || i) && (this.isLayoutDirty = !0),
              e)
            ) {
              let i,
                n = 0,
                a = () => (this.root.updateBlockedByResize = !1);
              z.Gt.read(() => {
                n = window.innerWidth;
              }),
                e(t, () => {
                  const e = window.innerWidth;
                  e !== n &&
                    ((n = e),
                    (this.root.updateBlockedByResize = !0),
                    i && i(),
                    (i = ((e, t) => {
                      const i = ex.k.now(),
                        n = ({ timestamp: t }) => {
                          const a = t - i;
                          a >= 250 && ((0, z.WG)(n), e(a - 250));
                        };
                      return z.Gt.setup(n, !0), () => (0, z.WG)(n);
                    })(a, 250)),
                    nP.hasAnimatedSinceResize &&
                      ((nP.hasAnimatedSinceResize = !1), this.nodes.forEach(ar)));
                });
            }
            i && this.root.registerSharedNode(i, this),
              !1 !== this.options.animate &&
                a &&
                (i || n) &&
                this.addEventListener(
                  "didUpdate",
                  ({ delta: e, hasLayoutChanged: t, hasRelativeLayoutChanged: i, layout: n }) => {
                    if (this.isTreeAnimationBlocked()) {
                      (this.target = void 0), (this.relativeTarget = void 0);
                      return;
                    }
                    const r = this.options.transition || a.getDefaultTransition() || ah,
                      { onLayoutAnimationStart: l, onLayoutAnimationComplete: s } = a.getProps(),
                      o = !this.targetLayout || !nz(this.targetLayout, n),
                      d = !t && i;
                    if (
                      this.options.layoutRoot ||
                      this.resumeFrom ||
                      d ||
                      (t && (o || !this.currentAnimation))
                    ) {
                      this.resumeFrom &&
                        ((this.resumingFrom = this.resumeFrom),
                        (this.resumingFrom.resumingFrom = void 0));
                      const t = { ...tH(r, "layout"), onPlay: l, onComplete: s };
                      (a.shouldReduceMotion || this.options.layoutRoot) &&
                        ((t.delay = 0), (t.type = !1)),
                        this.startAnimation(t),
                        this.setAnimationOrigin(e, d);
                    } else
                      t || ar(this),
                        this.isLead() &&
                          this.options.onExitComplete &&
                          this.options.onExitComplete();
                    this.targetLayout = n;
                  },
                );
          }
          unmount() {
            this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this);
            const e = this.getStack();
            e && e.remove(this),
              this.parent && this.parent.children.delete(this),
              (this.instance = void 0),
              this.eventHandlers.clear(),
              (0, z.WG)(this.updateProjection);
          }
          blockUpdate() {
            this.updateManuallyBlocked = !0;
          }
          unblockUpdate() {
            this.updateManuallyBlocked = !1;
          }
          isUpdateBlocked() {
            return this.updateManuallyBlocked || this.updateBlockedByResize;
          }
          isTreeAnimationBlocked() {
            return (
              this.isAnimationBlocked || (this.parent && this.parent.isTreeAnimationBlocked()) || !1
            );
          }
          startUpdate() {
            !this.isUpdateBlocked() &&
              ((this.isUpdating = !0), this.nodes && this.nodes.forEach(ao), this.animationId++);
          }
          getTransformTemplate() {
            const { visualElement: e } = this.options;
            return e && e.getProps().transformTemplate;
          }
          willUpdate(e = !0) {
            if (((this.root.hasTreeAnimated = !0), this.root.isUpdateBlocked())) {
              this.options.onExitComplete && this.options.onExitComplete();
              return;
            }
            if (
              (window.MotionCancelOptimisedAnimation &&
                !this.hasCheckedOptimisedAppear &&
                (function e(t) {
                  if (((t.hasCheckedOptimisedAppear = !0), t.root === t)) return;
                  const { visualElement: i } = t.options;
                  if (!i) return;
                  const n = i.props[tL];
                  if (window.MotionHasOptimisedAnimation(n, "transform")) {
                    const { layout: e, layoutId: i } = t.options;
                    window.MotionCancelOptimisedAnimation(n, "transform", z.Gt, !(e || i));
                  }
                  const { parent: a } = t;
                  a && !a.hasCheckedOptimisedAppear && e(a);
                })(this),
              this.root.isUpdating || this.root.startUpdate(),
              this.isLayoutDirty)
            )
              return;
            this.isLayoutDirty = !0;
            for (let e = 0; e < this.path.length; e++) {
              const t = this.path[e];
              (t.shouldResetTransform = !0),
                ("string" == typeof t.latestValues.x || "string" == typeof t.latestValues.y) &&
                  (t.isLayoutDirty = !0),
                t.updateScroll("snapshot"),
                t.options.layoutRoot && t.willUpdate(!1);
            }
            const { layoutId: t, layout: i } = this.options;
            if (void 0 === t && !i) return;
            const n = this.getTransformTemplate();
            (this.prevTransformTemplateValue = n ? n(this.latestValues, "") : void 0),
              this.updateSnapshot(),
              e && this.notifyListeners("willUpdate");
          }
          update() {
            if (((this.updateScheduled = !1), this.isUpdateBlocked())) {
              const e = this.updateBlockedByResize;
              this.unblockUpdate(),
                (this.updateBlockedByResize = !1),
                this.clearAllSnapshots(),
                e && this.nodes.forEach(at),
                this.nodes.forEach(ae);
              return;
            }
            if (this.animationId <= this.animationCommitId) return void this.nodes.forEach(ai);
            (this.animationCommitId = this.animationId),
              this.isUpdating
                ? ((this.isUpdating = !1),
                  this.nodes.forEach(an),
                  this.nodes.forEach(aa),
                  this.nodes.forEach(n6),
                  this.nodes.forEach(n3))
                : this.nodes.forEach(ai),
              this.clearAllSnapshots();
            const e = ex.k.now();
            (z.uv.delta = (0, tQ.q)(0, 1e3 / 60, e - z.uv.timestamp)),
              (z.uv.timestamp = e),
              (z.uv.isProcessing = !0),
              z.PP.update.process(z.uv),
              z.PP.preRender.process(z.uv),
              z.PP.render.process(z.uv),
              (z.uv.isProcessing = !1);
          }
          didUpdate() {
            this.updateScheduled || ((this.updateScheduled = !0), ej.read(this.scheduleUpdate));
          }
          clearAllSnapshots() {
            this.nodes.forEach(n8), this.sharedNodes.forEach(ad);
          }
          scheduleUpdateProjection() {
            this.projectionUpdateScheduled ||
              ((this.projectionUpdateScheduled = !0),
              z.Gt.preRender(this.updateProjection, !1, !0));
          }
          scheduleCheckAfterUnmount() {
            z.Gt.postRender(() => {
              this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
            });
          }
          updateSnapshot() {
            !this.snapshot &&
              this.instance &&
              ((this.snapshot = this.measure()),
              !this.snapshot ||
                iZ(this.snapshot.measuredBox.x) ||
                iZ(this.snapshot.measuredBox.y) ||
                (this.snapshot = void 0));
          }
          updateLayout() {
            if (
              !this.instance ||
              (this.updateScroll(),
              !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty)
            )
              return;
            if (this.resumeFrom && !this.resumeFrom.instance)
              for (let e = 0; e < this.path.length; e++) this.path[e].updateScroll();
            const e = this.layout;
            (this.layout = this.measure(!1)),
              this.layoutVersion++,
              this.layoutCorrected || (this.layoutCorrected = T()),
              (this.isLayoutDirty = !1),
              (this.projectionDelta = void 0),
              this.notifyListeners("measure", this.layout.layoutBox);
            const { visualElement: t } = this.options;
            t && t.notify("LayoutMeasure", this.layout.layoutBox, e ? e.layoutBox : void 0);
          }
          updateScroll(e = "measure") {
            let t = !!(this.options.layoutScroll && this.instance);
            if (
              (this.scroll &&
                this.scroll.animationId === this.root.animationId &&
                this.scroll.phase === e &&
                (t = !1),
              t && this.instance)
            ) {
              const t = n(this.instance);
              this.scroll = {
                animationId: this.root.animationId,
                phase: e,
                isRoot: t,
                offset: i(this.instance),
                wasRoot: this.scroll ? this.scroll.isRoot : t,
              };
            }
          }
          resetTransform() {
            if (!a) return;
            const e =
                this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout,
              t = this.projectionDelta && !n$(this.projectionDelta),
              i = this.getTransformTemplate(),
              n = i ? i(this.latestValues, "") : void 0,
              r = n !== this.prevTransformTemplateValue;
            e &&
              this.instance &&
              (t || ti(this.latestValues) || r) &&
              (a(this.instance, n), (this.shouldResetTransform = !1), this.scheduleRender());
          }
          measure(e = !0) {
            var t;
            let i = this.measurePageBox(),
              n = this.removeElementScroll(i);
            return (
              e && (n = this.removeTransform(n)),
              ak((t = n).x),
              ak(t.y),
              {
                animationId: this.root.animationId,
                measuredBox: i,
                layoutBox: n,
                latestValues: {},
                source: this.id,
              }
            );
          }
          measurePageBox() {
            const { visualElement: e } = this.options;
            if (!e) return T();
            const t = e.measureViewportBox();
            if (!(this.scroll?.wasRoot || this.path.some(ab))) {
              const { scroll: e } = this.root;
              e && (ts(t.x, e.offset.x), ts(t.y, e.offset.y));
            }
            return t;
          }
          removeElementScroll(e) {
            const t = T();
            if ((nI(t, e), this.scroll?.wasRoot)) return t;
            for (let i = 0; i < this.path.length; i++) {
              const n = this.path[i],
                { scroll: a, options: r } = n;
              n !== this.root &&
                a &&
                r.layoutScroll &&
                (a.wasRoot && nI(t, e), ts(t.x, a.offset.x), ts(t.y, a.offset.y));
            }
            return t;
          }
          applyTransform(e, t = !1, i) {
            const n = i || T();
            nI(n, e);
            for (let e = 0; e < this.path.length; e++) {
              const i = this.path[e];
              !t &&
                i.options.layoutScroll &&
                i.scroll &&
                i !== i.root &&
                (ts(n.x, -i.scroll.offset.x), ts(n.y, -i.scroll.offset.y)),
                ti(i.latestValues) && tu(n, i.latestValues, i.layout?.layoutBox);
            }
            return ti(this.latestValues) && tu(n, this.latestValues, this.layout?.layoutBox), n;
          }
          removeTransform(e) {
            const t = T();
            nI(t, e);
            for (let e = 0; e < this.path.length; e++) {
              let i,
                n = this.path[e];
              ti(n.latestValues) &&
                (n.instance &&
                  (tt(n.latestValues) && n.updateSnapshot(), nI((i = T()), n.measurePageBox())),
                nB(t, n.latestValues, n.snapshot?.layoutBox, i));
            }
            return ti(this.latestValues) && nB(t, this.latestValues), t;
          }
          setTargetDelta(e) {
            (this.targetDelta = e),
              this.root.scheduleUpdateProjection(),
              (this.isProjectionDirty = !0);
          }
          setOptions(e) {
            this.options = {
              ...this.options,
              ...e,
              crossfade: void 0 === e.crossfade || e.crossfade,
            };
          }
          clearMeasurements() {
            (this.scroll = void 0),
              (this.layout = void 0),
              (this.snapshot = void 0),
              (this.prevTransformTemplateValue = void 0),
              (this.targetDelta = void 0),
              (this.target = void 0),
              (this.isLayoutDirty = !1);
          }
          forceRelativeParentToResolveTarget() {
            this.relativeParent &&
              this.relativeParent.resolvedRelativeTargetAt !== z.uv.timestamp &&
              this.relativeParent.resolveTargetDelta(!0);
          }
          resolveTargetDelta(e = !1) {
            const t = this.getLead();
            this.isProjectionDirty || (this.isProjectionDirty = t.isProjectionDirty),
              this.isTransformDirty || (this.isTransformDirty = t.isTransformDirty),
              this.isSharedProjectionDirty ||
                (this.isSharedProjectionDirty = t.isSharedProjectionDirty);
            const i = !!this.resumingFrom || this !== t;
            if (
              !(
                e ||
                (i && this.isSharedProjectionDirty) ||
                this.isProjectionDirty ||
                this.parent?.isProjectionDirty ||
                this.attemptToResolveRelativeTarget ||
                this.root.updateBlockedByResize
              )
            )
              return;
            const { layout: n, layoutId: a } = this.options;
            if (!this.layout || !(n || a)) return;
            this.resolvedRelativeTargetAt = z.uv.timestamp;
            const r = this.getClosestProjectingParent();
            if (
              (r &&
                this.linkedParentVersion !== r.layoutVersion &&
                !r.options.layoutRoot &&
                this.removeRelativeTarget(),
              this.targetDelta ||
                this.relativeTarget ||
                (!1 !== this.options.layoutAnchor && r && r.layout
                  ? this.createRelativeTarget(r, this.layout.layoutBox, r.layout.layoutBox)
                  : this.removeRelativeTarget()),
              this.relativeTarget || this.targetDelta)
            ) {
              if (
                (this.target || ((this.target = T()), (this.targetWithTransforms = T())),
                this.relativeTarget &&
                  this.relativeTargetOrigin &&
                  this.relativeParent &&
                  this.relativeParent.target)
              ) {
                var l, s, o, d;
                this.forceRelativeParentToResolveTarget(),
                  (l = this.target),
                  (s = this.relativeTarget),
                  (o = this.relativeParent.target),
                  (d = this.options.layoutAnchor || void 0),
                  i2(l.x, s.x, o.x, d?.x),
                  i2(l.y, s.y, o.y, d?.y);
              } else
                this.targetDelta
                  ? (this.resumingFrom
                      ? this.applyTransform(this.layout.layoutBox, !1, this.target)
                      : nI(this.target, this.layout.layoutBox),
                    tl(this.target, this.targetDelta))
                  : nI(this.target, this.layout.layoutBox);
              this.attemptToResolveRelativeTarget &&
                ((this.attemptToResolveRelativeTarget = !1),
                !1 !== this.options.layoutAnchor &&
                r &&
                !!r.resumingFrom == !!this.resumingFrom &&
                !r.options.layoutScroll &&
                r.target &&
                1 !== this.animationProgress
                  ? this.createRelativeTarget(r, this.target, r.target)
                  : (this.relativeParent = this.relativeTarget = void 0)),
                ep.Q.value && n0.calculatedTargetDeltas++;
            }
          }
          getClosestProjectingParent() {
            if (!(!this.parent || tt(this.parent.latestValues) || tn(this.parent.latestValues)))
              if (this.parent.isProjecting()) return this.parent;
              else return this.parent.getClosestProjectingParent();
          }
          isProjecting() {
            return !!(
              (this.relativeTarget || this.targetDelta || this.options.layoutRoot) &&
              this.layout
            );
          }
          createRelativeTarget(e, t, i) {
            (this.relativeParent = e),
              (this.linkedParentVersion = e.layoutVersion),
              this.forceRelativeParentToResolveTarget(),
              (this.relativeTarget = T()),
              (this.relativeTargetOrigin = T()),
              i4(this.relativeTargetOrigin, t, i, this.options.layoutAnchor || void 0),
              nI(this.relativeTarget, this.relativeTargetOrigin);
          }
          removeRelativeTarget() {
            this.relativeParent = this.relativeTarget = void 0;
          }
          calcProjection() {
            let e = this.getLead(),
              t = !!this.resumingFrom || this !== e,
              i = !0;
            if (
              ((this.isProjectionDirty || this.parent?.isProjectionDirty) && (i = !1),
              t && (this.isSharedProjectionDirty || this.isTransformDirty) && (i = !1),
              this.resolvedRelativeTargetAt === z.uv.timestamp && (i = !1),
              i)
            )
              return;
            const { layout: n, layoutId: a } = this.options;
            if (
              ((this.isTreeAnimating = !!(
                (this.parent && this.parent.isTreeAnimating) ||
                this.currentAnimation ||
                this.pendingAnimation
              )),
              this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0),
              !this.layout || !(n || a))
            )
              return;
            nI(this.layoutCorrected, this.layout.layoutBox);
            const r = this.treeScale.x,
              l = this.treeScale.y;
            !((e, t, i, n = !1) => {
              let a,
                r,
                l = i.length;
              if (l) {
                t.x = t.y = 1;
                for (let s = 0; s < l; s++) {
                  r = (a = i[s]).projectionDelta;
                  const { visualElement: l } = a.options;
                  (!l || !l.props.style || "contents" !== l.props.style.display) &&
                    (n &&
                      a.options.layoutScroll &&
                      a.scroll &&
                      a !== a.root &&
                      (ts(e.x, -a.scroll.offset.x), ts(e.y, -a.scroll.offset.y)),
                    r && ((t.x *= r.x.scale), (t.y *= r.y.scale), tl(e, r)),
                    n && ti(a.latestValues) && tu(e, a.latestValues, a.layout?.layoutBox));
                }
                t.x < 1.0000000000001 && t.x > 0.999999999999 && (t.x = 1),
                  t.y < 1.0000000000001 && t.y > 0.999999999999 && (t.y = 1);
              }
            })(this.layoutCorrected, this.treeScale, this.path, t),
              e.layout &&
                !e.target &&
                (1 !== this.treeScale.x || 1 !== this.treeScale.y) &&
                ((e.target = e.layout.layoutBox), (e.targetWithTransforms = T()));
            const { target: s } = e;
            if (!s) {
              this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
              return;
            }
            this.projectionDelta && this.prevProjectionDelta
              ? (nV(this.prevProjectionDelta.x, this.projectionDelta.x),
                nV(this.prevProjectionDelta.y, this.projectionDelta.y))
              : this.createProjectionDeltas(),
              i1(this.projectionDelta, this.layoutCorrected, s, this.latestValues),
              (this.treeScale.x === r &&
                this.treeScale.y === l &&
                nX(this.projectionDelta.x, this.prevProjectionDelta.x) &&
                nX(this.projectionDelta.y, this.prevProjectionDelta.y)) ||
                ((this.hasProjected = !0),
                this.scheduleRender(),
                this.notifyListeners("projectionUpdate", s)),
              ep.Q.value && n0.calculatedProjections++;
          }
          hide() {
            this.isVisible = !1;
          }
          show() {
            this.isVisible = !0;
          }
          scheduleRender(e = !0) {
            if ((this.options.visualElement?.scheduleRender(), e)) {
              const e = this.getStack();
              e && e.scheduleRender();
            }
            this.resumingFrom && !this.resumingFrom.instance && (this.resumingFrom = void 0);
          }
          createProjectionDeltas() {
            (this.prevProjectionDelta = v()),
              (this.projectionDelta = v()),
              (this.projectionDeltaWithTransform = v());
          }
          setAnimationOrigin(e, t = !1) {
            let i,
              n = this.snapshot,
              a = n ? n.latestValues : {},
              r = { ...this.latestValues },
              l = v();
            (this.relativeParent && this.relativeParent.options.layoutRoot) ||
              (this.relativeTarget = this.relativeTargetOrigin = void 0),
              (this.attemptToResolveRelativeTarget = !t);
            const s = T(),
              o = (n ? n.source : void 0) !== (this.layout ? this.layout.source : void 0),
              d = this.getStack(),
              u = !d || d.members.length <= 1,
              c = !!(o && !u && !0 === this.options.crossfade && !this.path.some(am));
            (this.animationProgress = 0),
              (this.mixTargetDelta = (t) => {
                const n = t / 1e3;
                if (
                  (au(l.x, e.x, n),
                  au(l.y, e.y, n),
                  this.setTargetDelta(l),
                  this.relativeTarget &&
                    this.relativeTargetOrigin &&
                    this.layout &&
                    this.relativeParent &&
                    this.relativeParent.layout)
                ) {
                  var d, m, h, f, k, _;
                  i4(
                    s,
                    this.layout.layoutBox,
                    this.relativeParent.layout.layoutBox,
                    this.options.layoutAnchor || void 0,
                  ),
                    (h = this.relativeTarget),
                    (f = this.relativeTargetOrigin),
                    (k = s),
                    (_ = n),
                    ac(h.x, f.x, k.x, _),
                    ac(h.y, f.y, k.y, _),
                    i &&
                      ((d = this.relativeTarget), (m = i), nW(d.x, m.x) && nW(d.y, m.y)) &&
                      (this.isProjectionDirty = !1),
                    i || (i = T()),
                    nI(i, this.relativeTarget);
                }
                o &&
                  ((this.animationValues = r),
                  ((e, t, i, n, a, r) => {
                    a
                      ? ((e.opacity = (0, e5.k)(0, i.opacity ?? 1, nR(n))),
                        (e.opacityExit = (0, e5.k)(t.opacity ?? 1, 0, nM(n))))
                      : r && (e.opacity = (0, e5.k)(t.opacity ?? 1, i.opacity ?? 1, n));
                    for (let a = 0; a < nw; a++) {
                      let r = nE[a],
                        l = nC(t, r),
                        s = nC(i, r);
                      (void 0 !== l || void 0 !== s) &&
                        (l || (l = 0),
                        s || (s = 0),
                        0 === l || 0 === s || nA(l) === nA(s)
                          ? ((e[r] = Math.max((0, e5.k)(nO(l), nO(s), n), 0)),
                            (p.KN.test(s) || p.KN.test(l)) && (e[r] += "%"))
                          : (e[r] = s));
                    }
                    (t.rotate || i.rotate) &&
                      (e.rotate = (0, e5.k)(t.rotate || 0, i.rotate || 0, n));
                  })(r, a, this.latestValues, n, c, u)),
                  this.root.scheduleUpdateProjection(),
                  this.scheduleRender(),
                  (this.animationProgress = n);
              }),
              this.mixTargetDelta(1e3 * !!this.options.layoutRoot);
          }
          startAnimation(e) {
            this.notifyListeners("animationStart"),
              this.currentAnimation?.stop(),
              this.resumingFrom?.currentAnimation?.stop(),
              this.pendingAnimation &&
                ((0, z.WG)(this.pendingAnimation), (this.pendingAnimation = void 0)),
              (this.pendingAnimation = z.Gt.update(() => {
                (nP.hasAnimatedSinceResize = !0),
                  ef.layout++,
                  this.motionValue || (this.motionValue = (0, eS.OQ)(0)),
                  this.motionValue.jump(0, !1),
                  (this.currentAnimation = ((e, t, i) => {
                    const n = j(e) ? e : (0, eS.OQ)(e);
                    return n.start(iL("", n, t, i)), n.animation;
                  })(this.motionValue, [0, 1e3], {
                    ...e,
                    velocity: 0,
                    isSync: !0,
                    onUpdate: (t) => {
                      this.mixTargetDelta(t), e.onUpdate && e.onUpdate(t);
                    },
                    onStop: () => {
                      ef.layout--;
                    },
                    onComplete: () => {
                      ef.layout--, e.onComplete && e.onComplete(), this.completeAnimation();
                    },
                  })),
                  this.resumingFrom && (this.resumingFrom.currentAnimation = this.currentAnimation),
                  (this.pendingAnimation = void 0);
              }));
          }
          completeAnimation() {
            this.resumingFrom &&
              ((this.resumingFrom.currentAnimation = void 0),
              (this.resumingFrom.preserveOpacity = void 0));
            const e = this.getStack();
            e && e.exitAnimationComplete(),
              (this.resumingFrom = this.currentAnimation = this.animationValues = void 0),
              this.notifyListeners("animationComplete");
          }
          finishAnimation() {
            this.currentAnimation &&
              (this.mixTargetDelta && this.mixTargetDelta(1e3), this.currentAnimation.stop()),
              this.completeAnimation();
          }
          applyTransformsToTarget() {
            let e = this.getLead(),
              { targetWithTransforms: t, target: i, layout: n, latestValues: a } = e;
            if (t && i && n) {
              if (
                this !== e &&
                this.layout &&
                n &&
                a_(this.options.animationType, this.layout.layoutBox, n.layoutBox)
              ) {
                i = this.target || T();
                const t = iZ(this.layout.layoutBox.x);
                (i.x.min = e.target.x.min), (i.x.max = i.x.min + t);
                const n = iZ(this.layout.layoutBox.y);
                (i.y.min = e.target.y.min), (i.y.max = i.y.min + n);
              }
              nI(t, i), tu(t, a), i1(this.projectionDeltaWithTransform, this.layoutCorrected, t, a);
            }
          }
          registerSharedNode(e, t) {
            this.sharedNodes.has(e) || this.sharedNodes.set(e, new nQ()),
              this.sharedNodes.get(e).add(t);
            const i = t.options.initialPromotionConfig;
            t.promote({
              transition: i ? i.transition : void 0,
              preserveFollowOpacity:
                i && i.shouldPreserveFollowOpacity ? i.shouldPreserveFollowOpacity(t) : void 0,
            });
          }
          isLead() {
            const e = this.getStack();
            return !e || e.lead === this;
          }
          getLead() {
            const { layoutId: e } = this.options;
            return (e && this.getStack()?.lead) || this;
          }
          getPrevLead() {
            const { layoutId: e } = this.options;
            return e ? this.getStack()?.prevLead : void 0;
          }
          getStack() {
            const { layoutId: e } = this.options;
            if (e) return this.root.sharedNodes.get(e);
          }
          promote({ needsReset: e, transition: t, preserveFollowOpacity: i } = {}) {
            const n = this.getStack();
            n && n.promote(this, i),
              e && ((this.projectionDelta = void 0), (this.needsReset = !0)),
              t && this.setOptions({ transition: t });
          }
          relegate() {
            const e = this.getStack();
            return !!e && e.relegate(this);
          }
          resetSkewAndRotation() {
            const { visualElement: e } = this.options;
            if (!e) return;
            let t = !1,
              { latestValues: i } = e;
            if (
              ((i.z || i.rotate || i.rotateX || i.rotateY || i.rotateZ || i.skewX || i.skewY) &&
                (t = !0),
              !t)
            )
              return;
            const n = {};
            i.z && n5("z", e, n, this.animationValues);
            for (let t = 0; t < n1.length; t++)
              n5(`rotate${n1[t]}`, e, n, this.animationValues),
                n5(`skew${n1[t]}`, e, n, this.animationValues);
            for (const t in (e.render(), n))
              e.setStaticValue(t, n[t]), this.animationValues && (this.animationValues[t] = n[t]);
            e.scheduleRender();
          }
          applyProjectionStyles(e, t) {
            if (!this.instance || this.isSVG) return;
            if (!this.isVisible) {
              e.visibility = "hidden";
              return;
            }
            const i = this.getTransformTemplate();
            if (this.needsReset) {
              (this.needsReset = !1),
                (e.visibility = ""),
                (e.opacity = ""),
                (e.pointerEvents = tw(t?.pointerEvents) || ""),
                (e.transform = i ? i(this.latestValues, "") : "none");
              return;
            }
            const n = this.getLead();
            if (!this.projectionDelta || !this.layout || !n.target) {
              this.options.layoutId &&
                ((e.opacity = void 0 !== this.latestValues.opacity ? this.latestValues.opacity : 1),
                (e.pointerEvents = tw(t?.pointerEvents) || "")),
                this.hasProjected &&
                  !ti(this.latestValues) &&
                  ((e.transform = i ? i({}, "") : "none"), (this.hasProjected = !1));
              return;
            }
            e.visibility = "";
            const a = n.animationValues || n.latestValues;
            this.applyTransformsToTarget();
            let r = ((e, t, i) => {
              let n = "",
                a = e.x.translate / t.x,
                r = e.y.translate / t.y,
                l = i?.z || 0;
              if (
                ((a || r || l) && (n = `translate3d(${a}px, ${r}px, ${l}px) `),
                (1 !== t.x || 1 !== t.y) && (n += `scale(${1 / t.x}, ${1 / t.y}) `),
                i)
              ) {
                const {
                  transformPerspective: e,
                  rotate: t,
                  rotateX: a,
                  rotateY: r,
                  skewX: l,
                  skewY: s,
                } = i;
                e && (n = `perspective(${e}px) ${n}`),
                  t && (n += `rotate(${t}deg) `),
                  a && (n += `rotateX(${a}deg) `),
                  r && (n += `rotateY(${r}deg) `),
                  l && (n += `skewX(${l}deg) `),
                  s && (n += `skewY(${s}deg) `);
              }
              const s = e.x.scale * t.x,
                o = e.y.scale * t.y;
              return (1 !== s || 1 !== o) && (n += `scale(${s}, ${o})`), n || "none";
            })(this.projectionDeltaWithTransform, this.treeScale, a);
            i && (r = i(a, r)), (e.transform = r);
            const { x: l, y: s } = this.projectionDelta;
            for (const t in ((e.transformOrigin = `${100 * l.origin}% ${100 * s.origin}% 0`),
            n.animationValues
              ? (e.opacity =
                  n === this
                    ? (a.opacity ?? this.latestValues.opacity ?? 1)
                    : this.preserveOpacity
                      ? this.latestValues.opacity
                      : a.opacityExit)
              : (e.opacity =
                  n === this
                    ? void 0 !== a.opacity
                      ? a.opacity
                      : ""
                    : void 0 !== a.opacityExit
                      ? a.opacityExit
                      : 0),
            e4)) {
              if (void 0 === a[t]) continue;
              const { correct: i, applyTo: l, isCSSVariable: s } = e4[t],
                o = "none" === r ? a[t] : i(a[t], n);
              if (l) {
                const t = l.length;
                for (let i = 0; i < t; i++) e[l[i]] = o;
              } else s ? (this.options.visualElement.renderState.vars[t] = o) : (e[t] = o);
            }
            this.options.layoutId &&
              (e.pointerEvents = n === this ? tw(t?.pointerEvents) || "" : "none");
          }
          clearSnapshot() {
            this.resumeFrom = this.snapshot = void 0;
          }
          resetTree() {
            this.root.nodes.forEach((e) => e.currentAnimation?.stop()),
              this.root.nodes.forEach(ae),
              this.root.sharedNodes.clear();
          }
        };
      }
      function n6(e) {
        e.updateLayout();
      }
      function n3(e) {
        const t = e.resumeFrom?.snapshot || e.snapshot;
        if (e.isLead() && e.layout && t && e.hasListeners("didUpdate")) {
          const { layoutBox: i, measuredBox: n } = e.layout,
            { animationType: a } = e.options,
            r = t.source !== e.layout.source;
          if ("size" === a)
            iJ((e) => {
              const n = r ? t.measuredBox[e] : t.layoutBox[e],
                a = iZ(n);
              (n.min = i[e].min), (n.max = n.min + a);
            });
          else if ("x" === a || "y" === a) {
            const e = "x" === a ? "y" : "x";
            nG(r ? t.measuredBox[e] : t.layoutBox[e], i[e]);
          } else
            a_(a, t.layoutBox, i) &&
              iJ((n) => {
                const a = r ? t.measuredBox[n] : t.layoutBox[n],
                  l = iZ(i[n]);
                (a.max = a.min + l),
                  e.relativeTarget &&
                    !e.currentAnimation &&
                    ((e.isProjectionDirty = !0),
                    (e.relativeTarget[n].max = e.relativeTarget[n].min + l));
              });
          const l = v();
          i1(l, i, t.layoutBox);
          const s = v();
          r ? i1(s, e.applyTransform(n, !0), t.measuredBox) : i1(s, i, t.layoutBox);
          let o = !n$(l),
            d = !1;
          if (!e.resumeFrom) {
            const n = e.getClosestProjectingParent();
            if (n && !n.resumeFrom) {
              const { snapshot: a, layout: r } = n;
              if (a && r) {
                const l = e.options.layoutAnchor || void 0,
                  s = T();
                i4(s, t.layoutBox, a.layoutBox, l);
                const o = T();
                i4(o, i, r.layoutBox, l),
                  nz(s, o) || (d = !0),
                  n.options.layoutRoot &&
                    ((e.relativeTarget = o), (e.relativeTargetOrigin = s), (e.relativeParent = n));
              }
            }
          }
          e.notifyListeners("didUpdate", {
            layout: i,
            snapshot: t,
            delta: s,
            layoutDelta: l,
            hasLayoutChanged: o,
            hasRelativeLayoutChanged: d,
          });
        } else if (e.isLead()) {
          const { onExitComplete: t } = e.options;
          t && t();
        }
        e.options.transition = void 0;
      }
      function n9(e) {
        ep.Q.value && n0.nodes++,
          e.parent &&
            (e.isProjecting() || (e.isProjectionDirty = e.parent.isProjectionDirty),
            e.isSharedProjectionDirty ||
              (e.isSharedProjectionDirty = !!(
                e.isProjectionDirty ||
                e.parent.isProjectionDirty ||
                e.parent.isSharedProjectionDirty
              )),
            e.isTransformDirty || (e.isTransformDirty = e.parent.isTransformDirty));
      }
      function n7(e) {
        e.isProjectionDirty = e.isSharedProjectionDirty = e.isTransformDirty = !1;
      }
      function n8(e) {
        e.clearSnapshot();
      }
      function ae(e) {
        e.clearMeasurements();
      }
      function at(e) {
        (e.isLayoutDirty = !0), e.updateLayout();
      }
      function ai(e) {
        e.isLayoutDirty = !1;
      }
      function an(e) {
        e.isAnimationBlocked &&
          e.layout &&
          !e.isLayoutDirty &&
          ((e.snapshot = e.layout), (e.isLayoutDirty = !0));
      }
      function aa(e) {
        const { visualElement: t } = e.options;
        t && t.getProps().onBeforeLayoutMeasure && t.notify("BeforeLayoutMeasure"),
          e.resetTransform();
      }
      function ar(e) {
        e.finishAnimation(),
          (e.targetDelta = e.relativeTarget = e.target = void 0),
          (e.isProjectionDirty = !0);
      }
      function al(e) {
        e.resolveTargetDelta();
      }
      function as(e) {
        e.calcProjection();
      }
      function ao(e) {
        e.resetSkewAndRotation();
      }
      function ad(e) {
        e.removeLeadSnapshot();
      }
      function au(e, t, i) {
        (e.translate = (0, e5.k)(t.translate, 0, i)),
          (e.scale = (0, e5.k)(t.scale, 1, i)),
          (e.origin = t.origin),
          (e.originPoint = t.originPoint);
      }
      function ac(e, t, i, n) {
        (e.min = (0, e5.k)(t.min, i.min, n)), (e.max = (0, e5.k)(t.max, i.max, n));
      }
      function am(e) {
        return e.animationValues && void 0 !== e.animationValues.opacityExit;
      }
      const ah = { duration: 0.45, ease: [0.4, 0, 0.1, 1] },
        af = (e) =>
          "undefined" != typeof navigator &&
          navigator.userAgent &&
          navigator.userAgent.toLowerCase().includes(e),
        ap = af("applewebkit/") && !af("chrome/") ? Math.round : eo.l;
      function ak(e) {
        (e.min = ap(e.min)), (e.max = ap(e.max));
      }
      function a_(e, t, i) {
        return "position" === e || ("preserve-aspect" === e && !(0.2 >= Math.abs(nK(t) - nK(i))));
      }
      function ab(e) {
        return e !== e.root && e.scroll?.wasRoot;
      }
      const ag = n4({
          attachResizeListener: (e, t) => i9(e, "resize", t),
          measureScroll: () => ({
            x: document.documentElement.scrollLeft || document.body?.scrollLeft || 0,
            y: document.documentElement.scrollTop || document.body?.scrollTop || 0,
          }),
          checkIsScrollRoot: () => !0,
        }),
        ay = { current: void 0 },
        av = n4({
          measureScroll: (e) => ({ x: e.scrollLeft, y: e.scrollTop }),
          defaultParent: () => {
            if (!ay.current) {
              const e = new ag({});
              e.mount(window), e.setOptions({ layoutScroll: !0 }), (ay.current = e);
            }
            return ay.current;
          },
          resetTransform: (e, t) => {
            e.style.transform = void 0 !== t ? t : "none";
          },
          checkIsScrollRoot: (e) => "fixed" === window.getComputedStyle(e).position,
        });
      var aP = i(3437);
      function aT(e, t) {
        const i = (0, aP.K)(e),
          n = new AbortController();
        return [i, { passive: !0, ...t, signal: n.signal }, () => n.abort()];
      }
      function aj(e, t, i) {
        const { props: n } = e;
        e.animationState && n.whileHover && e.animationState.setActive("whileHover", "Start" === i);
        const a = n["onHover" + i];
        a && z.Gt.postRender(() => a(t, ne(t)));
      }
      class ax extends tU {
        mount() {
          const { current: e } = this.node;
          e &&
            (this.unmount = ((e, t, i = {}) => {
              const [n, a, r] = aT(e, i);
              return (
                n.forEach((e) => {
                  let i,
                    n = !1,
                    r = !1,
                    l = (t) => {
                      i && (i(t), (i = void 0)), e.removeEventListener("pointerleave", o);
                    },
                    s = (e) => {
                      (n = !1),
                        window.removeEventListener("pointerup", s),
                        window.removeEventListener("pointercancel", s),
                        r && ((r = !1), l(e));
                    },
                    o = (e) => {
                      if ("touch" !== e.pointerType) {
                        if (n) {
                          r = !0;
                          return;
                        }
                        l(e);
                      }
                    };
                  e.addEventListener(
                    "pointerenter",
                    (n) => {
                      if ("touch" === n.pointerType || iQ.x || iQ.y) return;
                      r = !1;
                      const l = t(e, n);
                      "function" == typeof l && ((i = l), e.addEventListener("pointerleave", o, a));
                    },
                    a,
                  ),
                    e.addEventListener(
                      "pointerdown",
                      () => {
                        (n = !0),
                          window.addEventListener("pointerup", s, a),
                          window.addEventListener("pointercancel", s, a);
                      },
                      a,
                    );
                }),
                r
              );
            })(e, (e, t) => (aj(this.node, t, "Start"), (e) => aj(this.node, e, "End"))));
        }
        unmount() {}
      }
      class aS extends tU {
        constructor() {
          super(...arguments), (this.isActive = !1);
        }
        onFocus() {
          let e = !1;
          try {
            e = this.node.current.matches(":focus-visible");
          } catch (t) {
            e = !0;
          }
          e &&
            this.node.animationState &&
            (this.node.animationState.setActive("whileFocus", !0), (this.isActive = !0));
        }
        onBlur() {
          this.isActive &&
            this.node.animationState &&
            (this.node.animationState.setActive("whileFocus", !1), (this.isActive = !1));
        }
        mount() {
          this.unmount = (0, tY.F)(
            i9(this.node.current, "focus", () => this.onFocus()),
            i9(this.node.current, "blur", () => this.onBlur()),
          );
        }
        unmount() {}
      }
      var aE = i(2950);
      const aw = (e, t) => !!t && (e === t || aw(e, t.parentElement)),
        aO = new WeakSet();
      function aA(e) {
        return (t) => {
          "Enter" === t.key && e(t);
        };
      }
      function aC(e, t) {
        e.dispatchEvent(new PointerEvent("pointer" + t, { isPrimary: !0, bubbles: !0 }));
      }
      function aR(e) {
        return i8(e) && !(iQ.x || iQ.y);
      }
      const aM = new WeakSet();
      function aD(e, t, i) {
        const { props: n } = e;
        if (e.current instanceof HTMLButtonElement && e.current.disabled) return;
        e.animationState && n.whileTap && e.animationState.setActive("whileTap", "Start" === i);
        const a = n["onTap" + ("End" === i ? "" : i)];
        a && z.Gt.postRender(() => a(t, ne(t)));
      }
      class aG extends tU {
        mount() {
          const { current: e } = this.node;
          if (!e) return;
          const { globalTapTarget: t, propagate: i } = this.node.props;
          this.unmount = ((e, t, i = {}) => {
            const [n, a, r] = aT(e, i),
              l = (e) => {
                const n = e.currentTarget;
                if (!aR(e) || aM.has(e)) return;
                aO.add(n), i.stopPropagation && aM.add(e);
                const r = t(n, e),
                  l = (e, t) => {
                    window.removeEventListener("pointerup", s),
                      window.removeEventListener("pointercancel", o),
                      aO.has(n) && aO.delete(n),
                      aR(e) && "function" == typeof r && r(e, { success: t });
                  },
                  s = (e) => {
                    l(e, n === window || n === document || i.useGlobalTarget || aw(n, e.target));
                  },
                  o = (e) => {
                    l(e, !1);
                  };
                window.addEventListener("pointerup", s, a),
                  window.addEventListener("pointercancel", o, a);
              };
            return (
              n.forEach((e) => {
                ((i.useGlobalTarget ? window : e).addEventListener("pointerdown", l, a),
                (0, aE.s)(e)) &&
                  (e.addEventListener("focus", (e) =>
                    ((e, t) => {
                      const i = e.currentTarget;
                      if (!i) return;
                      const n = aA(() => {
                        if (aO.has(i)) return;
                        aC(i, "down");
                        const e = aA(() => {
                          aC(i, "up");
                        });
                        i.addEventListener("keyup", e, t),
                          i.addEventListener("blur", () => aC(i, "cancel"), t);
                      });
                      i.addEventListener("keydown", n, t),
                        i.addEventListener("blur", () => i.removeEventListener("keydown", n), t);
                    })(e, a),
                  ),
                  i6.has(e.tagName) ||
                    !0 === e.isContentEditable ||
                    e.hasAttribute("tabindex") ||
                    (e.tabIndex = 0));
              }),
              r
            );
          })(
            e,
            (e, t) => (
              aD(this.node, t, "Start"),
              (e, { success: t }) => aD(this.node, e, t ? "End" : "Cancel")
            ),
            { useGlobalTarget: t, stopPropagation: i?.tap === !1 },
          );
        }
        unmount() {}
      }
      const aI = new WeakMap(),
        aV = new WeakMap(),
        aL = (e) => {
          const t = aI.get(e.target);
          t && t(e);
        },
        aq = (e) => {
          e.forEach(aL);
        },
        aN = { some: 0, all: 1 };
      class aF extends tU {
        constructor() {
          super(...arguments), (this.hasEnteredView = !1), (this.isInView = !1);
        }
        startObserver() {
          this.stopObserver?.();
          const { viewport: e = {} } = this.node.getProps(),
            { root: t, margin: i, amount: n = "some", once: a } = e,
            r = {
              root: t ? t.current : void 0,
              rootMargin: i,
              threshold: "number" == typeof n ? n : aN[n],
            },
            l = (e) => {
              const { isIntersecting: t } = e;
              if (this.isInView === t || ((this.isInView = t), a && !t && this.hasEnteredView))
                return;
              t && (this.hasEnteredView = !0),
                this.node.animationState && this.node.animationState.setActive("whileInView", t);
              const { onViewportEnter: i, onViewportLeave: n } = this.node.getProps(),
                r = t ? i : n;
              r && r(e);
            };
          this.stopObserver = ((e, t, i) => {
            const n = (({ root: e, ...t }) => {
              const i = e || document;
              aV.has(i) || aV.set(i, {});
              const n = aV.get(i),
                a = JSON.stringify(t);
              return n[a] || (n[a] = new IntersectionObserver(aq, { root: e, ...t })), n[a];
            })(t);
            return (
              aI.set(e, i),
              n.observe(e),
              () => {
                aI.delete(e), n.unobserve(e);
              }
            );
          })(this.node.current, r, l);
        }
        mount() {
          this.startObserver();
        }
        update() {
          if ("undefined" == typeof IntersectionObserver) return;
          const { props: e, prevProps: t } = this.node;
          ["amount", "margin", "root"].some(
            (
              ({ viewport: e = {} }, { viewport: t = {} } = {}) =>
              (i) =>
                e[i] !== t[i]
            )(e, t),
          ) && this.startObserver();
        }
        unmount() {
          this.stopObserver?.(), (this.hasEnteredView = !1), (this.isInView = !1);
        }
      }
      const aB = ((e, t) => {
        if ("undefined" == typeof Proxy) return tB;
        const i = new Map(),
          n = (i, n) => tB(i, n, e, t);
        return new Proxy((e, t) => n(e, t), {
          get: (a, r) =>
            "create" === r ? n : (i.has(r) || i.set(r, tB(r, void 0, e, t)), i.get(r)),
        });
      })(
        {
          animation: { Feature: iK },
          exit: { Feature: iY },
          inView: { Feature: aF },
          tap: { Feature: aG },
          focus: { Feature: aS },
          hover: { Feature: ax },
          pan: { Feature: nv },
          drag: { Feature: ng, ProjectionNode: av, MeasureLayout: nx },
          layout: { ProjectionNode: av, MeasureLayout: nx },
        },
        (e, t) =>
          (t.isSVG ?? tp(e)) ? new e7(t) : new tm(t, { allowProjection: e !== th.Fragment }),
      );
    },
    1211: (e, t, i) => {
      i.d(t, { F: () => a });
      const n = (e, t) => (i) => t(e(i)),
        a = (...e) => e.reduce(n);
    },
    1553: (e, t, i) => {
      i.d(t, { A: () => n });
      const n = (0, i(7690).A)("file-pen-line", [
        [
          "path",
          {
            d: "M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z",
            key: "ukzhwg",
          },
        ],
        ["path", { d: "M14.487 7.858A1 1 0 0 1 14 7V2", key: "1klhew" }],
        [
          "path",
          {
            d: "M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516",
            key: "rxaxab",
          },
        ],
        ["path", { d: "M8 18h1", key: "13wk12" }],
      ]);
    },
    1711: (e, t, i) => {
      i.d(t, { E: () => a });
      var n = i(4260);
      const a = "undefined" != typeof window ? n.useLayoutEffect : n.useEffect;
    },
    1777: (e, t, i) => {
      i.d(t, { W: () => l });
      var n = i(4260),
        a = i(3437);
      const r = { some: 0, all: 1 };
      function l(e) {
        const {
            root: t,
            margin: i,
            amount: l,
            once: s = !1,
            initial: o = !1,
          } = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
          [d, u] = (0, n.useState)(o);
        return (
          (0, n.useEffect)(() => {
            if (!e.current || (s && d)) return;
            const n = { root: (t && t.current) || void 0, margin: i, amount: l };
            return ((e, t, { root: i, margin: n, amount: l = "some" } = {}) => {
              const s = (0, a.K)(e),
                o = new WeakMap(),
                d = new IntersectionObserver(
                  (e) => {
                    e.forEach((e) => {
                      const i = o.get(e.target);
                      if (!!i !== e.isIntersecting)
                        if (e.isIntersecting) {
                          const i = t(e.target, e);
                          "function" == typeof i ? o.set(e.target, i) : d.unobserve(e.target);
                        } else "function" == typeof i && (i(e), o.delete(e.target));
                    });
                  },
                  { root: i, rootMargin: n, threshold: "number" == typeof l ? l : r[l] },
                );
              return s.forEach((e) => d.observe(e)), () => d.disconnect();
            })(e.current, () => (u(!0), s ? void 0 : () => u(!1)), n);
          }, [t, e, i, s, l]),
          d
        );
      }
    },
    2130: (e, t, i) => {
      i.d(t, { A: () => n });
      const n = (0, i(7690).A)("arrow-right", [
        ["path", { d: "M5 12h14", key: "1ays0h" }],
        ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }],
      ]);
    },
    2140: (e, t, i) => {
      i.d(t, { A: () => n });
      const n = (0, i(7690).A)("receipt", [
        ["path", { d: "M12 17V7", key: "pyj7ub" }],
        ["path", { d: "M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8", key: "1elt7d" }],
        [
          "path",
          {
            d: "M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",
            key: "ycz6yz",
          },
        ],
      ]);
    },
    2230: (e, t, i) => {
      i.d(t, { A: () => n });
      const n = (0, i(7690).A)("user-plus", [
        ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
        ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
        ["line", { x1: "19", x2: "19", y1: "8", y2: "14", key: "1bvyxn" }],
        ["line", { x1: "22", x2: "16", y1: "11", y2: "11", key: "1shjgl" }],
      ]);
    },
    2656: (e, t, i) => {
      i.d(t, { Z: () => r });
      var n = i(62),
        a = i(4117);
      function r(e) {
        const t = [0];
        return (
          !((e, t) => {
            const i = e[e.length - 1];
            for (let r = 1; r <= t; r++) {
              const l = (0, n.q)(0, t, r);
              e.push((0, a.k)(i, 1, l));
            }
          })(t, e.length - 1),
          t
        );
      }
    },
    2727: (e, t, i) => {
      i.d(t, { J: () => a, d: () => r });
      var n = i(3223);
      const a = (0, n.J)(() => void 0 !== window.ScrollTimeline, "scrollTimeline"),
        r = (0, n.J)(() => void 0 !== window.ViewTimeline, "viewTimeline");
    },
    2950: (e, t, i) => {
      i.d(t, { s: () => a });
      var n = i(8811);
      function a(e) {
        return (0, n.G)(e) && "offsetHeight" in e && !("ownerSVGElement" in e);
      }
    },
    3223: (e, t, i) => {
      i.d(t, { J: () => r });
      var n = i(5577);
      const a = {};
      function r(e, t) {
        const i = (0, n.p)(e);
        return () => a[t] ?? i();
      }
    },
    3342: (e, t, i) => {
      i.d(t, { I: () => l });
      var n = i(4539),
        a = i(860),
        r = i(4260);
      function l() {
        n.r.current || (0, a.Uu)();
        const [e] = (0, r.useState)(n.O.current);
        return e;
      }
    },
    3437: (e, t, i) => {
      i.d(t, { K: () => n });
      function n(e, t, i) {
        if (null == e) return [];
        if (e instanceof EventTarget) return [e];
        if ("string" == typeof e) {
          let n = document;
          t && (n = t.current);
          const a = i?.[e] ?? n.querySelectorAll(e);
          return a ? Array.from(a) : [];
        }
        return Array.from(e).filter((e) => null != e);
      }
    },
    4075: (e, t, i) => {
      i.d(t, { j: () => j });
      var n = i(1211),
        a = i(6826),
        r = i(6883),
        l = i(8961),
        s = i(9142),
        o = i(9458),
        d = i(4259);
      function u(e, t, i) {
        return (i < 0 && (i += 1), i > 1 && (i -= 1), i < 1 / 6)
          ? e + (t - e) * 6 * i
          : i < 0.5
            ? t
            : i < 2 / 3
              ? e + (t - e) * (2 / 3 - i) * 6
              : e;
      }
      var c = i(7751);
      function m(e, t) {
        return (i) => (i > 0 ? t : e);
      }
      var h = i(4117);
      const f = (e, t, i) => {
          const n = e * e,
            a = i * (t * t - n) + n;
          return a < 0 ? 0 : Math.sqrt(a);
        },
        p = [o.u, c.B, d.V];
      function k(e) {
        const t = p.find((t) => t.test(e));
        if (
          ((0, a.$)(
            !!t,
            `'${e}' is not an animatable color. Use the equivalent color code instead.`,
            "color-not-animatable",
          ),
          !t)
        )
          return !1;
        let i = t.parse(e);
        return (
          t === d.V &&
            (i = (({ hue: e, saturation: t, lightness: i, alpha: n }) => {
              (e /= 360), (i /= 100);
              let a = 0,
                r = 0,
                l = 0;
              if ((t /= 100)) {
                const n = i < 0.5 ? i * (1 + t) : i + t - i * t,
                  s = 2 * i - n;
                (a = u(s, n, e + 1 / 3)), (r = u(s, n, e)), (l = u(s, n, e - 1 / 3));
              } else a = r = l = i;
              return {
                red: Math.round(255 * a),
                green: Math.round(255 * r),
                blue: Math.round(255 * l),
                alpha: n,
              };
            })(i)),
          i
        );
      }
      const _ = (e, t) => {
          const i = k(e),
            n = k(t);
          if (!i || !n) return m(e, t);
          const a = { ...i };
          return (e) => (
            (a.red = f(i.red, n.red, e)),
            (a.green = f(i.green, n.green, e)),
            (a.blue = f(i.blue, n.blue, e)),
            (a.alpha = (0, h.k)(i.alpha, n.alpha, e)),
            c.B.transform(a)
          );
        },
        b = new Set(["none", "hidden"]);
      function g(e, t) {
        return (i) => (0, h.k)(e, t, i);
      }
      function y(e) {
        return "number" == typeof e
          ? g
          : "string" == typeof e
            ? (0, r.pG)(e)
              ? m
              : l.y.test(e)
                ? _
                : T
            : Array.isArray(e)
              ? v
              : "object" == typeof e
                ? l.y.test(e)
                  ? _
                  : P
                : m;
      }
      function v(e, t) {
        const i = [...e],
          n = i.length,
          a = e.map((e, i) => y(e)(e, t[i]));
        return (e) => {
          for (let t = 0; t < n; t++) i[t] = a[t](e);
          return i;
        };
      }
      function P(e, t) {
        const i = { ...e, ...t },
          n = {};
        for (const a in i) void 0 !== e[a] && void 0 !== t[a] && (n[a] = y(e[a])(e[a], t[a]));
        return (e) => {
          for (const t in n) i[t] = n[t](e);
          return i;
        };
      }
      const T = (e, t) => {
        const i = s.f.createTransformer(t),
          r = (0, s.V)(e),
          l = (0, s.V)(t);
        return r.indexes.var.length === l.indexes.var.length &&
          r.indexes.color.length === l.indexes.color.length &&
          r.indexes.number.length >= l.indexes.number.length
          ? (b.has(e) && !l.values.length) || (b.has(t) && !r.values.length)
            ? ((e, t) => (b.has(e) ? (i) => (i <= 0 ? e : t) : (i) => (i >= 1 ? t : e)))(e, t)
            : (0, n.F)(
                v(
                  ((e, t) => {
                    const i = [],
                      n = { color: 0, var: 0, number: 0 };
                    for (let a = 0; a < t.values.length; a++) {
                      const r = t.types[a],
                        l = e.indexes[r][n[r]],
                        s = e.values[l] ?? 0;
                      (i[a] = s), n[r]++;
                    }
                    return i;
                  })(r, l),
                  l.values,
                ),
                i,
              )
          : ((0, a.$)(
              !0,
              `Complex values '${e}' and '${t}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`,
              "complex-values-different",
            ),
            m(e, t));
      };
      function j(e, t, i) {
        return "number" == typeof e && "number" == typeof t && "number" == typeof i
          ? (0, h.k)(e, t, i)
          : y(e)(e, t);
      }
    },
    4117: (e, t, i) => {
      i.d(t, { k: () => n });
      const n = (e, t, i) => e + (t - e) * i;
    },
    4247: (e, t, i) => {
      i.d(t, { Q: () => n });
      const n = { value: null, addProjectionMetrics: null };
    },
    4259: (e, t, i) => {
      i.d(t, { V: () => s });
      var n = i(8474),
        a = i(6191),
        r = i(9146),
        l = i(9052);
      const s = {
        test: (0, l.$)("hsl", "hue"),
        parse: (0, l.q)("hue", "saturation", "lightness"),
        transform: ({ hue: e, saturation: t, lightness: i, alpha: l = 1 }) =>
          "hsla(" +
          Math.round(e) +
          ", " +
          a.KN.transform((0, r.a)(t)) +
          ", " +
          a.KN.transform((0, r.a)(i)) +
          ", " +
          (0, r.a)(n.X4.transform(l)) +
          ")",
      };
    },
    4539: (e, t, i) => {
      i.d(t, { O: () => n, r: () => a });
      const n = { current: null },
        a = { current: !1 };
    },
    4586: (e, t, i) => {
      i.d(t, { L: () => a });
      var n = i(4260);
      function a(e, t, i) {
        (0, n.useInsertionEffect)(() => e.on(t, i), [e, t, i]);
      }
    },
    4959: (e, t, i) => {
      i.d(t, { f: () => n });
      function n(e, t) {
        return t ? (1e3 / t) * e : 0;
      }
    },
    5316: (e, t, i) => {
      var n = {};
      i.r(n),
        i.d(n, {
          RateLimitError: () => ee,
          StripeAPIError: () => N,
          StripeAuthenticationError: () => F,
          StripeCardError: () => L,
          StripeConnectionError: () => $,
          StripeError: () => V,
          StripeIdempotencyError: () => H,
          StripeInvalidClientError: () => X,
          StripeInvalidGrantError: () => K,
          StripeInvalidRequestError: () => q,
          StripeInvalidScopeError: () => Q,
          StripeOAuthError: () => z,
          StripeOAuthInvalidRequestError: () => Y,
          StripePermissionError: () => B,
          StripeRateLimitError: () => U,
          StripeSignatureVerificationError: () => W,
          StripeUnsupportedGrantTypeError: () => J,
          StripeUnsupportedResponseTypeError: () => Z,
          TemporarySessionExpiredError: () => et,
          generateOAuthError: () => G,
          generateV1Error: () => D,
          generateV2Error: () => I,
        });
      var a = {};
      i.r(a),
        i.d(a, {
          Account: () => i4,
          AccountLinks: () => i3,
          AccountSessions: () => i7,
          Accounts: () => i4,
          ApplePayDomains: () => ne,
          ApplicationFees: () => ni,
          Apps: () => aB,
          Balance: () => na,
          BalanceSettings: () => nl,
          BalanceTransactions: () => no,
          Billing: () => aU,
          BillingPortal: () => a$,
          Charges: () => nu,
          Checkout: () => aW,
          Climate: () => aH,
          ConfirmationTokens: () => nm,
          CountrySpecs: () => nf,
          Coupons: () => nk,
          CreditNotes: () => nb,
          CustomerSessions: () => ny,
          Customers: () => nP,
          Disputes: () => nj,
          Entitlements: () => az,
          EphemeralKeys: () => nS,
          Events: () => nw,
          ExchangeRates: () => nA,
          FileLinks: () => nR,
          Files: () => nD,
          FinancialConnections: () => aK,
          Forwarding: () => aX,
          Identity: () => aY,
          InvoiceItems: () => nI,
          InvoicePayments: () => nL,
          InvoiceRenderingTemplates: () => nN,
          Invoices: () => nB,
          Issuing: () => aQ,
          Mandates: () => n$,
          OAuth: () => nz,
          PaymentAttemptRecords: () => nX,
          PaymentIntents: () => nQ,
          PaymentLinks: () => nZ,
          PaymentMethodConfigurations: () => n1,
          PaymentMethodDomains: () => n5,
          PaymentMethods: () => n6,
          PaymentRecords: () => n9,
          Payouts: () => n8,
          Plans: () => at,
          Prices: () => an,
          Products: () => ar,
          PromotionCodes: () => as,
          Quotes: () => ad,
          Radar: () => aJ,
          Refunds: () => ac,
          Reporting: () => aZ,
          Reviews: () => ah,
          SetupAttempts: () => ap,
          SetupIntents: () => a_,
          ShippingRates: () => ag,
          Sigma: () => a0,
          Sources: () => av,
          SubscriptionItems: () => aT,
          SubscriptionSchedules: () => ax,
          Subscriptions: () => aE,
          Tax: () => a1,
          TaxCodes: () => aO,
          TaxIds: () => aC,
          TaxRates: () => aM,
          Terminal: () => a2,
          TestHelpers: () => a5,
          Tokens: () => aG,
          Topups: () => aV,
          Transfers: () => aq,
          Treasury: () => a4,
          V2: () => a6,
          WebhookEndpoints: () => aF,
        });
      var r = i(7923);
      const l = [
        "apiKey",
        "idempotencyKey",
        "stripeAccount",
        "apiVersion",
        "maxNetworkRetries",
        "timeout",
        "host",
        "authenticator",
        "stripeContext",
        "headers",
        "additionalHeaders",
        "streaming",
      ];
      function s(e) {
        return e && "object" == typeof e && l.some((t) => Object.hasOwn(e, t));
      }
      function o(e) {
        return encodeURIComponent(e)
          .replace(/!/g, "%21")
          .replace(/\*/g, "%2A")
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")
          .replace(/'/g, "%27")
          .replace(/%5B/g, "[")
          .replace(/%5D/g, "]");
      }
      function d(e) {
        const t = [];
        if ("object" == typeof e && null !== e)
          for (const i of Object.keys(e))
            !(function e(i, n) {
              if (void 0 !== n) {
                if (null === n || "object" != typeof n || n instanceof Date)
                  return void t.push(
                    o(i) +
                      "=" +
                      o(
                        n instanceof Date
                          ? Math.floor(n.getTime() / 1e3).toString()
                          : null === n
                            ? ""
                            : String(n),
                      ),
                  );
                if (Array.isArray(n)) {
                  for (let t = 0; t < n.length; t++) void 0 !== n[t] && e(i + "[" + t + "]", n[t]);
                  return;
                }
                for (const t of Object.keys(n)) e(i + "[" + t + "]", n[t]);
              }
            })(i, e[i]);
        return t.join("&");
      }
      const u = (() => {
        const e = { "\n": "\\n", '"': '\\"', "\u2028": "\\u2028", "\u2029": "\\u2029" };
        return (t) => {
          const i = t.replace(/["\n\r\u2028\u2029]/g, (t) => e[t]);
          return (e) =>
            i.replace(/\{([\s\S]+?)\}/g, (t, i) => {
              const n = e[i];
              return ["number", "string", "boolean"].includes(typeof n)
                ? encodeURIComponent(n)
                : "";
            });
        };
      })();
      function c(e) {
        if (!Array.isArray(e) || !e[0] || "object" != typeof e[0]) return {};
        if (!s(e[0])) return e.shift();
        const t = Object.keys(e[0]),
          i = t.filter((e) => l.includes(e));
        return (
          i.length > 0 &&
            i.length !== t.length &&
            p(
              `Options found in arguments (${i.join(", ")}). Did you mean to pass an options object? See https://github.com/stripe/stripe-node/wiki/Passing-Options.`,
            ),
          {}
        );
      }
      function m(e) {
        const t = { host: null, headers: {}, settings: {}, streaming: !1 };
        if (e.length > 0) {
          const i = e[e.length - 1];
          if ("string" == typeof i) t.authenticator = b(e.pop());
          else if (s(i)) {
            const i = { ...e.pop() },
              n = Object.keys(i).filter((e) => !l.includes(e));
            if (
              (n.length && p(`Invalid options found (${n.join(", ")}); ignoring.`),
              i.apiKey && (t.authenticator = b(i.apiKey)),
              i.idempotencyKey && (t.headers["Idempotency-Key"] = i.idempotencyKey),
              i.stripeAccount && (t.headers["Stripe-Account"] = i.stripeAccount),
              i.stripeContext)
            ) {
              if (t.headers["Stripe-Account"])
                throw Error("Can't specify both stripeAccount and stripeContext.");
              t.headers["Stripe-Context"] = i.stripeContext;
            }
            if (
              (i.apiVersion && (t.headers["Stripe-Version"] = i.apiVersion),
              Number.isInteger(i.maxNetworkRetries) &&
                (t.settings.maxNetworkRetries = i.maxNetworkRetries),
              Number.isInteger(i.timeout) && (t.settings.timeout = i.timeout),
              i.host && (t.host = i.host),
              i.authenticator)
            ) {
              if (i.apiKey) throw Error("Can't specify both apiKey and authenticator.");
              if ("function" != typeof i.authenticator)
                throw Error(
                  "The authenticator must be a function receiving a request as the first parameter.",
                );
              t.authenticator = i.authenticator;
            }
            i.headers && Object.assign(t.headers, i.headers),
              i.additionalHeaders && Object.assign(t.headers, i.additionalHeaders),
              i.streaming && (t.streaming = !0);
          }
        }
        return t;
      }
      function h(e) {
        if ("object" != typeof e) throw Error("Argument must be an object");
        return Object.keys(e).reduce((t, i) => (null != e[i] && (t[i] = e[i]), t), {});
      }
      function f(e, t) {
        return t
          ? e.then(
              (e) => {
                setTimeout(() => {
                  t(null, e);
                }, 0);
              },
              (e) => {
                setTimeout(() => {
                  t(e, null);
                }, 0);
              },
            )
          : e;
      }
      function p(e) {
        return "function" != typeof r.emitWarning
          ? console.warn(`Stripe: ${e}`)
          : r.emitWarning(e, "Stripe");
      }
      function k(e, t, i) {
        if (!Number.isInteger(t))
          if (void 0 !== i) return i;
          else throw Error(`${e} must be an integer`);
        return t;
      }
      const _ = [
        ["ANTIGRAVITY_CLI_ALIAS", "antigravity"],
        ["CLAUDECODE", "claude_code"],
        ["CLINE_ACTIVE", "cline"],
        ["CODEX_SANDBOX", "codex_cli"],
        ["CODEX_THREAD_ID", "codex_cli"],
        ["CODEX_SANDBOX_NETWORK_DISABLED", "codex_cli"],
        ["CODEX_CI", "codex_cli"],
        ["CURSOR_AGENT", "cursor"],
        ["GEMINI_CLI", "gemini_cli"],
        ["OPENCLAW_SHELL", "openclaw"],
        ["OPENCODE", "open_code"],
      ];
      function b(e) {
        const t = (t) => ((t.headers.Authorization = "Bearer " + e), Promise.resolve());
        return (t._apiKey = e), t;
      }
      function g(e, t) {
        return this[e] instanceof Date ? Math.floor(this[e].getTime() / 1e3).toString() : t;
      }
      function y(e) {
        return e && e.startsWith("/v2") ? "v2" : "v1";
      }
      function v(e) {
        return Array.isArray(e) ? e.join(", ") : String(e);
      }
      class P {
        getClientName() {
          throw Error("getClientName not implemented.");
        }
        makeRequest(e, t, i, n, a, r, l, s) {
          throw Error("makeRequest not implemented.");
        }
        static makeTimeoutError() {
          const e = TypeError(P.TIMEOUT_ERROR_CODE);
          return (e.code = P.TIMEOUT_ERROR_CODE), e;
        }
      }
      (P.CONNECTION_CLOSED_ERROR_CODES = ["ECONNRESET", "EPIPE"]),
        (P.TIMEOUT_ERROR_CODE = "ETIMEDOUT");
      class T {
        constructor(e, t) {
          (this._statusCode = e), (this._headers = t);
        }
        getStatusCode() {
          return this._statusCode;
        }
        getHeaders() {
          return this._headers;
        }
        getRawResponse() {
          throw Error("getRawResponse not implemented.");
        }
        toStream(e) {
          throw Error("toStream not implemented.");
        }
        toJSON() {
          throw Error("toJSON not implemented.");
        }
      }
      class j extends P {
        constructor(e) {
          if ((super(), !e)) {
            if (!globalThis.fetch)
              throw Error(
                "fetch() function not provided and is not defined in the global scope. You must provide a fetch implementation.",
              );
            e = globalThis.fetch;
          }
          globalThis.AbortController
            ? (this._fetchFn = j.makeFetchWithAbortTimeout(e))
            : (this._fetchFn = j.makeFetchWithRaceTimeout(e));
        }
        static makeFetchWithRaceTimeout(e) {
          return (t, i, n) => {
            let a,
              r = new Promise((e, t) => {
                a = setTimeout(() => {
                  (a = null), t(P.makeTimeoutError());
                }, n);
              });
            return Promise.race([e(t, i), r]).finally(() => {
              a && clearTimeout(a);
            });
          };
        }
        static makeFetchWithAbortTimeout(e) {
          return async (t, i, n) => {
            let a = new AbortController(),
              r = setTimeout(() => {
                (r = null), a.abort(P.makeTimeoutError());
              }, n);
            try {
              return await e(t, { ...i, signal: a.signal });
            } catch (e) {
              if ("AbortError" === e.name) throw P.makeTimeoutError();
              throw e;
            } finally {
              r && clearTimeout(r);
            }
          };
        }
        getClientName() {
          return "fetch";
        }
        async makeRequest(e, t, i, n, a, r, l, s) {
          const o = new URL(i, `${"http" === l ? "http" : "https"}://${e}`);
          o.port = t;
          const d = "POST" == n || "PUT" == n || "PATCH" == n;
          return new x(
            await this._fetchFn(
              o.toString(),
              {
                method: n,
                headers: Object.entries(a).map(([e, t]) => [e, v(t)]),
                body: r || (d ? "" : void 0),
              },
              s,
            ),
          );
        }
      }
      class x extends T {
        constructor(e) {
          super(e.status, x._transformHeadersToObject(e.headers)), (this._res = e);
        }
        getRawResponse() {
          return this._res;
        }
        toStream(e) {
          return e(), this._res.body;
        }
        toJSON() {
          return this._res.json();
        }
        static _transformHeadersToObject(e) {
          const t = {};
          for (const i of e) {
            if (!Array.isArray(i) || 2 != i.length)
              throw Error(
                "Response objects produced by the fetch function given to FetchHttpClient do not have an iterable headers map. Response#headers should be an iterable object.",
              );
            t[i[0]] = i[1];
          }
          return t;
        }
      }
      class S {
        computeHMACSignature(e, t) {
          throw Error("computeHMACSignature not implemented.");
        }
        computeHMACSignatureAsync(e, t) {
          throw Error("computeHMACSignatureAsync not implemented.");
        }
        computeSHA256Async(e) {
          throw Error("computeSHA256 not implemented.");
        }
      }
      class E extends Error {}
      class w extends S {
        constructor(e) {
          super(), (this.subtleCrypto = e || crypto.subtle);
        }
        computeHMACSignature(e, t) {
          throw new E("SubtleCryptoProvider cannot be used in a synchronous context.");
        }
        async computeHMACSignatureAsync(e, t) {
          const i = new TextEncoder(),
            n = await this.subtleCrypto.importKey(
              "raw",
              i.encode(t),
              { name: "HMAC", hash: { name: "SHA-256" } },
              !1,
              ["sign"],
            ),
            a = new Uint8Array(await this.subtleCrypto.sign("hmac", n, i.encode(e))),
            r = Array(a.length);
          for (let e = 0; e < a.length; e++) r[e] = O[a[e]];
          return r.join("");
        }
        async computeSHA256Async(e) {
          return new Uint8Array(await this.subtleCrypto.digest("SHA-256", e));
        }
      }
      const O = Array(256);
      for (let e = 0; e < O.length; e++) O[e] = e.toString(16).padStart(2, "0");
      class A {
        constructor() {
          (this._fetchFn = null), (this._agent = null);
        }
        getPlatformInfo() {
          return null;
        }
        uuid4() {
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (e) => {
            const t = (16 * Math.random()) | 0;
            return ("x" === e ? t : (3 & t) | 8).toString(16);
          });
        }
        secureCompare(e, t) {
          if (e.length !== t.length) return !1;
          let i = e.length,
            n = 0;
          for (let a = 0; a < i; ++a) n |= e.charCodeAt(a) ^ t.charCodeAt(a);
          return 0 === n;
        }
        createEmitter() {
          throw Error("createEmitter not implemented.");
        }
        tryBufferData(e) {
          throw Error("tryBufferData not implemented.");
        }
        createNodeHttpClient(e) {
          throw Error("createNodeHttpClient not implemented.");
        }
        createFetchHttpClient(e) {
          return new j(e);
        }
        createDefaultHttpClient() {
          throw Error("createDefaultHttpClient not implemented.");
        }
        createNodeCryptoProvider() {
          throw Error("createNodeCryptoProvider not implemented.");
        }
        createSubtleCryptoProvider(e) {
          return new w(e);
        }
        createDefaultCryptoProvider() {
          throw Error("createDefaultCryptoProvider not implemented.");
        }
      }
      class C extends Event {
        constructor(e, t) {
          super(e), (this.data = t);
        }
      }
      class R {
        constructor() {
          (this.eventTarget = new EventTarget()), (this.listenerMapping = new Map());
        }
        on(e, t) {
          const i = (e) => {
            t(e.data);
          };
          return this.listenerMapping.set(t, i), this.eventTarget.addEventListener(e, i);
        }
        removeListener(e, t) {
          const i = this.listenerMapping.get(t);
          return this.listenerMapping.delete(t), this.eventTarget.removeEventListener(e, i);
        }
        once(e, t) {
          const i = (e) => {
            t(e.data);
          };
          return (
            this.listenerMapping.set(t, i), this.eventTarget.addEventListener(e, i, { once: !0 })
          );
        }
        emit(e, t) {
          return this.eventTarget.dispatchEvent(new C(e, t));
        }
      }
      class M extends A {
        createEmitter() {
          return new R();
        }
        tryBufferData(e) {
          if (e.file.data instanceof ReadableStream)
            throw Error(
              "Uploading a file as a stream is not supported in non-Node environments. Please open or upvote an issue at github.com/stripe/stripe-node if you use this, detailing your use-case.",
            );
          return Promise.resolve(e);
        }
        createNodeHttpClient() {
          throw Error(
            "Stripe: `createNodeHttpClient()` is not available in non-Node environments. Please use `createFetchHttpClient()` instead.",
          );
        }
        createDefaultHttpClient() {
          return super.createFetchHttpClient();
        }
        createNodeCryptoProvider() {
          throw Error(
            "Stripe: `createNodeCryptoProvider()` is not available in non-Node environments. Please use `createSubtleCryptoProvider()` instead.",
          );
        }
        createDefaultCryptoProvider() {
          return this.createSubtleCryptoProvider();
        }
      }
      const D = (e) => {
          const t = e.statusCode;
          return 429 === t || (400 === t && "rate_limit" === e.code)
            ? new U(e)
            : 400 === t || 404 === t
              ? "idempotency_error" === e.type
                ? new H(e)
                : new q(e)
              : 401 === t
                ? new F(e)
                : 402 === t
                  ? new L(e)
                  : 403 === t
                    ? new B(e)
                    : new N(e);
        },
        G = (e) => {
          switch (e.type) {
            case "invalid_grant":
              return new K(e);
            case "invalid_client":
              return new X(e);
            case "invalid_request":
              return new Y(e);
            case "invalid_scope":
              return new Q(e);
            case "unsupported_grant_type":
              return new J(e);
            case "unsupported_response_type":
              return new Z(e);
            default:
              return new z(e);
          }
        },
        I = (e) => {
          switch (e.type) {
            case "idempotency_error":
              return new H(e);
            case "rate_limit":
              return new ee(e);
            case "temporary_session_expired":
              return new et(e);
          }
          return "invalid_fields" === e.code ? new q(e) : D(e);
        };
      class V extends Error {
        constructor(e = {}, t = null) {
          super(e.message),
            (this.type = t || this.constructor.name),
            (this.raw = e),
            (this.rawType = e.type),
            (this.code = e.code),
            (this.doc_url = e.doc_url),
            (this.param = e.param),
            (this.detail = e.detail),
            (this.headers = e.headers),
            (this.requestId = e.requestId),
            (this.statusCode = e.statusCode),
            (this.message = e.message ?? ""),
            (this.userMessage = e.user_message),
            (this.charge = e.charge),
            (this.decline_code = e.decline_code),
            (this.payment_intent = e.payment_intent),
            (this.payment_method = e.payment_method),
            (this.payment_method_type = e.payment_method_type),
            (this.setup_intent = e.setup_intent),
            (this.source = e.source);
        }
      }
      V.generate = D;
      class L extends V {
        constructor(e = {}) {
          super(e, "StripeCardError");
        }
      }
      class q extends V {
        constructor(e = {}) {
          super(e, "StripeInvalidRequestError");
        }
      }
      class N extends V {
        constructor(e = {}) {
          super(e, "StripeAPIError");
        }
      }
      class F extends V {
        constructor(e = {}) {
          super(e, "StripeAuthenticationError");
        }
      }
      class B extends V {
        constructor(e = {}) {
          super(e, "StripePermissionError");
        }
      }
      class U extends V {
        constructor(e = {}) {
          super(e, "StripeRateLimitError");
        }
      }
      class $ extends V {
        constructor(e = {}) {
          super(e, "StripeConnectionError");
        }
      }
      class W extends V {
        constructor(e, t, i = {}) {
          super(i, "StripeSignatureVerificationError"), (this.header = e), (this.payload = t);
        }
      }
      class H extends V {
        constructor(e = {}) {
          super(e, "StripeIdempotencyError");
        }
      }
      class z extends V {
        constructor(e = {}, t = "StripeOAuthError") {
          super(e, t);
        }
      }
      class K extends z {
        constructor(e = {}) {
          super(e, "StripeInvalidGrantError");
        }
      }
      class X extends z {
        constructor(e = {}) {
          super(e, "StripeInvalidClientError");
        }
      }
      class Y extends z {
        constructor(e = {}) {
          super(e, "StripeOAuthInvalidRequestError");
        }
      }
      class Q extends z {
        constructor(e = {}) {
          super(e, "StripeInvalidScopeError");
        }
      }
      class J extends z {
        constructor(e = {}) {
          super(e, "StripeUnsupportedGrantTypeError");
        }
      }
      class Z extends z {
        constructor(e = {}) {
          super(e, "StripeUnsupportedResponseTypeError");
        }
      }
      class ee extends V {
        constructor(e = {}) {
          super(e, "RateLimitError");
        }
      }
      class et extends V {
        constructor(e = {}) {
          super(e, "TemporarySessionExpiredError");
        }
      }
      class ei {
        constructor(e, t) {
          (this._stripe = e), (this._maxBufferedRequestMetric = t);
        }
        _normalizeStripeContext(e, t) {
          return e ? e.toString() || null : t?.toString() || null;
        }
        _addHeadersDirectlyToObject(e, t) {
          (e.requestId = t["request-id"]),
            (e.stripeAccount = e.stripeAccount || t["stripe-account"]),
            (e.apiVersion = e.apiVersion || t["stripe-version"]),
            (e.idempotencyKey = e.idempotencyKey || t["idempotency-key"]);
        }
        _makeResponseEvent(e, t, i) {
          const n = Date.now(),
            a = n - e.request_start_time;
          return h({
            api_version: i["stripe-version"],
            account: i["stripe-account"],
            idempotency_key: i["idempotency-key"],
            method: e.method,
            path: e.path,
            status: t,
            request_id: this._getRequestId(i),
            elapsed: a,
            request_start_time: e.request_start_time,
            request_end_time: n,
          });
        }
        _getRequestId(e) {
          return e["request-id"];
        }
        _streamingResponseHandler(e, t, i) {
          return (n) => {
            const a = n.getHeaders(),
              r = () => {
                const i = this._makeResponseEvent(e, n.getStatusCode(), a);
                this._stripe._emitter.emit("response", i),
                  this._recordRequestMetrics(this._getRequestId(a), i.elapsed, t);
              },
              l = n.toStream(r);
            return this._addHeadersDirectlyToObject(l, a), i(null, l);
          };
        }
        _jsonResponseHandler(e, t, i, n) {
          return (a) => {
            const r = a.getHeaders(),
              l = this._getRequestId(r),
              s = a.getStatusCode(),
              o = this._makeResponseEvent(e, s, r);
            this._stripe._emitter.emit("response", o),
              a
                .toJSON()
                .then(
                  (e) => {
                    if (e.error) {
                      const i = "string" == typeof e.error;
                      throw (
                        (i && (e.error = { type: e.error, message: e.error_description }),
                        (e.error.headers = r),
                        (e.error.statusCode = s),
                        (e.error.requestId = l),
                        i ? G(e.error) : "v2" === t ? I(e.error) : D(e.error))
                      );
                    }
                    return e;
                  },
                  (e) => {
                    throw new N({
                      message: "Invalid JSON received from the Stripe API",
                      exception: e,
                      requestId: r["request-id"],
                    });
                  },
                )
                .then(
                  (e) => {
                    this._recordRequestMetrics(l, o.elapsed, i);
                    const t = a.getRawResponse();
                    this._addHeadersDirectlyToObject(t, r),
                      Object.defineProperty(e, "lastResponse", {
                        enumerable: !1,
                        writable: !1,
                        value: t,
                      }),
                      n(null, e);
                  },
                  (e) => n(e, null),
                );
          };
        }
        static _generateConnectionErrorMessage(e) {
          return `An error occurred with our connection to Stripe.${e > 0 ? ` Request was retried ${e} times.` : ""}`;
        }
        static _shouldRetry(e, t, i, n) {
          return (
            !!(n && 0 === t && P.CONNECTION_CLOSED_ERROR_CODES.includes(n.code)) ||
            (!(t >= i) &&
              (!e ||
                ("false" !== e.getHeaders()["stripe-should-retry"] &&
                  !!(
                    "true" === e.getHeaders()["stripe-should-retry"] ||
                    409 === e.getStatusCode() ||
                    e.getStatusCode() >= 500
                  ))))
          );
        }
        _getSleepTimeInMS(e, t = null) {
          let i = this._stripe.getInitialNetworkRetryDelay(),
            n = Math.min(i * 2 ** (e - 1), this._stripe.getMaxNetworkRetryDelay());
          return (
            (n *= 0.5 * (1 + Math.random())),
            (n = Math.max(i, n)),
            Number.isInteger(t) && t <= 60 && (n = Math.max(n, t)),
            1e3 * n
          );
        }
        _getMaxNetworkRetries(e = {}) {
          return void 0 !== e.maxNetworkRetries && Number.isInteger(e.maxNetworkRetries)
            ? e.maxNetworkRetries
            : this._stripe.getMaxNetworkRetries();
        }
        _defaultIdempotencyKey(e, t, i) {
          const n = this._getMaxNetworkRetries(t),
            a = () => `stripe-node-retry-${this._stripe._platformFunctions.uuid4()}`;
          if ("v2" === i) {
            if ("POST" === e || "DELETE" === e) return a();
          } else if ("v1" === i && "POST" === e && n > 0) return a();
          return null;
        }
        _makeHeaders({
          contentType: e,
          contentLength: t,
          apiVersion: i,
          clientUserAgent: n,
          method: a,
          userSuppliedHeaders: r,
          userSuppliedSettings: l,
          stripeAccount: s,
          stripeContext: o,
          apiMode: d,
        }) {
          const u = {
              Accept: "application/json",
              "Content-Type": e,
              "User-Agent": this._getUserAgentString(d),
              "X-Stripe-Client-User-Agent": n,
              "X-Stripe-Client-Telemetry": this._getTelemetryHeader(),
              "Stripe-Version": i,
              "Stripe-Account": s,
              "Stripe-Context": o,
              "Idempotency-Key": this._defaultIdempotencyKey(a, l, d),
            },
            c = "POST" == a || "PUT" == a || "PATCH" == a;
          return (
            (c || t) &&
              (c ||
                p(
                  `${a} method had non-zero contentLength but no payload is expected for this verb`,
                ),
              (u["Content-Length"] = t)),
            Object.assign(
              h(u),
              r && "object" == typeof r
                ? Object.keys(r).reduce(
                    (e, t) => (
                      (e[
                        t
                          .split("-")
                          .map((e) => e.charAt(0).toUpperCase() + e.substr(1).toLowerCase())
                          .join("-")
                      ] = r[t]),
                      e
                    ),
                    {},
                  )
                : r,
            )
          );
        }
        _getUserAgentString(e) {
          let t = this._stripe.getConstant("PACKAGE_VERSION"),
            i = this._stripe._appInfo ? this._stripe.getAppInfoAsString() : "",
            n = this._stripe.getConstant("AI_AGENT"),
            a = `Stripe/${e} NodeBindings/${t}`;
          return i && (a += ` ${i}`), n && (a += ` AIAgent/${n}`), a;
        }
        _getTelemetryHeader() {
          if (this._stripe.getTelemetryEnabled() && this._stripe._prevRequestMetrics.length > 0)
            return JSON.stringify({
              last_request_metrics: this._stripe._prevRequestMetrics.shift(),
            });
        }
        _recordRequestMetrics(e, t, i) {
          if (this._stripe.getTelemetryEnabled() && e)
            if (this._stripe._prevRequestMetrics.length > this._maxBufferedRequestMetric)
              p("Request metrics buffer is full, dropping telemetry message.");
            else {
              const n = { request_id: e, request_duration_ms: t };
              i && i.length > 0 && (n.usage = i), this._stripe._prevRequestMetrics.push(n);
            }
        }
        _rawRequest(e, t, i, n, a) {
          return new Promise((r, l) => {
            let s;
            try {
              const r = e.toUpperCase();
              if ("POST" !== r && i && 0 !== Object.keys(i).length)
                throw Error(
                  "rawRequest only supports params on POST requests. Please pass null and add your parameters to path.",
                );
              const l = [].slice.call([i, n]),
                o = c(l),
                d = "POST" === r ? Object.assign({}, o) : null,
                u = m(l),
                h = u.headers,
                f = u.authenticator;
              s = {
                requestMethod: r,
                requestPath: t,
                bodyData: d,
                queryData: {},
                authenticator: f,
                headers: h,
                host: u.host,
                streaming: !!u.streaming,
                settings: {},
                usage: a || ["raw_request"],
              };
            } catch (e) {
              l(e);
              return;
            }
            const { headers: o, settings: d } = s,
              u = s.authenticator;
            this._request(
              s.requestMethod,
              s.host,
              t,
              s.bodyData,
              u,
              { headers: o, settings: d, streaming: s.streaming },
              s.usage,
              (e, t) => {
                e ? l(e) : r(t);
              },
            );
          });
        }
        _getContentLength(e) {
          return "string" == typeof e ? new TextEncoder().encode(e).length : e.length;
        }
        _request(e, t, i, n, a, r, l = [], s, o = null) {
          let u;
          a = a ?? this._stripe._authenticator ?? null;
          const c = y(i),
            m = (e, t, i, n, a) => setTimeout(e, this._getSleepTimeInMS(n, a), t, i, n + 1),
            f = (n, o, d) => {
              const p =
                  r.settings &&
                  r.settings.timeout &&
                  Number.isInteger(r.settings.timeout) &&
                  r.settings.timeout >= 0
                    ? r.settings.timeout
                    : this._stripe.getApiField("timeout"),
                k = {
                  host: t || this._stripe.getApiField("host"),
                  port: this._stripe.getApiField("port"),
                  path: i,
                  method: e,
                  headers: Object.assign({}, o),
                  body: u,
                  protocol: this._stripe.getApiField("protocol"),
                };
              a(k)
                .then(() => {
                  const t = this._stripe
                      .getApiField("httpClient")
                      .makeRequest(
                        k.host,
                        k.port,
                        k.path,
                        k.method,
                        k.headers,
                        k.body,
                        k.protocol,
                        p,
                      ),
                    a = Date.now(),
                    u = h({
                      api_version: n,
                      account: v(o["Stripe-Account"]),
                      idempotency_key: v(o["Idempotency-Key"]),
                      method: e,
                      path: i,
                      request_start_time: a,
                    }),
                    _ = d || 0,
                    b = this._getMaxNetworkRetries(r.settings || {});
                  this._stripe._emitter.emit("request", u),
                    t
                      .then((e) => {
                        if (ei._shouldRetry(e, _, b)) {
                          var t;
                          return m(
                            f,
                            n,
                            o,
                            _,
                            Number(Array.isArray((t = e.getHeaders()["retry-after"])) ? t[0] : t),
                          );
                        }
                        return r.streaming && 400 > e.getStatusCode()
                          ? this._streamingResponseHandler(u, l, s)(e)
                          : this._jsonResponseHandler(u, c, l, s)(e);
                      })
                      .catch((e) =>
                        ei._shouldRetry(null, _, b, e)
                          ? m(f, n, o, _, null)
                          : s(
                              new $({
                                message:
                                  e.code && e.code === P.TIMEOUT_ERROR_CODE
                                    ? `Request aborted due to timeout being reached (${p}ms)`
                                    : ei._generateConnectionErrorMessage(_),
                                detail: e,
                              }),
                            ),
                      );
                })
                .catch((e) => {
                  throw new V({ message: "Unable to authenticate the request", exception: e });
                });
            },
            p = (t, i) => {
              if (t) return s(t);
              (u = i),
                this._stripe.getClientUserAgent((t) => {
                  const n = this._stripe.getApiField("version"),
                    a = this._makeHeaders({
                      contentType:
                        "v2" == c ? "application/json" : "application/x-www-form-urlencoded",
                      contentLength: this._getContentLength(i),
                      apiVersion: n,
                      clientUserAgent: t,
                      method: e,
                      userSuppliedHeaders: r.headers ?? null,
                      userSuppliedSettings: r.settings ?? {},
                      stripeAccount: r.stripeAccount ?? this._stripe.getApiField("stripeAccount"),
                      stripeContext: this._normalizeStripeContext(
                        r.stripeContext,
                        this._stripe.getApiField("stripeContext"),
                      ),
                      apiMode: c,
                    });
                  f(n, a, 0);
                });
            };
          if (o) o(e, n, r.headers, p);
          else {
            let e;
            p(null, (e = "v2" == c ? (n ? JSON.stringify(n, g) : "") : d(n || {})));
          }
        }
      }
      class en {
        constructor(e, t, i, n) {
          (this.index = 0),
            (this.pagePromise = e),
            (this.promiseCache = { currentPromise: null }),
            (this.requestArgs = t),
            (this.spec = i),
            (this.stripeResource = n);
        }
        async iterate(e) {
          if (!(e && e.data && "number" == typeof e.data.length))
            throw Error(
              "Unexpected: Stripe API response does not have a well-formed `data` array.",
            );
          const t = eo(this.requestArgs);
          if (this.index < e.data.length) {
            const i = t ? e.data.length - 1 - this.index : this.index,
              n = e.data[i];
            return (this.index += 1), { value: n, done: !1 };
          }
          if (e.has_more) {
            (this.index = 0), (this.pagePromise = this.getNextPage(e));
            const t = await this.pagePromise;
            return this.iterate(t);
          }
          return { done: !0, value: void 0 };
        }
        getNextPage(e) {
          throw Error("Unimplemented");
        }
        async _next() {
          return this.iterate(await this.pagePromise);
        }
        next() {
          if (this.promiseCache.currentPromise) return this.promiseCache.currentPromise;
          const e = (async () => {
            const e = await this._next();
            return (this.promiseCache.currentPromise = null), e;
          })();
          return (this.promiseCache.currentPromise = e), e;
        }
      }
      class ea extends en {
        getNextPage(e) {
          const t = eo(this.requestArgs),
            i = ((e, t) => {
              const i = t ? 0 : e.data.length - 1,
                n = e.data[i],
                a = n && n.id;
              if (!a)
                throw Error("Unexpected: No `id` found on the last item while auto-paging a list.");
              return a;
            })(e, t);
          return this.stripeResource._makeRequest(this.requestArgs, this.spec, {
            [t ? "ending_before" : "starting_after"]: i,
          });
        }
      }
      class er extends en {
        getNextPage(e) {
          if (!e.next_page)
            throw Error(
              "Unexpected: Stripe API response does not have a well-formed `next_page` field, but `has_more` was true.",
            );
          return this.stripeResource._makeRequest(this.requestArgs, this.spec, {
            page: e.next_page,
          });
        }
      }
      class el {
        constructor(e, t, i, n) {
          (this.firstPagePromise = e),
            (this.currentPageIterator = null),
            (this.nextPageUrl = null),
            (this.requestArgs = t),
            (this.spec = i),
            (this.stripeResource = n);
        }
        async initFirstPage() {
          if (this.firstPagePromise) {
            const e = await this.firstPagePromise;
            (this.firstPagePromise = null),
              (this.currentPageIterator = e.data[Symbol.iterator]()),
              (this.nextPageUrl = e.next_page_url || null);
          }
        }
        async turnPage() {
          if (!this.nextPageUrl) return null;
          this.spec.fullPath = this.nextPageUrl;
          const e = await this.stripeResource._makeRequest([], this.spec, {});
          return (
            (this.nextPageUrl = e.next_page_url || null),
            (this.currentPageIterator = e.data[Symbol.iterator]()),
            this.currentPageIterator
          );
        }
        async next() {
          if ((await this.initFirstPage(), this.currentPageIterator)) {
            const e = this.currentPageIterator.next();
            if (!e.done) return { done: !1, value: e.value };
          }
          const e = await this.turnPage();
          if (!e) return { done: !0, value: void 0 };
          const t = e.next();
          return t.done ? { done: !0, value: void 0 } : { done: !1, value: t.value };
        }
      }
      const es = (e) => {
        var t, i;
        const n =
            ((t = (...t) => e.next(...t)),
            function () {
              var e, i;
              const n = [].slice.call(arguments),
                a = ((e) => {
                  if (0 === e.length) return;
                  const t = e[0];
                  if ("function" != typeof t)
                    throw Error(
                      `The first argument to autoPagingEach, if present, must be a callback function; received ${typeof t}`,
                    );
                  if (2 === t.length) return t;
                  if (t.length > 2)
                    throw Error(
                      `The \`onItem\` callback function passed to autoPagingEach must accept at most two arguments; got ${t}`,
                    );
                  return (e, i) => {
                    i(t(e));
                  };
                })(n),
                r = ((e) => {
                  if (e.length < 2) return null;
                  const t = e[1];
                  if ("function" != typeof t)
                    throw Error(
                      `The second argument to autoPagingEach, if present, must be a callback function; received ${typeof t}`,
                    );
                  return t;
                })(n);
              if (n.length > 2)
                throw Error(`autoPagingEach takes up to two arguments; received ${n}`);
              return f(
                ((e = t),
                (i = a),
                new Promise((t, n) => {
                  e()
                    .then(function n(a) {
                      if (a.done) return void t();
                      const r = a.value;
                      return new Promise((e) => {
                        i(r, e);
                      }).then((t) => (!1 === t ? n({ done: !0, value: void 0 }) : e().then(n)));
                    })
                    .catch(n);
                })),
                r,
              );
            }),
          a =
            ((i = n),
            (e, t) => {
              const n = e && e.limit;
              if (!n)
                throw Error(
                  "You must pass a `limit` option to autoPagingToArray, e.g., `autoPagingToArray({limit: 1000});`.",
                );
              if (n > 1e4)
                throw Error(
                  "You cannot specify a limit of more than 10,000 items to fetch in `autoPagingToArray`; use `autoPagingEach` to iterate through longer lists.",
                );
              return f(
                new Promise((e, t) => {
                  const a = [];
                  i((e) => {
                    if ((a.push(e), a.length >= n)) return !1;
                  })
                    .then(() => {
                      e(a);
                    })
                    .catch(t);
                }),
                t,
              );
            }),
          r = {
            autoPagingEach: n,
            autoPagingToArray: a,
            next: () => e.next(),
            return: () => ({}),
            ["undefined" != typeof Symbol && Symbol.asyncIterator
              ? Symbol.asyncIterator
              : "@@asyncIterator"]: () => r,
          };
        return r;
      };
      function eo(e) {
        return !!c([].slice.call(e)).ending_before;
      }
      const ed = {
        "ubb-usage-count": { mode: "significant-figures", value: 15 },
        "v1-api": { mode: "decimal-places", value: 12 },
      };
      class eu {
        constructor(e, t) {
          const [i, n] = eu.normalize(e, t);
          (this._coefficient = i), (this._exponent = n), Object.freeze(this);
        }
        static normalize(e, t) {
          if (0n === e) return [0n, 0];
          let i = e,
            n = t;
          for (; 0n !== i && i % 10n === 0n; ) (i /= 10n), (n += 1);
          return [i, n];
        }
        static roundDivision(e, t, i, n) {
          let a;
          if (0n === t || "round-down" === n) return e;
          const r = t > 0n == i > 0n ? 1n : -1n;
          if ("round-up" === n) return e + r;
          if ("ceil" === n) return 1n === r ? e + 1n : e;
          if ("floor" === n) return r === -1n ? e - 1n : e;
          const l = i < 0n ? -i : i,
            s = 2n * (t < 0n ? -t : t);
          return (a = s === l ? 0 : s < l ? -1 : 1) < 0
            ? e
            : a > 0 || "half-up" === n
              ? e + r
              : "half-down" === n || e % 2n === 0n
                ? e
                : e + r;
        }
        add(e) {
          if (this._exponent === e._exponent)
            return new eu(this._coefficient + e._coefficient, this._exponent);
          if (this._exponent < e._exponent) {
            const t = 10n ** BigInt(e._exponent - this._exponent);
            return new eu(this._coefficient + e._coefficient * t, this._exponent);
          }
          {
            const t = 10n ** BigInt(this._exponent - e._exponent);
            return new eu(this._coefficient * t + e._coefficient, e._exponent);
          }
        }
        sub(e) {
          if (this._exponent === e._exponent)
            return new eu(this._coefficient - e._coefficient, this._exponent);
          if (this._exponent < e._exponent) {
            const t = 10n ** BigInt(e._exponent - this._exponent);
            return new eu(this._coefficient - e._coefficient * t, this._exponent);
          }
          {
            const t = 10n ** BigInt(this._exponent - e._exponent);
            return new eu(this._coefficient * t - e._coefficient, e._exponent);
          }
        }
        mul(e) {
          return new eu(this._coefficient * e._coefficient, this._exponent + e._exponent);
        }
        div(e, t, i) {
          let n, a, r;
          if (t < 0 || !Number.isInteger(t))
            throw Error("precision must be a non-negative integer");
          if (0n === e._coefficient) throw Error("Division by zero");
          const l = this._exponent - e._exponent + t;
          if (l >= 0) {
            const t = this._coefficient * 10n ** BigInt(l);
            (n = t / e._coefficient), (a = t % e._coefficient), (r = e._coefficient);
          } else {
            const t = e._coefficient * 10n ** BigInt(-l);
            (n = this._coefficient / t), (a = this._coefficient % t), (r = t);
          }
          const s = eu.roundDivision(n, a, r, i);
          return new eu(s, -t);
        }
        cmp(e) {
          if (this._exponent === e._exponent)
            return this._coefficient < e._coefficient ? -1 : +(this._coefficient > e._coefficient);
          if (this._exponent < e._exponent) {
            const t = 10n ** BigInt(e._exponent - this._exponent),
              i = e._coefficient * t;
            return this._coefficient < i ? -1 : +(this._coefficient > i);
          }
          {
            const t = 10n ** BigInt(this._exponent - e._exponent),
              i = this._coefficient * t;
            return i < e._coefficient ? -1 : +(i > e._coefficient);
          }
        }
        eq(e) {
          return 0 === this.cmp(e);
        }
        lt(e) {
          return -1 === this.cmp(e);
        }
        lte(e) {
          return 0 >= this.cmp(e);
        }
        gt(e) {
          return 1 === this.cmp(e);
        }
        gte(e) {
          return this.cmp(e) >= 0;
        }
        isZero() {
          return 0n === this._coefficient;
        }
        isNegative() {
          return this._coefficient < 0n;
        }
        isPositive() {
          return this._coefficient > 0n;
        }
        neg() {
          return new eu(-this._coefficient, this._exponent);
        }
        abs() {
          return this._coefficient < 0n ? new eu(-this._coefficient, this._exponent) : this;
        }
        round(e, t) {
          const i = "string" == typeof t ? ed[t] : t;
          if (void 0 === i) throw Error(`Unknown rounding preset: "${t}"`);
          if (i.value < 0 || !Number.isInteger(i.value))
            throw Error("DecimalRoundingOptions.value must be a non-negative integer");
          if ("decimal-places" === i.mode) {
            const t = this.toFixed(i.value, e);
            return ec.from(t);
          }
          if (0n === this._coefficient) return this;
          const n = (
            this._coefficient < 0n ? (-this._coefficient).toString() : this._coefficient.toString()
          ).length;
          if (0 === i.value) return ec.zero;
          if (n <= i.value) return this;
          const a = n - i.value,
            r = 10n ** BigInt(a),
            l = this._coefficient / r,
            s = this._coefficient % r,
            o = eu.roundDivision(l, s, r, e);
          return new eu(o, this._exponent + a);
        }
        toString() {
          if (0n === this._coefficient) return "0";
          const e = this._coefficient.toString(),
            t = e.startsWith("-"),
            i = t ? e.slice(1) : e;
          if (this._exponent < 0) {
            const n = -this._exponent;
            if ((n >= i.length ? n - i.length : 0) > 30) {
              if (1 === i.length) return `${e}E${String(this._exponent)}`;
              const n = i[0] ?? "",
                a = i.slice(1),
                r = this._exponent + i.length - 1;
              return `${t ? "-" : ""}${n}.${a}E${String(r)}`;
            }
            if (n >= i.length) {
              const e = "0".repeat(n - i.length);
              return `${t ? "-" : ""}0.${e}${i}`;
            }
            {
              const e = i.slice(0, i.length - n),
                a = i.slice(i.length - n);
              return `${t ? "-" : ""}${e}.${a}`;
            }
          }
          if (i.length + this._exponent <= 30) {
            if (0 === this._exponent) return e;
            const n = "0".repeat(this._exponent);
            return `${t ? "-" : ""}${i}${n}`;
          }
          {
            if (1 === i.length) return `${e}E+${String(this._exponent)}`;
            const n = i[0] ?? "",
              a = i.slice(1),
              r = this._exponent + i.length - 1;
            return `${t ? "-" : ""}${n}.${a}E+${String(r)}`;
          }
        }
        toJSON() {
          return this.toString();
        }
        toNumber() {
          return Number(this.toString());
        }
        toFixed(e, t) {
          if (e < 0 || !Number.isInteger(e))
            throw Error("decimalPlaces must be a non-negative integer");
          const i = (t) => {
              const i = t.toString(),
                n = i.startsWith("-"),
                a = n ? i.slice(1) : i;
              if (0 === e) return i;
              if (e >= a.length) {
                const t = "0".repeat(e - a.length);
                return `${n ? "-" : ""}0.${t}${a}`;
              }
              {
                const t = a.slice(0, a.length - e),
                  i = a.slice(a.length - e);
                return `${n ? "-" : ""}${t}.${i}`;
              }
            },
            n = -e;
          if (this._exponent === n) return i(this._coefficient);
          if (this._exponent < n) {
            const e = n - this._exponent,
              a = 10n ** BigInt(e),
              r = this._coefficient / a,
              l = this._coefficient % a;
            return i(eu.roundDivision(r, l, a, t));
          }
          {
            const e = this._exponent - n;
            return i(this._coefficient * 10n ** BigInt(e));
          }
        }
        valueOf() {
          return this.toString();
        }
      }
      const ec = {
          from(e) {
            if ("bigint" == typeof e) return new eu(e, 0);
            if ("number" == typeof e) {
              if (!Number.isFinite(e)) throw Error("Number must be finite");
              return ec.from(e.toString());
            }
            const t = e.trim();
            if ("" === t) throw Error("Cannot parse empty string as Decimal");
            const i = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(t);
            if (!i) throw Error(`Invalid decimal string: ${e}`);
            const n = "-" === i[1] ? -1n : 1n,
              a = i[2] ?? "",
              r = i[3] ?? "",
              l = i[4] ? Number(i[4]) : 0;
            if (!Number.isSafeInteger(l) || l > 1e6 || l < -1e6)
              throw Error(`Exponent out of range: ${String(i[4])} exceeds safe integer bounds`);
            const s = n * BigInt(a + r),
              o = l - r.length;
            if (!Number.isSafeInteger(o) || o > 1e6 || o < -1e6)
              throw Error(
                `Computed exponent out of range: ${String(o)} exceeds safe integer bounds`,
              );
            return new eu(s, o);
          },
          zero: new eu(0n, 0),
        },
        em = (e, t) => {
          if (null == e) return e;
          switch (t.kind) {
            case "int64_string":
              return "bigint" == typeof e || "number" == typeof e ? String(e) : e;
            case "decimal_string":
              return "function" == typeof e.toFixed && "function" == typeof e.isZero
                ? e.toString()
                : e;
            case "object": {
              if ("object" != typeof e || Array.isArray(e)) return e;
              const i = {};
              for (const n of Object.keys(e)) {
                const a = t.fields[n];
                i[n] = a ? em(e[n], a) : e[n];
              }
              return i;
            }
            case "array":
              if (!Array.isArray(e)) return e;
              return e.map((e) => em(e, t.element));
            case "nullable":
              return em(e, t.inner);
          }
        },
        eh = (e, t) => {
          if (null == e) return e;
          switch (t.kind) {
            case "int64_string":
              if ("string" == typeof e)
                try {
                  return BigInt(e);
                } catch {
                  throw Error(
                    `Failed to coerce int64_string value: expected an integer string, got '${e}'`,
                  );
                }
              return e;
            case "decimal_string":
              if ("string" == typeof e)
                try {
                  return ec.from(e);
                } catch {
                  throw Error(
                    `Failed to coerce decimal_string value: expected a decimal string, got '${e}'`,
                  );
                }
              return e;
            case "object":
              if ("object" != typeof e || Array.isArray(e)) return e;
              for (const i of Object.keys(t.fields)) i in e && (e[i] = eh(e[i], t.fields[i]));
              return e;
            case "array":
              if (!Array.isArray(e)) return e;
              for (let i = 0; i < e.length; i++) e[i] = eh(e[i], t.element);
              return e;
            case "nullable":
              return eh(e, t.inner);
          }
        };
      function ef(e, t) {
        if (((this._stripe = e), t))
          throw Error(
            "Support for curried url params was dropped in stripe-node v7.0.0. Instead, pass two ids.",
          );
        (this.basePath = u(this.basePath || e.getApiField("basePath"))),
          (this.resourcePath = this.path),
          (this.path = u(this.path)),
          this.initialize(...arguments);
      }
      (ef.extend = function (e) {
        const t = this,
          i = Object.hasOwn(e, "constructor")
            ? e.constructor
            : function (...e) {
                t.apply(this, e);
              };
        return (
          Object.assign(i, t),
          (i.prototype = Object.create(t.prototype)),
          Object.assign(i.prototype, e),
          i
        );
      }),
        (ef.method = (e) => {
          if (void 0 !== e.path && void 0 !== e.fullPath)
            throw Error(
              `Method spec specified both a 'path' (${e.path}) and a 'fullPath' (${e.fullPath}).`,
            );
          return function (...t) {
            const i = "function" == typeof t[t.length - 1] && t.pop();
            e.urlParams = ((e) => {
              const t = e.match(/\{\w+\}/g);
              return t ? t.map((e) => e.replace(/[{}]/g, "")) : [];
            })(e.fullPath || this.createResourcePathWithSymbols(e.path || ""));
            const n = f(this._makeRequest(t, e, {}), i);
            return (
              Object.assign(
                n,
                ((e, t, i, n) => {
                  const a = y(i.fullPath || i.path);
                  return "v2" !== a && "search" === i.methodType
                    ? es(new er(n, t, i, e))
                    : "v2" !== a && "list" === i.methodType
                      ? es(new ea(n, t, i, e))
                      : "v2" === a && "list" === i.methodType
                        ? es(new el(n, t, i, e))
                        : null;
                })(this, t, e, n),
              ),
              n
            );
          };
        }),
        (ef.MAX_BUFFERED_REQUEST_METRICS = 100),
        (ef.prototype = {
          _stripe: null,
          path: "",
          resourcePath: "",
          basePath: null,
          initialize() {},
          requestDataProcessor: null,
          validateRequest: null,
          createFullPath(e, t) {
            const i = [this.basePath(t), this.path(t)];
            if ("function" == typeof e) {
              const n = e(t);
              n && i.push(n);
            } else i.push(e);
            return this._joinUrlParts(i);
          },
          createResourcePathWithSymbols(e) {
            return e ? `/${this._joinUrlParts([this.resourcePath, e])}` : `/${this.resourcePath}`;
          },
          _joinUrlParts: (e) => e.join("/").replace(/\/{2,}/g, "/"),
          _getRequestOpts(e, t, i) {
            const n = (t.method || "GET").toUpperCase(),
              a = t.usage || [],
              r = t.urlParams || [],
              l = t.encode || ((e) => e),
              s = !!t.fullPath,
              o = u(s ? t.fullPath : t.path || ""),
              d = s ? t.fullPath : this.createResourcePathWithSymbols(t.path),
              h = [].slice.call(e),
              f = r.reduce((e, t) => {
                const i = h.shift();
                if ("string" != typeof i)
                  throw Error(
                    `Stripe: Argument "${t}" must be a string, but got: ${i} (on API request to \`${n} ${d}\`)`,
                  );
                return (e[t] = i), e;
              }, {}),
              p = l(Object.assign({}, c(h), i)),
              k = m(h),
              _ = k.host || t.host,
              b = !!t.streaming || !!k.streaming;
            if (h.filter((e) => null != e).length)
              throw Error(
                `Stripe: Unknown arguments (${h}). Did you mean to pass an options object? See https://github.com/stripe/stripe-node/wiki/Passing-Options. (on API request to ${n} \`${d}\`)`,
              );
            const g = s ? o(f) : this.createFullPath(o, f),
              y = Object.assign(k.headers, t.headers);
            t.validator && t.validator(p, { headers: y });
            const v = "GET" === t.method || "DELETE" === t.method;
            return {
              requestMethod: n,
              requestPath: g,
              bodyData: v ? null : p,
              queryData: v ? p : {},
              authenticator: k.authenticator ?? null,
              headers: y,
              host: _ ?? null,
              streaming: b,
              settings: k.settings,
              usage: a,
            };
          },
          _makeRequest(e, t, i) {
            return new Promise((n, a) => {
              let r;
              try {
                r = this._getRequestOpts(e, t, i);
              } catch (e) {
                a(e);
                return;
              }
              t.requestSchema && r.bodyData && (r.bodyData = em(r.bodyData, t.requestSchema));
              const l = 0 === Object.keys(r.queryData).length,
                s = [r.requestPath, l ? "" : "?", d(r.queryData)].join(""),
                { headers: o, settings: u } = r;
              this._stripe._requestSender._request(
                r.requestMethod,
                r.host,
                s,
                r.bodyData,
                r.authenticator,
                { headers: o, settings: u, streaming: r.streaming },
                r.usage,
                (e, i) => {
                  if (e) a(e);
                  else
                    try {
                      t.responseSchema && eh(i, t.responseSchema),
                        n(t.transformResponseData ? t.transformResponseData(i) : i);
                    } catch (e) {
                      a(e);
                    }
                },
                this.requestDataProcessor?.bind(this),
              );
            });
          },
        });
      class ep {
        constructor(e = []) {
          this._segments = [...e];
        }
        get segments() {
          return [...this._segments];
        }
        push(e) {
          if (!e) throw Error("Segment cannot be null or undefined");
          return new ep([...this._segments, e]);
        }
        pop() {
          if (0 === this._segments.length) throw Error("Cannot pop from an empty context");
          return new ep(this._segments.slice(0, -1));
        }
        toString() {
          return this._segments.join("/");
        }
        static parse(e) {
          return new ep(e ? e.split("/") : []);
        }
      }
      const ek = "2026-03-25.dahlia";
      function e_(e, t) {
        for (const i in t) {
          if (!Object.hasOwn(t, i)) continue;
          const n = i[0].toLowerCase() + i.substring(1),
            a = new t[i](e);
          this[n] = a;
        }
      }
      function eb(e, t) {
        return (e) => new e_(e, t);
      }
      const eg = ef.method,
        ey = ef.extend({ create: eg({ method: "POST", fullPath: "/v2/core/account_links" }) }),
        ev = ef.method,
        eP = ef.extend({
          create: ev({
            method: "POST",
            fullPath: "/v2/core/account_tokens",
            requestSchema: {
              kind: "object",
              fields: {
                identity: {
                  kind: "object",
                  fields: {
                    individual: {
                      kind: "object",
                      fields: {
                        relationship: {
                          kind: "object",
                          fields: { percent_ownership: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: ev({ method: "GET", fullPath: "/v2/core/account_tokens/{id}" }),
        }),
        eT = ef.method,
        ej = ef.extend({
          retrieve: eT({ method: "GET", fullPath: "/v1/financial_connections/accounts/{account}" }),
          list: eT({
            method: "GET",
            fullPath: "/v1/financial_connections/accounts",
            methodType: "list",
          }),
          disconnect: eT({
            method: "POST",
            fullPath: "/v1/financial_connections/accounts/{account}/disconnect",
          }),
          listOwners: eT({
            method: "GET",
            fullPath: "/v1/financial_connections/accounts/{account}/owners",
            methodType: "list",
          }),
          refresh: eT({
            method: "POST",
            fullPath: "/v1/financial_connections/accounts/{account}/refresh",
          }),
          subscribe: eT({
            method: "POST",
            fullPath: "/v1/financial_connections/accounts/{account}/subscribe",
          }),
          unsubscribe: eT({
            method: "POST",
            fullPath: "/v1/financial_connections/accounts/{account}/unsubscribe",
          }),
        }),
        ex = ef.method,
        eS = ef.extend({
          create: ex({
            method: "POST",
            fullPath: "/v2/core/accounts/{account_id}/persons",
            requestSchema: {
              kind: "object",
              fields: {
                relationship: {
                  kind: "object",
                  fields: { percent_ownership: { kind: "decimal_string" } },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                relationship: {
                  kind: "object",
                  fields: { percent_ownership: { kind: "decimal_string" } },
                },
              },
            },
          }),
          retrieve: ex({
            method: "GET",
            fullPath: "/v2/core/accounts/{account_id}/persons/{id}",
            responseSchema: {
              kind: "object",
              fields: {
                relationship: {
                  kind: "object",
                  fields: { percent_ownership: { kind: "decimal_string" } },
                },
              },
            },
          }),
          update: ex({
            method: "POST",
            fullPath: "/v2/core/accounts/{account_id}/persons/{id}",
            requestSchema: {
              kind: "object",
              fields: {
                relationship: {
                  kind: "object",
                  fields: { percent_ownership: { kind: "decimal_string" } },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                relationship: {
                  kind: "object",
                  fields: { percent_ownership: { kind: "decimal_string" } },
                },
              },
            },
          }),
          list: ex({
            method: "GET",
            fullPath: "/v2/core/accounts/{account_id}/persons",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      relationship: {
                        kind: "object",
                        fields: { percent_ownership: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
              },
            },
          }),
          del: ex({ method: "DELETE", fullPath: "/v2/core/accounts/{account_id}/persons/{id}" }),
        }),
        eE = ef.method,
        ew = ef.extend({
          create: eE({
            method: "POST",
            fullPath: "/v2/core/accounts/{account_id}/person_tokens",
            requestSchema: {
              kind: "object",
              fields: {
                relationship: {
                  kind: "object",
                  fields: { percent_ownership: { kind: "decimal_string" } },
                },
              },
            },
          }),
          retrieve: eE({
            method: "GET",
            fullPath: "/v2/core/accounts/{account_id}/person_tokens/{id}",
          }),
        }),
        eO = ef.method,
        eA = ef.extend({
          constructor: function (...e) {
            ef.apply(this, e), (this.persons = new eS(...e)), (this.personTokens = new ew(...e));
          },
          create: eO({
            method: "POST",
            fullPath: "/v2/core/accounts",
            requestSchema: {
              kind: "object",
              fields: {
                identity: {
                  kind: "object",
                  fields: {
                    individual: {
                      kind: "object",
                      fields: {
                        relationship: {
                          kind: "object",
                          fields: { percent_ownership: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                identity: {
                  kind: "object",
                  fields: {
                    individual: {
                      kind: "object",
                      fields: {
                        relationship: {
                          kind: "object",
                          fields: { percent_ownership: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: eO({
            method: "GET",
            fullPath: "/v2/core/accounts/{id}",
            responseSchema: {
              kind: "object",
              fields: {
                identity: {
                  kind: "object",
                  fields: {
                    individual: {
                      kind: "object",
                      fields: {
                        relationship: {
                          kind: "object",
                          fields: { percent_ownership: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          update: eO({
            method: "POST",
            fullPath: "/v2/core/accounts/{id}",
            requestSchema: {
              kind: "object",
              fields: {
                identity: {
                  kind: "object",
                  fields: {
                    individual: {
                      kind: "object",
                      fields: {
                        relationship: {
                          kind: "object",
                          fields: { percent_ownership: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                identity: {
                  kind: "object",
                  fields: {
                    individual: {
                      kind: "object",
                      fields: {
                        relationship: {
                          kind: "object",
                          fields: { percent_ownership: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: eO({
            method: "GET",
            fullPath: "/v2/core/accounts",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      identity: {
                        kind: "object",
                        fields: {
                          individual: {
                            kind: "object",
                            fields: {
                              relationship: {
                                kind: "object",
                                fields: { percent_ownership: { kind: "decimal_string" } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          close: eO({
            method: "POST",
            fullPath: "/v2/core/accounts/{id}/close",
            responseSchema: {
              kind: "object",
              fields: {
                identity: {
                  kind: "object",
                  fields: {
                    individual: {
                      kind: "object",
                      fields: {
                        relationship: {
                          kind: "object",
                          fields: { percent_ownership: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        eC = ef.method,
        eR = ef.extend({
          retrieve: eC({ method: "GET", fullPath: "/v1/entitlements/active_entitlements/{id}" }),
          list: eC({
            method: "GET",
            fullPath: "/v1/entitlements/active_entitlements",
            methodType: "list",
          }),
        }),
        eM = ef.method,
        eD = ef.extend({
          create: eM({ method: "POST", fullPath: "/v1/billing/alerts" }),
          retrieve: eM({ method: "GET", fullPath: "/v1/billing/alerts/{id}" }),
          list: eM({ method: "GET", fullPath: "/v1/billing/alerts", methodType: "list" }),
          activate: eM({ method: "POST", fullPath: "/v1/billing/alerts/{id}/activate" }),
          archive: eM({ method: "POST", fullPath: "/v1/billing/alerts/{id}/archive" }),
          deactivate: eM({ method: "POST", fullPath: "/v1/billing/alerts/{id}/deactivate" }),
        }),
        eG = ef.method,
        eI = ef.extend({ find: eG({ method: "GET", fullPath: "/v1/tax/associations/find" }) }),
        eV = ef.method,
        eL = ef.extend({
          retrieve: eV({
            method: "GET",
            fullPath: "/v1/issuing/authorizations/{authorization}",
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          update: eV({
            method: "POST",
            fullPath: "/v1/issuing/authorizations/{authorization}",
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: eV({
            method: "GET",
            fullPath: "/v1/issuing/authorizations",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      fleet: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            reported_breakdown: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  non_fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  tax: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        local_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        national_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      fuel: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            quantity_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_cost_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      transactions: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            purchase_details: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  fleet: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        reported_breakdown: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              fuel: {
                                                kind: "nullable",
                                                inner: {
                                                  kind: "object",
                                                  fields: {
                                                    gross_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              non_fuel: {
                                                kind: "nullable",
                                                inner: {
                                                  kind: "object",
                                                  fields: {
                                                    gross_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              tax: {
                                                kind: "nullable",
                                                inner: {
                                                  kind: "object",
                                                  fields: {
                                                    local_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    national_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                  fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        quantity_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        unit_cost_decimal: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          approve: eV({
            method: "POST",
            fullPath: "/v1/issuing/authorizations/{authorization}/approve",
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          decline: eV({
            method: "POST",
            fullPath: "/v1/issuing/authorizations/{authorization}/decline",
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        eq = ef.method,
        eN = ef.extend({
          create: eq({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/authorizations",
            requestSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "object",
                  fields: {
                    reported_breakdown: {
                      kind: "object",
                      fields: {
                        fuel: {
                          kind: "object",
                          fields: { gross_amount_decimal: { kind: "decimal_string" } },
                        },
                        non_fuel: {
                          kind: "object",
                          fields: { gross_amount_decimal: { kind: "decimal_string" } },
                        },
                        tax: {
                          kind: "object",
                          fields: {
                            local_amount_decimal: { kind: "decimal_string" },
                            national_amount_decimal: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "object",
                  fields: {
                    quantity_decimal: { kind: "decimal_string" },
                    unit_cost_decimal: { kind: "decimal_string" },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          capture: eq({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/capture",
            requestSchema: {
              kind: "object",
              fields: {
                purchase_details: {
                  kind: "object",
                  fields: {
                    fleet: {
                      kind: "object",
                      fields: {
                        reported_breakdown: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "object",
                              fields: { gross_amount_decimal: { kind: "decimal_string" } },
                            },
                            non_fuel: {
                              kind: "object",
                              fields: { gross_amount_decimal: { kind: "decimal_string" } },
                            },
                            tax: {
                              kind: "object",
                              fields: {
                                local_amount_decimal: { kind: "decimal_string" },
                                national_amount_decimal: { kind: "decimal_string" },
                              },
                            },
                          },
                        },
                      },
                    },
                    fuel: {
                      kind: "object",
                      fields: {
                        quantity_decimal: { kind: "decimal_string" },
                        unit_cost_decimal: { kind: "decimal_string" },
                      },
                    },
                    receipt: {
                      kind: "array",
                      element: { kind: "object", fields: { quantity: { kind: "decimal_string" } } },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          expire: eq({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/expire",
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          finalizeAmount: eq({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/finalize_amount",
            requestSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "object",
                  fields: {
                    reported_breakdown: {
                      kind: "object",
                      fields: {
                        fuel: {
                          kind: "object",
                          fields: { gross_amount_decimal: { kind: "decimal_string" } },
                        },
                        non_fuel: {
                          kind: "object",
                          fields: { gross_amount_decimal: { kind: "decimal_string" } },
                        },
                        tax: {
                          kind: "object",
                          fields: {
                            local_amount_decimal: { kind: "decimal_string" },
                            national_amount_decimal: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "object",
                  fields: {
                    quantity_decimal: { kind: "decimal_string" },
                    unit_cost_decimal: { kind: "decimal_string" },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          increment: eq({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/increment",
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          respond: eq({
            method: "POST",
            fullPath:
              "/v1/test_helpers/issuing/authorizations/{authorization}/fraud_challenges/respond",
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          reverse: eq({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/reverse",
            responseSchema: {
              kind: "object",
              fields: {
                fleet: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      reported_breakdown: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            non_fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  gross_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tax: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  local_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  national_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                fuel: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_cost_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                transactions: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        eF = ef.method,
        eB = ef.extend({
          create: eF({ method: "POST", fullPath: "/v1/tax/calculations" }),
          retrieve: eF({ method: "GET", fullPath: "/v1/tax/calculations/{calculation}" }),
          listLineItems: eF({
            method: "GET",
            fullPath: "/v1/tax/calculations/{calculation}/line_items",
            methodType: "list",
          }),
        }),
        eU = ef.method,
        e$ = ef.extend({
          create: eU({ method: "POST", fullPath: "/v1/issuing/cardholders" }),
          retrieve: eU({ method: "GET", fullPath: "/v1/issuing/cardholders/{cardholder}" }),
          update: eU({ method: "POST", fullPath: "/v1/issuing/cardholders/{cardholder}" }),
          list: eU({ method: "GET", fullPath: "/v1/issuing/cardholders", methodType: "list" }),
        }),
        eW = ef.method,
        eH = ef.extend({
          create: eW({ method: "POST", fullPath: "/v1/issuing/cards" }),
          retrieve: eW({ method: "GET", fullPath: "/v1/issuing/cards/{card}" }),
          update: eW({ method: "POST", fullPath: "/v1/issuing/cards/{card}" }),
          list: eW({ method: "GET", fullPath: "/v1/issuing/cards", methodType: "list" }),
        }),
        ez = ef.method,
        eK = ef.extend({
          deliverCard: ez({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/deliver",
          }),
          failCard: ez({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/fail",
          }),
          returnCard: ez({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/return",
          }),
          shipCard: ez({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/ship",
          }),
          submitCard: ez({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/submit",
          }),
        }),
        eX = ef.method,
        eY = ef.extend({
          create: eX({ method: "POST", fullPath: "/v1/billing_portal/configurations" }),
          retrieve: eX({
            method: "GET",
            fullPath: "/v1/billing_portal/configurations/{configuration}",
          }),
          update: eX({
            method: "POST",
            fullPath: "/v1/billing_portal/configurations/{configuration}",
          }),
          list: eX({
            method: "GET",
            fullPath: "/v1/billing_portal/configurations",
            methodType: "list",
          }),
        }),
        eQ = ef.method,
        eJ = ef.extend({
          create: eQ({ method: "POST", fullPath: "/v1/terminal/configurations" }),
          retrieve: eQ({ method: "GET", fullPath: "/v1/terminal/configurations/{configuration}" }),
          update: eQ({ method: "POST", fullPath: "/v1/terminal/configurations/{configuration}" }),
          list: eQ({ method: "GET", fullPath: "/v1/terminal/configurations", methodType: "list" }),
          del: eQ({ method: "DELETE", fullPath: "/v1/terminal/configurations/{configuration}" }),
        }),
        eZ = ef.method,
        e0 = ef.extend({
          create: eZ({ method: "POST", fullPath: "/v1/test_helpers/confirmation_tokens" }),
        }),
        e1 = ef.method,
        e2 = ef.extend({
          create: e1({ method: "POST", fullPath: "/v1/terminal/connection_tokens" }),
        }),
        e5 = ef.method,
        e4 = ef.extend({
          retrieve: e5({ method: "GET", fullPath: "/v1/billing/credit_balance_summary" }),
        }),
        e6 = ef.method,
        e3 = ef.extend({
          retrieve: e6({ method: "GET", fullPath: "/v1/billing/credit_balance_transactions/{id}" }),
          list: e6({
            method: "GET",
            fullPath: "/v1/billing/credit_balance_transactions",
            methodType: "list",
          }),
        }),
        e9 = ef.method,
        e7 = ef.extend({
          create: e9({ method: "POST", fullPath: "/v1/billing/credit_grants" }),
          retrieve: e9({ method: "GET", fullPath: "/v1/billing/credit_grants/{id}" }),
          update: e9({ method: "POST", fullPath: "/v1/billing/credit_grants/{id}" }),
          list: e9({ method: "GET", fullPath: "/v1/billing/credit_grants", methodType: "list" }),
          expire: e9({ method: "POST", fullPath: "/v1/billing/credit_grants/{id}/expire" }),
          voidGrant: e9({ method: "POST", fullPath: "/v1/billing/credit_grants/{id}/void" }),
        }),
        e8 = ef.method,
        te = ef.extend({
          create: e8({ method: "POST", fullPath: "/v1/treasury/credit_reversals" }),
          retrieve: e8({
            method: "GET",
            fullPath: "/v1/treasury/credit_reversals/{credit_reversal}",
          }),
          list: e8({
            method: "GET",
            fullPath: "/v1/treasury/credit_reversals",
            methodType: "list",
          }),
        }),
        tt = ef.method,
        ti = ef.extend({
          fundCashBalance: tt({
            method: "POST",
            fullPath: "/v1/test_helpers/customers/{customer}/fund_cash_balance",
          }),
        }),
        tn = ef.method,
        ta = ef.extend({
          create: tn({ method: "POST", fullPath: "/v1/treasury/debit_reversals" }),
          retrieve: tn({
            method: "GET",
            fullPath: "/v1/treasury/debit_reversals/{debit_reversal}",
          }),
          list: tn({ method: "GET", fullPath: "/v1/treasury/debit_reversals", methodType: "list" }),
        }),
        tr = ef.method,
        tl = ef.extend({
          create: tr({ method: "POST", fullPath: "/v1/issuing/disputes" }),
          retrieve: tr({ method: "GET", fullPath: "/v1/issuing/disputes/{dispute}" }),
          update: tr({ method: "POST", fullPath: "/v1/issuing/disputes/{dispute}" }),
          list: tr({ method: "GET", fullPath: "/v1/issuing/disputes", methodType: "list" }),
          submit: tr({ method: "POST", fullPath: "/v1/issuing/disputes/{dispute}/submit" }),
        }),
        ts = ef.method,
        to = ef.extend({
          retrieve: ts({
            method: "GET",
            fullPath: "/v1/radar/early_fraud_warnings/{early_fraud_warning}",
          }),
          list: ts({
            method: "GET",
            fullPath: "/v1/radar/early_fraud_warnings",
            methodType: "list",
          }),
        }),
        td = ef.method,
        tu = ef.extend({
          create: td({ method: "POST", fullPath: "/v2/core/event_destinations" }),
          retrieve: td({ method: "GET", fullPath: "/v2/core/event_destinations/{id}" }),
          update: td({ method: "POST", fullPath: "/v2/core/event_destinations/{id}" }),
          list: td({ method: "GET", fullPath: "/v2/core/event_destinations", methodType: "list" }),
          del: td({ method: "DELETE", fullPath: "/v2/core/event_destinations/{id}" }),
          disable: td({ method: "POST", fullPath: "/v2/core/event_destinations/{id}/disable" }),
          enable: td({ method: "POST", fullPath: "/v2/core/event_destinations/{id}/enable" }),
          ping: td({ method: "POST", fullPath: "/v2/core/event_destinations/{id}/ping" }),
        }),
        tc = ef.method,
        tm = ef.extend({
          retrieve(...e) {
            return tc({
              method: "GET",
              fullPath: "/v2/core/events/{id}",
              transformResponseData: (e) => this.addFetchRelatedObjectIfNeeded(e),
            }).apply(this, e);
          },
          list(...e) {
            return tc({
              method: "GET",
              fullPath: "/v2/core/events",
              methodType: "list",
              transformResponseData: (e) => ({
                ...e,
                data: e.data.map(this.addFetchRelatedObjectIfNeeded.bind(this)),
              }),
            }).apply(this, e);
          },
          addFetchRelatedObjectIfNeeded(e) {
            return e.related_object && e.related_object.url
              ? {
                  ...e,
                  fetchRelatedObject: () =>
                    tc({ method: "GET", fullPath: e.related_object.url }).apply(this, [
                      {
                        stripeContext: e.context,
                        headers: { "Stripe-Request-Trigger": `event=${e.id}` },
                      },
                    ]),
                }
              : e;
          },
        }),
        th = ef.method,
        tf = ef.extend({
          create: th({ method: "POST", fullPath: "/v1/entitlements/features" }),
          retrieve: th({ method: "GET", fullPath: "/v1/entitlements/features/{id}" }),
          update: th({ method: "POST", fullPath: "/v1/entitlements/features/{id}" }),
          list: th({ method: "GET", fullPath: "/v1/entitlements/features", methodType: "list" }),
        }),
        tp = ef.method,
        tk = ef.extend({
          create: tp({ method: "POST", fullPath: "/v1/treasury/financial_accounts" }),
          retrieve: tp({
            method: "GET",
            fullPath: "/v1/treasury/financial_accounts/{financial_account}",
          }),
          update: tp({
            method: "POST",
            fullPath: "/v1/treasury/financial_accounts/{financial_account}",
          }),
          list: tp({
            method: "GET",
            fullPath: "/v1/treasury/financial_accounts",
            methodType: "list",
          }),
          close: tp({
            method: "POST",
            fullPath: "/v1/treasury/financial_accounts/{financial_account}/close",
          }),
          retrieveFeatures: tp({
            method: "GET",
            fullPath: "/v1/treasury/financial_accounts/{financial_account}/features",
          }),
          updateFeatures: tp({
            method: "POST",
            fullPath: "/v1/treasury/financial_accounts/{financial_account}/features",
          }),
        }),
        t_ = ef.method,
        tb = ef.extend({
          fail: t_({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/inbound_transfers/{id}/fail",
          }),
          returnInboundTransfer: t_({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/inbound_transfers/{id}/return",
          }),
          succeed: t_({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/inbound_transfers/{id}/succeed",
          }),
        }),
        tg = ef.method,
        ty = ef.extend({
          create: tg({ method: "POST", fullPath: "/v1/treasury/inbound_transfers" }),
          retrieve: tg({ method: "GET", fullPath: "/v1/treasury/inbound_transfers/{id}" }),
          list: tg({
            method: "GET",
            fullPath: "/v1/treasury/inbound_transfers",
            methodType: "list",
          }),
          cancel: tg({
            method: "POST",
            fullPath: "/v1/treasury/inbound_transfers/{inbound_transfer}/cancel",
          }),
        }),
        tv = ef.method,
        tP = ef.extend({
          create: tv({ method: "POST", fullPath: "/v1/terminal/locations" }),
          retrieve: tv({ method: "GET", fullPath: "/v1/terminal/locations/{location}" }),
          update: tv({ method: "POST", fullPath: "/v1/terminal/locations/{location}" }),
          list: tv({ method: "GET", fullPath: "/v1/terminal/locations", methodType: "list" }),
          del: tv({ method: "DELETE", fullPath: "/v1/terminal/locations/{location}" }),
        }),
        tT = ef.method,
        tj = ef.extend({
          create: tT({ method: "POST", fullPath: "/v1/billing/meter_event_adjustments" }),
        }),
        tx = ef.method,
        tS = ef.extend({
          create: tx({ method: "POST", fullPath: "/v2/billing/meter_event_adjustments" }),
        }),
        tE = ef.method,
        tw = ef.extend({
          create: tE({ method: "POST", fullPath: "/v2/billing/meter_event_session" }),
        }),
        tO = ef.method,
        tA = ef.extend({
          create: tO({
            method: "POST",
            fullPath: "/v2/billing/meter_event_stream",
            host: "meter-events.stripe.com",
          }),
        }),
        tC = ef.method,
        tR = ef.extend({ create: tC({ method: "POST", fullPath: "/v1/billing/meter_events" }) }),
        tM = ef.method,
        tD = ef.extend({ create: tM({ method: "POST", fullPath: "/v2/billing/meter_events" }) }),
        tG = ef.method,
        tI = ef.extend({
          create: tG({ method: "POST", fullPath: "/v1/billing/meters" }),
          retrieve: tG({ method: "GET", fullPath: "/v1/billing/meters/{id}" }),
          update: tG({ method: "POST", fullPath: "/v1/billing/meters/{id}" }),
          list: tG({ method: "GET", fullPath: "/v1/billing/meters", methodType: "list" }),
          deactivate: tG({ method: "POST", fullPath: "/v1/billing/meters/{id}/deactivate" }),
          listEventSummaries: tG({
            method: "GET",
            fullPath: "/v1/billing/meters/{id}/event_summaries",
            methodType: "list",
          }),
          reactivate: tG({ method: "POST", fullPath: "/v1/billing/meters/{id}/reactivate" }),
        }),
        tV = ef.method,
        tL = ef.extend({
          create: tV({ method: "POST", fullPath: "/v1/terminal/onboarding_links" }),
        }),
        tq = ef.method,
        tN = ef.extend({
          create: tq({
            method: "POST",
            fullPath: "/v1/climate/orders",
            requestSchema: { kind: "object", fields: { metric_tons: { kind: "decimal_string" } } },
            responseSchema: { kind: "object", fields: { metric_tons: { kind: "decimal_string" } } },
          }),
          retrieve: tq({
            method: "GET",
            fullPath: "/v1/climate/orders/{order}",
            responseSchema: { kind: "object", fields: { metric_tons: { kind: "decimal_string" } } },
          }),
          update: tq({
            method: "POST",
            fullPath: "/v1/climate/orders/{order}",
            responseSchema: { kind: "object", fields: { metric_tons: { kind: "decimal_string" } } },
          }),
          list: tq({
            method: "GET",
            fullPath: "/v1/climate/orders",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: { kind: "object", fields: { metric_tons: { kind: "decimal_string" } } },
                },
              },
            },
          }),
          cancel: tq({
            method: "POST",
            fullPath: "/v1/climate/orders/{order}/cancel",
            responseSchema: { kind: "object", fields: { metric_tons: { kind: "decimal_string" } } },
          }),
        }),
        tF = ef.method,
        tB = ef.extend({
          update: tF({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}",
          }),
          fail: tF({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}/fail",
          }),
          post: tF({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}/post",
          }),
          returnOutboundPayment: tF({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}/return",
          }),
        }),
        tU = ef.method,
        t$ = ef.extend({
          create: tU({ method: "POST", fullPath: "/v1/treasury/outbound_payments" }),
          retrieve: tU({ method: "GET", fullPath: "/v1/treasury/outbound_payments/{id}" }),
          list: tU({
            method: "GET",
            fullPath: "/v1/treasury/outbound_payments",
            methodType: "list",
          }),
          cancel: tU({ method: "POST", fullPath: "/v1/treasury/outbound_payments/{id}/cancel" }),
        }),
        tW = ef.method,
        tH = ef.extend({
          update: tW({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}",
          }),
          fail: tW({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/fail",
          }),
          post: tW({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/post",
          }),
          returnOutboundTransfer: tW({
            method: "POST",
            fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/return",
          }),
        }),
        tz = ef.method,
        tK = ef.extend({
          create: tz({ method: "POST", fullPath: "/v1/treasury/outbound_transfers" }),
          retrieve: tz({
            method: "GET",
            fullPath: "/v1/treasury/outbound_transfers/{outbound_transfer}",
          }),
          list: tz({
            method: "GET",
            fullPath: "/v1/treasury/outbound_transfers",
            methodType: "list",
          }),
          cancel: tz({
            method: "POST",
            fullPath: "/v1/treasury/outbound_transfers/{outbound_transfer}/cancel",
          }),
        }),
        tX = ef.method,
        tY = ef.extend({
          create: tX({ method: "POST", fullPath: "/v1/radar/payment_evaluations" }),
        }),
        tQ = ef.method,
        tJ = ef.extend({
          create: tQ({ method: "POST", fullPath: "/v1/issuing/personalization_designs" }),
          retrieve: tQ({
            method: "GET",
            fullPath: "/v1/issuing/personalization_designs/{personalization_design}",
          }),
          update: tQ({
            method: "POST",
            fullPath: "/v1/issuing/personalization_designs/{personalization_design}",
          }),
          list: tQ({
            method: "GET",
            fullPath: "/v1/issuing/personalization_designs",
            methodType: "list",
          }),
        }),
        tZ = ef.method,
        t0 = ef.extend({
          activate: tZ({
            method: "POST",
            fullPath:
              "/v1/test_helpers/issuing/personalization_designs/{personalization_design}/activate",
          }),
          deactivate: tZ({
            method: "POST",
            fullPath:
              "/v1/test_helpers/issuing/personalization_designs/{personalization_design}/deactivate",
          }),
          reject: tZ({
            method: "POST",
            fullPath:
              "/v1/test_helpers/issuing/personalization_designs/{personalization_design}/reject",
          }),
        }),
        t1 = ef.method,
        t2 = ef.extend({
          retrieve: t1({
            method: "GET",
            fullPath: "/v1/issuing/physical_bundles/{physical_bundle}",
          }),
          list: t1({ method: "GET", fullPath: "/v1/issuing/physical_bundles", methodType: "list" }),
        }),
        t5 = ef.method,
        t4 = ef.extend({
          retrieve: t5({
            method: "GET",
            fullPath: "/v1/climate/products/{product}",
            responseSchema: {
              kind: "object",
              fields: { metric_tons_available: { kind: "decimal_string" } },
            },
          }),
          list: t5({
            method: "GET",
            fullPath: "/v1/climate/products",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: { metric_tons_available: { kind: "decimal_string" } },
                  },
                },
              },
            },
          }),
        }),
        t6 = ef.method,
        t3 = ef.extend({
          create: t6({ method: "POST", fullPath: "/v1/terminal/readers" }),
          retrieve: t6({ method: "GET", fullPath: "/v1/terminal/readers/{reader}" }),
          update: t6({ method: "POST", fullPath: "/v1/terminal/readers/{reader}" }),
          list: t6({ method: "GET", fullPath: "/v1/terminal/readers", methodType: "list" }),
          del: t6({ method: "DELETE", fullPath: "/v1/terminal/readers/{reader}" }),
          cancelAction: t6({
            method: "POST",
            fullPath: "/v1/terminal/readers/{reader}/cancel_action",
          }),
          collectInputs: t6({
            method: "POST",
            fullPath: "/v1/terminal/readers/{reader}/collect_inputs",
          }),
          collectPaymentMethod: t6({
            method: "POST",
            fullPath: "/v1/terminal/readers/{reader}/collect_payment_method",
          }),
          confirmPaymentIntent: t6({
            method: "POST",
            fullPath: "/v1/terminal/readers/{reader}/confirm_payment_intent",
          }),
          processPaymentIntent: t6({
            method: "POST",
            fullPath: "/v1/terminal/readers/{reader}/process_payment_intent",
          }),
          processSetupIntent: t6({
            method: "POST",
            fullPath: "/v1/terminal/readers/{reader}/process_setup_intent",
          }),
          refundPayment: t6({
            method: "POST",
            fullPath: "/v1/terminal/readers/{reader}/refund_payment",
          }),
          setReaderDisplay: t6({
            method: "POST",
            fullPath: "/v1/terminal/readers/{reader}/set_reader_display",
          }),
        }),
        t9 = ef.method,
        t7 = ef.extend({
          presentPaymentMethod: t9({
            method: "POST",
            fullPath: "/v1/test_helpers/terminal/readers/{reader}/present_payment_method",
          }),
          succeedInputCollection: t9({
            method: "POST",
            fullPath: "/v1/test_helpers/terminal/readers/{reader}/succeed_input_collection",
          }),
          timeoutInputCollection: t9({
            method: "POST",
            fullPath: "/v1/test_helpers/terminal/readers/{reader}/timeout_input_collection",
          }),
        }),
        t8 = ef.method,
        ie = ef.extend({
          create: t8({ method: "POST", fullPath: "/v1/test_helpers/treasury/received_credits" }),
        }),
        it = ef.method,
        ii = ef.extend({
          retrieve: it({ method: "GET", fullPath: "/v1/treasury/received_credits/{id}" }),
          list: it({
            method: "GET",
            fullPath: "/v1/treasury/received_credits",
            methodType: "list",
          }),
        }),
        ia = ef.method,
        ir = ef.extend({
          create: ia({ method: "POST", fullPath: "/v1/test_helpers/treasury/received_debits" }),
        }),
        il = ef.method,
        is = ef.extend({
          retrieve: il({ method: "GET", fullPath: "/v1/treasury/received_debits/{id}" }),
          list: il({ method: "GET", fullPath: "/v1/treasury/received_debits", methodType: "list" }),
        }),
        io = ef.method,
        id = ef.extend({
          expire: io({ method: "POST", fullPath: "/v1/test_helpers/refunds/{refund}/expire" }),
        }),
        iu = ef.method,
        ic = ef.extend({
          create: iu({ method: "POST", fullPath: "/v1/tax/registrations" }),
          retrieve: iu({ method: "GET", fullPath: "/v1/tax/registrations/{id}" }),
          update: iu({ method: "POST", fullPath: "/v1/tax/registrations/{id}" }),
          list: iu({ method: "GET", fullPath: "/v1/tax/registrations", methodType: "list" }),
        }),
        im = ef.method,
        ih = ef.extend({
          create: im({ method: "POST", fullPath: "/v1/reporting/report_runs" }),
          retrieve: im({ method: "GET", fullPath: "/v1/reporting/report_runs/{report_run}" }),
          list: im({ method: "GET", fullPath: "/v1/reporting/report_runs", methodType: "list" }),
        }),
        ip = ef.method,
        ik = ef.extend({
          retrieve: ip({ method: "GET", fullPath: "/v1/reporting/report_types/{report_type}" }),
          list: ip({ method: "GET", fullPath: "/v1/reporting/report_types", methodType: "list" }),
        }),
        i_ = ef.method,
        ib = ef.extend({
          create: i_({ method: "POST", fullPath: "/v1/forwarding/requests" }),
          retrieve: i_({ method: "GET", fullPath: "/v1/forwarding/requests/{id}" }),
          list: i_({ method: "GET", fullPath: "/v1/forwarding/requests", methodType: "list" }),
        }),
        ig = ef.method,
        iy = ef.extend({
          retrieve: ig({
            method: "GET",
            fullPath: "/v1/sigma/scheduled_query_runs/{scheduled_query_run}",
          }),
          list: ig({
            method: "GET",
            fullPath: "/v1/sigma/scheduled_query_runs",
            methodType: "list",
          }),
        }),
        iv = ef.method,
        iP = ef.extend({
          create: iv({ method: "POST", fullPath: "/v1/apps/secrets" }),
          list: iv({ method: "GET", fullPath: "/v1/apps/secrets", methodType: "list" }),
          deleteWhere: iv({ method: "POST", fullPath: "/v1/apps/secrets/delete" }),
          find: iv({ method: "GET", fullPath: "/v1/apps/secrets/find" }),
        }),
        iT = ef.method,
        ij = ef.extend({ create: iT({ method: "POST", fullPath: "/v1/billing_portal/sessions" }) }),
        ix = ef.method,
        iS = ef.extend({
          create: ix({
            method: "POST",
            fullPath: "/v1/checkout/sessions",
            requestSchema: {
              kind: "object",
              fields: {
                line_items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                currency_conversion: {
                  kind: "nullable",
                  inner: { kind: "object", fields: { fx_rate: { kind: "decimal_string" } } },
                },
                line_items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          price: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                currency_options: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      tiers: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            flat_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                tiers: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      flat_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: ix({
            method: "GET",
            fullPath: "/v1/checkout/sessions/{session}",
            responseSchema: {
              kind: "object",
              fields: {
                currency_conversion: {
                  kind: "nullable",
                  inner: { kind: "object", fields: { fx_rate: { kind: "decimal_string" } } },
                },
                line_items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          price: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                currency_options: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      tiers: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            flat_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                tiers: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      flat_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          update: ix({
            method: "POST",
            fullPath: "/v1/checkout/sessions/{session}",
            requestSchema: {
              kind: "object",
              fields: {
                line_items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                currency_conversion: {
                  kind: "nullable",
                  inner: { kind: "object", fields: { fx_rate: { kind: "decimal_string" } } },
                },
                line_items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          price: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                currency_options: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      tiers: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            flat_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                tiers: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      flat_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: ix({
            method: "GET",
            fullPath: "/v1/checkout/sessions",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      currency_conversion: {
                        kind: "nullable",
                        inner: { kind: "object", fields: { fx_rate: { kind: "decimal_string" } } },
                      },
                      line_items: {
                        kind: "object",
                        fields: {
                          data: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                price: {
                                  kind: "nullable",
                                  inner: {
                                    kind: "object",
                                    fields: {
                                      currency_options: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            tiers: {
                                              kind: "array",
                                              element: {
                                                kind: "object",
                                                fields: {
                                                  flat_amount_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                  unit_amount_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                },
                                              },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      tiers: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            flat_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          expire: ix({
            method: "POST",
            fullPath: "/v1/checkout/sessions/{session}/expire",
            responseSchema: {
              kind: "object",
              fields: {
                currency_conversion: {
                  kind: "nullable",
                  inner: { kind: "object", fields: { fx_rate: { kind: "decimal_string" } } },
                },
                line_items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          price: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                currency_options: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      tiers: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            flat_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                tiers: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      flat_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          listLineItems: ix({
            method: "GET",
            fullPath: "/v1/checkout/sessions/{session}/line_items",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            currency_options: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  tiers: {
                                    kind: "array",
                                    element: {
                                      kind: "object",
                                      fields: {
                                        flat_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tiers: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  flat_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        iE = ef.method,
        iw = ef.extend({
          create: iE({ method: "POST", fullPath: "/v1/financial_connections/sessions" }),
          retrieve: iE({ method: "GET", fullPath: "/v1/financial_connections/sessions/{session}" }),
        }),
        iO = ef.method,
        iA = ef.extend({
          retrieve: iO({ method: "GET", fullPath: "/v1/tax/settings" }),
          update: iO({ method: "POST", fullPath: "/v1/tax/settings" }),
        }),
        iC = ef.method,
        iR = ef.extend({
          retrieve: iC({ method: "GET", fullPath: "/v1/climate/suppliers/{supplier}" }),
          list: iC({ method: "GET", fullPath: "/v1/climate/suppliers", methodType: "list" }),
        }),
        iM = ef.method,
        iD = ef.extend({
          create: iM({ method: "POST", fullPath: "/v1/test_helpers/test_clocks" }),
          retrieve: iM({ method: "GET", fullPath: "/v1/test_helpers/test_clocks/{test_clock}" }),
          list: iM({ method: "GET", fullPath: "/v1/test_helpers/test_clocks", methodType: "list" }),
          del: iM({ method: "DELETE", fullPath: "/v1/test_helpers/test_clocks/{test_clock}" }),
          advance: iM({
            method: "POST",
            fullPath: "/v1/test_helpers/test_clocks/{test_clock}/advance",
          }),
        }),
        iG = ef.method,
        iI = ef.extend({
          retrieve: iG({ method: "GET", fullPath: "/v1/issuing/tokens/{token}" }),
          update: iG({ method: "POST", fullPath: "/v1/issuing/tokens/{token}" }),
          list: iG({ method: "GET", fullPath: "/v1/issuing/tokens", methodType: "list" }),
        }),
        iV = ef.method,
        iL = ef.extend({
          retrieve: iV({
            method: "GET",
            fullPath: "/v1/treasury/transaction_entries/{id}",
            responseSchema: {
              kind: "object",
              fields: {
                flow_details: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      issuing_authorization: {
                        kind: "object",
                        fields: {
                          fleet: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                reported_breakdown: {
                                  kind: "nullable",
                                  inner: {
                                    kind: "object",
                                    fields: {
                                      fuel: {
                                        kind: "nullable",
                                        inner: {
                                          kind: "object",
                                          fields: {
                                            gross_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      non_fuel: {
                                        kind: "nullable",
                                        inner: {
                                          kind: "object",
                                          fields: {
                                            gross_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      tax: {
                                        kind: "nullable",
                                        inner: {
                                          kind: "object",
                                          fields: {
                                            local_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            national_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          fuel: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                quantity_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                                unit_cost_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          transactions: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                purchase_details: {
                                  kind: "nullable",
                                  inner: {
                                    kind: "object",
                                    fields: {
                                      fleet: {
                                        kind: "nullable",
                                        inner: {
                                          kind: "object",
                                          fields: {
                                            reported_breakdown: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  fuel: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        gross_amount_decimal: {
                                                          kind: "nullable",
                                                          inner: { kind: "decimal_string" },
                                                        },
                                                      },
                                                    },
                                                  },
                                                  non_fuel: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        gross_amount_decimal: {
                                                          kind: "nullable",
                                                          inner: { kind: "decimal_string" },
                                                        },
                                                      },
                                                    },
                                                  },
                                                  tax: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        local_amount_decimal: {
                                                          kind: "nullable",
                                                          inner: { kind: "decimal_string" },
                                                        },
                                                        national_amount_decimal: {
                                                          kind: "nullable",
                                                          inner: { kind: "decimal_string" },
                                                        },
                                                      },
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                      fuel: {
                                        kind: "nullable",
                                        inner: {
                                          kind: "object",
                                          fields: {
                                            quantity_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_cost_decimal: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: iV({
            method: "GET",
            fullPath: "/v1/treasury/transaction_entries",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      flow_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            issuing_authorization: {
                              kind: "object",
                              fields: {
                                fleet: {
                                  kind: "nullable",
                                  inner: {
                                    kind: "object",
                                    fields: {
                                      reported_breakdown: {
                                        kind: "nullable",
                                        inner: {
                                          kind: "object",
                                          fields: {
                                            fuel: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  gross_amount_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                },
                                              },
                                            },
                                            non_fuel: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  gross_amount_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                },
                                              },
                                            },
                                            tax: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  local_amount_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                  national_amount_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                                fuel: {
                                  kind: "nullable",
                                  inner: {
                                    kind: "object",
                                    fields: {
                                      quantity_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                      unit_cost_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                transactions: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      purchase_details: {
                                        kind: "nullable",
                                        inner: {
                                          kind: "object",
                                          fields: {
                                            fleet: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  reported_breakdown: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        fuel: {
                                                          kind: "nullable",
                                                          inner: {
                                                            kind: "object",
                                                            fields: {
                                                              gross_amount_decimal: {
                                                                kind: "nullable",
                                                                inner: { kind: "decimal_string" },
                                                              },
                                                            },
                                                          },
                                                        },
                                                        non_fuel: {
                                                          kind: "nullable",
                                                          inner: {
                                                            kind: "object",
                                                            fields: {
                                                              gross_amount_decimal: {
                                                                kind: "nullable",
                                                                inner: { kind: "decimal_string" },
                                                              },
                                                            },
                                                          },
                                                        },
                                                        tax: {
                                                          kind: "nullable",
                                                          inner: {
                                                            kind: "object",
                                                            fields: {
                                                              local_amount_decimal: {
                                                                kind: "nullable",
                                                                inner: { kind: "decimal_string" },
                                                              },
                                                              national_amount_decimal: {
                                                                kind: "nullable",
                                                                inner: { kind: "decimal_string" },
                                                              },
                                                            },
                                                          },
                                                        },
                                                      },
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                            fuel: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  quantity_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                  unit_cost_decimal: { kind: "decimal_string" },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        iq = ef.method,
        iN = ef.extend({
          retrieve: iq({
            method: "GET",
            fullPath: "/v1/financial_connections/transactions/{transaction}",
          }),
          list: iq({
            method: "GET",
            fullPath: "/v1/financial_connections/transactions",
            methodType: "list",
          }),
        }),
        iF = ef.method,
        iB = ef.extend({
          retrieve: iF({
            method: "GET",
            fullPath: "/v1/issuing/transactions/{transaction}",
            responseSchema: {
              kind: "object",
              fields: {
                purchase_details: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      fleet: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            reported_breakdown: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  non_fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  tax: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        local_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        national_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      fuel: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            quantity_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_cost_decimal: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          update: iF({
            method: "POST",
            fullPath: "/v1/issuing/transactions/{transaction}",
            responseSchema: {
              kind: "object",
              fields: {
                purchase_details: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      fleet: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            reported_breakdown: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  non_fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  tax: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        local_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        national_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      fuel: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            quantity_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_cost_decimal: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: iF({
            method: "GET",
            fullPath: "/v1/issuing/transactions",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      purchase_details: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            fleet: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  reported_breakdown: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        non_fuel: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              gross_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tax: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              local_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              national_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            fuel: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  quantity_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_cost_decimal: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        iU = ef.method,
        i$ = ef.extend({
          retrieve: iU({ method: "GET", fullPath: "/v1/tax/transactions/{transaction}" }),
          createFromCalculation: iU({
            method: "POST",
            fullPath: "/v1/tax/transactions/create_from_calculation",
          }),
          createReversal: iU({ method: "POST", fullPath: "/v1/tax/transactions/create_reversal" }),
          listLineItems: iU({
            method: "GET",
            fullPath: "/v1/tax/transactions/{transaction}/line_items",
            methodType: "list",
          }),
        }),
        iW = ef.method,
        iH = ef.extend({
          createForceCapture: iW({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/transactions/create_force_capture",
            requestSchema: {
              kind: "object",
              fields: {
                purchase_details: {
                  kind: "object",
                  fields: {
                    fleet: {
                      kind: "object",
                      fields: {
                        reported_breakdown: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "object",
                              fields: { gross_amount_decimal: { kind: "decimal_string" } },
                            },
                            non_fuel: {
                              kind: "object",
                              fields: { gross_amount_decimal: { kind: "decimal_string" } },
                            },
                            tax: {
                              kind: "object",
                              fields: {
                                local_amount_decimal: { kind: "decimal_string" },
                                national_amount_decimal: { kind: "decimal_string" },
                              },
                            },
                          },
                        },
                      },
                    },
                    fuel: {
                      kind: "object",
                      fields: {
                        quantity_decimal: { kind: "decimal_string" },
                        unit_cost_decimal: { kind: "decimal_string" },
                      },
                    },
                    receipt: {
                      kind: "array",
                      element: { kind: "object", fields: { quantity: { kind: "decimal_string" } } },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                purchase_details: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      fleet: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            reported_breakdown: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  non_fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  tax: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        local_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        national_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      fuel: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            quantity_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_cost_decimal: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          createUnlinkedRefund: iW({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/transactions/create_unlinked_refund",
            requestSchema: {
              kind: "object",
              fields: {
                purchase_details: {
                  kind: "object",
                  fields: {
                    fleet: {
                      kind: "object",
                      fields: {
                        reported_breakdown: {
                          kind: "object",
                          fields: {
                            fuel: {
                              kind: "object",
                              fields: { gross_amount_decimal: { kind: "decimal_string" } },
                            },
                            non_fuel: {
                              kind: "object",
                              fields: { gross_amount_decimal: { kind: "decimal_string" } },
                            },
                            tax: {
                              kind: "object",
                              fields: {
                                local_amount_decimal: { kind: "decimal_string" },
                                national_amount_decimal: { kind: "decimal_string" },
                              },
                            },
                          },
                        },
                      },
                    },
                    fuel: {
                      kind: "object",
                      fields: {
                        quantity_decimal: { kind: "decimal_string" },
                        unit_cost_decimal: { kind: "decimal_string" },
                      },
                    },
                    receipt: {
                      kind: "array",
                      element: { kind: "object", fields: { quantity: { kind: "decimal_string" } } },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                purchase_details: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      fleet: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            reported_breakdown: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  non_fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  tax: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        local_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        national_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      fuel: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            quantity_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_cost_decimal: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          refund: iW({
            method: "POST",
            fullPath: "/v1/test_helpers/issuing/transactions/{transaction}/refund",
            responseSchema: {
              kind: "object",
              fields: {
                purchase_details: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      fleet: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            reported_breakdown: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  non_fuel: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        gross_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  tax: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        local_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        national_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      fuel: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            quantity_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_cost_decimal: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        iz = ef.method,
        iK = ef.extend({
          retrieve: iz({
            method: "GET",
            fullPath: "/v1/treasury/transactions/{id}",
            responseSchema: {
              kind: "object",
              fields: {
                entries: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      data: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            flow_details: {
                              kind: "nullable",
                              inner: {
                                kind: "object",
                                fields: {
                                  issuing_authorization: {
                                    kind: "object",
                                    fields: {
                                      fleet: {
                                        kind: "nullable",
                                        inner: {
                                          kind: "object",
                                          fields: {
                                            reported_breakdown: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  fuel: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        gross_amount_decimal: {
                                                          kind: "nullable",
                                                          inner: { kind: "decimal_string" },
                                                        },
                                                      },
                                                    },
                                                  },
                                                  non_fuel: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        gross_amount_decimal: {
                                                          kind: "nullable",
                                                          inner: { kind: "decimal_string" },
                                                        },
                                                      },
                                                    },
                                                  },
                                                  tax: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        local_amount_decimal: {
                                                          kind: "nullable",
                                                          inner: { kind: "decimal_string" },
                                                        },
                                                        national_amount_decimal: {
                                                          kind: "nullable",
                                                          inner: { kind: "decimal_string" },
                                                        },
                                                      },
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                      fuel: {
                                        kind: "nullable",
                                        inner: {
                                          kind: "object",
                                          fields: {
                                            quantity_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_cost_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      transactions: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            purchase_details: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  fleet: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        reported_breakdown: {
                                                          kind: "nullable",
                                                          inner: {
                                                            kind: "object",
                                                            fields: {
                                                              fuel: {
                                                                kind: "nullable",
                                                                inner: {
                                                                  kind: "object",
                                                                  fields: {
                                                                    gross_amount_decimal: {
                                                                      kind: "nullable",
                                                                      inner: {
                                                                        kind: "decimal_string",
                                                                      },
                                                                    },
                                                                  },
                                                                },
                                                              },
                                                              non_fuel: {
                                                                kind: "nullable",
                                                                inner: {
                                                                  kind: "object",
                                                                  fields: {
                                                                    gross_amount_decimal: {
                                                                      kind: "nullable",
                                                                      inner: {
                                                                        kind: "decimal_string",
                                                                      },
                                                                    },
                                                                  },
                                                                },
                                                              },
                                                              tax: {
                                                                kind: "nullable",
                                                                inner: {
                                                                  kind: "object",
                                                                  fields: {
                                                                    local_amount_decimal: {
                                                                      kind: "nullable",
                                                                      inner: {
                                                                        kind: "decimal_string",
                                                                      },
                                                                    },
                                                                    national_amount_decimal: {
                                                                      kind: "nullable",
                                                                      inner: {
                                                                        kind: "decimal_string",
                                                                      },
                                                                    },
                                                                  },
                                                                },
                                                              },
                                                            },
                                                          },
                                                        },
                                                      },
                                                    },
                                                  },
                                                  fuel: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        quantity_decimal: {
                                                          kind: "nullable",
                                                          inner: { kind: "decimal_string" },
                                                        },
                                                        unit_cost_decimal: {
                                                          kind: "decimal_string",
                                                        },
                                                      },
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: iz({
            method: "GET",
            fullPath: "/v1/treasury/transactions",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      entries: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            data: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  flow_details: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        issuing_authorization: {
                                          kind: "object",
                                          fields: {
                                            fleet: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  reported_breakdown: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        fuel: {
                                                          kind: "nullable",
                                                          inner: {
                                                            kind: "object",
                                                            fields: {
                                                              gross_amount_decimal: {
                                                                kind: "nullable",
                                                                inner: { kind: "decimal_string" },
                                                              },
                                                            },
                                                          },
                                                        },
                                                        non_fuel: {
                                                          kind: "nullable",
                                                          inner: {
                                                            kind: "object",
                                                            fields: {
                                                              gross_amount_decimal: {
                                                                kind: "nullable",
                                                                inner: { kind: "decimal_string" },
                                                              },
                                                            },
                                                          },
                                                        },
                                                        tax: {
                                                          kind: "nullable",
                                                          inner: {
                                                            kind: "object",
                                                            fields: {
                                                              local_amount_decimal: {
                                                                kind: "nullable",
                                                                inner: { kind: "decimal_string" },
                                                              },
                                                              national_amount_decimal: {
                                                                kind: "nullable",
                                                                inner: { kind: "decimal_string" },
                                                              },
                                                            },
                                                          },
                                                        },
                                                      },
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                            fuel: {
                                              kind: "nullable",
                                              inner: {
                                                kind: "object",
                                                fields: {
                                                  quantity_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                  unit_cost_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                },
                                              },
                                            },
                                            transactions: {
                                              kind: "array",
                                              element: {
                                                kind: "object",
                                                fields: {
                                                  purchase_details: {
                                                    kind: "nullable",
                                                    inner: {
                                                      kind: "object",
                                                      fields: {
                                                        fleet: {
                                                          kind: "nullable",
                                                          inner: {
                                                            kind: "object",
                                                            fields: {
                                                              reported_breakdown: {
                                                                kind: "nullable",
                                                                inner: {
                                                                  kind: "object",
                                                                  fields: {
                                                                    fuel: {
                                                                      kind: "nullable",
                                                                      inner: {
                                                                        kind: "object",
                                                                        fields: {
                                                                          gross_amount_decimal: {
                                                                            kind: "nullable",
                                                                            inner: {
                                                                              kind: "decimal_string",
                                                                            },
                                                                          },
                                                                        },
                                                                      },
                                                                    },
                                                                    non_fuel: {
                                                                      kind: "nullable",
                                                                      inner: {
                                                                        kind: "object",
                                                                        fields: {
                                                                          gross_amount_decimal: {
                                                                            kind: "nullable",
                                                                            inner: {
                                                                              kind: "decimal_string",
                                                                            },
                                                                          },
                                                                        },
                                                                      },
                                                                    },
                                                                    tax: {
                                                                      kind: "nullable",
                                                                      inner: {
                                                                        kind: "object",
                                                                        fields: {
                                                                          local_amount_decimal: {
                                                                            kind: "nullable",
                                                                            inner: {
                                                                              kind: "decimal_string",
                                                                            },
                                                                          },
                                                                          national_amount_decimal: {
                                                                            kind: "nullable",
                                                                            inner: {
                                                                              kind: "decimal_string",
                                                                            },
                                                                          },
                                                                        },
                                                                      },
                                                                    },
                                                                  },
                                                                },
                                                              },
                                                            },
                                                          },
                                                        },
                                                        fuel: {
                                                          kind: "nullable",
                                                          inner: {
                                                            kind: "object",
                                                            fields: {
                                                              quantity_decimal: {
                                                                kind: "nullable",
                                                                inner: { kind: "decimal_string" },
                                                              },
                                                              unit_cost_decimal: {
                                                                kind: "decimal_string",
                                                              },
                                                            },
                                                          },
                                                        },
                                                      },
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        iX = ef.method,
        iY = ef.extend({
          create: iX({ method: "POST", fullPath: "/v1/radar/value_list_items" }),
          retrieve: iX({ method: "GET", fullPath: "/v1/radar/value_list_items/{item}" }),
          list: iX({ method: "GET", fullPath: "/v1/radar/value_list_items", methodType: "list" }),
          del: iX({ method: "DELETE", fullPath: "/v1/radar/value_list_items/{item}" }),
        }),
        iQ = ef.method,
        iJ = ef.extend({
          create: iQ({ method: "POST", fullPath: "/v1/radar/value_lists" }),
          retrieve: iQ({ method: "GET", fullPath: "/v1/radar/value_lists/{value_list}" }),
          update: iQ({ method: "POST", fullPath: "/v1/radar/value_lists/{value_list}" }),
          list: iQ({ method: "GET", fullPath: "/v1/radar/value_lists", methodType: "list" }),
          del: iQ({ method: "DELETE", fullPath: "/v1/radar/value_lists/{value_list}" }),
        }),
        iZ = ef.method,
        i0 = ef.extend({
          retrieve: iZ({ method: "GET", fullPath: "/v1/identity/verification_reports/{report}" }),
          list: iZ({
            method: "GET",
            fullPath: "/v1/identity/verification_reports",
            methodType: "list",
          }),
        }),
        i1 = ef.method,
        i2 = ef.extend({
          create: i1({ method: "POST", fullPath: "/v1/identity/verification_sessions" }),
          retrieve: i1({ method: "GET", fullPath: "/v1/identity/verification_sessions/{session}" }),
          update: i1({ method: "POST", fullPath: "/v1/identity/verification_sessions/{session}" }),
          list: i1({
            method: "GET",
            fullPath: "/v1/identity/verification_sessions",
            methodType: "list",
          }),
          cancel: i1({
            method: "POST",
            fullPath: "/v1/identity/verification_sessions/{session}/cancel",
          }),
          redact: i1({
            method: "POST",
            fullPath: "/v1/identity/verification_sessions/{session}/redact",
          }),
        }),
        i5 = ef.method,
        i4 = ef.extend({
          create: i5({ method: "POST", fullPath: "/v1/accounts" }),
          retrieve(e, ...t) {
            return "string" == typeof e
              ? i5({ method: "GET", fullPath: "/v1/accounts/{id}" }).apply(this, [e, ...t])
              : (null == e && [].shift.apply([e, ...t]),
                i5({ method: "GET", fullPath: "/v1/account" }).apply(this, [e, ...t]));
          },
          update: i5({ method: "POST", fullPath: "/v1/accounts/{account}" }),
          list: i5({ method: "GET", fullPath: "/v1/accounts", methodType: "list" }),
          del: i5({ method: "DELETE", fullPath: "/v1/accounts/{account}" }),
          createExternalAccount: i5({
            method: "POST",
            fullPath: "/v1/accounts/{account}/external_accounts",
          }),
          createLoginLink: i5({ method: "POST", fullPath: "/v1/accounts/{account}/login_links" }),
          createPerson: i5({ method: "POST", fullPath: "/v1/accounts/{account}/persons" }),
          deleteExternalAccount: i5({
            method: "DELETE",
            fullPath: "/v1/accounts/{account}/external_accounts/{id}",
          }),
          deletePerson: i5({
            method: "DELETE",
            fullPath: "/v1/accounts/{account}/persons/{person}",
          }),
          listCapabilities: i5({
            method: "GET",
            fullPath: "/v1/accounts/{account}/capabilities",
            methodType: "list",
          }),
          listExternalAccounts: i5({
            method: "GET",
            fullPath: "/v1/accounts/{account}/external_accounts",
            methodType: "list",
          }),
          listPersons: i5({
            method: "GET",
            fullPath: "/v1/accounts/{account}/persons",
            methodType: "list",
          }),
          reject: i5({ method: "POST", fullPath: "/v1/accounts/{account}/reject" }),
          retrieveCurrent: i5({ method: "GET", fullPath: "/v1/account" }),
          retrieveCapability: i5({
            method: "GET",
            fullPath: "/v1/accounts/{account}/capabilities/{capability}",
          }),
          retrieveExternalAccount: i5({
            method: "GET",
            fullPath: "/v1/accounts/{account}/external_accounts/{id}",
          }),
          retrievePerson: i5({
            method: "GET",
            fullPath: "/v1/accounts/{account}/persons/{person}",
          }),
          updateCapability: i5({
            method: "POST",
            fullPath: "/v1/accounts/{account}/capabilities/{capability}",
          }),
          updateExternalAccount: i5({
            method: "POST",
            fullPath: "/v1/accounts/{account}/external_accounts/{id}",
          }),
          updatePerson: i5({ method: "POST", fullPath: "/v1/accounts/{account}/persons/{person}" }),
        }),
        i6 = ef.method,
        i3 = ef.extend({ create: i6({ method: "POST", fullPath: "/v1/account_links" }) }),
        i9 = ef.method,
        i7 = ef.extend({ create: i9({ method: "POST", fullPath: "/v1/account_sessions" }) }),
        i8 = ef.method,
        ne = ef.extend({
          create: i8({ method: "POST", fullPath: "/v1/apple_pay/domains" }),
          retrieve: i8({ method: "GET", fullPath: "/v1/apple_pay/domains/{domain}" }),
          list: i8({ method: "GET", fullPath: "/v1/apple_pay/domains", methodType: "list" }),
          del: i8({ method: "DELETE", fullPath: "/v1/apple_pay/domains/{domain}" }),
        }),
        nt = ef.method,
        ni = ef.extend({
          retrieve: nt({ method: "GET", fullPath: "/v1/application_fees/{id}" }),
          list: nt({ method: "GET", fullPath: "/v1/application_fees", methodType: "list" }),
          createRefund: nt({ method: "POST", fullPath: "/v1/application_fees/{id}/refunds" }),
          listRefunds: nt({
            method: "GET",
            fullPath: "/v1/application_fees/{id}/refunds",
            methodType: "list",
          }),
          retrieveRefund: nt({
            method: "GET",
            fullPath: "/v1/application_fees/{fee}/refunds/{id}",
          }),
          updateRefund: nt({ method: "POST", fullPath: "/v1/application_fees/{fee}/refunds/{id}" }),
        }),
        nn = ef.method,
        na = ef.extend({ retrieve: nn({ method: "GET", fullPath: "/v1/balance" }) }),
        nr = ef.method,
        nl = ef.extend({
          retrieve: nr({ method: "GET", fullPath: "/v1/balance_settings" }),
          update: nr({ method: "POST", fullPath: "/v1/balance_settings" }),
        }),
        ns = ef.method,
        no = ef.extend({
          retrieve: ns({ method: "GET", fullPath: "/v1/balance_transactions/{id}" }),
          list: ns({ method: "GET", fullPath: "/v1/balance_transactions", methodType: "list" }),
        }),
        nd = ef.method,
        nu = ef.extend({
          create: nd({ method: "POST", fullPath: "/v1/charges" }),
          retrieve: nd({ method: "GET", fullPath: "/v1/charges/{charge}" }),
          update: nd({ method: "POST", fullPath: "/v1/charges/{charge}" }),
          list: nd({ method: "GET", fullPath: "/v1/charges", methodType: "list" }),
          capture: nd({ method: "POST", fullPath: "/v1/charges/{charge}/capture" }),
          search: nd({ method: "GET", fullPath: "/v1/charges/search", methodType: "search" }),
        }),
        nc = ef.method,
        nm = ef.extend({
          retrieve: nc({ method: "GET", fullPath: "/v1/confirmation_tokens/{confirmation_token}" }),
        }),
        nh = ef.method,
        nf = ef.extend({
          retrieve: nh({ method: "GET", fullPath: "/v1/country_specs/{country}" }),
          list: nh({ method: "GET", fullPath: "/v1/country_specs", methodType: "list" }),
        }),
        np = ef.method,
        nk = ef.extend({
          create: np({ method: "POST", fullPath: "/v1/coupons" }),
          retrieve: np({ method: "GET", fullPath: "/v1/coupons/{coupon}" }),
          update: np({ method: "POST", fullPath: "/v1/coupons/{coupon}" }),
          list: np({ method: "GET", fullPath: "/v1/coupons", methodType: "list" }),
          del: np({ method: "DELETE", fullPath: "/v1/coupons/{coupon}" }),
        }),
        n_ = ef.method,
        nb = ef.extend({
          create: n_({
            method: "POST",
            fullPath: "/v1/credit_notes",
            requestSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: { unit_amount_decimal: { kind: "decimal_string" } },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: n_({
            method: "GET",
            fullPath: "/v1/credit_notes/{id}",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          update: n_({
            method: "POST",
            fullPath: "/v1/credit_notes/{id}",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: n_({
            method: "GET",
            fullPath: "/v1/credit_notes",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      lines: {
                        kind: "object",
                        fields: {
                          data: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          listLineItems: n_({
            method: "GET",
            fullPath: "/v1/credit_notes/{credit_note}/lines",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
              },
            },
          }),
          listPreviewLineItems: n_({
            method: "GET",
            fullPath: "/v1/credit_notes/preview/lines",
            methodType: "list",
            requestSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: { unit_amount_decimal: { kind: "decimal_string" } },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
              },
            },
          }),
          preview: n_({
            method: "GET",
            fullPath: "/v1/credit_notes/preview",
            requestSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: { unit_amount_decimal: { kind: "decimal_string" } },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          voidCreditNote: n_({
            method: "POST",
            fullPath: "/v1/credit_notes/{id}/void",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        ng = ef.method,
        ny = ef.extend({ create: ng({ method: "POST", fullPath: "/v1/customer_sessions" }) }),
        nv = ef.method,
        nP = ef.extend({
          create: nv({
            method: "POST",
            fullPath: "/v1/customers",
            responseSchema: {
              kind: "object",
              fields: {
                subscriptions: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          items: {
                            kind: "object",
                            fields: {
                              data: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    plan: {
                                      kind: "object",
                                      fields: {
                                        amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                    price: {
                                      kind: "object",
                                      fields: {
                                        currency_options: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: nv({ method: "GET", fullPath: "/v1/customers/{customer}" }),
          update: nv({
            method: "POST",
            fullPath: "/v1/customers/{customer}",
            responseSchema: {
              kind: "object",
              fields: {
                subscriptions: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          items: {
                            kind: "object",
                            fields: {
                              data: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    plan: {
                                      kind: "object",
                                      fields: {
                                        amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                    price: {
                                      kind: "object",
                                      fields: {
                                        currency_options: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: nv({
            method: "GET",
            fullPath: "/v1/customers",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      subscriptions: {
                        kind: "object",
                        fields: {
                          data: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                items: {
                                  kind: "object",
                                  fields: {
                                    data: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          plan: {
                                            kind: "object",
                                            fields: {
                                              amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                          },
                                          price: {
                                            kind: "object",
                                            fields: {
                                              currency_options: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    tiers: {
                                                      kind: "array",
                                                      element: {
                                                        kind: "object",
                                                        fields: {
                                                          flat_amount_decimal: {
                                                            kind: "nullable",
                                                            inner: { kind: "decimal_string" },
                                                          },
                                                          unit_amount_decimal: {
                                                            kind: "nullable",
                                                            inner: { kind: "decimal_string" },
                                                          },
                                                        },
                                                      },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          del: nv({ method: "DELETE", fullPath: "/v1/customers/{customer}" }),
          createBalanceTransaction: nv({
            method: "POST",
            fullPath: "/v1/customers/{customer}/balance_transactions",
          }),
          createFundingInstructions: nv({
            method: "POST",
            fullPath: "/v1/customers/{customer}/funding_instructions",
          }),
          createSource: nv({ method: "POST", fullPath: "/v1/customers/{customer}/sources" }),
          createTaxId: nv({ method: "POST", fullPath: "/v1/customers/{customer}/tax_ids" }),
          deleteDiscount: nv({ method: "DELETE", fullPath: "/v1/customers/{customer}/discount" }),
          deleteSource: nv({ method: "DELETE", fullPath: "/v1/customers/{customer}/sources/{id}" }),
          deleteTaxId: nv({ method: "DELETE", fullPath: "/v1/customers/{customer}/tax_ids/{id}" }),
          listBalanceTransactions: nv({
            method: "GET",
            fullPath: "/v1/customers/{customer}/balance_transactions",
            methodType: "list",
          }),
          listCashBalanceTransactions: nv({
            method: "GET",
            fullPath: "/v1/customers/{customer}/cash_balance_transactions",
            methodType: "list",
          }),
          listPaymentMethods: nv({
            method: "GET",
            fullPath: "/v1/customers/{customer}/payment_methods",
            methodType: "list",
          }),
          listSources: nv({
            method: "GET",
            fullPath: "/v1/customers/{customer}/sources",
            methodType: "list",
          }),
          listTaxIds: nv({
            method: "GET",
            fullPath: "/v1/customers/{customer}/tax_ids",
            methodType: "list",
          }),
          retrieveBalanceTransaction: nv({
            method: "GET",
            fullPath: "/v1/customers/{customer}/balance_transactions/{transaction}",
          }),
          retrieveCashBalance: nv({
            method: "GET",
            fullPath: "/v1/customers/{customer}/cash_balance",
          }),
          retrieveCashBalanceTransaction: nv({
            method: "GET",
            fullPath: "/v1/customers/{customer}/cash_balance_transactions/{transaction}",
          }),
          retrievePaymentMethod: nv({
            method: "GET",
            fullPath: "/v1/customers/{customer}/payment_methods/{payment_method}",
          }),
          retrieveSource: nv({ method: "GET", fullPath: "/v1/customers/{customer}/sources/{id}" }),
          retrieveTaxId: nv({ method: "GET", fullPath: "/v1/customers/{customer}/tax_ids/{id}" }),
          search: nv({
            method: "GET",
            fullPath: "/v1/customers/search",
            methodType: "search",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      subscriptions: {
                        kind: "object",
                        fields: {
                          data: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                items: {
                                  kind: "object",
                                  fields: {
                                    data: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          plan: {
                                            kind: "object",
                                            fields: {
                                              amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                            },
                                          },
                                          price: {
                                            kind: "object",
                                            fields: {
                                              currency_options: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    tiers: {
                                                      kind: "array",
                                                      element: {
                                                        kind: "object",
                                                        fields: {
                                                          flat_amount_decimal: {
                                                            kind: "nullable",
                                                            inner: { kind: "decimal_string" },
                                                          },
                                                          unit_amount_decimal: {
                                                            kind: "nullable",
                                                            inner: { kind: "decimal_string" },
                                                          },
                                                        },
                                                      },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          updateBalanceTransaction: nv({
            method: "POST",
            fullPath: "/v1/customers/{customer}/balance_transactions/{transaction}",
          }),
          updateCashBalance: nv({
            method: "POST",
            fullPath: "/v1/customers/{customer}/cash_balance",
          }),
          updateSource: nv({ method: "POST", fullPath: "/v1/customers/{customer}/sources/{id}" }),
          verifySource: nv({
            method: "POST",
            fullPath: "/v1/customers/{customer}/sources/{id}/verify",
          }),
        }),
        nT = ef.method,
        nj = ef.extend({
          retrieve: nT({ method: "GET", fullPath: "/v1/disputes/{dispute}" }),
          update: nT({ method: "POST", fullPath: "/v1/disputes/{dispute}" }),
          list: nT({ method: "GET", fullPath: "/v1/disputes", methodType: "list" }),
          close: nT({ method: "POST", fullPath: "/v1/disputes/{dispute}/close" }),
        }),
        nx = ef.method,
        nS = ef.extend({
          create: nx({
            method: "POST",
            fullPath: "/v1/ephemeral_keys",
            validator: (e, t) => {
              if (!t.headers || !t.headers["Stripe-Version"])
                throw Error(
                  "Passing apiVersion in a separate options hash is required to create an ephemeral key. See https://stripe.com/docs/api/versioning?lang=node",
                );
            },
          }),
          del: nx({ method: "DELETE", fullPath: "/v1/ephemeral_keys/{key}" }),
        }),
        nE = ef.method,
        nw = ef.extend({
          retrieve: nE({ method: "GET", fullPath: "/v1/events/{id}" }),
          list: nE({ method: "GET", fullPath: "/v1/events", methodType: "list" }),
        }),
        nO = ef.method,
        nA = ef.extend({
          retrieve: nO({ method: "GET", fullPath: "/v1/exchange_rates/{rate_id}" }),
          list: nO({ method: "GET", fullPath: "/v1/exchange_rates", methodType: "list" }),
        }),
        nC = ef.method,
        nR = ef.extend({
          create: nC({ method: "POST", fullPath: "/v1/file_links" }),
          retrieve: nC({ method: "GET", fullPath: "/v1/file_links/{link}" }),
          update: nC({ method: "POST", fullPath: "/v1/file_links/{link}" }),
          list: nC({ method: "GET", fullPath: "/v1/file_links", methodType: "list" }),
        }),
        nM = ef.method,
        nD = ef.extend({
          create: nM({
            method: "POST",
            fullPath: "/v1/files",
            headers: { "Content-Type": "multipart/form-data" },
            host: "files.stripe.com",
          }),
          retrieve: nM({ method: "GET", fullPath: "/v1/files/{file}" }),
          list: nM({ method: "GET", fullPath: "/v1/files", methodType: "list" }),
          requestDataProcessor: function (e, t, i, n) {
            if (((t = t || {}), "POST" !== e)) return n(null, d(t));
            this._stripe._platformFunctions
              .tryBufferData(t)
              .then((e) =>
                n(
                  null,
                  ((e, t, i) => {
                    const n = (
                      Math.round(1e16 * Math.random()) + Math.round(1e16 * Math.random())
                    ).toString();
                    i["Content-Type"] = `multipart/form-data; boundary=${n}`;
                    let a = new TextEncoder(),
                      r = new Uint8Array(0),
                      l = a.encode("\r\n");
                    function s(e) {
                      const t = r,
                        i = e instanceof Uint8Array ? e : new Uint8Array(a.encode(e));
                      (r = new Uint8Array(t.length + i.length + 2)).set(t),
                        r.set(i, t.length),
                        r.set(l, r.length - 2);
                    }
                    function o(e) {
                      return `"${e.replace(/"|"/g, "%22").replace(/\r\n|\r|\n/g, " ")}"`;
                    }
                    const d = ((e) => {
                      const t = {},
                        i = (e, n) => {
                          Object.entries(e).forEach(([e, a]) => {
                            const r = n ? `${n}[${e}]` : e;
                            if (
                              ((e) => {
                                const t = typeof e;
                                return ("function" === t || "object" === t) && !!e;
                              })(a)
                            )
                              if (!(a instanceof Uint8Array) && !Object.hasOwn(a, "data"))
                                return i(a, r);
                              else t[r] = a;
                            else t[r] = String(a);
                          });
                        };
                      return i(e, null), t;
                    })(t);
                    for (const e in d) {
                      if (!Object.hasOwn(d, e)) continue;
                      const t = d[e];
                      s(`--${n}`),
                        Object.hasOwn(t, "data")
                          ? (s(
                              `Content-Disposition: form-data; name=${o(e)}; filename=${o(t.name || "blob")}`,
                            ),
                            s(`Content-Type: ${t.type || "application/octet-stream"}`),
                            s(""),
                            s(t.data))
                          : (s(`Content-Disposition: form-data; name=${o(e)}`), s(""), s(t));
                    }
                    return s(`--${n}--`), r;
                  })(0, e, i),
                ),
              )
              .catch((e) => n(e, null));
          },
        }),
        nG = ef.method,
        nI = ef.extend({
          create: nG({
            method: "POST",
            fullPath: "/v1/invoiceitems",
            requestSchema: {
              kind: "object",
              fields: {
                price_data: {
                  kind: "object",
                  fields: { unit_amount_decimal: { kind: "decimal_string" } },
                },
                quantity_decimal: { kind: "decimal_string" },
                unit_amount_decimal: { kind: "decimal_string" },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                pricing: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                quantity_decimal: { kind: "decimal_string" },
              },
            },
          }),
          retrieve: nG({
            method: "GET",
            fullPath: "/v1/invoiceitems/{invoiceitem}",
            responseSchema: {
              kind: "object",
              fields: {
                pricing: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                quantity_decimal: { kind: "decimal_string" },
              },
            },
          }),
          update: nG({
            method: "POST",
            fullPath: "/v1/invoiceitems/{invoiceitem}",
            requestSchema: {
              kind: "object",
              fields: {
                price_data: {
                  kind: "object",
                  fields: { unit_amount_decimal: { kind: "decimal_string" } },
                },
                quantity_decimal: { kind: "decimal_string" },
                unit_amount_decimal: { kind: "decimal_string" },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                pricing: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                quantity_decimal: { kind: "decimal_string" },
              },
            },
          }),
          list: nG({
            method: "GET",
            fullPath: "/v1/invoiceitems",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      pricing: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      quantity_decimal: { kind: "decimal_string" },
                    },
                  },
                },
              },
            },
          }),
          del: nG({ method: "DELETE", fullPath: "/v1/invoiceitems/{invoiceitem}" }),
        }),
        nV = ef.method,
        nL = ef.extend({
          retrieve: nV({ method: "GET", fullPath: "/v1/invoice_payments/{invoice_payment}" }),
          list: nV({ method: "GET", fullPath: "/v1/invoice_payments", methodType: "list" }),
        }),
        nq = ef.method,
        nN = ef.extend({
          retrieve: nq({ method: "GET", fullPath: "/v1/invoice_rendering_templates/{template}" }),
          list: nq({
            method: "GET",
            fullPath: "/v1/invoice_rendering_templates",
            methodType: "list",
          }),
          archive: nq({
            method: "POST",
            fullPath: "/v1/invoice_rendering_templates/{template}/archive",
          }),
          unarchive: nq({
            method: "POST",
            fullPath: "/v1/invoice_rendering_templates/{template}/unarchive",
          }),
        }),
        nF = ef.method,
        nB = ef.extend({
          create: nF({
            method: "POST",
            fullPath: "/v1/invoices",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: nF({
            method: "GET",
            fullPath: "/v1/invoices/{invoice}",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          update: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: nF({
            method: "GET",
            fullPath: "/v1/invoices",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      lines: {
                        kind: "object",
                        fields: {
                          data: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                pricing: {
                                  kind: "nullable",
                                  inner: {
                                    kind: "object",
                                    fields: {
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                quantity_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          del: nF({ method: "DELETE", fullPath: "/v1/invoices/{invoice}" }),
          addLines: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/add_lines",
            requestSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                      quantity_decimal: { kind: "decimal_string" },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          attachPayment: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/attach_payment",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          createPreview: nF({
            method: "POST",
            fullPath: "/v1/invoices/create_preview",
            requestSchema: {
              kind: "object",
              fields: {
                invoice_items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                      quantity_decimal: { kind: "decimal_string" },
                      unit_amount_decimal: { kind: "decimal_string" },
                    },
                  },
                },
                schedule_details: {
                  kind: "object",
                  fields: {
                    phases: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          add_invoice_items: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                price_data: {
                                  kind: "object",
                                  fields: { unit_amount_decimal: { kind: "decimal_string" } },
                                },
                              },
                            },
                          },
                          items: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                price_data: {
                                  kind: "object",
                                  fields: { unit_amount_decimal: { kind: "decimal_string" } },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                subscription_details: {
                  kind: "object",
                  fields: {
                    items: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          price_data: {
                            kind: "object",
                            fields: { unit_amount_decimal: { kind: "decimal_string" } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          finalizeInvoice: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/finalize",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          listLineItems: nF({
            method: "GET",
            fullPath: "/v1/invoices/{invoice}/lines",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      pricing: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
              },
            },
          }),
          markUncollectible: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/mark_uncollectible",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          pay: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/pay",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          removeLines: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/remove_lines",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          search: nF({
            method: "GET",
            fullPath: "/v1/invoices/search",
            methodType: "search",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      lines: {
                        kind: "object",
                        fields: {
                          data: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                pricing: {
                                  kind: "nullable",
                                  inner: {
                                    kind: "object",
                                    fields: {
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                quantity_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          sendInvoice: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/send",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          updateLines: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/update_lines",
            requestSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                      quantity_decimal: { kind: "decimal_string" },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          updateLineItem: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/lines/{line_item_id}",
            requestSchema: {
              kind: "object",
              fields: {
                price_data: {
                  kind: "object",
                  fields: { unit_amount_decimal: { kind: "decimal_string" } },
                },
                quantity_decimal: { kind: "decimal_string" },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                pricing: {
                  kind: "nullable",
                  inner: {
                    kind: "object",
                    fields: {
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
              },
            },
          }),
          voidInvoice: nF({
            method: "POST",
            fullPath: "/v1/invoices/{invoice}/void",
            responseSchema: {
              kind: "object",
              fields: {
                lines: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          pricing: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          quantity_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        nU = ef.method,
        n$ = ef.extend({ retrieve: nU({ method: "GET", fullPath: "/v1/mandates/{mandate}" }) }),
        nW = ef.method,
        nH = "connect.stripe.com",
        nz = ef.extend({
          basePath: "/",
          authorizeUrl(e, t) {
            e = e || {};
            let i = "oauth/authorize";
            return (
              (t = t || {}).express && (i = `express/${i}`),
              e.response_type || (e.response_type = "code"),
              e.client_id || (e.client_id = this._stripe.getClientId()),
              e.scope || (e.scope = "read_write"),
              `https://${nH}/${i}?${d(e)}`
            );
          },
          token: nW({ method: "POST", path: "oauth/token", host: nH }),
          deauthorize(e, ...t) {
            return (
              e.client_id || (e.client_id = this._stripe.getClientId()),
              nW({ method: "POST", path: "oauth/deauthorize", host: nH }).apply(this, [e, ...t])
            );
          },
        }),
        nK = ef.method,
        nX = ef.extend({
          retrieve: nK({ method: "GET", fullPath: "/v1/payment_attempt_records/{id}" }),
          list: nK({ method: "GET", fullPath: "/v1/payment_attempt_records", methodType: "list" }),
        }),
        nY = ef.method,
        nQ = ef.extend({
          create: nY({ method: "POST", fullPath: "/v1/payment_intents" }),
          retrieve: nY({ method: "GET", fullPath: "/v1/payment_intents/{intent}" }),
          update: nY({ method: "POST", fullPath: "/v1/payment_intents/{intent}" }),
          list: nY({ method: "GET", fullPath: "/v1/payment_intents", methodType: "list" }),
          applyCustomerBalance: nY({
            method: "POST",
            fullPath: "/v1/payment_intents/{intent}/apply_customer_balance",
          }),
          cancel: nY({ method: "POST", fullPath: "/v1/payment_intents/{intent}/cancel" }),
          capture: nY({ method: "POST", fullPath: "/v1/payment_intents/{intent}/capture" }),
          confirm: nY({ method: "POST", fullPath: "/v1/payment_intents/{intent}/confirm" }),
          incrementAuthorization: nY({
            method: "POST",
            fullPath: "/v1/payment_intents/{intent}/increment_authorization",
          }),
          listAmountDetailsLineItems: nY({
            method: "GET",
            fullPath: "/v1/payment_intents/{intent}/amount_details_line_items",
            methodType: "list",
          }),
          search: nY({
            method: "GET",
            fullPath: "/v1/payment_intents/search",
            methodType: "search",
          }),
          verifyMicrodeposits: nY({
            method: "POST",
            fullPath: "/v1/payment_intents/{intent}/verify_microdeposits",
          }),
        }),
        nJ = ef.method,
        nZ = ef.extend({
          create: nJ({
            method: "POST",
            fullPath: "/v1/payment_links",
            requestSchema: {
              kind: "object",
              fields: {
                line_items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                line_items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          price: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                currency_options: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      tiers: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            flat_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                tiers: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      flat_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: nJ({
            method: "GET",
            fullPath: "/v1/payment_links/{payment_link}",
            responseSchema: {
              kind: "object",
              fields: {
                line_items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          price: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                currency_options: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      tiers: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            flat_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                tiers: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      flat_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          update: nJ({
            method: "POST",
            fullPath: "/v1/payment_links/{payment_link}",
            responseSchema: {
              kind: "object",
              fields: {
                line_items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          price: {
                            kind: "nullable",
                            inner: {
                              kind: "object",
                              fields: {
                                currency_options: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      tiers: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            flat_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                tiers: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      flat_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: nJ({
            method: "GET",
            fullPath: "/v1/payment_links",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      line_items: {
                        kind: "object",
                        fields: {
                          data: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                price: {
                                  kind: "nullable",
                                  inner: {
                                    kind: "object",
                                    fields: {
                                      currency_options: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            tiers: {
                                              kind: "array",
                                              element: {
                                                kind: "object",
                                                fields: {
                                                  flat_amount_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                  unit_amount_decimal: {
                                                    kind: "nullable",
                                                    inner: { kind: "decimal_string" },
                                                  },
                                                },
                                              },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      tiers: {
                                        kind: "array",
                                        element: {
                                          kind: "object",
                                          fields: {
                                            flat_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                            unit_amount_decimal: {
                                              kind: "nullable",
                                              inner: { kind: "decimal_string" },
                                            },
                                          },
                                        },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          listLineItems: nJ({
            method: "GET",
            fullPath: "/v1/payment_links/{payment_link}/line_items",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            currency_options: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  tiers: {
                                    kind: "array",
                                    element: {
                                      kind: "object",
                                      fields: {
                                        flat_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tiers: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  flat_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        n0 = ef.method,
        n1 = ef.extend({
          create: n0({ method: "POST", fullPath: "/v1/payment_method_configurations" }),
          retrieve: n0({
            method: "GET",
            fullPath: "/v1/payment_method_configurations/{configuration}",
          }),
          update: n0({
            method: "POST",
            fullPath: "/v1/payment_method_configurations/{configuration}",
          }),
          list: n0({
            method: "GET",
            fullPath: "/v1/payment_method_configurations",
            methodType: "list",
          }),
        }),
        n2 = ef.method,
        n5 = ef.extend({
          create: n2({ method: "POST", fullPath: "/v1/payment_method_domains" }),
          retrieve: n2({
            method: "GET",
            fullPath: "/v1/payment_method_domains/{payment_method_domain}",
          }),
          update: n2({
            method: "POST",
            fullPath: "/v1/payment_method_domains/{payment_method_domain}",
          }),
          list: n2({ method: "GET", fullPath: "/v1/payment_method_domains", methodType: "list" }),
          validate: n2({
            method: "POST",
            fullPath: "/v1/payment_method_domains/{payment_method_domain}/validate",
          }),
        }),
        n4 = ef.method,
        n6 = ef.extend({
          create: n4({ method: "POST", fullPath: "/v1/payment_methods" }),
          retrieve: n4({ method: "GET", fullPath: "/v1/payment_methods/{payment_method}" }),
          update: n4({ method: "POST", fullPath: "/v1/payment_methods/{payment_method}" }),
          list: n4({ method: "GET", fullPath: "/v1/payment_methods", methodType: "list" }),
          attach: n4({ method: "POST", fullPath: "/v1/payment_methods/{payment_method}/attach" }),
          detach: n4({ method: "POST", fullPath: "/v1/payment_methods/{payment_method}/detach" }),
        }),
        n3 = ef.method,
        n9 = ef.extend({
          retrieve: n3({ method: "GET", fullPath: "/v1/payment_records/{id}" }),
          reportPayment: n3({ method: "POST", fullPath: "/v1/payment_records/report_payment" }),
          reportPaymentAttempt: n3({
            method: "POST",
            fullPath: "/v1/payment_records/{id}/report_payment_attempt",
          }),
          reportPaymentAttemptCanceled: n3({
            method: "POST",
            fullPath: "/v1/payment_records/{id}/report_payment_attempt_canceled",
          }),
          reportPaymentAttemptFailed: n3({
            method: "POST",
            fullPath: "/v1/payment_records/{id}/report_payment_attempt_failed",
          }),
          reportPaymentAttemptGuaranteed: n3({
            method: "POST",
            fullPath: "/v1/payment_records/{id}/report_payment_attempt_guaranteed",
          }),
          reportPaymentAttemptInformational: n3({
            method: "POST",
            fullPath: "/v1/payment_records/{id}/report_payment_attempt_informational",
          }),
          reportRefund: n3({ method: "POST", fullPath: "/v1/payment_records/{id}/report_refund" }),
        }),
        n7 = ef.method,
        n8 = ef.extend({
          create: n7({ method: "POST", fullPath: "/v1/payouts" }),
          retrieve: n7({ method: "GET", fullPath: "/v1/payouts/{payout}" }),
          update: n7({ method: "POST", fullPath: "/v1/payouts/{payout}" }),
          list: n7({ method: "GET", fullPath: "/v1/payouts", methodType: "list" }),
          cancel: n7({ method: "POST", fullPath: "/v1/payouts/{payout}/cancel" }),
          reverse: n7({ method: "POST", fullPath: "/v1/payouts/{payout}/reverse" }),
        }),
        ae = ef.method,
        at = ef.extend({
          create: ae({
            method: "POST",
            fullPath: "/v1/plans",
            requestSchema: {
              kind: "object",
              fields: {
                amount_decimal: { kind: "decimal_string" },
                tiers: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      flat_amount_decimal: { kind: "decimal_string" },
                      unit_amount_decimal: { kind: "decimal_string" },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                tiers: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      flat_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
              },
            },
          }),
          retrieve: ae({
            method: "GET",
            fullPath: "/v1/plans/{plan}",
            responseSchema: {
              kind: "object",
              fields: {
                amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                tiers: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      flat_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
              },
            },
          }),
          update: ae({
            method: "POST",
            fullPath: "/v1/plans/{plan}",
            responseSchema: {
              kind: "object",
              fields: {
                amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                tiers: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      flat_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
              },
            },
          }),
          list: ae({
            method: "GET",
            fullPath: "/v1/plans",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      tiers: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            flat_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          del: ae({ method: "DELETE", fullPath: "/v1/plans/{plan}" }),
        }),
        ai = ef.method,
        an = ef.extend({
          create: ai({
            method: "POST",
            fullPath: "/v1/prices",
            requestSchema: {
              kind: "object",
              fields: {
                currency_options: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      tiers: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            flat_amount_decimal: { kind: "decimal_string" },
                            unit_amount_decimal: { kind: "decimal_string" },
                          },
                        },
                      },
                      unit_amount_decimal: { kind: "decimal_string" },
                    },
                  },
                },
                tiers: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      flat_amount_decimal: { kind: "decimal_string" },
                      unit_amount_decimal: { kind: "decimal_string" },
                    },
                  },
                },
                unit_amount_decimal: { kind: "decimal_string" },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                currency_options: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      tiers: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            flat_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                tiers: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      flat_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
              },
            },
          }),
          retrieve: ai({
            method: "GET",
            fullPath: "/v1/prices/{price}",
            responseSchema: {
              kind: "object",
              fields: {
                currency_options: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      tiers: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            flat_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                tiers: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      flat_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
              },
            },
          }),
          update: ai({
            method: "POST",
            fullPath: "/v1/prices/{price}",
            responseSchema: {
              kind: "object",
              fields: {
                currency_options: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      tiers: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            flat_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                tiers: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      flat_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
                unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
              },
            },
          }),
          list: ai({
            method: "GET",
            fullPath: "/v1/prices",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      currency_options: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            tiers: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  flat_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      tiers: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            flat_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
              },
            },
          }),
          search: ai({
            method: "GET",
            fullPath: "/v1/prices/search",
            methodType: "search",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      currency_options: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            tiers: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  flat_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      tiers: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            flat_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                      unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    },
                  },
                },
              },
            },
          }),
        }),
        aa = ef.method,
        ar = ef.extend({
          create: aa({
            method: "POST",
            fullPath: "/v1/products",
            requestSchema: {
              kind: "object",
              fields: {
                default_price_data: {
                  kind: "object",
                  fields: {
                    currency_options: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          tiers: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                flat_amount_decimal: { kind: "decimal_string" },
                                unit_amount_decimal: { kind: "decimal_string" },
                              },
                            },
                          },
                          unit_amount_decimal: { kind: "decimal_string" },
                        },
                      },
                    },
                    unit_amount_decimal: { kind: "decimal_string" },
                  },
                },
              },
            },
          }),
          retrieve: aa({ method: "GET", fullPath: "/v1/products/{id}" }),
          update: aa({ method: "POST", fullPath: "/v1/products/{id}" }),
          list: aa({ method: "GET", fullPath: "/v1/products", methodType: "list" }),
          del: aa({ method: "DELETE", fullPath: "/v1/products/{id}" }),
          createFeature: aa({ method: "POST", fullPath: "/v1/products/{product}/features" }),
          deleteFeature: aa({ method: "DELETE", fullPath: "/v1/products/{product}/features/{id}" }),
          listFeatures: aa({
            method: "GET",
            fullPath: "/v1/products/{product}/features",
            methodType: "list",
          }),
          retrieveFeature: aa({ method: "GET", fullPath: "/v1/products/{product}/features/{id}" }),
          search: aa({ method: "GET", fullPath: "/v1/products/search", methodType: "search" }),
        }),
        al = ef.method,
        as = ef.extend({
          create: al({ method: "POST", fullPath: "/v1/promotion_codes" }),
          retrieve: al({ method: "GET", fullPath: "/v1/promotion_codes/{promotion_code}" }),
          update: al({ method: "POST", fullPath: "/v1/promotion_codes/{promotion_code}" }),
          list: al({ method: "GET", fullPath: "/v1/promotion_codes", methodType: "list" }),
        }),
        ao = ef.method,
        ad = ef.extend({
          create: ao({
            method: "POST",
            fullPath: "/v1/quotes",
            requestSchema: {
              kind: "object",
              fields: {
                line_items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                computed: {
                  kind: "object",
                  fields: {
                    upfront: {
                      kind: "object",
                      fields: {
                        line_items: {
                          kind: "object",
                          fields: {
                            data: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  price: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        currency_options: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: ao({
            method: "GET",
            fullPath: "/v1/quotes/{quote}",
            responseSchema: {
              kind: "object",
              fields: {
                computed: {
                  kind: "object",
                  fields: {
                    upfront: {
                      kind: "object",
                      fields: {
                        line_items: {
                          kind: "object",
                          fields: {
                            data: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  price: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        currency_options: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          update: ao({
            method: "POST",
            fullPath: "/v1/quotes/{quote}",
            requestSchema: {
              kind: "object",
              fields: {
                line_items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                computed: {
                  kind: "object",
                  fields: {
                    upfront: {
                      kind: "object",
                      fields: {
                        line_items: {
                          kind: "object",
                          fields: {
                            data: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  price: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        currency_options: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: ao({
            method: "GET",
            fullPath: "/v1/quotes",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      computed: {
                        kind: "object",
                        fields: {
                          upfront: {
                            kind: "object",
                            fields: {
                              line_items: {
                                kind: "object",
                                fields: {
                                  data: {
                                    kind: "array",
                                    element: {
                                      kind: "object",
                                      fields: {
                                        price: {
                                          kind: "nullable",
                                          inner: {
                                            kind: "object",
                                            fields: {
                                              currency_options: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    tiers: {
                                                      kind: "array",
                                                      element: {
                                                        kind: "object",
                                                        fields: {
                                                          flat_amount_decimal: {
                                                            kind: "nullable",
                                                            inner: { kind: "decimal_string" },
                                                          },
                                                          unit_amount_decimal: {
                                                            kind: "nullable",
                                                            inner: { kind: "decimal_string" },
                                                          },
                                                        },
                                                      },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          accept: ao({
            method: "POST",
            fullPath: "/v1/quotes/{quote}/accept",
            responseSchema: {
              kind: "object",
              fields: {
                computed: {
                  kind: "object",
                  fields: {
                    upfront: {
                      kind: "object",
                      fields: {
                        line_items: {
                          kind: "object",
                          fields: {
                            data: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  price: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        currency_options: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          cancel: ao({
            method: "POST",
            fullPath: "/v1/quotes/{quote}/cancel",
            responseSchema: {
              kind: "object",
              fields: {
                computed: {
                  kind: "object",
                  fields: {
                    upfront: {
                      kind: "object",
                      fields: {
                        line_items: {
                          kind: "object",
                          fields: {
                            data: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  price: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        currency_options: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          finalizeQuote: ao({
            method: "POST",
            fullPath: "/v1/quotes/{quote}/finalize",
            responseSchema: {
              kind: "object",
              fields: {
                computed: {
                  kind: "object",
                  fields: {
                    upfront: {
                      kind: "object",
                      fields: {
                        line_items: {
                          kind: "object",
                          fields: {
                            data: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  price: {
                                    kind: "nullable",
                                    inner: {
                                      kind: "object",
                                      fields: {
                                        currency_options: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              tiers: {
                                                kind: "array",
                                                element: {
                                                  kind: "object",
                                                  fields: {
                                                    flat_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                    unit_amount_decimal: {
                                                      kind: "nullable",
                                                      inner: { kind: "decimal_string" },
                                                    },
                                                  },
                                                },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        tiers: {
                                          kind: "array",
                                          element: {
                                            kind: "object",
                                            fields: {
                                              flat_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                              unit_amount_decimal: {
                                                kind: "nullable",
                                                inner: { kind: "decimal_string" },
                                              },
                                            },
                                          },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          listComputedUpfrontLineItems: ao({
            method: "GET",
            fullPath: "/v1/quotes/{quote}/computed_upfront_line_items",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            currency_options: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  tiers: {
                                    kind: "array",
                                    element: {
                                      kind: "object",
                                      fields: {
                                        flat_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tiers: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  flat_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          listLineItems: ao({
            method: "GET",
            fullPath: "/v1/quotes/{quote}/line_items",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price: {
                        kind: "nullable",
                        inner: {
                          kind: "object",
                          fields: {
                            currency_options: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  tiers: {
                                    kind: "array",
                                    element: {
                                      kind: "object",
                                      fields: {
                                        flat_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                        unit_amount_decimal: {
                                          kind: "nullable",
                                          inner: { kind: "decimal_string" },
                                        },
                                      },
                                    },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            tiers: {
                              kind: "array",
                              element: {
                                kind: "object",
                                fields: {
                                  flat_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                  unit_amount_decimal: {
                                    kind: "nullable",
                                    inner: { kind: "decimal_string" },
                                  },
                                },
                              },
                            },
                            unit_amount_decimal: {
                              kind: "nullable",
                              inner: { kind: "decimal_string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          pdf: ao({
            method: "GET",
            fullPath: "/v1/quotes/{quote}/pdf",
            host: "files.stripe.com",
            streaming: !0,
          }),
        }),
        au = ef.method,
        ac = ef.extend({
          create: au({ method: "POST", fullPath: "/v1/refunds" }),
          retrieve: au({ method: "GET", fullPath: "/v1/refunds/{refund}" }),
          update: au({ method: "POST", fullPath: "/v1/refunds/{refund}" }),
          list: au({ method: "GET", fullPath: "/v1/refunds", methodType: "list" }),
          cancel: au({ method: "POST", fullPath: "/v1/refunds/{refund}/cancel" }),
        }),
        am = ef.method,
        ah = ef.extend({
          retrieve: am({ method: "GET", fullPath: "/v1/reviews/{review}" }),
          list: am({ method: "GET", fullPath: "/v1/reviews", methodType: "list" }),
          approve: am({ method: "POST", fullPath: "/v1/reviews/{review}/approve" }),
        }),
        af = ef.method,
        ap = ef.extend({
          list: af({ method: "GET", fullPath: "/v1/setup_attempts", methodType: "list" }),
        }),
        ak = ef.method,
        a_ = ef.extend({
          create: ak({ method: "POST", fullPath: "/v1/setup_intents" }),
          retrieve: ak({ method: "GET", fullPath: "/v1/setup_intents/{intent}" }),
          update: ak({ method: "POST", fullPath: "/v1/setup_intents/{intent}" }),
          list: ak({ method: "GET", fullPath: "/v1/setup_intents", methodType: "list" }),
          cancel: ak({ method: "POST", fullPath: "/v1/setup_intents/{intent}/cancel" }),
          confirm: ak({ method: "POST", fullPath: "/v1/setup_intents/{intent}/confirm" }),
          verifyMicrodeposits: ak({
            method: "POST",
            fullPath: "/v1/setup_intents/{intent}/verify_microdeposits",
          }),
        }),
        ab = ef.method,
        ag = ef.extend({
          create: ab({ method: "POST", fullPath: "/v1/shipping_rates" }),
          retrieve: ab({ method: "GET", fullPath: "/v1/shipping_rates/{shipping_rate_token}" }),
          update: ab({ method: "POST", fullPath: "/v1/shipping_rates/{shipping_rate_token}" }),
          list: ab({ method: "GET", fullPath: "/v1/shipping_rates", methodType: "list" }),
        }),
        ay = ef.method,
        av = ef.extend({
          create: ay({ method: "POST", fullPath: "/v1/sources" }),
          retrieve: ay({ method: "GET", fullPath: "/v1/sources/{source}" }),
          update: ay({ method: "POST", fullPath: "/v1/sources/{source}" }),
          listSourceTransactions: ay({
            method: "GET",
            fullPath: "/v1/sources/{source}/source_transactions",
            methodType: "list",
          }),
          verify: ay({ method: "POST", fullPath: "/v1/sources/{source}/verify" }),
        }),
        aP = ef.method,
        aT = ef.extend({
          create: aP({
            method: "POST",
            fullPath: "/v1/subscription_items",
            requestSchema: {
              kind: "object",
              fields: {
                price_data: {
                  kind: "object",
                  fields: { unit_amount_decimal: { kind: "decimal_string" } },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                plan: {
                  kind: "object",
                  fields: {
                    amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    tiers: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          flat_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
                price: {
                  kind: "object",
                  fields: {
                    currency_options: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          tiers: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                flat_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                    tiers: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          flat_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                    unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                  },
                },
              },
            },
          }),
          retrieve: aP({
            method: "GET",
            fullPath: "/v1/subscription_items/{item}",
            responseSchema: {
              kind: "object",
              fields: {
                plan: {
                  kind: "object",
                  fields: {
                    amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    tiers: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          flat_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
                price: {
                  kind: "object",
                  fields: {
                    currency_options: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          tiers: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                flat_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                    tiers: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          flat_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                    unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                  },
                },
              },
            },
          }),
          update: aP({
            method: "POST",
            fullPath: "/v1/subscription_items/{item}",
            requestSchema: {
              kind: "object",
              fields: {
                price_data: {
                  kind: "object",
                  fields: { unit_amount_decimal: { kind: "decimal_string" } },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                plan: {
                  kind: "object",
                  fields: {
                    amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                    tiers: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          flat_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
                price: {
                  kind: "object",
                  fields: {
                    currency_options: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          tiers: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                flat_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                    tiers: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          flat_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                    unit_amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                  },
                },
              },
            },
          }),
          list: aP({
            method: "GET",
            fullPath: "/v1/subscription_items",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      plan: {
                        kind: "object",
                        fields: {
                          amount_decimal: { kind: "nullable", inner: { kind: "decimal_string" } },
                          tiers: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                flat_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                        },
                      },
                      price: {
                        kind: "object",
                        fields: {
                          currency_options: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                tiers: {
                                  kind: "array",
                                  element: {
                                    kind: "object",
                                    fields: {
                                      flat_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                      unit_amount_decimal: {
                                        kind: "nullable",
                                        inner: { kind: "decimal_string" },
                                      },
                                    },
                                  },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          tiers: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                flat_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                                unit_amount_decimal: {
                                  kind: "nullable",
                                  inner: { kind: "decimal_string" },
                                },
                              },
                            },
                          },
                          unit_amount_decimal: {
                            kind: "nullable",
                            inner: { kind: "decimal_string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          del: aP({ method: "DELETE", fullPath: "/v1/subscription_items/{item}" }),
        }),
        aj = ef.method,
        ax = ef.extend({
          create: aj({
            method: "POST",
            fullPath: "/v1/subscription_schedules",
            requestSchema: {
              kind: "object",
              fields: {
                phases: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      add_invoice_items: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            price_data: {
                              kind: "object",
                              fields: { unit_amount_decimal: { kind: "decimal_string" } },
                            },
                          },
                        },
                      },
                      items: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            price_data: {
                              kind: "object",
                              fields: { unit_amount_decimal: { kind: "decimal_string" } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: aj({ method: "GET", fullPath: "/v1/subscription_schedules/{schedule}" }),
          update: aj({
            method: "POST",
            fullPath: "/v1/subscription_schedules/{schedule}",
            requestSchema: {
              kind: "object",
              fields: {
                phases: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      add_invoice_items: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            price_data: {
                              kind: "object",
                              fields: { unit_amount_decimal: { kind: "decimal_string" } },
                            },
                          },
                        },
                      },
                      items: {
                        kind: "array",
                        element: {
                          kind: "object",
                          fields: {
                            price_data: {
                              kind: "object",
                              fields: { unit_amount_decimal: { kind: "decimal_string" } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: aj({ method: "GET", fullPath: "/v1/subscription_schedules", methodType: "list" }),
          cancel: aj({ method: "POST", fullPath: "/v1/subscription_schedules/{schedule}/cancel" }),
          release: aj({
            method: "POST",
            fullPath: "/v1/subscription_schedules/{schedule}/release",
          }),
        }),
        aS = ef.method,
        aE = ef.extend({
          create: aS({
            method: "POST",
            fullPath: "/v1/subscriptions",
            requestSchema: {
              kind: "object",
              fields: {
                add_invoice_items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
                items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          plan: {
                            kind: "object",
                            fields: {
                              amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          price: {
                            kind: "object",
                            fields: {
                              currency_options: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              unit_amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          retrieve: aS({
            method: "GET",
            fullPath: "/v1/subscriptions/{subscription_exposed_id}",
            responseSchema: {
              kind: "object",
              fields: {
                items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          plan: {
                            kind: "object",
                            fields: {
                              amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          price: {
                            kind: "object",
                            fields: {
                              currency_options: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              unit_amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          update: aS({
            method: "POST",
            fullPath: "/v1/subscriptions/{subscription_exposed_id}",
            requestSchema: {
              kind: "object",
              fields: {
                add_invoice_items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
                items: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      price_data: {
                        kind: "object",
                        fields: { unit_amount_decimal: { kind: "decimal_string" } },
                      },
                    },
                  },
                },
              },
            },
            responseSchema: {
              kind: "object",
              fields: {
                items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          plan: {
                            kind: "object",
                            fields: {
                              amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          price: {
                            kind: "object",
                            fields: {
                              currency_options: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              unit_amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          list: aS({
            method: "GET",
            fullPath: "/v1/subscriptions",
            methodType: "list",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      items: {
                        kind: "object",
                        fields: {
                          data: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                plan: {
                                  kind: "object",
                                  fields: {
                                    amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                                price: {
                                  kind: "object",
                                  fields: {
                                    currency_options: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          tiers: {
                                            kind: "array",
                                            element: {
                                              kind: "object",
                                              fields: {
                                                flat_amount_decimal: {
                                                  kind: "nullable",
                                                  inner: { kind: "decimal_string" },
                                                },
                                                unit_amount_decimal: {
                                                  kind: "nullable",
                                                  inner: { kind: "decimal_string" },
                                                },
                                              },
                                            },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          cancel: aS({
            method: "DELETE",
            fullPath: "/v1/subscriptions/{subscription_exposed_id}",
            responseSchema: {
              kind: "object",
              fields: {
                items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          plan: {
                            kind: "object",
                            fields: {
                              amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          price: {
                            kind: "object",
                            fields: {
                              currency_options: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              unit_amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          deleteDiscount: aS({
            method: "DELETE",
            fullPath: "/v1/subscriptions/{subscription_exposed_id}/discount",
          }),
          migrate: aS({
            method: "POST",
            fullPath: "/v1/subscriptions/{subscription}/migrate",
            responseSchema: {
              kind: "object",
              fields: {
                items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          plan: {
                            kind: "object",
                            fields: {
                              amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          price: {
                            kind: "object",
                            fields: {
                              currency_options: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              unit_amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          resume: aS({
            method: "POST",
            fullPath: "/v1/subscriptions/{subscription}/resume",
            responseSchema: {
              kind: "object",
              fields: {
                items: {
                  kind: "object",
                  fields: {
                    data: {
                      kind: "array",
                      element: {
                        kind: "object",
                        fields: {
                          plan: {
                            kind: "object",
                            fields: {
                              amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          price: {
                            kind: "object",
                            fields: {
                              currency_options: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              tiers: {
                                kind: "array",
                                element: {
                                  kind: "object",
                                  fields: {
                                    flat_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                              unit_amount_decimal: {
                                kind: "nullable",
                                inner: { kind: "decimal_string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          search: aS({
            method: "GET",
            fullPath: "/v1/subscriptions/search",
            methodType: "search",
            responseSchema: {
              kind: "object",
              fields: {
                data: {
                  kind: "array",
                  element: {
                    kind: "object",
                    fields: {
                      items: {
                        kind: "object",
                        fields: {
                          data: {
                            kind: "array",
                            element: {
                              kind: "object",
                              fields: {
                                plan: {
                                  kind: "object",
                                  fields: {
                                    amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                                price: {
                                  kind: "object",
                                  fields: {
                                    currency_options: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          tiers: {
                                            kind: "array",
                                            element: {
                                              kind: "object",
                                              fields: {
                                                flat_amount_decimal: {
                                                  kind: "nullable",
                                                  inner: { kind: "decimal_string" },
                                                },
                                                unit_amount_decimal: {
                                                  kind: "nullable",
                                                  inner: { kind: "decimal_string" },
                                                },
                                              },
                                            },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    tiers: {
                                      kind: "array",
                                      element: {
                                        kind: "object",
                                        fields: {
                                          flat_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                          unit_amount_decimal: {
                                            kind: "nullable",
                                            inner: { kind: "decimal_string" },
                                          },
                                        },
                                      },
                                    },
                                    unit_amount_decimal: {
                                      kind: "nullable",
                                      inner: { kind: "decimal_string" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        aw = ef.method,
        aO = ef.extend({
          retrieve: aw({ method: "GET", fullPath: "/v1/tax_codes/{id}" }),
          list: aw({ method: "GET", fullPath: "/v1/tax_codes", methodType: "list" }),
        }),
        aA = ef.method,
        aC = ef.extend({
          create: aA({ method: "POST", fullPath: "/v1/tax_ids" }),
          retrieve: aA({ method: "GET", fullPath: "/v1/tax_ids/{id}" }),
          list: aA({ method: "GET", fullPath: "/v1/tax_ids", methodType: "list" }),
          del: aA({ method: "DELETE", fullPath: "/v1/tax_ids/{id}" }),
        }),
        aR = ef.method,
        aM = ef.extend({
          create: aR({ method: "POST", fullPath: "/v1/tax_rates" }),
          retrieve: aR({ method: "GET", fullPath: "/v1/tax_rates/{tax_rate}" }),
          update: aR({ method: "POST", fullPath: "/v1/tax_rates/{tax_rate}" }),
          list: aR({ method: "GET", fullPath: "/v1/tax_rates", methodType: "list" }),
        }),
        aD = ef.method,
        aG = ef.extend({
          create: aD({ method: "POST", fullPath: "/v1/tokens" }),
          retrieve: aD({ method: "GET", fullPath: "/v1/tokens/{token}" }),
        }),
        aI = ef.method,
        aV = ef.extend({
          create: aI({ method: "POST", fullPath: "/v1/topups" }),
          retrieve: aI({ method: "GET", fullPath: "/v1/topups/{topup}" }),
          update: aI({ method: "POST", fullPath: "/v1/topups/{topup}" }),
          list: aI({ method: "GET", fullPath: "/v1/topups", methodType: "list" }),
          cancel: aI({ method: "POST", fullPath: "/v1/topups/{topup}/cancel" }),
        }),
        aL = ef.method,
        aq = ef.extend({
          create: aL({ method: "POST", fullPath: "/v1/transfers" }),
          retrieve: aL({ method: "GET", fullPath: "/v1/transfers/{transfer}" }),
          update: aL({ method: "POST", fullPath: "/v1/transfers/{transfer}" }),
          list: aL({ method: "GET", fullPath: "/v1/transfers", methodType: "list" }),
          createReversal: aL({ method: "POST", fullPath: "/v1/transfers/{id}/reversals" }),
          listReversals: aL({
            method: "GET",
            fullPath: "/v1/transfers/{id}/reversals",
            methodType: "list",
          }),
          retrieveReversal: aL({
            method: "GET",
            fullPath: "/v1/transfers/{transfer}/reversals/{id}",
          }),
          updateReversal: aL({
            method: "POST",
            fullPath: "/v1/transfers/{transfer}/reversals/{id}",
          }),
        }),
        aN = ef.method,
        aF = ef.extend({
          create: aN({ method: "POST", fullPath: "/v1/webhook_endpoints" }),
          retrieve: aN({ method: "GET", fullPath: "/v1/webhook_endpoints/{webhook_endpoint}" }),
          update: aN({ method: "POST", fullPath: "/v1/webhook_endpoints/{webhook_endpoint}" }),
          list: aN({ method: "GET", fullPath: "/v1/webhook_endpoints", methodType: "list" }),
          del: aN({ method: "DELETE", fullPath: "/v1/webhook_endpoints/{webhook_endpoint}" }),
        }),
        aB = eb("apps", { Secrets: iP }),
        aU = eb("billing", {
          Alerts: eD,
          CreditBalanceSummary: e4,
          CreditBalanceTransactions: e3,
          CreditGrants: e7,
          MeterEventAdjustments: tj,
          MeterEvents: tR,
          Meters: tI,
        }),
        a$ = eb("billingPortal", { Configurations: eY, Sessions: ij }),
        aW = eb("checkout", { Sessions: iS }),
        aH = eb("climate", { Orders: tN, Products: t4, Suppliers: iR }),
        az = eb("entitlements", { ActiveEntitlements: eR, Features: tf }),
        aK = eb("financialConnections", { Accounts: ej, Sessions: iw, Transactions: iN }),
        aX = eb("forwarding", { Requests: ib }),
        aY = eb("identity", { VerificationReports: i0, VerificationSessions: i2 }),
        aQ = eb("issuing", {
          Authorizations: eL,
          Cardholders: e$,
          Cards: eH,
          Disputes: tl,
          PersonalizationDesigns: tJ,
          PhysicalBundles: t2,
          Tokens: iI,
          Transactions: iB,
        }),
        aJ = eb("radar", {
          EarlyFraudWarnings: to,
          PaymentEvaluations: tY,
          ValueListItems: iY,
          ValueLists: iJ,
        }),
        aZ = eb("reporting", { ReportRuns: ih, ReportTypes: ik }),
        a0 = eb("sigma", { ScheduledQueryRuns: iy }),
        a1 = eb("tax", {
          Associations: eI,
          Calculations: eB,
          Registrations: ic,
          Settings: iA,
          Transactions: i$,
        }),
        a2 = eb("terminal", {
          Configurations: eJ,
          ConnectionTokens: e2,
          Locations: tP,
          OnboardingLinks: tL,
          Readers: t3,
        }),
        a5 = eb("testHelpers", {
          ConfirmationTokens: e0,
          Customers: ti,
          Refunds: id,
          TestClocks: iD,
          Issuing: eb("issuing", {
            Authorizations: eN,
            Cards: eK,
            PersonalizationDesigns: t0,
            Transactions: iH,
          }),
          Terminal: eb("terminal", { Readers: t7 }),
          Treasury: eb("treasury", {
            InboundTransfers: tb,
            OutboundPayments: tB,
            OutboundTransfers: tH,
            ReceivedCredits: ie,
            ReceivedDebits: ir,
          }),
        }),
        a4 = eb("treasury", {
          CreditReversals: te,
          DebitReversals: ta,
          FinancialAccounts: tk,
          InboundTransfers: ty,
          OutboundPayments: t$,
          OutboundTransfers: tK,
          ReceivedCredits: ii,
          ReceivedDebits: is,
          TransactionEntries: iL,
          Transactions: iK,
        }),
        a6 = eb("v2", {
          Billing: eb("billing", {
            MeterEventAdjustments: tS,
            MeterEventSession: tw,
            MeterEventStream: tA,
            MeterEvents: tD,
          }),
          Core: eb("core", {
            AccountLinks: ey,
            AccountTokens: eP,
            Accounts: eA,
            EventDestinations: tu,
            Events: tm,
          }),
        });
      var a3 = i(7923);
      const a9 = "api.stripe.com",
        a7 = "/v1/",
        a8 = ["name", "version", "url", "partner_id"],
        re = [
          "authenticator",
          "apiVersion",
          "typescript",
          "maxNetworkRetries",
          "httpAgent",
          "httpClient",
          "timeout",
          "host",
          "port",
          "protocol",
          "telemetry",
          "appInfo",
          "stripeAccount",
          "stripeContext",
        ];
      !((e, t = (e) => new ei(e, ef.MAX_BUFFERED_REQUEST_METRICS)) => {
        (l.PACKAGE_VERSION = "21.0.1"), (l.API_VERSION = ek);
        const i =
          void 0 !== a3 && a3.env
            ? ((e) => {
                for (const [t, i] of _) if (e[t]) return i;
                return "";
              })(a3.env)
            : "";
        function l(i, a = {}) {
          if (!(this instanceof l)) return new l(i, a);
          const r = this._getPropsFromConfig(a);
          (this._platformFunctions = e),
            Object.defineProperty(this, "_emitter", {
              value: this._platformFunctions.createEmitter(),
              enumerable: !1,
              configurable: !1,
              writable: !1,
            }),
            (this.VERSION = l.PACKAGE_VERSION),
            (this.on = this._emitter.on.bind(this._emitter)),
            (this.once = this._emitter.once.bind(this._emitter)),
            (this.off = this._emitter.removeListener.bind(this._emitter));
          const s = r.httpAgent || null;
          this._api = {
            host: r.host || a9,
            port: r.port || "443",
            protocol: r.protocol || "https",
            basePath: a7,
            version: r.apiVersion || ek,
            timeout: k("timeout", r.timeout, 8e4),
            maxNetworkRetries: k("maxNetworkRetries", r.maxNetworkRetries, 2),
            agent: s,
            httpClient:
              r.httpClient ||
              (s
                ? this._platformFunctions.createNodeHttpClient(s)
                : this._platformFunctions.createDefaultHttpClient()),
            dev: !1,
            stripeAccount: r.stripeAccount || null,
            stripeContext: r.stripeContext || null,
          };
          const o = r.typescript || !1;
          o !== l.USER_AGENT.typescript && (l.USER_AGENT.typescript = o),
            r.appInfo && this._setAppInfo(r.appInfo),
            this._prepResources(),
            this._setAuthenticator(i, r.authenticator),
            (this.errors = n),
            (this.webhooks = l.webhooks),
            (this._prevRequestMetrics = []),
            (this._enableTelemetry = !1 !== r.telemetry),
            (this._requestSender = t(this)),
            (this.StripeResource = l.StripeResource),
            (this.Decimal = l.Decimal);
        }
        (l.AI_AGENT = i),
          (l.USER_AGENT = {
            bindings_version: l.PACKAGE_VERSION,
            lang: "node",
            typescript: !1,
            ...(void 0 === r ? {} : { lang_version: r.version }),
            ...(i ? { ai_agent: i } : {}),
          }),
          (l.StripeResource = ef),
          (l.StripeContext = ep),
          (l.resources = a),
          (l.HttpClient = P),
          (l.HttpClientResponse = T),
          (l.CryptoProvider = S),
          (l.webhooks = ((e) => {
            const t = {
                DEFAULT_TOLERANCE: 300,
                signature: null,
                constructEvent(e, i, n, a, r, l) {
                  try {
                    if (!this.signature)
                      throw Error("ERR: missing signature helper, unable to verify");
                    this.signature.verifyHeader(e, i, n, a || t.DEFAULT_TOLERANCE, r, l);
                  } catch (e) {
                    throw (
                      (e instanceof E &&
                        (e.message +=
                          "\nUse `await constructEventAsync(...)` instead of `constructEvent(...)`"),
                      e)
                    );
                  }
                  const s =
                    e instanceof Uint8Array
                      ? JSON.parse(new TextDecoder("utf8").decode(e))
                      : JSON.parse(e);
                  if (s && "v2.core.event" === s.object)
                    throw Error(
                      "You passed an event notification to stripe.webhooks.constructEvent, which expects a webhook payload. Use stripe.parseEventNotification instead.",
                    );
                  return s;
                },
                async constructEventAsync(e, i, n, a, r, l) {
                  if (!this.signature)
                    throw Error("ERR: missing signature helper, unable to verify");
                  await this.signature.verifyHeaderAsync(e, i, n, a || t.DEFAULT_TOLERANCE, r, l);
                  const s =
                    e instanceof Uint8Array
                      ? JSON.parse(new TextDecoder("utf8").decode(e))
                      : JSON.parse(e);
                  if (s && "v2.core.event" === s.object)
                    throw Error(
                      "You passed an event notification to stripe.webhooks.constructEvent, which expects a webhook payload. Use stripe.parseEventNotification instead.",
                    );
                  return s;
                },
                generateTestHeaderString: (e) => {
                  const t = o(e),
                    i =
                      t.signature ||
                      t.cryptoProvider.computeHMACSignature(t.payloadString, t.secret);
                  return t.generateHeaderString(i);
                },
                generateTestHeaderStringAsync: async (e) => {
                  const t = o(e),
                    i =
                      t.signature ||
                      (await t.cryptoProvider.computeHMACSignatureAsync(t.payloadString, t.secret));
                  return t.generateHeaderString(i);
                },
              },
              i = {
                EXPECTED_SCHEME: "v1",
                verifyHeader(e, t, i, l, o, d) {
                  const {
                      decodedHeader: u,
                      decodedPayload: c,
                      details: m,
                      suspectPayloadType: h,
                    } = a(e, t, this.EXPECTED_SCHEME),
                    f = /\s/.test(i),
                    p = (o = o || s()).computeHMACSignature(n(c, m), i);
                  return r(c, u, m, p, l, h, f, d), !0;
                },
                async verifyHeaderAsync(e, t, i, l, o, d) {
                  const {
                      decodedHeader: u,
                      decodedPayload: c,
                      details: m,
                      suspectPayloadType: h,
                    } = a(e, t, this.EXPECTED_SCHEME),
                    f = /\s/.test(i);
                  o = o || s();
                  const p = await o.computeHMACSignatureAsync(n(c, m), i);
                  return r(c, u, m, p, l, h, f, d);
                },
              };
            function n(e, t) {
              return `${t.timestamp}.${e}`;
            }
            function a(e, t, i) {
              var n, a;
              if (!e) throw new W(t, e, { message: "No webhook payload was provided." });
              const r = "string" != typeof e && !(e instanceof Uint8Array),
                l = new TextDecoder("utf8"),
                s = e instanceof Uint8Array ? l.decode(e) : e;
              if (Array.isArray(t))
                throw Error(
                  "Unexpected: An array was passed as a header, which should not be possible for the stripe-signature header.",
                );
              if (null == t || "" == t)
                throw new W(t, e, { message: "No stripe-signature header value was provided." });
              const o = t instanceof Uint8Array ? l.decode(t) : t,
                d =
                  ((n = o),
                  (a = i),
                  "string" != typeof n
                    ? null
                    : n.split(",").reduce(
                        (e, t) => {
                          const i = t.split("=");
                          return (
                            "t" === i[0] && (e.timestamp = parseInt(i[1], 10)),
                            i[0] === a && e.signatures.push(i[1]),
                            e
                          );
                        },
                        { timestamp: -1, signatures: [] },
                      ));
              if (!d || -1 === d.timestamp)
                throw new W(o, s, {
                  message: "Unable to extract timestamp and signatures from header",
                });
              if (!d.signatures.length)
                throw new W(o, s, { message: "No signatures found with expected scheme" });
              return { decodedPayload: s, decodedHeader: o, details: d, suspectPayloadType: r };
            }
            function r(t, i, n, a, r, l, s, o) {
              const d = !!n.signatures.filter(e.secureCompare.bind(e, a)).length,
                u =
                  "\nLearn more about webhook signing and explore webhook integration examples for various frameworks at https://docs.stripe.com/webhooks/signature",
                c = s
                  ? "\n\nNote: The provided signing secret contains whitespace. This often indicates an extra newline or space is in the value"
                  : "";
              if (!d) {
                if (l)
                  throw new W(i, t, {
                    message:
                      "Webhook payload must be provided as a string or a Buffer (https://nodejs.org/api/buffer.html) instance representing the _raw_ request body.Payload was provided as a parsed JavaScript object instead. \nSignature verification is impossible without access to the original signed material. \n" +
                      u +
                      "\n" +
                      c,
                  });
                throw new W(i, t, {
                  message:
                    "No signatures found matching the expected signature for payload. Are you passing the raw request body you received from Stripe? \n If a webhook request is being forwarded by a third-party tool, ensure that the exact request body, including JSON formatting and new line style, is preserved.\n" +
                    u +
                    "\n" +
                    c,
                });
              }
              const m = Math.floor(("number" == typeof o ? o : Date.now()) / 1e3) - n.timestamp;
              if (r > 0 && m > r)
                throw new W(i, t, { message: "Timestamp outside the tolerance zone" });
              return !0;
            }
            let l = null;
            function s() {
              return l || (l = e.createDefaultCryptoProvider()), l;
            }
            function o(e) {
              if (!e) throw new V({ message: "Options are required" });
              const t = Math.floor(e.timestamp) || Math.floor(Date.now() / 1e3),
                n = e.scheme || i.EXPECTED_SCHEME,
                a = e.cryptoProvider || s(),
                r = `${t}.${e.payload}`;
              return {
                ...e,
                timestamp: t,
                scheme: n,
                cryptoProvider: a,
                payloadString: r,
                generateHeaderString: (e) => `t=${t},${n}=${e}`,
              };
            }
            return (t.signature = i), t;
          })(e)),
          (l.Decimal = ec),
          (l.errors = n),
          (l.createNodeHttpClient = e.createNodeHttpClient),
          (l.createFetchHttpClient = e.createFetchHttpClient),
          (l.createNodeCryptoProvider = e.createNodeCryptoProvider),
          (l.createSubtleCryptoProvider = e.createSubtleCryptoProvider),
          (l.prototype = {
            _appInfo: void 0,
            on: null,
            off: null,
            once: null,
            VERSION: null,
            StripeResource: null,
            webhooks: null,
            errors: null,
            _api: null,
            _prevRequestMetrics: null,
            _emitter: null,
            _enableTelemetry: null,
            _requestSender: null,
            _platformFunctions: null,
            rawRequest(e, t, i, n) {
              return this._requestSender._rawRequest(e, t, i, n);
            },
            _setAuthenticator(e, t) {
              if (e && t) throw Error("Can't specify both apiKey and authenticator");
              if (!e && !t) throw Error("Neither apiKey nor config.authenticator provided");
              this._authenticator = e ? b(e) : t;
            },
            _setAppInfo(e) {
              if (e && "object" != typeof e) throw Error("AppInfo must be an object.");
              if (e && !e.name) throw Error("AppInfo.name is required");
              (e = e || {}),
                (this._appInfo = a8.reduce(
                  (t, i) => ("string" == typeof e[i] && ((t = t || {})[i] = e[i]), t),
                  {},
                ));
            },
            _setApiField(e, t) {
              this._api[e] = t;
            },
            getApiField(e) {
              return this._api[e];
            },
            setClientId(e) {
              this._clientId = e;
            },
            getClientId() {
              return this._clientId;
            },
            getConstant: (e) => {
              switch (e) {
                case "DEFAULT_HOST":
                  return a9;
                case "DEFAULT_PORT":
                  return "443";
                case "DEFAULT_BASE_PATH":
                  return a7;
                case "DEFAULT_API_VERSION":
                  return ek;
                case "DEFAULT_TIMEOUT":
                  return 8e4;
                case "MAX_NETWORK_RETRY_DELAY_SEC":
                  return 5;
                case "INITIAL_NETWORK_RETRY_DELAY_SEC":
                  return 0.5;
              }
              return l[e];
            },
            getMaxNetworkRetries() {
              return this.getApiField("maxNetworkRetries");
            },
            _setApiNumberField(e, t, i) {
              const n = k(e, t, i);
              this._setApiField(e, n);
            },
            getMaxNetworkRetryDelay: () => 5,
            getInitialNetworkRetryDelay: () => 0.5,
            getClientUserAgent(e) {
              return this.getClientUserAgentSeeded(l.USER_AGENT, e);
            },
            getClientUserAgentSeeded(e, t) {
              const i = {};
              for (const t in e) Object.hasOwn(e, t) && (i[t] = encodeURIComponent(e[t] ?? "null"));
              const n = this._platformFunctions.getPlatformInfo();
              n && this.getTelemetryEnabled()
                ? (i.platform = encodeURIComponent(n))
                : delete i.platform;
              const a = this.getApiField("httpClient");
              a && (i.httplib = encodeURIComponent(a.getClientName())),
                this._appInfo && (i.application = this._appInfo),
                t(JSON.stringify(i));
            },
            getAppInfoAsString() {
              if (!this._appInfo) return "";
              let e = this._appInfo.name;
              return (
                this._appInfo.version && (e += `/${this._appInfo.version}`),
                this._appInfo.url && (e += ` (${this._appInfo.url})`),
                e
              );
            },
            getTelemetryEnabled() {
              return this._enableTelemetry;
            },
            _prepResources() {
              for (const e in a)
                Object.hasOwn(a, e) &&
                  (this["OAuth" === e ? "oauth" : e[0].toLowerCase() + e.substring(1)] = new a[e](
                    this,
                  ));
            },
            _getPropsFromConfig(e) {
              if (!e) return {};
              const t = "string" == typeof e;
              if (!(e === Object(e) && !Array.isArray(e)) && !t)
                throw Error("Config must either be an object or a string");
              if (t) return { apiVersion: e };
              if (Object.keys(e).filter((e) => !re.includes(e)).length > 0)
                throw Error(`Config object may only contain the following: ${re.join(", ")}`);
              return e;
            },
            parseEventNotification(e, t, i, n, a, r) {
              this.webhooks.signature.verifyHeader(
                e,
                t,
                i,
                n || this.webhooks.DEFAULT_TOLERANCE,
                a,
                r,
              );
              const l =
                e instanceof Uint8Array
                  ? JSON.parse(new TextDecoder("utf8").decode(e))
                  : JSON.parse(e);
              if (l && "event" === l.object)
                throw Error(
                  "You passed a webhook payload to stripe.parseEventNotification, which expects an event notification. Use stripe.webhooks.constructEvent instead.",
                );
              return (
                l.context && (l.context = ep.parse(l.context)),
                (l.fetchEvent = () =>
                  this._requestSender._rawRequest(
                    "GET",
                    `/v2/core/events/${l.id}`,
                    void 0,
                    {
                      stripeContext: l.context,
                      headers: { "Stripe-Request-Trigger": `event=${l.id}` },
                    },
                    ["fetch_event"],
                  )),
                (l.fetchRelatedObject = () =>
                  l.related_object
                    ? this._requestSender._rawRequest(
                        "GET",
                        l.related_object.url,
                        void 0,
                        {
                          stripeContext: l.context,
                          headers: { "Stripe-Request-Trigger": `event=${l.id}` },
                        },
                        ["fetch_related_object"],
                      )
                    : Promise.resolve(null)),
                l
              );
            },
          });
      })(new M());
    },
    5577: (e, t, i) => {
      i.d(t, { p: () => n });
      function n(e) {
        let t;
        return () => (void 0 === t && (t = e()), t);
      }
    },
    5614: (e, t, i) => {
      i.d(t, { v: () => a });
      var n = i(5920);
      class a {
        constructor() {
          this.subscriptions = [];
        }
        add(e) {
          return (0, n.Kq)(this.subscriptions, e), () => (0, n.Ai)(this.subscriptions, e);
        }
        notify(e, t, i) {
          const n = this.subscriptions.length;
          if (n)
            if (1 === n) this.subscriptions[0](e, t, i);
            else
              for (let a = 0; a < n; a++) {
                const n = this.subscriptions[a];
                n && n(e, t, i);
              }
        }
        getSize() {
          return this.subscriptions.length;
        }
        clear() {
          this.subscriptions.length = 0;
        }
      }
    },
    5687: (e, t, i) => {
      i.d(t, { l: () => n });
      const n = (e) => e;
    },
    5843: (e, t, i) => {
      i.d(t, { OQ: () => d });
      var n = i(5614),
        a = i(4959),
        r = i(31),
        l = i(7562);
      const s = { current: void 0 };
      class o {
        constructor(e, t = {}) {
          (this.canTrackVelocity = null),
            (this.events = {}),
            (this.updateAndNotify = (e) => {
              const t = r.k.now();
              if (
                (this.updatedAt !== t && this.setPrevFrameValue(),
                (this.prev = this.current),
                this.setCurrent(e),
                this.current !== this.prev &&
                  (this.events.change?.notify(this.current), this.dependents))
              )
                for (const e of this.dependents) e.dirty();
            }),
            (this.hasAnimated = !1),
            this.setCurrent(e),
            (this.owner = t.owner);
        }
        setCurrent(e) {
          (this.current = e),
            (this.updatedAt = r.k.now()),
            null === this.canTrackVelocity &&
              void 0 !== e &&
              (this.canTrackVelocity = !isNaN(parseFloat(this.current)));
        }
        setPrevFrameValue(e = this.current) {
          (this.prevFrameValue = e), (this.prevUpdatedAt = this.updatedAt);
        }
        onChange(e) {
          return this.on("change", e);
        }
        on(e, t) {
          this.events[e] || (this.events[e] = new n.v());
          const i = this.events[e].add(t);
          return "change" === e
            ? () => {
                i(),
                  l.Gt.read(() => {
                    this.events.change.getSize() || this.stop();
                  });
              }
            : i;
        }
        clearListeners() {
          for (const e in this.events) this.events[e].clear();
        }
        attach(e, t) {
          (this.passiveEffect = e), (this.stopPassiveEffect = t);
        }
        set(e) {
          this.passiveEffect
            ? this.passiveEffect(e, this.updateAndNotify)
            : this.updateAndNotify(e);
        }
        setWithVelocity(e, t, i) {
          this.set(t),
            (this.prev = void 0),
            (this.prevFrameValue = e),
            (this.prevUpdatedAt = this.updatedAt - i);
        }
        jump(e, t = !0) {
          this.updateAndNotify(e),
            (this.prev = e),
            (this.prevUpdatedAt = this.prevFrameValue = void 0),
            t && this.stop(),
            this.stopPassiveEffect && this.stopPassiveEffect();
        }
        dirty() {
          this.events.change?.notify(this.current);
        }
        addDependent(e) {
          this.dependents || (this.dependents = new Set()), this.dependents.add(e);
        }
        removeDependent(e) {
          this.dependents && this.dependents.delete(e);
        }
        get() {
          return s.current && s.current.push(this), this.current;
        }
        getPrevious() {
          return this.prev;
        }
        getVelocity() {
          const e = r.k.now();
          if (!this.canTrackVelocity || void 0 === this.prevFrameValue || e - this.updatedAt > 30)
            return 0;
          const t = Math.min(this.updatedAt - this.prevUpdatedAt, 30);
          return (0, a.f)(parseFloat(this.current) - parseFloat(this.prevFrameValue), t);
        }
        start(e) {
          return (
            this.stop(),
            new Promise((t) => {
              (this.hasAnimated = !0),
                (this.animation = e(t)),
                this.events.animationStart && this.events.animationStart.notify();
            }).then(() => {
              this.events.animationComplete && this.events.animationComplete.notify(),
                this.clearAnimation();
            })
          );
        }
        stop() {
          this.animation &&
            (this.animation.stop(),
            this.events.animationCancel && this.events.animationCancel.notify()),
            this.clearAnimation();
        }
        isAnimating() {
          return !!this.animation;
        }
        clearAnimation() {
          delete this.animation;
        }
        destroy() {
          this.dependents?.clear(),
            this.events.destroy?.notify(),
            this.clearListeners(),
            this.stop(),
            this.stopPassiveEffect && this.stopPassiveEffect();
        }
      }
      function d(e, t) {
        return new o(e, t);
      }
    },
    5920: (e, t, i) => {
      function n(e, t) {
        -1 === e.indexOf(t) && e.push(t);
      }
      function a(e, t) {
        const i = e.indexOf(t);
        i > -1 && e.splice(i, 1);
      }
      i.d(t, { Ai: () => a, Kq: () => n });
    },
    6191: (e, t, i) => {
      i.d(t, { KN: () => r, gQ: () => d, px: () => l, uj: () => a, vh: () => s, vw: () => o });
      const n = (e) => ({
          test: (t) => "string" == typeof t && t.endsWith(e) && 1 === t.split(" ").length,
          parse: parseFloat,
          transform: (t) => `${t}${e}`,
        }),
        a = n("deg"),
        r = n("%"),
        l = n("px"),
        s = n("vh"),
        o = n("vw"),
        d = { ...r, parse: (e) => r.parse(e) / 100, transform: (e) => r.transform(100 * e) };
    },
    6203: (e, t, i) => {
      i.d(t, { M: () => a });
      var n = i(4260);
      function a(e) {
        const t = (0, n.useRef)(null);
        return null === t.current && (t.current = e()), t.current;
      }
    },
    6214: (e, t, i) => {
      i.d(t, { G: () => u });
      var n = i(1031),
        a = i(5687),
        r = i(1211),
        l = i(6826),
        s = i(62),
        o = i(9266),
        d = i(4075);
      function u(e, t, { clamp: i = !0, ease: c, mixer: m } = {}) {
        const h = e.length;
        if (
          ((0, l.V)(
            h === t.length,
            "Both input and output ranges must be the same length",
            "range-length",
          ),
          1 === h)
        )
          return () => t[0];
        if (2 === h && t[0] === t[1]) return () => t[1];
        const f = e[0] === e[1];
        e[0] > e[h - 1] && ((e = [...e].reverse()), (t = [...t].reverse()));
        const p = ((e, t, i) => {
            const l = [],
              s = i || n.W.mix || d.j,
              o = e.length - 1;
            for (let i = 0; i < o; i++) {
              let n = s(e[i], e[i + 1]);
              if (t) {
                const e = Array.isArray(t) ? t[i] || a.l : t;
                n = (0, r.F)(e, n);
              }
              l.push(n);
            }
            return l;
          })(t, c, m),
          k = p.length,
          _ = (i) => {
            if (f && i < e[0]) return t[0];
            let n = 0;
            if (k > 1) for (; n < e.length - 2 && !(i < e[n + 1]); n++);
            const a = (0, s.q)(e[n], e[n + 1], i);
            return p[n](a);
          };
        return i ? (t) => _((0, o.q)(e[0], e[h - 1], t)) : _;
      }
    },
    6477: (e, t, i) => {
      i.d(t, { x: () => a });
      var n = i(8811);
      function a(e) {
        return (0, n.G)(e) && "ownerSVGElement" in e;
      }
    },
    6692: (e, t, i) => {
      i.d(t, { I: () => l });
      var n = i(1031);
      const a = [
        "setup",
        "read",
        "resolveKeyframes",
        "preUpdate",
        "update",
        "preRender",
        "render",
        "postRender",
      ];
      var r = i(4247);
      function l(e, t) {
        let i = !1,
          l = !0,
          s = { delta: 0, timestamp: 0, isProcessing: !1 },
          o = () => (i = !0),
          d = a.reduce(
            (e, i) => (
              (e[i] = ((e, t) => {
                let i = new Set(),
                  n = new Set(),
                  a = !1,
                  l = !1,
                  s = new WeakSet(),
                  o = { delta: 0, timestamp: 0, isProcessing: !1 },
                  d = 0;
                function u(t) {
                  s.has(t) && (c.schedule(t), e()), d++, t(o);
                }
                const c = {
                  schedule: (e, t = !1, r = !1) => {
                    const l = r && a ? i : n;
                    return t && s.add(e), l.add(e), e;
                  },
                  cancel: (e) => {
                    n.delete(e), s.delete(e);
                  },
                  process: (e) => {
                    if (((o = e), a)) {
                      l = !0;
                      return;
                    }
                    a = !0;
                    const s = i;
                    (i = n),
                      (n = s),
                      i.forEach(u),
                      t && r.Q.value && r.Q.value.frameloop[t].push(d),
                      (d = 0),
                      i.clear(),
                      (a = !1),
                      l && ((l = !1), c.process(e));
                  },
                };
                return c;
              })(o, t ? i : void 0)),
              e
            ),
            {},
          ),
          {
            setup: u,
            read: c,
            resolveKeyframes: m,
            preUpdate: h,
            update: f,
            preRender: p,
            render: k,
            postRender: _,
          } = d,
          b = () => {
            const a = n.W.useManualTiming,
              r = a ? s.timestamp : performance.now();
            (i = !1),
              a || (s.delta = l ? 1e3 / 60 : Math.max(Math.min(r - s.timestamp, 40), 1)),
              (s.timestamp = r),
              (s.isProcessing = !0),
              u.process(s),
              c.process(s),
              m.process(s),
              h.process(s),
              f.process(s),
              p.process(s),
              k.process(s),
              _.process(s),
              (s.isProcessing = !1),
              i && t && ((l = !1), e(b));
          };
        return {
          schedule: a.reduce((t, n) => {
            const a = d[n];
            return (
              (t[n] = (t, n = !1, r = !1) => (
                !i && ((i = !0), (l = !0), s.isProcessing || e(b)), a.schedule(t, n, r)
              )),
              t
            );
          }, {}),
          cancel: (e) => {
            for (let t = 0; t < a.length; t++) d[a[t]].cancel(e);
          },
          state: s,
          steps: d,
        };
      }
    },
    6826: (e, t, i) => {
      i.d(t, { $: () => n, V: () => a }), i(7923);
      const n = () => {},
        a = () => {};
    },
    6883: (e, t, i) => {
      i.d(t, { j4: () => a, pG: () => l, rm: () => o });
      const n = (e) => (t) => "string" == typeof t && t.startsWith(e),
        a = n("--"),
        r = n("var(--"),
        l = (e) => !!r(e) && s.test(e.split("/*")[0].trim()),
        s = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
      function o(e) {
        return "string" == typeof e && e.split("/*")[0].includes("var(--");
      }
    },
    7207: (e, t, i) => {
      i.d(t, { A: () => n });
      const n = (0, i(7690).A)("sparkles", [
        [
          "path",
          {
            d: "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
            key: "1s2grr",
          },
        ],
        ["path", { d: "M20 2v4", key: "1rf3ol" }],
        ["path", { d: "M22 4h-4", key: "gwowj6" }],
        ["circle", { cx: "4", cy: "20", r: "2", key: "6kqj1y" }],
      ]);
    },
    7562: (e, t, i) => {
      i.d(t, { Gt: () => a, PP: () => s, WG: () => r, uv: () => l });
      var n = i(5687);
      const {
        schedule: a,
        cancel: r,
        state: l,
        steps: s,
      } = (0, i(6692).I)(
        "undefined" != typeof requestAnimationFrame ? requestAnimationFrame : n.l,
        !0,
      );
    },
    7647: (e, t, i) => {
      i.d(t, { S: () => n });
      const n = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
    },
    7690: (e, t, i) => {
      i.d(t, { A: () => s });
      var n = i(4260),
        a = i(9786);
      const r = (e) => {
        const t = e.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, i) =>
          i ? i.toUpperCase() : t.toLowerCase(),
        );
        return t.charAt(0).toUpperCase() + t.slice(1);
      };
      var l = i(8729);
      const s = (e, t) => {
        const i = (0, n.forwardRef)((i, s) => {
          const { className: o, ...d } = i;
          return (0, n.createElement)(l.default, {
            ref: s,
            iconNode: t,
            className: (0, a.z)(
              "lucide-".concat(
                r(e)
                  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
                  .toLowerCase(),
              ),
              "lucide-".concat(e),
              o,
            ),
            ...d,
          });
        });
        return (i.displayName = r(e)), i;
      };
    },
    7751: (e, t, i) => {
      i.d(t, { B: () => o });
      var n = i(9266),
        a = i(8474),
        r = i(9146),
        l = i(9052);
      const s = { ...a.ai, transform: (e) => Math.round((0, n.q)(0, 255, e)) },
        o = {
          test: (0, l.$)("rgb", "red"),
          parse: (0, l.q)("red", "green", "blue"),
          transform: ({ red: e, green: t, blue: i, alpha: n = 1 }) =>
            "rgba(" +
            s.transform(e) +
            ", " +
            s.transform(t) +
            ", " +
            s.transform(i) +
            ", " +
            (0, r.a)(a.X4.transform(n)) +
            ")",
        };
    },
    7784: (e, t, i) => {
      i.d(t, { A: () => n });
      const n = (0, i(7690).A)("x", [
        ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
        ["path", { d: "m6 6 12 12", key: "d8bk6v" }],
      ]);
    },
    7842: (e, t, i) => {
      let n, a;
      i.d(t, { X: () => f });
      var r = i(6477),
        l = i(3437);
      const s = new WeakMap(),
        o = (e, t, i) => (n, a) =>
          a && a[0] ? a[0][e + "Size"] : (0, r.x)(n) && "getBBox" in n ? n.getBBox()[t] : n[i],
        d = o("inline", "width", "offsetWidth"),
        u = o("block", "height", "offsetHeight");
      function c({ target: e, borderBoxSize: t }) {
        s.get(e)?.forEach((i) => {
          i(e, {
            get width() {
              return d(e, t);
            },
            get height() {
              return u(e, t);
            },
          });
        });
      }
      function m(e) {
        e.forEach(c);
      }
      const h = new Set();
      function f(e, t) {
        return "function" == typeof e
          ? (h.add(e),
            a ||
              ((a = () => {
                const e = {
                  get width() {
                    return window.innerWidth;
                  },
                  get height() {
                    return window.innerHeight;
                  },
                };
                h.forEach((t) => t(e));
              }),
              window.addEventListener("resize", a)),
            () => {
              h.delete(e),
                h.size ||
                  "function" != typeof a ||
                  (window.removeEventListener("resize", a), (a = void 0));
            })
          : ((e, t) => {
              n || ("undefined" != typeof ResizeObserver && (n = new ResizeObserver(m)));
              const i = (0, l.K)(e);
              return (
                i.forEach((e) => {
                  let i = s.get(e);
                  i || ((i = new Set()), s.set(e, i)), i.add(t), n?.observe(e);
                }),
                () => {
                  i.forEach((e) => {
                    const i = s.get(e);
                    i?.delete(t), i?.size || n?.unobserve(e);
                  });
                }
              );
            })(e, t);
      }
    },
    8474: (e, t, i) => {
      i.d(t, { X4: () => r, ai: () => a, hs: () => l });
      var n = i(9266);
      const a = { test: (e) => "number" == typeof e, parse: parseFloat, transform: (e) => e },
        r = { ...a, transform: (e) => (0, n.q)(0, 1, e) },
        l = { ...a, default: 1 };
    },
    8631: (e, t, i) => {
      i.d(t, { A: () => n });
      const n = (0, i(7690).A)("menu", [
        ["path", { d: "M4 5h16", key: "1tepv9" }],
        ["path", { d: "M4 12h16", key: "1lakjw" }],
        ["path", { d: "M4 19h16", key: "1djgab" }],
      ]);
    },
    8729: (e, t, i) => {
      i.d(t, { default: () => s });
      var n = i(4260),
        a = {
          xmlns: "http://www.w3.org/2000/svg",
          width: 24,
          height: 24,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        r = i(9786);
      const l = (0, n.createContext)({}),
        s = (0, n.forwardRef)((e, t) => {
          var i, s, o;
          const {
              color: d,
              size: u,
              strokeWidth: c,
              absoluteStrokeWidth: m,
              className: h = "",
              children: f,
              iconNode: p,
              ...k
            } = e,
            {
              size: _ = 24,
              strokeWidth: b = 2,
              absoluteStrokeWidth: g = !1,
              color: y = "currentColor",
              className: v = "",
            } = null != (i = (0, n.useContext)(l)) ? i : {},
            P = (null != m ? m : g)
              ? (24 * Number(null != c ? c : b)) / Number(null != u ? u : _)
              : null != c
                ? c
                : b;
          return (0, n.createElement)(
            "svg",
            {
              ref: t,
              ...a,
              width: null != (s = null != u ? u : _) ? s : a.width,
              height: null != (o = null != u ? u : _) ? o : a.height,
              stroke: null != d ? d : y,
              strokeWidth: P,
              className: (0, r.z)("lucide", v, h),
              ...(!f &&
                !((e) => {
                  for (const t in e)
                    if (t.startsWith("aria-") || "role" === t || "title" === t) return !0;
                  return !1;
                })(k) && { "aria-hidden": "true" }),
              ...k,
            },
            [
              ...p.map((e) => {
                const [t, i] = e;
                return (0, n.createElement)(t, i);
              }),
              ...(Array.isArray(f) ? f : [f]),
            ],
          );
        });
    },
    8811: (e, t, i) => {
      i.d(t, { G: () => n });
      function n(e) {
        return "object" == typeof e && null !== e;
      }
    },
    8961: (e, t, i) => {
      i.d(t, { y: () => l });
      var n = i(9458),
        a = i(4259),
        r = i(7751);
      const l = {
        test: (e) => r.B.test(e) || n.u.test(e) || a.V.test(e),
        parse: (e) => (r.B.test(e) ? r.B.parse(e) : a.V.test(e) ? a.V.parse(e) : n.u.parse(e)),
        transform: (e) =>
          "string" == typeof e ? e : Object.hasOwn(e, "red") ? r.B.transform(e) : a.V.transform(e),
        getAnimatableNone: (e) => {
          const t = l.parse(e);
          return (t.alpha = 0), l.transform(t);
        },
      };
    },
    9052: (e, t, i) => {
      i.d(t, { $: () => r, q: () => l });
      var n = i(7647);
      const a =
          /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu,
        r = (e, t) => (i) =>
          !!(
            ("string" == typeof i && a.test(i) && i.startsWith(e)) ||
            (t && null != i && Object.hasOwn(i, t))
          ),
        l = (e, t, i) => (a) => {
          if ("string" != typeof a) return a;
          const [r, l, s, o] = a.match(n.S);
          return {
            [e]: parseFloat(r),
            [t]: parseFloat(l),
            [i]: parseFloat(s),
            alpha: void 0 !== o ? parseFloat(o) : 1,
          };
        };
    },
    9060: (e, t, i) => {
      i.d(t, { A: () => n });
      const n = (0, i(7690).A)("check", [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]]);
    },
    9142: (e, t, i) => {
      i.d(t, { V: () => u, f: () => m });
      var n = i(8961);
      const a =
        /(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu;
      var r = i(7647),
        l = i(9146);
      const s = "number",
        o = "color",
        d =
          /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
      function u(e) {
        let t = e.toString(),
          i = [],
          a = { color: [], number: [], var: [] },
          r = [],
          l = 0,
          u = t
            .replace(
              d,
              (e) => (
                n.y.test(e)
                  ? (a.color.push(l), r.push(o), i.push(n.y.parse(e)))
                  : e.startsWith("var(")
                    ? (a.var.push(l), r.push("var"), i.push(e))
                    : (a.number.push(l), r.push(s), i.push(parseFloat(e))),
                ++l,
                "${}"
              ),
            )
            .split("${}");
        return { values: i, split: u, indexes: a, types: r };
      }
      function c({ split: e, types: t }) {
        const i = e.length;
        return (a) => {
          let r = "";
          for (let d = 0; d < i; d++)
            if (((r += e[d]), void 0 !== a[d])) {
              const e = t[d];
              e === s ? (r += (0, l.a)(a[d])) : e === o ? (r += n.y.transform(a[d])) : (r += a[d]);
            }
          return r;
        };
      }
      const m = {
        test: (e) =>
          isNaN(e) &&
          "string" == typeof e &&
          (e.match(r.S)?.length || 0) + (e.match(a)?.length || 0) > 0,
        parse: (e) => u(e).values,
        createTransformer: (e) => c(u(e)),
        getAnimatableNone: (e) => {
          const t = u(e);
          return c(t)(
            t.values.map((e, i) => {
              var a;
              let r;
              return (
                (a = t.split[i]),
                "number" == typeof e
                  ? a?.trim().endsWith("/")
                    ? e
                    : 0
                  : "number" == typeof (r = e)
                    ? 0
                    : n.y.test(r)
                      ? n.y.getAnimatableNone(r)
                      : r
              );
            }),
          );
        },
      };
    },
    9146: (e, t, i) => {
      i.d(t, { a: () => n });
      const n = (e) => Math.round(1e5 * e) / 1e5;
    },
    9266: (e, t, i) => {
      i.d(t, { q: () => n });
      const n = (e, t, i) => (i > t ? t : i < e ? e : i);
    },
    9458: (e, t, i) => {
      i.d(t, { u: () => a });
      var n = i(7751);
      const a = {
        test: (0, i(9052).$)("#"),
        parse: (e) => {
          let t = "",
            i = "",
            n = "",
            a = "";
          return (
            e.length > 5
              ? ((t = e.substring(1, 3)),
                (i = e.substring(3, 5)),
                (n = e.substring(5, 7)),
                (a = e.substring(7, 9)))
              : ((t = e.substring(1, 2)),
                (i = e.substring(2, 3)),
                (n = e.substring(3, 4)),
                (a = e.substring(4, 5)),
                (t += t),
                (i += i),
                (n += n),
                (a += a)),
            {
              red: parseInt(t, 16),
              green: parseInt(i, 16),
              blue: parseInt(n, 16),
              alpha: a ? parseInt(a, 16) / 255 : 1,
            }
          );
        },
        transform: n.B.transform,
      };
    },
    9786: (e, t, i) => {
      i.d(t, { z: () => n });
      const n = function () {
        for (var e = arguments.length, t = Array(e), i = 0; i < e; i++) t[i] = arguments[i];
        return t
          .filter((e, t, i) => !!e && "" !== e.trim() && i.indexOf(e) === t)
          .join(" ")
          .trim();
      };
    },
    9956: (e, t, i) => {
      i.d(t, { L: () => W });
      var n = i(5843),
        a = i(2727),
        r = i(6826),
        l = i(4260),
        s = i(5687),
        o = i(7562);
      function d(e, t) {
        let i,
          n = () => {
            const { currentTime: n } = t,
              a = (null === n ? 0 : n.value) / 100;
            i !== a && e(a), (i = a);
          };
        return o.Gt.preUpdate(n, !0), () => (0, o.WG)(n);
      }
      function u(e) {
        return "undefined" != typeof window && (e ? (0, a.d)() : (0, a.J)());
      }
      var c = i(7842),
        m = i(62),
        h = i(4959);
      const f = () => ({
          current: 0,
          offset: [],
          progress: 0,
          scrollLength: 0,
          targetOffset: 0,
          targetLength: 0,
          containerLength: 0,
          velocity: 0,
        }),
        p = { x: { length: "Width", position: "Left" }, y: { length: "Height", position: "Top" } };
      function k(e, t, i, n) {
        const a = i[t],
          { length: r, position: l } = p[t],
          s = a.current,
          o = i.time;
        (a.current = Math.abs(e[`scroll${l}`])),
          (a.scrollLength = e[`scroll${r}`] - e[`client${r}`]),
          (a.offset.length = 0),
          (a.offset[0] = 0),
          (a.offset[1] = a.scrollLength),
          (a.progress = (0, m.q)(0, a.scrollLength, a.current));
        const d = n - o;
        a.velocity = d > 50 ? 0 : (0, h.f)(a.current - s, d);
      }
      var _ = i(6214),
        b = i(2656),
        g = i(9266),
        y = i(2950);
      const v = { start: 0, center: 0.5, end: 1 };
      function P(e, t, i = 0) {
        let n = 0;
        if ((e in v && (e = v[e]), "string" == typeof e)) {
          const t = parseFloat(e);
          e.endsWith("px")
            ? (n = t)
            : e.endsWith("%")
              ? (e = t / 100)
              : e.endsWith("vw")
                ? (n = (t / 100) * document.documentElement.clientWidth)
                : e.endsWith("vh")
                  ? (n = (t / 100) * document.documentElement.clientHeight)
                  : (e = t);
        }
        return "number" == typeof e && (n = t * e), i + n;
      }
      const T = [0, 0],
        j = {
          Enter: [
            [0, 1],
            [1, 1],
          ],
          Exit: [
            [0, 0],
            [1, 0],
          ],
          Any: [
            [1, 0],
            [0, 1],
          ],
          All: [
            [0, 0],
            [1, 1],
          ],
        },
        x = { x: 0, y: 0 },
        S = new WeakMap(),
        E = new WeakMap(),
        w = new WeakMap(),
        O = new WeakMap(),
        A = new WeakMap(),
        C = (e) => (e === document.scrollingElement ? window : e);
      function R(
        e,
        { container: t = document.scrollingElement, trackContentSize: i = !1, ...n } = {},
      ) {
        if (!t) return s.l;
        let a = w.get(t);
        a || ((a = new Set()), w.set(t, a));
        const r = ((e, t, i, n = {}) => ({
          measure: (t) => {
            !((e, t = e, i) => {
              if (((i.x.targetOffset = 0), (i.y.targetOffset = 0), t !== e)) {
                let n = t;
                for (; n && n !== e; )
                  (i.x.targetOffset += n.offsetLeft),
                    (i.y.targetOffset += n.offsetTop),
                    (n = n.offsetParent);
              }
              (i.x.targetLength = t === e ? t.scrollWidth : t.clientWidth),
                (i.y.targetLength = t === e ? t.scrollHeight : t.clientHeight),
                (i.x.containerLength = e.clientWidth),
                (i.y.containerLength = e.clientHeight);
            })(e, n.target, i),
              k(e, "x", i, t),
              k(e, "y", i, t),
              (i.time = t),
              (n.offset || n.target) &&
                ((e, t, i) => {
                  const { offset: n = j.All } = i,
                    { target: a = e, axis: r = "y" } = i,
                    l = "y" === r ? "height" : "width",
                    s =
                      a !== e
                        ? ((e, t) => {
                            let i = { x: 0, y: 0 },
                              n = e;
                            for (; n && n !== t; )
                              if ((0, y.s)(n))
                                (i.x += n.offsetLeft), (i.y += n.offsetTop), (n = n.offsetParent);
                              else if ("svg" === n.tagName) {
                                const e = n.getBoundingClientRect(),
                                  t = (n = n.parentElement).getBoundingClientRect();
                                (i.x += e.left - t.left), (i.y += e.top - t.top);
                              } else if (n instanceof SVGGraphicsElement) {
                                const { x: e, y: t } = n.getBBox();
                                (i.x += e), (i.y += t);
                                let a = null,
                                  r = n.parentNode;
                                for (; !a; ) "svg" === r.tagName && (a = r), (r = n.parentNode);
                                n = a;
                              } else break;
                            return i;
                          })(a, e)
                        : x,
                    o =
                      a === e
                        ? { width: e.scrollWidth, height: e.scrollHeight }
                        : "getBBox" in a && "svg" !== a.tagName
                          ? a.getBBox()
                          : { width: a.clientWidth, height: a.clientHeight },
                    d = { width: e.clientWidth, height: e.clientHeight };
                  t[r].offset.length = 0;
                  let u = !t[r].interpolate,
                    c = n.length;
                  for (let e = 0; e < c; e++) {
                    const i = ((e, t, i, n) => {
                      let a = Array.isArray(e) ? e : T,
                        r = 0;
                      return (
                        "number" == typeof e
                          ? (a = [e, e])
                          : "string" == typeof e &&
                            (a = (e = e.trim()).includes(" ") ? e.split(" ") : [e, v[e] ? e : "0"]),
                        (r = P(a[0], i, n)) - P(a[1], t)
                      );
                    })(n[e], d[l], o[l], s[r]);
                    u || i === t[r].interpolatorOffsets[e] || (u = !0), (t[r].offset[e] = i);
                  }
                  u &&
                    ((t[r].interpolate = (0, _.G)(t[r].offset, (0, b.Z)(n), { clamp: !1 })),
                    (t[r].interpolatorOffsets = [...t[r].offset])),
                    (t[r].progress = (0, g.q)(0, 1, t[r].interpolate(t[r].current)));
                })(e, i, n);
          },
          notify: () => t(i),
        }))(t, e, { time: 0, x: f(), y: f() }, n);
        if ((a.add(r), !S.has(t))) {
          const e = () => {
              for (const e of a) e.measure(o.uv.timestamp);
              o.Gt.preUpdate(i);
            },
            i = () => {
              for (const e of a) e.notify();
            },
            n = () => o.Gt.read(e);
          S.set(t, n);
          const r = C(t);
          window.addEventListener("resize", n),
            t !== document.documentElement && E.set(t, (0, c.X)(t, n)),
            r.addEventListener("scroll", n),
            n();
        }
        if (i && !A.has(t)) {
          const e = S.get(t),
            i = { width: t.scrollWidth, height: t.scrollHeight };
          O.set(t, i);
          const n = o.Gt.read(() => {
            const n = t.scrollWidth,
              a = t.scrollHeight;
            (i.width !== n || i.height !== a) && (e(), (i.width = n), (i.height = a));
          }, !0);
          A.set(t, n);
        }
        const l = S.get(t);
        return (
          o.Gt.read(l, !1, !0),
          () => {
            (0, o.WG)(l);
            const e = w.get(t);
            if (!e || (e.delete(r), e.size)) return;
            const i = S.get(t);
            S.delete(t),
              i &&
                (C(t).removeEventListener("scroll", i),
                E.get(t)?.(),
                window.removeEventListener("resize", i));
            const n = A.get(t);
            n && ((0, o.WG)(n), A.delete(t)), O.delete(t);
          }
        );
      }
      const M = [
          [j.Enter, "entry"],
          [j.Exit, "exit"],
          [j.Any, "cover"],
          [j.All, "contain"],
        ],
        D = { start: 0, end: 1 };
      function G(e) {
        if (!e) return { rangeStart: "contain 0%", rangeEnd: "contain 100%" };
        for (const [t, i] of M)
          if (
            ((e, t) => {
              const i = ((e) => {
                if (2 !== e.length) return;
                const t = [];
                for (const i of e)
                  if (Array.isArray(i)) t.push(i);
                  else {
                    if ("string" != typeof i) return;
                    const e = ((e) => {
                      const t = e.trim().split(/\s+/);
                      if (2 !== t.length) return;
                      const i = D[t[0]],
                        n = D[t[1]];
                      if (void 0 !== i && void 0 !== n) return [i, n];
                    })(i);
                    if (!e) return;
                    t.push(e);
                  }
                return t;
              })(e);
              if (!i) return !1;
              for (let e = 0; e < 2; e++) {
                const n = i[e],
                  a = t[e];
                if (n[0] !== a[0] || n[1] !== a[1]) return !1;
              }
              return !0;
            })(e, t)
          )
            return { rangeStart: `${i} 0%`, rangeEnd: `${i} 100%` };
      }
      const I = new Map();
      function V(e) {
        const t = { value: 0 },
          i = R((i) => {
            t.value = 100 * i[e.axis].progress;
          }, e);
        return { currentTime: t, cancel: i };
      }
      function L({ source: e, container: t, ...i }) {
        const { axis: n } = i;
        e && (t = e);
        let a = I.get(t);
        a || ((a = new Map()), I.set(t, a));
        let r = i.target ?? "self",
          l = a.get(r);
        l || ((l = {}), a.set(r, l));
        const s = n + (i.offset ?? []).join(",");
        return (
          l[s] ||
            (i.target && u(i.target)
              ? G(i.offset)
                ? (l[s] = new ViewTimeline({ subject: i.target, axis: n }))
                : (l[s] = V({ container: t, ...i }))
              : u()
                ? (l[s] = new ScrollTimeline({ source: t, axis: n }))
                : (l[s] = V({ container: t, ...i }))),
          l[s]
        );
      }
      function q(e, { axis: t = "y", container: i = document.scrollingElement, ...n } = {}) {
        var a, r;
        if (!i) return s.l;
        const l = { axis: t, container: i, ...n };
        return "function" == typeof e
          ? ((a = e),
            (r = l),
            2 === a.length
              ? R((e) => {
                  a(e[r.axis].progress, e);
                }, r)
              : d(a, L(r)))
          : ((e, t) => {
              const i = L(t),
                n = t.target ? G(t.offset) : void 0,
                a = t.target ? u(t.target) && !!n : u();
              return e.attachTimeline({
                timeline: a ? i : void 0,
                ...(n && a && { rangeStart: n.rangeStart, rangeEnd: n.rangeEnd }),
                observe: (e) => (
                  e.pause(),
                  d((t) => {
                    e.time = e.iterationDuration * t;
                  }, i)
                ),
              });
            })(e, l);
      }
      var N = i(6203),
        F = i(1711);
      const B = () => ({
          scrollX: (0, n.OQ)(0),
          scrollY: (0, n.OQ)(0),
          scrollXProgress: (0, n.OQ)(0),
          scrollYProgress: (0, n.OQ)(0),
        }),
        U = (e) => !!e && !e.current;
      function $(e, t, i, n) {
        return {
          factory: (a) =>
            q(a, {
              ...t,
              axis: e,
              container: (null == i ? void 0 : i.current) || void 0,
              target: (null == n ? void 0 : n.current) || void 0,
            }),
          times: [0, 1],
          keyframes: [0, 1],
          ease: (e) => e,
          duration: 1,
        };
      }
      function W() {
        var e;
        const {
            container: t,
            target: i,
            ...n
          } = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
          s = (0, N.M)(B);
        (e = n.offset),
          "undefined" != typeof window &&
            (i ? (0, a.d)() && !!G(e) : (0, a.J)()) &&
            ((s.scrollXProgress.accelerate = $("x", n, t, i)),
            (s.scrollYProgress.accelerate = $("y", n, t, i)));
        const o = (0, l.useRef)(null),
          d = (0, l.useRef)(!1),
          u = (0, l.useCallback)(
            () => (
              (o.current = q(
                (e, t) => {
                  const { x: i, y: n } = t;
                  s.scrollX.set(i.current),
                    s.scrollXProgress.set(i.progress),
                    s.scrollY.set(n.current),
                    s.scrollYProgress.set(n.progress);
                },
                {
                  ...n,
                  container: (null == t ? void 0 : t.current) || void 0,
                  target: (null == i ? void 0 : i.current) || void 0,
                },
              )),
              () => {
                var e;
                null == (e = o.current) || e.call(o);
              }
            ),
            [t, i, JSON.stringify(n.offset)],
          );
        return (
          (0, F.E)(() => {
            if (((d.current = !1), !(U(t) || U(i)))) return u();
            d.current = !0;
          }, [u]),
          (0, l.useEffect)(
            () =>
              d.current
                ? ((0, r.V)(!U(t), "Container ref is defined but not hydrated", "use-scroll-ref"),
                  (0, r.V)(!U(i), "Target ref is defined but not hydrated", "use-scroll-ref"),
                  u())
                : void 0,
            [u],
          ),
          s
        );
      }
    },
  },
]);
