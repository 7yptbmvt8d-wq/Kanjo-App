# Costa Verde Aïkido — App membres

## Contexte
Club d'Aïkido à Santa Maria Poggio (Haute-Corse), affilié FFAB, fondé en 2004 par Jean-Charles Lanusse (4e Dan Aïkikaï). Site existant : costaverdeaikido.fr.

## Objectif
Transformer le prototype `costa_verde_app.jsx` (React, Tailwind) en vraie PWA installable Android/iOS, avec un rendu visuel plus abouti que la version artifact (polices personnalisées, palette sur-mesure, animations).

## Stack cible
- PWA (manifest + service worker) — pas d'app native, pas de store
- Firebase : Firestore (données planning/annonces/présence), Auth (comptes adhérents), Hosting (déploiement), Cloud Messaging (notifications push)
- Tailwind avec config personnalisée (actuellement limité aux classes core dans l'artifact)

## Fonctionnalités déjà prototypées (à reprendre, pas à redéfinir)
1. **Planning** : filtrable par lieu (Santa Maria Poggio / Vescovato) et par jour. Statuts : normal / changement / annulé / à venir.
2. **Annonces** : messages descendants uniquement (profs/bureau → adhérents), pas de chat libre entre adhérents — choix délibéré vu le public ados.
3. **Appel** : un prof peut lancer un "appel" ciblé sur un cours (bouton dédié "Faire l'appel") ; les adhérents répondent en un tap (Présent / Pas là), pas de texte libre. Barre de progression visible en mode prof.
4. **Onglet Club** : histoire du club/FFAB, infos pratiques (adresse, tarifs, essai gratuit), liens réseaux sociaux.
5. **Onglet Grades** : fiches de progression FFAB (6e Kyu → Shodan), basées sur le PDF club — sélecteur de ceinture coloré, attaques/techniques par catégorie, encarts armes, culture & histoire. La fiche Shodan est un stub volontairement vide (pas de contenu fourni dans le PDF source).

## Données réelles à respecter
- **Santa Maria Poggio** (Maison du Temps, 20221 Santa Maria Poggio) : Lundi 18h45–20h30 (Ados & Adultes), Mercredi 17h15–18h30 (Enfants 6-12 ans), Vendredi 18h00–19h00 (Aïkitaïso) puis 19h00–21h00 (Ados & Adultes).
- **Vescovato** : projet d'antenne *non encore validé* — slots envisagés Mercredi 16h-17h30 (ados 12-18, Sébastien), Mercredi 17h45-18h45 (self-défense, Jean-Charles Lanusse), Vendredi 9h30-11h (séniors débutants, Jean-Charles Lanusse). Ne pas présenter comme actifs.
- Enseignants des cours Santa Maria Poggio à confirmer auprès de Sébastien (laissés en "à confirmer" dans le prototype).
- Tarifs : Enfants 192€ (150€ dès 2 enfants), Adultes 249€, Famille 300€. Licence FFAB incluse.
- Contact club : Sandra (présidente), à clarifier lequel des deux numéros/emails connus est à jour (06 33 25 34 97 / costaverdeaikido@gmx.fr vs 06 14 50 89 98 / costaverdeaikido.ffab@gmail.com).

## Logos
Déjà intégrés en base64 directement dans `costa_verde_app.jsx` (constantes `LOGO_COSTA_VERDE` et `LOGO_FFAB`) — pas besoin de fichiers séparés.

## Source des fiches de progression
`Fiches_Progression_Aikido_CostaVerde.pdf` (fourni séparément si besoin de vérifier/compléter, notamment le Shodan).

## Demande pour cette session Claude Code
Reprendre `costa_verde_app.jsx` tel quel comme base fonctionnelle, puis :
1. Monter le projet (Vite + Tailwind config custom, manifest PWA, service worker)
2. Affiner le rendu visuel (typographie, micro-animations, cohérence avec les logos fournis)
3. Brancher Firebase (Firestore + Auth + Hosting) à la place des données mockées en mémoire
4. Garder les décisions fonctionnelles ci-dessus sans les rediscuter
