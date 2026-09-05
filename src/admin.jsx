// admin.jsx — Signa content admin
// Reads /content.json (or localStorage override), shows edit forms,
// saves to localStorage + downloads updated content.json for git deploy.

const { useState, useEffect, useMemo, useRef } = React;

const STORAGE_KEY = "signa.admin.content";
// Auth is a PHP session now (lib/auth.php). The old client-side gate that
// lived here carried a sha-256 of the plaintext password in this very file —
// it was never wired up, and it is gone rather than merely unused.

// A 401 from any gated endpoint means the PHP session lapsed. Reloading lands
// on the login form; without this the page would just sit there with an
// unexplained error, which is how the Basic Auth era used to feel.
function bailIfLoggedOut(r) {
  if (r && r.status === 401) { location.reload(); throw new Error("AUTH_REQUIRED"); }
  return r;
}

// ---------- Storage ----------
async function loadContent() {
  // Try localStorage first (in-progress edits)
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) return JSON.parse(local);
  } catch (_) {}
  // Fetch live content.json
  try {
    const r = await fetch("content.json", { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch (_) {}
  return null;
}
function saveLocal(content) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(content)); return true;}
  catch (_) { return false;}
}
function downloadJSON(content) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "content.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url);}, 100);
}
function copyToClipboard(text) {
  navigator.clipboard?.writeText(text);
}

