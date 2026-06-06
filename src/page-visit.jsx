// page-visit.jsx
window.mountSitePage("visit", ({ lang, scrapbook }) => (
  <>
    <window.PageHero
      ix="VISIT" kicker="Visit & contact"
      titleA="FIND US," titleB="NUSA DUA."
      sub="Open 08:00–23:00 every day. Map, hours, answers and a direct line to the team."
    />
    <window.LocationSection scrapOn={scrapbook} lang={lang}/>
    <window.FAQSection scrapOn={scrapbook} lang={lang}/>
    <window.FeedbackSection scrapOn={scrapbook} lang={lang}/>
    <window.FooterSection/>
  </>
));
