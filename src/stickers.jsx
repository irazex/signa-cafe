// stickers.jsx
// Reusable sticker SVG library + decorator component.
// All stickers are designed to live on the scrapbook layer (pointer-events: none).
// Position + rotation come from parent; size scales the SVG.

const { useMemo } = React;

// ---------- Inline SVG sticker primitives ----------

const SparkleSticker = ({ size = 40, stroke = "var(--ink)", fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <path
      d="M40 12 L46 32 L66 38 L46 44 L40 64 L34 44 L14 38 L34 32 Z"
      stroke={stroke} strokeWidth="2.4" fill={fill}
      strokeLinejoin="round" strokeLinecap="round"
    />
  </svg>
);

const HeartSticker = ({ size = 40, fill = "var(--red)" }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <path
      d="M40 64 L18 38 Q12 28 22 24 Q32 20 40 30 Q48 20 58 24 Q68 28 62 38 Z"
      fill={fill}
    />
  </svg>
);

const EyeSticker = ({ size = 40, stroke = "var(--ink)" }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <path d="M10 40 Q40 12 70 40 Q40 68 10 40 Z" fill="var(--paper)"
          stroke={stroke} strokeWidth="2.4" strokeLinejoin="round"/>
    <circle cx="40" cy="40" r="10" fill={stroke}/>
    <circle cx="44" cy="36" r="2.5" fill="var(--paper)"/>
  </svg>
);

const FlowerSticker = ({ size = 40, petal = "var(--st-sky)", center = "var(--ink)" }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <circle cx="40" cy="20" r="11" fill={petal}/>
    <circle cx="40" cy="60" r="11" fill={petal}/>
    <circle cx="20" cy="40" r="11" fill={petal}/>
    <circle cx="60" cy="40" r="11" fill={petal}/>
    <circle cx="40" cy="40" r="11" fill={petal}/>
    <circle cx="40" cy="40" r="6" fill={center}/>
  </svg>
);

const SmileySticker = ({ size = 40, stroke = "var(--ink)" }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="28" fill="var(--st-mustard)" stroke={stroke} strokeWidth="2.4"/>
    <circle cx="30" cy="34" r="3" fill={stroke}/>
    <circle cx="50" cy="34" r="3" fill={stroke}/>
    <path d="M28 48 Q40 60 52 48" fill="none" stroke={stroke}
          strokeWidth="2.4" strokeLinecap="round"/>
  </svg>
);

const ArrowSticker = ({ size = 40, stroke = "var(--red)" }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <path d="M12 60 L30 30 L48 50 L66 16"
          fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M56 16 L66 16 L66 26"
          fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CoffeeSticker = ({ size = 40, stroke = "var(--ink)" }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <rect x="20" y="28" width="38" height="32" rx="3" fill="var(--paper)"
          stroke={stroke} strokeWidth="2.4"/>
    <path d="M58 32 Q70 32 70 42 Q70 50 58 50"
          fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round"/>
    <path d="M28 20 Q28 16 32 16" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    <path d="M40 20 Q40 16 44 16" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    <path d="M52 20 Q52 16 56 16" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const RedBlobSticker = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <path
      d="M14 38 L26 22 L34 38 L42 22 L50 38 L58 22 L66 38 L62 42 L66 50 L58 46 L50 60 L42 46 L34 60 L26 46 L18 50 L22 42 Z"
      fill="var(--red)"
    />
  </svg>
);

const SignaStarSticker = ({ size = 40, color = "var(--ink)" }) => (
  <span
    className="signa-star-stk"
    style={{
      display: "block",
      width: size,
      height: size,
      background: color,
      WebkitMask: "url('assets/star.png') center/contain no-repeat",
      mask: "url('assets/star.png') center/contain no-repeat",
    }}
  />
);

const DottedSticker = ({ size = 40 }) => (
  <img src="assets/logo-dotted-s.png" width={size} height={size} alt=""
       style={{ width: size, height: size, objectFit: "contain" }}/>
);

// ---------- Sticker map ----------
const STICKER_COMPONENTS = {
  sparkle: SparkleSticker,
  heart:   HeartSticker,
  eye:     EyeSticker,
  flower:  FlowerSticker,
  smiley:  SmileySticker,
  arrow:   ArrowSticker,
  coffee:  CoffeeSticker,
  blob:    RedBlobSticker,
  star:    SignaStarSticker,
  dotted:  DottedSticker,
};

// ---------- Scrapbook decorator ----------
// Renders absolutely-positioned stickers + handwritten notes inside its parent.
// Items: [{ kind, top, left, right, bottom, rotate, size, ...props }]
function ScrapLayer({ items = [], notes = [], over = false }){
  return (
    <div className={`scrap-layer ${over ? "over" : ""}`} aria-hidden="true">
      {items.map((it, i) => {
        const Comp = STICKER_COMPONENTS[it.kind];
        if (!Comp) return null;
        const { kind, top, left, right, bottom, rotate = 0, size = 40, ...props } = it;
        return (
          <span
            key={`stk-${i}`}
            className="sticker"
            style={{
              top, left, right, bottom,
              width: size,
              "--rot": rotate + "deg",
              "--delay": (i * 0.7).toFixed(2) + "s",
            }}
          >
            <Comp size={size} {...props}/>
          </span>
        );
      })}
      {notes.map((n, i) => (
        <span
          key={`note-${i}`}
          className={`scribble-note ${n.red ? "red" : ""}`}
          style={{
            top: n.top, left: n.left, right: n.right, bottom: n.bottom,
            fontSize: n.fontSize || 22,
            "--rot": (n.rotate || -2) + "deg",
            "--delay": (i * 0.5 + 0.3).toFixed(2) + "s",
            maxWidth: n.maxWidth,
          }}
        >
          {n.text}
        </span>
      ))}
    </div>
  );
}

// Reveal-on-scroll observer (singleton, shared)
const __revealObserver = (() => {
  if (typeof window === "undefined") return null;
  if (window.__signaReveal) return window.__signaReveal;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target);}
    }
  }, { threshold: 0.06, rootMargin: "0px 0px -6% 0px" });
  window.__signaReveal = io;
  return io;
})();

function useReveal(){
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current || !__revealObserver) return;
    __revealObserver.observe(ref.current);
    return () => { try { __revealObserver.unobserve(ref.current);} catch (_) {} };
  }, []);
  return ref;
}

// Export to window for cross-file access
Object.assign(window, {
  SparkleSticker, HeartSticker, EyeSticker, FlowerSticker, SmileySticker,
  ArrowSticker, CoffeeSticker, RedBlobSticker, SignaStarSticker, DottedSticker,
  STICKER_COMPONENTS,
  ScrapLayer,
  useReveal,
});
