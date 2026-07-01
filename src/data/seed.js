// Pure data used as Firestore seed in production and as the in-memory
// fallback when Firebase environment variables are not yet configured.
// LOCATIONS / DAYS / PROFS / ROLL_CALL_TARGETS / HISTORY / DOJO_INFO /
// FEES / LINKS / GRADES are reference content that lives in code; only
// SEED_COURSES and SEED_ANNOUNCEMENTS are mirrored into Firestore so the
// schedule and announcements can be edited without a redeploy.


export const LOCATIONS = ["Vescovato"];
export const DAYS = ["Mercredi", "Jeudi", "Samedi"];

// Créneaux repris de la maquette de design Kanjo (exemples) — à confirmer
// avec les horaires réels du dojo de Vescovato.
export const SEED_COURSES = [
  {
    id: 1,
    day: "Mercredi",
    start: "17:00",
    end: "18:00",
    title: "Enfants 7-12 ans",
    prof: "Sébastien",
    location: "Vescovato",
    status: "normal",
    baseline: 11,
  },
  {
    id: 2,
    day: "Jeudi",
    start: "19:00",
    end: "21:00",
    title: "Adultes · Tous niveaux",
    prof: "Sébastien",
    location: "Vescovato",
    status: "normal",
    baseline: 14,
  },
  {
    id: 3,
    day: "Samedi",
    start: "10:00",
    end: "12:00",
    title: "Armes · Bokken & Jō",
    prof: "Sébastien",
    location: "Vescovato",
    status: "normal",
    baseline: 8,
  },
];

export const SEED_ANNOUNCEMENTS = [];

export const PROFS = ["Sébastien", "Jean-Charles"];

// Liste des profs identifiables dans la collection /members — sert à les
// exclure du pointage et des classements (un prof n'est pas un adhérent
// dont on coche la présence). On match sur le couple prénom + nom (en
// ignorant la casse et les espaces) plutôt que sur le nom seul, sinon on
// exclurait aussi les membres de la famille — typiquement les enfants
// d'un prof qui partagent le même nom.
export const PROF_MEMBERS = [
  { firstName: "Sébastien", lastName: "De Raedt" },
  { firstName: "Jean-Charles", lastName: "Lanusse" },
];

export const ROLL_CALL_TARGETS = ["Adultes · Tous niveaux", "Armes · Bokken & Jō", "Enfants 7-12 ans", "Tout le club"];

// Esprit & histoire du Kanjo Aïkido Isulanu (à valider avec l'enseignant).

export const HISTORY = [
  "L'Aïkido a été fondé au Japon dans les années 1930 par Morihei Ueshiba, O Sensei. Plutôt qu'un affrontement, il propose de canaliser l'énergie d'une attaque pour la rediriger — un art martial sans compétition, tourné vers le développement personnel.",
  "Nobuyoshi Tamura, élève proche d'O Sensei, a implanté l'Aïkido en France à partir de 1964 et a participé à la création de la FFAB, structurant la pédagogie, les examens et les stages encore en usage aujourd'hui.",
  "En 2009, Tamura Senseï choisit le nom « Kanjo » — 感情, tendre la main à l'autre pour avancer ensemble. Le Kanjo Aïkido Isulanu fait vivre cet esprit en Corse : un dojo ouvert à tous, sans esprit de compétition, affilié FFAB et reconnu par l'Aïkikaï de Tokyo.",
];

export const DOJO_INFO = {
  name: "Dojo Kanjo Aïkido Isulanu",
  address: "Vescovato (Haute-Corse)", // TODO: adresse précise
  phone: "", // TODO: téléphone du club
  contact: "Sébastien De Raedt (enseignant)",
  trial: "2 cours d'essai gratuits, sans engagement",
  medical: "Certificat médical obligatoire dès le début de la saison",
};

// TODO: confirmer la grille tarifaire réelle du club.
export const FEES = [
  { label: "Enfants (7–12 ans)", amount: "195 €", note: "Pass'Sport accepté" },
  { label: "Ados / Adultes", amount: "255 €" },
  { label: "Tarif famille (1 adulte + 1 enfant)", amount: "315 €" },
];

// TODO: renseigner les réseaux sociaux réels du Kanjo Aïkido Isulanu.
export const LINKS = [
  { label: "FFAB", url: "https://www.ffabaikido.fr/fr/" },
];

