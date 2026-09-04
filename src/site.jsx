// site.jsx — shared multi-page shell + chrome
// Provides: PageHeader (page links), SiteShell (header+main+footer+bottomCTA),
// useSiteChrome (tile light, scroll-y, scrapbook class), and content hydration.

const { useState, useEffect } = React;

// ---------- Content hydration ----------
async function hydrateContent() {
  // Always fetch the live content.json first so we can compare versions.
  // If a localStorage admin override exists for the SAME version → keep it
  // (admin edits in progress). Otherwise it's stale and we discard it —
  // avoids the trap where someone saved a snapshot months ago via /admin
  // and their browser keeps serving that snapshot to themselves instead of
  // the freshly deployed site content.
  let server = null;
  try {
    const r = await fetch("content.json", { cache: "no-store" });
    if (r.ok) server = await r.json();
  } catch (_) {}

  try {
    const localRaw = localStorage.getItem("signa.admin.content");
    if (localRaw) {
      const local = JSON.parse(localRaw);
      if (server && local && local.version && server.version && local.version === server.version) {
        window.CONTENT = local;
        return;
      }
      if (server) {
        try { localStorage.removeItem("signa.admin.content"); } catch (_) {}
      }
    }
  } catch (_) {}

  if (server) window.CONTENT = server;
}
window.hydrateContent = hydrateContent;

// ---------- Page nav model ----------
const PAGE_NAV = [
  { id: "home",    href: "index.html", key: "nav_home" },
  { id: "menu",    href: "menu.html",  key: "nav_menu" },
  // /stories is server-rendered PHP, not a React page — absolute path on purpose.
  { id: "stories", href: "/stories",   key: "nav_stories" },
  { id: "about",   href: "about.html", key: "nav_about" },
  { id: "visit",   href: "visit.html", key: "nav_visit" },
];

// ---------- Header ----------
function PageHeader({ page = "home", lang, setLang }) {
  const t = window.T(lang || "en");
  return (
    <header className="signa-header" data-screen-label="header">
      <div className="signa-header-row">
        <a className="signa-mark" href="index.html">
          <span className="star" aria-hidden="true"></span>
          <span className="name">Signa<span style={{ color: "var(--red)" }}>.</span></span>
        </a>
        <nav>
          {PAGE_NAV.map((p) => (
            <a key={p.id} href={p.href} className={page === p.id ? "is-current" : ""}>{t(p.key)}</a>
          ))}
        </nav>
        <window.LangToggle lang={lang || "en"} onChange={setLang} />
        <span className="header-open-status header-slot"><window.OpenStatus compact /></span>
        <a className="desk-cta" href="https://signa.dishi.rest/" target="_blank" rel="noreferrer">{t("cta_order")}</a>
        <a className="burger" href="menu.html" aria-label="Menu"><span></span></a>
      </div>
    </header>
  );
}
window.PageHeader = PageHeader;

