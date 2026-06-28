# Handoff : App mobile Kanjo Aïkido Isulanu

## Overview
Application mobile pour les **membres du dojo** Kanjo Aïkido Isulanu. Prolonge l'identité
« noir profond & or » du site/logo. L'app permet à un pratiquant de voir son prochain
cours, réserver sa place au planning, explorer le dojo (esprit Kanjo, histoire, enseignant)
et suivre sa progression (grade, présences, licence).

Plateforme cible : **iOS & Android** (natif ou cross-platform). La maquette est dessinée
au format iPhone (402×874 pt, iOS 26) mais le design est volontairement simple à porter
sur Android (Material) en conservant la palette et la typographie.

## About the Design Files
Le fichier `App Kanjo Aikido.dc.html` est une **référence de design** (prototype HTML),
**pas** du code de production. Il utilise un runtime maison (`support.js`, `<x-dc>`,
`<x-import>`) et un faux bezel iPhone (`ios-frame.jsx`) **uniquement pour la présentation** —
ne pas porter ces fichiers. Le bezel, la status bar, la dynamic island et le home indicator
sont fournis par l'OS : **ne pas** les recréer. Reproduire seulement le **contenu** des écrans.

**Stack recommandée** : **React Native (Expo)** ou **Flutter**. Navigation par **bottom tab
bar** à 4 onglets. Un thème sombre unique (pas de light mode dans cette version).

