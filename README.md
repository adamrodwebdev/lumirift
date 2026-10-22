# Lumirift

Le jeu de blocs qui tombent, réinventé : les règles que vous connaissez, **13 modes** que
vous n'avez jamais joués, en quatre familles. Dans le navigateur, mobile d'abord, en
**français, anglais et indonésien**, avec son identité « Rift » (indigo, faille dorée,
blocs gemmes) et sa musique générative. Gratuit, sans inscription,
aucune donnée ne quitte l'appareil.

Cahier des charges (règles détaillées, architecture, décisions) :
[docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md) · Historique : [CHANGELOG.md](CHANGELOG.md).

## Le jeu

| Famille       | Modes                                                                                     | Matière         |
| ------------- | ----------------------------------------------------------------------------------------- | --------------- |
| **Chute**     | Classique, Marée, Renversement, Chroma, Miroir, Fusion, Bascule, Silhouette, Rythme, Duel | Cristal facetté |
| **Sable**     | Sable : les pièces se désagrègent en grains ; eau, feu et vent                            | Grains          |
| **Placement** | Mosaïque : grille 8 × 8, pièces à poser, cinq jokers                                      | Céramique       |
| **Volume**    | Tour : le puits s'enroule en cylindre de verre                                            | Verre courbé    |

- **Campagne** : 30 niveaux en cinq chapitres à travers tous les modes, des étoiles à
  gagner et **dix améliorations** à acheter avec elles.
- **Défi du jour** : chaque jour, un mode et les mêmes pièces pour tout le monde, deux
  minutes, résultat à partager.
- **Duel** contre une IA, cinq niveaux calés sur la vitesse de vrais joueurs.
- **Progression** : expérience et niveaux, trois objectifs du jour, série de défis ;
  **Atelier** de matières, d'ambiances et de signatures de bris, tous cosmétiques.
- **Effets** : destructions physiques, sons synthétisés, vibrations ; réglables (complets,
  sobres, aucun), sans jamais plus de trois flashs par seconde.
- **La tension de l'échec** : en danger, la musique presse et un cœur bat, le verre du
  puits se fend d'or ; une ligne sauvée au bord du gouffre compte double, une défaite
  brise le puits.
- **Écran titre vivant** : une boucle de vraies parties montre, avant même de jouer, ce
  qu'aucun autre jeu de blocs n'a : les éléments du Sable, les puits qui se retournent,
  basculent et se reflètent, les quatre Gardiens de la faille.
- **Menu en quatre pages** (Accueil, Modes, Carte, Atelier) : onglets sous le pouce ou rail
  en paysage, glissement d'une page à l'autre, rien à faire défiler ; les fenêtres sont des
  feuilles qui tiennent à l'écran, et la fin de partie se dévoile pas à pas.

### Commandes