// ---------- Global chrome effects ----------
function useSiteChrome({ scrapbook = true } = {}) {
  useEffect(() => {
    document.body.classList.toggle("scrap-off", !scrapbook);
  }, [scrapbook]);

  // Tile light follows pointer
  useEffect(() => {
    let raf;
    const docEl = document.documentElement;
    const onPointer = (e) => {
      const x = e.clientX != null ? e.clientX : (e.touches && e.touches[0]?.clientX);
      const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0]?.clientY);
      if (x == null || y == null) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        docEl.style.setProperty("--light-x", `${(x / window.innerWidth * 100).toFixed(1)}%`);
        docEl.style.setProperty("--light-y", `${(y / window.innerHeight * 100).toFixed(1)}%`);
      });
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("touchstart", onPointer);
      cancelAnimationFrame(raf);
    };
  }, []);

  // scroll-y var + hero-mode flag for parallax & sticky CTA
  useEffect(() => {
    let raf;
    const body = document.body;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        body.style.setProperty("--scroll-y", window.scrollY + "px");
        body.classList.toggle("is-hero-mode", window.scrollY < 40);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
}
window.useSiteChrome = useSiteChrome;

// ---------- Visitor analytics (multi-page aware) ----------
// Mounted once per page load on EVERY page (Home, Menu, Place, Visit) via
// SiteShell -> useSiteAnalytics. Sends pv/click/scroll-depth/lang events to
// /track.php with a session id stored in sessionStorage (per-tab, not per-page).
function useSiteAnalytics({ page = "unknown", lang = "en" } = {}) {
  useEffect(() => {
    let sid = "";
    try {
      sid = sessionStorage.getItem("signa.sid") || "";
      if (!sid) {
        sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        sessionStorage.setItem("signa.sid", sid);
      }
    } catch (_) { sid = Math.random().toString(36).slice(2, 12); }

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
            body: payload, keepalive: true,
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

    // Page view — includes which page (home/menu/about/visit), language, viewport
    let tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) {}
    enqueue({
      t: "pv",
      page,
      lang,
      ref: document.referrer || "",
      vw: window.innerWidth,
      vh: window.innerHeight,
      tz,
      path: window.location.pathname,
    });

    // Click delegation — labels every anchor click with what it represents
    const labelFromHref = (href) => {
      if (!href) return null;
      if (href.startsWith("#")) return "nav_" + href.slice(1);
      if (href.startsWith("tel:")) return "phone";
      if (href.startsWith("mailto:")) return "email";
      if (/^index\.html?(\?|#|$)/.test(href) || href === "/") return "page_home";
      if (/^menu\.html?(\?|#|$)/.test(href))  return "page_menu";
      if (/^about\.html?(\?|#|$)/.test(href)) return "page_about";
      if (/^visit\.html?(\?|#|$)/.test(href)) return "page_visit";
      if (/^\/stories(\/|\?|#|$)/.test(href))   return "page_stories";
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
        if (dt) { enqueue({ t: "click", target: dt.slice(0, 64), page }); return; }
        if (el.tagName === "A") {
          const lbl = labelFromHref(el.getAttribute("href") || "");
          if (lbl) { enqueue({ t: "click", target: lbl, page }); return; }
        }
        el = el.parentElement;
      }
    };
    document.addEventListener("click", onClick, true);

    // Scroll depth — fire once per <section id="X"> as it crosses 50% viewport.
    // Multi-page-aware: discovers IDs from the live DOM instead of a hard-coded
    // list. Each event is namespaced by page so analytics can show e.g.
    // "menu / promos reached 65%" vs "home / feedback reached 90%".
    const reached = new Set();
    const onScrollDepth = () => {
      const half = window.innerHeight * 0.5;
      const sections = document.querySelectorAll("section[id]");
      sections.forEach((el, idx) => {
        const id = el.getAttribute("id");
        if (!id || reached.has(id)) return;
        const r = el.getBoundingClientRect();
        if (r.top < half) {
          reached.add(id);
          enqueue({
            t: "scroll",
            page,
            section: String(idx).padStart(2, "0") + "_" + id,
          });
        }
      });
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
  }, []);  // mount once per page load; page/lang captured in closure

  // Lang switch — emit a separate event when user toggles language
  useEffect(() => {
    if (!window.__signaTrack || !lang) return;
    const last = window.__signaLastLang;
    if (last && last !== lang) {
      window.__signaTrack({ t: "lang", from: last, to: lang, page });
    }
    window.__signaLastLang = lang;
  }, [lang]);
}
window.useSiteAnalytics = useSiteAnalytics;

// ---------- Shell ----------
function SiteShell({ page = "home", lang, setLang, scrapbook = true, showBottomCta = true, children }) {
  return (
    <div className="signa-app">
      <window.PageHeader page={page} lang={lang} setLang={setLang} />
      <main>{children}</main>
      {showBottomCta && <window.BottomCTA lang={lang} />}
    </div>
  );
}
window.SiteShell = SiteShell;

// ---------- Simple per-page mount helper ----------
// usage: mountSitePage("home", (props) => <>...sections...</>)
function mountSitePage(page, renderSections, opts = {}) {
  function PageApp() {
    const [lang, setLangState] = useState(() => {
      try { return localStorage.getItem("signa.lang") || "en"; } catch (_) { return "en"; }
    });
    const setLang = (v) => { setLangState(v); try { localStorage.setItem("signa.lang", v); } catch (_) {} };
    const scrapbook = opts.scrapbook !== false;
    window.useSiteChrome({ scrapbook });
    window.useSiteAnalytics({ page, lang });
    return (
      <window.SiteShell page={page} lang={lang} setLang={setLang} scrapbook={scrapbook} showBottomCta={opts.showBottomCta !== false}>
        {renderSections({ lang, scrapbook })}
      </window.SiteShell>
    );
  }
  const root = ReactDOM.createRoot(document.getElementById("root"));
  window.hydrateContent().then(() => root.render(<PageApp />));
}
window.mountSitePage = mountSitePage;
