// sections.jsx
// All 8 homepage sections + bottom sticky CTA.
// Each section is self-contained and uses ScrapLayer for the scrapbook layer.

const { useState, useEffect, useRef, useMemo } = React;

// ============================================================
// i18n — string dictionary + language toggle
// ============================================================
const STRINGS = {
  en: {
    nav_tell: "Contact us", nav_menu: "Menu", nav_sig: "Signature",
    nav_place: "Place", nav_order: "Order", nav_find: "Find us",
    cta_order: "Order →",
    // hero meta block
    hero_meta_loc: "— Nusa Dua · Bali", hero_meta_hours: "Open 08—22, daily",
    hero_meta_run: "— Family-run", hero_meta_since: "Since 2024",
    // hero tagline + blurb
    hero_tag_eat: "Eat.", hero_tag_meet: "Meet.", hero_tag_create: "Create.",
    hero_blurb: "Family-run cafe in Nusa Dua. Coffee, pizza, pasta, breakfast — all day. Come to eat, stay to meet, leave to create.",
    hero_stamp_run: "Family-run since 2024.",
    hero_stamp_more: "Coffee, pizza, pasta, breakfast — all day.",
    // hero CTAs
    hero_btn_menu: "MENU", hero_btn_order: "ORDER NOW",
    hero_btn_find: "FIND US", hero_btn_tell: "CONTACT US",
    hero_btn_tell_sub: "review or complain",
    hero_note_tap: "tap any  →",
    // feedback section
    fb_label: "Tell us",
    fb_title_a: "HOW WAS", fb_title_b: "YOUR FOOD?",
    fb_sub: "Three ways to keep Signa honest — dine-in or delivery. Pick one, we read every message.",
    fb_c1_h: "Something off?",
    fb_c1_p: "Cold food, wrong item, slow service — message the manager on WhatsApp. We fix it the same day.",
    fb_c1_cta: "Complain to manager",
    fb_c2_h: "Loved it?",
    fb_c2_p: "Leave a Google review — it's the single biggest thing you can do to help new guests find Signa.",
    fb_c2_cta: "Google review",
    fb_c3_h: "Got an idea?",
    fb_c3_p: "Two-minute form. Menu, atmosphere, music, kids zone — anything. We read every line.",
    fb_c3_cta: "Share an idea",
    // location
    loc_label: "Location",
    loc_title_a: "NUSA DUA,", loc_title_b: "BUKIT.",
    loc_address_lbl: "Address", loc_address_val: "Jl. Dharmawangsa, Jl. Raya Kampial, Benoa",
    loc_hours_lbl: "Hours", loc_hours_val: "08:00 — 22:00",
    loc_phone_lbl: "Phone",
    loc_wa_lbl: "WhatsApp", loc_wa_val: "Tap to message",
    loc_ig_lbl: "Instagram",
    loc_parking_note: "free parking ✿",
    // footer
    foot_label: "That's us.",
    foot_email_lbl: "Email", foot_order_lbl: "Order online",
    foot_loc_lbl: "Location", foot_loc_val: "Nusa Dua, Bali",
    foot_copy: "2026 · all rights",
    foot_tagline: "Signa Cafe · family-run since 2024",
    bottom_tell: "CONTACT ↗",
  },
  ru: {
    nav_tell: "Контакты", nav_menu: "Меню", nav_sig: "Сигнечные",
    nav_place: "Место", nav_order: "Заказ", nav_find: "Как найти",
    cta_order: "Заказать →",
    hero_meta_loc: "— Нуса Дуа · Бали", hero_meta_hours: "Открыто 08—22, ежедневно",
    hero_meta_run: "— Семейное", hero_meta_since: "С 2024 года",
    hero_tag_eat: "Ешь.", hero_tag_meet: "Общайся.", hero_tag_create: "Твори.",
    hero_blurb: "Семейное кафе в Нуса Дуа. Кофе, пицца, паста, завтраки — весь день. Приходи поесть, оставайся пообщаться, уходи творить.",
    hero_stamp_run: "Семейное кафе с 2024.",
    hero_stamp_more: "Кофе, пицца, паста, завтраки — весь день.",
    hero_btn_menu: "МЕНЮ", hero_btn_order: "ЗАКАЗАТЬ",
    hero_btn_find: "КАК НАЙТИ", hero_btn_tell: "СВЯЗАТЬСЯ",
    hero_btn_tell_sub: "отзыв или жалоба",
    hero_note_tap: "нажми  →",
    fb_label: "Контакты",
    fb_title_a: "НУ КАК", fb_title_b: "ВАМ ЕДА?",
    fb_sub: "Три способа нам сказать — в зале или по доставке. Выберите один, мы читаем всё.",
    fb_c1_h: "Что-то не так?",
    fb_c1_p: "Холодная еда, пропущенный заказ, медленный сервис — напишите менеджеру в WhatsApp. Решаем в тот же день.",
    fb_c1_cta: "Написать менеджеру",
    fb_c2_h: "Понравилось?",
    fb_c2_p: "Оставьте отзыв в Google — это самое важное, что вы можете сделать, чтобы помочь новым гостям найти Signa.",
    fb_c2_cta: "Отзыв в Google",
    fb_c3_h: "Есть идея?",
    fb_c3_p: "Две минуты. Меню, атмосфера, музыка, детская зона — что угодно. Читаем каждую строчку.",
    fb_c3_cta: "Поделиться",
    loc_label: "Локация",
    loc_title_a: "НУСА ДУА,", loc_title_b: "БУКИТ.",
    loc_address_lbl: "Адрес", loc_address_val: "Jl. Dharmawangsa, Jl. Raya Kampial, Benoa",
    loc_hours_lbl: "Часы", loc_hours_val: "08:00 — 22:00",
    loc_phone_lbl: "Телефон",
    loc_wa_lbl: "WhatsApp", loc_wa_val: "Написать в чат",
    loc_ig_lbl: "Instagram",
    loc_parking_note: "бесплатная парковка ✿",
    foot_label: "Это мы.",
    foot_email_lbl: "Email", foot_order_lbl: "Заказать онлайн",
    foot_loc_lbl: "Локация", foot_loc_val: "Нуса Дуа, Бали",
    foot_copy: "2026 · все права",
    foot_tagline: "Signa Cafe · семейное кафе с 2024",
    bottom_tell: "СВЯЗЬ ↗",
  },
  id: {
    nav_tell: "Kontak", nav_menu: "Menu", nav_sig: "Andalan",
    nav_place: "Tempat", nav_order: "Pesan", nav_find: "Lokasi",
    cta_order: "Pesan →",
    hero_meta_loc: "— Nusa Dua · Bali", hero_meta_hours: "Buka 08—22, setiap hari",
    hero_meta_run: "— Bisnis keluarga", hero_meta_since: "Sejak 2024",
    hero_tag_eat: "Makan.", hero_tag_meet: "Berkumpul.", hero_tag_create: "Berkarya.",
    hero_blurb: "Kafe keluarga di Nusa Dua. Kopi, pizza, pasta, sarapan — sepanjang hari. Datang untuk makan, tinggal untuk berkumpul, pergi untuk berkarya.",
    hero_stamp_run: "Bisnis keluarga sejak 2024.",
    hero_stamp_more: "Kopi, pizza, pasta, sarapan — sepanjang hari.",
    hero_btn_menu: "MENU", hero_btn_order: "PESAN SEKARANG",
    hero_btn_find: "LOKASI", hero_btn_tell: "HUBUNGI KAMI",
    hero_btn_tell_sub: "ulasan atau keluhan",
    hero_note_tap: "ketuk apa saja  →",
    fb_label: "Kontak",
    fb_title_a: "BAGAIMANA", fb_title_b: "MAKANANNYA?",
    fb_sub: "Tiga cara untuk jujur kepada Signa — di tempat atau pesan antar. Pilih satu, kami baca semuanya.",
    fb_c1_h: "Ada yang salah?",
    fb_c1_p: "Makanan dingin, pesanan salah, layanan lambat — hubungi manajer via WhatsApp. Kami selesaikan hari itu juga.",
    fb_c1_cta: "Hubungi manajer",
    fb_c2_h: "Suka banget?",
    fb_c2_p: "Tinggalkan ulasan Google — hal terpenting yang bisa Anda lakukan agar tamu baru menemukan Signa.",
    fb_c2_cta: "Ulasan Google",
    fb_c3_h: "Punya ide?",
    fb_c3_p: "Formulir 2 menit. Menu, suasana, musik, area anak — apa saja. Kami baca setiap baris.",
    fb_c3_cta: "Bagikan ide",
    loc_label: "Lokasi",
    loc_title_a: "NUSA DUA,", loc_title_b: "BUKIT.",
    loc_address_lbl: "Alamat", loc_address_val: "Jl. Dharmawangsa, Jl. Raya Kampial, Benoa",
    loc_hours_lbl: "Jam", loc_hours_val: "08:00 — 22:00",
    loc_phone_lbl: "Telepon",
    loc_wa_lbl: "WhatsApp", loc_wa_val: "Ketuk untuk chat",
    loc_ig_lbl: "Instagram",
    loc_parking_note: "parkir gratis ✿",
    foot_label: "Itulah kami.",
    foot_email_lbl: "Email", foot_order_lbl: "Pesan online",
    foot_loc_lbl: "Lokasi", foot_loc_val: "Nusa Dua, Bali",
    foot_copy: "2026 · hak cipta",
    foot_tagline: "Signa Cafe · bisnis keluarga sejak 2024",
    bottom_tell: "KONTAK ↗",
  },
};
const T = (lang) => (key) => (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key] || key;
window.STRINGS = STRINGS;
window.T = T;