| Action                    | Clavier                                | Tactile (partout sur l'écran de jeu)          |
| ------------------------- | -------------------------------------- | --------------------------------------------- |
| Déplacer                  | ← → (ou A D)                           | Glisser sur le côté                           |
| Descendre / chute franche | ↓ (ou S) / Espace                      | Glisser vers le bas / vite vers le bas        |
| Tourner / autre sens      | ↑ ou X / Z (W en AZERTY)               | Toucher / toucher à deux doigts               |
| Réserve                   | C ou Maj                               | Glisser vite vers le haut, ou toucher la case |
| Capacité (Renversement)   | F                                      | Bouton à côté de la réserve                   |
| Tourner la Tour           | Q / E (A / E en AZERTY)                | Glisser à deux doigts                         |
| Mosaïque                  | 1, 2, 3 (4 : cube), flèches, Entrée, J | Glisser-déposer                               |
| Pause                     | P                                      | Bouton en haut de l'écran                     |

Sur écran tactile, les boutons ne s'affichent que si on les choisit (Réglages, Commandes).
La partie se joue en portrait comme en paysage, sans en-tête ni défilement.

Les touches de chaque famille s'affichent dessinées (selon la disposition du clavier) dans
la fenêtre de pause et à côté du jeu pendant les cinq premières parties ; la toute première
partie est guidée pas à pas, sur un Sable calme. Ni Échap ni Ctrl : les portails les
réservent (plein écran, fermeture d'onglet).

## Accessibilité

Navigation complète au clavier (lien d'évitement, focus visible, focus déplacé à chaque
écran), annonces des événements de jeu aux lecteurs d'écran, motif gravé sur chaque couleur
(le jeu se joue sans distinguer les couleurs), cibles tactiles d'au moins 44 px, respect de
`prefers-reduced-motion`. Chaque écran et chaque fenêtre sont audités automatiquement
(axe-core, WCAG 2.2 AA).

## Démarrer

Prérequis : Node.js 24 (voir `.nvmrc`) et Google Chrome (tests de bout en bout, Lighthouse).

```bash
npm install
npm run dev
```

## Commandes de développement

| Commande             | Rôle                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `npm run dev`        | Serveur de développement avec rechargement à chaud                 |
| `npm run build`      | Vérification des types puis build de production (`dist/`)          |
| `npm run preview`    | Sert le build de production (port 4173)                            |
| `npm test`           | Tests unitaires (Vitest)                                           |
| `npm run test:e2e`   | Parcours et audits d'accessibilité (Playwright, mobile et bureau)  |
| `npm run lint`       | ESLint (règles TypeScript strictes, typées)                        |
| `npm run format`     | Prettier                                                           |
| `npm run lighthouse` | Audit Lighthouse du build, mobile (`-- --desktop` pour le bureau)  |
| `npm run verify`     | Lint, format, types, tests et build : à passer avant chaque commit |

Les tests de bout en bout et Lighthouse utilisent le build : lancez `npm run build` avant.
Les images de partage (`public/og-image.png`, icônes) se régénèrent avec
`node scripts/social-images.mjs`.

## Mise en ligne

Le build est un site statique, servi depuis n'importe quel dossier (chemins relatifs).

```bash
SITE_URL=https://exemple.fr/lumirift/ npm run build
```

`SITE_URL` (facultatif) ajoute le lien canonique, les adresses absolues des cartes de
partage, `sitemap.xml` et sa mention dans `robots.txt`. Sans lui, le build reste portable
(portails de jeux, sous-dossiers).

### Démo du portfolio

```bash
npm run build:demo   # dist-demo : cinq modes et le premier chapitre de la campagne
```

Copiée dans `demos/lumirift/` du portfolio (adamrodwebdev.com).

### Version Playgama

```bash
npm run package:playgama                          # build, contrôles, zip dans release/
node scripts/crazygames-media.mjs --covers-only   # covers dans release/playgama-media/
```

Détail des exigences, de leur contrôle et du formulaire : [docs/PLAYGAMA.md](docs/PLAYGAMA.md).

### Version CrazyGames

```bash
npm run package:crazygames          # build, contrôles, zip dans release/
node scripts/crazygames-media.mjs   # covers et vidéos dans release/crazygames-media/
```

Détail des exigences et de leur contrôle : [docs/CRAZYGAMES.md](docs/CRAZYGAMES.md).

## Qualité

- TypeScript strict, ESLint `strictTypeChecked`, Prettier.
- Plus de 280 tests unitaires : moteurs, modes, IA, effets, services, progression, parité
  des traductions.
- Parcours de bout en bout sur téléphone (390 × 844) et ordinateur (1280 × 800) : les 13
  modes, une partie complète, défi du jour, réglages retenus, menu (onglets, glissement,
  carte, Atelier), clavier seul.
- Lighthouse : 100 dans les quatre catégories, mobile et bureau (seuils exigés : 98 en
  Performance, 95 dans les trois autres).
- Intégration continue : `.github/workflows/ci.yml` rejoue tout cela à chaque envoi.

## Architecture en bref

Vue 3.5 et TypeScript, sans bibliothèque de jeu. Chaque famille est un module chargé à la
demande : moteur pur (aucune dépendance au rendu), session au contrat commun, rendu canvas
et effets. Couleurs uniquement par jetons CSS, textes uniquement par `vue-i18n`. Détails
au § 5 du cahier des charges.

```
src/
  core/          Briques partagées (événements, hasard à graine, tons, jours)
  session/       Contrat GameSession, registre des modes, défi du jour
  showcase/      Scènes mises en scène (boucle de l'accueil, vidéos des portails)
  families/      falling, sand, placement, volume : moteur, session, rendu, effets, interface
  progression/   Expérience, objectifs, cosmétiques, profil
  fx/, render/   Particules, secousses, sons ; palette et motifs partagés
  services/      Réglages, records, profil, thème, ambiance, audio, partage
  ui/            Écrans (menu, jeu), pages du menu (hub/) et composants
```

## Confidentialité

Aucun compte, aucun traceur, aucune requête vers un service tiers. Réglages, records et
progression sont gardés dans le stockage local du navigateur.
