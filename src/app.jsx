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
  window.useSiteAnalytics({ page: "home", lang });

  // Visitor analytics (pv / click / scroll / lang) is now handled by
  // window.useSiteAnalytics in src/site.jsx — same hook is used on every
  // page (Home, Menu, Place, Visit) so we have consistent data across the
  // whole site. We called it above with { page: "home", lang }.

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