function LangToggle({ lang, onChange }) {
  const opts = [{ id: "en", label: "EN" }, { id: "ru", label: "RU" }, { id: "id", label: "ID" }];
  return (
    <div className="lang-toggle" role="tablist" aria-label="Language">
      {opts.map(o => (
        <button
          key={o.id}
          role="tab"
          aria-selected={lang === o.id}
          className={`lang-btn ${lang === o.id ? "active" : ""}`}
          onClick={() => onChange(o.id)}
        >{o.label}</button>
      ))}
    </div>
  );
}
window.LangToggle = LangToggle;

// ============================================================
// PARALLAX DECORATION
// ============================================================
function ParallaxDecor({ src, alt, top, bottom, left, right, width, speed = -0.15, rotate = 0, spin = false, z = 0, drop = true }) {
  return (
    <div
      className={`parallax ${spin ? "parallax-spin" : ""}`}
      aria-hidden="true"
      style={{
        top, bottom, left, right,
        width,
        "--speed": speed,
        "--rot": rotate + "deg",
        zIndex: z
      }}>
      
      <img
        src={src}
        alt={alt || ""}
        loading="lazy"
        style={drop ? null : { filter: "none" }} />
      
    </div>);

}
window.ParallaxDecor = ParallaxDecor;

// ============================================================
// HEADER
// ============================================================
function SignaHeader({ lang, setLang }) {
  const onNav = (href) => (e) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const t = window.T(lang || "en");
  return (
    <header className="signa-header" data-screen-label="header">
      <div className="signa-header-row">
        <a className="signa-mark" href="#hero" onClick={onNav("#hero")}>
          <span className="star" aria-hidden="true"></span>
          <span className="name">Signa<span style={{ color: "var(--red)" }}>.</span></span>
        </a>
        <nav>
          <a href="#feedback" onClick={onNav("#feedback")}>{t("nav_tell")}</a>
          <a href="#menu" onClick={onNav("#menu")}>{t("nav_menu")}</a>
          <a href="#signature" onClick={onNav("#signature")}>{t("nav_sig")}</a>
          <a href="#experience" onClick={onNav("#experience")}>{t("nav_place")}</a>
          <a href="#order" onClick={onNav("#order")}>{t("nav_order")}</a>
          <a href="#location" onClick={onNav("#location")}>{t("nav_find")}</a>
        </nav>
        <window.LangToggle lang={lang || "en"} onChange={setLang} />
        <a className="desk-cta" href="https://signa.dishi.rest/" target="_blank" rel="noreferrer">{t("cta_order")}</a>
        <button className="burger" aria-label="Open menu">
          <span></span>
        </button>
      </div>
    </header>);

}

