// app.jsx — HOME page (index.html)
// Uses the shared shell from site.jsx (PageHeader, SiteShell, useSiteChrome).
// Renders: HeroVariantC + Feedback + Footer + Tweaks panel.
// Owns: visitor analytics tracker (pv/click/scroll/lang) — runs on every page that
// loads app.jsx, but tracker calls work on every page since enqueue uses
// session-scoped sid stored in sessionStorage.

const { useState, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scrapbook": true,
  "tileSize": 44,
  "redAccent": "#EB3300",
  "showBottomCta": true,
  "heroVariant": "C"
}/*EDITMODE-END*/;

// ---------- Lang persistence: URL ?lang= → localStorage → navigator → default ----------
const LANG_STORAGE_KEY = "signa.lang";
function detectInitialLang(defaultLang) {
  try {
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang && ["en", "ru", "id"].includes(urlLang)) return urlLang;
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && ["en", "ru", "id"].includes(stored)) return stored;
    const nav = (navigator.language || "en").toLowerCase().slice(0, 2);
    if (nav === "ru") return "ru";
    if (nav === "id" || nav === "in") return "id";
  } catch (_) {}
  return defaultLang || "en";
}

function HomeApp(){
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [lang, setLangState] = useState(() => detectInitialLang("en"));
  const setLang = (v) => {
    setLangState(v);
    try { localStorage.setItem(LANG_STORAGE_KEY, v); } catch (_) {}
    document.documentElement.lang = v;
  };

  useEffect(() => {
    document.documentElement.style.setProperty("--tile", t.tileSize + "px");
  }, [t.tileSize]);
  useEffect(() => {
    document.documentElement.style.setProperty("--red", t.redAccent);
  }, [t.redAccent]);

  window.useSiteChrome({ scrapbook: t.scrapbook });

  // ============================================================
  // Visitor analytics — page view, click, scroll-depth, lang change
  // (one-time mount; tracker remains for the lifetime of the page)
  // ============================================================
  useEffect(() => {
    let sid = "";
    try {
      sid = sessionStorage.getItem("signa.sid") || "";
      if (!sid) {
        sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        sessionStorage.setItem("signa.sid", sid);
      }
    } catch (_) {
      sid = Math.random().toString(36).slice(2, 12);
    }

    let queue = [];
    let flushTimer = null;
    const flush = (useBeacon = false) => {
      if (!queue.length) return;
      const payload = JSON.stringify({ events: queue });
      queue = [];
      try {
        if (useBeacon && navigator.sendBeacon) {
          navigator.sendBeacon("track.php", new Blob([payload], { type: "application/json" }));
        } else {
          fetch("track.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch (_) {}
    };
    const enqueue = (ev) => {
      queue.push({ sid, ...ev });
      if (queue.length >= 10) { clearTimeout(flushTimer); flush(); return; }
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => flush(), 2500);
    };
    window.__signaTrack = enqueue;

    let tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) {}
    enqueue({
      t: "pv",
      lang,
      ref: document.referrer || "",
      vw: window.innerWidth,
      vh: window.innerHeight,
      tz,
      path: window.location.pathname,
    });

    const labelFromHref = (href) => {
      if (!href) return null;
      if (href.startsWith("#")) return "nav_" + href.slice(1);
      if (href.startsWith("tel:")) return "phone";
      if (href.startsWith("mailto:")) return "email";
      if (/^(index|menu|about|visit)\.html/.test(href)) return "page_" + href.replace(/\.html.*/, "");
      if (href.includes("signa.dishi.rest")) return "menu_dishi";
      if (href.includes("gofood.link")) return "gofood";
      if (href.includes("food.grab.com")) return "grabfood";
      if (href.includes("g.page")) return "google_review";
      if (href.includes("forms.gle")) return "suggestion_form";
      if (href.includes("wa.me/+6288987127671") || href.includes("wa.me/6288987127671")) return "whatsapp_manager";
      if (href.includes("wa.me/+6289654027190") || href.includes("wa.me/6289654027190")) return "whatsapp_main";
      if (href.includes("instagram.com")) return "instagram";
      if (href.includes("maps.google.com") || href.includes("google.com/maps")) return "directions";
      return null;
    };
    const onClick = (e) => {
      let el = e.target instanceof Element ? e.target : null;
      while (el && el !== document.body) {
        const dt = el.getAttribute && el.getAttribute("data-track");
        if (dt) { enqueue({ t: "click", target: dt.slice(0, 64) }); return; }
        if (el.tagName === "A") {
          const lbl = labelFromHref(el.getAttribute("href") || "");
          if (lbl) { enqueue({ t: "click", target: lbl }); return; }
        }
        el = el.parentElement;
      }
    };
    document.addEventListener("click", onClick, true);

    // Scroll depth — fires once per section when ≥50% visible
    const SECTION_IDS = ["hero","brand","feedback","menu","promos","signature","experience","order","faq","location","footer"];
    const reached = new Set();
    const onScrollDepth = () => {
      const half = window.innerHeight * 0.5;
      for (let i = 0; i < SECTION_IDS.length; i++) {
        if (reached.has(i)) continue;
        const el = document.getElementById(SECTION_IDS[i]);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top < half) {
          reached.add(i);
          enqueue({ t: "scroll", section: String(i).padStart(2, "0") + "_" + SECTION_IDS[i] });
        }
      }
    };
    let scrollRaf;
    const scrollHandler = () => { cancelAnimationFrame(scrollRaf); scrollRaf = requestAnimationFrame(onScrollDepth); };
    window.addEventListener("scroll", scrollHandler, { passive: true });
    onScrollDepth();

    const onHide = () => flush(true);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", scrollHandler);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      cancelAnimationFrame(scrollRaf);
      flush(true);
    };
  }, []);

  // Track lang switches
  const langRef = useRef(lang);
  useEffect(() => {
    if (langRef.current !== lang) {
      window.__signaTrack?.({ t: "lang", from: langRef.current, to: lang });
      langRef.current = lang;
    }
  }, [lang]);

  return (
    <div className="signa-app">
      <window.PageHeader page="home" lang={lang} setLang={setLang}/>

      <main>
        <window.HeroSection scrapOn={t.scrapbook} lang={lang} variant={t.heroVariant}/>
        <window.FeedbackSection scrapOn={t.scrapbook} lang={lang}/>
        <window.FooterSection lang={lang}/>
      </main>

      {t.showBottomCta && <window.BottomCTA lang={lang}/>}

      <window.TweaksPanel>
        <window.TweakSection label="Hero variant"/>
        <window.TweakRadio
          label="Variant"
          value={t.heroVariant}
          options={["C", "A", "B", "D", "E"]}
          onChange={(v) => setTweak("heroVariant", v)}
        />
        <window.TweakSection label="Scrapbook layer"/>
        <window.TweakToggle
          label="Scrapbook ON"
          value={t.scrapbook}
          onChange={(v) => setTweak("scrapbook", v)}
        />
        <window.TweakToggle
          label="Sticky bottom CTA"
          value={t.showBottomCta}
          onChange={(v) => setTweak("showBottomCta", v)}
        />
        <window.TweakSection label="Pattern"/>
        <window.TweakSlider
          label="Tile size"
          value={t.tileSize}
          min={32} max={72} step={2} unit="px"
          onChange={(v) => setTweak("tileSize", v)}
        />
        <window.TweakSection label="Accent"/>
        <window.TweakColor
          label="Signa red"
          value={t.redAccent}
          options={["#EB3300", "#D9220D", "#FF5230", "#C81A00"]}
          onChange={(v) => setTweak("redAccent", v)}
        />
      </window.TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
window.hydrateContent().then(() => root.render(<HomeApp/>));
