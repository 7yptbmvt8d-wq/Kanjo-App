# Kanjo Aïkido Isulanu — app membres

PWA installable (Android / iOS / desktop) pour les adhérents du club
**Kanjo Aïkido Isulanu** à Vescovato (Corse).

Onglets : **Planning** (filtrable par lieu et par jour), **Annonces**
(messages descendants + appel), **Club** (histoire, dojo, tarifs, liens),
**Grades** (fiches de progression FFAB).

## Stack

- **Vite 5** + **React 18** + **Tailwind 3** (palette custom noir & or : paper / ink / pine / gold ; polices Cinzel / Cormorant Garamond / Space Grotesk)
- **vite-plugin-pwa** + **Workbox** — manifest, service worker, icônes générées depuis le logo
- **Firebase** — Firestore (planning, annonces, appel), Auth, Hosting, Cloud Messaging
- **lucide-react** pour les icônes

## Développement local

```sh
npm install
npm run dev           # http://localhost:5173
npm run build
npm run preview
```

Sans `.env.local`, l'app tourne sur les données mockées en mémoire
(voir `src/data/seed.js`). Visuel et navigation marchent ;
publier une annonce ne fait que mettre à jour l'état local.

## Configuration Firebase

1. Crée le projet sur [Firebase Console](https://console.firebase.google.com)
   (recommandé : `kanjo-aikido`).
2. Active Firestore (mode production), Authentication (Email/Password +
   Google), Hosting, Cloud Messaging.
3. Récupère la config Web (Project settings → Your apps → Web).
4. Copie `.env.example` vers `.env.local` et remplis les variables
   `VITE_FIREBASE_*`. Dès que `VITE_FIREBASE_API_KEY` et
   `VITE_FIREBASE_PROJECT_ID` sont présents, l'app bascule
   automatiquement sur Firestore.
5. Pour les pushs : récupère la VAPID key (Project settings → Cloud
   Messaging) et remplis `VITE_FIREBASE_VAPID_KEY`.

### Rôles

Le rôle d'un utilisateur est stocké dans `members/{uid}.role` :

- `member` (défaut) — peut lire le planning, les annonces, et répondre
  aux appels.
- `prof` — peut publier des annonces, lancer un appel et éditer le
  planning.

Pour promouvoir un compte, modifie le doc `members/{uid}` depuis la
console Firebase.

### Seed initial

Le contenu de `src/data/seed.js` (`SEED_COURSES`,
`SEED_ANNOUNCEMENTS`) sert de référence pour peupler Firestore la
première fois. Le plus simple : copier-coller les documents depuis la
console, ou écrire un petit script Admin SDK ponctuel.

## Déploiement (Firebase Hosting)

```sh
npm install -g firebase-tools
firebase login
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

Le build de production est lancé automatiquement par `firebase deploy`
via le `predeploy` configuré dans `firebase.json`.

## Structure

```
src/
├── App.jsx                 # Wrapper
├── CostaVerdeApp.jsx       # Composant principal (UI + état)
├── main.jsx                # Entry point + StrictMode
├── index.css               # Tailwind + safe-area + utilitaires
├── data/
│   └── seed.js             # Données de référence + fallback hors-ligne
├── firebase/
│   ├── config.js           # Init conditionnelle (env-gated)
│   ├── auth.js             # useAuth() + signIn helpers
│   ├── firestore.js        # useCollection() + writes
│   └── messaging.js        # Push notifications (FCM)
└── hooks/
    └── useClubData.js      # useCourses() / useAnnouncements()

public/
├── branding/               # Logos club + FFAB (extraits du JSX)
├── pwa-*.png               # Icônes PWA (générées)
├── favicon.ico
└── apple-touch-icon-180x180.png

scripts/
└── extract-logo.js         # One-shot : base64 → fichiers PNG/JPG
```

## Commandes utiles

```sh
npm run extract-logos       # Régénère public/branding/ depuis les base64 du JSX
npm run generate-pwa-assets # Régénère les icônes PWA depuis le logo
```