// ============================================================
// HERO  — 4 variants: A (current), B (dotted Sigma), C (photo), D (asymmetric)
// ============================================================
function HeroMeta({ lang }) {
  const t = window.T(lang || "en");
  return (
    <div className="hero-meta mono">
      <div>
        <div style={{ color: "rgba(0,0,0,.45)" }}>{t("hero_meta_loc")}</div>
        <b style={{ color: "var(--ink)" }}>{t("hero_meta_hours")}</b>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: "rgba(0,0,0,.45)" }}>{t("hero_meta_run")}</div>
        <b style={{ color: "var(--ink)" }}>{t("hero_meta_since")}</b>
      </div>
    </div>
  );
}
function HeroCTAs({ scrapOn, lang }) {
  const t = window.T(lang || "en");
  return (
    <div className="hero-cta-stack">
      {scrapOn && <div className="h-note hand-only">{t("hero_note_tap")}</div>}
      <a className="h-btn red" href="https://signa.dishi.rest/" target="_blank" rel="noreferrer">
        <span>{t("hero_btn_menu")}</span><span className="arr">→</span>
      </a>
      <a className="h-btn" href="https://signa.dishi.rest/" target="_blank" rel="noreferrer">
        <span>{t("hero_btn_order")}</span><span className="arr">→</span>
      </a>
      <a className="h-btn outline" href="#location"
        onClick={(e) => { e.preventDefault(); document.querySelector("#location")?.scrollIntoView({ behavior: "smooth" }); }}>
        <span>{t("hero_btn_find")}</span><span className="arr">→</span>
      </a>
      <a className="h-btn outline subtle" href="#feedback"
        onClick={(e) => { e.preventDefault(); document.querySelector("#feedback")?.scrollIntoView({ behavior: "smooth" }); }}>
        <span>{t("hero_btn_tell")} <span style={{ opacity: .6, marginLeft: 4 }}>· {t("hero_btn_tell_sub")}</span></span>
        <span className="arr">↗</span>
      </a>
    </div>
  );
}

// Responsive viewport hook (used to swap hero variants on mobile/desktop)
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [breakpoint]);
  return isMobile;
}
window.useIsMobile = useIsMobile;

function HeroSection({ scrapOn, lang, variant = "responsive" }) {
  const isMobile = useIsMobile(768);
  // "responsive" (default for prod) → mobile=D, desktop=B
  if (variant === "responsive") {
    return isMobile
      ? <HeroVariantD scrapOn={scrapOn} lang={lang} />
      : <HeroVariantB scrapOn={scrapOn} lang={lang} />;
  }
  // Explicit variants (used by Tweaks panel)
  if (variant === "A") return <HeroVariantA scrapOn={scrapOn} lang={lang} />;
  if (variant === "B") return <HeroVariantB scrapOn={scrapOn} lang={lang} />;
  if (variant === "C") return <HeroVariantC scrapOn={scrapOn} lang={lang} />;
  if (variant === "D") return <HeroVariantD scrapOn={scrapOn} lang={lang} />;
  if (variant === "E") return <HeroVariantE scrapOn={scrapOn} lang={lang} />;
  return <HeroVariantA scrapOn={scrapOn} lang={lang} />;
}

function HeroVariantA({ scrapOn }) {
  const ref = window.useReveal();
  return (
    <section id="hero" className="s-section hero-sec v-a" ref={ref} data-screen-label="01 hero">
      <div className="hero-left">
        <HeroMeta />
        <h1 className="hero-headline">
          <span className="scribble s1">{scrapOn ? "↑ since 2024" : ""}</span>
          EAT.<br />
          MEET.<br />
          <span className="r">CREATE.</span>
          <span className="scribble s2">{scrapOn ? "family-friendly ✿" : ""}</span>
        </h1>
        <div className="hero-stamp">
          <div className="star-big" aria-hidden="true"></div>
          <div className="stamp-text">
            Urban food.<br />
            <b>Coffee, pizza, pasta, breakfast — all day.</b>
          </div>
        </div>
      </div>
      <HeroCTAs scrapOn={scrapOn} />
      {scrapOn && (
        <window.ScrapLayer
          items={[
            { kind: "sparkle", top: "120px", right: "12%", rotate: 8, size: 36 },
            { kind: "heart", top: "44%", left: "-6px", rotate: -16, size: 44 },
            { kind: "star", top: "60%", right: "8%", rotate: 14, size: 46 },
          ]}
        />
      )}
    </section>
  );
}

