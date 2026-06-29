// Cloud Functions — Kanjo Aïkido Isulanu
// Deux responsabilités, toutes deux optionnelles (plan Blaze requis) :
//   1. Push FCM  — à chaque nouvelle annonce / appel, notifier les
//      appareils enregistrés dans /pushTokens.
//   2. Sync Google Sheet — reporter chaque fiche adhérent (/members) dans
//      un classeur, onglets « Adultes » / « Enfants » selon l'âge.
//
// Sans ces functions, l'app marche (pointage, badges, stats côté client),
// mais pas de push de fond ni de tableur.

const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { google } = require("googleapis");

initializeApp();
const db = getFirestore();

// ───────────────────────── Config club ─────────────────────────

const REGION = "europe-west1";

// ID du Google Sheet de sync (dans l'URL du classeur).
const SHEET_ID = "1RCYoEM84bt_RTUtUHAobbe3BVqRyrNNdTXK29BD0UnM";

// Email du compte de service qui écrit dans le Sheet. Par défaut la
// fonction tourne avec le compte de service App Engine du projet ; il faut
// PARTAGER le Google Sheet en « Éditeur » avec cet email. Pour forcer un
// autre compte, décommentez `serviceAccount` dans les options du trigger
// syncMemberToSheet ci-dessous.
// → Console Firebase → Project settings → Service accounts.

// Seuil enfant / adulte (doit rester aligné avec ADULT_AGE_THRESHOLD dans
// src/CostaVerdeApp.jsx).
const ADULT_AGE_THRESHOLD = 13;

// Libellés de grade — doivent matcher les `id` de GRADES (src/data/seed.js).
const GRADE_LABEL = {
  debutant: "Débutant",
  "6kyu": "6e Kyu",
  "5kyu": "5e Kyu",
  "4kyu": "4e Kyu",
  "3kyu": "3e Kyu",
  "2kyu": "2e Kyu",
  "1kyu": "1er Kyu",
  shodan: "Shodan",
  nidan: "Nidan",
  sandan: "Sandan",
  yondan: "Yondan",
  godan: "Godan",
};

setGlobalOptions({ region: REGION });

// ───────────────────────── 1. Push FCM ─────────────────────────

exports.onAnnouncement = onDocumentCreated(
  { region: REGION, document: "announcements/{announcementId}" },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data) return;

    const isRollCall = data.type === "presence";
    const author = data.author ? String(data.author) : "";
    const target = data.target ? String(data.target) : "";

    const title = isRollCall
      ? `Appel — ${target || "prochain cours"}`
      : author
      ? `${author} · Annonce`
      : "Nouvelle annonce";
    const body = String(data.body || "").slice(0, 240) || "Ouvre l'app pour en savoir plus.";

    const tokensSnap = await db.collection("pushTokens").get();
    const tokens = tokensSnap.docs.map((d) => d.id);
    if (tokens.length === 0) return;

    // FCM plafonne à 500 jetons par appel multicast.
    const batches = [];
    for (let i = 0; i < tokens.length; i += 500) batches.push(tokens.slice(i, i + 500));

    const invalid = [];
    for (const batch of batches) {
      const res = await getMessaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: {
          type: isRollCall ? "presence" : "info",
          announcementId: event.params.announcementId,
        },
        webpush: {
          notification: { icon: "/pwa-192x192.png", badge: "/pwa-64x64.png" },
          fcmOptions: { link: "/" },
        },
      });
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error && r.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalid.push(batch[idx]);
          }
        }
      });
    }

    // Purge des jetons morts (désinstallation, permission révoquée…).
    await Promise.all(
      invalid.map((t) => db.collection("pushTokens").doc(t).delete().catch(() => {})),
    );
  },
);

// ─────────────────────── 2. Sync Google Sheet ───────────────────────

