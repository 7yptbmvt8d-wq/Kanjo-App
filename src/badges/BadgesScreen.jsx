import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X, Check, KeyRound, Award } from "lucide-react";
import { BADGE_SECTIONS, BADGE_TYPE_LABEL } from "./spec.js";

// Plein écran qui se superpose au Dashboard. Slide-up depuis le bas,
// fond `#F1E9DA`, hero conique de progression, filtre segmenté, 7
// sections empilées, modale détail bottom-sheet.
export default function BadgesScreen({ badges, member, onClose, onSelfDeclareNextStage }) {
  const [filter, setFilter] = useState("all"); // all | earned | locked
  const [selected, setSelected] = useState(null);

  // Empêche le scroll body derrière la modale plein-écran.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const earnedN = badges.filter((b) => b.earned).length;
  const total = badges.length;
  const pctDeg = ((earnedN / total) * 360).toFixed(1) + "deg";
  // Prochain objectif : 1er Kyū → puis 1er Dan → puis 2e Dan… jusqu'à
  // Godan. Quand tout est déverrouillé, message d'encouragement à la
  // place du nom d'un grade.
  const nextGrade = badges.find((b) => (b.cat === "kyu" || b.cat === "dan") && !b.earned);
  const nextName = nextGrade ? nextGrade.full : "Continuer la voie";

  const groups = BADGE_SECTIONS.map(([key, sub, label, note]) => {
    const full = badges.filter((b) => b.cat === key);
    const earnedCount = full.filter((b) => b.earned).length;
    let items = full;
    if (filter === "earned") items = full.filter((b) => b.earned);
    if (filter === "locked") items = full.filter((b) => !b.earned);
    const complete = earnedCount === full.length;
    return {
      key, sub, label, note, items,
      earnedCount, total: full.length,
      pillBg: complete ? "#C9A86A" : "rgba(34,30,24,0.06)",
      pillColor: complete ? "#16291F" : "#9A9078",
    };
  }).filter((g) => g.items.length > 0);

  const sel = selected;
  const m = sel ? badges.find((b) => b.id === sel) : null;
  const meta = m ? BADGE_SECTIONS.find((x) => x[0] === m.cat) : null;

  // Portal vers <body> : ancêtres avec `transform` (animations slide-in
  // des tabs) cassent `position: fixed` qui devient relatif au tab.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-paper animate-slide-up overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-1.5">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-paper-card border border-[rgba(34,30,24,0.08)] flex items-center justify-center"
            title="Retour"
          >
            <ChevronDown size={17} className="text-ink rotate-90" />
          </button>
          <div className="text-[11px] tracking-seal text-ink-muted font-bold uppercase">Profil</div>
        </div>

        <div className="px-5 pb-7">
          <div className="text-[10.5px] tracking-seal text-gold font-bold uppercase">Le tableau d'honneur</div>
          <div className="font-serif text-[36px] leading-none font-semibold mt-2 text-ink">Badges</div>

          {/* Hero progress */}
          <div
            className="mt-5 rounded-[24px] text-paper p-[22px] flex items-center gap-5 relative overflow-hidden shadow-heroDark"
            style={{ background: "linear-gradient(150deg,#244536,#16291F)" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-2.5 -bottom-7 font-serif leading-none select-none"
              style={{ fontSize: 104, color: "rgba(201,168,106,0.13)" }}
            >
              徳
            </div>
            <div
              className="shrink-0 w-[86px] h-[86px] rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(#C9A86A ${pctDeg}, rgba(241,233,218,0.16) 0)` }}
            >
              <div className="w-[68px] h-[68px] rounded-full flex flex-col items-center justify-center" style={{ background: "#16291F" }}>
                <div className="font-serif text-[26px] font-semibold leading-none">{earnedN}</div>
                <div className="text-[10px] font-bold mt-0.5" style={{ color: "#C9A86A" }}>/ {total}</div>
              </div>
            </div>
            <div className="flex-1 min-w-0 relative">
              <div className="font-serif text-[20px] font-semibold leading-[1.15]">
                {earnedN === 0
                  ? "Bienvenue sur la Voie."
                  : earnedN < 8
                  ? "Beau démarrage."
                  : earnedN < 15
                  ? "Beau parcours sur le tatami."
                  : "Pratique exemplaire."}
              </div>
              <div className="text-[12.5px] mt-1.5" style={{ color: "rgba(241,233,218,0.72)" }}>
                Prochain objectif : <span className="font-bold" style={{ color: "#C9A86A" }}>{nextName}</span>
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="mt-5 flex gap-1 p-1 rounded-[14px]" style={{ background: "#E7DDCB" }}>
            {[
              { id: "all", label: "Tous" },
              { id: "earned", label: "Obtenus" },
              { id: "locked", label: "À débloquer" },
            ].map((opt) => {
              const active = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className="flex-1 text-center py-2.5 rounded-[11px] text-[12px] font-bold transition-colors"
                  style={{
                    background: active ? "#1F3A2E" : "transparent",
                    color: active ? "#F1E9DA" : "#6B6253",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Sections */}
          {groups.map((g) => (
            <div key={g.key} className="mt-7">
              <div className="flex items-end justify-between px-0.5">
                <div>
                  <div className="text-[10px] tracking-section font-bold uppercase" style={{ color: "#A98146" }}>{g.sub}</div>
                  <div className="font-serif text-[20px] font-semibold mt-1 text-ink">{g.label}</div>
                </div>
                <div
                  className="text-[11px] font-extrabold px-2.5 py-1 rounded-full tabular-nums"
                  style={{ background: g.pillBg, color: g.pillColor }}
                >
                  {g.earnedCount}/{g.total}
                </div>
              </div>
              {g.note && (
                <div className="mt-1.5 px-0.5 font-serif italic text-[12px] text-ink-soft">{g.note}</div>
              )}
              <div className="mt-4 grid grid-cols-4 gap-y-[18px] gap-x-1.5">
                {g.items.map((b) => (
                  <Medallion key={b.id} badge={b} onClick={() => setSelected(b.id)} size={62} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modale détail */}
      {m && (
        <BadgeDetail
          badge={m}
          catLabel={meta ? meta[2] : ""}
          member={member}
          onSelfDeclare={onSelfDeclareNextStage}
          onClose={() => setSelected(null)}
        />
      )}
    </div>,
    document.body,
  );
}

function styleForBadge(b) {
  if (b.earned) {
    const bg = b.cat === "kyu" ? b.kyuBg : null;
    const kc = b.cat === "kyu" ? b.kyuKc : null;
    if (b.cat === "kyu") return { bg, kc };
    const map = {
      pas: { bg: "linear-gradient(145deg,#2C5440,#16291F)", kc: "#F1E9DA" },
      dan: { bg: "radial-gradient(circle at 35% 28%,#2c2c2c,#0f0f0f)", kc: "#C9A86A" },
      assi: { bg: "linear-gradient(145deg,#DCBD7C,#A98146)", kc: "#2A1E08" },
      hakama: { bg: "linear-gradient(145deg,#3C3666,#1E1B33)", kc: "#E7E1FA" },
      stages: { bg: "linear-gradient(145deg,#2C5440,#16291F)", kc: "#C9A86A" },
      prof: { bg: "linear-gradient(145deg,#7C4232,#46221A)", kc: "#F2CB8C" },
    };
    return map[b.cat] || { bg: "#E7DDCB", kc: "#C7BDA7" };
  }
  return { bg: "#E7DDCB", kc: "#C7BDA7" };
}

function Medallion({ badge, onClick, size = 62 }) {
  const { bg, kc } = styleForBadge(badge);
  const fontSize = Math.round(size * 0.44);
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <div
        className="rounded-full flex items-center justify-center relative"
        style={{
          width: size, height: size, background: bg,
          border: badge.earned ? "2px solid #C9A86A" : "1.5px solid rgba(34,30,24,0.10)",
          boxShadow: badge.earned ? "0 8px 16px -8px rgba(34,30,24,0.55)" : "none",
          opacity: badge.earned ? 1 : 0.96,
        }}
      >
        <span className="font-serif font-semibold leading-none" style={{ fontSize, color: kc }}>
          {badge.kanji}
        </span>
        {!badge.earned && (
          <div
            className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "#F1E9DA", border: "1px solid rgba(34,30,24,0.1)" }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#A99E89" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
        )}
      </div>
      <div
        className="text-[10px] leading-tight text-center font-semibold"
        style={{ color: badge.earned ? "#3A352C" : "#A99E89" }}
      >
        {badge.short}
      </div>
    </button>
  );
}

function BadgeDetail({ badge, catLabel, onClose, onSelfDeclare }) {
  const { bg, kc } = styleForBadge(badge);
  const showSelf = badge.type === "self" && !badge.earned;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end animate-fade-in"
      style={{ background: "rgba(22,30,24,0.55)", backdropFilter: "blur(3px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-paper rounded-t-[28px] px-6 pt-3 pb-10 shadow-device animate-slide-up"
      >
        <div className="w-[42px] h-[5px] mx-auto mb-5 rounded-full" style={{ background: "rgba(34,30,24,0.15)" }} />
        <div className="flex flex-col items-center">
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 104, height: 104, background: bg,
              border: badge.earned ? "2px solid #C9A86A" : "1.5px solid rgba(34,30,24,0.10)",
              boxShadow: badge.earned ? "0 8px 16px -8px rgba(34,30,24,0.55)" : "none",
              opacity: badge.earned ? 1 : 0.96,
            }}
          >
            <span className="font-serif font-semibold leading-none" style={{ fontSize: 46, color: kc }}>
              {badge.kanji}
            </span>
          </div>
          <div className="mt-4 text-[10px] tracking-seal font-bold uppercase" style={{ color: "#A98146" }}>
            {catLabel}
          </div>
          <div className="mt-1 font-serif text-[25px] font-semibold text-center leading-[1.1] text-ink">
            {badge.full}
          </div>
          <div className="mt-1.5 text-[12px] font-semibold text-ink-muted">
            {BADGE_TYPE_LABEL[badge.type]}
          </div>
        </div>

        <div
          className="mt-5 rounded-[18px] px-4 py-4 flex gap-3 items-start"
          style={{
            background: badge.earned ? "rgba(31,58,46,0.07)" : "#FBF7EE",
            border: `1px solid ${badge.earned ? "rgba(31,58,46,0.18)" : "rgba(34,30,24,0.08)"}`,
          }}
        >
          <div
            className="shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center"
            style={{ background: badge.earned ? "#1F3A2E" : "rgba(169,129,70,0.14)" }}
          >
            {badge.earned ? (
              <Check size={15} className="text-paper" strokeWidth={2.6} />
            ) : (
              <KeyRound size={14} className="text-gold" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-extrabold" style={{ color: badge.earned ? "#1F3A2E" : "#A98146" }}>
              {badge.earned ? "Badge obtenu" : "À débloquer"}
            </div>
            <div className="text-[13px] leading-[1.5] mt-0.5" style={{ color: "#4A4338" }}>
              {badge.cond}
            </div>
          </div>
        </div>

        {showSelf && (
          <button
            onClick={() => { onSelfDeclare && onSelfDeclare(badge); }}
            className="mt-4 w-full text-center rounded-[14px] py-3.5 text-[14px] font-bold flex items-center justify-center gap-1.5"
            style={{ background: "#1F3A2E", color: "#F1E9DA" }}
          >
            <Award size={15} />
            Voir les stages éligibles
          </button>
        )}

        <button onClick={onClose} className="mt-3 w-full text-center text-[14px] font-bold text-ink-soft py-2.5 flex items-center justify-center gap-1.5">
          <X size={15} />
          Fermer
        </button>
      </div>
    </div>
  );
}