// ============================================================
// FLOATING SYRNIK — 3D centerpiece with dripping caramel
// ============================================================
function FloatingSyrnik() {
  const stageRef = React.useRef(null);

  // Subtle pointer-driven parallax tilt on the syrnik
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let raf;
    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / r.width;   // -0.5..0.5 around center
      const dy = (e.clientY - cy) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        stage.style.setProperty("--mx", dx.toFixed(3));
        stage.style.setProperty("--my", dy.toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="syrnik-stage" ref={stageRef} aria-hidden="true">
      <div className="syrnik-halo"></div>

      <div className="syrnik-3d">
        <div className="syrnik-bob">
          <div className="syrnik-tilt">
            {/* 3D model centerpiece — real photogrammetry mesh */}
            <window.Syrnik3D />
          </div>
        </div>

        {/* contact shadow on the ground */}
        <div className="syrnik-shadow"></div>
      </div>
    </div>
  );
}

function HeroVariantB({ scrapOn, lang }) {
  const ref = window.useReveal();
  const t = window.T(lang || "en");
  return (
    <section id="hero" className="s-section hero-sec v-b" ref={ref} data-screen-label="01 hero">
      <div className="hero-left">
        <HeroMeta lang={lang} />
        <div className="hero-b-wordmark">
          <img src="assets/logo-dotted-sigma.png" alt="Signa wordmark" />
        </div>
        <div className="hero-b-tag">
          <span>{t("hero_tag_eat")}</span>&nbsp;<span>{t("hero_tag_meet")}</span>&nbsp;<span className="r">{t("hero_tag_create")}</span>
        </div>
        <div className="hero-stamp">
          <div className="star-big" aria-hidden="true"></div>
          <div className="stamp-text">
            {t("hero_stamp_run")}<br />
            <b>{t("hero_stamp_more")}</b>
          </div>
        </div>
      </div>
      <HeroCTAs scrapOn={scrapOn} lang={lang} />
      {scrapOn && (
        <window.ScrapLayer
          items={[
            { kind: "sparkle", top: "40%", right: "8%", rotate: 12, size: 36 },
            { kind: "heart", top: "70%", left: "-6px", rotate: -16, size: 44 },
          ]}
        />
      )}
    </section>
  );
}