const SHEET_HEADER = [
  "Licence",
  "Prénom",
  "Nom",
  "Grade",
  "Date de grade",
  "Naissance",
  "Lieux",
  "Inscrit le",
  "Parti le",
];
const TABS = ["Adultes", "Enfants"];

let sheetsClientPromise = null;
function getSheets() {
  if (!sheetsClientPromise) {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheetsClientPromise = auth.getClient().then((authClient) =>
      google.sheets({ version: "v4", auth: authClient }),
    );
  }
  return sheetsClientPromise;
}

function tsToDate(v) {
  if (!v) return "";
  try {
    const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    return "";
  }
}

// "YYYY-MM" → âge en années (au mois près). null si absent/illisible.
function ageFromBirthYM(birthYM) {
  if (typeof birthYM !== "string" || !/^\d{4}-\d{2}$/.test(birthYM)) return null;
  const [y, m] = birthYM.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m) age -= 1;
  return age;
}

function audienceOf(member) {
  const age = ageFromBirthYM(member.birthYM);
  // Sans date de naissance, on classe par défaut en Adultes.
  return age !== null && age < ADULT_AGE_THRESHOLD ? "Enfants" : "Adultes";
}

function memberRow(licence, m) {
  return [
    String(licence),
    m.firstName || "",
    m.lastName || "",
    GRADE_LABEL[m.grade] || m.grade || "",
    tsToDate(m.gradeObtainedAt),
    m.birthYM || "",
    Array.isArray(m.practiceLocations) ? m.practiceLocations.join(", ") : "",
    tsToDate(m.createdAt),
    tsToDate(m.leftAt),
  ];
}

// Crée les onglets manquants (+ ligne d'entête) au premier write.
// Idempotent et tolérant aux exécutions concurrentes : deux écritures de
// membres rapprochées déclenchent deux instances en parallèle qui tentent
// toutes deux de créer l'onglet — on ignore l'erreur "already exists".
async function ensureTabs(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = new Set((meta.data.sheets || []).map((s) => s.properties.title));
  for (const title of TABS) {
    if (existing.has(title)) continue;
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${title}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [SHEET_HEADER] },
      });
    } catch (e) {
      // Onglet créé entre-temps par une exécution concurrente — on ignore.
      if (!String((e && e.message) || "").includes("already exists")) throw e;
    }
  }
}

// Retire la ligne d'un adhérent (par licence en colonne A) de tous les onglets.
async function removeFromAllTabs(sheets, licence) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  for (const sheet of meta.data.sheets || []) {
    const title = sheet.properties.title;
    if (!TABS.includes(title)) continue;
    const sheetId = sheet.properties.sheetId;
    const colA = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${title}!A2:A`,
    });
    const rows = colA.data.values || [];
    for (let i = rows.length - 1; i >= 0; i--) {
      if ((rows[i][0] || "") === String(licence)) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: { sheetId, dimension: "ROWS", startIndex: i + 1, endIndex: i + 2 },
                },
              },
            ],
          },
        });
      }
    }
  }
}

exports.syncMemberToSheet = onDocumentWritten(
  // Pour forcer un compte de service précis, ajoutez :
  //   serviceAccount: "firebase-adminsdk-xxxx@<project>.iam.gserviceaccount.com"
  { region: REGION, document: "members/{licence}" },
  async (event) => {
    if (!SHEET_ID) return;
    const licence = event.params.licence;
    const after = event.data && event.data.after;
    const sheets = await getSheets();
    await ensureTabs(sheets);

    // Suppression de la fiche → on retire la ligne partout.
    if (!after || !after.exists) {
      await removeFromAllTabs(sheets, licence);
      return;
    }

    const m = after.data() || {};
    // On enlève d'abord l'éventuelle ligne existante (y compris si l'adhérent
    // a changé d'onglet : passage enfant→adulte, correction de naissance…),
    // puis on ré-insère dans le bon onglet.
    await removeFromAllTabs(sheets, licence);
    const tab = audienceOf(m);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [memberRow(licence, m)] },
    });
  },
);
