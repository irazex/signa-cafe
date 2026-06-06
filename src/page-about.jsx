// page-about.jsx
window.mountSitePage("about", ({ lang, scrapbook }) => (
  <>
    <window.ProseSection
      id="story" ix="PLACE" label="Who we are"
      titleA="Your spot" titleB="in Nusa Dua."
      lead="Signa is the all-day cafe on the corner — the one you come back to."
      paras={[
        "We opened in 2024 with a simple idea: one room that works from the first morning coffee to the last evening plate. A place for laptop mornings and slow lunches, for friends catching up and for anyone who just wants good coffee and a reliable table.",
        "The coffee is specialty-grade and taken seriously. The kitchen is full and runs all day — breakfast that doesn't stop at noon, wood-fire pizza from the afternoon, pasta and shared plates into the evening.",
        "It's a neighbourhood cafe, not a destination restaurant. Come as you are, stay as long as you like."
      ]}
    />
    <window.ExperienceSection scrapOn={scrapbook} lang={lang}/>
    <window.ProseSection
      id="work" ix="PLACE" label="Good to know"
      titleA="Built for" titleB="staying a while."
      paras={[
        "Free fast WiFi and outlets at most tables make Signa a favourite for remote work — especially on weekday mornings. By evening the same room turns into a relaxed spot for dinner and drinks.",
        "Free on-site parking for bikes and cars. Outdoor seating is pet-friendly. A calm, unhurried room — no one will rush you out."
      ]}
    />
    <window.FooterSection/>
  </>
));