function HeroVariantC({ scrapOn }) {
  const ref = window.useReveal();
  return (
    <section id="hero" className="hero-sec v-c" ref={ref} data-screen-label="01 hero">
      <div className="hero-c-bg" aria-hidden="true"></div>
      <div className="hero-c-overlay" aria-hidden="true"></div>
      <div className="hero-c-content">
        <div className="hero-c-top mono">
          <span>NUSA DUA · BALI · 08—22</span>
          <span className="r">SINCE 2024</span>
        </div>
        <h1 className="hero-c-title">
          SIGNA<span className="r">.</span>
        </h1>
        <div className="hero-c-tag">
          Eat <span className="r">·</span> Meet <span className="r">·</span> <span className="r">Create</span>
        </div>
        <div className="hero-c-ctas">
          <a className="h-btn red" href="https://signa.dishi.rest/" target="_blank" rel="noreferrer">
            <span>MENU</span><span className="arr">→</span>
          </a>
          <a className="h-btn paper" href="#order"
            onClick={(e) => { e.preventDefault(); document.querySelector("#order")?.scrollIntoView({ behavior: "smooth" }); }}>
            <span>ORDER</span><span className="arr">↓</span>
          </a>
          <a className="h-btn outline-paper" href="#feedback"
            onClick={(e) => { e.preventDefault(); document.querySelector("#feedback")?.scrollIntoView({ behavior: "smooth" }); }}>
            <span>CONTACT</span><span className="arr">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function HeroVariantD({ scrapOn, lang }) {
  const ref = window.useReveal();
  const t = window.T(lang || "en");
  return (
    <section id="hero" className="s-section hero-sec v-d" ref={ref} data-screen-label="01 hero">
      <div className="hero-d-grid">
        <div className="hero-d-left">
          <div className="hero-d-star" aria-hidden="true"></div>
          <div className="hero-d-mark">SIGNA<span className="r">.</span></div>
        </div>
        <div className="hero-d-right">
          <HeroMeta lang={lang} />
          <h2 className="hero-d-tagline">
            {t("hero_tag_eat")} {t("hero_tag_meet")} <span className="r">{t("hero_tag_create")}</span>
          </h2>
          <p className="hero-d-blurb">
            {t("hero_blurb")}
          </p>
          <HeroCTAs scrapOn={scrapOn} lang={lang} />
        </div>
      </div>
      {scrapOn && (
        <window.ScrapLayer
          items={[
            { kind: "sparkle", top: "20%", left: "40%", rotate: 8, size: 34 },
          ]}
        />
      )}
    </section>
  );
}

function HeroVariantE({ scrapOn }) {
  const ref = window.useReveal();
  return (
    <section id="hero" className="hero-sec v-e" ref={ref} data-screen-label="01 hero">
      <div className="hero-e-grid">
        <div className="hero-e-text">
          <HeroMeta />
          <h1 className="hero-e-title">
            EAT.<br />
            MEET.<br />
            <span className="r">CREATE.</span>
          </h1>
          <div className="hero-e-blurb">
            <b>Family-run, Nusa Dua.</b><br />
            Coffee, pizza, pasta, breakfast — all day.
          </div>
          <HeroCTAs scrapOn={scrapOn} />
        </div>

        <div className="hero-e-stage" aria-hidden="true">
          <div className="hero-e-halo"></div>
          <div className="hero-e-star-bg"></div>
          <img className="hero-e-product" src="assets/syrniki.png" alt="" />
        </div>
      </div>

      {scrapOn && (
        <window.ScrapLayer
          items={[
            { kind: "sparkle", top: "8%", right: "8%", rotate: 12, size: 36 },
          ]}
        />
      )}
    </section>
  );
}

// Wire variant E into the dispatcher
function _hookHeroE(){}

// ============================================================
// BRAND / BERNARD
// ============================================================
function BrandSection({ scrapOn }) {
  const ref = window.useReveal();
  return (
    <section id="brand" className="brand-sec reveal" ref={ref} data-screen-label="02 brand">
      <div className="brand-label">
        <b>02 / Brand</b> &nbsp; — &nbsp; George Bernard, mascot
      </div>

      <div className="brand-image" aria-hidden="true"></div>

      <div className="brand-content">
        <h2 className="brand-quote">
          COME TO <span className="r">EAT.</span><br />
          STAY TO <span className="r">MEET.</span><br />
          LEAVE TO<br />
          <span className="r">CREATE.</span>
        </h2>
        <div className="brand-cite">
          — The Signa promise &nbsp; · &nbsp; Family-run since 2024 &nbsp; · &nbsp; Nusa Dua, Bali
        </div>
      </div>

      {scrapOn &&
      <window.ScrapLayer
        over
        items={[
        { kind: "sparkle", top: "20%", right: "8%", rotate: 12, size: 32, stroke: "var(--paper)" },
        { kind: "arrow", bottom: "30%", left: "8%", rotate: -18, size: 40, stroke: "var(--red)" }]
        }
        notes={[
        { text: "← that's bernard", top: "44%", left: "6%", rotate: -8, fontSize: 20, red: true }]
        } />

      }
    </section>);

}

// ============================================================
// MENU
// ============================================================
const MENU_DATA = [
{ id: 1, title: "All-day breakfast", price: "from 75k", cat: "breakfast", img: "assets/photo-breakfast.jpg", badge: "Popular" },
{ id: 2, title: "Mango smoothie", price: "55k", cat: "drinks", img: "assets/photo-smoothie.jpg" },
{ id: 3, title: "Signature dinner", price: "120k+", cat: "main", img: "assets/photo-dinner.jpg" },
{ id: 4, title: "Today's special", price: "ask waiter", cat: "special", accent: true, badge: "Today" },
{ id: 5, title: "Bali cocktails", price: "from 95k", cat: "drinks", img: "assets/photo-cocktail.jpg" },
{ id: 6, title: "Daylight bites", price: "from 60k", cat: "main", img: "assets/photo-9742.jpg" },
{ id: 7, title: "Evening plates", price: "from 110k", cat: "main", img: "assets/photo-9831.jpg" },
{ id: 8, title: "Kids menu", price: "from 45k", cat: "kids", img: "assets/photo-8962.jpg" }];


const MENU_CATS = ["All", "Breakfast", "Drinks", "Main", "Kids", "Special"];

function MenuSection({ scrapOn }) {
  const [cat, setCat] = useState("All");
  const ref = window.useReveal();
  const filtered = useMemo(() => {
    if (cat === "All") return MENU_DATA;
    return MENU_DATA.filter((m) => m.cat.toLowerCase() === cat.toLowerCase());
  }, [cat]);

  return (
    <section id="menu" className="s-section menu-sec reveal" ref={ref} data-screen-label="04 menu">
      <div className="s-label">
        <span className="dot"></span><span className="ix">04</span> Menu — today
      </div>
      <div className="menu-head">
        <h2 className="menu-title">
          EAT, <span className="r">TODAY.</span>
        </h2>
        <div className="menu-pills" role="tablist">
          {MENU_CATS.map((c) =>
          <button
            key={c}
            role="tab"
            aria-selected={cat === c}
            className={`menu-pill ${cat === c ? "active" : ""}`}
            onClick={() => setCat(c)}>
            {c}</button>
          )}
        </div>
      </div>

      <div className="menu-grid">
        {filtered.map((m, i) =>
        <a
          key={m.id}
          className={`menu-card ${m.accent ? "accent" : ""}`}
          style={m.img ? { backgroundImage: `url('${m.img}')` } : null}
          href="https://signa.dishi.rest/"
          target="_blank"
          rel="noreferrer">
          
            {m.badge && <span className="badge">{m.badge}</span>}
            <div className="ovl"></div>
            <div className="cap">
              {m.title}
              <span className="price">{m.price}</span>
            </div>
          </a>
        )}
      </div>

      <div className="menu-foot">
        {scrapOn ?
        <span className="h-note hand-only">try ricotta pancakes ↗</span> :
        <span></span>}
        <a href="https://signa.dishi.rest/" target="_blank" rel="noreferrer">
          Full menu →
        </a>
      </div>

      {scrapOn &&
      <window.ScrapLayer
        items={[
        { kind: "arrow", top: "40%", right: "0", rotate: -22, size: 38 }]
        } />

      }
    </section>);

}

// ============================================================
// SIGNATURE — horizontal swipe carousel
// ============================================================
const SIGNATURE_DATA = [
{ n: 1, title: "Ricotta\nPancakes", meta: "Brunch · 75k", img: "assets/photo-breakfast.jpg" },
{ n: 2, title: "Mango\nSmoothie", meta: "Cold · 55k", img: "assets/photo-smoothie.jpg" },
{ n: 3, title: "Family\nDinner", meta: "Evening · 120k+", img: "assets/photo-dinner.jpg" },
{ n: 4, title: "Bali\nCocktail", meta: "Drinks · 95k", img: "assets/photo-cocktail.jpg" },
{ n: 5, title: "Sunset\nPlates", meta: "Main · 110k+", img: "assets/photo-9831.jpg" },
{ n: 6, title: "Kids'\nFavourites", meta: "Family · 45k", img: "assets/photo-8962.jpg" }];


function SignatureSection({ scrapOn }) {
  const railRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const ref = window.useReveal();

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let raf;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const slides = rail.querySelectorAll(".sig-slide");
        let best = 0;let bestDist = Infinity;
        const railLeft = rail.getBoundingClientRect().left;
        slides.forEach((s, i) => {
          const r = s.getBoundingClientRect();
          const dist = Math.abs(r.left - railLeft);
          if (dist < bestDist) {bestDist = dist;best = i;}
        });
        setIdx(best);
      });
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => {rail.removeEventListener("scroll", onScroll);cancelAnimationFrame(raf);};
  }, []);

  return (
    <section id="signature" className="sig-sec reveal" ref={ref} data-screen-label="05 signature">
      <div className="sig-head">
        <div className="s-label" style={{ color: "rgba(255,254,249,.55)" }}>
          <span className="dot"></span>
          <span className="ix" style={{ color: "var(--paper)" }}>05</span>
          Signature
        </div>
        <h2 className="sig-title">
          ONE DISH —<br />
          <span className="r">ONE SCREEN.</span>
        </h2>
      </div>

      {/* Parallax syrniki — anchored deep inside signature, peeks from left edge */}
      <window.ParallaxDecor
        src="assets/syrniki.png"
        alt=""
        top="auto"
        bottom="60px"
        left="-18vw"
        width="clamp(180px, 26vw, 320px)"
        speed={0.10}
        rotate={8}
        z={0} />
      

      <div className="sig-rail" ref={railRef}>
        {SIGNATURE_DATA.map((s, i) =>
        <div key={s.n} className="sig-slide" style={{ backgroundImage: `url('${s.img}')` }}>
            <div className="ovl"></div>
            <div className="top-lbl"><b>{String(s.n).padStart(2, "0")}</b> &nbsp;/ {String(SIGNATURE_DATA.length).padStart(2, "0")}</div>
            <div className="cap">
              <h3>{s.title.split("\n").map((line, j) =>
              <React.Fragment key={j}>{line}{j === 0 && <br />}</React.Fragment>
              )}</h3>
              <div className="meta">{s.meta}</div>
            </div>
          </div>
        )}
      </div>

      <div className="sig-progress">
        <div className="sig-dots">
          {SIGNATURE_DATA.map((_, i) =>
          <span key={i} className={i === idx ? "on" : ""}></span>
          )}
        </div>
        <div className="sig-count">
          {String(idx + 1).padStart(2, "0")} / {String(SIGNATURE_DATA.length).padStart(2, "0")}
        </div>
      </div>
    </section>);

}

