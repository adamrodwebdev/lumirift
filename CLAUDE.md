# CLAUDE.md — Lumirift

Contexte de travail pour Claude Code. À lire avant toute modification ; le détail vit dans
`docs/CAHIER_DES_CHARGES.md` (document vivant, mis à jour à chaque lot livré) et dans
`README.md`. En cas d'écart, le cahier des charges et le `CHANGELOG.md` font foi.

## Le projet

Jeu de blocs qui tombent réinventé : 14 modes en quatre familles (Chute, Sable, Placement,
Volume) et la Course de la faille qui les traverse, une campagne de 69 niveaux, défi du jour,
défi des Gardiens, Duel contre l'IA. Navigateur, mobile d'abord, en **français, anglais,
indonésien et russe**. Identité « Rift » (indigo, faille dorée, blocs gemmes), musique
générative.

- Canaux : notre site (`adamrodwebdev.com/lumirift`, sans pub ni SDK), **CrazyGames**,
  **Playgama**, **Yandex Games** ; démo du portfolio (`build:demo`).
- Chaque version se juge sur les chiffres des portails et dix sessions d'inconnus
  (`docs/PREUVE.md`), jamais sur l'avis de l'équipe. Une porte qui échoue fait reprendre la
  fonction une fois ou l'abandonner, jamais la forcer.
- L'auteur décide du design, du récit et de la publication ; les choix techniques sont
  délégués. En cas de doute sur un choix de jeu, demander.

Documentation : `docs/CAHIER_DES_CHARGES.md` (règles, architecture § 5, qualité § 6, lots et
portes § 9 à 9 nonies), `docs/CRAZYGAMES.md`, `docs/PLAYGAMA.md`, `docs/YANDEX.md` (exigences
de chaque portail et leur contrôle), `docs/PREUVE.md`, `CHANGELOG.md`.

## Commandes

```bash
npm run dev               # serveur de développement
npm run verify            # lint + format + types + tests unitaires + build : avant chaque commit
npm test                  # Vitest (projet unit)
npm run test:curve        # des bots jouent la campagne et 24 courses (quelques minutes)
npm run test:e2e          # Playwright sur le build : lancer `npm run build` avant
npm run lighthouse        # mobile ; `-- --desktop` pour le bureau
npm run generate:levels   # réécrit les chapitres 6 à 10 (une demi-heure), à la main seulement
npm run package:crazygames | package:playgama | package:yandex   # zip dans release/
npm run clips -- --week AAAA-MM-JJ                               # la fabrique de clips
```

Node 24 (`.nvmrc`). `E2E_ENGINE=firefox|webkit npm run test:e2e` rejoue les parcours dans les
autres moteurs ; sur le poste Windows de l'auteur, le Firefox de Playwright ne démarre pas (la
CI le joue). Ports de `.claude/launch.json` : dev 5175, preview 4175, Playgama 5176,
CrazyGames 4180.

## Pile et carte du code

Vue 3.5, TypeScript strict, Vite, `vue-i18n` (messages précompilés), sans bibliothèque de
jeu ; rendu Canvas 2D ; sons synthétisés. Voir l'arbre de `README.md` (« Architecture en
bref ») et le § 5 du cahier.

## Règles d'architecture — à respecter absolument

- **Les règles n'importent jamais le rendu** : moteurs, sessions, modes, `run/` et `campaign/`
  ne connaissent ni Vue, ni le DOM, ni les effets, ni les sons (§ 5.14). L'écran de jeu dessine
  et joue ce que la partie publie, il ne décide pas.
- **Chaque famille est un module chargé à la demande** (moteur pur, session au contrat commun
  `GameSession`, rendu, effets) ; l'accueil ne charge que le nécessaire.
- **Polymorphisme plutôt que `switch`** : un mode = une stratégie (`GameMode`), une sorte de
  partie = une stratégie (`RunKind`).
- **Abstractions aux frontières** : hasard à graine (`RandomSource`), stockage, partage,
  horloge. Le défi du jour et les graines doivent rester reproductibles.
- **Événements typés** : le moteur publie, l'interface, les effets et les sons s'abonnent.
- **Couleurs uniquement par jetons CSS** (`tokens.css`, lus par `TonePalette`) ; seules la
  lumière et l'ombre neutres restent dans le code. Textes uniquement par `vue-i18n`, mêmes
  clés et mêmes paramètres dans les quatre langues (vérifié par des tests).
- **Le jeu ne parle jamais directement à un SDK** : tout passe par `src/platform/`
  (CrazyGames, Playgama, Yandex), choisi au build par le mode Vite. La politique de pubs
  (`src/ads/`) décide _quand_ : jamais après une défaite, ni en jeu, ni dans les huit
  premières minutes d'un nouveau joueur.
- Pas d'allocation dans les boucles par image (grilles `Uint8Array`, orientations
  précalculées). 60 images/s au plus sur écran tactile (`FrameCap`).

## Exigences qui font échouer la CI

- Lighthouse : 98 au moins en Performance, 95 dans les trois autres catégories (objectif :
  100 partout, mobile et bureau).
- Aucun défilement horizontal de 320 à 2560 px ; zooms 200 % et 400 % ; axe-core WCAG 2.2 AA
  sur chaque écran et chaque fenêtre.
- La courbe de la campagne : chaque niveau reste dans la bande de sa fiche de rythme. Un
  changement de règle ou de niveau se vérifie avec `npm run test:curve`.
- La CI (`.github/workflows/ci.yml`) joue `verify`, `test:curve`, `test:e2e`, `lighthouse`, et
  les parcours dans Firefox et WebKit, à chaque envoi sur `dev` et `main` et à chaque PR.

## Ressenti et accessibilité

- Jamais plus de trois flashs par seconde ; `prefers-reduced-motion` : chaque transition
  devient un fondu. Transitions de moins de 300 ms, qui ne retiennent jamais un toucher.
- Ni Échap ni Ctrl : les portails les réservent. Touches indépendantes de la disposition
  (AZERTY). Un motif gravé sur chaque couleur ; cibles tactiles d'au moins 44 px.
- Un changement de ressenti se vérifie aussi dans le navigateur, pas seulement en tests :
  regarder les captures, en portrait et en paysage.

## Git et publication

- **Tout le travail se fait sur `dev`** : une branche par version ou par étape, PR vers `dev`,
  jamais vers `main`.
- **`main` est la production** : Netlify (projet `stackriftwebtech`) déploie chaque envoi sur
  `main`, et chaque déploiement coûte des crédits. `dev` passe dans `main` seulement sur la
  demande de l'auteur, en une fois, puis la version s'étiquette (`vX.Y.Z`) : voir `README.md`,
  « Branches et déploiement ».
- Commits _Conventional Commits_ **en français** ; code et commentaires **en anglais** ;
  documentation et CHANGELOG en français.
- Chaque version : entrée dans `CHANGELOG.md` (Keep a Changelog), version dans `package.json`
  et `package-lock.json`, et le cahier des charges mis à jour (tableau des versions, lot, § 12).

## Compétences utiles

`web-portal-game-strategy` (conception, monétisation, portails), `web-game-performance`
(poids, chargement, images par seconde), `game-web-translator` (les quatre langues),
`game-moderator-review` (revue d'un build avant dépôt, avec les fiches de chaque portail).
