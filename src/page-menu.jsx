// page-menu.jsx
window.mountSitePage("menu", ({ lang, scrapbook }) => (
  <>
    <window.PageHero
      ix="MENU" kicker="A taste of today's menu"
      titleA="EAT," titleB="TODAY."
      sub="A few of today's picks below. The full live menu — 180+ items with photos, current prices and availability — lives on our ordering page."
    />
    <window.MenuSection scrapOn={scrapbook} lang={lang}/>
    <window.PromosSection scrapOn={scrapbook} lang={lang}/>
    <window.SignatureSection scrapOn={scrapbook} lang={lang}/>
    <window.ProseSection
      id="menu-about" ix="MENU" label="About the food"
      titleA="Made fresh," titleB="every day."
      lead="A short, honest menu that runs from the first flat white to the last evening plate."
      paras={[
        "Signa is an all-day kitchen in Nusa Dua. Mornings start with specialty coffee, syrniki and big breakfasts; afternoons bring fresh pasta and salads; evenings settle into shared plates and Bali cocktails.",
        "Most dishes have vegetarian versions and the bakery counter runs all day — with everything thirty percent off in the last two hours before close.",
        "The cards above show twelve seasonal picks. Prices are in IDR. The full live menu, with photos and current availability, lives on our ordering page."
      ]}
    />
    <window.FooterSection/>
  </>
));