// ============================================================
// EXPERIENCE — tile mosaic
// ============================================================
const EXPERIENCE_TILES = [
{ cls: "c1", img: "assets/photo-interior.jpg", lbl: "Interior" },
{ cls: "c2", img: "assets/photo-9742.jpg", lbl: "Detail" },
{ cls: "c3", red: true, lbl: "Brand" },
{ cls: "c4", img: "assets/photo-9887.jpg", lbl: "Bar" },
{ cls: "c5", img: "assets/photo-dinner.jpg", lbl: "Tables" },
{ cls: "c6", img: "assets/photo-cocktail.jpg", lbl: "Drinks" },
{ cls: "c7", ink: true, lbl: "Logo" },
{ cls: "c8", img: "assets/photo-9831.jpg", lbl: "Evening" }];


function ExperienceSection({ scrapOn }) {
  const ref = window.useReveal();
  return (
    <section id="experience" className="s-section exp-sec reveal" ref={ref} data-screen-label="06 experience">
      <div className="exp-head">
        <div className="s-label">
          <span className="dot"></span><span className="ix">06</span> The place
        </div>
        <h2 className="exp-title">
          INSIDE <span className="r">SIGNA.</span>
        </h2>
      </div>

      <div className="exp-grid">
        {EXPERIENCE_TILES.map((t, i) =>
        <div
          key={i}
          className={`exp-cell ${t.cls} ${t.red ? "red" : ""} ${t.ink ? "ink" : ""}`}
          style={t.img ? { backgroundImage: `url('${t.img}')` } : null}>
          
            {(t.red || t.ink) && <div className="exp-star" aria-hidden="true"></div>}
            <div className="lbl">{t.lbl}</div>
          </div>
        )}
      </div>

      {scrapOn &&
      <window.ScrapLayer
        items={[
        { kind: "smiley", top: "120px", right: "12px", rotate: 8, size: 44 }]
        }
        notes={[
        { text: "expat-friendly ☕", top: "60px", left: "60%", rotate: -2, fontSize: 20 }]
        } />

      }
    </section>);

}

