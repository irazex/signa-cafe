// admin.jsx — Signa content admin
// Reads /content.json (or localStorage override), shows edit forms,
// saves to localStorage + downloads updated content.json for git deploy.

const { useState, useEffect, useMemo, useRef } = React;

const STORAGE_KEY = "signa.admin.content";
const AUTH_KEY = "signa.admin.auth";
const PASSWORD_HASH = "6fe5fdb6bd3deca4cae57d2eb6671b3a5f5036f5c08b3cb5dccd28a6e7dfc97a"; // sha-256 of z3zwa3qwX

async function sha256(text){
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function checkPassword(pwd){
  const h = await sha256(pwd);
  return h === PASSWORD_HASH;
}
function isAuthed(){
  try { return sessionStorage.getItem(AUTH_KEY) === "1";} catch (_) { return false;}
}
function setAuthed(v){
  try { v ? sessionStorage.setItem(AUTH_KEY, "1") : sessionStorage.removeItem(AUTH_KEY);} catch (_) {}
}

function LoginGate({ onAuth }){
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(false);
  const [pending, setPending] = useState(false);
  const submit = async (e) => {
    e?.preventDefault();
    setPending(true);
    const ok = await checkPassword(pwd);
    setPending(false);
    if (ok){ setAuthed(true); onAuth();}
    else { setErr(true); setPwd(""); }
  };
  return (
    <div className="login-gate">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">Signa<span style={{ color: "var(--red)" }}>.</span></div>
        <div className="login-sub">Admin access</div>
        <input
          type="password"
          value={pwd}
          autoFocus
          placeholder="Password"
          onChange={(e) => { setPwd(e.target.value); setErr(false); }}
        />
        {err && <div className="login-err">Wrong password</div>}
        <button type="submit" className="btn primary" disabled={pending || !pwd}>{pending ? "Checking…" : "Enter →"}</button>
      </form>
    </div>
  );
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

// ---------- App ----------
function App() {
  const [authed, setAuthed_] = useState(() => isAuthed());
  const [content, setContent] = useState(null);
  const [tab, setTab] = useState("site");
  const [dirty, setDirty] = useState(false);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    if (!authed) return;
    loadContent().then((c) => {
      if (c) setContent(c);
      else setLoadErr("Could not load content.json. Make sure it exists at the site root.");
    });
  }, [authed]);

  if (!authed) return <LoginGate onAuth={() => setAuthed_(true)}/>;

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

  if (loadErr) return <div className="admin-main"><div className="note">{loadErr}</div></div>;
  if (!content) return <div className="admin-main">Loading...</div>;

  const tabs = [
    { id: "site",      label: "General" },
    { id: "menu",      label: "Menu" },
    { id: "promos",    label: "Promos" },
    { id: "faq",       label: "FAQ" },
    { id: "signature", label: "Signature" },
    { id: "photos",    label: "Photos" },
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
          <a href="#" onClick={(e) => { e.preventDefault(); setAuthed(false); setAuthed_(false); }}>Sign out</a>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-head">
          <h1>{activeTab.label}<span className="r">.</span></h1>
          <span className={`status ${dirty ? "dirty" : ""}`}>
            {dirty ? "● Unsaved changes" : "● Saved"}
          </span>
        </div>

        <div className="actions-bar">
          <button className="btn primary" onClick={handleSave} disabled={!dirty}>Save</button>
          <button className="btn" onClick={handleExport}>Export content.json</button>
          <button className="btn ghost" onClick={handleReset}>Reset</button>
        </div>

        {tab === "site"      && <SiteTab      content={content} set={update}/>}
        {tab === "menu"      && <MenuTab      content={content} set={update}/>}
        {tab === "promos"    && <PromosTab    content={content} set={update}/>}
        {tab === "faq"       && <FAQTab       content={content} set={update}/>}
        {tab === "signature" && <SignatureTab content={content} set={update}/>}
        {tab === "photos"    && <PhotosTab    content={content} set={update}/>}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
