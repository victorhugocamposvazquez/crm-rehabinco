/** Motor de scroll del handoff Home.dc.html, acotado al nodo raíz de la web. */

const EASE = "cubic-bezier(.2,.7,.2,1)";

type Mot = HTMLElement & { __shown?: boolean; __prepped?: boolean; _p?: number; _on?: boolean };

export function initWebMotion(root: HTMLElement) {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const q = <T extends Element>(sel: string) => [...root.querySelectorAll<T>(sel)];
  let raf = 0;
  let safety = 0;

  const fillAll = () => {
    q<HTMLElement>("[data-fill] > span").forEach((s) => {
      s.style.opacity = "1";
      s.style.filter = "none";
    });
    q<SVGElement>("[data-hm-bar]").forEach((x) => {
      x.style.transform = "scaleX(1)";
    });
    q<HTMLElement>("[data-reveal] > span").forEach((s) => {
      s.style.opacity = "1";
      s.style.filter = "none";
      s.style.translate = "0 0";
    });
  };

  const countUp = () => {
    const value = root.querySelector<HTMLElement>("[data-count-value]");
    const bar = root.querySelector<HTMLElement>("[data-count-bar]");
    if (!value) return;
    const to = 360;
    const dur = 1800;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - (1 - k) ** 3;
      const n = Math.round(to * e);
      value.textContent = String(n);
      if (bar) bar.style.width = `${(n / to) * 100}%`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const revealEl = (el: Mot) => {
    if (el.__shown) return;
    el.__shown = true;
    if (el.hasAttribute("data-enter")) {
      el.style.opacity = "1";
      el.style.translate = "0 0";
    }
    if (el.hasAttribute("data-wipe")) {
      el.style.clipPath = "inset(0 0 0 0 round 28px)";
      const m = el.querySelector<HTMLElement>("[data-wipe-media]");
      if (m) m.style.scale = "1";
    }
    if (el.hasAttribute("data-split")) {
      [...el.children].forEach((c) => {
        (c as HTMLElement).style.translate = "0 0";
      });
    }
    if (el.hasAttribute("data-count-trigger")) countUp();
  };

  const revealAll = () => {
    fillAll();
    q<Mot>("[data-enter],[data-wipe],[data-split],[data-count-trigger]").forEach(revealEl);
  };

  if (reduce) {
    revealAll();
    return () => undefined;
  }

  const vh = () => window.innerHeight || document.documentElement.clientHeight;

  const enter = q<Mot>("[data-enter]");
  enter.forEach((el) => {
    if (el.__prepped) return;
    el.__prepped = true;
    const d = Number(el.getAttribute("data-enter")) || 0;
    el.style.opacity = "0";
    el.style.translate = "0 24px";
    el.style.transition = `opacity 800ms ${EASE} ${d}ms, translate 800ms ${EASE} ${d}ms`;
  });

  const wipes = q<Mot>("[data-wipe]");
  wipes.forEach((el) => {
    if (el.__prepped) return;
    el.__prepped = true;
    el.style.clipPath = "inset(100% 0 0 0 round 28px)";
    el.style.transition = `clip-path 1100ms ${EASE}`;
    const m = el.querySelector<HTMLElement>("[data-wipe-media]");
    if (m) {
      m.style.scale = "1.06";
      m.style.transition = `scale 1100ms ${EASE}`;
    }
  });

  const splits = q<Mot>("[data-split]");
  splits.forEach((el) => {
    if (el.__prepped) return;
    el.__prepped = true;
    [...el.children].forEach((c, i) => {
      const node = c as HTMLElement;
      node.style.translate = "0 105%";
      node.style.transition = `translate 900ms ${EASE} ${i * 28}ms`;
    });
  });

  const targets = [...enter, ...wipes, ...splits, ...q<Mot>("[data-count-trigger]")];
  const check = () => {
    const h = vh();
    targets.forEach((el) => {
      if (el.__shown) return;
      const r = el.getBoundingClientRect();
      if (r.top < h * 0.94 && r.bottom > 0) revealEl(el);
    });
  };
  safety = window.setTimeout(() => {
    if (!targets.some((el) => el.__shown)) revealAll();
    else check();
  }, 2500);

  const bg = root.querySelector<HTMLElement>("[data-hero-bg]");
  const fg = root.querySelector<HTMLElement>("[data-hero-fg]");
  const words = q<HTMLElement>("[data-hero-word]");
  const hero = root.querySelector<HTMLElement>("[data-hero]");
  const pxs = q<HTMLElement>("[data-px]");
  const fills = q<HTMLElement & { _p?: number }>("[data-fill]");

  const fillTick = () => {
    const h = vh();
    fills.forEach((el) => {
      const r = el.getBoundingClientRect();
      const start = h * 0.85;
      const end = h * 0.45;
      const p = Math.min(1, Math.max(0, (start - r.top) / (start - end + r.height)));
      const kids = el.children;
      const n = kids.length;
      for (let i = 0; i < n; i++) {
        const k = Math.min(1, Math.max(0, (p * (n + 3) - i) / 3));
        const node = kids[i] as HTMLElement;
        node.style.opacity = (0.18 + 0.82 * k).toFixed(3);
        node.style.filter = `blur(${(6 * (1 - k)).toFixed(2)}px)`;
      }
      el._p = p;
      const rv = el.nextElementSibling as HTMLElement | null;
      if (rv?.hasAttribute("data-reveal")) {
        const on = p >= 0.985;
        const marked = rv as HTMLElement & { _on?: boolean };
        if (marked._on !== on) {
          marked._on = on;
          const ls = [...rv.children].filter((c) => !c.hasAttribute("data-hm-wrap"));
          const n2 = ls.length;
          ls.forEach((sp, i) => {
            const d = on ? i * 45 : (n2 - 1 - i) * 20;
            const node = sp as HTMLElement;
            node.style.transition = `opacity 700ms ease ${d}ms, filter 800ms ease ${d}ms, translate 900ms ${EASE} ${d}ms`;
            node.style.opacity = on ? "1" : "0";
            node.style.filter = on ? "none" : "blur(14px)";
            node.style.translate = on ? "0 0" : "0 .35em";
          });
          rv.querySelectorAll<HTMLElement>("[data-hm-bar]").forEach((x) => {
            x.style.transition = on ? `transform 900ms ${EASE} ${n2 * 45 + 150}ms` : "transform 300ms ease";
            x.style.transform = on ? "scaleX(1)" : "scaleX(0)";
          });
        }
      }
    });
  };

  const izs = q<HTMLElement>("[data-iconzoom]");
  const izTick = () => {
    const H = vh();
    const seg = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    izs.forEach((el) => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - H)));
      const draw = ease(seg(p, 0, 0.28));
      const zoom = ease(seg(p, 0.3, 0.92));
      const sc = 0.75 * 70 ** zoom;
      el.querySelectorAll("[data-iz-g]").forEach((g) => {
        g.setAttribute("transform", `translate(60 66) scale(${sc.toFixed(4)}) translate(-60 -66)`);
      });
      const roof = el.querySelector("[data-iz-roof]");
      if (roof) roof.setAttribute("stroke-dashoffset", (94 * (1 - draw)).toFixed(2));
      el.querySelectorAll("[data-iz-line]").forEach((l) => {
        l.setAttribute("stroke-dashoffset", (22 * (1 - seg(p, 0.12, 0.3))).toFixed(2));
      });
      const st = el.querySelector<HTMLElement>("[data-iz-stroke]");
      if (st) st.style.opacity = String(1 - seg(p, 0.45, 0.7));
      const sh = el.querySelector("[data-iz-shade]");
      if (sh) sh.setAttribute("fill-opacity", (0.42 + 0.26 * (1 - seg(p, 0.75, 0.95))).toFixed(3));
      const img = el.querySelector<HTMLElement>("[data-iz-img]");
      if (img) img.style.transform = `scale(${(1.18 - 0.18 * zoom).toFixed(4)})`;
      const cap = el.querySelector<HTMLElement>("[data-iz-cap]");
      if (cap) {
        const on = p > 0.72;
        cap.style.opacity = on ? "1" : "0";
        cap.style.translate = on ? "0 0" : "0 28px";
        cap.style.pointerEvents = on ? "auto" : "none";
      }
    });
  };

  const rrs = q<HTMLElement>("[data-roof-return]");
  const rrTick = () => {
    const H = vh();
    rrs.forEach((el) => {
      const t = el.getBoundingClientRect().top;
      const prog = Math.min(1, Math.max(0, (H * 0.98 - t) / (H * 0.55)));
      const e = 1 - (1 - prog) ** 3;
      const ic = el.querySelector<HTMLElement>("[data-rr-icon]");
      if (ic) {
        ic.style.transform = `translateY(${(-40 * (1 - e)).toFixed(1)}px) scale(${(1 + 9 * (1 - e)).toFixed(3)})`;
        ic.style.opacity = String(Math.min(1, prog * 1.6));
      }
    });
  };

  const tv = root.querySelector<HTMLElement>("[data-travel]");
  const tvIcon = tv?.querySelector<HTMLElement>("[data-tv-icon]");
  const tvLine = tv?.querySelector<HTMLElement>("[data-tv-line]");
  const tvBars = tv ? [...tv.querySelectorAll<HTMLElement>("[data-tv-bar]")] : [];
  const srcIc = root.querySelector<HTMLElement>("[data-rr-icon]");
  const dstA = root.querySelector<HTMLElement>("[data-hm-a]");
  const dstWrap = root.querySelector<HTMLElement>("[data-hm-wrap]");
  const sstep = (t: number) => t * t * (3 - 2 * t);
  const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const travelTick = () => {
    if (!tv || !tvIcon || !tvLine || !srcIc || !dstA) return;
    const H = vh();
    const W = window.innerWidth;
    const sp = srcIc.parentElement!.getBoundingClientRect();
    const S = { x: sp.left + sp.width / 2 - 64, y: sp.top, w: 128 };
    const ar = dstA.getBoundingClientRect();
    const u = ar.width / 47;
    const T = { x: ar.left - 40 * u, y: ar.top - 10.5 * u, w: 127 * u };
    const dw = W < 760 ? 44 : 60;
    const D = { x: W - dw - (W < 760 ? 10 : 28), y: H * 0.5 - dw * 0.27, w: dw };
    const sc = S.y + 35;
    const t1 = sstep(clamp01((H * 0.42 - sc) / (H * 0.3)));
    const tc = ar.top + ar.height / 2;
    const t2 = sstep(clamp01((H * 1.02 - tc) / (H * 0.4)));
    const active = t1 > 0 && t2 < 1;
    srcIc.style.visibility = t1 > 0 ? "hidden" : "visible";
    if (dstWrap) {
      dstWrap.style.opacity = t2 >= 1 ? "1" : "0";
      dstWrap.style.filter = "none";
      dstWrap.style.translate = "0 0";
    }
    if (!active) {
      tv.style.visibility = "hidden";
      return;
    }
    tv.style.visibility = "visible";
    let x: number;
    let y: number;
    let w: number;
    let bars: number;
    if (t2 <= 0) {
      x = lerp(S.x, D.x, t1);
      y = lerp(S.y, D.y, t1);
      w = lerp(S.w, D.w, t1);
      bars = 1 - t1;
    } else {
      x = lerp(D.x, T.x, t2);
      y = lerp(D.y, T.y, t2);
      w = lerp(D.w, T.w, t2);
      bars = 0;
    }
    const k = w / 128;
    const rot = t2 > 0 ? Math.sin(t2 * Math.PI) * -12 : Math.sin(t1 * Math.PI) * 8;
    tvIcon.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${k.toFixed(4)}) rotate(${rot.toFixed(2)}deg)`;
    tvBars.forEach((b) => {
      b.style.transform = `scaleX(${bars.toFixed(3)})`;
    });
    const apexX = x + 63.5 * k;
    const apexY = y + 55.5 * k;
    const docked = t1 >= 1 && t2 <= 0;
    const dist = Math.max(0, Math.min(tc, H) - apexY);
    const lineLen = docked ? dist * clamp01((H * 2.2 - (tc - H)) / (H * 2.2)) : t2 > 0 ? dist * (1 - t2) : dist * t1 * 0.4;
    tvLine.style.transform = `translate(${apexX.toFixed(1)}px,${(apexY + 4).toFixed(1)}px)`;
    tvLine.style.height = `${Math.max(0, lineLen).toFixed(1)}px`;
    tvLine.style.opacity = String(Math.min(1, t1) * (1 - t2) * 0.5);
  };

  const tick = () => {
    check();
    travelTick();
    fillTick();
    izTick();
    rrTick();
    const y = hero ? Math.max(0, -hero.getBoundingClientRect().top) : 0;
    if (y < vh() * 1.2) {
      if (bg) bg.style.transform = `translate3d(0,${y * 0.18}px,0)`;
      if (fg) fg.style.transform = `translate3d(0,${y * 0.18}px,0)`;
      words.forEach((w) => {
        w.style.transform = `translate3d(0,${y * 0.5}px,0)`;
      });
    }
    const h = vh();
    pxs.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > h + 100) return;
      const p = (r.top + r.height / 2 - h / 2) / h;
      const img = el.querySelector("img");
      if (img) img.style.transform = `translate3d(0,${(p * -60).toFixed(1)}px,0) scale(1.12)`;
    });
  };

  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };
  document.addEventListener("scroll", onScroll, { passive: true, capture: true });
  window.addEventListener("resize", onScroll);
  requestAnimationFrame(() => requestAnimationFrame(tick));

  return () => {
    clearTimeout(safety);
    document.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll);
    cancelAnimationFrame(raf);
  };
}