// ============================================================
// ORDER
// ============================================================
function OrderSection({ scrapOn }) {
  const ref = window.useReveal();
  return (
    <section id="order" className="s-section order-sec reveal" ref={ref} data-screen-label="07 order">
      <div className="s-label">
        <span className="dot"></span><span className="ix">07</span> Order
      </div>
      <h2 className="order-title">
        ORDER, <span className="r">NOW.</span>
      </h2>

      <div className="order-stack">
        <a className="order-card red"
        href="https://signa.dishi.rest/" target="_blank" rel="noreferrer">
          <div>
            SIGNA.MENU
            <span className="meta">In-house ordering · fastest</span>
          </div>
          <span className="arr">→</span>
        </a>
        <a className="order-card solid"
        href="https://gofood.link/a/L3hUVxW" target="_blank" rel="noreferrer">
          <div>
            GoFood
            <span className="meta">Delivery via Gojek</span>
          </div>
          <span className="arr">↗</span>
        </a>
        <a className="order-card"
        href="https://food.grab.com/id/en/restaurant/signa-cafe-benoa-delivery/6-C6KJEEXWNENGJX"
        target="_blank" rel="noreferrer">
          <div>
            GrabFood
            <span className="meta">Delivery via Grab</span>
          </div>
          <span className="arr">↗</span>
        </a>
        <a className="order-card"
        href="https://wa.me/+6289654027190" target="_blank" rel="noreferrer">
          <div>
            WhatsApp
            <span className="meta">Talk to manager · table booking</span>
          </div>
          <span className="arr">↗</span>
        </a>
      </div>

      <div className="order-note">
        Open 08—22 · last order 21:30
      </div>

      {scrapOn && (
        <window.ScrapLayer
          notes={[
            { text: "fastest ↑", top: "30%", right: "12%", rotate: -8, fontSize: 20, red: true },
          ]}
        />
      )}

      {/* Parallax pizza — bigger, more off-screen on the right, no spin, parallax drift only */}
      <window.ParallaxDecor
        src="assets/pizza-margherita.png"
        alt=""
        top="-450px"
        right="-22vw"
        width="clamp(300px, 50vw, 600px)"
        speed={0.10}
        rotate={-10}
        spin={false}
        z={0} />
    </section>
  );
}

// ============================================================
// LOCATION
// ============================================================
function LocationSection({ scrapOn, lang }) {
  const ref = window.useReveal();
  const t = window.T(lang || "en");
  return (
    <section id="location" className="s-section loc-sec reveal" ref={ref} data-screen-label="08 location">
      <div className="s-label">
        <span className="dot"></span><span className="ix">08</span> {t("loc_label")}
      </div>
      <h2 className="loc-title">
        {t("loc_title_a")}<br /><span className="r">{t("loc_title_b")}</span>
      </h2>

      <div className="loc-map loc-map-google">
        <iframe
          title="Signa Cafe on Google Maps"
          src="https://www.google.com/maps?q=Signa+Cafe,+Jl.+Dharmawangsa,+Jl.+Raya+Kampial,+Benoa,+Nusa+Dua,+Bali&output=embed"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen=""
          style={{ border: 0, width: "100%", height: "100%", display: "block" }}
        />
        <div className="corner">NUSA DUA · BALI</div>
      </div>

      <div className="loc-meta">
        <a className="loc-row"
        href="https://maps.google.com/maps?daddr=Signa Cafe, Jl. Dharmawangsa Jl. Raya Kampial, Benoa, Kec. Kuta Sel., Kabupaten Badung, Bali 80361"
        target="_blank" rel="noreferrer">
          <span className="lbl">{t("loc_address_lbl")}</span>
          <span className="val">{t("loc_address_val")}</span>
          <span className="arr">→</span>
        </a>
        <div className="loc-row">
          <span className="lbl">{t("loc_hours_lbl")}</span>
          <span className="val">{t("loc_hours_val")}</span>
          <span></span>
        </div>
        <a className="loc-row" href="tel:+6289654027190">
          <span className="lbl">{t("loc_phone_lbl")}</span>
          <span className="val">+62 896 540 27 190</span>
          <span className="arr">→</span>
        </a>
        <a className="loc-row" href="https://wa.me/+6289654027190" target="_blank" rel="noreferrer">
          <span className="lbl">{t("loc_wa_lbl")}</span>
          <span className="val">{t("loc_wa_val")}</span>
          <span className="arr">↗</span>
        </a>
        <a className="loc-row" href="https://www.instagram.com/signa.cafe/" target="_blank" rel="noreferrer">
          <span className="lbl">{t("loc_ig_lbl")}</span>
          <span className="val">@signa.cafe</span>
          <span className="arr">↗</span>
        </a>
      </div>

      {scrapOn &&
      <window.ScrapLayer
        notes={[
        { text: t("loc_parking_note"), top: "40%", left: "16%", rotate: -4, fontSize: 20, red: true }]
        } />

      }
    </section>);

}

