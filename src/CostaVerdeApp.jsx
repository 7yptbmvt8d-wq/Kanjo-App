import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  MapPin,
  Clock,
  Megaphone,
  Plus,
  X,
  Settings,
  AlertTriangle,
  Check,
  BookOpen,
  ClipboardCheck,
  Award,
  KeyRound,
  LogOut,
  Bell,
  Pin,
  Trash2,
  ChevronDown,
  Users,
  UserPlus,
  Pencil,
  LayoutDashboard,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import { usePush } from "./hooks/usePush.js";
import BadgesScreen from "./badges/BadgesScreen.jsx";
import { computeMemberBadges, BADGES } from "./badges/spec.js";
import {
  authenticateProf,
  loadProfFromStorage,
  persistProf,
  profGateConfigured,
} from "./auth/profGate.js";
import {
  getDeviceId,
  loadLicenceFromStorage,
  persistLicence,
} from "./auth/profile.js";

import {
  LOCATIONS,
  PROFS,
  ROLL_CALL_TARGETS,
  DOJO_INFO,
  GRADES,
  PROF_MEMBERS,
  SEED_ANNOUNCEMENTS,
} from "./data/seed.js";
import { useCourses, useAnnouncements } from "./hooks/useClubData.js";
import { firebaseEnabled } from "./firebase/config.js";
import {
  addAnnouncement,
  addRollCall,
  assignGrade,
  claimDevice,
  createOrUpdateMember,
  deleteAnnouncement,
  deleteAttendance,
  deleteMember,
  fetchMember,
  deleteStage,
  markMemberLeft,
  recordAttendance,
  recordPresence,
  recordStage,
  setMemberManualBadges,
  toggleStageAttendance,
  toggleAnnouncementPin,
  updateAttendance,
  updateCourse,
  updateStageAffiche,
  uploadStageAffiche,
  useAllMembers,
  useAttendanceSessions,
  useMember,
  usePresenceAggregates,
  usePresenceResponses,
  useStages,
} from "./firebase/firestore.js";

const PROF_PLACEHOLDER = "Enseignant à confirmer";
const ADMIN_PROF = "Sébastien";

// Minimum months a candidate must spend in their current grade before the
// next promotion. The club uses a uniform 1-year minimum for every Kyu
// passage instead of the FFAB sliding scale (2 / 3 / 6 / 7 / 8 months);
// Dan promotions still follow the FFAB cadence (+1 year per Dan stripe).
const MIN_MONTHS_TO_REACH = {
  "6kyu": 12,
  "5kyu": 12,
  "4kyu": 12,
  "3kyu": 12,
  "2kyu": 12,
  "1kyu": 12,
  shodan: 12,
  nidan: 24,
  sandan: 36,
  yondan: 48,
  godan: 60,
};

function monthsSince(timestamp) {
  const ms = timestamp?.toMillis?.() ?? (timestamp?.seconds ? timestamp.seconds * 1000 : 0);
  if (!ms) return 0;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24 * 30.4375);
}