// Fiches de progression — Kanjo Aïkido Isulanu / FFAB
export const GRADES = [
  {
    id: "debutant",
    label: "Débutant",
    belt: "Sans grade",
    swatch: "bg-stone-100 border border-stone-300",
    barClass: "bg-stone-100 border-b border-stone-300",
    duration: "Dès l'inscription",
    basics:
      "Découverte du dojo — étiquette, premiers ukemi (chutes), garde, déplacements de base. Aucune exigence technique : on s'imprègne du rythme.",
    attacks: [],
    sections: [],
    extras: [],
    culture: [
      "Reishiki : « les formes du respect » — la pratique commence par le salut",
      "Le Sensei n'est pas un combattant, c'est un guide sur la Voie",
    ],
  },
  {
    id: "6kyu",
    label: "6e Kyu",
    belt: "Ceinture blanche",
    swatch: "bg-white border border-stone-300",
    barClass: "bg-white border-b border-stone-300",
    duration: "1 an minimum après le Débutant",
    basics:
      "Étiquette du dojo (salut, Reishiki), chutes (ukemi), premiers déplacements (irimi, tenkan), garde (kamae). Premiers contacts avec Shomen uchi et Ryote dori, sans exigence technique.",
    attacks: [],
    sections: [],
    extras: [],
    culture: [
      "Aïkido : « la voie de l'harmonie des énergies » (Aï = harmonie/union, Ki = énergie, Do = voie)",
      "Fondateur : Morihei Ueshiba, dit O Senseï (« grand maître »), né en 1883 au Japon",
      "Le Dojo est « le lieu où l'on étudie la Voie »",
    ],
  },
  {
    id: "5kyu",
    label: "5e Kyu",
    belt: "Ceinture jaune",
    swatch: "bg-yellow-400",
    barClass: "bg-yellow-400",
    duration: "1 an minimum après le 6e Kyu",
    basics: null,
    attacks: ["Shomen uchi", "Ryote dori"],
    sections: [
      { title: "Suwariwaza (à genoux)", rows: [{ attack: "Shomen uchi", techniques: "Ikkyo, Irimi nage" }] },
      { title: "Tachiwaza (debout)", rows: [{ attack: "Ryote dori", techniques: "Tenchi nage" }] },
    ],
    extras: [],
    culture: [
      "O Senseï forge l'Aïkido à partir d'arts martiaux plus anciens (jujutsu, kenjutsu)",
      "Le nom « Aïkido » est officiellement adopté en 1942",
      "L'Aïkido est pensé comme un art de paix, non de combat ou de compétition",
    ],
  },
  {
    id: "4kyu",
    label: "4e Kyu",
    belt: "Ceinture orange",
    swatch: "bg-orange-500",
    barClass: "bg-orange-500",
    duration: "1 an minimum après le 5e Kyu",
    basics: null,
    attacks: ["Shomen uchi", "Ryote dori", "Kata dori", "Yokomen uchi"],
    sections: [
      {
        title: "Suwariwaza (à genoux)",
        rows: [{ attack: "Shomen uchi", techniques: "Ikkyo, Nikyo, Irimi nage, Kote gaeshi" }],
      },
      {
        title: "Tachiwaza (debout)",
        rows: [
          { attack: "Ryote dori", techniques: "Tenchi nage" },
          { attack: "Kata dori", techniques: "Ikkyo" },
          { attack: "Yokomen uchi", techniques: "Shiho nage" },
        ],
      },
    ],
    extras: [],
    culture: [
      "Le Hombu Dojo (Aïkikaï) à Tokyo est le siège mondial de l'Aïkido",
      "O Senseï décède en 1969 ; son fils Kisshomaru Ueshiba devient Doshu (« héritier de la Voie »)",
      "L'Aïkido se diffuse en Europe via plusieurs élèves directs d'O Senseï envoyés à l'étranger",
    ],
  },
  {
    id: "3kyu",
    label: "3e Kyu",
    belt: "Ceinture verte",
    swatch: "bg-green-600",
    barClass: "bg-green-600",
    duration: "1 an minimum après le 4e Kyu",
    basics: null,
    attacks: ["Shomen uchi", "Katate dori", "Kata dori", "Kata dori menuchi", "Ryote dori", "Chudan tsuki", "Yokomen uchi"],
    sections: [
      {
        title: "Suwariwaza (à genoux)",
        rows: [{ attack: "Shomen uchi", techniques: "Ikkyo, Nikyo, Sankyo, Irimi nage, Kote gaeshi" }],
      },
      {
        title: "Hanmihandachi waza (tori à genoux, uke debout)",
        rows: [{ attack: "Katate dori", techniques: "Ikkyo, Shiho nage" }],
      },
      {
        title: "Tachiwaza (debout)",
        rows: [
          { attack: "Kata dori", techniques: "Ikkyo, Nikyo" },
          { attack: "Kata dori menuchi", techniques: "Ikkyo" },
          { attack: "Ryote dori", techniques: "Tenchi nage, Koshi nage" },
          { attack: "Chudan tsuki", techniques: "Irimi nage, Kote gaeshi" },
          { attack: "Yokomen uchi", techniques: "Ikkyo, Shiho nage, Kote gaeshi, Irimi nage" },
        ],
      },
    ],
    extras: [],
    culture: [
      "Nobuyoshi Tamura (1933-2010), élève direct d'O Senseï, arrive en France (Marseille) en 1964",
      "Plus de 40 ans consacrés à structurer et diffuser l'Aïkido en France et en Europe",
      "À l'origine, l'Aïkido est rattaché à la Fédération Française de Judo, faute de structure propre",
    ],
  },
  {
    id: "2kyu",
    label: "2e Kyu",
    belt: "Ceinture bleue",
    swatch: "bg-blue-600",
    barClass: "bg-blue-600",
    duration: "1 an minimum après le 3e Kyu",
    basics: null,
    attacks: ["Shomen uchi", "Katate dori", "Kata dori", "Kata dori menuchi", "Ryote dori", "Chudan tsuki", "Yokomen uchi"],
    sections: [
      {
        title: "Suwariwaza (à genoux)",
        rows: [{ attack: "Shomen uchi", techniques: "Ikkyo, Nikyo, Sankyo, Yonkyo, Irimi nage, Kote gaeshi" }],
      },
      {
        title: "Hanmihandachi waza",
        rows: [{ attack: "Katate dori", techniques: "Ikkyo, Shiho nage, Irimi nage, Kote gaeshi" }],
      },
      {
        title: "Tachiwaza (debout)",
        rows: [
          { attack: "Kata dori", techniques: "Ikkyo, Nikyo" },
          { attack: "Kata dori menuchi", techniques: "Ikkyo, Shiho nage, Kote gaeshi, Udekime nage" },
          { attack: "Ryote dori", techniques: "Tenchi nage, Koshi nage" },
          { attack: "Chudan tsuki", techniques: "Ikkyo, Irimi nage, Kote gaeshi" },
          { attack: "Yokomen uchi", techniques: "Ikkyo, Shiho nage, Kote gaeshi, Irimi nage" },
        ],
      },
      {
        title: "Ushiro waza (attaques de dos)",
        rows: [{ attack: "Ryote dori", techniques: "Ikkyo, Kote gaeshi" }],
      },
    ],
    extras: [
      {
        title: "Initiation aux armes",
        rows: [
          { label: "Bokken", value: "Suburi de base : shomen uchi, yokomen uchi" },
          { label: "Jo", value: "Suburi de base : tsuki, uchikomi" },
          { label: "Sensibilisation Tanto dori", value: "Travail de ma-ai (distance) face au couteau, sans technique imposée" },
        ],
      },
    ],
    culture: [
      "En 1982, sous l'impulsion de Tamura Senseï, naît une fédération autonome (renommée FFAB en 1985)",
      "Tamura devient Directeur Technique National : il structure les programmes de grades encore utilisés aujourd'hui",
      "La FFAB est reconnue par l'Aïkikaï de Tokyo",
    ],
  },
  {
    id: "1kyu",
    label: "1er Kyu",
    belt: "Ceinture marron",
    swatch: "bg-amber-800",
    barClass: "bg-amber-800",
    duration: "1 an minimum après le 2e Kyu",
    note: "Programme calqué sur l'examen Shodan FFAB",
    basics: null,
    attacks: ["Shomen uchi", "Katate dori", "Kata dori", "Kata dori menuchi", "Ryote dori", "Chudan tsuki", "Yokomen uchi"],
    sections: [
      {
        title: "Suwariwaza (à genoux)",
        rows: [{ attack: "Shomen uchi", techniques: "Ikkyo, Nikyo, Sankyo, Yonkyo, Gokyo, Irimi nage, Kote gaeshi" }],
      },
      {
        title: "Hanmihandachi waza",
        rows: [{ attack: "Katate dori", techniques: "Ikkyo, Nikyo, Shiho nage, Uchi kaiten nage, Irimi nage, Kote gaeshi" }],
      },
      {
        title: "Tachiwaza (debout)",
        rows: [
          { attack: "Kata dori", techniques: "Ikkyo, Nikyo" },
          { attack: "Kata dori menuchi", techniques: "Ikkyo, Shiho nage, Udekime nage, Kote gaeshi" },
          { attack: "Ryote dori", techniques: "Tenchi nage, Koshi nage" },
          { attack: "Chudan tsuki", techniques: "Irimi nage, Jiyu waza" },
          { attack: "Yokomen uchi", techniques: "Ikkyo, Shiho nage, Jiyu waza" },
        ],
      },
      {
        title: "Ushiro waza (attaques de dos)",
        rows: [{ attack: "Ryote dori", techniques: "Ikkyo, Irimi nage, Shiho nage, Kote gaeshi" }],
      },
    ],
    extras: [
      {
        title: "Préparation Shodan — armes & situations multiples",
        rows: [
          { label: "Tanto dori (défense couteau)", value: "Yokomen uchi → Gokyo" },
          { label: "Jo dori (défense bâton)", value: "Chudan tsuki → Jiyu waza" },
          { label: "Jo nage waza", value: "Jiyu waza" },
          { label: "Taninzu gake (attaques multiples)", value: "Ryote dori → Jiyu waza" },
        ],
      },
    ],
    culture: [
      "L'esprit de l'Aïkido selon O Senseï : un art de paix, fondé sur l'harmonie plutôt que sur l'opposition",
      "Chaîne de transmission : O Senseï → Tamura Senseï → enseignants FFAB → son professeur",
      "Son club : Kanjo Aïkido Isulanu, dojo corse affilié FFAB et reconnu par l'Aïkikaï de Tokyo",
    ],
  },
  {
    id: "shodan",
    label: "Shodan",
    belt: "Ceinture noire — Shodan",
    swatch: "bg-stone-900",
    barClass: "bg-stone-900",
    duration: "12 mois minimum après le 1er Kyu",
    note: "Examen FFAB officiel — programme intégral des Kyu + buki + situations libres",
    basics:
      "Maîtrise de l'ensemble du programme des Kyu (du 6e Kyu au 1er Kyu) avec une exécution fluide adaptée à uke. Présence, ma-ai, kokyu et liaison entre techniques.",
    attacks: [
      "Shomen uchi",
      "Yokomen uchi",
      "Katate dori",
      "Kata dori",
      "Kata dori menuchi",
      "Ryote dori",
      "Chudan tsuki",
      "Jodan tsuki",
      "Ushiro waza",
    ],
    sections: [
      {
        title: "Suwariwaza (à genoux)",
        rows: [
          { attack: "Shomen uchi", techniques: "Ikkyo, Nikyo, Sankyo, Yonkyo, Gokyo, Irimi nage, Kote gaeshi" },
          { attack: "Ryote dori", techniques: "Kokyu ho" },
        ],
      },
      {
        title: "Hanmihandachi waza (tori à genoux, uke debout)",
        rows: [
          { attack: "Katate dori", techniques: "Ikkyo, Nikyo, Shiho nage, Uchi kaiten nage, Irimi nage, Kote gaeshi" },
          { attack: "Ryote dori", techniques: "Shiho nage, Kote gaeshi" },
          { attack: "Shomen uchi", techniques: "Ikkyo, Irimi nage" },
        ],
      },
      {
        title: "Tachiwaza (debout)",
        rows: [
          { attack: "Katate dori", techniques: "Programme complet du 1er Kyu + Jiyu waza" },
          { attack: "Kata dori menuchi", techniques: "Ikkyo, Shiho nage, Udekime nage, Kote gaeshi" },
          { attack: "Ryote dori", techniques: "Tenchi nage, Koshi nage, Shiho nage" },
          { attack: "Shomen uchi", techniques: "Ikkyo → Gokyo, Irimi nage, Kote gaeshi, Sumi otoshi" },
          { attack: "Yokomen uchi", techniques: "Shiho nage, Kote gaeshi, Irimi nage, Jiyu waza" },
          { attack: "Chudan tsuki", techniques: "Irimi nage, Kote gaeshi, Sumi otoshi, Jiyu waza" },
        ],
      },
      {
        title: "Ushiro waza (attaques de dos)",
        rows: [
          { attack: "Ryote dori", techniques: "Ikkyo, Irimi nage, Shiho nage, Kote gaeshi, Koshi nage" },
          { attack: "Ryo kata dori", techniques: "Ikkyo" },
          { attack: "Eri dori", techniques: "Kokyu nage" },
          { attack: "Kubi shime", techniques: "Sankyo, Koshi nage" },
        ],
      },
    ],
    extras: [
      {
        title: "Défense contre armes",
        rows: [
          { label: "Tachi dori (sabre)", value: "Shomen uchi → Ikkyo, Kote gaeshi, Shiho nage" },
          { label: "Jo dori (bâton)", value: "Chudan tsuki + gedan → Jiyu waza" },
          { label: "Tanto dori (couteau)", value: "Shomen uchi, Yokomen uchi, Chudan tsuki → Jiyu waza" },
        ],
      },
      {
        title: "Situations libres",
        rows: [
          { label: "Jiyu waza", value: "Katate dori puis toutes attaques libres" },
          { label: "Taninzu gake (multi-attaquants)", value: "2 ukes minimum" },
        ],
      },
    ],
    culture: [
      "« Shodan » signifie littéralement « premier degré » — c'est l'entrée dans la Voie, pas son aboutissement.",
      "À ce niveau, le jury attend une intégration complète des bases plutôt qu'une virtuosité technique.",
      "L'examen est passé devant un jury fédéral, généralement lors d'un stage régional ou national.",
    ],
  },
  {
    id: "nidan",
    label: "Nidan",
    belt: "Ceinture noire — Nidan",
    swatch: "bg-stone-900",
    barClass: "bg-stone-900",
    duration: "2 ans minimum après le Shodan",
    note: "Programme Shodan revu en profondeur + premières études d'armes",
    basics:
      "Au-delà des techniques, le Nidan demande une qualité de mouvement, une compréhension du ma-ai et une respiration partagée avec uke. Programme intégral du Shodan exécuté avec plus de fluidité et de naturel.",
    attacks: ["Toutes les attaques du Shodan", "Étude des armes (bokken, jo)"],
    sections: [
      {
        title: "Approfondissement Shodan",
        rows: [
          { attack: "Toutes attaques", techniques: "Programme intégral du Shodan — exigence accrue sur la fluidité et l'ukemi" },
          { attack: "Henka waza (variations)", techniques: "Sur les attaques principales" },
        ],
      },
    ],
    extras: [
      {
        title: "Suburi et kata des armes",
        rows: [
          { label: "Bokken — suburi", value: "7 suburi de base (shomen, yokomen, tsuki, hasso, kesa giri…)" },
          { label: "Jo — suburi", value: "20 suburi (Tsuki no bu, Uchikomi no bu, Katate no bu, Hasso gaeshi no bu, Nagare gaeshi no bu)" },
          { label: "Kumi tachi", value: "1er kumi tachi (paire au sabre)" },
          { label: "Kumi jo", value: "Sanjuichi no jo (kata des 31 mouvements)" },
        ],
      },
      {
        title: "Situations libres",
        rows: [
          { label: "Jiyu waza", value: "Sur 3 attaques minimum annoncées par le jury" },
          { label: "Taninzu gake", value: "3 ukes" },
        ],
      },
    ],
    culture: [
      "Le Nidan marque traditionnellement le passage « de la technique à la compréhension ».",
      "Tamura Sensei rappelait : « sans souffle (kokyu), pas d'aïkido ».",
      "C'est le grade où l'on commence sérieusement les armes, et où l'on attend une qualité de présence (zanshin).",
    ],
  },
  {
    id: "sandan",
    label: "Sandan",
    belt: "Ceinture noire — Sandan",
    swatch: "bg-stone-900",
    barClass: "bg-stone-900",
    duration: "3 ans minimum après le Nidan",
    note: "Approfondissement des armes, henka waza, capacité de transmission",
    basics:
      "Le Sandan demande de transmettre — démontrer en gardant l'attention sur uke, sans précipitation ni démonstration personnelle. C'est le grade traditionnellement requis pour devenir enseignant titulaire FFAB.",
    attacks: ["Toutes attaques", "Variations (henka waza) et enchaînements (renzoku waza)"],
    sections: [],
    extras: [
      {
        title: "Kumi tachi (paire au sabre)",
        rows: [{ label: "Kata", value: "Kumi tachi 1 à 5" }],
      },
      {
        title: "Kumi jo (paire au bâton)",
        rows: [{ label: "Kata", value: "Kumi jo 1 à 10" }],
      },
      {
        title: "Henka waza & renzoku waza",
        rows: [
          { label: "Variations", value: "Sur toutes les attaques principales" },
          { label: "Enchaînements", value: "Capacité à enchaîner plusieurs techniques sur la même attaque" },
        ],
      },
      {
        title: "Situations libres",
        rows: [
          { label: "Jiyu waza", value: "Toutes attaques avec transitions" },
          { label: "Taninzu gake", value: "4 ukes" },
        ],
      },
    ],
    culture: [
      "« Sandan » : trois degrés. Le pratiquant entre officiellement dans le rôle de transmission.",
      "Le Sandan est traditionnellement requis pour devenir enseignant titulaire FFAB (BF, BE).",
      "À ce niveau, l'examen évalue aussi la cohérence pédagogique : capacité à expliquer, à corriger, à structurer.",
    ],
  },
  {
    id: "yondan",
    label: "Yondan",
    belt: "Ceinture noire — Yondan",
    swatch: "bg-stone-900",
    barClass: "bg-stone-900",
    duration: "4 ans minimum après le Sandan",
    note: "Démonstration globale + connaissance pédagogique — pas de programme rigide",
    basics:
      "Le Yondan est avant tout une démonstration de la Voie incarnée. Pas de programme strict : le jury évalue la cohérence entre technique, pédagogie et présence. Ouvre traditionnellement la voie au brevet d'enseignement.",
    attacks: [],
    sections: [],
    extras: [
      {
        title: "Démonstration globale",
        rows: [
          { label: "Tachiwaza", value: "Choix libre du jury, programme adapté" },
          { label: "Buki (armes)", value: "Tachi dori, Jo dori, Tanto dori — sur attaques annoncées" },
          { label: "Jiyu waza & taninzu gake", value: "Selon demande du jury" },
        ],
      },
      {
        title: "Connaissance pédagogique",
        rows: [
          { label: "Cours", value: "Capacité à présenter un cours structuré (échauffement, thème, exercices, jiyu)" },
          { label: "Lignée & FFAB", value: "Connaissance de la transmission O Senseï → Tamura Senseï → FFAB" },
        ],
      },
    ],
    culture: [
      "« Yondan » : quatre degrés. Paradoxalement, la voie se simplifie — moins de techniques, plus de présence.",
      "Le Yondan ouvre la voie au brevet fédéral d'enseignement (BF, BE) pour ceux qui ne l'ont pas déjà.",
      "À ce niveau, le pratiquant est généralement reconnu comme référent technique dans son club.",
    ],
  },
  {
    id: "godan",
    label: "Godan",
    belt: "Ceinture noire — Godan",
    swatch: "bg-stone-900",
    barClass: "bg-stone-900",
    duration: "5 ans minimum après le Yondan",
    note: "Grade accordé sur recommandation — présentation libre, pas d'examen formel",
    basics:
      "Le Godan est rare et accordé sur recommandation d'un Shihan (généralement le DTN ou un membre du Collège Technique). Pas d'examen formel au sens des grades inférieurs : présentation libre, mémoire ou démonstration sur thème choisi.",
    attacks: [],
    sections: [],
    extras: [
      {
        title: "Présentation libre",
        rows: [
          { label: "Format", value: "À discuter avec le jury / le référent" },
          { label: "Mémoire optionnelle", value: "Sur un thème pédagogique, technique ou philosophique" },
          { label: "Démonstration", value: "Sur un thème choisi par le candidat" },
        ],
      },
    ],
    culture: [
      "« Godan » : cinquième degré. Plafond standard de la pratique fédérale en France.",
      "Au-delà, les grades (Rokudan, Shichidan, Hachidan) sont attribués par l'Aïkikaï de Tokyo sur recommandation des shihan.",
      "À ce niveau, la pratique dépasse largement le cadre technique : c'est une voie de vie.",
    ],
  },
];
