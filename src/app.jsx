// app.jsx — top-level App
const { useState, useEffect } = React;

// Hydrate content from localStorage (admin overrides) or content.json
async function hydrateContent() {
  // Admin localStorage override first
  try {
    const local = localStorage.getItem("signa.admin.content");
    if (local) {
      window.CONTENT = JSON.parse(local);
      return;
    }
  } catch (_) {}
  // Fetch live content.json
  try {
    const r = await fetch("content.json", { cache: "no-store" });
    if (r.ok) window.CONTENT = await r.json();
  } catch (_) {}
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scrapbook": true,
  "tileSize": 44,
  "redAccent": "#EB3300",
  "showBottomCta": true,
  "lang": "en",
  "heroVariant": "auto"
}/*EDITMODE-END*/;

function App(){
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [activeSection, setActiveSection] = useState(0);

  // Sync scrapbook flag to body class so CSS can react
  useEffect(() => {
    document.body.classList.toggle("scrap-off", !t.scrapbook);
  }, [t.scrapbook]);

  // Sync tile size + red colour to CSS vars on :root
  useEffect(() => {
    document.documentElement.style.setProperty("--tile", t.tileSize + "px");
  }, [t.tileSize]);
  useEffect(() => {
    document.documentElement.style.setProperty("--red", t.redAccent);
  }, [t.redAccent]);

  // Tile pattern light — follows scroll & pointer
  useEffect(() => {
    let raf;
    const docEl = document.documentElement;
    const onPointer = (e) => {
      const x = e.clientX != null ? e.clientX : (e.touches && e.touches[0]?.clientX);
      const y = e.clientY != null ? e.clientY : (e.touches && e.touches[0]?.clientY);
      if (x == null || y == null) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        docEl.style.setProperty("--light-x", `${(x / w * 100).toFixed(1)}%`);
        docEl.style.setProperty("--light-y", `${(y / h * 100).toFixed(1)}%`);
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

  // Parallax — body --scroll-y updated on scroll
  useEffect(() => {
    let raf;
    const body = document.body;
    const RAIL_IDS = ["hero","brand","feedback","menu","promos","signature","experience","order","faq","location"];
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        body.style.setProperty("--scroll-y", window.scrollY + "px");
        // Track whether we're at the very top — used for floating open-status
        body.classList.toggle("is-hero-mode", window.scrollY < 40);
        // Determine which rail section is currently in view
        const sentinel = window.innerHeight * 0.3;
        let bestIdx = 0;
        for (let i = 0; i < RAIL_IDS.length; i++){
          const el = document.getElementById(RAIL_IDS[i]);
          if (!el) continue;
          const top = el.getBoundingClientRect().top;
          if (top - sentinel <= 0) bestIdx = i;
        }
        setActiveSection(bestIdx);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="signa-app">
      <window.SignaHeader lang={t.lang} setLang={(v) => setTweak("lang", v)}/>

      <main>
        <window.HeroSection scrapOn={t.scrapbook} lang={t.lang} variant={t.heroVariant}/>
        <window.ReviewsBadge/>
        <window.BrandSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.FeedbackSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.MenuSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.PromosSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.SignatureSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.ExperienceSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.OrderSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.FAQSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.LocationSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.FooterSection lang={t.lang}/>
      </main>

      {t.showBottomCta && <window.BottomCTA lang={t.lang}/>}

      <window.SectionRail active={activeSection}/>

      <window.TweaksPanel>
        <window.TweakSection label="Hero variant"/>
        <window.TweakRadio
          label="Variant"
          value={t.heroVariant}
          options={["auto", "A", "B", "C", "D", "E"]}
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

// Mount — hydrate content first, then render
const root = ReactDOM.createRoot(document.getElementById("root"));
hydrateContent().then(() => root.render(<App/>));
