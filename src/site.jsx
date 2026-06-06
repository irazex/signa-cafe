// site.jsx — shared multi-page shell + chrome
// Provides: PageHeader (page links), SiteShell (header+main+footer+bottomCTA),
// useSiteChrome (tile light, scroll-y, scrapbook class), and content hydration.

const { useState, useEffect } = React;

// ---------- Content hydration ----------
async function hydrateContent() {
  try {
    const local = localStorage.getItem("signa.admin.content");
    if (local) { window.CONTENT = JSON.parse(local); return; }
  } catch (_) {}
  try {
    const r = await fetch("content.json", { cache: "no-store" });
    if (r.ok) window.CONTENT = await r.json();
  } catch (_) {}
}
window.hydrateContent = hydrateContent;

// ---------- Page nav model ----------
const PAGE_NAV = [
  { id: "home",  href: "index.html", key: "nav_home" },
  { id: "menu",  href: "menu.html",  key: "nav_menu" },
  { id: "about", href: "about.html", key: "nav_about" },
  { id: "visit", href: "visit.html", key: "nav_visit" },
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
