# Lumirift

Le jeu de blocs qui tombent, réinventé : les règles que vous connaissez, **14 modes** que
vous n'avez jamais joués, en quatre familles et une course qui les traverse. Dans le
navigateur, mobile d'abord, en
**français, anglais, indonésien et russe**, avec son identité « Rift » (indigo, faille dorée,
blocs gemmes) et sa musique générative. Gratuit, sans inscription,
aucune donnée ne quitte l'appareil.

**Jouer** : [Lumirift Blocks sur Playgama](https://playgama.ai/play/be4bqnmqcv), gratuit, dans
le navigateur, sur téléphone comme sur ordinateur.

Cahier des charges (règles détaillées, architecture, décisions) :
[docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md) · Historique : [CHANGELOG.md](CHANGELOG.md) ·
Mesurer une version : [docs/PREUVE.md](docs/PREUVE.md).

## Le jeu

| Famille       | Modes                                                                                     | Matière         |
| ------------- | ----------------------------------------------------------------------------------------- | --------------- |
| **Chute**     | Classique, Marée, Renversement, Chroma, Miroir, Fusion, Bascule, Silhouette, Rythme, Duel | Cristal facetté |
| **Sable**     | Sable : les pièces se désagrègent en grains ; éléments, vent et combo jusqu'à ×10         | Grains          |
| **Placement** | Mosaïque : grille 8 × 8, pièces à poser, cinq jokers                                      | Céramique       |
| **Volume**    | Tour : le puits s'enroule en cylindre de verre                                            | Verre courbé    |
| **Faille**    | Course de la faille : contre la montre, à travers le puits, le Sable et la Tour           | Celle du monde  |

- **Campagne** : 69 niveaux en dix chapitres à travers tous les modes, des étoiles à
  gagner et **dix améliorations** à acheter avec elles. Sa courbe est mesurée : des joueurs
  simulés (débutant, habitué, expert) jouent chaque niveau, qui doit rester dans la bande
  de sa fiche de rythme ; au premier chapitre, la menace ralentit près du haut du puits.
  Les chapitres 6 à 10 sont **générés** : un générateur par famille tire des niveaux d'une
  graine, et seuls ceux que les joueurs simulés trouvent dans leur bande, sur deux séries de
  parties, sont gardés ; chaque chapitre finit sur la revanche d'un Gardien, plus fort.
- **Course de la faille** : un chrono parti de 1:30 (99 s au plus), et toutes les 40 s la
  faille change de monde, du puits au Sable puis à la Tour, chaque fois sur un plateau neuf
  qui rapporte 10 s. Les lignes rapportent du temps (double pendant l'annonce du changement),
  un débordement en coûte sans finir la partie ; un Gardien du monde peut entrer en jeu pour
  25 s, et chaque cycle accélère la chute et multiplie le score. Record personnel et record de
  la semaine ; le mode s'ouvre au niveau 4-4 de la campagne.
- **Défi du jour** : chaque jour, un mode et les mêmes pièces pour tout le monde, deux
  minutes, résultat à partager.
- **Défi des Gardiens** : chaque semaine, un Gardien de la faille ouvert à tous depuis
  l'accueil ; ses points, multipliés par une victoire rapide, font le record de la semaine, et
  le premier essai de chaque jour rapporte de l'XP.
- **Duel** contre une IA, cinq niveaux calés sur la vitesse de vrais joueurs.
- **Progression** : expérience et niveaux, trois objectifs du jour, série de défis et ses
  paliers (3, 7, 14 et 30 jours) ; **Atelier** de matières, d'ambiances et de signatures de
  bris, tous cosmétiques, et ses **ensembles** : quatre apparences réunies débloquent une
  ambiance.
- **Les saisons et l'élément de la semaine** : chaque semaine, un élément du Sable revient
  plus souvent et donne son objectif ; les points de chaque partie montent la piste de la
  saison (de l'expérience et des nouveautés, une couronne pour l'ensemble). Une avant-saison
  dès maintenant, la saison 1 « Braises » le 14 décembre, les suivantes prêtes en données.
- **Dunes, à l'essai** (1.37) : le sable posé depuis une main de trois pièces, sur un plateau
  de 9 × 12 cases ; une couleur qui relie les murs s'efface, sans chrono ; les éléments et le
  Ver des dunes. Il ne vit que dans ses versions de test (voir « Version Playgama ») jusqu'à
  ce que le test du bac à sable décide de son sort.
- **Le cadeau du jour** : un calendrier de sept jours (de l'expérience, une apparence le
  septième), qui s'ouvre de lui-même au premier passage de la journée ; un jour manqué ne
  fait rien perdre, une semaine d'absence vaut un cadeau de retour.
- **Effets** : destructions physiques, sons synthétisés, vibrations ; réglables (complets,
  sobres, aucun), sans jamais plus de trois flashs par seconde.
- **La tension de l'échec** : en danger, la musique presse et un cœur bat, le verre du
  puits se fend d'or ; une ligne sauvée au bord du gouffre compte double. Une défaite brise
  le verre sous la pulsation rouge, ses vitres tombent, la pile éclate dans la matière de
  l'ambiance portée, puis « Rejouer » bat.
- **Des pubs mesurées** (portails) : jamais après une défaite, ni en jeu, ni dans les huit
  premières minutes d'un nouveau joueur ; une partie perdue peut reprendre contre une pub
  choisie, rarement (dix minutes d'écart) ; une apparence verrouillée s'essaie le temps d'une
  partie.
- **La surcharge de la faille** : les lignes remplissent une jauge ; pleine, le joueur ralentit
  le temps au tiers pendant huit secondes pour sauver sa partie, et les points faits pendant
  sont multipliés à la sortie.
- **Des gestes qui jouent la musique** : chaque rotation joue la note suivante de l'accord
  qui sonne, chaque pièce posée sa basse, chaque effacement l'accord entier ; sur le temps,
  plus fort. En Rythme, la musique suit la pulsation du mode.
- **Écran titre vivant** : une boucle de vraies parties montre, avant même de jouer, ce
  qu'aucun autre jeu de blocs n'a : les éléments du Sable, les puits qui se retournent,
  basculent et se reflètent, les quatre Gardiens de la faille.
- **Sur les portails** (CrazyGames, Playgama, Yandex Games) : un nouveau joueur arrive directement dans
  l'entraînement, une seule partie guidée et passable : le premier éclair brise le sable où
  qu'il tombe, l'embrasement et la liane suivent, le Ver des dunes surgit avant 30 s ; les
  menus s'ouvrent ensuite. Notre site garde son écran titre.
- **Menu en quatre pages** (Accueil, Modes, Carte, Atelier) : onglets sous le pouce ou rail
  en paysage, glissement d'une page à l'autre, rien à faire défiler ; les fenêtres sont des
  feuilles qui tiennent à l'écran, et la fin de partie se dévoile pas à pas.

### Commandes

| Action                    | Clavier                                | Tactile (partout sur l'écran de jeu)      |
| ------------------------- | -------------------------------------- | ----------------------------------------- |
| Déplacer                  | ← → (ou A D)                           | Glisser sur le côté                       |
| Descendre / chute franche | ↓ (ou S) / Espace                      | Glisser vers le bas / un coup vers le bas |
| Tourner / autre sens      | ↑ ou X / Z (W en AZERTY)               | Toucher la moitié droite / gauche         |
| Réserve                   | C ou Maj                               | Un coup vers le haut, ou toucher la case  |
| Capacité (Renversement)   | F                                      | Bouton à côté de la réserve               |
| Surcharge de la faille    | V                                      | Toucher le sablier                        |
| Tourner la Tour           | Q / E (A / E en AZERTY)                | Glisser à deux doigts                     |
| Mosaïque                  | 1, 2, 3 (4 : cube), flèches, Entrée, J | Glisser-déposer                           |
| Pause                     | P                                      | Bouton en haut de l'écran                 |

Sur écran tactile, Réglages, « Commandes tactiles » : jouer aux gestes, aux boutons ou aux
deux, la vitesse du glissé, tourner selon le côté touché, le mode gaucher, les vibrations ;
« Voir les gestes » dessine le guide. Un deuxième doigt tapé pendant un glissé tourne aussi ;
un coup ne fait tomber que la pièce présente au début du contact.

Ce sont les touches par défaut : chacun les change dans Réglages, « Clavier » (deux touches
par action, échange quand une touche est déjà prise), avec la répétition des déplacements
(DAS 50 à 300 ms, ARR 0 à 100 ms ; 0 envoie la pièce droit au mur). La Mosaïque garde ses
touches.

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

| Commande                  | Rôle                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`             | Serveur de développement avec rechargement à chaud                                                 |
| `npm run dev:dunes`       | Le même, Dunes seul (la version de son test, sur notre site)                                       |
| `npm run build`           | Vérification des types puis build de production (`dist/`)                                          |
| `npm run preview`         | Sert le build de production (port 4173)                                                            |
| `npm test`                | Tests unitaires (Vitest)                                                                           |
| `npm run test:curve`      | Courbe de la campagne : des bots jouent chaque niveau (quelques minutes)                           |
| `npm run generate:levels` | Réécrit les chapitres générés (6 à 10, dans l'ordre) et leurs rapports, à la main (une demi-heure) |
| `npm run test:e2e`        | Parcours et audits d'accessibilité (Playwright, mobile et bureau)                                  |
| `npm run lint`            | ESLint (règles TypeScript strictes, typées)                                                        |
| `npm run format`          | Prettier                                                                                           |
| `npm run lighthouse`      | Audit Lighthouse du build, mobile (`-- --desktop` pour le bureau)                                  |
| `npm run clips`           | Les clips d'une semaine pour les réseaux (`-- --week AAAA-MM-JJ`, quelques minutes)                |
| `npm run verify`          | Lint, format, types, tests et build : à passer avant chaque commit                                 |

Les tests de bout en bout et Lighthouse utilisent le build : lancez `npm run build` avant.
Les images de partage (`public/og-image.png`, icônes) se régénèrent avec
`node scripts/social-images.mjs`.

## Branches et déploiement

- `main` est la branche de production : Netlify (projet `stackriftwebtech`) déploie chaque
  envoi sur `main`, et chaque déploiement de production coûte des crédits.
- Tout le travail se fait sur `dev` : une branche par version ou par étape, et sa pull
  request vers `dev`, jamais vers `main`.
- Publier, seulement sur demande : `dev` passe dans `main` en une fois (un seul déploiement
  pour toutes les versions depuis la dernière), puis la version est marquée et l'on revient
  sur `dev`.

```bash
git switch main && git merge --ff-only dev && git push origin main
```

```bash
git tag -a vX.Y.Z -m "Lumirift Blocks X.Y.Z : …" && git push origin vX.Y.Z && git switch dev
```

- Netlify ne déploie que la branche de production (Branch deploys → « Deploy only the
  production branch ») : les envois sur `dev` ne coûtent rien.
- Des builds arrêtés ne rejouent pas les envois reçus entre-temps : une fois réactivés,
  publier par un déploiement manuel (Deploys → Trigger deploy → Deploy project), qui emporte
  tous les commits en attente.

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

Le test des Dunes (1.37) : deux versions d'un seul mode, jouées sans trafic acheté, comparées sur les
tableaux de bord de Playgama.

```bash
npm run package:playgama-dunes   # Dunes seul : release/lumirift-playgama-dunes-<version>.zip
npm run package:playgama-sand    # le Sable seul : release/lumirift-playgama-sand-<version>.zip
```

Détail des exigences, de leur contrôle et du formulaire : [docs/PLAYGAMA.md](docs/PLAYGAMA.md).

### Version CrazyGames

```bash
npm run package:crazygames          # build, contrôles, zip dans release/
node scripts/crazygames-media.mjs   # covers et vidéos dans release/crazygames-media/
```

Détail des exigences et de leur contrôle : [docs/CRAZYGAMES.md](docs/CRAZYGAMES.md).

### Version Yandex Games

```bash
npm run package:yandex          # build, contrôles, zip dans release/
node scripts/yandex-media.mjs   # icône, couverture, captures et vidéos MP4 dans release/yandex-media/
```

Exigences et leur contrôle, fiche en quatre langues et étapes de publication :
[docs/YANDEX.md](docs/YANDEX.md).

### Clips des réseaux

La fabrique de clips (1.39) filme les moments forts du jeu sur ses vrais moteurs, pour
TikTok, Instagram et YouTube Shorts :

```bash
npm run clips -- --week 2026-11-02                          # la semaine dans release/clips/2026-11-02/
npm run clips -- --week 2026-11-02 --clip mon-fire-on-oil   # un seul clip
```

Chaque clip est un MP4 vertical (1080 × 1920, H.264 et AAC, 7 à 15 s) qui s'ouvre sur son pic et
boucle, avec le son du jeu, sa couverture et une entrée de `manifest.json` (les mesures que
citent les légendes). Les semaines sont des recettes dans `media/clips.ts`, les scènes dans
`src/showcase/`. La fabrique n'écrit que des fichiers : l'envoi reste à la main.

## Qualité

- TypeScript strict, ESLint `strictTypeChecked`, Prettier.
- Près de 700 tests unitaires : moteurs, modes, IA, effets et sons, services, progression,
  parité des traductions ; et un projet à part, `npm run test:curve`, où des joueurs simulés
  jouent toute la campagne et 24 courses de la faille.
- Parcours de bout en bout sur téléphone (390 × 844) et ordinateur (1280 × 800) : les 14
  modes, une partie complète, une course de la faille jusqu'à sa fin, défi du jour, le
  calendrier des cadeaux sur une horloge réglée (minuit, retour en arrière), l'ouverture d'une
  saison à minuit UTC vue d'Auckland et de Los Angeles, réglages
  retenus, menu (onglets, glissement, carte, Atelier), clavier seul ; le premier lancement d'un portail, sur le build
  CrazyGames ; le build Yandex Games avec un faux SDK (chargement, pauses, langue,
  sauvegarde, cadre sans menu ni sélection) ; en russe, la langue la plus longue, chaque page et chaque
  famille de jeu de 320 px au bureau, en portrait et en paysage, sans rien de coupé.
- Garde responsive : aucun défilement horizontal de 320 à 2560 px (tous les 20 px), et
  quatre tailles clés : petit téléphone et téléphone en paysage au toucher, zooms 200 % et
  400 % (cibles tactiles, textes du HUD, part du puits).
- Traductions : mêmes clés et mêmes paramètres dans les quatre langues, pluriels du français
  et du russe, typographie de chaque langue, vérifiés par des tests.
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
  session/       Contrat GameSession, registre des modes, défi du jour, surcharge, reprise
  ads/           La politique de pubs : règles et réglages par canal, calendrier d'une visite
  run/           Une partie à l'écran : sa sorte (libre, défi, Gardien, niveau), son
                 déroulé et sa fin réglée ; l'écran ne fait que dessiner
  campaign/      Niveaux, objectifs, étoiles, améliorations, défi des Gardiens ; generator/ (le
                 plan des chapitres 6 à 10, un générateur par famille, le tamis du bot) et
                 packs/ (les chapitres générés, en données, avec leurs rapports)
  showcase/      Scènes mises en scène (boucle de l'accueil, vidéos des portails, clips)
  families/      falling, sand, placement, volume : moteur, session, rendu, effets, interface ;
                 race : la course, une session de sessions qui change de monde ;
                 dunes : le sable posé (à l'essai), composé des grains et du Ver du Sable
  progression/   Expérience, objectifs, cosmétiques, ensembles, cadeaux du jour, profil
  seasons/       Les saisons en données, leur calendrier (UTC), leur piste, l'objectif de la semaine
  fx/, render/   Particules, secousses, sons ; palette et motifs partagés
  services/      Réglages, records, profil, thème, ambiance, audio, partage
  ui/            Écrans (menu, jeu), pages du menu (hub/), composants ; la présentation et
                 la scène de chaque famille (presentation.ts, stages.ts)
```

## Confidentialité

Aucun compte, aucun traceur, aucune requête vers un service tiers. Réglages, records et
progression sont gardés dans le stockage local du navigateur.

## Crédits

Conçu et dirigé par AdamRodWebDev, développé avec des assistants de code IA (_designed and
directed by AdamRodWebDev, built with AI coding assistants_).
