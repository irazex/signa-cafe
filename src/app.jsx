// app.jsx — top-level App
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scrapbook": true,
  "tileSize": 44,
  "redAccent": "#EB3300",
  "showBottomCta": true,
  "lang": "en",
  "heroVariant": "responsive"
}/*EDITMODE-END*/;

function App(){
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

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
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        body.style.setProperty("--scroll-y", window.scrollY + "px");
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
        <window.BrandSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.FeedbackSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.MenuSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.SignatureSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.ExperienceSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.OrderSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.LocationSection scrapOn={t.scrapbook} lang={t.lang}/>
        <window.FooterSection lang={t.lang}/>
      </main>

      {t.showBottomCta && <window.BottomCTA lang={t.lang}/>}

      <window.TweaksPanel>
        <window.TweakSection label="Hero variant"/>
        <window.TweakRadio
          label="Variant"
          value={t.heroVariant}
          options={["responsive", "A", "B", "C", "D", "E"]}
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

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
