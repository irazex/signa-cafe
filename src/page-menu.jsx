// page-menu.jsx
window.mountSitePage("menu", ({ lang, scrapbook }) => (
  <>
    <window.PageHero
      ix="MENU" kicker="Menu — today"
      titleA="EAT," titleB="TODAY."
      sub="Specialty coffee, wood-fire pizza, fresh pasta and all-day breakfast. Dine in, take away, or order for delivery."
    />
    <window.MenuSection scrapOn={scrapbook} lang={lang}/>
    <window.PromosSection scrapOn={scrapbook} lang={lang}/>
    <window.SignatureSection scrapOn={scrapbook} lang={lang}/>
    <window.ProseSection
      id="menu-about" ix="MENU" label="About the food"
      titleA="Made fresh," titleB="every day."
      lead="A short, honest menu that runs from the first flat white to the last evening plate."
      paras={[
        "Signa is an all-day kitchen in Nusa Dua. Mornings start with specialty coffee, syrniki and big breakfasts; afternoons bring wood-fire pizza on Italian flour and house-made pasta; evenings settle into shared plates and Bali cocktails.",
        "Most dishes have vegetarian versions and the bakery counter runs all day — with everything thirty percent off in the last two hours before close.",
        "Prices are in IDR. The full live menu, with photos and current availability, lives on our ordering page."
      ]}
    />
    <window.FooterSection/>
  </>
));