// ============================================================
// FEEDBACK — complain / love / suggest
// ============================================================
function FeedbackSection({ scrapOn, lang }) {
  const ref = window.useReveal();
  const t = window.T(lang || "en");
  return (
    <section id="feedback" className="s-section fb-sec reveal" ref={ref} data-screen-label="03 feedback">
      <div className="s-label">
        <span className="dot"></span><span className="ix">03</span> {t("fb_label")}
      </div>
      <h2 className="fb-title">
        {t("fb_title_a")} <span className="r">{t("fb_title_b")}</span>
      </h2>
      <p className="fb-sub">
        {t("fb_sub")}
      </p>

      <div className="fb-grid">
        <a className="fb-card" href="https://wa.me/+6288987127671" target="_blank" rel="noreferrer">
          <div className="fb-stars complain"><span>☆☆☆☆</span><span className="filled">★</span></div>
          <h3>{t("fb_c1_h")}</h3>
          <p>{t("fb_c1_p")}</p>
          <span className="fb-cta">{t("fb_c1_cta")} <span className="arr">↗</span></span>
        </a>

        <a className="fb-card primary" href="https://g.page/r/CZpcFedoGOxKEAE/review" target="_blank" rel="noreferrer">
          <div className="fb-stars love">★★★★★</div>
          <h3>{t("fb_c2_h")}</h3>
          <p>{t("fb_c2_p")}</p>
          <span className="fb-cta">{t("fb_c2_cta")} <span className="arr">↗</span></span>
        </a>

        <a className="fb-card" href="https://forms.gle/kEvTuhfnYaoqoU6j9" target="_blank" rel="noreferrer">
          <div className="fb-stars suggest">↑↑↑</div>
          <h3>{t("fb_c3_h")}</h3>
          <p>{t("fb_c3_p")}</p>
          <span className="fb-cta">{t("fb_c3_cta")} <span className="arr">↗</span></span>
        </a>
      </div>

      {scrapOn && (
        <window.ScrapLayer
          notes={[
            { text: "↑ google review helps most", left: "44%", bottom: "32px", rotate: -3, fontSize: 18, red: true },
          ]}
        />
      )}
    </section>
  );
}


// ============================================================
// FOOTER
// ============================================================
function FooterSection({ lang }) {
  const ref = window.useReveal();
  const t = window.T(lang || "en");
  return (
    <section id="footer" className="foot-sec reveal" ref={ref} data-screen-label="09 footer">
      <div className="brand-label">
        <b>09 / Footer</b> &nbsp; — &nbsp; {t("foot_label")}
      </div>

      <div className="foot-mark">
        SIGNA<span className="r">.</span>
      </div>

      <div className="foot-links">
        <a className="foot-row" href="https://www.instagram.com/signa.cafe/" target="_blank" rel="noreferrer">
          <span className="lbl">{t("loc_ig_lbl")}</span><span className="val">@signa.cafe</span>
        </a>
        <a className="foot-row" href="https://wa.me/+6289654027190" target="_blank" rel="noreferrer">
          <span className="lbl">{t("loc_wa_lbl")}</span><span className="val">+62 896 540 27 190</span>
        </a>
        <a className="foot-row" href="mailto:hi@signa.cafe">
          <span className="lbl">{t("foot_email_lbl")}</span><span className="val">hi@signa.cafe</span>
        </a>
        <a className="foot-row" href="https://signa.dishi.rest/" target="_blank" rel="noreferrer">
          <span className="lbl">{t("foot_order_lbl")}</span><span className="val">signa.dishi.rest ↗</span>
        </a>
        <div className="foot-row">
          <span className="lbl">{t("foot_loc_lbl")}</span><span className="val">{t("foot_loc_val")}</span>
        </div>
        <div className="foot-row">
          <span className="lbl">©</span><span className="val">{t("foot_copy")}</span>
        </div>
      </div>

      <div className="foot-bottom">
        <span>{t("foot_tagline")}</span>
        <span>{t("hero_tag_eat")} {t("hero_tag_meet")} {t("hero_tag_create")}</span>
      </div>
    </section>);

}

// ============================================================
// BOTTOM STICKY CTA
// ============================================================
function BottomCTA({ lang }) {
  const tStr = window.T(lang || "en");
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const onScroll = () => {
      // Hide on hero + footer; visible otherwise
      const hero = document.getElementById("hero");
      const footer = document.getElementById("footer");
      const sy = window.scrollY;
      const hh = hero ? hero.offsetHeight : 600;
      const fh = footer ? footer.offsetTop : Infinity;
      const inHero = sy < hh - 100;
      const inFooter = sy > fh - 200;
      setHidden(inHero || inFooter);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`bottom-cta ${hidden ? "hidden" : ""}`} aria-hidden={hidden}>
      <a className="b-logo" href="#hero" aria-label="Top"
      onClick={(e) => {e.preventDefault();window.scrollTo({ top: 0, behavior: "smooth" });}}>
        <span className="star-bs" aria-hidden="true"></span>
      </a>
      <a className="b-btn red"
      href="https://signa.dishi.rest/" target="_blank" rel="noreferrer">
        MENU →
      </a>
      <a className="b-btn"
      href="#feedback"
      onClick={(e) => {e.preventDefault();document.querySelector("#feedback")?.scrollIntoView({ behavior: "smooth" });}}>
        {tStr("bottom_tell")}
      </a>
    </div>);

}


// Export to window
Object.assign(window, {
  SignaHeader, HeroSection, BrandSection, MenuSection, SignatureSection,
  ExperienceSection, OrderSection, LocationSection, FeedbackSection,
  FooterSection, BottomCTA
});