// Spec des 25 badges — porté du handoff design. Le runtime calcule
// `earned` au moment de l'affichage à partir des données du membre, des
// pointages et des stages, plus les badges manuels stockés sur la fiche.

// Catégories : la couleur du médaillon dépend de la catégorie sauf pour
// les Kyu (couleur ceinture par badge).
export const BADGE_CAT = {
  pas:    { bg: "linear-gradient(145deg,#2C5440,#16291F)", kc: "#F1E9DA" },
  dan:    { bg: "radial-gradient(circle at 35% 28%,#2c2c2c,#0f0f0f)", kc: "#C9A86A" },
  assi:   { bg: "linear-gradient(145deg,#DCBD7C,#A98146)", kc: "#2A1E08" },
  hakama: { bg: "linear-gradient(145deg,#3C3666,#1E1B33)", kc: "#E7E1FA" },
  stages: { bg: "linear-gradient(145deg,#2C5440,#16291F)", kc: "#C9A86A" },
  prof:   { bg: "linear-gradient(145deg,#7C4232,#46221A)", kc: "#F2CB8C" },
};

// Métadonnées par catégorie pour l'entête de section.
export const BADGE_SECTIONS = [
  ["pas",    "Parcours",       "Premiers pas",        null],
  ["kyu",    "Mudansha",       "Grades Kyū",          null],
  ["dan",    "Yūdansha",       "Grades Dan",          null],
  ["assi",   "Présence",       "Assiduité",           null],
  ["hakama", "Distinction",    "Hakama",              null],
  ["stages", "« J’y étais »", "Stages",          "À déclarer vous-même."],
  ["prof",   "Reconnaissance", "Distinctions du prof", "Attribuées par votre professeur."],
];

// Les 25 badges. id stable, cat, full, short (sous le médaillon),
// kanji, type, cond (texte affiché dans la modale détail), et pour les
// Kyu : kyuBg + kyuKc (couleur ceinture spécifique).
export const BADGES = [
  { id: "first-class",  cat: "pas", full: "Premier cours",      short: "Premier cours", kanji: "一", type: "auto",   cond: "Pointer au moins une présence en cours." },
  { id: "1y",           cat: "pas", full: "1 an de pratique",   short: "1 an",          kanji: "年", type: "auto",   cond: "Un an depuis votre inscription au club." },
  { id: "5y",           cat: "pas", full: "5 ans de pratique",  short: "5 ans",         kanji: "五", type: "auto",   cond: "Cinq années de pratique au dojo." },
  { id: "10y",          cat: "pas", full: "10 ans de pratique", short: "10 ans",        kanji: "十", type: "auto",   cond: "Dix années de pratique au dojo." },

  { id: "kyu-6",        cat: "kyu", full: "6e Kyū",  short: "6e Kyū",  kanji: "白", type: "auto", cond: "Atteindre le 6e kyū (ceinture blanche).", kyuBg: "#FFFFFF", kyuKc: "#221E18" },
  { id: "kyu-5",        cat: "kyu", full: "5e Kyū",  short: "5e Kyū",  kanji: "黄", type: "auto", cond: "Atteindre le 5e kyū (ceinture jaune).",  kyuBg: "#E6B422", kyuKc: "#574008" },
  { id: "kyu-4",        cat: "kyu", full: "4e Kyū",  short: "4e Kyū",  kanji: "橙", type: "auto", cond: "Atteindre le 4e kyū (ceinture orange).", kyuBg: "#D97A2B", kyuKc: "#FFF4E8" },
  { id: "kyu-3",        cat: "kyu", full: "3e Kyū",  short: "3e Kyū",  kanji: "緑", type: "auto", cond: "Atteindre le 3e kyū (ceinture verte).",  kyuBg: "#4E8B5B", kyuKc: "#F1FBF3" },
  { id: "kyu-2",        cat: "kyu", full: "2e Kyū",  short: "2e Kyū",  kanji: "青", type: "auto", cond: "Atteindre le 2e kyū (ceinture bleue).",  kyuBg: "#3A6B9A", kyuKc: "#EAF3FB" },
  { id: "kyu-1",        cat: "kyu", full: "1er Kyū", short: "1er Kyū", kanji: "茶", type: "auto", cond: "Atteindre le 1er kyū (ceinture marron).", kyuBg: "#5A3A26", kyuKc: "#F6ECE2" },

  { id: "dan-shodan",   cat: "dan", full: "Shodan", short: "Shodan", kanji: "初", type: "auto", cond: "Obtenir le 1er dan, ceinture noire." },
  { id: "dan-nidan",    cat: "dan", full: "Nidan",  short: "Nidan",  kanji: "二", type: "auto", cond: "Obtenir le 2e dan." },
  { id: "dan-sandan",   cat: "dan", full: "Sandan", short: "Sandan", kanji: "三", type: "auto", cond: "Obtenir le 3e dan." },
  { id: "dan-yondan",   cat: "dan", full: "Yondan", short: "Yondan", kanji: "四", type: "auto", cond: "Obtenir le 4e dan." },
  { id: "dan-godan",    cat: "dan", full: "Godan",  short: "Godan",  kanji: "五", type: "auto", cond: "Obtenir le 5e dan." },

  { id: "streak-10",    cat: "assi", full: "10 cours d'affilée", short: "10 d'affilée", kanji: "連", type: "auto", cond: "Dix cours consécutifs sans absence." },
  { id: "100-classes",  cat: "assi", full: "100 cours",          short: "100 cours",    kanji: "百", type: "auto", cond: "Cent présences cumulées au tatami." },

  { id: "hakama",       cat: "hakama", full: "Hakama", short: "Hakama", kanji: "袴", type: "auto", cond: "Atteindre le 3e kyū — le droit de porter le hakama." },

  { id: "stage-dojo",   cat: "stages", full: "Premier stage au dojo",         short: "Stage dojo",     kanji: "道", type: "self", cond: "Participer à un stage organisé au dojo." },
  { id: "stage-natl",   cat: "stages", full: "Premier stage national",        short: "Stage national", kanji: "国", type: "self", cond: "Participer à un stage de niveau national." },
  { id: "stage-intl",   cat: "stages", full: "Premier stage international",   short: "Stage int.",     kanji: "世", type: "self", cond: "Participer à un stage international." },

  { id: "demo",         cat: "prof", full: "Première démonstration", short: "Démonstration", kanji: "演", type: "manual", cond: "Faire une démonstration devant le groupe." },
  { id: "senpai",       cat: "prof", full: "Senpai",                 short: "Senpai",        kanji: "先", type: "manual", cond: "Devenir référent et accompagner les débutants." },
  { id: "reishiki",     cat: "prof", full: "Reishiki",               short: "Reishiki",      kanji: "礼", type: "manual", cond: "Maîtriser l'étiquette et les saluts du dojo." },
  { id: "armes",        cat: "prof", full: "Premier cours d'armes",  short: "Cours d'armes", kanji: "武", type: "manual", cond: "Suivre votre premier cours d'armes (bokken & jō)." },
];