## Fidelity
**High-fidelity.** Couleurs, typo, espacements, rayons et hiérarchie sont définitifs.
Les contenus entre `[ ... ]` (nom du membre, etc.) et toutes les **données** (cours, horaires,
nombre d'inscrits, grades, stats) sont des **exemples** : à brancher sur de vraies données.

## Écrans (4) — `App Kanjo Aikido.dc.html`
Chaque écran = zone de contenu scrollable + **bottom tab bar** (4 onglets, kanji + label).
Onglets : **Accueil** (家), **Planning** (稽), **Le dojo** (道), **Profil** (己).
L'onglet actif est en or `#c9a24d`, les inactifs en `#6f6757`.

1. **Accueil** — barre de marque (logo kanji + KANJO AÏKIDO / ISULANU) ; salutation
   (« Bonsoir, prêt pour le tatami ? ») ; **carte « Prochain cours »** (jour, horaire,
   bouton plein or « JE M'INSCRIS ») ; 2 raccourcis (Mon planning / Ma progression) ;
   **« Pensée du jour »** (citation Cormorant italique, filet or à gauche).
2. **Planning** — titre « Mon planning » ; **sélecteur de jours** (chips, jour actif
   encadré or) ; **liste de séances** (carte : heure + durée à gauche, intitulé + discipline
   + nb inscrits, à droite un bouton rond : ✓ si inscrit / + sinon).
3. **Le dojo** — **hero** (logo kanji centré + filet « — ISULANU — ») ; bloc « L'esprit
   Kanjo » (感 KAN / 情 JO, deux cartes) ; **liste de navigation** (Histoire de l'Aïkido,
   L'enseignant, S'équiper, Adresse & accès — chevrons `›`).
4. **Profil** — avatar rond ; nom + « MEMBRE DEPUIS … » ; **carte progression** (grade
   courant → suivant + barre de progression or) ; **3 stats** (cours / stages / heures) ;
   liste (Ma licence FFAB, Mon abonnement, Notifications).

## Design Tokens

### Couleurs
| Token | Hex | Usage |
|---|---|---|
| Fond profond | `#090805` | fond des écrans |
| Fond dégradé centre | `#15120b` / `#1c1a13` | radial hero/accueil |
| Or principal | `#c9a24d` | accents, CTA, onglet actif, kanji, barres |
| Or 30–40 % | `rgba(201,162,77,.3–.4)` | bordures de cartes mises en avant |
| Or 15–20 % | `rgba(201,162,77,.15–.2)` | séparateurs, bordures discrètes |
| Texte clair | `#f1e8d2` | gros titres |
| Texte fort | `#ece3cf` | titres de cartes |
| Texte corps | `#bcb39f` | paragraphes |
| Texte atténué | `#aaa18d` | secondaire |
| Gris-or | `#8a7d5c` | légendes, labels |
| Onglet inactif | `#6f6757` | tab bar, chevrons |
| Texte sur CTA | `#0d0b07` | sur fond or |

### Typographies (Google Fonts ; équivalents natifs au besoin)
- **Cinzel** (500/600) — titres, kanji latinisés (KAN/JO…), chiffres (stats, heures, grades).
- **Cormorant Garamond** (400/500 + italique) — corps de texte, citations, légendes douces.
- **Space Grotesk** (400/500/600) — eyebrows, labels, boutons, onglets (letter-spacing 2–3px).
- Kanji affichés tels quels (感 情 合 気 道 稽 家 己 帯 史 先 着 地 字) — une police gérant
  les CJK est requise (système OK sur iOS/Android).
- Tailles repères : gros titre écran ~28px ; titre de carte 16–23px ; corps 17–19px ;
  eyebrow 10px / letter-spacing 3px ; label d'onglet 9px.

### Formes & espacements
- Rayons : cartes **15–18px**, boutons **11px**, chips **12px**, pastilles rondes 50%.
- Padding écran latéral **22px** ; padding cartes **18–22px**.
- Bordures fines `1px` (jamais d'ombres lourdes ; profondeur via bordures or translucides).
- Boutons CTA : fond plein `#c9a24d`, texte `#0d0b07`, Space Grotesk 600, letter-spacing 2px.
- Barre de progression : piste `rgba(201,162,77,.15)`, remplissage `#c9a24d`, hauteur 7px, radius 4px.
- **Tab bar** : bordure haute `rgba(201,162,77,.18)`, fond `rgba(9,8,5,.7)` (translucide),
  padding bas généreux (safe-area). 4 items centrés (kanji ~18px + label 9px).

### Motifs récurrents
- **Eyebrow** : Space Grotesk 10px, letter-spacing 3px, or, souvent préfixé d'un kanji
  (感情, 稽古…).
- **Filet + texte** : `— ISULANU —` = trait or 1px + texte espacé + trait or.
- **Cartes mises en avant** : léger dégradé `linear-gradient(160deg,rgba(201,162,77,.10),transparent)`
  + bordure or 30–35 %.

## Interactions & comportement
- **Navigation** : bottom tab bar persistante, 4 onglets ; transition d'onglet instantanée.
- **Inscription à un cours** : bouton rond `+` → `✓` (toggle d'inscription, état optimiste),
  mise à jour du compteur d'inscrits ; le CTA « JE M'INSCRIS » de l'accueil mène au cours du jour.
- **Sélecteur de jours** (Planning) : tap sur une chip recharge la liste des séances du jour.
- **Listes du Dojo / Profil** : lignes tappables (chevron) → sous-pages
  (Histoire, Enseignant, S'équiper, Adresse ; Licence, Abonnement, Notifications).
- États à prévoir : chargement, vide (aucun cours), erreur réseau, plein (cours complet → CTA désactivé).
- Respecter les **safe areas** (notch/dynamic island en haut, home indicator en bas).

## Données & état (à câbler)
Modèles suggérés :
- **User** : nom, photo, membreDepuis, grade (kyu/dan), abonnement, licence FFAB, notifPrefs.
- **Session/Cours** : intitulé, discipline (tai-jutsu/armes/enfants), jour, heure, durée,
  capacité, inscrits[], statutInscription(user).
- **Progression** : gradeCourant, gradeCible, coursSuivis, prochainPassage, compteurs (cours/stages/heures).
- **Contenu éditorial** (Le dojo) : esprit Kanjo, histoire, enseignant, équipement, adresse —
  peut être statique (repris du site) ou servi par un CMS.
Auth nécessaire (espace membre). Source de planning : à définir (backend dojo, Google Agenda, etc.).

## Assets
Dans `./assets/` :
- `kanji-kanjo.png` — kanji « Kanjo » dorés, fond transparent, bords lissés. Logo (barre de
  marque, hero du Dojo). Hauteurs de réf. : 34px (barre), 84px (hero).
- `logo-noir-2048.png` — logo carré complet 2048×2048 (icône d'app, splash, écran de login).
- Police : Cinzel, Cormorant Garamond, Space Grotesk (Google Fonts / à embarquer).
- À fournir : photos (tatami, enseignant, dojo), icône d'app finalisée si différente.

## Files
- `App Kanjo Aikido.dc.html` — **référence de design** des 4 écrans (lire le markup
  entre `<x-dc>`…`</x-dc>`, styles **inline**). Chaque écran est dans un
  `<x-import component-from-global-scope="IOSDevice" …>` → ignorer ce wrapper (bezel iOS factice),
  ne reproduire que son **contenu**.
- `ios-frame.jsx` — bezel iPhone de présentation. **Référence only — ne pas porter.**
- `support.js` — runtime du prototype. **Ne pas porter.**

### Comment lire le fichier `.dc.html`
Mode « canvas » : 4 frames positionnées en absolu, chacune préfixée d'un label
(`1 · ACCUEIL` …). Le contenu d'un écran = le `<div>` enfant du `<x-import>`. Styles inline,
lisibles directement (couleurs hex, rayons px). La tab bar est répétée en bas de chaque écran
avec l'onglet actif coloré en or — en production, c'est **un seul** composant TabBar partagé.

> Note identité : « Isulanu » = insulaire/corse ; le site mentionne « Isula di Corsica »
> tandis que la bio de l'enseignant situe le dojo au Lion-d'Angers (Maine-et-Loire).
> Trancher l'ancrage géographique (et l'adresse réelle) avant le build, comme pour le site.