// ---------- Helpers ----------
function ImmRemove(arr, idx) { return arr.filter((_, i) => i !== idx);}
function ImmInsert(arr, idx, item) { return [...arr.slice(0, idx), item, ...arr.slice(idx)];}
function ImmReplace(arr, idx, item) { return arr.map((x, i) => i === idx ? item : x);}
function ImmMove(arr, from, to) {
  if (from === to) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ---------- Field components ----------
function Field({ label, value, onChange, type = "text", placeholder, multiline }) {
  const Cmp = multiline ? "textarea" : "input";
  return (
    <div className="row">
      <label>{label}</label>
      <Cmp
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ---------- Image picker ----------
function ImagePicker({ label, value, onChange, content }) {
  const inputRef = useRef(null);
  const [showGallery, setShowGallery] = useState(false);

  // Build a list of currently used image paths
  const knownPhotos = useMemo(() => {
    const paths = new Set();
    const visit = (o) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) { o.forEach(visit); return;}
      for (const v of Object.values(o)){
        if (typeof v === "string" && /^(assets\/|data:image\/)/.test(v)) paths.add(v);
        else visit(v);
      }
    };
    visit(content || {});
    return [...paths].sort();
  }, [content]);

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => onChange(r.result);
    r.readAsDataURL(file);
  };

  const isDataUrl = typeof value === "string" && value.startsWith("data:");
  const isEmpty = !value;
  const displayName = isEmpty ? "" : (isDataUrl ? "Uploaded image" : value.replace("assets/", ""));

  return (
    <div className="row image-picker">
      <label>{label}</label>
      <div className="image-picker-stage">
        <div className={`image-preview ${isEmpty ? "is-empty" : ""}`} onClick={() => inputRef.current?.click()}>
          {value ? <img src={value} alt="" onError={(e) => { e.target.style.opacity = "0.15"; }}/> :
            <span className="image-preview-empty">+ Click to upload</span>}
          {!isEmpty && <span className="image-overlay">Click to change</span>}
        </div>
        <div className="image-controls">
          <input
            type="file"
            ref={inputRef}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={onPick}
          />
          <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
            {isEmpty ? "Upload file" : "Replace"}
          </button>
          <button type="button" className="btn ghost" onClick={() => setShowGallery(!showGallery)}>
            {showGallery ? "Hide library" : "Pick existing"}
          </button>
          {!isEmpty && <button type="button" className="btn ghost" onClick={() => onChange("")}>Clear</button>}
          <span className="image-path-hint">{displayName}</span>
        </div>
        {showGallery && (
          <div className="image-gallery">
            {knownPhotos.map((p) => (
              <button
                type="button"
                key={p}
                className={`gallery-tile ${value === p ? "active" : ""}`}
                onClick={() => { onChange(p); setShowGallery(false); }}
                title={p}
              >
                <img src={p} alt="" onError={(e) => { e.target.style.opacity = "0.15"; }}/>
              </button>
            ))}
            {knownPhotos.length === 0 && <div className="image-empty-hint">No images in library yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
function CardHeader({ num, onUp, onDown, onDelete, canUp, canDown }) {
  return (
    <div className="head">
      <span className="num">{String(num).padStart(2, "0")}</span>
      <span className="ctrls">
        <button className="icon-btn" disabled={!canUp} onClick={onUp} title="Move up">↑</button>
        <button className="icon-btn" disabled={!canDown} onClick={onDown} title="Move down">↓</button>
        <button className="icon-btn danger" onClick={onDelete} title="Delete">×</button>
      </span>
    </div>
  );
}

// ---------- Tabs ----------

function SiteTab({ content, set }) {
  const s = content.site || {};
  const upd = (k, v) => set({ ...content, site: { ...s, [k]: v }});
  return (
    <div className="card">
      <h3 style={{ fontFamily: "var(--display)", fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em", marginBottom: 4 }}>General</h3>
      <Field label="Tagline" value={s.tagline} onChange={(v) => upd("tagline", v)} />
      <div className="row cols-2">
        <Field label="Phone" value={s.phone} onChange={(v) => upd("phone", v)} />
        <Field label="Manager WhatsApp" value={s.managerWhatsApp} onChange={(v) => upd("managerWhatsApp", v)} />
      </div>
      <div className="row cols-2">
        <Field label="Email" value={s.email} onChange={(v) => upd("email", v)} />
        <Field label="Instagram handle" value={s.instagram} onChange={(v) => upd("instagram", v)} />
      </div>
      <Field label="Address (short)" value={s.address} onChange={(v) => upd("address", v)} />
      <Field label="Address (full, with city + postal code)" value={s.addressFull} onChange={(v) => upd("addressFull", v)} />
      <div className="field-group">
        <h3>Hours &amp; rating</h3>
        <div className="row cols-3">
          <Field label="Open" value={s.hoursOpen} onChange={(v) => upd("hoursOpen", v)} placeholder="08:00" />
          <Field label="Close" value={s.hoursClose} onChange={(v) => upd("hoursClose", v)} placeholder="23:00" />
          <Field label="Last order" value={s.lastOrder} onChange={(v) => upd("lastOrder", v)} placeholder="22:30" />
        </div>
        <div className="row cols-3" style={{ marginTop: 12 }}>
          <Field label="Pizza opens at" value={s.pizzaFrom} onChange={(v) => upd("pizzaFrom", v)} placeholder="14:00" />
          <Field label="Google rating" value={s.rating} onChange={(v) => upd("rating", v)} placeholder="4.7" />
          <Field label="Review count" value={s.reviewCount} onChange={(v) => upd("reviewCount", v)} placeholder="1426" />
        </div>
      </div>
      <div className="field-group">
        <h3>External links</h3>
        <Field label="Order site (Dishi)" value={s.orderUrl} onChange={(v) => upd("orderUrl", v)} type="url" />
        <Field label="Google review link" value={s.googleReviewUrl} onChange={(v) => upd("googleReviewUrl", v)} type="url" />
        <Field label="Suggestion form" value={s.suggestionFormUrl} onChange={(v) => upd("suggestionFormUrl", v)} type="url" />
        <Field label="Instagram URL" value={s.instagramUrl} onChange={(v) => upd("instagramUrl", v)} type="url" />
      </div>
    </div>
  );
}

function MenuTab({ content, set }) {
  const items = content.menu || [];
  const cats = content.menuCategories || ["All"];
  const updItems = (next) => set({ ...content, menu: next });

  const addItem = () => {
    const nextId = Math.max(0, ...items.map(i => i.id || 0)) + 1;
    updItems([...items, { id: nextId, title: "New item", price: "0k", cat: "main" }]);
  };
  const updItem = (i, k, v) => updItems(ImmReplace(items, i, { ...items[i], [k]: v }));
  const removeItem = (i) => updItems(ImmRemove(items, i));
  const moveItem = (from, to) => {
    if (to < 0 || to >= items.length) return;
    updItems(ImmMove(items, from, to));
  };

  return (
    <div>
      <div className="card">
        <h3 style={{ fontFamily: "var(--display)", fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em", marginBottom: 6 }}>Categories</h3>
        <Field
          label="Categories (comma-separated)"
          value={cats.join(", ")}
          onChange={(v) => set({ ...content, menuCategories: v.split(",").map(x => x.trim()).filter(Boolean) })}
        />
      </div>

      {items.map((m, i) => (
        <div key={m.id} className="card">
          <CardHeader num={i + 1}
            onUp={() => moveItem(i, i - 1)} onDown={() => moveItem(i, i + 1)}
            onDelete={() => { if (confirm("Delete this menu item?")) removeItem(i); }}
            canUp={i > 0} canDown={i < items.length - 1}
          />
          <Field label="Title" value={m.title} onChange={(v) => updItem(i, "title", v)} />
          <div className="row cols-3">
            <Field label="Price" value={m.price} onChange={(v) => updItem(i, "price", v)} placeholder="93k" />
            <Field label="Category" value={m.cat} onChange={(v) => updItem(i, "cat", v)} placeholder="breakfast" />
            <Field label="Badge (optional)" value={m.badge} onChange={(v) => updItem(i, "badge", v)} placeholder="★ Popular" />
          </div>
          <ImagePicker label="Image" value={m.img} onChange={(v) => updItem(i, "img", v)} content={content} />
          <div className="row cols-2">
            <div className="row">
              <label>Accent (red card)</label>
              <select value={m.accent ? "yes" : "no"} onChange={(e) => updItem(i, "accent", e.target.value === "yes")}>
                <option value="no">No</option>
                <option value="yes">Yes — red accent</option>
              </select>
            </div>
            <Field label="Tags (comma)" value={(m.tags || []).join(", ")} onChange={(v) => updItem(i, "tags", v.split(",").map(x => x.trim()).filter(Boolean))} placeholder="veg, kids" />
          </div>
        </div>
      ))}
      <button className="add-card" onClick={addItem}>+ Add menu item</button>
    </div>
  );
}

function PromosTab({ content, set }) {
  const items = content.promos || [];
  const upd = (next) => set({ ...content, promos: next });
  const updItem = (i, k, v) => upd(ImmReplace(items, i, { ...items[i], [k]: v }));
  const addItem = () => upd([...items, { tag: "TAG", title: "New promo", body: "Description", style: "default" }]);
  const move = (from, to) => { if (to < 0 || to >= items.length) return; upd(ImmMove(items, from, to)); };
  return (
    <div>
      {items.map((p, i) => (
        <div key={i} className="card">
          <CardHeader num={i + 1}
            onUp={() => move(i, i - 1)} onDown={() => move(i, i + 1)}
            onDelete={() => { if (confirm("Delete this promo?")) upd(ImmRemove(items, i)); }}
            canUp={i > 0} canDown={i < items.length - 1}
          />
          <Field label="Tag (mono label)" value={p.tag} onChange={(v) => updItem(i, "tag", v)} placeholder="EVERY DAY · 20:00–22:00" />
          <Field label="Title" value={p.title} onChange={(v) => updItem(i, "title", v)} placeholder="Bakery −30%" />
          <Field label="Body" value={p.body} onChange={(v) => updItem(i, "body", v)} multiline />
          <div className="row">
            <label>Visual style</label>
            <select value={p.style || "default"} onChange={(e) => updItem(i, "style", e.target.value)}>
              <option value="default">Default (paper)</option>
              <option value="primary">Primary (red)</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      ))}
      <button className="add-card" onClick={addItem}>+ Add promo</button>
    </div>
  );
}

function FAQTab({ content, set }) {
  const items = content.faq || [];
  const upd = (next) => set({ ...content, faq: next });
  const updItem = (i, k, v) => upd(ImmReplace(items, i, { ...items[i], [k]: v }));
  const move = (from, to) => { if (to < 0 || to >= items.length) return; upd(ImmMove(items, from, to)); };
  return (
    <div>
      {items.map((f, i) => (
        <div key={i} className="card">
          <CardHeader num={i + 1}
            onUp={() => move(i, i - 1)} onDown={() => move(i, i + 1)}
            onDelete={() => { if (confirm("Delete this FAQ?")) upd(ImmRemove(items, i)); }}
            canUp={i > 0} canDown={i < items.length - 1}
          />
          <Field label="Question" value={f.q} onChange={(v) => updItem(i, "q", v)} />
          <Field label="Answer" value={f.a} onChange={(v) => updItem(i, "a", v)} multiline />
        </div>
      ))}
      <button className="add-card" onClick={() => upd([...items, { q: "New question?", a: "Answer goes here." }])}>+ Add FAQ</button>
    </div>
  );
}

function SignatureTab({ content, set }) {
  const items = content.signatureDishes || [];
  const upd = (next) => set({ ...content, signatureDishes: next });
  const updItem = (i, k, v) => upd(ImmReplace(items, i, { ...items[i], [k]: v }));
  const move = (from, to) => { if (to < 0 || to >= items.length) return; upd(ImmMove(items, from, to)); };
  const addItem = () => {
    const nextN = Math.max(0, ...items.map(i => i.n || 0)) + 1;
    upd([...items, { n: nextN, title: "New\nDish", meta: "Category · price", img: "assets/photo-x.jpg" }]);
  };
  return (
    <div>
      <div className="note">
        <b>Note:</b> Titles may include line breaks. Use a literal newline in the textarea to split the title into two lines on screen.
      </div>
      {items.map((s, i) => (
        <div key={i} className="card">
          <CardHeader num={i + 1}
            onUp={() => move(i, i - 1)} onDown={() => move(i, i + 1)}
            onDelete={() => { if (confirm("Delete this signature?")) upd(ImmRemove(items, i)); }}
            canUp={i > 0} canDown={i < items.length - 1}
          />
          <Field label="Title (use newline to break)" value={s.title} onChange={(v) => updItem(i, "title", v)} multiline />
          <Field label="Meta" value={s.meta} onChange={(v) => updItem(i, "meta", v)} placeholder="Brunch · 75k" />
          <ImagePicker label="Image" value={s.img} onChange={(v) => updItem(i, "img", v)} content={content} />
        </div>
      ))}
      <button className="add-card" onClick={addItem}>+ Add signature dish</button>
    </div>
  );
}

function PhotosTab({ content, set }) {
  // List all assets referenced anywhere
  const used = useMemo(() => {
    const paths = new Set();
    const visit = (obj) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) { obj.forEach(visit); return; }
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" && v.startsWith("assets/")) paths.add(v);
        else visit(v);
      }
    };
    visit(content);
    return [...paths].sort();
  }, [content]);

  return (
    <div>
      <div className="note">
        <b>How photos work:</b> photo files live in <code>assets/</code> folder on the server.
        To replace a photo, upload a new file with the <b>same filename</b> to <code>assets/</code> (via FTP, Git, or your host's dashboard).
        To add a new photo, upload it with a new filename, then reference it in a menu item or signature card (path like <code>assets/my-new-photo.jpg</code>).
        Recommended size: at least 800×1200px, JPG/PNG.
      </div>

      <h3 style={{ fontFamily: "var(--display)", fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em", marginBottom: 14 }}>
        Currently referenced ({used.length})
      </h3>
      <div className="photo-grid">
        {used.map((p) => (
          <div key={p} className="photo-tile">
            <img src={p} alt={p} onError={(e) => { e.target.style.opacity = "0.2"; }}/>
            <span className="name">{p.replace("assets/", "")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TRANSLATE via OpenAI GPT
// ============================================================
// Adapted from IJEN SPA's translation_job.py — same idea: brand-aware,
// natural-tone prompt + JSON mode + sanity check (skip echo-translations).
// API: gpt-4o-mini via Chat Completions, called directly from browser.

const OPENAI_KEY_STORAGE = "signa.openai.key";
const LANG_NAMES = { ru: "Russian", id: "Indonesian (Bahasa Indonesia)" };

const TRANSLATION_SYSTEM_PROMPT = `You are translating short customer-facing copy for SIGNA CAFE — a family-run urban cafe in Nusa Dua, Bali. Translate the JSON below from English into {lang_name}.

Tone: friendly, conversational, modern. Think how a young server would describe the menu to a friend, not a corporate menu translator. Avoid stiff, formal, or literal phrasing. The result should sound NATURAL to a native speaker — not like a machine translation.

Rules:
- International dish names (Pizza Margarita, Caesar, Tiramisu, Cappuccino, Poke Bowl, Pasta) — use the natural target-language form (e.g. RU "Маргарита", "Цезарь")
- Cultural / proper-noun dishes (Syrniki, Bali Cocktail, Big Breakfast) — keep recognizable; transliterate if it reads more naturally
- Brand names (SIGNA, Eat. Meet. Create., Signa Cafe) — NEVER translate
- Prices like "93k", "145k" — keep as-is (k = thousand IDR, locals understand)
- Special chars (★ · → ↗ ↑ ↓ emoji line breaks \\n) — preserve EXACTLY
- Time phrases ("from 14:00", "after 20:00") — translate the word, keep the time number
- Badges with star ("★ Popular", "★ Chef's") — translate the word, keep the ★
- "−30%" or "-30%" — keep the symbol AS IS
- Keep length similar to source — short stays short
- For RU: avoid the kind of stiff, over-formal translations you'd see in school textbooks. Use the lively informal Russian common in modern Moscow/SPb cafes.
- For ID: use everyday Bahasa Indonesia spoken in Bali F&B venues — NOT formal Bahasa Baku. Loanwords (cafe, breakfast, brunch) often stay in English when locals would also keep them.

Return ONLY a JSON object: {"translations": [{"id": <original_id>, "text": "<translation>"}, ...]}
No commentary, no markdown, no code fence.`;

// Extract every translatable field across the content tree.
// Returns [{ id, path, text }] — id is a unique string used for round-tripping.
function extractTranslatableFields(content, targetLang) {
  const out = [];
  let counter = 0;
  const push = (path, text) => {
    if (typeof text !== "string" || !text.trim()) return;
    // Skip if already translated for this lang (so re-runs are cheap)
    // (caller handles per-lang skip; this is a flat extract)
    out.push({ id: `f${counter++}`, path, text });
  };
  // menu
  (content.menu || []).forEach((m, i) => {
    push(`menu[${i}].title`, m.title);
    push(`menu[${i}].badge`, m.badge);
  });
  // promos
  (content.promos || []).forEach((p, i) => {
    push(`promos[${i}].tag`, p.tag);
    push(`promos[${i}].title`, p.title);
    push(`promos[${i}].body`, p.body);
  });
  // faq
  (content.faq || []).forEach((f, i) => {
    push(`faq[${i}].q`, f.q);
    push(`faq[${i}].a`, f.a);
  });
  // signature
  (content.signatureDishes || []).forEach((s, i) => {
    push(`signatureDishes[${i}].title`, s.title);
    push(`signatureDishes[${i}].meta`, s.meta);
  });
  // experience tiles (lbl) — if content.json carries them
  (content.experienceTiles || []).forEach((t, i) => {
    push(`experienceTiles[${i}].lbl`, t.lbl);
  });
  // menu categories (string array → translate each)
  (content.menuCategories || []).forEach((c, i) => {
    push(`menuCategories[${i}]`, c);
  });
  return out;
}

// Set a value at a "path" like "menu[3].title_ru"
function setAtPath(content, path, value) {
  // path like "menu[2].title" or "menuCategories[1]"
  const m = path.match(/^([a-zA-Z]+)\[(\d+)\](?:\.(\w+))?$/);
  if (!m) return false;
  const [, section, idx, field] = m;
  const arr = content[section];
  if (!Array.isArray(arr)) return false;
  const i = parseInt(idx, 10);
  if (!arr[i] && field) arr[i] = {};
  if (field) arr[i][field] = value;
  else arr[i] = value;
  return true;
}

// Cache the API key once per session (fetched from /key.php behind Basic Auth)
let _cachedApiKey = null;
async function getApiKey() {
  if (_cachedApiKey) return _cachedApiKey;
  const r = bailIfLoggedOut(await fetch("key.php", { credentials: "same-origin" }));
  if (!r.ok) {
    throw new Error(`Cannot load API key from server (${r.status}). Make sure /.openai_key exists in webroot.`);
  }
  const data = await r.json();
  if (data.error || !data.key) {
    throw new Error(`Server returned: ${JSON.stringify(data)}`);
  }
  _cachedApiKey = data.key;
  return _cachedApiKey;
}

async function gptTranslateBatch(items, targetLang) {
  // OpenAI API geo-blocks the hosting server (RU). So we call api.openai.com
  // DIRECTLY from the browser — geo is the user's IP, which is fine.
  // The key itself is loaded once from /key.php (behind Basic Auth, no leak in JS bundle).
  const apiKey = await getApiKey();
  const prompt = TRANSLATION_SYSTEM_PROMPT.replace("{lang_name}", LANG_NAMES[targetLang] || targetLang);
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        { role: "user",   content: JSON.stringify({ items: items.map(({id, text}) => ({id, text})) }) },
      ],
    }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => "(no body)");
    throw new Error(`OpenAI ${r.status}: ${errText.slice(0, 300)}`);
  }
  const data = await r.json();
  let parsed;
  try { parsed = JSON.parse(data.choices[0].message.content); }
  catch (e) { throw new Error("OpenAI returned non-JSON: " + data.choices[0].message.content.slice(0, 200)); }
  return parsed.translations || [];
}

async function translateContentViaGPT(content, targetLangs, _unusedApiKey, onProgress) {
  const out = JSON.parse(JSON.stringify(content)); // deep copy so caller controls when to set
  const allFields = extractTranslatableFields(content);
  if (!allFields.length) {
    onProgress?.({ done: 0, total: 0, msg: "Nothing translatable found in content." });
    return out;
  }

  const BATCH = 8;
  let totalSteps = 0;
  for (const lang of targetLangs) {
    // Skip fields that already have a translation for this lang
    const pending = allFields.filter(f => {
      const m = f.path.match(/^([a-zA-Z]+)\[(\d+)\](?:\.(\w+))?$/);
      if (!m) return false;
      const [, section, idx, field] = m;
      if (!field) {
        // string-array (e.g. menuCategories[1]) — sibling field "_translations" map
        const arr = out[section + "_" + lang] || [];
        return !arr[parseInt(idx, 10)];
      }
      return !out[section]?.[parseInt(idx, 10)]?.[field + "_" + lang];
    });
    totalSteps += Math.ceil(pending.length / BATCH);
  }
  if (totalSteps === 0) {
    onProgress?.({ done: 0, total: 0, msg: "Everything is already translated. Nothing to do." });
    return out;
  }

  let step = 0;
  for (const lang of targetLangs) {
    const pending = allFields.filter(f => {
      const m = f.path.match(/^([a-zA-Z]+)\[(\d+)\](?:\.(\w+))?$/);
      if (!m) return false;
      const [, section, idx, field] = m;
      if (!field) {
        const arr = out[section + "_" + lang] || [];
        return !arr[parseInt(idx, 10)];
      }
      return !out[section]?.[parseInt(idx, 10)]?.[field + "_" + lang];
    });
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      step++;
      onProgress?.({ done: step, total: totalSteps, msg: `Translating to ${LANG_NAMES[lang]} (${i + 1}-${Math.min(i+BATCH, pending.length)} of ${pending.length})…` });
      let results;
      try {
        results = await gptTranslateBatch(batch, lang);
      } catch (e) {
        onProgress?.({ done: step, total: totalSteps, msg: `❌ Error: ${e.message}` });
        throw e;
      }
      // Merge back, sanity-check (skip echo translations)
      for (const r of results) {
        const src = batch.find(b => b.id === r.id);
        if (!src) continue;
        const translated = String(r.text || "").trim();
        if (!translated || translated === src.text) continue;  // skip echo
        const m = src.path.match(/^([a-zA-Z]+)\[(\d+)\](?:\.(\w+))?$/);
        if (!m) continue;
        const [, section, idx, field] = m;
        const arrIdx = parseInt(idx, 10);
        if (field) {
          // object field — set sibling field_lang
          if (!out[section][arrIdx]) out[section][arrIdx] = {};
          out[section][arrIdx][field + "_" + lang] = translated;
        } else {
          // string array — store on parallel array section_lang
          const k = section + "_" + lang;
          if (!Array.isArray(out[k])) out[k] = [];
          out[k][arrIdx] = translated;
        }
      }
    }
  }
  onProgress?.({ done: totalSteps, total: totalSteps, msg: "✓ Done. Review changes and Save / Export." });
  return out;
}

// ============================================================
// ANALYTICS TAB
// ============================================================
const SECTION_LABELS = {
  0: "Hero", 1: "Brand", 2: "Feedback", 3: "Menu", 4: "Promos",
  5: "Signature", 6: "Experience", 7: "Order", 8: "FAQ",
  9: "Location", 10: "Footer",
};
function pct(n, total) { return total ? Math.round(n * 100 / total) : 0; }
function fmtCount(n) { return n.toLocaleString(); }

function StatBar({ label, value, max, suffix = "", fmt = fmtCount }) {
  const w = max ? Math.max(2, Math.round(value * 100 / max)) : 0;
  return (
    <div className="stat-bar">
      <div className="stat-bar-label">{label}</div>
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: w + "%" }}/>
      </div>
      <div className="stat-bar-value">{fmt(value)}{suffix}</div>
    </div>
  );
}

function AnalyticsTab() {
  const [days, setDays] = useState(7);
  const [bots, setBots] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetch(`analytics.php?days=${days}&bots=${bots ? 1 : 0}&t=${Date.now()}`, {
      credentials: "same-origin",
    })
      .then(bailIfLoggedOut)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(j => { setData(j); setLoading(false); })
      .catch(e => { setErr(String(e)); setLoading(false); });
  };
  useEffect(load, [days, bots]);

  if (loading && !data) return <div className="note">Loading analytics…</div>;
  if (err) return <div className="note" style={{ background: "rgba(235,51,0,.08)", borderColor: "rgba(235,51,0,.3)" }}>
    ❌ Could not load: {err}
    <br/><small>If this is the first time you open Analytics, /analytics/ folder might not exist yet — it's auto-created on the first tracked event. Open the public site once to generate the first events.</small>
  </div>;
  if (!data) return null;

  const dailyMax = Math.max(1, ...Object.values(data.by_day));
  const clickMax = Math.max(1, ...Object.values(data.top_clicks));
  const langTotal = Object.values(data.lang_split).reduce((a,b) => a+b, 0);
  const devTotal = Object.values(data.devices).reduce((a,b) => a+b, 0);
  const refTotal = Object.values(data.top_referrers).reduce((a,b) => a+b, 0);
  const funnelEntries = Object.entries(data.scroll_funnel).map(([k,v]) => [parseInt(k), v]).sort((a,b) => a[0]-b[0]);
  const funnelTop = funnelEntries.length ? funnelEntries[0][1] : 1;

  return (
    <div className="analytics-tab">
      {/* Controls */}
      <div className="card" style={{ flexDirection: "row", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", marginBottom: 4 }}>Period</label>
          <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
            <option value={1}>Last 24 h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16 }}>
          <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)}/>
          Include bots
        </label>
        <span style={{ flex: 1 }}/>
        <button className="btn" onClick={load}>↻ Refresh</button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
        <div className="kpi-card">
          <div className="kpi-label">Page views</div>
          <div className="kpi-value">{fmtCount(data.page_views)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Unique sessions</div>
          <div className="kpi-value">{fmtCount(data.sessions_human)}</div>
          <div className="kpi-sub">{data.sessions_bot} bots filtered</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Mobile share</div>
          <div className="kpi-value">{pct(data.devices.mobile, devTotal)}%</div>
          <div className="kpi-sub">{data.devices.mobile} / {devTotal}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total events</div>
          <div className="kpi-value">{fmtCount(data.total_events)}</div>
        </div>
      </div>

      {/* Daily timeseries */}
      <h3 className="analytics-h3">Page views by day</h3>
      <div className="card">
        {Object.keys(data.by_day).length === 0
          ? <div style={{ color: "rgba(0,0,0,.5)" }}>No data yet.</div>
          : Object.entries(data.by_day).map(([day, count]) => (
            <StatBar key={day} label={day} value={count} max={dailyMax}/>
          ))
        }
      </div>

      {/* Scroll funnel */}
      <h3 className="analytics-h3">Scroll depth — how many sessions reached each section</h3>
      <div className="card">
        {funnelEntries.length === 0
          ? <div style={{ color: "rgba(0,0,0,.5)" }}>No scroll data yet.</div>
          : funnelEntries.map(([idx, count]) => (
            <StatBar
              key={idx}
              label={`${String(idx).padStart(2,"0")} ${SECTION_LABELS[idx] || "section " + idx}`}
              value={count}
              max={funnelTop}
              suffix={` (${pct(count, funnelTop)}%)`}
            />
          ))
        }
      </div>

      {/* Top clicks */}
      <h3 className="analytics-h3">Most-clicked actions</h3>
      <div className="card">
        {Object.keys(data.top_clicks).length === 0
          ? <div style={{ color: "rgba(0,0,0,.5)" }}>No clicks yet.</div>
          : Object.entries(data.top_clicks).map(([target, count]) => (
            <StatBar key={target} label={target} value={count} max={clickMax}/>
          ))
        }
      </div>

      {/* Languages */}
      <h3 className="analytics-h3">Languages</h3>
      <div className="card">
        {Object.entries(data.lang_split).map(([lang, count]) => (
          <StatBar key={lang} label={lang.toUpperCase()} value={count} max={Math.max(1, ...Object.values(data.lang_split))} suffix={` (${pct(count, langTotal)}%)`}/>
        ))}
      </div>

      {/* Devices */}
      <h3 className="analytics-h3">Device</h3>
      <div className="card">
        {Object.entries(data.devices).map(([k, v]) => (
          <StatBar key={k} label={k} value={v} max={Math.max(1, ...Object.values(data.devices))} suffix={` (${pct(v, devTotal)}%)`}/>
        ))}
      </div>

      {/* Top referrers */}
      <h3 className="analytics-h3">Top referrers</h3>
      <div className="card">
        {Object.keys(data.top_referrers).length === 0
          ? <div style={{ color: "rgba(0,0,0,.5)" }}>Direct visits only.</div>
          : Object.entries(data.top_referrers).map(([host, count]) => (
            <StatBar key={host} label={host} value={count} max={Math.max(1, ...Object.values(data.top_referrers))}/>
          ))
        }
      </div>

      {/* Timezones */}
      {Object.keys(data.top_timezones || {}).length > 0 && (
        <>
          <h3 className="analytics-h3">Top timezones</h3>
          <div className="card">
            {Object.entries(data.top_timezones).map(([tz, count]) => (
              <StatBar key={tz} label={tz} value={count} max={Math.max(1, ...Object.values(data.top_timezones))}/>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 24, fontFamily: "var(--mono)", fontSize: 10, color: "rgba(0,0,0,.4)" }}>
        Generated {data.generated_at}. Period: last {data.period_days} day{data.period_days > 1 ? "s" : ""}.
        Bots {data.include_bots ? "INCLUDED" : "EXCLUDED"} (filtered by UA: bot/crawl/headless/curl/wget/...)
      </div>
    </div>
  );
}

// ============================================================

// ============================================================
// STORIES TAB — edits data/stories.json (the weekly dish essays)
//
// Separate from content.json on purpose: the essays are long, and every page
// on the site fetches content.json. Stories are read only by story.php /
// stories.php, which render them server-side so AI crawlers see the text.
// This tab therefore keeps its own load / save / export cycle.
// ============================================================
const STORIES_KEY = "signa.admin.stories";
const STORIES_URL = "data/stories.json";

async function loadStories() {
  try {
    const local = localStorage.getItem(STORIES_KEY);
    if (local) return JSON.parse(local);
  } catch (_) {}
  try {
    const r = await fetch(STORIES_URL, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch (_) {}
  return { version: new Date().toISOString().slice(0, 10).replace(/-/g, ""), posts: [] };
}

function downloadStories(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "stories.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 70);
}

// blocks[] <-> plain text. One heading per block, paragraphs split on blank lines.
const blocksToText = (blocks) =>
  (blocks || []).map((b) => `## ${b.h || ""}\n\n${(b.p || []).join("\n\n")}`).join("\n\n");

const textToBlocks = (text) => {
  const out = [];
  let cur = null;
  String(text).split(/\n\s*\n/).forEach((chunk) => {
    const t = chunk.trim();
    if (!t) return;
    if (t.startsWith("##")) { cur = { h: t.replace(/^#+\s*/, ""), p: [] }; out.push(cur); }
    else { if (!cur) { cur = { h: "", p: [] }; out.push(cur); } cur.p.push(t); }
  });
  return out;
};

function StoriesTab() {
  const [data, setData] = useState(null);
  const [lang, setLang] = useState("en");
  const [open, setOpen] = useState(0);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { loadStories().then(setData); }, []);
  if (!data) return <div className="note">Loading data/stories.json…</div>;

  const posts = data.posts || [];
  const set = (next) => { setData(next); setDirty(true); };
  const updPosts = (next) => set({ ...data, posts: next, version: new Date().toISOString().slice(0, 10).replace(/-/g, "") + "a" });
  const updPost = (i, patch) => updPosts(ImmReplace(posts, i, { ...posts[i], ...patch }));
  const updLang = (i, k, v) =>
    updPost(i, { [lang]: { ...(posts[i][lang] || {}), [k]: v } });

  const addPost = () => {
    const today = new Date().toISOString().slice(0, 10);
    updPosts([{
      slug: "new-story-" + today,
      date: today,
      cover: "assets/photo-breakfast.webp",
      dish: { name: "", price: "", menuUrl: "https://signa.dishi.rest/" },
      tags: ["nusa dua"],
      en: { title: "New story", seoTitle: "", description: "", keywords: "", category: "Food",
            coverAlt: "", lead: "", blocks: [{ h: "Heading", p: ["First paragraph."] }], facts: [], faq: [] },
      ru: { title: "", seoTitle: "", description: "", keywords: "", category: "",
            coverAlt: "", lead: "", blocks: [], facts: [], faq: [] },
    }, ...posts]);
    setOpen(0);
  };

  const save = () => {
    try { localStorage.setItem(STORIES_KEY, JSON.stringify(data)); } catch (_) {}
    setDirty(false);
    alert("✓ Saved in THIS browser only.\n\nTo publish:\n1. Click 'Export stories.json'\n2. Upload it to /data/stories.json on the server (replace the existing file)\n\nThe /stories pages are rendered by PHP straight from that file — no rebuild needed. New posts also appear in sitemap.xml, feed.xml and llms.txt automatically.");
  };
  const reset = async () => {
    if (!confirm("Discard local edits and reload data/stories.json from the server?")) return;
    localStorage.removeItem(STORIES_KEY);
    const r = await fetch(STORIES_URL, { cache: "no-store" });
    if (r.ok) { setData(await r.json()); setDirty(false); }
  };

  return (
    <div>
      <div className="actions-bar">
        <button className="btn primary" onClick={save} disabled={!dirty}>Save</button>
        <button className="btn" onClick={() => downloadStories(data)}>Export stories.json</button>
        <button className="btn ghost" onClick={reset}>Reset</button>
        <span style={{ flex: 1 }}/>
        <span className={`status ${dirty ? "dirty" : ""}`}>{dirty ? "● Unsaved changes" : "● Saved"}</span>
      </div>

      <div className="note">
        <b>How this works.</b> Posts live in <code>/data/stories.json</code>, not content.json.
        The pages at <code>/stories</code> are rendered on the server by PHP, so the full text is in
        the raw HTML — that is what makes them readable by ChatGPT, Claude, Perplexity and other
        crawlers that do not run JavaScript. Publish by exporting this file and uploading it to
        <code>/data/stories.json</code>. Sitemap, RSS and llms.txt update themselves.
        <br/><br/>
        <b>Writing tips for SEO:</b> mention Nusa Dua, Benoa, Ungasan, Jimbaran or the Bukit
        naturally in the text; keep the description under 160 characters; give every post a real
        FAQ — those become rich snippets in Google.
      </div>

      <div className="row">
        <label>Editing language</label>
        <div className="lang-tabs">
          {["en", "ru"].map((l) => (
            <button key={l} className={`btn ${lang === l ? "primary" : "ghost"}`} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <button className="add-card" onClick={addPost}>+ New weekly post</button>

      {posts.map((p, i) => {
        const b = p[lang] || {};
        const isOpen = open === i;
        return (
          <div key={i} className="card">
            <div className="head">
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1, cursor: "pointer" }} onClick={() => setOpen(isOpen ? -1 : i)}>
                <b>{b.title || p[ "en" ]?.title || p.slug}</b>
                <span style={{ opacity: .5 }}> · {p.date}{!b.title ? "  (no " + lang.toUpperCase() + " version)" : ""}</span>
              </span>
              <span className="ctrls">
                <a className="icon-btn" href={`/stories${lang === "ru" ? "/ru" : ""}/${p.slug}`} target="_blank" rel="noreferrer" title="Preview">↗</a>
                <button className="icon-btn" disabled={i === 0} onClick={() => updPosts(ImmMove(posts, i, i - 1))} title="Move up">↑</button>
                <button className="icon-btn" disabled={i === posts.length - 1} onClick={() => updPosts(ImmMove(posts, i, i + 1))} title="Move down">↓</button>
                <button className="icon-btn danger" onClick={() => { if (confirm("Delete this post?")) updPosts(ImmRemove(posts, i)); }} title="Delete">×</button>
                <button className="icon-btn" onClick={() => setOpen(isOpen ? -1 : i)}>{isOpen ? "–" : "+"}</button>
              </span>
            </div>

            {isOpen && (
              <>
                <Field label="URL slug (a-z, digits, dashes)" value={p.slug}
                  onChange={(v) => updPost(i, { slug: slugify(v) })} placeholder="syrniki-cottage-cheese-pancakes" />
                <Field label="Publish date (YYYY-MM-DD — future dates stay hidden)" value={p.date}
                  onChange={(v) => updPost(i, { date: v })} placeholder="2026-09-04" />
                <Field label="Tags (comma separated)" value={(p.tags || []).join(", ")}
                  onChange={(v) => updPost(i, { tags: v.split(",").map((t) => t.trim()).filter(Boolean) })} />
                <Field label="Dish name" value={p.dish?.name}
                  onChange={(v) => updPost(i, { dish: { ...(p.dish || {}), name: v } })} />
                <Field label="Dish price (shown under the photo)" value={p.dish?.price}
                  onChange={(v) => updPost(i, { dish: { ...(p.dish || {}), price: v } })} placeholder="93,000 IDR" />
                <ImagePicker label="Cover photo" value={p.cover}
                  onChange={(v) => updPost(i, { cover: v })} content={{ posts }} />

                <div className="note" style={{ marginTop: 18 }}>
                  <b>{lang.toUpperCase()} text</b> — everything below belongs to this language only.
                </div>

                <Field label="Headline (shown on the page)" value={b.title} onChange={(v) => updLang(i, "title", v)} multiline />
                <Field label="SEO title (browser tab & Google result — leave empty to reuse the headline)"
                  value={b.seoTitle} onChange={(v) => updLang(i, "seoTitle", v)} multiline />
                <Field label="Meta description (max ~160 chars — this is the Google snippet)"
                  value={b.description} onChange={(v) => updLang(i, "description", v)} multiline />
                <Field label="Keywords (comma separated — include Nusa Dua / Ungasan / Bukit etc.)"
                  value={b.keywords} onChange={(v) => updLang(i, "keywords", v)} multiline />
                <Field label="Category label" value={b.category} onChange={(v) => updLang(i, "category", v)} placeholder="Breakfast" />
                <Field label="Photo alt text (describe the dish — read by image search and screen readers)"
                  value={b.coverAlt} onChange={(v) => updLang(i, "coverAlt", v)} multiline />
                <Field label="Lead (the bold opening line)" value={b.lead} onChange={(v) => updLang(i, "lead", v)} multiline />

                <div className="row">
                  <label>Body — start a section with <code>## Heading</code>, separate paragraphs with a blank line</label>
                  <textarea
                    rows={18}
                    value={blocksToText(b.blocks)}
                    onChange={(e) => updLang(i, "blocks", textToBlocks(e.target.value))}
                  />
                </div>

                <div className="row">
                  <label>Fact box — one <code>Label | Value</code> per line</label>
                  <textarea
                    rows={6}
                    value={(b.facts || []).map((f) => `${f[0]} | ${f[1]}`).join("\n")}
                    onChange={(e) => updLang(i, "facts",
                      e.target.value.split("\n").map((l) => l.split("|").map((x) => x.trim()))
                        .filter((r) => r[0]))}
                  />
                </div>

                <div className="row">
                  <label>FAQ — <code>Question ? Answer</code>, one per line, split on the first <code>|</code></label>
                  <textarea
                    rows={6}
                    value={(b.faq || []).map((f) => `${f.q} | ${f.a}`).join("\n")}
                    onChange={(e) => updLang(i, "faq",
                      e.target.value.split("\n").map((l) => {
                        const k = l.indexOf("|");
                        return k < 0 ? null : { q: l.slice(0, k).trim(), a: l.slice(k + 1).trim() };
                      }).filter(Boolean))}
                  />
                </div>
              </>
            )}
          </div>
        );
      })}

      {posts.length === 0 && <div className="note">No posts yet. Click “+ New weekly post”.</div>}
    </div>
  );
}

// ============================================================
// COSTS TAB — what the weekly stories cost to generate
//
// tools/story-gen.mjs records every model call into data/story-costs.json:
// tokens, seconds, which post, which stage. Tokens are ground truth from the
// API; money is tokens x a rate card that somebody has to keep current, so the
// rate card lives in data/model-pricing.json and is editable right here.
//
// This tab recomputes cost from the stored tokens using whatever rate card is
// loaded, rather than trusting the `usd` frozen into the ledger at generation
// time. Change a rate, every number below moves with it.
// ============================================================
const COSTS_URL   = "admin.php?asset=costs";
const PRICING_URL = "admin.php?asset=pricing";
const PRICING_KEY = "signa.admin.pricing";
const BILLING_KEY = "signa.admin.billing";

// Mirrors FALLBACK in tools/cost-ledger.mjs. Keep the two in step.
const PRICING_FALLBACK = {
  updated: null,
  note: "USD per 1M tokens. Confirm against platform.openai.com/docs/pricing before billing.",
  models: {
    "gpt-5.5-pro": { input: 15, cachedInput: 1.5, output: 120 },
    "gpt-5.5":     { input: 1.25, cachedInput: 0.125, output: 10 },
  },
};

// Same formula as costOf() in tools/cost-ledger.mjs.
function costOfRun(run, rates) {
  const r = rates.models && rates.models[run.model];
  if (!r) return null;
  const t = run.tokens || {};
  const cached = t.cachedInput || 0;
  const fresh = Math.max(0, (t.input || 0) - cached);
  const cachedRate = r.cachedInput == null ? r.input : r.cachedInput;
  return (fresh * r.input + cached * cachedRate + (t.output || 0) * r.output) / 1e6;
}

const usd = (n) => "$" + (n || 0).toFixed(2);
const usd4 = (n) => "$" + (n || 0).toFixed(4);

function downloadFile(name, text, type) {
  const blob = new Blob([text], { type: type || "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function CostsTab() {
  const [ledger, setLedger]   = useState(null);
  const [rates, setRates]     = useState(null);
  const [err, setErr]         = useState(null);
  const [ratesDirty, setRatesDirty] = useState(false);
  const [openPost, setOpenPost] = useState(null);
  const [billing, setBilling] = useState(() => {
    try { return JSON.parse(localStorage.getItem(BILLING_KEY)) || {}; } catch (_) { return {}; }
  });

  const perPost = Number(billing.perPost != null ? billing.perPost : 25);
  const client  = billing.client || "";

  const setBill = (patch) => {
    const next = { ...billing, ...patch };
    setBilling(next);
    try { localStorage.setItem(BILLING_KEY, JSON.stringify(next)); } catch (_) {}
  };

  useEffect(() => {
    fetch(COSTS_URL + "&t=" + Date.now(), { cache: "no-store" })
      .then(bailIfLoggedOut)
      .then((r) => (r.ok ? r.json() : { runs: [] }))
      .then(setLedger)
      .catch((e) => { setErr(String(e)); setLedger({ runs: [] }); });

    let local = null;
    try { local = JSON.parse(localStorage.getItem(PRICING_KEY)); } catch (_) {}
    if (local) { setRates(local); return; }
    fetch(PRICING_URL + "&t=" + Date.now(), { cache: "no-store" })
      .then(bailIfLoggedOut)
      .then((r) => (r.ok ? r.json() : PRICING_FALLBACK))
      .then(setRates)
      .catch(() => setRates(PRICING_FALLBACK));
  }, []);

  if (!ledger || !rates) return <div className="note">Loading data/story-costs.json…</div>;

  const runs = ledger.runs || [];

  const setRate = (model, field, value) => {
    const next = {
      ...rates,
      models: { ...rates.models, [model]: { ...rates.models[model], [field]: Number(value) || 0 } },
    };
    setRates(next);
    setRatesDirty(true);
  };

  const saveRates = () => {
    const next = { ...rates, updated: new Date().toISOString().slice(0, 10) };
    setRates(next);
    setRatesDirty(false);
    try { localStorage.setItem(PRICING_KEY, JSON.stringify(next)); } catch (_) {}
    alert("Rate card saved in THIS browser.\n\nTo make the generator on the VPS use it too:\n1. Click 'Export model-pricing.json'\n2. Upload it to /data/model-pricing.json\n3. On the VPS run: node tools/cost-ledger.mjs --reprice");
  };

  const resetRates = async () => {
    if (!confirm("Discard the local rate card and reload data/model-pricing.json from the server?")) return;
    localStorage.removeItem(PRICING_KEY);
    try {
      const r = await fetch(PRICING_URL + "&t=" + Date.now(), { cache: "no-store" });
      setRates(r.ok ? await r.json() : PRICING_FALLBACK);
    } catch (_) { setRates(PRICING_FALLBACK); }
    setRatesDirty(false);
  };

  // ---- aggregate ------------------------------------------------------
  const byPost = new Map();
  const byMonth = new Map();
  const byModel = new Map();
  let unpriced = 0;

  runs.forEach((run) => {
    const cost = costOfRun(run, rates);
    if (cost == null) unpriced++;
    const c = cost || 0;
    const t = run.tokens || {};

    const key = run.slug || "(no post)";
    const p = byPost.get(key) || {
      slug: key, postDate: run.postDate, calls: 0, input: 0, cached: 0,
      output: 0, reasoning: 0, seconds: 0, usd: 0, runs: [],
    };
    p.calls++;
    p.input += t.input || 0;
    p.cached += t.cachedInput || 0;
    p.output += t.output || 0;
    p.reasoning += t.reasoning || 0;
    p.seconds += run.seconds || 0;
    p.usd += c;
    p.runs.push({ ...run, cost: c });
    byPost.set(key, p);

    const mk = (run.at || "").slice(0, 7) || "unknown";
    const m = byMonth.get(mk) || { month: mk, posts: new Set(), calls: 0, usd: 0, input: 0, output: 0, seconds: 0 };
    m.calls++; m.usd += c; m.input += t.input || 0; m.output += t.output || 0; m.seconds += run.seconds || 0;
    if (run.slug) m.posts.add(run.slug);
    byMonth.set(mk, m);

    const mo = byModel.get(run.model) || { model: run.model, calls: 0, usd: 0, output: 0 };
    mo.calls++; mo.usd += c; mo.output += t.output || 0;
    byModel.set(run.model, mo);
  });

  const posts = [...byPost.values()].sort((a, b) => (a.postDate || "") < (b.postDate || "") ? 1 : -1);
  const months = [...byMonth.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
  const models = [...byModel.values()].sort((a, b) => b.usd - a.usd);

  const totalUsd = posts.reduce((n, p) => n + p.usd, 0);
  const totalMin = posts.reduce((n, p) => n + p.seconds, 0) / 60;
  const postCount = posts.filter((p) => p.slug !== "(no post)").length;
  const avgPost = postCount ? totalUsd / postCount : 0;
  const costMax = Math.max(0.0001, ...posts.map((p) => p.usd));

  const invoice = postCount * perPost;
  const margin = invoice - totalUsd;

  const exportCSV = () => {
    const rows = [["date", "post", "model calls", "input tokens", "output tokens", "minutes", "api cost usd", "billed usd"]];
    posts.forEach((p) => rows.push([
      p.postDate || "", p.slug, p.calls, p.input, p.output,
      (p.seconds / 60).toFixed(1), p.usd.toFixed(4),
      p.slug === "(no post)" ? "0.00" : perPost.toFixed(2),
    ]));
    rows.push([]);
    rows.push(["", "TOTAL", "", "", "", (totalMin).toFixed(1), totalUsd.toFixed(4), invoice.toFixed(2)]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadFile(`signa-stories-costs-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  };

  const STAGES = { write: "draft", "fix-geo": "geo fix", "edit:ru": "editor ru", "edit:id": "editor id", "edit:en": "editor en" };
  const stageLabel = (s) => {
    const [base, flag] = String(s || "").split(/:(?=abandoned$)/);
    const label = STAGES[base] || base.replace("edit:", "editor ");
    return flag ? label + " (abandoned)" : label;
  };

  return (
    <div className="analytics-tab">
      {err && <div className="note">Could not read {COSTS_URL}: {err}</div>}

      {runs.length === 0 && (
        <div className="note">
          <b>The ledger is empty.</b> Nothing has been generated since cost tracking was added,
          or <code>/data/story-costs.json</code> has not been uploaded to the server yet.
          It is written on the machine that runs <code>tools/story-gen.mjs</code> and travels
          with the repo, so upload it alongside <code>stories.json</code>.
        </div>
      )}

      {/* ---- KPI ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div className="kpi-card">
          <div className="kpi-label">API spend</div>
          <div className="kpi-value">{usd(totalUsd)}</div>
          <div className="kpi-sub">{runs.length} model call{runs.length === 1 ? "" : "s"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Posts tracked</div>
          <div className="kpi-value">{postCount}</div>
          <div className="kpi-sub">EN + RU + ID each</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Cost per post</div>
          <div className="kpi-value">{usd(avgPost)}</div>
          <div className="kpi-sub">average, all stages</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Model time</div>
          <div className="kpi-value">{Math.round(totalMin)} min</div>
          <div className="kpi-sub">{postCount ? Math.round(totalMin / postCount) : 0} min per post</div>
        </div>
      </div>

      {unpriced > 0 && (
        <div className="note" style={{ marginTop: 16 }}>
          {unpriced} call{unpriced === 1 ? " uses a model that is" : "s use models that are"} not in the rate
          card below, so {unpriced === 1 ? "it counts" : "they count"} as $0. Add the model to fix the total.
        </div>
      )}
      {!rates.updated && (
        <div className="note" style={{ marginTop: 16, background: "rgba(235,51,0,.06)", borderColor: "rgba(235,51,0,.25)" }}>
          <b>The rate card has never been confirmed.</b> The dollar figures are placeholders built on
          guessed prices. Check them against platform.openai.com/docs/pricing, correct the numbers below
          and press Save - then everything on this page is real money.
        </div>
      )}

      {/* ---- Billing ---- */}
      <h3 className="analytics-h3">Invoice</h3>
      <div className="card">
        <div className="row cols-2">
          <div>
            <label>Billed to</label>
            <input value={client} onChange={(e) => setBill({ client: e.target.value })} placeholder="Signa Cafe"/>
          </div>
          <div>
            <label>Rate per published post, USD</label>
            <input type="number" min="0" step="1" value={perPost}
                   onChange={(e) => setBill({ perPost: Number(e.target.value) })}/>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
          <div className="kpi-card">
            <div className="kpi-label">To invoice</div>
            <div className="kpi-value">{usd(invoice)}</div>
            <div className="kpi-sub">{postCount} x {usd(perPost)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">API cost</div>
            <div className="kpi-value">{usd(totalUsd)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Margin</div>
            <div className="kpi-value" style={{ color: margin < 0 ? "#EB3300" : undefined }}>{usd(margin)}</div>
            <div className="kpi-sub">{invoice ? Math.round(margin * 100 / invoice) : 0}% of the invoice</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "rgba(0,0,0,.55)", marginTop: 12 }}>
          Counted from the ledger, which starts the day cost tracking was switched on. Posts
          written before that are real work with no line here - check the Stories tab for the
          full list before you send the invoice.
        </div>
        <div className="actions-bar" style={{ marginTop: 12 }}>
          <button className="btn" onClick={exportCSV}>Export CSV for the invoice</button>
        </div>
      </div>

      {/* ---- Per post ---- */}
      <h3 className="analytics-h3">Cost per post</h3>
      <div className="card">
        {posts.length === 0
          ? <div style={{ color: "rgba(0,0,0,.5)" }}>Nothing recorded yet.</div>
          : posts.map((p) => (
            <div key={p.slug} style={{ marginBottom: 4 }}>
              <div onClick={() => setOpenPost(openPost === p.slug ? null : p.slug)} style={{ cursor: "pointer" }}>
                <StatBar
                  label={`${p.postDate || "-"}  ${p.slug}`}
                  value={p.usd}
                  max={costMax}
                  fmt={usd}
                />
              </div>
              {openPost === p.slug && (
                <div style={{ padding: "8px 0 14px 12px", borderLeft: "2px solid rgba(0,0,0,.12)", marginLeft: 4, fontSize: 13 }}>
                  <div style={{ color: "rgba(0,0,0,.55)", marginBottom: 6 }}>
                    {fmtCount(p.input)} in ({fmtCount(p.cached)} cached) · {fmtCount(p.output)} out
                    ({fmtCount(p.reasoning)} reasoning) · {Math.round(p.seconds / 60)} min
                  </div>
                  {p.runs.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "2px 0", color: "rgba(0,0,0,.7)" }}>
                      <span style={{ minWidth: 90 }}>{stageLabel(r.stage)}</span>
                      <span style={{ minWidth: 110, fontFamily: "monospace" }}>{r.model}</span>
                      <span style={{ minWidth: 130 }}>{fmtCount(r.tokens.input)} in / {fmtCount(r.tokens.output)} out</span>
                      <span style={{ minWidth: 50 }}>{r.seconds}s</span>
                      <span style={{ fontWeight: 600 }}>{usd4(r.cost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        }
        {posts.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,.1)", fontSize: 13, color: "rgba(0,0,0,.6)" }}>
            Click a bar to see every model call behind that post. A post normally costs one draft
            plus one native-editor pass per language.
          </div>
        )}
      </div>

      {/* ---- Per month ---- */}
      <h3 className="analytics-h3">By month</h3>
      <div className="card">
        {months.length === 0
          ? <div style={{ color: "rgba(0,0,0,.5)" }}>Nothing recorded yet.</div>
          : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "rgba(0,0,0,.5)", fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ padding: "4px 8px 8px 0" }}>Month</th>
                  <th style={{ padding: "4px 8px 8px 0" }}>Posts</th>
                  <th style={{ padding: "4px 8px 8px 0" }}>Calls</th>
                  <th style={{ padding: "4px 8px 8px 0" }}>Out tokens</th>
                  <th style={{ padding: "4px 8px 8px 0" }}>Cost</th>
                  <th style={{ padding: "4px 8px 8px 0" }}>Per post</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} style={{ borderTop: "1px solid rgba(0,0,0,.08)" }}>
                    <td style={{ padding: "6px 8px 6px 0" }}>{m.month}</td>
                    <td style={{ padding: "6px 8px 6px 0" }}>{m.posts.size}</td>
                    <td style={{ padding: "6px 8px 6px 0" }}>{m.calls}</td>
                    <td style={{ padding: "6px 8px 6px 0" }}>{fmtCount(m.output)}</td>
                    <td style={{ padding: "6px 8px 6px 0", fontWeight: 600 }}>{usd(m.usd)}</td>
                    <td style={{ padding: "6px 8px 6px 0" }}>{usd(m.posts.size ? m.usd / m.posts.size : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {/* ---- Rate card ---- */}
      <h3 className="analytics-h3">Rate card</h3>
      <div className="card">
        <div style={{ fontSize: 13, color: "rgba(0,0,0,.6)", marginBottom: 12 }}>
          USD per 1M tokens. The API reports tokens, never money, so these numbers are what turns
          the counts above into a bill. Changing one re-prices this whole page instantly.
          {rates.updated ? ` Last confirmed ${rates.updated}.` : ""}
        </div>
        {Object.keys(rates.models || {}).map((model) => (
          <div className="card" key={model} style={{ marginBottom: 8 }}>
            <div className="row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
            <div>
              <label>Model</label>
              <input value={model} readOnly style={{ fontFamily: "monospace" }}/>
            </div>
            <div>
              <label>Input</label>
              <input type="number" min="0" step="0.01" value={rates.models[model].input}
                     onChange={(e) => setRate(model, "input", e.target.value)}/>
            </div>
            <div>
              <label>Cached input</label>
              <input type="number" min="0" step="0.01" value={rates.models[model].cachedInput}
                     onChange={(e) => setRate(model, "cachedInput", e.target.value)}/>
            </div>
            <div>
              <label>Output</label>
              <input type="number" min="0" step="0.01" value={rates.models[model].output}
                     onChange={(e) => setRate(model, "output", e.target.value)}/>
            </div>
            </div>
          </div>
        ))}
        <div className="actions-bar" style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={saveRates} disabled={!ratesDirty}>Save rate card</button>
          <button className="btn" onClick={() => downloadFile("model-pricing.json", JSON.stringify(rates, null, 2) + "\n")}>
            Export model-pricing.json
          </button>
          <button className="btn ghost" onClick={resetRates}>Reset</button>
        </div>
      </div>

      {/* ---- Where the money goes ---- */}
      {models.length > 0 && (
        <>
          <h3 className="analytics-h3">By model</h3>
          <div className="card">
            {models.map((m) => (
              <StatBar key={m.model} label={`${m.model} · ${m.calls} call${m.calls === 1 ? "" : "s"}`}
                       value={m.usd} fmt={usd} max={Math.max(0.0001, ...models.map((x) => x.usd))}/>
            ))}
          </div>
        </>
      )}

      <div className="note" style={{ marginTop: 16 }}>
        <b>Where these numbers come from.</b> <code>tools/story-gen.mjs</code> appends one line to
        <code>/data/story-costs.json</code> for every model call, with the token counts the API
        itself returned. That file is committed with the repo and uploaded by
        <code>tools/deploy-stories.sh</code>. Nothing here is estimated except the rate card, and
        the rate card is editable above.
      </div>
    </div>
  );
}

// ---------- App ----------
function App() {
  // Auth handled at server level by Apache Basic Auth (.htaccess).
  // No client-side gate needed — getting here means the user already passed auth.
  const [content, setContent] = useState(null);
  const [tab, setTab] = useState("site");
  const [dirty, setDirty] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [trProgress, setTrProgress] = useState(null);   // { done, total, msg } | null

  useEffect(() => {
    loadContent().then((c) => {
      if (c) setContent(c);
      else setLoadErr("Could not load content.json. Make sure it exists at the site root.");
    });
  }, []);

  const update = (next) => { setContent(next); setDirty(true); };

  const handleSave = () => {
    saveLocal(content);
    setDirty(false);
    alert("✓ Saved to THIS browser only.\n\nEdits are stored in localStorage and are NOT yet visible to other visitors. The public site still serves the original content.json.\n\nTo publish for everyone:\n1. Click 'Export content.json'\n2. Upload the downloaded file to /content.json on the server (replace existing)\n\nClick 'Reset' to discard local changes and revert to the live server version.");
  };
  const handleExport = () => downloadJSON(content);
  const handleReset = async () => {
    if (!confirm("Reset all changes? This reloads from content.json on the server.")) return;
    localStorage.removeItem(STORAGE_KEY);
    const c = await loadContent();
    if (c) { setContent(c); setDirty(false); }
  };
  const handleCopyJSON = () => {
    copyToClipboard(JSON.stringify(content, null, 2));
    alert("Copied content.json to clipboard.");
  };

  const handleTranslate = async () => {
    // API key lives on the server in /.openai_key — admin doesn't need it.
    // Proxy /translate.php is behind the same Basic Auth as this page.
    const targetLangs = ["ru", "id"];
    setTrProgress({ done: 0, total: 0, msg: "Preparing…" });
    try {
      const next = await translateContentViaGPT(content, targetLangs, null, (p) => setTrProgress(p));
      setContent(next);
      setDirty(true);
      setTimeout(() => setTrProgress(null), 4000);
    } catch (e) {
      setTrProgress({ done: 0, total: 0, msg: `❌ ${e.message}` });
      setTimeout(() => setTrProgress(null), 8000);
    }
  };

  const handleClearTranslations = () => {
    if (!confirm("Remove all *_ru and *_id translation fields from content? You'll need to re-run Translate.")) return;
    const stripped = JSON.parse(JSON.stringify(content));
    const strip = (obj) => {
      Object.keys(obj).forEach(k => {
        if (k.endsWith("_ru") || k.endsWith("_id")) delete obj[k];
      });
    };
    ["menu", "promos", "faq", "signatureDishes", "experienceTiles"].forEach(s => {
      (stripped[s] || []).forEach(strip);
    });
    delete stripped.menuCategories_ru;
    delete stripped.menuCategories_id;
    setContent(stripped);
    setDirty(true);
  };


  if (loadErr) return <div className="admin-main"><div className="note">{loadErr}</div></div>;
  if (!content) return <div className="admin-main">Loading...</div>;

  const tabs = [
    { id: "site",      label: "General" },
    { id: "menu",      label: "Menu" },
    { id: "promos",    label: "Promos" },
    { id: "faq",       label: "FAQ" },
    { id: "signature", label: "Signature" },
    { id: "photos",    label: "Photos" },
    { id: "stories",   label: "Stories" },
    { id: "analytics", label: "Analytics" },
    { id: "costs",     label: "Costs" },
  ];
  const activeTab = tabs.find(t => t.id === tab);

  return (
    <div className="admin-wrap">
      <aside className="admin-side">
        <div className="brand">Signa<span className="r">.</span></div>
        <div className="sub">Admin · v1</div>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
            <span className="ix">{String(i + 1).padStart(2, "0")}</span>
          </button>
        ))}
        <div className="foot">
          <a href="index.html" target="_blank" rel="noreferrer">View site →</a>
          <a href="#" onClick={(e) => { e.preventDefault(); handleCopyJSON(); }}>Copy JSON</a>
          <a href="admin.php?logout=1">Log out →</a>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-head">
          <h1>{activeTab.label}<span className="r">.</span></h1>
          <span className={`status ${dirty ? "dirty" : ""}`}>
            {dirty ? "● Unsaved changes" : "● Saved"}
          </span>
        </div>

        {tab !== "stories" && tab !== "costs" && <div className="actions-bar">
          <button className="btn primary" onClick={handleSave} disabled={!dirty}>Save</button>
          <button className="btn" onClick={handleExport}>Export content.json</button>
          <button className="btn ghost" onClick={handleReset}>Reset</button>
          <span style={{ flex: 1 }}/>
          <button className="btn translate" onClick={handleTranslate} disabled={!!trProgress && trProgress.done < trProgress.total}>
            {trProgress && trProgress.done < trProgress.total ? "Translating…" : "🌐 Translate via GPT"}
          </button>
          <button className="btn ghost" onClick={handleClearTranslations} title="Remove all *_ru / *_id fields">
            Clear translations
          </button>
        </div>}

        {trProgress && (
          <div className="tr-progress">
            <div className="tr-progress-bar">
              <div className="tr-progress-fill" style={{ width: trProgress.total ? `${(trProgress.done / trProgress.total * 100).toFixed(0)}%` : "0%" }}/>
            </div>
            <div className="tr-progress-msg">{trProgress.msg}</div>
          </div>
        )}

        {tab === "site"      && <SiteTab      content={content} set={update}/>}
        {tab === "menu"      && <MenuTab      content={content} set={update}/>}
        {tab === "promos"    && <PromosTab    content={content} set={update}/>}
        {tab === "faq"       && <FAQTab       content={content} set={update}/>}
        {tab === "signature" && <SignatureTab content={content} set={update}/>}
        {tab === "photos"    && <PhotosTab    content={content} set={update}/>}
        {tab === "stories"   && <StoriesTab/>}
        {tab === "analytics" && <AnalyticsTab/>}
        {tab === "costs"     && <CostsTab/>}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