export const BADGE_TYPE_LABEL = {
  auto: "Badge automatique",
  self: "Badge à déclarer",
  manual: "Distinction du professeur",
};

// Calcule l'état `earned` de chaque badge pour le membre courant. Tout
// est dérivé à la volée. `manualBadges` est la liste posée par le prof.
export function computeMemberBadges({
  member,
  presentTotal = 0,
  streak = 0,
  yearsOfPractice = 0,
  gradeIdx = -1,
  hakamaIdx = -1,
  stageAttendance = { dojo: false, national: false, international: false },
  manualBadges = [],
  forceBadges = [],
}) {
  const checks = {
    "first-class": presentTotal >= 1,
    "1y": yearsOfPractice >= 1,
    "5y": yearsOfPractice >= 5,
    "10y": yearsOfPractice >= 10,
    "kyu-6": gradeIdx >= 1,
    "kyu-5": gradeIdx >= 2,
    "kyu-4": gradeIdx >= 3,
    "kyu-3": gradeIdx >= 4,
    "kyu-2": gradeIdx >= 5,
    "kyu-1": gradeIdx >= 6,
    "dan-shodan": gradeIdx >= 7,
    "dan-nidan": gradeIdx >= 8,
    "dan-sandan": gradeIdx >= 9,
    "dan-yondan": gradeIdx >= 10,
    "dan-godan": gradeIdx >= 11,
    "streak-10": streak >= 10,
    "100-classes": presentTotal >= 100,
    hakama: hakamaIdx >= 0 && gradeIdx >= hakamaIdx,
    "stage-dojo": stageAttendance.dojo,
    "stage-natl": stageAttendance.national,
    "stage-intl": stageAttendance.international,
  };
  const manual = new Set(manualBadges);
  // Override `forceBadges` — sert à attribuer un badge en bypassant la
  // condition (cas des profs qui doivent tout avoir hors grades).
  const force = new Set(forceBadges);
  return BADGES.map((b) => {
    let earned;
    if (b.type === "manual") earned = manual.has(b.id);
    else earned = !!checks[b.id];
    if (force.has(b.id)) earned = true;
    return { ...b, earned };
  });
}