function formatObtained(timestamp) {
  const ms = timestamp?.toMillis?.() ?? (timestamp?.seconds ? timestamp.seconds * 1000 : 0);
  if (!ms) return null;
  const d = new Date(ms);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// Détection iPhone/iPad + app installée (mode standalone). Sur iOS, les
// notifications push ne sont possibles QUE si l'app est ajoutée à l'écran
// d'accueil (iOS 16.4+) — d'où l'encart d'aide affiché dans Safari.
const IS_IOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const IS_STANDALONE =
  typeof window !== "undefined" &&
  ((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true);

// Birth month/year stored as "YYYY-MM" — what <input type="month"> emits.
// Threshold chosen to mirror the club's own teaching split: "Enfants 6-12 ans"
// vs. "Ados & Adultes" — kids switch to the adult group at 13.
const ADULT_AGE_THRESHOLD = 13;

function ageInYears(birthYM) {
  if (typeof birthYM !== "string" || !/^\d{4}-\d{2}$/.test(birthYM)) return null;
  const [y, m] = birthYM.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m) age--;
  return age >= 0 && age < 130 ? age : null;
}

function ageCategory(birthYM) {
  const a = ageInYears(birthYM);
  if (a == null) return null;
  return a < ADULT_AGE_THRESHOLD ? "enfant" : "adulte";
}

const norm = (s) => (s || "").toLocaleLowerCase("fr").replace(/\s+/g, "");
const PROF_MEMBER_KEYS = new Set(
  PROF_MEMBERS.map((p) => `${norm(p.firstName)}|${norm(p.lastName)}`),
);

function isProfMember(member) {
  return PROF_MEMBER_KEYS.has(`${norm(member?.firstName)}|${norm(member?.lastName)}`);
}

// Badges hors grades. Les badges Kyū/Dan NE sont PAS forcés : ils ne
// s'obtiennent que si le grade est réellement détenu (calculés via gradeIdx).
const NON_GRADE_BADGE_IDS = BADGES.filter((b) => b.cat !== "kyu" && b.cat !== "dan").map((b) => b.id);
// forceBadges effectif : un prof obtient tous les badges SAUF ceux liés au
// grade ; sinon les éventuels forceBadges posés sur sa fiche.
function forceBadgesFor(member) {
  if (isProfMember(member)) return NON_GRADE_BADGE_IDS;
  return Array.isArray(member?.forceBadges) ? member.forceBadges : [];
}

function formatBirthYM(birthYM) {
  if (typeof birthYM !== "string" || !/^\d{4}-\d{2}$/.test(birthYM)) return null;
  const [y, m] = birthYM.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// <input type="date"> expects YYYY-MM-DD in *local* time. Round-tripping
// through toISOString would shift the day for anyone east of UTC, so we
// compose the value by hand from local components.
function timestampToDateInput(timestamp) {
  const ms = timestamp?.toMillis?.() ?? (timestamp?.seconds ? timestamp.seconds * 1000 : 0);
  const d = ms ? new Date(ms) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToDate(str) {
  if (!str) return new Date();
  // Noon avoids edge-of-day timezone surprises when we later format the
  // stamp back to "juin 2026".
  return new Date(`${str}T12:00:00`);
}

function sameDateInput(timestamp, str) {
  return timestampToDateInput(timestamp) === str;
}

const WEEK_ORDER = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
// JavaScript getDay() returns 0=Sunday, 1=Monday…
const DAY_INDEX = { Dimanche: 0, Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6 };
// Single kanji per weekday — month / fire / water / wood / metal / earth / sun.
const DAY_KANJI = {
  Lundi: "月", Mardi: "火", Mercredi: "水", Jeudi: "木",
  Vendredi: "金", Samedi: "土", Dimanche: "日",
};

// Walks the calendar from `now` to the next instance of this course (same
// weekday + start time). Returns a Date, or null if the course's day name
// isn't a recognised French weekday.
function nextOccurrence(course, now) {
  const target = DAY_INDEX[course.day];
  if (target === undefined) return null;
  const [h, m] = course.start.split(":").map(Number);
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  let diff = (target - now.getDay() + 7) % 7;
  if (diff === 0 && next <= now) diff = 7;
  next.setDate(next.getDate() + diff);
  return next;
}

// Same idea, but if today's instance is currently running we return it
// instead of jumping to next week — that way the "Mon prochain cours"
// card stays visible during the session (with a progress bar) and only
// rotates to the next occurrence once it's over.
function classOccurrence(course, now) {
  const target = DAY_INDEX[course.day];
  if (target === undefined) return null;
  const [hS, mS] = course.start.split(":").map(Number);
  const [hE, mE] = (course.end || course.start).split(":").map(Number);
  if (now.getDay() === target) {
    const start = new Date(now); start.setHours(hS, mS, 0, 0);
    const end = new Date(now); end.setHours(hE, mE, 0, 0);
    if (now >= start && now < end) {
      return { when: start, end, inProgress: true };
    }
  }
  const start = new Date(now); start.setHours(hS, mS, 0, 0);
  let diff = (target - now.getDay() + 7) % 7;
  if (diff === 0 && start <= now) diff = 7;
  start.setDate(start.getDate() + diff);
  const end = new Date(start); end.setHours(hE, mE, 0, 0);
  return { when: start, end, inProgress: false };
}

// Saison de la FFAB : 1er septembre → 31 août. Renvoie {start, end} en
// millisecondes pour borner les compteurs "cette saison" et la frise.
function currentSeasonRange(now = new Date()) {
  const startYear = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
  const start = new Date(startYear, 8, 1, 0, 0, 0, 0);
  const end = new Date(startYear + 1, 7, 31, 23, 59, 59, 999);
  return { start: start.getTime(), end: end.getTime(), label: `${startYear}–${startYear + 1}` };
}

// Combien d'années entières depuis `timestamp` jusqu'à maintenant — utilisé
// pour les badges d'ancienneté (1 / 5 / 10 ans de pratique).
function yearsSince(timestamp) {
  return Math.floor(monthsSince(timestamp) / 12);
}

// True if both timestamps fall on the same local calendar day. Used to
// detect "already pointed today" in the Pointage modal.
function isSameLocalDay(msA, msB) {
  if (!msA || !msB) return false;
  const a = new Date(msA);
  const b = new Date(msB);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

// Audience d'un cours : déduit du titre, pour filtrer la liste de pointage.
// "all" = tout adhérent · "adultes" = ≥ ADULT_AGE_THRESHOLD · "enfants" = < seuil.
// Les cours adultes (armes, self-défense, séniors, ados) sont rangés en
// "adultes" : tous nos enfants (< 13 ans) sont en dehors du public visé.
function courseAudience(course) {
  const t = (course?.title || "").toLocaleLowerCase("fr");
  if (
    t.includes("aïkitaïso") || t.includes("aikitaiso") ||
    t.includes("adulte") ||
    t.includes("ados") ||
    t.includes("arme") ||
    t.includes("bokken") ||
    t.includes("self-défense") || t.includes("self defense") ||
    t.includes("sénior") || t.includes("senior")
  ) return "adultes";
  if (t.includes("enfant")) return "enfants";
  return "all";
}

// Cible d'un appel (rollCall) → audience visée. Réutilise les mêmes
// règles que les cours pour rester cohérent.
function rollCallAudience(rc) {
  return courseAudience({ title: rc?.target || "" });
}

// Un adhérent doit-il voir cet appel ? Filtre par catégorie d'âge
// (enfant/adulte) et par lieu de pratique. Les fiches sans birthYM ou
// sans practiceLocations restent permissives (on les laisse voir
// pour ne perdre personne).
function memberSeesRollCall(member, rc) {
  if (!member || !rc || rc.type !== "presence") return true;
  // Audience
  const cat = ageCategory(member.birthYM);
  const aud = rollCallAudience(rc);
  if (cat && aud === "adultes" && cat !== "adulte") return false;
  if (cat && aud === "enfants" && cat !== "enfant") return false;
  // Lieu
  if (rc.location && rc.location !== "Tout le club") {
    const locs = Array.isArray(member.practiceLocations) && member.practiceLocations.length > 0
      ? member.practiceLocations
      : null;
    if (locs && !locs.includes(rc.location)) return false;
  }
  return true;
}

function relativeDayLabel(date, now) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  const name = WEEK_ORDER[(date.getDay() + 6) % 7];
  return days === 7 ? `${name} prochain` : name;
}

// Date relative pour une annonce ou un stage publié : "Aujourd'hui",
// "Hier", "il y a N jours" jusqu'à 6 j, puis date courte ensuite.
function relativePastLabel(ts) {
  const ms = timestampMillis(ts);
  if (!ms) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(ms);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((today - target) / 86400000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `il y a ${days} jours`;
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const LOGO_COSTA_VERDE = "/branding/logo-kanjo.png";

// ---- Visual helpers ----

function Seal({ children, tone = "ink" }) {
  const tones = {
    ink: "border-ink text-ink",
    red: "border-vermillion-500 text-vermillion-500",
    amber: "border-amber-600 text-amber-600",
    fade: "border-sand-300 text-sand-400",
  };
  return (
    <div
      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-[11px] font-display font-bold shrink-0 ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 40 40" className="w-8 h-8">
      <circle cx="20" cy="20" r="19" fill="none" stroke="#c9a24d" strokeWidth="1.5" />
      <path
        d="M20 4 A16 16 0 1 0 20 36 A11 11 0 1 1 20 4"
        fill="#c9a24d"
      />
      <circle cx="26" cy="13" r="3.2" fill="#e2c488" />
    </svg>
  );
}

// Enso — an open circle drawn in one breath. Used as the visual signature
// for empty / contemplative states in the app.
function Enso({ className = "" }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <linearGradient id="ensoStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c9a24d" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#c9a24d" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M 50 12
           A 38 38 0 1 1 24 22
           A 38 38 0 0 1 76 78"
        fill="none"
        stroke="url(#ensoStroke)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="75" cy="78" r="2.2" fill="#d62828" />
    </svg>
  );
}

const STATUS_LABEL = {
  normal: null,
  changement: "Changement",
  annule: "Annulé",
  "a-venir": "À venir",
};

const STATUS_TONE = {
  normal: "ink",
  changement: "amber",
  annule: "red",
  "a-venir": "fade",
};

function CourseCard({ c, profMode, onProfChange }) {
  const isCancelled = c.status === "annule";
  const dayAbbr = c.day.slice(0, 3).toUpperCase();
  const initials = profInitials(c.prof);
  return (
    <div className={`bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[18px] p-4 flex gap-[15px] shadow-card ${isCancelled ? "opacity-70" : ""}`}>
      <div className="flex-none w-[60px] border-r border-[rgba(34,30,24,0.09)] pr-[13px]">
        <div className="text-[10px] tracking-mark text-gold uppercase font-bold">{dayAbbr}</div>
        <div className={`font-serif text-[23px] font-semibold mt-[5px] tabular-nums leading-none ${isCancelled ? "text-ink-muted line-through" : "text-ink"}`}>
          {c.start}
        </div>
        <div className="text-[11px] text-ink-muted tabular-nums mt-0.5">{c.end}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-serif text-[17px] font-semibold leading-tight ${isCancelled ? "text-ink-muted line-through" : "text-ink"}`}>
          {c.title}
        </div>
        {STATUS_LABEL[c.status] && (
          <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold tracking-section uppercase rounded-full px-2.5 py-0.5 ${
            c.status === "annule"
              ? "bg-[rgba(220,38,38,0.10)] text-vermillion-500"
              : c.status === "changement"
              ? "bg-[rgba(245,158,11,0.12)] text-amber-700"
              : "bg-[rgba(31,58,46,0.09)] text-pine"
          }`}>
            {c.status === "annule" ? <X size={10} strokeWidth={3} /> :
             c.status === "changement" ? <AlertTriangle size={10} /> :
             <Clock size={10} />}
            {STATUS_LABEL[c.status]}
          </div>
        )}
        {c.note && (
          <div className="text-[11.5px] text-ink-soft mt-2 flex items-start gap-1.5 leading-snug">
            <AlertTriangle size={11} className="mt-0.5 shrink-0 text-gold" />
            {c.note}
          </div>
        )}
        <div className="flex items-center gap-2 mt-3">
          <div className="w-[26px] h-[26px] rounded-full bg-pine text-paper text-[9.5px] font-extrabold flex items-center justify-center shrink-0">
            {initials}
          </div>
          {profMode ? (
            <select
              value={c.prof}
              onChange={(e) => onProfChange(c.id, e.target.value)}
              className={`text-[12.5px] bg-transparent border border-dashed rounded px-1.5 py-0.5 focus:outline-none focus:border-pine flex-1 min-w-0 ${
                c.prof === PROF_PLACEHOLDER
                  ? "border-vermillion-500 text-vermillion-500 font-semibold"
                  : "border-[rgba(34,30,24,0.18)] text-ink"
              }`}
            >
              <option value={PROF_PLACEHOLDER}>{PROF_PLACEHOLDER}</option>
              {PROFS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ) : (
            <span className={`text-[12.5px] ${c.prof === PROF_PLACEHOLDER ? "italic text-ink-muted" : "text-ink"}`}>
              {c.prof}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PresenceCard({ a, response, aggregate, allMembers, onRespond, profMode, isAdmin, onTogglePin, onDelete }) {
  // Compteurs réels depuis Firestore (sub-collection /responses). Si
  // l'agrégat n'est pas encore chargé on retombe sur le compte local
  // baseline + propre voix pour ne pas afficher 0 / 0 le temps du fetch.
  const agg = aggregate || { presents: 0, absents: 0, presentIds: [], absentIds: [] };
  const presentCount = agg.presents || ((a.baselinePresent ?? 0) + (response === "present" ? 1 : 0));
  const absentCount = agg.absents || ((a.baselineAbsent ?? 0) + (response === "absent" ? 1 : 0));
  const total = Math.max(presentCount + absentCount, 8);
  const pct = Math.min(100, Math.round((presentCount / total) * 100));
  const initials = a.initials || profInitials(a.author);

  // Pour le prof : résout les licences en prénoms via allMembers pour
  // afficher la liste des votants.
  const memberById = new Map((allMembers || []).map((m) => [m.id, m]));
  const nameOf = (id) => {
    const m = memberById.get(id);
    return m ? `${m.firstName} ${m.lastName}` : id;
  };
  const presentList = (agg.presentIds || []).map(nameOf);
  const absentList = (agg.absentIds || []).map(nameOf);

  return (
    <div className={`rounded-[18px] bg-paper-card border p-[18px] shadow-card animate-slide-up ${
      a.pinned ? "border-gold/55 shadow-pinned" : "border-[rgba(34,30,24,0.07)]"
    }`}>
      <div className="flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-full bg-pine text-paper text-[10px] font-extrabold flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[13px] font-bold text-ink">{a.author}</div>
            {a.pinned && <PinnedBadge />}
          </div>
          <div className="text-[11px] text-ink-muted">
            Appel · {relativePastLabel(a.createdAt) || a.date}
          </div>
        </div>
        <span className="text-[10px] tracking-section uppercase bg-[rgba(31,58,46,0.09)] text-pine px-2.5 py-1 rounded-full font-bold shrink-0">
          {a.target}
        </span>
        {isAdmin && (
          <AdminActions pinned={a.pinned} onTogglePin={onTogglePin} onDelete={onDelete} />
        )}
      </div>
      <div className="text-[13.5px] text-ink-body leading-[1.55] mt-3 whitespace-pre-line">{a.body}</div>
      <div className="grid grid-cols-2 gap-2.5 mt-3.5">
        <button
          onClick={() => onRespond(a.id, "present")}
          className={`flex items-center justify-center gap-1.5 text-[12.5px] font-semibold py-2.5 rounded-[12px] border transition-all active:scale-[0.98] ${
            response === "present"
              ? "bg-pine text-paper border-pine shadow-card"
              : "bg-paper text-ink-soft border-[rgba(34,30,24,0.12)]"
          }`}
        >
          <Check size={14} />
          Présent
        </button>
        <button
          onClick={() => onRespond(a.id, "absent")}
          className={`flex items-center justify-center gap-1.5 text-[12.5px] font-semibold py-2.5 rounded-[12px] border transition-all active:scale-[0.98] ${
            response === "absent"
              ? "bg-night text-cream border-ink shadow-card"
              : "bg-paper text-ink-soft border-[rgba(34,30,24,0.12)]"
          }`}
        >
          <X size={14} />
          Pas là
        </button>
      </div>
      {profMode && (
        <div className="mt-4 pt-3 border-t border-[rgba(34,30,24,0.07)]">
          <div className="h-1.5 bg-[rgba(34,30,24,0.07)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-bar rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[11px] text-ink-soft mt-2 tabular-nums">
            <span className="text-pine font-semibold">{presentCount}</span> présent{presentCount > 1 ? "s" : ""}
            {" · "}
            <span className="text-vermillion-500 font-semibold">{absentCount}</span> absent{absentCount > 1 ? "s" : ""}
          </div>
          {(presentList.length > 0 || absentList.length > 0) && (
            <div className="mt-2 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="text-[10px] tracking-section font-bold uppercase text-pine">
                  Présents
                </div>
                {presentList.length === 0 ? (
                  <div className="text-ink-muted italic mt-0.5">—</div>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {presentList.map((n) => (
                      <li key={n} className="text-ink-soft">· {n}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-[10px] tracking-section font-bold uppercase text-vermillion-500">
                  Absents
                </div>
                {absentList.length === 0 ? (
                  <div className="text-ink-muted italic mt-0.5">—</div>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {absentList.map((n) => (
                      <li key={n} className="text-ink-soft">· {n}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PinnedBadge() {
  return (
    <div className="inline-flex items-center gap-1 text-[9.5px] font-bold tracking-section text-gold uppercase">
      <Pin size={9} fill="currentColor" />
      Épinglée
    </div>
  );
}

function AdminActions({ pinned, onTogglePin, onDelete }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0 -mr-1">
      <button
        type="button"
        onClick={onTogglePin}
        className="p-1.5 rounded-full hover:bg-[rgba(34,30,24,0.06)] active:bg-[rgba(34,30,24,0.1)] transition-colors"
        title={pinned ? "Désépingler" : "Épingler en haut"}
      >
        <Pin
          size={14}
          className={pinned ? "text-gold" : "text-ink-muted"}
          fill={pinned ? "currentColor" : "none"}
          strokeWidth={pinned ? 2 : 1.8}
        />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 rounded-full hover:bg-[rgba(220,38,38,0.08)] transition-colors"
        title="Supprimer"
      >
        <Trash2 size={14} className="text-ink-muted hover:text-vermillion-500" />
      </button>
    </div>
  );
}

function AnnouncementCard({ a, isAdmin, onTogglePin, onDelete }) {
  const initials = a.initials || profInitials(a.author);
  return (
    <div className={`bg-paper-card border rounded-[18px] p-[18px] shadow-card transition-colors ${
      a.pinned ? "border-gold/55 shadow-pinned" : "border-[rgba(34,30,24,0.07)]"
    }`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-[30px] h-[30px] rounded-full text-cream text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
          a.pinned ? "bg-gold" : "bg-pine"
        }`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[13px] font-bold text-ink">{a.author}</div>
            {a.pinned && <PinnedBadge />}
          </div>
          <div className="text-[11px] text-ink-muted">{relativePastLabel(a.createdAt) || a.date}</div>
        </div>
        <span className="text-[10px] tracking-section uppercase bg-[rgba(31,58,46,0.09)] text-pine px-2.5 py-1 rounded-full font-bold shrink-0">
          {a.target}
        </span>
        {isAdmin && (
          <AdminActions pinned={a.pinned} onTogglePin={onTogglePin} onDelete={onDelete} />
        )}
      </div>
      <div className="text-[13.5px] text-ink-body leading-[1.55] mt-3 whitespace-pre-line">{a.body}</div>
    </div>
  );
}

function GradeCard({ g }) {
  if (g.stub) {
    return (
      <div className="rounded-2xl overflow-hidden border border-sand-200 shadow-card">
        <div className={`px-4 py-3 ${g.barClass}`}>
          <div className="font-display text-[16px] font-extrabold text-white tracking-tight">{g.label}</div>
          <div className="text-[11px] text-white/80">{g.belt}</div>
        </div>
        <div className="bg-white p-4 text-[12.5px] text-sand-400 italic">
          Fiche en cours de rédaction — à compléter avec Sébastien.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-sand-200 shadow-card">
      <div className={`px-4 py-3 flex items-center justify-between ${g.barClass}`}>
        <div>
          <div className={`font-display text-[16px] font-extrabold tracking-tight ${g.id === "6kyu" ? "text-ink" : "text-white"}`}>
            {g.label}
          </div>
          <div className={`text-[11px] ${g.id === "6kyu" ? "text-sand-500" : "text-white/80"}`}>
            {g.belt}
          </div>
        </div>
        <div className={`text-right ${g.id === "6kyu" ? "text-sand-500" : "text-white/80"}`}>
          <div className="text-[9px] font-semibold tracking-seal uppercase">Durée minimale</div>
          <div className="text-[11px] font-medium max-w-[120px]">{g.duration}</div>
        </div>
      </div>

      <div className="bg-white p-4 space-y-3.5">
        {g.note && (
          <div className="text-[10px] font-bold tracking-seal text-sand-50 bg-night inline-block px-2 py-1 rounded">
            {g.note.toUpperCase()}
          </div>
        )}

        {g.basics && (
          <div>
            <div className="text-[10.5px] font-bold tracking-seal text-sand-400 mb-1.5">
              BASES ATTENDUES
            </div>
            <div className="text-[12.5px] text-ink-soft leading-relaxed border-l-2 border-sand-200 pl-3">
              {g.basics}
            </div>
          </div>
        )}

        {g.attacks.length > 0 && (
          <div>
            <div className="text-[10.5px] font-bold tracking-seal text-sand-400 mb-1.5">
              ATTAQUES TRAVAILLÉES
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.attacks.map((a) => (
                <span
                  key={a}
                  className="text-[11px] font-medium text-ink-soft bg-sand-100 px-2 py-1 rounded-full"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {g.sections.map((s) => (
          <div key={s.title} className="rounded-xl overflow-hidden border border-sand-200">
            <div className="bg-night text-sand-50 text-[11px] font-semibold px-3 py-1.5">
              {s.title}
            </div>
            <div className="divide-y divide-sand-100">
              {s.rows.map((r) => (
                <div key={r.attack} className="flex gap-3 px-3 py-2 text-[12px]">
                  <div className="font-semibold text-ink w-[100px] shrink-0">{r.attack}</div>
                  <div className="text-ink-soft">{r.techniques}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {g.extras.map((ex) => (
          <div key={ex.title} className="bg-amber-50 border-l-2 border-amber-400 rounded-r-xl p-3">
            <div className="text-[10.5px] font-bold tracking-seal text-amber-700 mb-1.5">
              {ex.title.toUpperCase()}
            </div>
            <div className="space-y-1">
              {ex.rows.map((r) => (
                <div key={r.label} className="text-[12px] text-ink-soft">
                  <span className="font-semibold">{r.label}</span> — {r.value}
                </div>
              ))}
            </div>
          </div>
        ))}

        {g.culture.length > 0 && (
          <div className="bg-sand-50 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-seal text-sand-500">
              <div className="w-3 h-3 rounded-full border border-sand-400" />
              CULTURE &amp; HISTOIRE
            </div>
            {g.culture.map((c, i) => (
              <div key={i} className="text-[12px] text-ink-soft leading-relaxed pl-1">
                · {c}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Belt colours and Japanese romaji names — surface tokens reused by the new
// Grades hero / timeline. Mirror the spec in the design handoff.
const BELT_COLOR = {
  debutant: "#F5F2EB",
  "6kyu": "#FFFFFF",
  "5kyu": "#E6B422",
  "4kyu": "#D97A2B",
  "3kyu": "#4E8B5B",
  "2kyu": "#3A6B9A",
  "1kyu": "#5A3A26",
  shodan: "#161616",
  nidan: "#161616",
  sandan: "#161616",
  yondan: "#161616",
  godan: "#161616",
};
const BELT_JP = {
  debutant: "Shoshinsha",
  "6kyu": "Rokyū",
  "5kyu": "Gokyū",
  "4kyu": "Yonkyū",
  "3kyu": "Sankyū",
  "2kyu": "Nikyū",
  "1kyu": "Ikkyū",
  shodan: "Shodan",
  nidan: "Nidan",
  sandan: "Sandan",
  yondan: "Yondan",
  godan: "Godan",
};

function ProgrammeContent({ g }) {
  if (g.stub) {
    return (
      <div className="text-[13px] italic text-ink-muted leading-relaxed">
        Fiche en cours de rédaction — à compléter avec Sébastien.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {g.note && (
        <div className="inline-block text-[10px] font-bold tracking-section uppercase bg-night text-cream px-2.5 py-1 rounded">
          {g.note}
        </div>
      )}
      {g.basics && (
        <div>
          <div className="text-[10.5px] font-bold tracking-section text-ink-soft mb-1.5 uppercase">
            Bases attendues
          </div>
          <div className="text-[13px] text-ink-body leading-[1.55] border-l-2 border-gold/60 pl-3">
            {g.basics}
          </div>
        </div>
      )}
      {g.attacks.length > 0 && (
        <div>
          <div className="text-[10.5px] font-bold tracking-section text-ink-soft mb-1.5 uppercase">
            Attaques travaillées
          </div>
          <div className="flex flex-wrap gap-1.5">
            {g.attacks.map((a) => (
              <span
                key={a}
                className="text-[11.5px] font-semibold text-pine bg-[rgba(31,58,46,0.09)] px-2.5 py-1 rounded-full"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
      {g.sections.map((s) => (
        <div key={s.title} className="rounded-[14px] overflow-hidden border border-[rgba(34,30,24,0.07)]">
          <div className="bg-pine text-paper text-[11px] font-bold tracking-section uppercase px-3 py-2">
            {s.title}
          </div>
          <div className="divide-y divide-[rgba(34,30,24,0.06)] bg-paper">
            {s.rows.map((r) => (
              <div key={r.attack} className="flex gap-3 px-3 py-2.5 text-[12.5px]">
                <div className="font-semibold text-ink w-[100px] shrink-0">{r.attack}</div>
                <div className="text-ink-body">{r.techniques}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {g.extras.map((ex) => (
        <div key={ex.title} className="bg-gold-400/10 border-l-2 border-gold rounded-r-[14px] p-3.5">
          <div className="text-[10.5px] font-bold tracking-section text-gold uppercase mb-1.5">
            {ex.title}
          </div>
          <div className="space-y-1">
            {ex.rows.map((r) => (
              <div key={r.label} className="text-[12.5px] text-ink-body">
                <span className="font-semibold">{r.label}</span> — {r.value}
              </div>
            ))}
          </div>
        </div>
      ))}
      {g.culture.length > 0 && (
        <div className="bg-paper rounded-[14px] p-3.5 border border-[rgba(34,30,24,0.07)] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
            <div className="w-3 h-3 rounded-full border border-gold" />
            Culture &amp; histoire
          </div>
          {g.culture.map((c, i) => (
            <div key={i} className="text-[12.5px] text-ink-body leading-relaxed pl-1">
              · {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GradesTab({
  member,
  licence,
  fallbackGradeId,
  setFallbackGradeId,
  viewedGradeId,
  setViewedGradeId,
  onCreateProfile,
  profMode,
  onEditMyGrade,
}) {
  // When a member is signed in, the prof drives the grade — we use the
  // value from Firestore. Anonymous browsing falls back to a local picker
  // so prospects can still explore the progression ladder.
  const signedIn = Boolean(member);
  const currentGradeId = signedIn ? member.grade || GRADES[0].id : fallbackGradeId;
  const current = GRADES.find((g) => g.id === currentGradeId) || GRADES[0];
  const currentIdx = GRADES.findIndex((g) => g.id === current.id);
  const next = currentIdx >= 0 && currentIdx < GRADES.length - 1 ? GRADES[currentIdx + 1] : null;
  const viewed = GRADES.find((g) => g.id === viewedGradeId) || next || current;

  const obtainedLabel = signedIn ? formatObtained(member.gradeObtainedAt) : null;
  const targetMonths = next ? MIN_MONTHS_TO_REACH[next.id] || 0 : 0;
  const elapsedMonths = signedIn && member.gradeObtainedAt ? monthsSince(member.gradeObtainedAt) : 0;
  const progressPct =
    targetMonths > 0 ? Math.min(100, Math.round((elapsedMonths / targetMonths) * 100)) : 0;
  const monthsLeft = Math.max(0, targetMonths - elapsedMonths);

  return (
    <div key="progression" className="pb-7 animate-slide-in-right">
      {/* Header */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+3.75rem)]">
        <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase">
          Progression FFAB
        </div>
        <div className="font-serif text-[36px] font-semibold leading-none mt-2 text-ink">
          Grades
        </div>
        <div className="text-[13px] text-ink-soft mt-1.5">
          {signedIn ? `${member.firstName} ${member.lastName}` : "Votre chemin sur le tatami"}
        </div>
      </div>

      {/* Profile CTA — only visible when not yet onboarded */}
      {!signedIn && (
        <button
          onClick={onCreateProfile}
          className="mx-5 mt-5 w-[calc(100%-2.5rem)] flex items-center gap-3 text-left bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[18px] px-4 py-3.5 shadow-card transition-colors hover:border-pine/30"
        >
          <div className="w-10 h-10 rounded-full bg-pine flex items-center justify-center shrink-0">
            <UserPlus size={17} className="text-paper" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[15px] font-semibold text-ink">
              Créer mon profil
            </div>
            <div className="text-[12px] text-ink-soft leading-snug mt-0.5">
              Renseigne ton n° de licence FFAB pour suivre ta progression.
            </div>
          </div>
          <ChevronDown size={14} className="text-ink-muted -rotate-90" />
        </button>
      )}

      {/* Grade actuel hero */}
      <div className="mx-5 mt-[22px] rounded-[24px] bg-hero-pine text-cream p-6 relative overflow-hidden shadow-heroDark">
        <div className="flex items-center gap-[14px]">
          <div
            className="w-[14px] h-[54px] rounded-[5px] shadow-[0_0_0_1.5px_rgba(241,232,210,0.5)] shrink-0"
            style={{ backgroundColor: BELT_COLOR[current.id] }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold tracking-section text-gold-400 uppercase">
              Grade actuel
            </div>
            <div className="font-serif text-[32px] font-semibold leading-[1.05] mt-1">
              {current.label}
            </div>
            <div className="text-[12px] text-cream/70 mt-0.5">
              {signedIn && obtainedLabel ? `Obtenu en ${obtainedLabel}` : current.belt}
            </div>
          </div>
          {/* Anonymous picker. Disappears once the adhérent is signed in —
              their grade is then driven by the prof. */}
          {!signedIn && (
            <label className="relative shrink-0">
              <select
                value={current.id}
                onChange={(e) => setFallbackGradeId(e.target.value)}
                className="appearance-none bg-cream/15 border border-cream/30 text-cream text-[11px] font-semibold tracking-wide rounded-full pl-3 pr-7 py-1.5 focus:outline-none focus:border-gold cursor-pointer"
              >
                {GRADES.map((g) => (
                  <option key={g.id} value={g.id} className="text-ink">
                    {g.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-cream/70" />
            </label>
          )}
          {/* Self-edit shortcut for profs — opens the same picker modal
              with their own member doc so they can fix grade or date. */}
          {signedIn && profMode && (
            <button
              type="button"
              onClick={onEditMyGrade}
              className="shrink-0 w-8 h-8 rounded-full bg-cream/15 border border-cream/30 flex items-center justify-center hover:bg-cream/25"
              title="Modifier mon grade ou ma date d'obtention"
            >
              <Pencil size={13} className="text-cream" />
            </button>
          )}
        </div>
        {next && (
          <>
            <div className="flex items-center justify-between text-[12px] text-cream/80 mt-5">
              <span>
                Vers le <strong className="text-cream">{next.label}</strong>
              </span>
              {signedIn && targetMonths > 0 ? (
                <span className="tabular-nums">
                  {monthsLeft > 0
                    ? `Encore ~${monthsLeft.toFixed(1)} mois`
                    : "Durée minimale atteinte"}
                </span>
              ) : (
                <span>Durée min. {next.duration}</span>
              )}
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-cream/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-gold-bar transition-all duration-500"
                style={{ width: `${signedIn ? progressPct : 0}%` }}
              />
            </div>
            {signedIn && targetMonths > 0 && (
              <div className="text-[10.5px] text-cream/60 mt-1.5 tracking-wide">
                {elapsedMonths.toFixed(1)} / {targetMonths} mois minimum
              </div>
            )}
          </>
        )}
      </div>

      {/* Historique des grades — uniquement si l'adhérent en a un */}
      {signedIn && Array.isArray(member.gradeHistory) && member.gradeHistory.length > 0 && (
        <div className="px-5 mt-7">
          <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
            Historique
          </div>
          <div className="flex flex-col gap-2">
            {member.gradeHistory.slice().reverse().map((h, i) => {
              const g = GRADES.find((x) => x.id === h.grade);
              const date = formatObtained(h.obtainedAt);
              return (
                <div
                  key={i}
                  className="flex items-center gap-[14px] bg-paper-card/60 border border-[rgba(34,30,24,0.05)] rounded-[14px] px-4 py-2.5"
                >
                  <div
                    className="w-[24px] h-[10px] rounded shrink-0 ring-1 ring-[rgba(241,232,210,0.45)]"
                    style={{ backgroundColor: BELT_COLOR[h.grade] }}
                  />
                  <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
                    <div className="font-serif text-[14px] font-semibold text-ink-soft">
                      {g?.label || h.grade}
                    </div>
                    <div className="text-[11px] text-ink-muted">{date || "—"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Le chemin des grades */}
      <div className="px-5 mt-7">
        <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3.5">
          Le chemin des grades
        </div>
        <div className="flex flex-col gap-2">
          {[...GRADES].reverse().map((g) => {
            const isCurrent = g.id === current.id;
            const isTarget = next && g.id === next.id;
            const isViewed = g.id === viewed.id;
            return (
              <button
                key={g.id}
                onClick={() => setViewedGradeId(g.id)}
                className={`flex items-center gap-[14px] bg-paper-card border rounded-[14px] px-4 py-3 text-left transition-colors ${
                  isViewed ? "border-pine/40 shadow-card" : "border-[rgba(34,30,24,0.07)] hover:border-pine/20"
                }`}
              >
                <div
                  className="w-[34px] h-[14px] rounded shrink-0 ring-1 ring-[rgba(241,232,210,0.45)]"
                  style={{ backgroundColor: BELT_COLOR[g.id] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-[16px] font-semibold text-ink">{g.label}</div>
                  <div className="text-[11px] text-ink-muted">{BELT_JP[g.id]} · {g.belt}</div>
                </div>
                {isCurrent && (
                  <span className="text-[10px] tracking-section uppercase bg-pine text-paper px-2.5 py-1 rounded-full font-bold shrink-0">
                    Vous êtes ici
                  </span>
                )}
                {isTarget && !isCurrent && (
                  <span className="text-[10px] tracking-section uppercase border-[1.5px] border-gold text-gold px-2.5 py-[3px] rounded-full font-bold shrink-0">
                    Objectif
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Programme du X */}
      <div className="px-5 mt-7">
        <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3.5">
          Programme du {viewed.label}
        </div>
        <div key={viewed.id} className="bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[18px] p-5 shadow-card animate-fade-in">
          <ProgrammeContent g={viewed} />
        </div>
      </div>
    </div>
  );
}

// ---- Main App ----

function makeInitials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Profs have dash-separated compound first names ("Jean-Charles"), so a
// space-only split would collapse them to a single letter. Treat both as
// word boundaries.
function profInitials(name) {
  if (!name || name === PROF_PLACEHOLDER) return "?";
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const LAST_SEEN_ANNONCES_KEY = "costa-verde:last-seen-annonces";

function readLastSeenAnnonces() {
  try { return parseInt(localStorage.getItem(LAST_SEEN_ANNONCES_KEY) || "0", 10) || 0; }
  catch { return 0; }
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  return 0;
}

export default function CostaVerdeApp() {
  const [tab, setTab] = useState("club");
  const [lastSeenAnnonces, setLastSeenAnnonces] = useState(() => readLastSeenAnnonces());
  const [location, setLocation] = useState(LOCATIONS[0]);

  // Schedule + announcements come from Firestore when env is configured, otherwise
  // fall back to the in-memory seed so the app stays usable in dev without secrets.
  const courses = useCourses();
  const cloudAnnouncements = useAnnouncements();
  const [localAnnouncements, setLocalAnnouncements] = useState(SEED_ANNOUNCEMENTS);
  const rawAnnouncements = firebaseEnabled ? cloudAnnouncements : localAnnouncements;

  // Auto-masquage des annonces : on cache après 3 semaines pour ne pas
  // garder le mur encombré (les annonces épinglées restent visibles
  // même au-delà). Les docs ne sont pas supprimés — filtrage app-side.
  const THREE_WEEKS_MS = 21 * 86400000;
  const ANNOUNCE_CUTOFF = Date.now() - THREE_WEEKS_MS;
  const liveAnnouncements = rawAnnouncements.filter((a) => {
    if (a.pinned) return true;
    const ms = timestampMillis(a.createdAt);
    return !ms || ms >= ANNOUNCE_CUTOFF;
  });

  // Pinned messages float to the top; the rest stays in createdAt-desc order
  // delivered by Firestore (stable Array.prototype.sort preserves it).
  const sortedAnnouncements = [...liveAnnouncements].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    return bp - ap;
  });

  // Latest createdAt (ms) drives the "unread" red dot on the Annonces tab.
  // Persist the last time the user opened the tab so the dot disappears
  // until the next new announcement.
  // announcements + latestAnnouncementAt + hasUnreadAnnonces sont
  // calculés plus bas une fois profMode connu (le filtrage audience+
  // lieu en dépend).
  let latestAnnouncementAt = 0;

  function selectTab(id) {
    setTab(id);
    if (id === "annonces") {
      setLastSeenAnnonces(latestAnnouncementAt);
      try { localStorage.setItem(LAST_SEEN_ANNONCES_KEY, String(latestAnnouncementAt)); } catch {}
    }
  }

  const push = usePush();
  // Encart iPhone "installer l'app" — masqué une fois fermé (persistant).
  const [iosHintDismissed, setIosHintDismissed] = useState(() => {
    try { return localStorage.getItem("kanjo-aikido:ios-hint") === "1"; } catch { return false; }
  });
  const dismissIosHint = () => {
    setIosHintDismissed(true);
    try { localStorage.setItem("kanjo-aikido:ios-hint", "1"); } catch {}
  };
  const showIosInstallHint = IS_IOS && !IS_STANDALONE && !iosHintDismissed;

  // Adhérent profile — licence number persists locally, the rest comes from
  // Firestore. `member` is null while loading or when the licence has no
  // matching doc (e.g. fresh install).
  const [licence, setLicence] = useState(() => loadLicenceFromStorage());
  const member = useMember(licence);
  // Banner "tu as été déconnecté car une nouvelle session a démarré
  // ailleurs" — déclenché par le watcher activeDeviceId ci-dessous.
  const [kickedFromDevice, setKickedFromDevice] = useState(false);
  // Verrouillage à un seul appareil : on revendique la session à la
  // première reconnaissance (legacy users sans champ activeDeviceId), et
  // on se déconnecte localement si un autre téléphone l'a revendiquée.
  useEffect(() => {
    if (!firebaseEnabled || !licence || !member) return;
    const myDeviceId = getDeviceId();
    if (!myDeviceId) return;
    const claim = member.activeDeviceId;
    if (claim == null) {
      // Migration : premier accès depuis ce champ → on revendique.
      claimDevice(licence, myDeviceId).catch((err) =>
        console.error("claimDevice (legacy) failed:", err),
      );
      return;
    }
    if (claim !== myDeviceId) {
      // Quelqu'un s'est connecté ailleurs → on quitte cet appareil.
      persistLicence(null);
      setLicence(null);
      setKickedFromDevice(true);
    }
  }, [licence, member?.activeDeviceId]);
  // useAllMembers retourne tous les docs /members (profs + anciens
  // inclus). On filtre les anciens (leftAt non null) en amont — ils ne
  // sont plus comptés dans les stats, n'apparaissent plus en pointage,
  // et ne traînent plus dans l'onglet Membres. La fiche Firestore reste
  // intacte, l'onglet Google Sheet conserve la date de départ.
  const allMembersRaw = useAllMembers();
  const allMembers = allMembersRaw.filter((m) => !m.leftAt);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [memberEdit, setMemberEdit] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [pointageOpen, setPointageOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const attendanceSessions = useAttendanceSessions();
  const stages = useStages();

  // Prof identity comes from the PIN gate (or is null = adhérent mode).
  // When the gate isn't configured (no env vars), profMode stays a free
  // toggle so dev / preview keeps working.
  const [profIdentity, setProfIdentity] = useState(() => loadProfFromStorage());
  const [profGateOpen, setProfGateOpen] = useState(false);
  const [legacyProfMode, setLegacyProfMode] = useState(false);
  const profMode = profGateConfigured ? Boolean(profIdentity) : legacyProfMode;
  // Sébastien acts as the message-board admin: he can pin / unpin and
  // delete any announcement. Other profs only publish their own.
  const isAdmin = profIdentity === ADMIN_PROF;

  // Filtre des annonces côté membre : un appel ciblant "Ados & Adultes"
  // ne s'affiche pas pour les enfants, et un appel Vescovato n'apparaît
  // pas chez un membre qui ne pratique qu'à Santa Maria. Le prof voit
  // tout — il a besoin du compte agrégé peu importe sa propre fiche.
  const announcements = profMode
    ? sortedAnnouncements
    : sortedAnnouncements.filter((a) => memberSeesRollCall(member, a));
  latestAnnouncementAt = announcements.reduce(
    (max, a) => Math.max(max, timestampMillis(a.createdAt)),
    0,
  );
  const hasUnreadAnnonces =
    announcements.length > 0 && latestAnnouncementAt > lastSeenAnnonces;

  const [composing, setComposing] = useState(false);
  const [callingRoll, setCallingRoll] = useState(false);
  const [rollCallTarget, setRollCallTarget] = useState(ROLL_CALL_TARGETS[0]);
  // Lieu de l'appel — sert au filtrage côté membre (les Santa Maria
  // ne reçoivent pas un appel Vescovato et inversement).
  const [rollCallLocation, setRollCallLocation] = useState("Tout le club");
  const [draft, setDraft] = useState({
    author: profIdentity ?? PROFS[0],
    target: "Tout le club",
    body: "",
  });
  // Réponses aux appels — persistées dans Firestore via recordPresence,
  // restaurées à l'ouverture via usePresenceResponses. `localOverride`
  // sert juste de cache optimiste pour l'UX immédiate avant que le
  // snapshot Firestore confirme.
  const [localPresenceOverride, setLocalPresenceOverride] = useState({});
  const [currentGradeId, _setCurrentGradeId] = useState(() => {
    try { return localStorage.getItem("costa-verde:my-grade") || GRADES[0].id; }
    catch { return GRADES[0].id; }
  });
  const setCurrentGradeId = (id) => {
    _setCurrentGradeId(id);
    try { localStorage.setItem("costa-verde:my-grade", id); } catch {}
    // Auto-advance the viewed programme to whatever is "next" above the
    // freshly set grade, so the user always sees their objectif.
    const idx = GRADES.findIndex((g) => g.id === id);
    if (idx >= 0 && idx < GRADES.length - 1) setSelectedGrade(GRADES[idx + 1].id);
  };
  const [selectedGrade, setSelectedGrade] = useState(() => {
    try {
      const cur = localStorage.getItem("costa-verde:my-grade") || GRADES[0].id;
      const idx = GRADES.findIndex((g) => g.id === cur);
      if (idx >= 0 && idx < GRADES.length - 1) return GRADES[idx + 1].id;
      return cur;
    } catch { return GRADES[1].id; }
  });

  // Keep the draft author in sync with whoever is currently signed in.
  useEffect(() => {
    if (profIdentity) setDraft((d) => ({ ...d, author: profIdentity }));
  }, [profIdentity]);

  // If a new announcement lands while the user is already viewing the
  // Annonces tab, mark it as seen straight away — no leftover red dot.
  useEffect(() => {
    if (tab !== "annonces") return;
    if (latestAnnouncementAt > lastSeenAnnonces) {
      setLastSeenAnnonces(latestAnnouncementAt);
      try { localStorage.setItem(LAST_SEEN_ANNONCES_KEY, String(latestAnnouncementAt)); } catch {}
    }
  }, [tab, latestAnnouncementAt, lastSeenAnnonces]);

  // The Membres tab only exists in prof mode; if the prof signs out while
  // viewing it, slide back to Planning rather than rendering an empty tab.
  useEffect(() => {
    if (tab === "members" && !profMode) setTab("planning");
  }, [tab, profMode]);

  function handleProfToggle() {
    if (!profGateConfigured) {
      setLegacyProfMode((v) => !v);
      return;
    }
    if (profIdentity) {
      setProfIdentity(null);
      persistProf(null);
      return;
    }
    setProfGateOpen(true);
  }

  function handleMemberLogout() {
    if (!licence) return;
    if (!window.confirm("Se déconnecter ? L'app reviendra en mode anonyme — ta fiche reste sauvegardée sur Firestore.")) return;
    setLicence(null);
    persistLicence(null);
  }

  function handleProfAuthenticated(name) {
    setProfIdentity(name);
    persistProf(name);
    setProfGateOpen(false);
  }

  const now = new Date();
  const locationCourses = courses.filter((c) => c.location === location);
  // "Active" courses are the ones that actually run this week — projet
  // d'antenne and one-off cancellations are excluded from "Prochain cours"
  // but still show up in the weekly grid with their status badge.
  const activeCourses = locationCourses.filter(
    (c) => c.status !== "annule" && c.status !== "a-venir",
  );
  const nextCourseSlot = activeCourses
    .map((c) => ({ course: c, when: nextOccurrence(c, now) }))
    .filter((x) => x.when)
    .sort((a, b) => a.when - b.when)[0];
  const locationIsProject =
    locationCourses.length > 0 && activeCourses.length === 0;

  // Flat chronological order from Monday (Lundi → Dimanche), then time.
  // Each card carries its own day chip so we no longer need per-day headers.
  const flatCourses = locationCourses.slice().sort((a, b) => {
    const da = DAY_INDEX[a.day] ?? 99;
    const db = DAY_INDEX[b.day] ?? 99;
    const ordA = da === 0 ? 7 : da;
    const ordB = db === 0 ? 7 : db;
    if (ordA !== ordB) return ordA - ordB;
    return a.start.localeCompare(b.start);
  });

  // Map des appels actifs → ma réponse. Subscribe en temps réel sur la
  // sous-collection /announcements/{id}/responses/{licence}.
  const rollCallIds = announcements
    .filter((a) => a.type === "presence")
    .map((a) => a.id);
  const cloudPresenceResponses = usePresenceResponses(rollCallIds, licence);
  // Agrégat des votes — sert au prof pour voir les compteurs réels.
  const presenceAggregates = usePresenceAggregates(rollCallIds);
  // L'override local prime tant qu'il existe (vote optimiste) ; sinon on
  // affiche la valeur Firestore.
  const presenceResponses = { ...cloudPresenceResponses, ...localPresenceOverride };

  async function respondPresence(id, choice) {
    const current = presenceResponses[id];
    const next = current === choice ? null : choice;
    setLocalPresenceOverride((prev) => ({ ...prev, [id]: next }));
    if (!licence) return; // pas de licence → vote anonyme, pas de persistance
    try {
      await recordPresence({
        rollCallId: String(id),
        userId: String(licence),
        response: next,
      });
      // On enlève l'override : le snapshot Firestore prend le relais.
      setLocalPresenceOverride((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (err) {
      console.error("recordPresence failed:", err);
    }
  }

  const [publishError, setPublishError] = useState(null);
  const [publishing, setPublishing] = useState(false);

  async function launchRollCall() {
    const entry = {
      id: Date.now(),
      type: "presence",
      author: draft.author,
      initials: makeInitials(draft.author),
      date: "Aujourd'hui",
      target: rollCallTarget,
      location: rollCallLocation,
      body: `Qui sera présent au prochain cours — ${rollCallTarget}${rollCallLocation && rollCallLocation !== "Tout le club" ? ` (${rollCallLocation})` : ""} ? Merci de répondre pour préparer le tatami.`,
      baselinePresent: 0,
      baselineAbsent: 0,
    };
    setPublishError(null);
    setPublishing(true);
    try {
      if (firebaseEnabled) {
        await addRollCall(entry);
      } else {
        setLocalAnnouncements([entry, ...localAnnouncements]);
      }
      setCallingRoll(false);
    } catch (err) {
      console.error("launchRollCall failed:", err);
      setPublishError("Échec de l'envoi. Réessaie dans un instant.");
    } finally {
      setPublishing(false);
    }
  }

  async function publish() {
    if (!draft.body.trim()) return;
    const entry = {
      id: Date.now(),
      author: draft.author,
      initials: makeInitials(draft.author),
      date: "Aujourd'hui",
      target: draft.target,
      body: draft.body.trim(),
    };
    setPublishError(null);
    setPublishing(true);
    try {
      if (firebaseEnabled) {
        await addAnnouncement(entry);
      } else {
        setLocalAnnouncements([entry, ...localAnnouncements]);
      }
      setDraft({ ...draft, body: "" });
      setComposing(false);
    } catch (err) {
      console.error("publish failed:", err);
      setPublishError("Échec de l'envoi. Réessaie dans un instant.");
    } finally {
      setPublishing(false);
    }
  }

  async function setCourseProf(courseId, name) {
    try {
      if (firebaseEnabled) {
        await updateCourse(courseId, { prof: name });
      }
    } catch (err) {
      console.error("setCourseProf failed:", err);
    }
  }

  async function handleTogglePin(a) {
    const next = !a.pinned;
    try {
      if (firebaseEnabled) {
        await toggleAnnouncementPin(a.id, next);
      } else {
        setLocalAnnouncements((list) =>
          list.map((x) => (x.id === a.id ? { ...x, pinned: next } : x)),
        );
      }
    } catch (err) {
      console.error("toggle pin failed:", err);
    }
  }

  async function handleDeleteAnnouncement(a) {
    const ok = window.confirm(
      a.type === "presence"
        ? "Supprimer cet appel et toutes les réponses ?"
        : "Supprimer cette annonce ?",
    );
    if (!ok) return;
    try {
      if (firebaseEnabled) {
        await deleteAnnouncement(a.id);
      } else {
        setLocalAnnouncements((list) => list.filter((x) => x.id !== a.id));
      }
    } catch (err) {
      console.error("delete announcement failed:", err);
    }
  }

  return (
    <div className="h-[100dvh] lg:h-screen bg-pine-dark lg:bg-paper-radial flex items-stretch lg:items-center justify-center lg:py-10 overflow-hidden">
      <div className="relative w-full lg:max-w-sm bg-paper h-full lg:h-[760px] lg:rounded-[2.25rem] lg:shadow-device flex flex-col overflow-hidden">
        <div className="hidden lg:block absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-1 rounded-full bg-paper-dark/70 z-10" />

        {/* Banner "déconnecté depuis un autre appareil" — affiché tant que
            l'adhérent n'a pas fermé ou ré-identifié. */}
        {kickedFromDevice && (
          <div className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 right-16 z-30 bg-gold-400/95 text-ink rounded-[14px] shadow-card px-3 py-2 flex items-start gap-2 animate-slide-up">
            <KeyRound size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1 text-[11.5px] leading-snug">
              <strong>Connecté ailleurs.</strong> Cet appareil a été déconnecté de ton compte. Ré-identifie-toi pour revenir.
            </div>
            <button
              type="button"
              onClick={() => setKickedFromDevice(false)}
              className="shrink-0 w-6 h-6 rounded-full bg-cream/40 flex items-center justify-center"
              title="Fermer"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Floating prof key — top-right, above content, persists across tabs. */}
        <button
          onClick={handleProfToggle}
          className={`absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 z-30 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            profMode
              ? "bg-pine text-paper shadow-card"
              : "bg-paper-card text-ink-muted border border-[rgba(34,30,24,0.07)] hover:text-pine"
          }`}
          title={
            profMode
              ? `Connecté en tant que ${profIdentity ?? "prof"} — cliquer pour quitter`
              : "Entrer en mode prof"
          }
        >
          {profMode ? <LogOut size={15} strokeWidth={2} /> : <KeyRound size={15} strokeWidth={1.6} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none">
          {tab === "planning" ? (
            <div key="planning" className="px-5 pt-[calc(env(safe-area-inset-top)+3.75rem)] pb-7 animate-slide-in-right">
              {/* Header — overline + Spectral title + subtitle + kanji column */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase">
                    Kanjo Aïkido Isulanu
                  </div>
                  <div className="font-serif text-[36px] font-semibold leading-none mt-2 text-ink">
                    Planning
                  </div>
                  <div className="text-[13px] text-ink-soft mt-1.5">
                    {location} · Saison 2025–26
                  </div>
                </div>
                <div className="kanji-column text-[15px] leading-tight text-center text-pine/30 mt-1 pr-1 select-none">
                  合気道
                </div>
              </div>

              {/* Location selector — masqué s'il n'y a qu'un seul lieu. */}
              {LOCATIONS.length > 1 && (
              <div className="flex gap-2 mt-5 overflow-x-auto scrollbar-none -mx-1 px-1">
                {LOCATIONS.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setLocation(loc)}
                    className={`flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-1.5 rounded-full border shrink-0 transition-colors ${
                      location === loc
                        ? "bg-pine text-paper border-pine"
                        : "bg-paper-card text-ink-muted border-[rgba(34,30,24,0.07)]"
                    }`}
                  >
                    <MapPin size={11} />
                    {loc}
                  </button>
                ))}
              </div>
              )}

              {/* Prochain cours hero */}
              {nextCourseSlot ? (
                <div className="mt-[22px] relative rounded-[24px] bg-hero-pine text-cream p-[22px] overflow-hidden shadow-heroDark animate-slide-up">
                  <div aria-hidden className="kanji-watermark absolute -right-1.5 -bottom-6 text-[104px] leading-none text-gold-400/15">
                    道
                  </div>
                  <div className="relative">
                    <div className="text-[10.5px] font-bold tracking-section text-gold-400 uppercase">
                      Prochain cours · {relativeDayLabel(nextCourseSlot.when, now)}
                    </div>
                    <div className="flex items-baseline gap-2.5 mt-3">
                      <div className="font-serif text-[44px] font-semibold leading-none tabular-nums">
                        {nextCourseSlot.course.start}
                      </div>
                      <div className="text-[14px] text-cream/65 tabular-nums">
                        → {nextCourseSlot.course.end}
                      </div>
                    </div>
                    <div className="font-serif text-[21px] mt-1.5">
                      {nextCourseSlot.course.title}
                    </div>
                    <div className="flex flex-wrap gap-3.5 mt-4 text-[12.5px] text-cream/80">
                      <span>◦  {DOJO_INFO.name}</span>
                      <span>◦  {location}</span>
                      <span>◦  {nextCourseSlot.course.prof === PROF_PLACEHOLDER ? "À confirmer" : nextCourseSlot.course.prof}</span>
                    </div>
                  </div>
                </div>
              ) : locationIsProject ? (
                <div className="mt-[22px] relative rounded-[20px] bg-paper-card border border-dashed border-ink-muted/40 p-5 text-center">
                  <div className="text-[10.5px] font-bold tracking-section text-gold uppercase mb-1.5">
                    Antenne en projet
                  </div>
                  <div className="text-[12.5px] text-ink-soft leading-relaxed">
                    Cette antenne n'est pas encore active. Les créneaux
                    ci-dessous sont envisagés mais pas confirmés.
                  </div>
                </div>
              ) : null}

              {/* La semaine */}
              <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mt-7 mb-3.5 px-0.5">
                La semaine
              </div>
              {flatCourses.length === 0 ? (
                <div className="text-center py-12 text-ink-muted text-sm">
                  Aucun cours prévu à ce lieu pour l'instant.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {flatCourses.map((c) => (
                    <CourseCard key={c.id} c={c} profMode={profMode} onProfChange={setCourseProf} />
                  ))}
                </div>
              )}

              {/* Stages — n'affiche que les stages encore d'actualité
                  (avant la fin, ou le jour-même de la date unique).
                  Auto-masqués dès le lendemain de la fin. */}
              {(() => {
                const liveStages = stages
                  .map((s) => {
                    const sMs = timestampMillis(s.date);
                    const eMs = timestampMillis(s.endDate) || sMs;
                    return { ...s, _start: sMs, _end: eMs };
                  })
                  .filter((s) => s._start > 0 && Date.now() < s._end + 86400000)
                  .sort((a, b) => a._start - b._start);
                if (liveStages.length === 0) return null;
                return (
                  <>
                    <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mt-7 mb-3.5 px-0.5 flex items-center gap-2">
                      <Award size={11} className="text-gold" />
                      Stages à venir
                    </div>
                    <div className="flex flex-col gap-3">
                      {liveStages.map((s) => {
                        const start = new Date(s._start);
                        const end = new Date(s._end);
                        const multi = s.endDate && !isSameLocalDay(s._start, s._end);
                        const dateLabel = multi
                          ? `Du ${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
                          : start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                        return (
                          <div key={s.id} className="bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[18px] overflow-hidden shadow-card">
                            {s.afficheUrl && (
                              <a href={s.afficheUrl} target="_blank" rel="noreferrer" className="block bg-paper">
                                <img src={s.afficheUrl} alt={`Affiche — ${s.title}`} loading="lazy" className="w-full max-h-60 object-contain" />
                              </a>
                            )}
                            <div className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className={`text-[10px] font-bold tracking-section uppercase rounded-full px-2 py-0.5 ${
                                  s.type === "dojo" ? "bg-pine/10 text-pine border border-pine/30" : "bg-gold/15 text-gold border border-gold/30"
                                }`}>
                                  {s.type === "dojo" ? "Au dojo" : s.type === "national" ? "National" : "International"}
                                </div>
                                <div className="text-[11px] text-ink-muted tabular-nums">{dateLabel}</div>
                              </div>
                              <div className="font-serif text-[16px] font-semibold text-ink mt-1.5 leading-tight">{s.title}</div>
                              {s.instructor && (
                                <div className="text-[12px] text-ink-soft mt-0.5">Avec {s.instructor}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : tab === "annonces" ? (
            <div key="annonces" className="px-5 pt-[calc(env(safe-area-inset-top)+3.75rem)] pb-7 animate-slide-in-right">
              {/* Header */}
              <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase">
                Le mur du dojo
              </div>
              <div className="font-serif text-[36px] font-semibold leading-none mt-2 text-ink">
                Annonces
              </div>
              <div className="text-[13px] text-ink-soft mt-1.5">
                Communications du bureau & des enseignants
              </div>

              {push.canPrompt && (
                <button
                  onClick={push.enable}
                  disabled={push.busy}
                  className="w-full mt-5 flex items-center gap-3 text-left bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[18px] px-4 py-3 shadow-card transition-colors hover:border-pine/30 disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-full bg-pine flex items-center justify-center shrink-0">
                    <Bell size={16} className="text-paper" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-[14px] font-semibold text-ink">
                      {push.busy ? "Activation…" : "Activer les notifications"}
                    </div>
                    <div className="text-[12px] text-ink-soft leading-snug mt-0.5">
                      Être prévenu dès qu'une annonce est publiée.
                    </div>
                  </div>
                </button>
              )}
              {profMode && (
                <div className="mt-5">
                  {!composing && !callingRoll ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          onClick={() => setComposing(true)}
                          className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-paper bg-pine rounded-[14px] py-3 shadow-card transition-transform active:scale-[0.98]"
                        >
                          <Plus size={14} />
                          Annonce
                        </button>
                        <button
                          onClick={() => setCallingRoll(true)}
                          className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-pine bg-gold-400/30 border border-gold/50 rounded-[14px] py-3 shadow-card transition-transform active:scale-[0.98]"
                        >
                          <ClipboardCheck size={14} />
                          Faire l'appel
                        </button>
                      </div>
                      <button
                        onClick={() => setStageOpen(true)}
                        className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-gold bg-paper-card border border-gold/40 rounded-[14px] py-3 shadow-card transition-transform active:scale-[0.98]"
                      >
                        <Award size={14} />
                        Annoncer un stage
                      </button>
                    </>
                  ) : callingRoll ? (
                    <div className="bg-paper-card border border-gold/40 rounded-[18px] p-4 space-y-3 shadow-card animate-slide-up">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-seal text-gold uppercase">
                        <ClipboardCheck size={12} />
                        Faire l'appel
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={draft.author}
                          onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                          className="text-[12.5px] border border-[rgba(34,30,24,0.12)] rounded-lg px-2.5 py-2 flex-1 bg-paper focus:outline-none focus:border-pine"
                        >
                          {PROFS.map((p) => <option key={p}>{p}</option>)}
                        </select>
                        <select
                          value={rollCallTarget}
                          onChange={(e) => setRollCallTarget(e.target.value)}
                          className="text-[12.5px] border border-[rgba(34,30,24,0.12)] rounded-lg px-2.5 py-2 flex-1 bg-paper focus:outline-none focus:border-pine"
                        >
                          {ROLL_CALL_TARGETS.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      {LOCATIONS.length > 1 && (
                        <select
                          value={rollCallLocation}
                          onChange={(e) => setRollCallLocation(e.target.value)}
                          className="text-[12.5px] border border-[rgba(34,30,24,0.12)] rounded-lg px-2.5 py-2 w-full bg-paper focus:outline-none focus:border-pine"
                        >
                          <option value="Tout le club">Tous les lieux</option>
                          {LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                      )}
                      <div className="text-[11.5px] text-ink-muted">
                        L'appel n'est envoyé qu'aux adhérents concernés (catégorie{LOCATIONS.length > 1 ? " + lieu de pratique" : ""}).
                      </div>
                      {publishError && (
                        <div className="text-[11.5px] text-vermillion-500 bg-vermillion-50 border border-vermillion-200 rounded-lg px-2.5 py-1.5">
                          {publishError}
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setCallingRoll(false)}
                          className="text-[12.5px] font-semibold text-ink-soft px-3 py-2"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={launchRollCall}
                          disabled={publishing}
                          className="text-[12.5px] font-semibold text-paper bg-pine rounded-lg px-3.5 py-2 flex items-center gap-1.5 shadow-card disabled:opacity-50"
                        >
                          <ClipboardCheck size={12} />
                          {publishing ? "Envoi…" : "Lancer l'appel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[18px] p-4 space-y-3 shadow-card animate-slide-up">
                      <div className="flex gap-2">
                        <select
                          value={draft.author}
                          onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                          className="text-[12.5px] border border-[rgba(34,30,24,0.12)] rounded-lg px-2.5 py-2 flex-1 bg-paper focus:outline-none focus:border-pine"
                        >
                          {PROFS.map((p) => <option key={p}>{p}</option>)}
                        </select>
                        <select
                          value={draft.target}
                          onChange={(e) => setDraft({ ...draft, target: e.target.value })}
                          className="text-[12.5px] border border-[rgba(34,30,24,0.12)] rounded-lg px-2.5 py-2 flex-1 bg-paper focus:outline-none focus:border-pine"
                        >
                          {ROLL_CALL_TARGETS.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <textarea
                        value={draft.body}
                        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                        placeholder="Votre message…"
                        rows={3}
                        style={{ fontSize: 16 }}
                        className="w-full leading-snug border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2 bg-paper resize-none focus:outline-none focus:border-pine"
                      />
                      {publishError && (
                        <div className="text-[11.5px] text-vermillion-500 bg-vermillion-50 border border-vermillion-200 rounded-lg px-2.5 py-1.5">
                          {publishError}
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setComposing(false)}
                          className="text-[12.5px] font-semibold text-ink-soft px-3 py-2"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={publish}
                          disabled={publishing || !draft.body.trim()}
                          className="text-[12.5px] font-semibold text-paper bg-pine rounded-lg px-3.5 py-2 flex items-center gap-1.5 shadow-card disabled:opacity-50"
                        >
                          <Check size={12} />
                          {publishing ? "Envoi…" : "Publier"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {announcements.length === 0 ? (
                <div className="text-center py-16 px-4 animate-fade-in">
                  <Enso className="w-20 h-20 mx-auto mb-4" />
                  <div className="font-serif italic text-[16px] text-ink mb-1.5">
                    Le tatami est silencieux.
                  </div>
                  <div className="text-[12.5px] text-ink-soft leading-relaxed max-w-[230px] mx-auto">
                    {profMode
                      ? "Publie une annonce ou lance un appel — les adhérents la verront dans cet onglet."
                      : "Les enseignants publient ici les infos du club et lancent les appels."}
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mt-7 mb-3.5 px-0.5">
                    Plus récentes
                  </div>
                  <div className="flex flex-col gap-3.5">
                    {announcements.map((a) =>
                      a.type === "presence" ? (
                        <PresenceCard
                          key={a.id}
                          a={a}
                          response={presenceResponses[a.id]}
                          aggregate={presenceAggregates[a.id]}
                          allMembers={allMembers}
                          onRespond={respondPresence}
                          profMode={profMode}
                          isAdmin={isAdmin}
                          onTogglePin={() => handleTogglePin(a)}
                          onDelete={() => handleDeleteAnnouncement(a)}
                        />
                      ) : (
                        <AnnouncementCard
                          key={a.id}
                          a={a}
                          isAdmin={isAdmin}
                          onTogglePin={() => handleTogglePin(a)}
                          onDelete={() => handleDeleteAnnouncement(a)}
                        />
                      ),
                    )}
                  </div>
                </>
              )}
            </div>
          ) : tab === "club" ? (
            <DashboardTab
              member={member}
              profMode={profMode}
              allMembers={allMembers}
              courses={courses}
              announcements={announcements}
              attendanceSessions={attendanceSessions}
              stages={stages}
              location={location}
              onCreateProfile={() => setProfileModalOpen(true)}
              onEditMyGrade={() => member && setMemberEdit(member)}
              onOpenPointage={() => setPointageOpen(true)}
              onOpenStage={() => setStageOpen(true)}
              onMemberLogout={handleMemberLogout}
              onGoToGrade={(gradeId) => {
                if (gradeId) setSelectedGrade(gradeId);
                selectTab("grades");
              }}
            />
          ) : tab === "members" ? (
            <MembersTab
              members={allMembers.filter((m) => !isProfMember(m))}
              onEdit={(m) => setMemberEdit(m)}
              onAdd={() => setAddMemberOpen(true)}
            />
          ) : (
            <GradesTab
              member={member}
              licence={licence}
              fallbackGradeId={currentGradeId}
              setFallbackGradeId={setCurrentGradeId}
              viewedGradeId={selectedGrade}
              setViewedGradeId={setSelectedGrade}
              onCreateProfile={() => setProfileModalOpen(true)}
              profMode={profMode}
              onEditMyGrade={() => member && setMemberEdit(member)}
            />
          )}
        </div>

        {/* Encart iPhone — sur iOS, les notifications exigent d'installer
            l'app sur l'écran d'accueil d'abord. Affiché dans Safari (non
            installé), fermable. */}
        {showIosInstallHint && (
          <div className="shrink-0 flex items-start gap-3 px-5 py-3 bg-gold/10 border-t border-gold/30">
            <span className="shrink-0 w-9 h-9 rounded-full bg-pine flex items-center justify-center">
              <Bell size={17} className="text-paper" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-ink leading-tight">
                Installe l'app pour les notifications
              </div>
              <div className="text-[11.5px] text-ink-soft leading-snug mt-0.5">
                Sur iPhone : touche <strong>Partager</strong> en bas de Safari, puis
                {" "}<strong>« Sur l'écran d'accueil »</strong>. Ouvre ensuite l'app
                depuis son icône pour activer les notifications.
              </div>
            </div>
            <button
              type="button"
              onClick={dismissIosHint}
              className="shrink-0 w-6 h-6 rounded-full bg-cream/20 flex items-center justify-center"
              title="Fermer"
            >
              <X size={11} className="text-ink-soft" />
            </button>
          </div>
        )}

        {/* Bannière d'incitation aux notifications — visible sur tous les
            onglets tant que le membre n'a pas décidé (autorisé / refusé).
            Disparaît d'elle-même une fois le choix fait. */}
        {push.canPrompt && (
          <button
            type="button"
            onClick={push.enable}
            disabled={push.busy}
            className="shrink-0 flex items-center gap-3 px-5 py-3 bg-gold/10 border-t border-gold/30 text-left active:bg-gold/15 transition-colors disabled:opacity-60"
          >
            <span className="shrink-0 w-9 h-9 rounded-full bg-pine flex items-center justify-center">
              <Bell size={17} className="text-paper" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-bold text-ink leading-tight">
                {push.busy ? "Activation…" : "Active les notifications"}
              </span>
              <span className="block text-[11.5px] text-ink-soft leading-snug mt-0.5">
                Sois prévenu des appels et annonces du dojo.
              </span>
            </span>
          </button>
        )}

        {/* Bottom nav — dark pine gradient + gold accent. shrink-0 +
            max-w pour ne pas s'étendre démesurément sur tablette /
            desktop, sinon les onglets se retrouvent espacés à
            l'infini sur un iPad. */}
        <div className="shrink-0 bg-tabbar-pine border-t border-[rgba(201,168,106,0.22)] px-1.5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex justify-center">
          {[
            { id: "club", label: "Dashboard", Icon: LayoutDashboard },
            { id: "annonces", label: "Annonces", Icon: Megaphone, badge: hasUnreadAnnonces },
            { id: "planning", label: "Planning", Icon: Calendar },
            { id: "progression", label: "Grades", Icon: Award },
            ...(profMode ? [{ id: "members", label: "Membres", Icon: Users }] : []),
          ].map(({ id, label, Icon, badge }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => selectTab(id)}
                className={`relative flex flex-col items-center gap-1.5 flex-1 py-1 transition-colors ${
                  active ? "text-gold-400" : "text-[rgba(241,233,218,0.5)]"
                }`}
              >
                <Icon size={22} strokeWidth={1.6} />
                <span className="text-[10px] font-bold tracking-[0.02em]">{label}</span>
                {badge && (
                  <span className="absolute top-1 right-[calc(50%-16px)] w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse-dot" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {push.toast && (
        <button
          onClick={push.dismissToast}
          className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] left-3 right-3 z-40 flex items-start gap-2.5 text-left bg-night text-sand-50 rounded-2xl px-3.5 py-3 shadow-device animate-slide-up"
        >
          <div className="w-8 h-8 rounded-full bg-vermillion-500 flex items-center justify-center shrink-0">
            <Bell size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-[12.5px] font-semibold truncate">
              {push.toast.title}
            </div>
            {push.toast.body && (
              <div className="text-[11.5px] text-sand-300 leading-snug line-clamp-2">
                {push.toast.body}
              </div>
            )}
          </div>
        </button>
      )}

      {profGateOpen && (
        <ProfGateModal
          onAuthenticated={handleProfAuthenticated}
          onClose={() => setProfGateOpen(false)}
        />
      )}

      {profileModalOpen && (
        <ProfileModal
          initialLicence={member ? licence : ""}
          initialFirstName={member?.firstName || ""}
          initialLastName={member?.lastName || ""}
          onClose={() => setProfileModalOpen(false)}
          onSave={async ({ licence: lic, firstName, lastName }) => {
            await createOrUpdateMember(lic, { firstName, lastName });
            // Revendique cet appareil — l'éventuel ancien téléphone
            // recevra le snapshot et se déconnectera tout seul.
            await claimDevice(lic, getDeviceId());
            setLicence(lic);
            persistLicence(lic);
            setKickedFromDevice(false);
            setProfileModalOpen(false);
          }}
        />
      )}

      {memberEdit && (
        <GradePickerModal
          member={memberEdit}
          onClose={() => setMemberEdit(null)}
          onSave={async ({ grade, obtainedAt, birthYM, practiceLocations, manualBadges }) => {
            await assignGrade(memberEdit.id, grade, obtainedAt, birthYM, practiceLocations);
            if (Array.isArray(manualBadges)) {
              await setMemberManualBadges(memberEdit.id, manualBadges);
            }
            setMemberEdit(null);
          }}
          onLeave={async () => {
            await markMemberLeft(memberEdit.id);
            setMemberEdit(null);
          }}
        />
      )}

      {addMemberOpen && (
        <AddMemberModal
          onClose={() => setAddMemberOpen(false)}
          onSave={async ({ licence: lic, firstName, lastName, grade, gradeObtainedAt, birthYM, practiceLocations }) => {
            await createOrUpdateMember(lic, { firstName, lastName, grade, gradeObtainedAt, birthYM, practiceLocations });
            setAddMemberOpen(false);
          }}
        />
      )}

      {pointageOpen && (
        <PointageModal
          courses={courses}
          members={allMembers}
          sessions={attendanceSessions}
          prof={profIdentity || PROFS[0]}
          onClose={() => setPointageOpen(false)}
          onSave={() => setPointageOpen(false)}
        />
      )}

      {stageOpen && (
        <StageModal
          prof={profIdentity || PROFS[0]}
          onClose={() => setStageOpen(false)}
          onSave={() => setStageOpen(false)}
        />
      )}
    </div>
  );
}

function ProfileModal({ initialLicence, initialFirstName, initialLastName, onSave, onClose }) {
  const [licence, setLicence] = useState(initialLicence || "");
  const [firstName, setFirstName] = useState(initialFirstName || "");
  const [lastName, setLastName] = useState(initialLastName || "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // After the user types a licence, we check Firestore to see whether the
  // prof has already created their card. If so, we switch to identification
  // mode: just confirm, the name is pulled from the existing doc.
  const [lookup, setLookup] = useState(null); // null | "checking" | { found: bool, member?: ... }

  // Debounced Firestore lookup on the licence field.
  useEffect(() => {
    const lic = licence.trim();
    if (!lic || initialLicence) {
      setLookup(null);
      return undefined;
    }
    setLookup("checking");
    const t = setTimeout(async () => {
      try {
        const m = await fetchMember(lic);
        setLookup({ found: Boolean(m), member: m });
        if (m) {
          if (m.firstName) setFirstName(m.firstName);
          if (m.lastName) setLastName(m.lastName);
        }
      } catch {
        setLookup(null);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [licence, initialLicence]);

  const found = lookup && lookup.found;

  async function submit(e) {
    e.preventDefault();
    const lic = licence.trim();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!lic) {
      setError("Le numéro de licence est obligatoire.");
      return;
    }
    // Identification mode: a prof already pre-filled the doc → we only need
    // the licence to link the device. Names come from Firestore.
    if (!found && (!fn || !ln)) {
      setError("Renseigne ton prénom et nom (ta fiche n'existe pas encore).");
      return;
    }
    setBusy(true);
    try {
      await onSave({ licence: lic, firstName: fn, lastName: ln });
    } catch (err) {
      console.error("createOrUpdateMember failed:", err);
      setError("Échec — réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-night/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 pt-[max(env(safe-area-inset-top),1rem)] sm:pt-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper-card w-full max-w-sm rounded-[20px] shadow-device border border-[rgba(34,30,24,0.07)] p-5 space-y-4 animate-slide-up"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-pine flex items-center justify-center shrink-0">
            <UserPlus size={17} className="text-paper" />
          </div>
          <div className="flex-1">
            <div className="font-serif text-[17px] font-semibold text-ink leading-tight">
              {initialLicence ? "Modifier mon profil" : found ? "S'identifier" : "Créer mon profil"}
            </div>
            <div className="text-[12px] text-ink-soft mt-0.5 leading-snug">
              {found
                ? "Ta fiche existe déjà — confirme pour la lier à cet appareil."
                : "Si l'enseignant a déjà créé ta fiche, ton nom sera récupéré automatiquement."}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
              N° de licence FFAB
            </label>
            <input
              autoFocus={!initialLicence}
              inputMode="numeric"
              value={licence}
              disabled={Boolean(initialLicence)}
              onChange={(e) => { setLicence(e.target.value); setError(null); }}
              placeholder="1234567"
              style={{ fontSize: 16 }}
              className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine disabled:opacity-60"
            />
            {lookup === "checking" && (
              <div className="text-[11px] text-ink-muted mt-1.5 italic">Vérification…</div>
            )}
            {found && (
              <div className="text-[11.5px] text-pine bg-pine/5 border border-pine/20 rounded-lg px-2.5 py-1.5 mt-1.5">
                Fiche trouvée — bienvenue {lookup.member.firstName} !
              </div>
            )}
          </div>
          {!found && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Prénom</label>
                <input
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setError(null); }}
                  placeholder="Marie"
                  style={{ fontSize: 16 }}
                  className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Nom</label>
                <input
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setError(null); }}
                  placeholder="Dubois"
                  style={{ fontSize: 16 }}
                  className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="text-[11.5px] text-vermillion-500 bg-vermillion-50 border border-vermillion-200 rounded-lg px-2.5 py-1.5">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-[12.5px] font-semibold text-ink-soft px-3 py-2"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className="text-[12.5px] font-semibold text-paper bg-pine rounded-lg px-4 py-2 flex items-center gap-1.5 shadow-card disabled:opacity-50"
          >
            <Check size={14} />
            {busy ? "…" : found ? "S'identifier" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AddMemberModal({ onSave, onClose }) {
  const [licence, setLicence] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [grade, setGrade] = useState(GRADES[0].id);
  const [dateInput, setDateInput] = useState(timestampToDateInput(null));
  const [birthYM, setBirthYM] = useState("");
  // Par défaut : on coche le dojo de Vescovato. Le prof peut ajuster
  // selon le membre.
  const [practiceLocations, setPracticeLocations] = useState(["Vescovato"]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const cat = ageCategory(birthYM);
  const yrs = ageInYears(birthYM);

  function toggleLocation(loc) {
    setPracticeLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
    );
  }

  async function submit(e) {
    e.preventDefault();
    const lic = licence.trim();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!lic || !fn || !ln) {
      setError("Le n° de licence, le prénom et le nom sont obligatoires.");
      return;
    }
    if (practiceLocations.length === 0) {
      setError("Choisis au moins un lieu de pratique.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        licence: lic,
        firstName: fn,
        lastName: ln,
        grade,
        gradeObtainedAt: dateInputToDate(dateInput),
        birthYM: birthYM || null,
        practiceLocations,
      });
    } catch (err) {
      console.error("addMember failed:", err);
      setError("Échec — la licence est peut-être déjà utilisée.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-night/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 pt-[max(env(safe-area-inset-top),1rem)] sm:pt-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper-card w-full max-w-sm rounded-[20px] shadow-device border border-[rgba(34,30,24,0.07)] p-5 space-y-4 animate-slide-up"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-pine flex items-center justify-center shrink-0">
            <UserPlus size={17} className="text-paper" />
          </div>
          <div className="flex-1">
            <div className="font-serif text-[17px] font-semibold text-ink leading-tight">
              Ajouter un adhérent
            </div>
            <div className="text-[12px] text-ink-soft mt-0.5 leading-snug">
              L'adhérent pourra ensuite s'identifier sur son téléphone avec son n° de licence.
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
              N° de licence FFAB
            </label>
            <input
              autoFocus
              inputMode="numeric"
              value={licence}
              onChange={(e) => { setLicence(e.target.value); setError(null); }}
              placeholder="1234567"
              style={{ fontSize: 16 }}
              className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Prénom</label>
              <input
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setError(null); }}
                placeholder="Marie"
                style={{ fontSize: 16 }}
                className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Nom</label>
              <input
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setError(null); }}
                placeholder="Dubois"
                style={{ fontSize: 16 }}
                className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Grade initial</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                style={{ fontSize: 16 }}
                className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
              >
                {GRADES.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Obtenu le</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                max={timestampToDateInput(null)}
                style={{ fontSize: 16 }}
                className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
              />
            </div>
          </div>
          <div>
            <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
              Mois de naissance <span className="text-ink-muted font-normal normal-case tracking-normal">(optionnel)</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="month"
                value={birthYM}
                onChange={(e) => setBirthYM(e.target.value)}
                max={new Date().toISOString().slice(0, 7)}
                style={{ fontSize: 16 }}
                className="flex-1 min-w-0 border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
              />
              {cat && (
                <div
                  className={`text-[10.5px] font-bold tracking-section uppercase rounded-full px-2.5 py-1 shrink-0 ${
                    cat === "enfant"
                      ? "bg-gold/15 text-gold border border-gold/30"
                      : "bg-pine/10 text-pine border border-pine/30"
                  }`}
                >
                  {cat} · {yrs} ans
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
              Lieux de pratique
            </label>
            <div className="mt-1 flex gap-2">
              {LOCATIONS.map((loc) => {
                const checked = practiceLocations.includes(loc);
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => toggleLocation(loc)}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-lg px-2 py-2 border transition-colors ${
                      checked
                        ? "bg-pine text-paper border-pine shadow-card"
                        : "bg-paper text-ink-muted border-[rgba(34,30,24,0.12)]"
                    }`}
                  >
                    <MapPin size={12} />
                    {loc.replace("Santa Maria Poggio", "Santa Maria")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="text-[11.5px] text-vermillion-500 bg-vermillion-50 border border-vermillion-200 rounded-lg px-2.5 py-1.5">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-[12.5px] font-semibold text-ink-soft px-3 py-2"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className="text-[12.5px] font-semibold text-paper bg-pine rounded-lg px-4 py-2 flex items-center gap-1.5 shadow-card disabled:opacity-50"
          >
            <Check size={14} />
            {busy ? "Création…" : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PointageModal({ courses, members: allMembers, sessions, prof, onSave, onClose }) {
  // Les profs ne sont pas pointés — on les retire de la liste affichée.
  const membersWithoutProfs = allMembers.filter((m) => !isProfMember(m));
  // Auto-detect the closest cours to "now" (active courses only).
  // Falls back to the first active course if nothing is nearby.
  const allActiveCourses = courses.filter(
    (c) => c.status !== "annule" && c.status !== "a-venir",
  );
  const now = new Date();
  const closest = allActiveCourses
    .map((c) => {
      const when = nextOccurrence(c, now);
      const ms = when ? when.getTime() - now.getTime() : Infinity;
      return { course: c, when, ms: Math.abs(ms) };
    })
    .sort((a, b) => a.ms - b.ms)[0];
  // Filtre lieu : on démarre sur le lieu du cours le plus proche dans le
  // temps. Le prof peut basculer pour pointer un autre dojo.
  const [locationFilter, setLocationFilter] = useState(
    closest?.course?.location ?? LOCATIONS[0],
  );
  const activeCourses = allActiveCourses.filter((c) => c.location === locationFilter);
  // On garde l'id en string : Firestore renvoie `d.id` en string alors que
  // le seed local utilise des numbers — sans coercition, une comparaison
  // stricte fait passer le selectedCourse en silence sur activeCourses[0].
  const [selectedCourseId, setSelectedCourseId] = useState(() => {
    const fallback = closest?.course?.id ?? allActiveCourses[0]?.id ?? null;
    return fallback == null ? null : String(fallback);
  });
  // Si le prof change de lieu et que le cours actuel n'y est pas, on
  // bascule sur le premier cours du nouveau lieu.
  useEffect(() => {
    const stillIn = activeCourses.some((c) => String(c.id) === selectedCourseId);
    if (!stillIn && activeCourses.length > 0) {
      setSelectedCourseId(String(activeCourses[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationFilter]);
  // Map memberId → "present" | "absent" | undefined.
  const [states, setStates] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // editingSessionId : id de la session déjà enregistrée que le prof est
  // en train de corriger. Quand non null, on écrit par-dessus au submit.
  const [editingSessionId, setEditingSessionId] = useState(null);

  const selectedCourse = activeCourses.find((c) => String(c.id) === selectedCourseId) || activeCourses[0];

  // Existing pointage for the same course on the same calendar day?
  // Le prof peut le corriger en cliquant sur "Corriger" — sinon la modale
  // reste en lecture seule pour éviter le double comptage.
  const todayMs = Date.now();
  const existingSession = (sessions || []).find(
    (s) => String(s.courseId) === String(selectedCourse?.id) && isSameLocalDay(timestampMillis(s.date), todayMs),
  );
  const editing = Boolean(existingSession) && existingSession.id === editingSessionId;
  const locked = Boolean(existingSession) && !editing;
  const existingPresent = existingSession ? (existingSession.presentIds || []).length : 0;
  const existingAbsent = existingSession ? (existingSession.absentIds || []).length : 0;
  const existingTime = existingSession
    ? new Date(timestampMillis(existingSession.date)).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Si le prof change de cours pendant l'édition, on sort du mode édition
  // pour ne pas écraser la mauvaise session par accident.
  useEffect(() => {
    if (editingSessionId && existingSession?.id !== editingSessionId) {
      setEditingSessionId(null);
      setStates({});
    }
  }, [editingSessionId, existingSession?.id]);

  function startEditing() {
    if (!existingSession) return;
    const prefilled = {};
    for (const id of existingSession.presentIds || []) prefilled[id] = "present";
    for (const id of existingSession.absentIds || []) prefilled[id] = "absent";
    setStates(prefilled);
    setEditingSessionId(existingSession.id);
    setError(null);
  }

  function cancelEditing() {
    setEditingSessionId(null);
    setStates({});
    setError(null);
  }

  async function handleDelete() {
    if (!existingSession) return;
    if (!window.confirm("Supprimer ce pointage ? Les présences enregistrées seront effacées et le pointage redeviendra possible.")) return;
    setBusy(true);
    try {
      await deleteAttendance(existingSession.id);
      setEditingSessionId(null);
      setStates({});
    } catch (err) {
      console.error("deleteAttendance failed:", err);
      setError("Échec de la suppression.");
    } finally {
      setBusy(false);
    }
  }

  // Filtre d'audience selon le cours : adultes/aïkitaïso → on retire les
  // enfants (< ADULT_AGE_THRESHOLD ans). Pour cours enfants : que les
  // enfants. Les fiches sans date de naissance restent visibles dans
  // tous les cas (le prof tranche).
  const audience = courseAudience(selectedCourse);
  const members = membersWithoutProfs.filter((m) => {
    // Filtre lieu : on n'affiche que les membres qui pratiquent au lieu
    // sélectionné. Les fiches sans `practiceLocations` (anciennes ou
    // mal renseignées) restent visibles pour ne pas perdre personne.
    const locs = Array.isArray(m.practiceLocations) && m.practiceLocations.length > 0
      ? m.practiceLocations
      : null;
    if (locs && !locs.includes(locationFilter)) return false;
    const cat = ageCategory(m.birthYM);
    if (!cat) return true;
    if (audience === "adultes") return cat === "adulte";
    if (audience === "enfants") return cat === "enfant";
    return true;
  });

  function toggle(memberId, state) {
    if (locked) return;
    setStates((prev) => ({
      ...prev,
      [memberId]: prev[memberId] === state ? undefined : state,
    }));
  }

  function quickAll(state) {
    if (locked) return;
    const next = {};
    for (const m of members) next[m.id] = state;
    setStates(next);
  }

  const stats = members.reduce(
    (acc, m) => {
      const s = states[m.id];
      if (s === "present") acc.present++;
      else if (s === "absent") acc.absent++;
      else acc.unset++;
      return acc;
    },
    { present: 0, absent: 0, unset: 0 },
  );

  async function submit() {
    if (locked) return;
    if (!selectedCourse) {
      setError("Choisis un cours.");
      return;
    }
    if (stats.present === 0 && stats.absent === 0) {
      setError("Coche au moins un élève en présent ou absent.");
      return;
    }
    setBusy(true);
    try {
      const presentIds = members.filter((m) => states[m.id] === "present").map((m) => m.id);
      const absentIds = members.filter((m) => states[m.id] === "absent").map((m) => m.id);
      if (editing) {
        await updateAttendance(existingSession.id, {
          presentIds,
          absentIds,
          correctedBy: prof || "Prof",
        });
      } else {
        await recordAttendance({
          courseId: selectedCourse.id,
          courseTitle: selectedCourse.title,
          location: selectedCourse.location,
          day: selectedCourse.day,
          start: selectedCourse.start,
          prof: prof || "Prof",
          presentIds,
          absentIds,
        });
      }
      onSave();
    } catch (err) {
      console.error("recordAttendance failed:", err);
      setError(editing ? "Échec de la correction." : "Échec de l'enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-night/50 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper-card w-full sm:max-w-md sm:rounded-[20px] shadow-device border border-[rgba(34,30,24,0.07)] flex flex-col h-full sm:h-[85vh] animate-slide-up overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-5 pb-4 border-b border-[rgba(34,30,24,0.07)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-bold tracking-section text-gold uppercase">
                Pointage
              </div>
              <div className="font-serif text-[20px] font-semibold leading-tight mt-1 text-ink">
                Faire l'appel
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-full bg-paper border border-[rgba(34,30,24,0.07)] flex items-center justify-center"
            >
              <X size={15} className="text-ink-soft" />
            </button>
          </div>

          {/* Sélecteur de lieu — on pointe soit Santa Maria soit Vescovato,
              jamais les deux en même temps. */}
          {LOCATIONS.length > 1 && (
          <div className="mt-3 flex gap-1.5">
            {LOCATIONS.map((loc) => {
              const active = locationFilter === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocationFilter(loc)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-[11.5px] font-semibold rounded-full px-3 py-1.5 transition-colors border ${
                    active
                      ? "bg-pine text-paper border-pine shadow-card"
                      : "bg-paper-card text-ink-soft border-[rgba(34,30,24,0.12)]"
                  }`}
                >
                  <MapPin size={11} />
                  {loc.replace("Santa Maria Poggio", "Santa Maria")}
                </button>
              );
            })}
          </div>
          )}

          {/* Cours selector — filtré par le lieu choisi au-dessus. */}
          <label className="block mt-3">
            <div className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase mb-1.5">
              Cours
            </div>
            {activeCourses.length === 0 ? (
              <div className="text-[12px] text-ink-muted italic border border-dashed border-[rgba(34,30,24,0.18)] rounded-lg px-3 py-2.5">
                Aucun cours actif à {locationFilter} pour l'instant.
              </div>
            ) : (
              <select
                value={selectedCourseId ?? ""}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                style={{ fontSize: 16 }}
                className="w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
              >
                {activeCourses.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.day} {c.start} — {c.title}
                  </option>
                ))}
              </select>
            )}
          </label>

          {/* Stats + quick actions */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-[12px] text-ink-soft tabular-nums">
              {locked ? (
                <>
                  <span className="text-pine font-semibold">{existingPresent}</span> présents ·{" "}
                  <span className="text-vermillion-500 font-semibold">{existingAbsent}</span> absents
                </>
              ) : (
                <>
                  <span className="text-pine font-semibold">{stats.present}</span> présents ·{" "}
                  <span className="text-vermillion-500 font-semibold">{stats.absent}</span> absents
                  {stats.unset > 0 && ` · ${stats.unset} non pointés`}
                </>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => quickAll("present")}
                disabled={locked}
                className="text-[11px] font-semibold text-pine border border-pine/40 rounded-full px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Tout ✓
              </button>
              <button
                onClick={() => setStates({})}
                disabled={locked}
                className="text-[11px] font-semibold text-ink-muted border border-[rgba(34,30,24,0.12)] rounded-full px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Verrou — déjà pointé aujourd'hui pour ce cours. Le prof peut
              corriger (écrase les listes) ou supprimer pour repartir
              de zéro. */}
          {locked && (
            <div className="mt-3 rounded-[12px] bg-gold-400/10 border border-gold/30 px-3 py-2.5 space-y-2">
              <div className="flex items-start gap-2.5">
                <KeyRound size={14} className="text-gold mt-0.5 shrink-0" />
                <div className="text-[12px] text-ink leading-snug flex-1">
                  <strong className="text-ink">Déjà pointé</strong> par{" "}
                  <strong className="text-ink">{existingSession?.prof || "un autre prof"}</strong>
                  {existingTime ? ` à ${existingTime}` : ""}.
                  {existingSession?.correctedBy && (
                    <span className="text-ink-soft">
                      {" "}· corrigé par {existingSession.correctedBy}.
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startEditing}
                  className="text-[11.5px] font-semibold text-pine bg-paper-card border border-pine/30 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-card"
                >
                  <Pencil size={11} />
                  Corriger
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy}
                  className="text-[11.5px] font-semibold text-vermillion-500 border border-vermillion-200 bg-paper rounded-full px-3 py-1 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 size={11} />
                  Supprimer
                </button>
              </div>
            </div>
          )}

          {/* Banner d'édition — quand le prof corrige le pointage. */}
          {editing && (
            <div className="mt-3 rounded-[12px] bg-pine/5 border border-pine/30 px-3 py-2.5 flex items-start gap-2.5">
              <Pencil size={13} className="text-pine mt-0.5 shrink-0" />
              <div className="text-[12px] text-ink leading-snug flex-1">
                <strong className="text-ink">Correction</strong> du pointage de{" "}
                <strong className="text-ink">{existingSession?.prof || "—"}</strong>
                {existingTime ? ` (${existingTime})` : ""}. Tes modifications écrasent les présences enregistrées.
              </div>
              <button
                type="button"
                onClick={cancelEditing}
                className="shrink-0 text-[11px] font-semibold text-ink-soft underline"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-none">
          {members.length === 0 ? (
            <div className="text-center py-12 px-4 text-[12.5px] text-ink-muted italic">
              {audience === "adultes"
                ? "Aucun adulte sur la liste pour ce cours."
                : audience === "enfants"
                ? "Aucun enfant sur la liste pour ce cours."
                : "Aucun adhérent enregistré — ajoute des membres dans l'onglet Membres."}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {members.map((m) => {
                // En lecture seule : on s'appuie sur les listes enregistrées.
                const state = locked
                  ? (existingSession.presentIds || []).includes(m.id)
                    ? "present"
                    : (existingSession.absentIds || []).includes(m.id)
                    ? "absent"
                    : undefined
                  : states[m.id];
                const g = GRADES.find((x) => x.id === m.grade);
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 rounded-[12px] px-2.5 py-2 transition-colors ${
                      state === "present"
                        ? "bg-pine/5 ring-1 ring-pine/20"
                        : state === "absent"
                        ? "bg-vermillion-50 ring-1 ring-vermillion-200"
                        : "bg-paper"
                    } ${locked ? "opacity-90" : ""}`}
                  >
                    <div
                      className="w-[22px] h-[10px] rounded shrink-0 ring-1 ring-[rgba(241,232,210,0.45)]"
                      style={{ backgroundColor: BELT_COLOR[m.grade] || "#FFFFFF" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-[14px] font-semibold text-ink leading-tight">
                        {m.firstName} {m.lastName}
                      </div>
                      <div className="text-[10.5px] text-ink-muted">
                        {g?.label || "—"}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggle(m.id, "present")}
                        disabled={locked}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                          state === "present"
                            ? "bg-pine text-paper"
                            : "bg-paper border border-[rgba(34,30,24,0.12)] text-ink-muted"
                        } ${locked ? "cursor-not-allowed" : ""}`}
                        title="Présent"
                      >
                        <Check size={16} strokeWidth={2.4} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(m.id, "absent")}
                        disabled={locked}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                          state === "absent"
                            ? "bg-vermillion-500 text-cream"
                            : "bg-paper border border-[rgba(34,30,24,0.12)] text-ink-muted"
                        } ${locked ? "cursor-not-allowed" : ""}`}
                        title="Absent"
                      >
                        <X size={16} strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[rgba(34,30,24,0.07)] px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] bg-paper-card flex items-center justify-between gap-3">
          {error && (
            <div className="text-[11.5px] text-vermillion-500 flex-1">{error}</div>
          )}
          {!error && (
            <div className="text-[11px] text-ink-muted flex-1">
              {selectedCourse
                ? `${selectedCourse.day} ${selectedCourse.start} · ${selectedCourse.title}`
                : ""}
            </div>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy || locked}
            className="text-[12.5px] font-semibold text-paper bg-pine rounded-lg px-4 py-2.5 flex items-center gap-1.5 shadow-card disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardList size={14} />
            {locked
              ? "Verrouillé"
              : busy
              ? "Enregistrement…"
              : editing
              ? "Enregistrer la correction"
              : "Valider l'appel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StageModal({ prof, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("dojo");
  const [instructor, setInstructor] = useState("");
  const [dateInput, setDateInput] = useState(timestampToDateInput(null));
  // endDateInput vide = stage d'un seul jour. Si renseigné, on stocke
  // `endDate` pour matérialiser la fin (filtrage + affichage planning).
  const [endDateInput, setEndDateInput] = useState("");
  const [afficheFile, setAfficheFile] = useState(null);
  const [afficheLocalUrl, setAfficheLocalUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!afficheFile) {
      setAfficheLocalUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(afficheFile);
    setAfficheLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [afficheFile]);

  function pickAffiche(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choisis une image (JPG, PNG…).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("L'affiche dépasse 5 Mo — compresse-la avant.");
      return;
    }
    setError(null);
    setAfficheFile(file);
  }

  async function submit() {
    const t = title.trim();
    if (!t) {
      setError("Donne un titre au stage.");
      return;
    }
    setBusy(true);
    try {
      // 1) Création du doc pour récupérer son id (besoin d'un emplacement
      //    stable pour l'affiche dans Storage).
      const startD = dateInputToDate(dateInput) || new Date();
      const endD = endDateInput ? dateInputToDate(endDateInput) : null;
      if (endD && endD < startD) {
        setError("La date de fin doit être après la date de début.");
        setBusy(false);
        return;
      }
      const created = await recordStage({
        title: t,
        type,
        instructor: instructor.trim(),
        date: startD,
        endDate: endD,
        afficheUrl: null,
        recordedBy: prof || null,
      });
      // 2) Upload de l'affiche + patch du doc avec l'URL publique.
      if (afficheFile && created?.id) {
        const url = await uploadStageAffiche(created.id, afficheFile);
        if (url) await updateStageAffiche(created.id, url);
      }
      onSave();
    } catch (err) {
      console.error("recordStage failed:", err);
      setError("Échec de l'enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-night/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 pt-[max(env(safe-area-inset-top),1rem)] sm:pt-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper-card w-full max-w-sm rounded-[20px] shadow-device border border-[rgba(34,30,24,0.07)] p-5 space-y-4 animate-slide-up"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
            <Award size={17} className="text-gold" />
          </div>
          <div className="flex-1">
            <div className="font-serif text-[17px] font-semibold text-ink leading-tight">
              Annoncer un stage
            </div>
            <div className="text-[12px] text-ink-soft mt-0.5 leading-snug">
              L'événement apparaît sur le Dashboard de chaque adhérent (et la frise de saison) — aucun pointage n'est demandé.
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full bg-paper border border-[rgba(34,30,24,0.07)] flex items-center justify-center"
          >
            <X size={15} className="text-ink-soft" />
          </button>
        </div>

        <div className="space-y-2.5">
          <div>
            <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Titre</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null); }}
              placeholder="Stage Tamura, weekend technique…"
              style={{ fontSize: 16 }}
              className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ fontSize: 16 }}
                className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
              >
                <option value="dojo">Au dojo</option>
                <option value="national">National</option>
                <option value="international">International</option>
              </select>
            </div>
            <div>
              <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Du</label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                style={{ fontSize: 16 }}
                className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
              />
            </div>
          </div>
          <div>
            <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
              Au <span className="font-normal normal-case tracking-normal text-ink-muted">(si plusieurs jours)</span>
            </label>
            <input
              type="date"
              value={endDateInput}
              min={dateInput || undefined}
              onChange={(e) => setEndDateInput(e.target.value)}
              style={{ fontSize: 16 }}
              className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
            />
          </div>
          <div>
            <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">Enseignant·e (optionnel)</label>
            <input
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="Tamura, Tissier…"
              style={{ fontSize: 16 }}
              className="mt-1 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper focus:outline-none focus:border-pine"
            />
          </div>

          {/* Affiche — uploadée vers Firebase Storage à la validation. */}
          <div>
            <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
              Affiche <span className="font-normal normal-case tracking-normal text-ink-muted">(optionnelle, ≤ 5 Mo)</span>
            </label>
            {afficheLocalUrl ? (
              <div className="mt-1.5 rounded-lg overflow-hidden border border-[rgba(34,30,24,0.12)] relative">
                <img src={afficheLocalUrl} alt="Aperçu de l'affiche" className="w-full max-h-56 object-contain bg-paper" />
                <button
                  type="button"
                  onClick={() => setAfficheFile(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-night/80 text-cream flex items-center justify-center"
                  title="Retirer l'affiche"
                >
                  <X size={13} strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex items-center justify-center gap-2 border border-dashed border-[rgba(34,30,24,0.2)] rounded-lg px-3 py-4 text-[12.5px] text-ink-soft cursor-pointer hover:border-gold/40 hover:text-ink">
                <Plus size={14} />
                Choisir une image
                <input
                  type="file"
                  accept="image/*"
                  onChange={pickAffiche}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {error && (
          <div className="text-[11.5px] text-vermillion-500 bg-vermillion-50 border border-vermillion-200 rounded-lg px-2.5 py-1.5">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-[12.5px] font-semibold text-ink-soft px-3 py-2"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="text-[12.5px] font-semibold text-paper bg-pine rounded-lg px-4 py-2 flex items-center gap-1.5 shadow-card disabled:opacity-50"
          >
            <Award size={14} />
            {busy ? "Enregistrement…" : "Annoncer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GradePickerModal({ member, onSave, onLeave, onClose }) {
  const [selected, setSelected] = useState(member?.grade || GRADES[0].id);
  const [dateInput, setDateInput] = useState(() => timestampToDateInput(member?.gradeObtainedAt));
  const [birthYM, setBirthYM] = useState(() => member?.birthYM || "");
  // Lieux de pratique : fallback "tout le club" si le champ n'existe pas
  // encore (anciennes fiches). Le prof peut toujours retirer / ajouter.
  const initialLocations = Array.isArray(member?.practiceLocations) && member.practiceLocations.length > 0
    ? member.practiceLocations
    : LOCATIONS.slice();
  const [practiceLocations, setPracticeLocations] = useState(initialLocations);
  // Badges manuels — 4 distinctions cochables par le prof.
  const MANUAL_IDS = ["demo", "senpai", "reishiki", "armes"];
  const MANUAL_LABELS = {
    demo: "Première démonstration",
    senpai: "Senpai",
    reishiki: "Reishiki",
    armes: "Premier cours d'armes",
  };
  const MANUAL_KANJI = { demo: "演", senpai: "先", reishiki: "礼", armes: "武" };
  const initialManual = Array.isArray(member?.manualBadges) ? member.manualBadges : [];
  const [manualBadges, setManualBadgesState] = useState(initialManual);
  function toggleManual(id) {
    setManualBadgesState((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  const manualChanged = JSON.stringify(initialManual.slice().sort()) !== JSON.stringify(manualBadges.slice().sort());
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const gradeChanged = selected !== member.grade;
  const dateChanged = !sameDateInput(member?.gradeObtainedAt, dateInput);
  const birthChanged = (birthYM || "") !== (member?.birthYM || "");
  const locationsChanged = JSON.stringify(initialLocations.slice().sort()) !== JSON.stringify(practiceLocations.slice().sort());
  const dirty = gradeChanged || dateChanged || birthChanged || locationsChanged || manualChanged;

  const cat = ageCategory(birthYM);
  const yrs = ageInYears(birthYM);

  function toggleLocation(loc) {
    setPracticeLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
    );
  }

  async function submit() {
    setBusy(true);
    try {
      await onSave({
        grade: selected,
        obtainedAt: dateInputToDate(dateInput),
        birthYM: birthChanged ? (birthYM || null) : undefined,
        practiceLocations: locationsChanged ? practiceLocations : undefined,
        manualBadges: manualChanged ? manualBadges : undefined,
      });
    } catch (err) {
      console.error("assignGrade failed:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-night/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 pt-[max(env(safe-area-inset-top),1rem)] sm:pt-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper-card w-full max-w-sm rounded-[20px] shadow-device border border-[rgba(34,30,24,0.07)] p-5 animate-slide-up"
      >
        <div className="font-serif text-[17px] font-semibold text-ink leading-tight">
          {member.firstName} {member.lastName}
        </div>
        <div className="text-[12px] text-ink-soft mt-0.5">
          {gradeChanged
            ? "Le grade actuel passera dans l'historique."
            : "Modifie le grade, sa date d'obtention ou la date de naissance."}
        </div>

        {/* Date d'obtention — placed up front so it's never hidden behind
            the grade list scroll. */}
        <div className="mt-4 p-3 rounded-[14px] bg-gold-400/10 border border-gold/30">
          <label className="text-[10.5px] font-bold tracking-section text-gold uppercase block">
            Date d'obtention du grade
          </label>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            max={timestampToDateInput(null)}
            style={{ fontSize: 16 }}
            className="mt-1.5 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper-card focus:outline-none focus:border-pine"
          />
          {dateChanged && !gradeChanged && (
            <div className="text-[11px] text-ink-soft mt-1.5 italic">
              Correction de date — l'historique n'est pas modifié.
            </div>
          )}
          {/* Reporter — relance le compteur sans changer de grade.
              Pratique quand la durée minimale est atteinte mais que
              l'adhérent n'est pas prêt : on repart à zéro. */}
          {!gradeChanged && (
            <button
              type="button"
              onClick={() => setDateInput(timestampToDateInput(null))}
              className="mt-2 text-[11.5px] font-semibold text-gold border border-gold/40 rounded-full px-3 py-1 flex items-center gap-1.5"
            >
              Repousser — repartir à 0 aujourd'hui
            </button>
          )}
        </div>

        {/* Mois de naissance — optionnel, sert au classement enfant/adulte. */}
        <div className="mt-3 p-3 rounded-[14px] bg-paper border border-[rgba(34,30,24,0.07)]">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
              Mois de naissance
            </label>
            {cat && (
              <div
                className={`text-[10px] font-bold tracking-section uppercase rounded-full px-2 py-0.5 ${
                  cat === "enfant"
                    ? "bg-gold/15 text-gold border border-gold/30"
                    : "bg-pine/10 text-pine border border-pine/30"
                }`}
              >
                {cat} · {yrs} ans
              </div>
            )}
          </div>
          <input
            type="month"
            value={birthYM}
            onChange={(e) => setBirthYM(e.target.value)}
            max={new Date().toISOString().slice(0, 7)}
            style={{ fontSize: 16 }}
            className="mt-1.5 w-full border border-[rgba(34,30,24,0.12)] rounded-lg px-3 py-2.5 bg-paper-card focus:outline-none focus:border-pine"
          />
          <div className="text-[11px] text-ink-muted mt-1.5 leading-snug">
            Classement <strong className="text-ink-soft">enfant</strong> &lt; {ADULT_AGE_THRESHOLD} ans · <strong className="text-ink-soft">adulte</strong> ≥ {ADULT_AGE_THRESHOLD} ans.
          </div>
        </div>

        {/* Lieux de pratique — multi-select, alimente les stats par dojo. */}
        <div className="mt-3 p-3 rounded-[14px] bg-paper border border-[rgba(34,30,24,0.07)]">
          <div className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
            Lieux de pratique
          </div>
          <div className="mt-1.5 flex gap-2">
            {LOCATIONS.map((loc) => {
              const checked = practiceLocations.includes(loc);
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => toggleLocation(loc)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-lg px-2 py-2 border transition-colors ${
                    checked
                      ? "bg-pine text-paper border-pine shadow-card"
                      : "bg-paper-card text-ink-muted border-[rgba(34,30,24,0.12)]"
                  }`}
                >
                  <MapPin size={12} />
                  {loc.replace("Santa Maria Poggio", "Santa Maria")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase mt-4 mb-2">
          Grade
        </div>
        <div className="flex flex-col gap-2 max-h-[36vh] overflow-y-auto -mx-1 px-1">
          {[...GRADES].reverse().map((g) => {
            const isSel = g.id === selected;
            return (
              <button
                key={g.id}
                onClick={() => setSelected(g.id)}
                className={`flex items-center gap-[14px] border rounded-[12px] px-3.5 py-2.5 text-left transition-colors ${
                  isSel
                    ? "border-pine bg-pine/5"
                    : "border-[rgba(34,30,24,0.07)] bg-paper hover:border-pine/20"
                }`}
              >
                <div
                  className="w-[30px] h-[12px] rounded shrink-0 ring-1 ring-[rgba(241,232,210,0.45)]"
                  style={{ backgroundColor: BELT_COLOR[g.id] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-[15px] font-semibold text-ink">{g.label}</div>
                  <div className="text-[11px] text-ink-muted">{BELT_JP[g.id]} · {g.belt}</div>
                </div>
                {isSel && <Check size={16} className="text-pine shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Distinctions du prof — 4 badges manuels (演 / 先 / 礼 / 武). */}
        <div className="mt-4 p-3 rounded-[14px] bg-paper border border-[rgba(34,30,24,0.07)]">
          <div className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase mb-2">
            Distinctions
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MANUAL_IDS.map((id) => {
              const checked = manualBadges.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleManual(id)}
                  className={`flex items-center gap-2 rounded-[12px] px-2.5 py-2 text-left border transition-colors ${
                    checked ? "bg-pine/10 border-pine/30" : "bg-paper-card border-[rgba(34,30,24,0.07)]"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-serif text-[13px] shrink-0 ${
                      checked ? "bg-pine text-paper" : "bg-paper text-ink-muted border border-[rgba(34,30,24,0.07)]"
                    }`}
                  >
                    {MANUAL_KANJI[id]}
                  </div>
                  <div className="text-[11.5px] font-semibold leading-tight">
                    {MANUAL_LABELS[id]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bouton "Marquer comme parti" — soft-delete : la fiche disparaît
            de l'app mais reste dans Firestore et le Sheet, avec la date
            de départ posée par la Cloud Function. */}
        {onLeave && (
          <div className="mt-4 pt-4 border-t border-[rgba(34,30,24,0.07)]">
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Marquer ${member.firstName} ${member.lastName} comme parti(e) du club ? La fiche disparaîtra de l'app — l'historique reste dans le Google Sheet avec la date de départ.`)) return;
                setLeaving(true);
                try { await onLeave(); }
                catch (err) { console.error("markMemberLeft failed:", err); }
                finally { setLeaving(false); }
              }}
              disabled={busy || leaving}
              className="w-full text-[12px] font-semibold text-vermillion-500 border border-vermillion-200 bg-paper rounded-lg px-3 py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <LogOut size={13} />
              {leaving ? "Enregistrement…" : "Marquer comme parti(e) du club"}
            </button>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-[12.5px] font-semibold text-ink-soft px-3 py-2"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !dirty}
            className="text-[12.5px] font-semibold text-paper bg-pine rounded-lg px-4 py-2 flex items-center gap-1.5 shadow-card disabled:opacity-50"
          >
            <Check size={14} />
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint, tone = "ink" }) {
  return (
    <div className={`rounded-[16px] p-4 border ${
      tone === "pine"
        ? "bg-hero-pine text-cream border-pine/0 shadow-heroDark"
        : "bg-paper-card text-ink border-[rgba(34,30,24,0.07)] shadow-card"
    }`}>
      <div className={`text-[10.5px] font-bold tracking-section uppercase ${
        tone === "pine" ? "text-gold-400" : "text-ink-soft"
      }`}>
        {label}
      </div>
      <div className="font-serif text-[28px] font-semibold leading-none mt-1.5 tabular-nums">
        {value}
      </div>
      {hint && (
        <div className={`text-[11px] mt-1 leading-snug ${tone === "pine" ? "text-cream/70" : "text-ink-muted"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}

function PendingTile({ label, reason }) {
  return (
    <div className="rounded-[16px] p-4 border border-dashed border-[rgba(34,30,24,0.18)] bg-paper-card/40">
      <div className="text-[10.5px] font-bold tracking-section uppercase text-ink-muted">
        {label}
      </div>
      <div className="font-serif text-[28px] font-semibold leading-none mt-1.5 text-ink-muted">—</div>
      <div className="text-[10.5px] mt-1 leading-snug italic text-ink-muted">
        {reason}
      </div>
    </div>
  );
}

// Inline SVG sparkline — no chart library. Pass series = [{ when, count }]
// already ordered chronologically and the chart auto-scales both axes.
function Sparkline({ series, height = 70, color = "#c9a24d" }) {
  if (!series || series.length < 2) {
    return (
      <div
        className="text-[11px] italic text-ink-muted text-center py-6"
        style={{ height }}
      >
        Données insuffisantes — courbe disponible après plusieurs inscriptions.
      </div>
    );
  }
  const xs = series.map((p) => p.when);
  const ys = series.map((p) => p.count);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xRange = xMax - xMin || 1;
  const yMax = Math.max(...ys);
  const yRange = yMax || 1;
  const w = 300;
  const h = height;
  const pad = 6;
  const path = series
    .map((p, i) => {
      const x = pad + ((p.when - xMin) / xRange) * (w - pad * 2);
      const y = h - pad - (p.count / yRange) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `${path} L${(w - pad).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <path d={areaPath} fill={color} fillOpacity="0.08" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {series.length <= 12 &&
        series.map((p, i) => {
          const x = pad + ((p.when - xMin) / xRange) * (w - pad * 2);
          const y = h - pad - (p.count / yRange) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r="2.4" fill={color} />;
        })}
    </svg>
  );
}

function Top5Block({ label, rows }) {
  const empty = rows.length === 0;
  return (
    <div
      className={`mx-5 mt-3 bg-paper-card rounded-[16px] p-4 ${
        empty
          ? "border border-dashed border-[rgba(34,30,24,0.18)]"
          : "border border-[rgba(34,30,24,0.07)] shadow-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase">
          Top 5 — {label}
        </div>
        <div className="flex-1 h-px hairline" />
      </div>
      {empty ? (
        <div className="text-[12px] text-ink-muted italic mt-2 leading-snug">
          Aucune donnée pour cette catégorie — alimentée par les pointages du prof.
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {rows.map(({ member: m, presents, absents }, i) => {
            const total = presents + absents;
            const rate = total > 0 ? Math.round((presents / total) * 100) : 0;
            return (
              <div key={m.id} className="flex items-center gap-3">
                <div className="font-serif text-[13px] font-semibold text-gold tabular-nums w-4 shrink-0">
                  {i + 1}
                </div>
                <div
                  className="w-[22px] h-[10px] rounded shrink-0 ring-1 ring-[rgba(241,232,210,0.45)]"
                  style={{ backgroundColor: BELT_COLOR[m.grade] || "#FFFFFF" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-[13.5px] font-semibold text-ink leading-tight truncate">
                    {m.firstName} {m.lastName}
                  </div>
                  <div className="text-[10.5px] text-ink-muted leading-tight">
                    {presents} présence{presents > 1 ? "s" : ""}
                    {total > 0 ? ` · ${rate}%` : ""}
                  </div>
                </div>
                <div className="font-serif text-[15px] font-semibold text-pine tabular-nums">
                  {presents}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AbsentsBlock({ live, adultes, enfants }) {
  const labels = ["15 jours", "1 mois", "2 mois"];
  return (
    <div
      className={`mx-5 mt-3 bg-paper-card rounded-[16px] p-4 ${
        live
          ? "border border-[rgba(34,30,24,0.07)] shadow-card"
          : "border border-dashed border-[rgba(34,30,24,0.18)]"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase">
          Élèves absents depuis…
        </div>
        <div className="flex-1 h-px hairline" />
      </div>
      {[
        { name: "Adultes", values: adultes },
        { name: "Enfants", values: enfants },
      ].map(({ name, values }) => (
        <div key={name} className="mb-3 last:mb-0">
          <div className="text-[10.5px] font-bold tracking-section text-ink-muted uppercase mb-1.5 px-1">
            {name}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {values.map((n, i) => (
              <div
                key={labels[i]}
                className="rounded-[12px] border border-[rgba(34,30,24,0.07)] bg-paper px-3 py-2.5 text-center"
              >
                <div
                  className={`font-serif text-[22px] font-semibold tabular-nums leading-none ${
                    live ? (n > 0 ? "text-vermillion-500" : "text-pine") : "text-ink-muted"
                  }`}
                >
                  {live ? n : "—"}
                </div>
                <div className="text-[10.5px] text-ink-muted tracking-wide mt-1">{labels[i]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!live && (
        <div className="text-[11px] text-ink-muted italic leading-snug">
          Disponible une fois le pointage en place.
        </div>
      )}
    </div>
  );
}

function GradeBreakdown({ label, total, counts }) {
  // Only render grades that are actually worn in this category.
  const rows = [...GRADES]
    .reverse()
    .filter((g) => (counts[g.id] || 0) > 0);
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[16px] p-3 shadow-card">
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <div className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
          {label}
        </div>
        <div className="flex-1 h-px hairline" />
        <div className="font-serif text-[15px] font-semibold text-ink tabular-nums">
          {total}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="text-[11.5px] text-ink-muted italic px-1 py-1.5 leading-snug">
          {total === 0
            ? "Aucun adhérent dans cette catégorie."
            : "Aucun grade renseigné pour l'instant."}
        </div>
      ) : (
        rows.map((g) => {
          const n = counts[g.id];
          const pct = (n / max) * 100;
          return (
            <div key={g.id} className="flex items-center gap-3 py-1.5 px-1">
              <div
                className="w-[26px] h-[10px] rounded shrink-0 ring-1 ring-[rgba(241,232,210,0.45)]"
                style={{ backgroundColor: BELT_COLOR[g.id] }}
              />
              <div className="text-[12.5px] text-ink w-[90px] shrink-0">{g.label}</div>
              <div className="flex-1 h-2 rounded-full bg-[rgba(34,30,24,0.05)] overflow-hidden">
                <div
                  className="h-full bg-pine rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="font-serif text-[14px] font-semibold text-ink tabular-nums w-5 text-right">
                {n}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ProfDashboard({ members: allAdherents, sessions = [], stages = [], onOpenPointage, onOpenStage }) {
  // Filtre par lieu : "all" agrège, sinon ne garde que les sessions ET les
  // membres rattachés au lieu sélectionné. Les fiches sans champ
  // `practiceLocations` (anciennes) sont considérées comme pratiquant
  // partout — c'est le défaut au backfill.
  const [locationFilter, setLocationFilter] = useState("all");
  const matchesLocation = (loc) => locationFilter === "all" || loc === locationFilter;
  const matchesMemberLocation = (m) => {
    if (locationFilter === "all") return true;
    const locs = Array.isArray(m.practiceLocations) && m.practiceLocations.length > 0
      ? m.practiceLocations
      : LOCATIONS; // fallback compat : tout le club
    return locs.includes(locationFilter);
  };
  const members = allAdherents.filter(matchesMemberLocation);
  // ---- Computable now ----
  const ready = members
    .map((m) => {
      const idx = GRADES.findIndex((g) => g.id === m.grade);
      if (idx < 0 || idx >= GRADES.length - 1) return null;
      const next = GRADES[idx + 1];
      const target = MIN_MONTHS_TO_REACH[next.id] || 0;
      const elapsed = monthsSince(m.gradeObtainedAt);
      if (target === 0 || elapsed < target) return null;
      return { member: m, next, target, elapsed };
    })
    .filter(Boolean)
    .sort((a, b) => b.elapsed - a.elapsed);

  // Enrolment cumulative — one point per member's createdAt + a final
  // "now" anchor so the line extends to today.
  const enrolmentSeries = (() => {
    const sorted = members
      .map((m) => timestampMillis(m.createdAt))
      .filter((t) => t > 0)
      .sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    const series = sorted.map((when, i) => ({ when, count: i + 1 }));
    if (Date.now() - series[series.length - 1].when > 86400000) {
      series.push({ when: Date.now(), count: sorted.length });
    }
    return series;
  })();

  const recent = members
    .slice()
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
    .slice(0, 3);

  // ---- Attendance KPIs (live, séparés adultes / enfants) ----
  // Pour chaque memberId on pré-calcule sa catégorie. Les ids absents de
  // la map ("unknown") sont comptés à part — on ne sait pas si c'est un
  // adulte ou un enfant tant que la date de naissance manque.
  const catById = new Map();
  for (const m of members) catById.set(m.id, ageCategory(m.birthYM));

  const now = Date.now();
  const ONE_DAY = 86400000;
  const sevenDaysAgo = now - 7 * ONE_DAY;

  // Saison FFAB en cours (1er sept → 31 août). Tous les KPIs basés sur
  // les pointages sont scopés à cette fenêtre : présence, taux moyen,
  // top 5, absents, présence par semaine. Le 1er septembre les
  // compteurs repartent à zéro tout seuls.
  const season = currentSeasonRange(new Date(now));
  const datedSessions = sessions
    .map((s) => ({
      ...s,
      _ms: timestampMillis(s.date),
      _audience: courseAudience({ title: s.courseTitle }),
    }))
    .filter((s) => s._ms > 0)
    .filter((s) => s._ms >= season.start && s._ms <= season.end)
    .filter((s) => matchesLocation(s.location));

  // Audience d'une session : déduit du titre du cours stocké.
  // - "enfants" ou "all" → comptée dans le bucket enfants
  // - "adultes" ou "all" → comptée dans le bucket adultes
  // Les sessions "tout public" (audience="all") comptent dans les deux.
  const sessionsLast7d = datedSessions.filter((s) => s._ms >= sevenDaysAgo);
  const sessionsLast7dAdultes = sessionsLast7d.filter((s) => s._audience !== "enfants");
  const sessionsLast7dEnfants = sessionsLast7d.filter((s) => s._audience !== "adultes");

  // Présents uniques cette semaine, par catégorie.
  const uniquePresentLast7d = { adulte: new Set(), enfant: new Set(), other: new Set() };
  for (const s of sessionsLast7d) {
    for (const id of s.presentIds || []) {
      const cat = catById.get(id);
      if (cat === "adulte") uniquePresentLast7d.adulte.add(id);
      else if (cat === "enfant") uniquePresentLast7d.enfant.add(id);
      else uniquePresentLast7d.other.add(id);
    }
  }

  // Taux de présence moyen — séparé adultes / enfants à partir des ids.
  // Compte aussi combien de sessions ont contribué à chaque taux pour le
  // hint affiché ("sur N pointages").
  const rateTally = {
    adulte: { p: 0, t: 0, sessions: 0 },
    enfant: { p: 0, t: 0, sessions: 0 },
  };
  for (const s of datedSessions) {
    const cats = { adulte: false, enfant: false };
    for (const id of s.presentIds || []) {
      const c = catById.get(id);
      if (c === "adulte" || c === "enfant") {
        rateTally[c].p++; rateTally[c].t++; cats[c] = true;
      }
    }
    for (const id of s.absentIds || []) {
      const c = catById.get(id);
      if (c === "adulte" || c === "enfant") {
        rateTally[c].t++; cats[c] = true;
      }
    }
    if (cats.adulte) rateTally.adulte.sessions++;
    if (cats.enfant) rateTally.enfant.sessions++;
  }
  const rateAdultes = rateTally.adulte.t > 0 ? Math.round((rateTally.adulte.p / rateTally.adulte.t) * 100) : null;
  const rateEnfants = rateTally.enfant.t > 0 ? Math.round((rateTally.enfant.p / rateTally.enfant.t) * 100) : null;

  // Compte de présences par membre + dernière présence.
  const memberStats = new Map();
  for (const m of members) memberStats.set(m.id, { member: m, presents: 0, absents: 0, lastSeen: 0 });
  for (const s of datedSessions) {
    for (const id of s.presentIds || []) {
      const st = memberStats.get(id);
      if (st) {
        st.presents++;
        if (s._ms > st.lastSeen) st.lastSeen = s._ms;
      }
    }
    for (const id of s.absentIds || []) {
      const st = memberStats.get(id);
      if (st) st.absents++;
    }
  }

  // Top 5 séparés — adultes et enfants côte à côte.
  const top5ByCat = (cat) =>
    Array.from(memberStats.values())
      .filter((st) => st.presents > 0 && ageCategory(st.member.birthYM) === cat)
      .sort((a, b) => b.presents - a.presents || (b.lastSeen - a.lastSeen))
      .slice(0, 5);
  const top5Adultes = top5ByCat("adulte");
  const top5Enfants = top5ByCat("enfant");

  // Absents depuis X jours, par catégorie. Les membres inscrits trop
  // récemment (createdAt > cutoff) sont exclus pour ne pas créer de faux
  // absents.
  function countAbsentSince(days, cat) {
    const cutoff = now - days * ONE_DAY;
    let n = 0;
    for (const st of memberStats.values()) {
      if (ageCategory(st.member.birthYM) !== cat) continue;
      const createdMs = timestampMillis(st.member.createdAt);
      if (createdMs > cutoff) continue;
      if (!st.lastSeen || st.lastSeen < cutoff) n++;
    }
    return n;
  }
  const absentAdultes = [15, 30, 60].map((d) => countAbsentSince(d, "adulte"));
  const absentEnfants = [15, 30, 60].map((d) => countAbsentSince(d, "enfant"));

  // Présence par semaine — somme des présents par bucket ISO-week (8 dernières).
  const weeklySeries = (() => {
    if (datedSessions.length === 0) return [];
    const NB_WEEKS = 8;
    const oldest = now - NB_WEEKS * 7 * ONE_DAY;
    const buckets = new Map();
    for (let i = 0; i < NB_WEEKS; i++) {
      const weekStart = now - (NB_WEEKS - 1 - i) * 7 * ONE_DAY;
      buckets.set(weekStart, 0);
    }
    for (const s of datedSessions) {
      if (s._ms < oldest) continue;
      const weeksAgo = Math.floor((now - s._ms) / (7 * ONE_DAY));
      if (weeksAgo < 0 || weeksAgo >= NB_WEEKS) continue;
      const key = now - weeksAgo * 7 * ONE_DAY;
      buckets.set(key, (buckets.get(key) || 0) + (s.presentIds || []).length);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([when, count]) => ({ when, count }));
  })();
  const weeklyMax = Math.max(1, ...weeklySeries.map((w) => w.count));

  // ---- Démographie (live, dérivée de birthYM) ----
  // Sépare adultes et enfants : 2 moyennes distinctes + 2 répartitions de
  // grades, plus parlantes que des chiffres globaux.
  const adultes = members.filter((m) => ageCategory(m.birthYM) === "adulte");
  const enfants = members.filter((m) => ageCategory(m.birthYM) === "enfant");
  const adultesAges = adultes.map((m) => ageInYears(m.birthYM)).filter((a) => a != null);
  const enfantsAges = enfants.map((m) => ageInYears(m.birthYM)).filter((a) => a != null);
  const ageMoyenAdultes = adultesAges.length > 0
    ? Math.round((adultesAges.reduce((s, a) => s + a, 0) / adultesAges.length) * 10) / 10
    : null;
  const ageMoyenEnfants = enfantsAges.length > 0
    ? Math.round((enfantsAges.reduce((s, a) => s + a, 0) / enfantsAges.length) * 10) / 10
    : null;
  const knownBirthCount = adultes.length + enfants.length;
  const missingBirthCount = members.length - knownBirthCount;

  // Counts par grade × catégorie, pour les 2 répartitions séparées.
  const adultesCounts = Object.fromEntries(GRADES.map((g) => [g.id, 0]));
  const enfantsCounts = Object.fromEntries(GRADES.map((g) => [g.id, 0]));
  for (const m of adultes) if (adultesCounts[m.grade] != null) adultesCounts[m.grade]++;
  for (const m of enfants) if (enfantsCounts[m.grade] != null) enfantsCounts[m.grade]++;

  return (
    <>
      {/* ───────── Pointage CTA ───────── */}
      <div className="px-5 mt-5">
        <button
          type="button"
          onClick={onOpenPointage}
          className="w-full bg-hero-pine text-cream rounded-[18px] px-5 py-4 flex items-center gap-4 shadow-heroDark active:scale-[0.99] transition-transform"
        >
          <div className="w-11 h-11 rounded-full bg-gold/20 ring-1 ring-gold/40 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-gold-400" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[10.5px] font-bold tracking-seal text-gold-400 uppercase">
              Pointage
            </div>
            <div className="font-serif text-[18px] font-semibold leading-tight mt-0.5">
              Faire le pointage
            </div>
            <div className="text-[11.5px] text-cream/70 leading-snug mt-0.5">
              Enregistrer les présents du cours en cours.
            </div>
          </div>
          <div className="text-[18px] text-gold-400 shrink-0">›</div>
        </button>
        {datedSessions.length > 0 && (
          <div className="text-[11px] text-ink-muted mt-2 px-1">
            {datedSessions.length} pointage{datedSessions.length > 1 ? "s" : ""} enregistré
            {datedSessions.length > 1 ? "s" : ""} · partagé entre tous les profs.
          </div>
        )}

      </div>

      {/* Sélecteur de lieu — filtre les KPIs basés sur les pointages.
          Les chiffres d'effectif / grades / âges ne dépendent pas du dojo
          et restent agrégés. */}
      <div className="px-5 mt-7">
        <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase mb-2">
          Données affichées
        </div>
        <div className="flex gap-1.5">
          {[
            { id: "all", label: "Tout le club" },
            ...LOCATIONS.map((l) => ({ id: l, label: l.replace("Santa Maria Poggio", "Santa Maria") })),
          ].map((opt) => {
            const active = locationFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLocationFilter(opt.id)}
                className={`text-[11.5px] font-semibold rounded-full px-3 py-1.5 transition-colors border ${
                  active
                    ? "bg-pine text-paper border-pine shadow-card"
                    : "bg-paper-card text-ink-soft border-[rgba(34,30,24,0.12)] hover:border-pine/30"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ───────── KPI grid (4 chiffres clés) ───────── */}
      <div className="px-5 mt-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase">
            En un coup d'œil
          </div>
          <div className="text-[10px] font-medium text-ink-soft">
            Saison {season.label}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Effectif total"
            value={members.length}
            hint={members.length > 1 ? "adhérents inscrits" : "adhérent inscrit"}
            tone="pine"
          />
          <StatTile
            label="Passages prévus"
            value={ready.length}
            hint="durée minimale atteinte"
          />
        </div>
      </div>

      {/* Présence par catégorie — 2x2 : adultes / enfants × semaine / taux.
          Les compteurs "sur N pointages" sont par catégorie : une session
          du cours Enfants ne compte que dans le hint Enfants. */}
      <div className="px-5 mt-5">
        <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase mb-3">
          Présence cette semaine
        </div>
        <div className="grid grid-cols-2 gap-3">
          {sessionsLast7dAdultes.length > 0 ? (
            <StatTile
              label="Adultes"
              value={uniquePresentLast7d.adulte.size}
              hint={`sur ${sessionsLast7dAdultes.length} cours pointé${sessionsLast7dAdultes.length > 1 ? "s" : ""}`}
            />
          ) : (
            <PendingTile label="Adultes" reason="Aucun cours adulte pointé cette semaine." />
          )}
          {sessionsLast7dEnfants.length > 0 ? (
            <StatTile
              label="Enfants"
              value={uniquePresentLast7d.enfant.size}
              hint={`sur ${sessionsLast7dEnfants.length} cours pointé${sessionsLast7dEnfants.length > 1 ? "s" : ""}`}
              tone="pine"
            />
          ) : (
            <PendingTile label="Enfants" reason="Aucun cours enfant pointé cette semaine." />
          )}
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase mb-3">
          Taux de présence moyen
        </div>
        <div className="grid grid-cols-2 gap-3">
          {rateAdultes != null ? (
            <StatTile
              label="Adultes"
              value={`${rateAdultes}%`}
              hint={`sur ${rateTally.adulte.sessions} pointage${rateTally.adulte.sessions > 1 ? "s" : ""} cette saison`}
            />
          ) : (
            <PendingTile label="Adultes" reason="Disponible dès le premier pointage adulte." />
          )}
          {rateEnfants != null ? (
            <StatTile
              label="Enfants"
              value={`${rateEnfants}%`}
              hint={`sur ${rateTally.enfant.sessions} pointage${rateTally.enfant.sessions > 1 ? "s" : ""} cette saison`}
              tone="pine"
            />
          ) : (
            <PendingTile label="Enfants" reason="Disponible dès le premier pointage enfant." />
          )}
        </div>
      </div>

      {/* ───────── Assiduité ───────── */}
      <div className="px-5 mt-8">
        <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase">
          Assiduité
        </div>
        <div className="font-serif text-[22px] font-semibold leading-none mt-2 text-ink">
          Qui est sur le tatami ?
        </div>
      </div>

      <Top5Block label="Adultes" rows={top5Adultes} />
      <Top5Block label="Enfants" rows={top5Enfants} />

      <AbsentsBlock
        live={datedSessions.length > 0}
        adultes={absentAdultes}
        enfants={absentEnfants}
      />

      {/* ───────── Évolution ───────── */}
      <div className="px-5 mt-9">
        <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase">
          Évolution
        </div>
        <div className="font-serif text-[22px] font-semibold leading-none mt-2 text-ink">
          Tendances du club
        </div>
      </div>

      {/* Effectif depuis le lancement */}
      <div className="mx-5 mt-4 bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[16px] p-4 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase">
            Effectif depuis le lancement
          </div>
          <div className="flex-1 h-px hairline" />
          <div className="font-serif text-[20px] font-semibold text-ink tabular-nums">
            {members.length}
          </div>
        </div>
        <div className="text-[11px] text-ink-muted leading-snug mb-2">
          Historique cumulé des inscriptions dans l'app (les saisons antérieures arriveront avec le temps).
        </div>
        <Sparkline series={enrolmentSeries} />
      </div>

      {/* Présence par semaine */}
      <div
        className={`mx-5 mt-3 bg-paper-card rounded-[16px] p-4 ${
          weeklySeries.length > 0
            ? "border border-[rgba(34,30,24,0.07)] shadow-card"
            : "border border-dashed border-[rgba(34,30,24,0.18)]"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase">
            Présence par semaine
          </div>
          <div className="flex-1 h-px hairline" />
          {weeklySeries.length > 0 && (
            <div className="font-serif text-[14px] font-semibold text-ink tabular-nums">
              {weeklySeries.reduce((a, w) => a + w.count, 0)}
            </div>
          )}
        </div>
        {weeklySeries.length === 0 ? (
          <div className="text-[11px] text-ink-muted italic leading-snug mt-1">
            Histogramme hebdomadaire — disponible une fois les premiers appels enregistrés.
          </div>
        ) : (
          <>
            <div className="text-[11px] text-ink-muted leading-snug mb-3">
              Total des présences enregistrées sur les 8 dernières semaines.
            </div>
            <div className="flex items-end gap-1.5 h-[80px]">
              {weeklySeries.map((w, i) => {
                const pct = (w.count / weeklyMax) * 100;
                const d = new Date(w.when);
                const label = `${d.getDate()}/${d.getMonth() + 1}`;
                return (
                  <div key={w.when} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className={`w-full rounded-t ${
                          w.count > 0 ? "bg-pine" : "bg-[rgba(34,30,24,0.08)]"
                        }`}
                        style={{ height: `${Math.max(pct, w.count > 0 ? 6 : 2)}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-ink-muted tabular-nums leading-none">
                      {i === weeklySeries.length - 1 ? "auj." : label}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Répartition par grade — séparée adultes / enfants. Chaque bloc
          n'affiche que les grades effectivement portés dans sa catégorie
          (pour ne pas saturer avec 11 lignes de zéros côté enfants). */}
      <div className="px-5 mt-3">
        <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
          Répartition par grade
        </div>
        <GradeBreakdown label="Adultes" total={adultes.length} counts={adultesCounts} />
        <div className="h-3" />
        <GradeBreakdown label="Enfants" total={enfants.length} counts={enfantsCounts} />
        {missingBirthCount > 0 && (
          <div className="text-[11px] text-ink-muted italic leading-snug mt-2 px-1">
            {missingBirthCount} fiche{missingBirthCount > 1 ? "s" : ""} non classée{missingBirthCount > 1 ? "s" : ""} — mois de naissance manquant.
          </div>
        )}
      </div>

      {/* Âge moyen — séparé adultes / enfants. Le total Adultes/Enfants
          reste implicite dans le hint de chaque tuile. */}
      <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
        {ageMoyenAdultes != null ? (
          <StatTile
            label="Âge moyen adultes"
            value={ageMoyenAdultes}
            hint={`${adultes.length} adulte${adultes.length > 1 ? "s" : ""} · ≥ ${ADULT_AGE_THRESHOLD} ans`}
          />
        ) : (
          <PendingTile
            label="Âge moyen adultes"
            reason="Renseigne le mois de naissance des adultes pour l'activer."
          />
        )}
        {ageMoyenEnfants != null ? (
          <StatTile
            label="Âge moyen enfants"
            value={ageMoyenEnfants}
            hint={`${enfants.length} enfant${enfants.length > 1 ? "s" : ""} · < ${ADULT_AGE_THRESHOLD} ans`}
          />
        ) : (
          <PendingTile
            label="Âge moyen enfants"
            reason="Renseigne le mois de naissance des enfants pour l'activer."
          />
        )}
      </div>
      {missingBirthCount > 0 && (
        <div className="px-5 mt-2 text-[11px] text-ink-muted italic leading-snug">
          {missingBirthCount} fiche{missingBirthCount > 1 ? "s" : ""} sans date de naissance — à compléter dans l'onglet Membres.
        </div>
      )}

      {/* Prêts à passer un grade — gardé, utile complément des KPIs */}
      {ready.length > 0 && (
        <div className="px-5 mt-7">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase">
              Prêts à passer un grade
            </div>
            <div className="text-[10.5px] font-bold tracking-section text-gold uppercase">
              {ready.length}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {ready.map(({ member: m, next, elapsed, target }) => (
              <div
                key={m.id}
                className="bg-paper-card border border-gold/40 rounded-[14px] px-4 py-3 flex items-center gap-3 shadow-card"
              >
                <div
                  className="w-[24px] h-[10px] rounded shrink-0 ring-1 ring-[rgba(241,232,210,0.45)]"
                  style={{ backgroundColor: BELT_COLOR[m.grade] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-[14.5px] font-semibold text-ink">
                    {m.firstName} {m.lastName}
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    Vers {next.label} · {elapsed.toFixed(1)} / {target} mois
                  </div>
                </div>
                <TrendingUp size={15} className="text-gold shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Récemment inscrits */}
      {recent.length > 0 && (
        <div className="px-5 mt-7">
          <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
            Récemment inscrits
          </div>
          <div className="flex flex-col gap-2">
            {recent.map((m) => {
              const g = GRADES.find((x) => x.id === m.grade);
              return (
                <div
                  key={m.id}
                  className="bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[14px] px-4 py-2.5 flex items-center gap-3"
                >
                  <div className="w-[26px] h-[26px] rounded-full bg-pine text-paper text-[10px] font-extrabold flex items-center justify-center shrink-0">
                    {profInitials(`${m.firstName} ${m.lastName}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-[14px] font-semibold text-ink">
                      {m.firstName} {m.lastName}
                    </div>
                    <div className="text-[11px] text-ink-muted">
                      Licence {m.id} · {g?.label || "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function CelebrationModal({ event, memberName, onClose }) {
  // Auto-dismiss after 7 s pour que ça ne reste pas si l'adhérent est
  // distrait — mais on garde un bouton "Continuer" pour fermer plus tôt.
  useEffect(() => {
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [event, onClose]);

  const isBadge = event.kind === "badge";
  const title = isBadge ? "Nouveau badge" : "Nouveau grade";
  const label = isBadge ? event.badge.label : event.grade.label;
  const kanji = isBadge ? event.badge.kanji : (BELT_JP[event.grade.id]?.[0] || "段");
  const subline = isBadge
    ? "Belle progression — continue !"
    : `${event.grade.belt} · ${BELT_JP[event.grade.id]}`;

  // Portal vers <body> : sinon un ancêtre avec transform (animations
  // slide-in-right des tabs, slide-up des cartes…) devient le containing
  // block du `position: fixed` et la modale finit à mi-hauteur du tab,
  // hors viewport quand on a scrollé.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-night/65 backdrop-blur-sm flex items-center justify-center p-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-paper-card w-full max-w-xs rounded-[24px] shadow-device border border-gold/40 p-6 text-center animate-pop overflow-hidden"
      >
        {/* Glow gold derrière le kanji */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-gold/20 blur-3xl"
        />
        {/* Sceau japonais en watermark */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-4 -bottom-4 text-[120px] text-gold/10 font-serif leading-none select-none"
        >
          祝
        </div>

        <div className="relative">
          <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase">
            {title}
          </div>
          <div className="font-serif text-[13px] text-ink-soft mt-1.5">
            Félicitations {memberName} !
          </div>

          {/* Médaillon kanji — pulse léger pour attirer l'œil */}
          <div className="mx-auto mt-5 w-24 h-24 rounded-full bg-gradient-to-b from-gold-400 to-gold flex items-center justify-center shadow-[0_8px_24px_rgba(169,129,70,0.4)] animate-pulse-slow">
            <div className="w-[88px] h-[88px] rounded-full bg-paper-card border-2 border-gold/40 flex items-center justify-center">
              {isBadge ? (
                <div className="font-serif text-[36px] text-gold leading-none">
                  {kanji}
                </div>
              ) : (
                <div
                  className="w-[60px] h-[24px] rounded ring-1 ring-[rgba(241,232,210,0.45)]"
                  style={{ backgroundColor: BELT_COLOR[event.grade.id] }}
                />
              )}
            </div>
          </div>

          <div className="font-serif text-[24px] font-semibold text-ink mt-5 leading-tight">
            {label}
          </div>
          <div className="text-[12px] text-ink-soft mt-1.5 leading-snug">
            {subline}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full text-[12.5px] font-semibold text-paper bg-pine rounded-full px-4 py-2.5 shadow-card"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MemberDashboard({ member, courses, announcements, attendanceSessions = [], stages = [], location, profMode, onCreateProfile, onEditMyGrade, onLogout, onGoToGrade }) {
  // Re-tick toutes les 30 s pour que la barre de progression du cours en
  // cours et le countdown "Encore X min" restent à jour sans rafraîchir.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // File de célébration — déclarée tout en haut pour respecter l'ordre des
  // hooks même quand `member` est null (état de chargement). L'effet diff
  // les badges débloqués + le grade actuel contre ce qui a été montré la
  // dernière fois pour ce numéro de licence.
  const [celebrationQueue, setCelebrationQueue] = useState([]);
  const [badgesOpen, setBadgesOpen] = useState(false);
  useEffect(() => {
    if (!member?.id) return;
    // Calcul autonome — réutilise la spec partagée pour rester aligné
    // avec l'écran Badges, et débloque les 25 ids.
    const sessions = attendanceSessions || [];
    let presentTotal = 0;
    let streak = 0;
    const tracked = [];
    for (const s of sessions) {
      const t = timestampMillis(s.date);
      if (!t) continue;
      const isP = (s.presentIds || []).includes(member.id);
      const isA = (s.absentIds || []).includes(member.id);
      if (!isP && !isA) continue;
      if (isP) presentTotal++;
      tracked.push({ t, isP });
    }
    tracked.sort((a, b) => a.t - b.t);
    for (let i = tracked.length - 1; i >= 0; i--) {
      if (tracked[i].isP) streak++; else break;
    }
    const years = yearsSince(member.createdAt);
    const gradeIdx = GRADES.findIndex((g) => g.id === member.grade);
    const hakamaIdx = GRADES.findIndex((g) => g.id === "3kyu");
    const sAtt = {
      dojo: (stages || []).some((s) => s.type === "dojo" && (s.attendeeIds || []).includes(member.id)),
      national: (stages || []).some((s) => s.type === "national" && (s.attendeeIds || []).includes(member.id)),
      international: (stages || []).some((s) => s.type === "international" && (s.attendeeIds || []).includes(member.id)),
    };
    const allBadges = computeMemberBadges({
      member,
      presentTotal, streak, yearsOfPractice: years,
      gradeIdx, hakamaIdx,
      stageAttendance: sAtt,
      manualBadges: Array.isArray(member.manualBadges) ? member.manualBadges : [],
      forceBadges: forceBadgesFor(member),
    });
    const earnedNow = allBadges.filter((b) => b.earned).map((b) => b.id);
    const labelById = Object.fromEntries(
      BADGES.map((b) => [b.id, { label: b.full, kanji: b.kanji }]),
    );

    // v3 = bump après les retours utilisateur : la v2 seedait
    // silencieusement le premier passage, ce qui privait les adhérents
    // ouverts post-migration de leurs pop-ups (Claire De Raedt en
    // particulier). v3 célèbre l'état initial — cappé à 5 pop-ups pour
    // les utilisateurs qui en ont beaucoup, le reste est visible dans
    // l'écran Badges.
    const badgesKey = `costa-verde:seen-badges:v3:${member.id}`;
    const gradeKey = `costa-verde:seen-grade:${member.id}`;
    // Nettoyage best-effort des anciennes clés.
    try { localStorage.removeItem(`costa-verde:seen-badges:${member.id}`); } catch {}
    try { localStorage.removeItem(`costa-verde:seen-badges:v2:${member.id}`); } catch {}

    // Profs : on stocke l'état sans le célébrer — leurs badges sont
    // attribués en bloc via forceBadges, ça n'a pas de sens d'enchaîner
    // des pop-ups de félicitations.
    if (isProfMember(member)) {
      try { localStorage.setItem(badgesKey, JSON.stringify(earnedNow)); } catch {}
      try { localStorage.setItem(gradeKey, member.grade || ""); } catch {}
      return;
    }

    let storedBadges;
    try { storedBadges = JSON.parse(localStorage.getItem(badgesKey) || "null"); }
    catch { storedBadges = null; }
    if (storedBadges == null) {
      // Première ouverture avec la logique v3 — on célèbre les badges
      // déjà acquis, cappé à 5 pour rester sympa. Tout est ensuite
      // marqué comme "vu" pour ne pas re-jouer au prochain refresh.
      const toCelebrate = earnedNow.slice(0, 5);
      if (toCelebrate.length > 0) {
        const events = toCelebrate
          .map((id) => labelById[id] ? { kind: "badge", badge: { id, ...labelById[id] } } : null)
          .filter(Boolean);
        if (events.length > 0) setCelebrationQueue((q) => [...q, ...events]);
      }
      try { localStorage.setItem(badgesKey, JSON.stringify(earnedNow)); } catch {}
    } else {
      const fresh = earnedNow.filter((id) => !storedBadges.includes(id));
      if (fresh.length > 0) {
        const events = fresh
          .map((id) => labelById[id] ? { kind: "badge", badge: { id, ...labelById[id] } } : null)
          .filter(Boolean);
        if (events.length > 0) setCelebrationQueue((q) => [...q, ...events]);
        try { localStorage.setItem(badgesKey, JSON.stringify(earnedNow)); } catch {}
      }
    }

    const seenGrade = localStorage.getItem(gradeKey);
    if (seenGrade == null) {
      try { localStorage.setItem(gradeKey, member.grade || ""); } catch {}
    } else if (seenGrade !== member.grade) {
      const oldIdx = GRADES.findIndex((g) => g.id === seenGrade);
      const newIdx = GRADES.findIndex((g) => g.id === member.grade);
      if (oldIdx >= 0 && newIdx > oldIdx) {
        const newGrade = GRADES.find((g) => g.id === member.grade);
        if (newGrade) setCelebrationQueue((q) => [...q, { kind: "grade", grade: newGrade }]);
      }
      try { localStorage.setItem(gradeKey, member.grade || ""); } catch {}
    }
  }, [member?.id, member?.grade, member?.createdAt, attendanceSessions, stages, (member?.manualBadges || []).join(",")]);

  function dismissCelebration() {
    setCelebrationQueue((q) => q.slice(1));
  }
  const celebration = celebrationQueue[0] || null;

  if (!member) {
    return (
      <div className="px-5 mt-5">
        <button
          onClick={onCreateProfile}
          className="w-full flex items-center gap-3 text-left bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[18px] px-4 py-3.5 shadow-card transition-colors hover:border-pine/30"
        >
          <div className="w-10 h-10 rounded-full bg-pine flex items-center justify-center shrink-0">
            <UserPlus size={17} className="text-paper" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[15px] font-semibold text-ink">
              Créer mon profil
            </div>
            <div className="text-[12px] text-ink-soft leading-snug mt-0.5">
              Pour voir ta progression et tes prochains cours dans ton dashboard.
            </div>
          </div>
          <ChevronDown size={14} className="text-ink-muted -rotate-90" />
        </button>

        <div className="mt-6 p-5 rounded-[20px] bg-hero-pine text-cream relative overflow-hidden shadow-heroDark">
          <div aria-hidden className="kanji-watermark absolute -right-3 -top-3 text-[100px] text-gold-400/15">
            道
          </div>
          <div className="relative">
            <div className="text-[10.5px] font-bold tracking-section text-gold-400 uppercase">
              Kanjo Aïkido Isulanu
            </div>
            <div className="font-serif text-[20px] font-semibold mt-1">
              Un dojo ouvert à tous, sans esprit de compétition.
            </div>
            <div className="text-[12.5px] text-cream/80 mt-2 leading-snug">
              Affilié FFAB · reconnu par l'Aïkikaï de Tokyo. Un dojo corse,
              à Vescovato.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const grade = GRADES.find((g) => g.id === member.grade) || GRADES[0];
  const idx = GRADES.findIndex((g) => g.id === grade.id);
  const next = idx >= 0 && idx < GRADES.length - 1 ? GRADES[idx + 1] : null;
  const target = next ? MIN_MONTHS_TO_REACH[next.id] || 0 : 0;
  const elapsed = member.gradeObtainedAt ? monthsSince(member.gradeObtainedAt) : 0;
  const pct = target > 0 ? Math.min(100, Math.round((elapsed / target) * 100)) : 0;
  const monthsLeft = Math.max(0, target - elapsed);
  const obtained = formatObtained(member.gradeObtainedAt);

  // Next class — from this member's preferred location chip. Le cours en
  // cours reste affiché jusqu'à sa fin (avec barre de progression) avant
  // de basculer sur la prochaine occurrence.
  const now = new Date();
  const nextClass = courses
    .filter((c) => c.location === location && c.status !== "annule" && c.status !== "a-venir")
    .map((c) => ({ course: c, ...classOccurrence(c, now) }))
    .filter((x) => x.when)
    .sort((a, b) => {
      if (a.inProgress !== b.inProgress) return a.inProgress ? -1 : 1;
      return a.when - b.when;
    })[0];
  const nowMs = now.getTime();
  const inProgressPct = nextClass?.inProgress
    ? Math.min(100, Math.max(0,
        ((nowMs - nextClass.when.getTime()) / (nextClass.end.getTime() - nextClass.when.getTime())) * 100,
      ))
    : 0;
  const remainingMin = nextClass?.inProgress
    ? Math.max(0, Math.round((nextClass.end.getTime() - nowMs) / 60000))
    : 0;

  // Latest announcement (the first pinned, then most recent)
  const latest = announcements[0];

  // ---- Attendance dérivé pour cet adhérent ----
  // Sessions où le prof l'a pointé (présent OU absent), ordre chrono.
  const mySessions = (attendanceSessions || [])
    .map((s) => ({
      ...s,
      _ms: timestampMillis(s.date),
      isPresent: (s.presentIds || []).includes(member.id),
      isAbsent: (s.absentIds || []).includes(member.id),
    }))
    .filter((s) => (s.isPresent || s.isAbsent) && s._ms > 0)
    .sort((a, b) => a._ms - b._ms);

  const presentTotal = mySessions.filter((s) => s.isPresent).length;
  const season = currentSeasonRange(now);
  const sessionsThisSeason = mySessions.filter((s) => s._ms >= season.start && s._ms <= season.end);
  const presentsThisSeason = sessionsThisSeason.filter((s) => s.isPresent).length;

  // Streak : consécutifs présents depuis la session la plus récente.
  let streak = 0;
  for (let i = mySessions.length - 1; i >= 0; i--) {
    if (mySessions[i].isPresent) streak++;
    else break;
  }

  // Dernière session pointée — si elle est absente, on encourage à revenir.
  const lastTracked = mySessions[mySessions.length - 1];
  const justMissed = lastTracked && lastTracked.isAbsent;

  // ---- Stages dérivés (info club-wide, pas de pointage individuel) ----
  // L'app annonce les stages du dojo et au-delà — chaque adhérent voit la
  // même liste, on n'enregistre pas qui y va.
  const allStages = (stages || [])
    .map((s) => {
      const sMs = timestampMillis(s.date);
      const eMs = timestampMillis(s.endDate) || sMs;
      return { ...s, _ms: sMs, _end: eMs };
    })
    .sort((a, b) => b._ms - a._ms);
  const stagesThisSeason = allStages.filter((s) => s._ms >= season.start && s._ms <= season.end);
  const stagesDojo = allStages.filter((s) => s.type === "dojo");
  const firstStageNatl = allStages.find((s) => s.type === "national" || s.type === "international");
  // Stages à venir : auto-masqués le lendemain de la fin (ou le lendemain
  // de la date unique pour les stages d'un seul jour).
  const upcomingStages = allStages
    .filter((s) => Date.now() < s._end + 86400000)
    .sort((a, b) => a._ms - b._ms)
    .slice(0, 3);

  // ---- Badges (computés on the fly, pas de stockage) ----
  const yearsOfPractice = yearsSince(member.createdAt);
  // Hakama : tradition du club — donné à partir du 3e kyu.
  const hakamaIdx = GRADES.findIndex((g) => g.id === "3kyu");
  // Badges complets — 25 au total. Dérivés à la volée par la spec
  // partagée (src/badges/spec.js). `manualBadges` est la liste posée
  // par le prof, `attendeeIds` des stages alimente les 3 badges self.
  const stageAttendance = {
    dojo: allStages.some((s) => s.type === "dojo" && (s.attendeeIds || []).includes(member.id)),
    national: allStages.some((s) => s.type === "national" && (s.attendeeIds || []).includes(member.id)),
    international: allStages.some((s) => s.type === "international" && (s.attendeeIds || []).includes(member.id)),
  };
  const badges = computeMemberBadges({
    member,
    presentTotal,
    streak,
    yearsOfPractice,
    gradeIdx: idx,
    hakamaIdx,
    stageAttendance,
    manualBadges: Array.isArray(member.manualBadges) ? member.manualBadges : [],
    forceBadges: forceBadgesFor(member),
  });
  const earnedCount = badges.filter((b) => b.earned).length;

  // ---- Frise saison : grades obtenus + stages, agrégés par mois ----
  const seasonTimeline = (() => {
    const items = [];
    // Grade en cours s'il a été obtenu dans la saison.
    const gMs = timestampMillis(member.gradeObtainedAt);
    if (gMs >= season.start && gMs <= season.end) {
      items.push({ when: gMs, kind: "grade", label: grade.label, sub: "Grade obtenu" });
    }
    // Historique des grades précédents tombant dans la saison.
    for (const h of member.gradeHistory || []) {
      const ms = timestampMillis(h.obtainedAt);
      if (ms >= season.start && ms <= season.end) {
        const g = GRADES.find((x) => x.id === h.grade);
        items.push({ when: ms, kind: "grade", label: g?.label || h.grade, sub: "Grade obtenu" });
      }
    }
    // Stages de la saison.
    for (const s of stagesThisSeason) {
      items.push({
        when: s._ms,
        kind: "stage",
        label: s.title,
        sub: s.type === "dojo" ? "Stage au dojo" : s.type === "national" ? "Stage national" : "Stage international",
      });
    }
    return items.sort((a, b) => b.when - a.when);
  })();

  return (
    <>
      {/* Profile / grade hero — compact */}
      <div className="mx-5 mt-5 rounded-[20px] bg-hero-pine text-cream p-5 relative overflow-hidden shadow-heroDark">
        <div className="flex items-center gap-3">
          <div
            className="w-[12px] h-[46px] rounded-[5px] shadow-[0_0_0_1.5px_rgba(241,232,210,0.5)] shrink-0"
            style={{ backgroundColor: BELT_COLOR[grade.id] }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] font-bold tracking-section text-gold-400 uppercase">
              Mon grade
            </div>
            <div className="font-serif text-[26px] font-semibold leading-tight mt-0.5">
              {grade.label}
            </div>
            <div className="text-[11.5px] text-cream/70 mt-0.5">
              {obtained ? `Obtenu en ${obtained}` : grade.belt}
            </div>
          </div>
          {profMode && (
            <button
              type="button"
              onClick={onEditMyGrade}
              className="shrink-0 w-8 h-8 rounded-full bg-cream/15 border border-cream/30 flex items-center justify-center hover:bg-cream/25"
              title="Modifier"
            >
              <Pencil size={13} className="text-cream" />
            </button>
          )}
        </div>
        {next && target > 0 && (
          <>
            <div className="flex items-center justify-between text-[11.5px] text-cream/80 mt-4">
              <span>Vers <strong className="text-cream">{next.label}</strong></span>
              <span className="tabular-nums">
                {monthsLeft > 0 ? `Encore ~${monthsLeft.toFixed(1)} mois` : "Durée minimale atteinte"}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-cream/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-gold-bar transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Programme du grade suivant — extrait condensé, lien vers la fiche
          complète sur l'onglet Grades. */}
      {next && (
        <div className="px-5 mt-5">
          <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
            Programme — vers {next.label}
          </div>
          <button
            type="button"
            onClick={() => onGoToGrade && onGoToGrade(next.id)}
            className="w-full bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[16px] px-4 py-4 shadow-card text-left transition-colors hover:border-pine/20"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-[12px] h-[36px] rounded-[5px] shrink-0 ring-1 ring-[rgba(241,232,210,0.45)]"
                style={{ backgroundColor: BELT_COLOR[next.id] }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[15px] font-semibold text-ink leading-tight">
                  {next.label}
                </div>
                <div className="text-[11.5px] text-ink-muted mt-0.5">
                  {next.belt} · {BELT_JP[next.id]}
                </div>
              </div>
              <ChevronDown size={14} className="text-ink-muted -rotate-90 shrink-0" />
            </div>
            {next.attacks && next.attacks.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] font-bold tracking-section text-ink-soft uppercase mb-1.5">
                  Attaques
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {next.attacks.map((a) => (
                    <span
                      key={a}
                      className="text-[11px] font-medium text-ink-soft bg-paper border border-[rgba(34,30,24,0.07)] px-2 py-0.5 rounded-full"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {next.sections && next.sections.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {next.sections.map((s) => (
                  <div key={s.title} className="flex items-baseline gap-2">
                    <div className="text-[11px] font-bold tracking-section text-pine uppercase shrink-0">
                      {s.title.split(" ")[0]}
                    </div>
                    <div className="text-[11.5px] text-ink-soft leading-snug">
                      {s.rows.map((r) => r.techniques).join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {next.basics && (
              <div className="mt-3 text-[12px] text-ink-soft leading-snug border-l-2 border-gold/40 pl-3 italic">
                {next.basics}
              </div>
            )}
            <div className="mt-3 text-[11px] text-gold font-semibold tracking-section uppercase">
              Voir tout le programme →
            </div>
          </button>
        </div>
      )}

      {/* Next class — bascule en "En cours" avec barre de progression
          quand le créneau commence, et ne disparaît qu'à la fin du cours. */}
      {nextClass && (
        <div className="px-5 mt-7">
          <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
            {nextClass.inProgress ? "Cours en cours" : "Mon prochain cours"}
          </div>
          <div
            className={`rounded-[16px] px-4 py-4 flex items-center gap-4 shadow-card ${
              nextClass.inProgress
                ? "bg-hero-pine text-cream border border-pine/0"
                : "bg-paper-card border border-[rgba(34,30,24,0.07)]"
            }`}
          >
            <div className="text-center shrink-0 w-[60px]">
              <div
                className={`text-[10px] tracking-mark uppercase font-bold ${
                  nextClass.inProgress ? "text-gold-400" : "text-gold"
                }`}
              >
                {nextClass.inProgress
                  ? "Live"
                  : relativeDayLabel(nextClass.when, now).slice(0, 8)}
              </div>
              <div
                className={`font-serif text-[22px] font-semibold leading-none mt-1 tabular-nums ${
                  nextClass.inProgress ? "text-cream" : "text-ink"
                }`}
              >
                {nextClass.course.start}
              </div>
              <div
                className={`text-[10.5px] tabular-nums ${
                  nextClass.inProgress ? "text-cream/70" : "text-ink-muted"
                }`}
              >
                {nextClass.course.end}
              </div>
            </div>
            <div className={`w-px self-stretch ${nextClass.inProgress ? "bg-cream/15" : "hairline"}`} />
            <div className="flex-1 min-w-0">
              <div
                className={`font-serif text-[15px] font-semibold leading-tight ${
                  nextClass.inProgress ? "text-cream" : "text-ink"
                }`}
              >
                {nextClass.course.title}
              </div>
              <div
                className={`text-[12px] mt-0.5 ${
                  nextClass.inProgress ? "text-cream/70" : "text-ink-soft"
                }`}
              >
                {nextClass.course.location}
              </div>
              <div
                className={`text-[12px] mt-0.5 ${
                  nextClass.inProgress ? "text-cream/70" : "text-ink-soft"
                }`}
              >
                {nextClass.course.prof === PROF_PLACEHOLDER
                  ? "Enseignant à confirmer"
                  : nextClass.course.prof}
              </div>
            </div>
          </div>
          {nextClass.inProgress && (
            <div className="mt-2.5 px-1">
              <div className="flex items-center justify-between text-[10.5px] text-ink-muted tabular-nums">
                <span className="text-pine font-semibold">{Math.round(inProgressPct)}%</span>
                <span>{remainingMin > 0 ? `Encore ${remainingMin} min` : "Termine maintenant"}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-[rgba(34,30,24,0.08)] overflow-hidden">
                <div
                  className="h-full bg-pine rounded-full transition-all duration-1000"
                  style={{ width: `${inProgressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ma série — cours suivis d'affilée. Si le prof a marqué l'adhérent
          absent à la dernière session, message d'encouragement à revenir. */}
      {mySessions.length > 0 && (
        <div className="px-5 mt-7">
          <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
            Ma série
          </div>
          <div
            className={`rounded-[16px] px-4 py-4 flex items-center gap-4 shadow-card ${
              justMissed
                ? "bg-vermillion-50 border border-vermillion-200"
                : "bg-paper-card border border-[rgba(34,30,24,0.07)]"
            }`}
          >
            <div className="shrink-0 w-[58px] text-center">
              <div
                className={`font-serif text-[28px] font-semibold leading-none tabular-nums ${
                  justMissed ? "text-vermillion-500" : streak >= 10 ? "text-gold" : "text-pine"
                }`}
              >
                {streak}
              </div>
              <div className="text-[10px] tracking-mark text-ink-muted uppercase font-bold mt-1">
                d'affilée
              </div>
            </div>
            <div className="w-px self-stretch hairline" />
            <div className="flex-1 min-w-0">
              {justMissed ? (
                <>
                  <div className="font-serif text-[14px] font-semibold text-ink leading-tight">
                    On t'a pas vu(e) au dernier cours…
                  </div>
                  <div className="text-[12px] text-ink-soft mt-1 leading-snug">
                    Reviens vite sur le tatami — ta série repart au prochain cours pointé.
                  </div>
                </>
              ) : streak === 0 ? (
                <>
                  <div className="font-serif text-[14px] font-semibold text-ink leading-tight">
                    Bienvenue au dojo
                  </div>
                  <div className="text-[12px] text-ink-soft mt-1 leading-snug">
                    Ta série commencera dès le prochain pointage du prof.
                  </div>
                </>
              ) : (
                <>
                  <div className="font-serif text-[14px] font-semibold text-ink leading-tight">
                    {streak >= 10 ? "Belle régularité !" : "On garde le rythme."}
                  </div>
                  <div className="text-[12px] text-ink-soft mt-1 leading-snug">
                    {streak >= 10
                      ? "Plus de 10 cours d'affilée — bravo."
                      : `Plus que ${10 - streak} pour décrocher le badge « 10 cours d'affilée ».`}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stages à venir — affiches mises en avant, info club-wide. */}
      {upcomingStages.length > 0 && (
        <div className="px-5 mt-7">
          <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
            Stages à venir
          </div>
          <div className="flex flex-col gap-3">
            {upcomingStages.map((s) => (
              <div
                key={s.id}
                className="bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[16px] overflow-hidden shadow-card"
              >
                {s.afficheUrl && (
                  <a
                    href={s.afficheUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-paper"
                  >
                    <img
                      src={s.afficheUrl}
                      alt={`Affiche — ${s.title}`}
                      loading="lazy"
                      className="w-full max-h-72 object-contain"
                    />
                  </a>
                )}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-[10px] font-bold tracking-section uppercase rounded-full px-2 py-0.5 ${
                        s.type === "dojo"
                          ? "bg-pine/10 text-pine border border-pine/30"
                          : "bg-gold/15 text-gold border border-gold/30"
                      }`}
                    >
                      {s.type === "dojo" ? "Au dojo" : s.type === "national" ? "National" : "International"}
                    </div>
                    <div className="text-[11px] text-ink-muted tabular-nums">
                      {s.endDate && !isSameLocalDay(s._ms, s._end)
                        ? `Du ${new Date(s._ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${new Date(s._end).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                        : new Date(s._ms).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    </div>
                  </div>
                  <div className="font-serif text-[15px] font-semibold text-ink mt-1.5 leading-tight">
                    {s.title}
                  </div>
                  {s.instructor && (
                    <div className="text-[12px] text-ink-soft mt-0.5">
                      Avec {s.instructor}
                    </div>
                  )}
                  {/* "J'y étais" — self-declaration. Toggle (re-tap retire). */}
                  <button
                    type="button"
                    onClick={async () => {
                      const has = (s.attendeeIds || []).includes(member.id);
                      try { await toggleStageAttendance(s.id, member.id, !has); }
                      catch (err) { console.error("toggleStageAttendance failed:", err); }
                    }}
                    className={`mt-3 w-full rounded-[12px] px-3 py-2 text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      (s.attendeeIds || []).includes(member.id)
                        ? "bg-pine text-paper shadow-card"
                        : "bg-paper border border-gold/40 text-gold"
                    }`}
                  >
                    {(s.attendeeIds || []).includes(member.id) ? (
                      <>
                        <Check size={13} strokeWidth={2.4} />
                        Participation déclarée
                      </>
                    ) : (
                      <>
                        <Award size={13} />
                        J'y étais
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mes stats — saison en cours, cours suivis + stages au dojo. */}
      <div className="px-5 mt-7">
        <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
          Mes stats · saison {season.label}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Cours suivis"
            value={presentsThisSeason}
            hint={`sur ${sessionsThisSeason.length} pointage${sessionsThisSeason.length > 1 ? "s" : ""} cette saison · ${presentTotal} au total`}
            tone="pine"
          />
          {allStages.length > 0 ? (
            <StatTile
              label="Stages au dojo"
              value={stagesThisSeason.filter((s) => s.type === "dojo").length}
              hint={`${stagesThisSeason.length} stage${stagesThisSeason.length > 1 ? "s" : ""} cette saison · ${stagesDojo.length} au dojo total`}
            />
          ) : (
            <PendingTile
              label="Stages au dojo"
              reason="Aucun stage enregistré — alimenté par le prof depuis son Dashboard."
            />
          )}
        </div>
      </div>

      {/* Badges — bannière compacte qui ouvre le tableau d'honneur en
          plein écran (25 badges, 7 catégories). */}
      <div className="px-5 mt-7">
        <button
          type="button"
          onClick={() => setBadgesOpen(true)}
          className="w-full bg-paper-card border border-gold/40 rounded-[18px] px-4 py-4 flex items-center gap-4 shadow-card transition-colors hover:border-gold/70 text-left"
        >
          <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(145deg,#DCBD7C,#A98146)" }}>
            <Award size={20} style={{ color: "#2A1E08" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] tracking-seal font-bold uppercase" style={{ color: "#A98146" }}>
              Le tableau d'honneur
            </div>
            <div className="font-serif text-[15.5px] font-semibold text-ink mt-0.5">
              {earnedCount} / {badges.length} badges obtenus
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-[rgba(34,30,24,0.06)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round((earnedCount / badges.length) * 100)}%`, background: "#C9A86A" }}
              />
            </div>
          </div>
          <ChevronDown size={14} className="text-ink-muted -rotate-90 shrink-0" />
        </button>
      </div>

      {/* Saison — frise chronologique des grades et stages de la saison. */}
      <div className="px-5 mt-7">
        <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
          Saison {season.label}
        </div>
        {seasonTimeline.length === 0 ? (
          <div className="bg-paper-card border border-dashed border-[rgba(34,30,24,0.18)] rounded-[16px] px-4 py-5 text-center text-[12.5px] text-ink-muted italic">
            La frise se remplira au fil des stages et passages de grade de l'année.
          </div>
        ) : (
          <div className="bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[16px] p-3 shadow-card">
            <div className="relative pl-4">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[rgba(34,30,24,0.12)]" />
              {seasonTimeline.map((it, i) => (
                <div key={`${it.kind}-${it.when}-${i}`} className="relative flex items-start gap-3 py-2">
                  <div
                    className={`absolute -left-[1px] top-3 w-[12px] h-[12px] rounded-full border-2 border-cream-card ${
                      it.kind === "grade" ? "bg-gold" : "bg-pine"
                    }`}
                  />
                  <div className="flex-1 min-w-0 ml-3">
                    <div className="font-serif text-[13.5px] font-semibold text-ink leading-tight">
                      {it.label}
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5 leading-snug">
                      {it.sub} ·{" "}
                      <span className="tabular-nums">
                        {new Date(it.when).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Latest announcement */}
      {latest && (
        <div className="px-5 mt-7">
          <div className="text-[11px] font-bold tracking-section text-ink-soft uppercase mb-3">
            Dernière annonce
          </div>
          <div className="bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[16px] px-4 py-4 shadow-card">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-bold text-ink">{latest.author}</div>
              <div className="text-[11px] text-ink-muted">· {relativePastLabel(latest.createdAt) || latest.date}</div>
              {latest.pinned && <PinnedBadge />}
            </div>
            <div className="text-[10px] font-bold tracking-section uppercase text-pine mt-1">
              {latest.target}
            </div>
            <div className="text-[13px] text-ink-body leading-[1.55] mt-2 whitespace-pre-line line-clamp-4">
              {latest.body || (latest.type === "presence" ? "Réponds présent ou absent pour le prochain cours." : "")}
            </div>
          </div>
        </div>
      )}

      {/* Compte & déconnexion — l'adhérent peut quitter sa fiche depuis ce
          téléphone (la fiche reste en base, il pourra se réidentifier avec
          son n° de licence plus tard). */}
      {onLogout && (
        <div className="px-5 mt-9">
          <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase mb-3">
            Mon compte
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 text-left bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[16px] px-4 py-3 shadow-card transition-colors hover:border-vermillion-300"
          >
            <div className="w-9 h-9 rounded-full bg-paper border border-[rgba(34,30,24,0.07)] flex items-center justify-center shrink-0">
              <LogOut size={15} className="text-vermillion-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[14.5px] font-semibold text-ink leading-tight">
                Se déconnecter
              </div>
              <div className="text-[11.5px] text-ink-muted mt-0.5 leading-snug">
                Délie cet appareil de ta fiche · licence {member.id}.
              </div>
            </div>
            <ChevronDown size={14} className="text-ink-muted -rotate-90 shrink-0" />
          </button>
        </div>
      )}

      {celebration && (
        <CelebrationModal
          event={celebration}
          memberName={member.firstName}
          onClose={dismissCelebration}
        />
      )}

      {badgesOpen && (
        <BadgesScreen
          badges={badges}
          member={member}
          onClose={() => setBadgesOpen(false)}
          onSelfDeclareNextStage={() => setBadgesOpen(false)}
        />
      )}
    </>
  );
}

function DashboardTab({
  member,
  profMode,
  allMembers,
  courses,
  announcements,
  attendanceSessions,
  stages,
  location,
  onCreateProfile,
  onEditMyGrade,
  onOpenPointage,
  onOpenStage,
  onMemberLogout,
  onGoToGrade,
}) {
  // Profs sont stockés dans /members pour leur propre fiche, mais ne sont
  // pas des adhérents au sens des stats du club. On les écarte de tout ce
  // que le Dashboard prof totalise / répartit / classe.
  const adherents = allMembers.filter((m) => !isProfMember(m));
  const subtitle = profMode
    ? `${adherents.length} ${adherents.length > 1 ? "adhérents inscrits" : "adhérent inscrit"}`
    : member
    ? `Bonjour ${member.firstName}`
    : "Kanjo Aïkido Isulanu · Vescovato";

  return (
    <div key="dashboard" className="pb-7 animate-slide-in-right">
      {/* Header */}
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+3.75rem)]">
        <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase">
          {profMode ? "Mode prof" : member ? "Mon tableau" : "Bienvenue"}
        </div>
        <div className="font-serif text-[36px] font-semibold leading-none mt-2 text-ink">
          Dashboard
        </div>
        <div className="text-[13px] text-ink-soft mt-1.5">{subtitle}</div>
      </div>

      {profMode ? (
        <ProfDashboard
          members={adherents}
          sessions={attendanceSessions}
          stages={stages}
          onOpenPointage={onOpenPointage}
          onOpenStage={onOpenStage}
        />
      ) : (
        <MemberDashboard
          member={member}
          courses={courses}
          announcements={announcements}
          attendanceSessions={attendanceSessions}
          stages={stages}
          location={location}
          profMode={profMode}
          onCreateProfile={onCreateProfile}
          onEditMyGrade={onEditMyGrade}
          onLogout={onMemberLogout}
          onGoToGrade={onGoToGrade}
        />
      )}
    </div>
  );
}

function MemberCard({ m, onEdit }) {
  const g = GRADES.find((x) => x.id === m.grade);
  const dt = formatObtained(m.gradeObtainedAt);
  const cat = ageCategory(m.birthYM);
  const yrs = ageInYears(m.birthYM);
  const idx = GRADES.findIndex((x) => x.id === m.grade);
  const next = idx >= 0 && idx < GRADES.length - 1 ? GRADES[idx + 1] : null;
  const targetMonths = next ? (MIN_MONTHS_TO_REACH[next.id] || 0) : 0;
  const elapsed = m.gradeObtainedAt ? monthsSince(m.gradeObtainedAt) : 0;
  const pct = next && targetMonths > 0
    ? Math.min(100, Math.round((elapsed / targetMonths) * 100))
    : 0;
  const monthsLeft = next ? Math.max(0, targetMonths - elapsed) : 0;
  return (
    <button
      onClick={() => onEdit(m)}
      className="bg-paper-card border border-[rgba(34,30,24,0.07)] rounded-[16px] px-4 py-3 shadow-card text-left transition-colors hover:border-pine/20"
    >
      <div className="flex items-center gap-3.5">
        <div
          className="w-[30px] h-[12px] rounded shrink-0 ring-1 ring-[rgba(241,232,210,0.45)]"
          style={{ backgroundColor: BELT_COLOR[m.grade] || "#FFFFFF" }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[15px] font-semibold text-ink">
            {m.firstName} {m.lastName}
          </div>
          <div className="text-[11px] text-ink-muted">
            Licence {m.id} · {g?.label || "—"}
            {dt && ` · depuis ${dt}`}
          </div>
        </div>
        {cat ? (
          <div
            className={`text-[10px] font-bold tracking-section uppercase rounded-full px-2 py-0.5 shrink-0 ${
              cat === "enfant"
                ? "bg-gold/15 text-gold border border-gold/30"
                : "bg-pine/10 text-pine border border-pine/30"
            }`}
          >
            {cat} · {yrs}
          </div>
        ) : (
          <div className="text-[10px] font-bold tracking-section uppercase rounded-full px-2 py-0.5 shrink-0 bg-paper text-ink-muted border border-dashed border-[rgba(34,30,24,0.2)]">
            naissance ?
          </div>
        )}
        <Pencil size={15} className="text-ink-muted shrink-0" />
      </div>

      {next && targetMonths > 0 && m.gradeObtainedAt && (
        <div className="mt-2.5 pl-[42px]">
          <div className="flex items-center justify-between text-[11px] text-ink-muted">
            <span>
              Vers <strong className="text-ink-soft">{next.label}</strong>
            </span>
            <span className="tabular-nums">
              {monthsLeft > 0
                ? `Encore ~${monthsLeft.toFixed(1)} mois`
                : "Durée minimale atteinte"}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-[rgba(34,30,24,0.05)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                monthsLeft === 0 ? "bg-gold" : "bg-pine"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      {!next && (
        <div className="mt-2 pl-[42px] text-[11px] text-ink-muted italic">
          Grade le plus haut du programme.
        </div>
      )}
      {next && !m.gradeObtainedAt && (
        <div className="mt-2 pl-[42px] text-[11px] text-ink-muted italic">
          Date d'obtention manquante — renseigne-la pour suivre la progression.
        </div>
      )}
    </button>
  );
}

function MembersTab({ members, onEdit, onAdd }) {
  // Split par catégorie : adultes / enfants / non classés (sans birthYM).
  const adultes = members.filter((m) => ageCategory(m.birthYM) === "adulte");
  const enfants = members.filter((m) => ageCategory(m.birthYM) === "enfant");
  const aClasser = members.filter((m) => ageCategory(m.birthYM) == null);

  const groups = [
    { key: "adultes", label: "Adultes", list: adultes, kanji: "大" },
    { key: "enfants", label: "Enfants", list: enfants, kanji: "子" },
  ];
  if (aClasser.length > 0) {
    groups.push({ key: "aClasser", label: "À classer", list: aClasser, kanji: "?" });
  }

  return (
    <div key="members" className="pb-7 animate-slide-in-right">
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+3.75rem)] flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-bold tracking-seal text-gold uppercase">
            Mode prof
          </div>
          <div className="font-serif text-[36px] font-semibold leading-none mt-2 text-ink">
            Membres
          </div>
          <div className="text-[13px] text-ink-soft mt-1.5">
            {adultes.length} adulte{adultes.length > 1 ? "s" : ""} · {enfants.length} enfant{enfants.length > 1 ? "s" : ""}
            {aClasser.length > 0 && ` · ${aClasser.length} à classer`}
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 flex items-center gap-1.5 text-[12.5px] font-semibold text-paper bg-pine rounded-full pl-3 pr-4 py-2 shadow-card transition-transform active:scale-[0.98]"
          title="Ajouter un adhérent"
        >
          <UserPlus size={14} />
          Ajouter
        </button>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-16 px-4 mt-4">
          <Enso className="w-20 h-20 mx-auto mb-4" />
          <div className="font-serif italic text-[16px] text-ink mb-1.5">
            Aucun adhérent enregistré.
          </div>
          <div className="text-[12.5px] text-ink-soft leading-relaxed max-w-[240px] mx-auto">
            Tape sur <strong>Ajouter</strong> pour créer la première fiche — l'adhérent pourra ensuite la lier à son téléphone via son n° de licence.
          </div>
        </div>
      ) : (
        <div className="px-5 mt-5 flex flex-col gap-5">
          {groups.map((grp) => (
            <div key={grp.key}>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <div className="font-serif text-[10px] text-ink-muted">{grp.kanji}</div>
                <div className="text-[10.5px] font-bold tracking-section text-ink-soft uppercase">
                  {grp.label}
                </div>
                <div className="flex-1 h-px hairline" />
                <div className="font-serif text-[14px] font-semibold text-ink tabular-nums">
                  {grp.list.length}
                </div>
              </div>
              {grp.list.length === 0 ? (
                <div className="text-[11.5px] text-ink-muted italic px-1 py-1">
                  {grp.key === "aClasser"
                    ? "Toutes les fiches ont un mois de naissance — bravo !"
                    : `Aucun ${grp.label.toLowerCase()} pour l'instant.`}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {grp.list.map((m) => (
                    <MemberCard key={m.id} m={m} onEdit={onEdit} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfGateModal({ onAuthenticated, onClose }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);

  function submit(e) {
    e.preventDefault();
    const name = authenticateProf(code);
    if (!name) {
      setError("Code incorrect");
      return;
    }
    onAuthenticated(name);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-night/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 pt-[max(env(safe-area-inset-top),1rem)] sm:pt-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-sm rounded-2xl shadow-device border border-sand-200 p-5 space-y-4 animate-slide-up"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-night flex items-center justify-center shrink-0">
            <KeyRound size={16} className="text-sand-50" />
          </div>
          <div className="flex-1">
            <div className="font-display text-[15px] font-extrabold text-ink leading-tight">
              Mode prof
            </div>
            <div className="text-[12px] text-sand-500 mt-0.5 leading-relaxed">
              Entrez votre code personnel pour publier des annonces et lancer des appels.
            </div>
          </div>
        </div>

        <input
          autoFocus
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="Code à 4 chiffres"
          className={`w-full text-center font-display text-[20px] font-bold tracking-[0.5em] border rounded-xl py-3 bg-sand-50 focus:outline-none focus:border-ink ${
            error ? "border-vermillion-500" : "border-sand-300"
          }`}
        />

        {error && (
          <div className="text-[12px] text-vermillion-500 text-center -mt-2">{error}</div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-[12.5px] font-semibold text-sand-500 px-4 py-2"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="text-[12.5px] font-semibold text-sand-50 bg-night rounded-lg px-4 py-2 flex items-center gap-1.5 shadow-card transition-transform active:scale-[0.98]"
          >
            <Check size={14} />
            Valider
          </button>
        </div>
      </form>
    </div>
  );
}
