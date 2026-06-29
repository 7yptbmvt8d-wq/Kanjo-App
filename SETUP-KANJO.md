# Mise en service — Kanjo Aïkido Isulanu

Tout le code est prêt et branché sur le projet Firebase **`kanjo-aikido`**.
Il reste les étapes qui demandent **ton** accès (console Firebase, ta machine).

## 1. Activer les services Firebase (console)

Dans [Firebase Console](https://console.firebase.google.com) → projet `kanjo-aikido` :

- **Firestore Database** (mode production)
- **Storage** (affiches de stage)
- **Cloud Messaging** (push) — déjà : la clé VAPID est dans `.env.example`
- **Functions** → nécessite le plan **Blaze** (sinon : pas de push ni de sync Sheet, le reste marche)

## 2. Récupérer le code et configurer

```sh
git clone <repo> kanjo-app && cd kanjo-app
cp .env.example .env.local      # clés Firebase + VAPID + PIN déjà remplies
npm install
npm run build                   # vérifie que ça compile
```

Déjà câblé, rien à toucher :
- `.env.example` / `.env.local` — config Web + VAPID + `VITE_PROF_CODE_SEBASTIEN=0713`
- `public/firebase-messaging-sw.js` — config en dur (push de fond)
- `.firebaserc` — projet `kanjo-aikido`
- `functions/index.js` — `SHEET_ID` du Google Sheet, région `europe-west1`

## 3. Déployer

```sh
firebase login
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
firebase deploy --only functions      # uniquement si plan Blaze
```

L'app sera en ligne sur `https://kanjo-aikido.web.app`.

## 4. Peupler le planning initial

```sh
# Console → Paramètres → Comptes de service → Générer une nouvelle clé privée
#   → enregistre le fichier en serviceAccountKey.json à la racine (gitignoré !)
node scripts/seed-firestore.js
```

## 5. Sync Google Sheet (si Functions déployées)

1. Console → Paramètres → **Comptes de service** : copie l'email du compte
   de service (`...@kanjo-aikido.iam.gserviceaccount.com`).
2. Ouvre le [Google Sheet](https://docs.google.com/spreadsheets/d/1RCYoEM84bt_RTUtUHAobbe3BVqRyrNNdTXK29BD0UnM/edit)
   → **Partager** → ajoute cet email en **Éditeur**.
3. Dans [Google Cloud Console](https://console.cloud.google.com) (projet
   `kanjo-aikido`) → **APIs & Services** → active l'**API Google Sheets**.

Les onglets `Adultes` / `Enfants` et l'entête se créent au premier write.

## 6. Usage

- **Membres** : s'identifient avec leur numéro de **licence FFAB**.
- **Prof** (Sébastien) : bouton clé → **PIN 0713** → mode prof (pointage,
  annonces, appels, grades, stages).

## Contenu à finaliser (placeholders `TODO` dans `src/data/seed.js`)

- Adresse précise du dojo, téléphone du club
- Grille tarifaire réelle
- Réseaux sociaux (seul le lien FFAB est renseigné)
- Horaires de cours : repris de la maquette de design (exemples) — à
  confirmer avec les vrais créneaux de Vescovato.
