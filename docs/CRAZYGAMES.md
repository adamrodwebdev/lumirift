# Lumirift Blocks sur CrazyGames — build, médias, conformité et resoumission

Sources (relues le 20/10/2026) : [Requirements](https://docs.crazygames.com/requirements/intro/)
(technique, gameplay, publicité, covers, qualité), [FAQ](https://docs.crazygames.com/faq/)
(resoumission, mises à jour), [Basic Launch metrics](https://docs.crazygames.com/resources/basic-launch-metrics/),
[SDK HTML5 v3](https://docs.crazygames.com/sdk/intro/).

## Resoumettre un jeu refusé

- Le 13/10/2026, CrazyGames a refusé la 1.2.0 (alors « Stackrift ») sur la qualité générale
  (« The overall quality of the game does not yet meet the expectations of our platform »),
  sans autre retour, alors que toutes les exigences techniques passaient.
- La FAQ : un jeu refusé peut être resoumis, **après des améliorations significatives** et une
  fois les exigences remplies ; aucun délai d'attente n'est fixé. Les mises à jour se font
  depuis le compte développeur (téléverser les fichiers, soumettre pour validation) et sont
  traitées en général dans la journée. Soumettre à répétition des jeux non conformes peut
  restreindre les soumissions futures : ne resoumettre qu'avec un jeu irréprochable.
- Ne pas confondre avec l'issue d'un Basic Launch raté (métriques sous les références) :
  là, il faut soumettre un **nouveau jeu** avec des améliorations significatives.
- Constaté sur le portail (octobre 2026) : un jeu refusé n'a **pas de « nouvelle version »** ; on
  repasse par « Submit a game » (nouveau brouillon : le brouillon « Lumirift Blocks » existe déjà).
  Après trois jeux refusés, les soumissions sont suspendues environ deux semaines (fenêtre
  suivante annoncée : 28/10/2026). Le champ de téléversement prend un **dossier** (le build
  décompressé), pas le zip.

### Ce qui a changé depuis la 1.2.0 refusée (à résumer dans le message de soumission)

| Reproche probable (diagnostic du 14/10/2026) | Depuis                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accueil de « web app », menu qui défile      | Écran-titre vivant (gemmes, faille), menu en quatre pages à onglets sans défilement, transition de la faille (1.8)                                                                                           |
| Identité générique, premier mode = clone     | Nom « Lumirift Blocks », identité « Rift » (gemmes gravées, faille dorée, polices propres) ; la campagne s'ouvre sur le Sable, mode inédit (1.4–1.5) ; aucune pièce aux couleurs du standard du genre (1.11) |
| Petit plateau dans un grand écran vide       | Plus d'en-tête pendant la partie, puits sur toute la hauteur, tableau de bord rangé contre le puits (console centrée), paysage jouable (1.7, 1.10)                                                           |
| Pas de musique                               | Musique générative par famille, sons synthétisés (1.4)                                                                                                                                                       |
| Pas de prise en main                         | Première partie guidée pas à pas (passable), 1-1 calme (une seule idée), touches dessinées à côté du jeu (1.4, 1.10)                                                                                         |
| Échap et Ctrl utilisés                       | Plus aucun : P pour la pause, Retour arrière pour annuler dans la Mosaïque ; sur les portails, Échap ne ferme même plus une fenêtre (1.4, 1.10)                                                              |
| Effets plats                                 | Chute instantanée animée, lignes qui éclatent en éclats de gemme, résultats mis en scène (score qui défile, barre d'XP), feuilles animées (1.7, 1.9)                                                         |
| Téléphone                                    | Tout au doigt (gestes partout), aucun défilement, portrait et paysage, fenêtres qui tiennent à l'écran (1.7–1.9)                                                                                             |
| Rien d'inédit face aux succès du tag         | Éléments du Sable qui réagissent entre eux (foudre et eau, huile en feu, glace, liane, acide, vapeur) montrés dès la première minute (1.12) ; gemmes-bombes dans la Tour (1.13)                              |
| Peu de raisons de revenir                    | Quatre Gardiens de la faille, un boss par chapitre, chacun avec sa riposte et son cosmétique : Ver des dunes, Golem de céramique, Œil de la Tour, Cœur de la faille (1.14–1.17)                              |
| Vitrine terne                                | Covers lumineuses autour d'un personnage (l'Œil de la Tour) ; vidéos sur les éléments et les quatre boss (1.17)                                                                                              |

## Produire le build et les médias

```bash
npm run package:crazygames          # build, contrôles automatiques, zip
node scripts/crazygames-media.mjs   # 3 covers et 2 vidéos (≈ 5 min)
```

| Livrable                   | Fichier                                                     |
| -------------------------- | ----------------------------------------------------------- |
| Build à téléverser         | `release/lumirift-crazygames-<version>.zip`                 |
| Cover paysage 16:9         | `release/crazygames-media/cover-landscape-1920x1080.png`    |
| Cover portrait 2:3         | `release/crazygames-media/cover-portrait-800x1200.png`      |
| Cover carrée 1:1           | `release/crazygames-media/cover-square-800x800.png`         |
| Vidéo paysage 16:9 (1080p) | `release/crazygames-media/preview-landscape-1920x1080.webm` |
| Vidéo portrait 2:3 (1080p) | `release/crazygames-media/preview-portrait-1080x1620.webm`  |

Le build CrazyGames (`vite build --mode crazygames`) ne diffère du site que par la couche
`Platform` (`src/platform/crazygames/`) : SDK v3 chargé dans `<head>`, événements de jeu,
langue, sauvegarde, coupure du son et publicités. Notre site ne charge jamais le SDK.

## À saisir au dépôt (Developer Portal)

- **Title** : Lumirift Blocks
- **Description** :

  > Lumirift Blocks is a falling-blocks game where the blocks fight back.
  >
  > Pieces crumble into sand alive with elements: drop lightning into water to shock a whole
  > colour away, set oil ablaze, freeze water into ice, grow a vine across a gap. Wrap the well
  > into a glass Tower where bomb gems blow whole sectors apart. Then face the four Guardians of
  > the rift: the Dune Wyrm bursting out of the sand, the Ceramic Golem whose armour is the
  > board, the Eye of the Tower that strikes wherever it looks, and the Heart of the Rift, wounded
  > by its own shards.
  >
  > 13 original modes across four families: Classic, Tide, Flip, Mirror, Chroma, Fusion, Tilt,
  > Rhythm and Silhouette; the Sand; the 8×8 Mosaic with its jokers; the Tower; and a
  > head-to-head Duel against an AI, from Rookie to Expert.
  >
  > Play a 34-level campaign that visits every mode, earn up to three stars per level and spend
  > them on 10 upgrades. Come back for the Daily Challenge and three new objectives every day,
  > and unlock block skins, ambiances and shatter effects, one of them from each Guardian.
  >
  > No sign-up, progress saved automatically. Play with the keyboard, or by touch on phones and
  > tablets, in portrait or landscape. Available in English, French and Indonesian.

- **Controls** :

  > **Keyboard**
  >
  > - Move: Left / Right arrows (or A / D)
  > - Soft drop: Down arrow (or S) — Hard drop: Space
  > - Rotate: Up arrow or X — Rotate the other way: Z
  > - Hold: C or Shift — Flip the well (Flip mode): F
  > - Turn the Tower: Q / E
  > - Mosaic: 1–3 to pick a piece (4 for the bonus cube), arrows to aim, Enter to place, J for
  >   the jokers, Backspace to cancel
  > - Pause: P
  >
  > Keys follow your keyboard layout (on AZERTY, the same places: W rotates the other way).
  >
  > **Touch**
  >
  > - Drag sideways to move, tap to rotate, tap with two fingers to rotate the other way.
  > - Drag down to drop softly, flick down to drop at once, flick up (or tap the hold box) to
  >   hold.
  > - Turn the Tower with a two-finger drag. Mosaic: drag pieces onto the board, or tap a piece
  >   then a cell.
  > - On-screen buttons can be turned on in the settings.

- **Orientation** : paysage et portrait (le jeu s'adapte aux deux).
- **Mobile** : oui. **Progress Save** : oui (module Data). **Multijoueur** : non.
  **Comptes** : non (aucune connexion).
- **Genre** : Puzzle (blocs qui tombent). **Public** : PEGI 3 de fait (aucune violence, aucun
  achat, aucun chat).

## Revue modérateur du 21/10/2026 (build 1.17.2)

**Méthode.** Le build CrazyGames est servi en local (`vite preview --mode crazygames`), avec le
SDK v3 dans son environnement `local` : les pubs y sont simulées (5 s), sans l'attente de 3
minutes du portail, et `systemInfo` y est factice (langue toujours `en-US`). Les essais tournent
dans Chrome sans profil, en iframe 907 × 510 à DPR 1 sauf mention contraire, avec chaque appel
au SDK journalisé. Le « débutant » est un joueur simulé qui lâche chaque pièce toutes les 2 s.

| Contrôle                                   | Statut     | Preuve                                                                                                                                                          |
| ------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chargement, chemin vers le jeu             | ✅         | Premier affichage à 0,26 s ; un clic (« PLAY · Level 1-1 ») ; `gameplayStart` 1 s après l'ouverture                                                             |
| Entrée fracassante (débutant)              | ✅         | Choc électrique à 10 s, embrasement à 16 s, liane à 22 s ; 1-1 gagné entre 23 et 31 s                                                                           |
| Événements SDK                             | ✅         | `loadingStart`/`loadingStop` puis `gameplayStart` à chaque partie ; `gameplayStop` sur P et en fin de partie ; aucun sur perte de focus                         |
| Échap, Ctrl+W                              | ✅         | Échap ne fait rien en jeu et laisse la pause ouverte ; Ctrl n'est jamais utilisé                                                                                |
| Défilement, clic droit, sélection          | ✅         | Flèches, Espace, Fin, molette : la page ne bouge pas ; menu contextuel bloqué ; `user-select: none`                                                             |
| Bouton muet du portail                     | ✅         | `?muteAudio=true` : moteur audio coupé, réglage du joueur intact                                                                                                |
| Pub midgame                                | ✅ corrigé | Avant : pub à 25 s (passage au 1-2). Après : aucune avant 3 min de jeu ; à 3 min, « Try again » → pub, son suspendu pendant, repris après, puis `gameplayStart` |
| Pas de pub sur la navigation               | ✅         | « Home » : aucun appel au SDK                                                                                                                                   |
| Bloqueur de pub (SDK bloqué)               | ✅         | Jeu complet ; « Play again » relance en 0,2 s ; seule erreur : le script bloqué lui-même                                                                        |
| Sauvegarde (module Data)                   | ✅         | Progression gardée au rechargement ; moins de 1 Ko pour une limite de 1 Mo                                                                                      |
| Tailles d'iframe                           | ✅         | 821 × 462, 907 × 510, 1280 × 720, 1920 × 1080, 800 × 450, 390 × 844, 844 × 390 : rien ne déborde ; fenêtre de fin sans défilement                               |
| Langues                                    | ✅         | Français et indonésien sans débordement (langue réglée dans le jeu : le SDK local dit toujours `en-US`)                                                         |
| 144 / 165 Hz                               | ✅         | Moteurs identiques à 60, 144 et 165 Hz (graines fixes, 5 cas) ; Chrome sans synchro verticale tourne à 150–165 i/s                                              |
| Performances (processeur ralenti 4×)       | ✅         | 95 % des images en moins de 8 ms, aucune image lente : 1-1 et les quatre boss                                                                                   |
| Console, réseau                            | ✅         | Aucune erreur ; seuls `localhost` et `sdk.crazygames.com` contactés                                                                                             |
| `happytime`                                | ✅ corrigé | N'est plus envoyé à chaque niveau gagné : seulement pour un record battu ou un Gardien vaincu                                                                   |
| Pause au clavier                           | ✅ corrigé | P ouvre la pause et la referme                                                                                                                                  |
| Safari, téléphone réel, Chromebook, volume | 🟡         | Pas de WebKit sur la machine : à faire dans l'outil QA du portail et sur appareil                                                                               |

### La page qualité, point par point

| Attente du portail                                      | Statut  | Constat                                                                                                                 |
| ------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| Prise en main dans le jeu, courte, passable, visuelle   | ✅      | Partie guidée sur le puits, « Skip the guide », touches dessinées à côté du jeu, gestes dans la pause sur écran tactile |
| Interface claire, boutons nommés par leur destination   | ✅      | « PLAY · Level 1-1 », « Level 1-2 », « Try again », « Campaign map »                                                    |
| Boutons ni grossis ni retardés pour pousser une pub     | ✅      | Aucune pub récompensée sur CrazyGames ; boutons de fin égaux                                                            |
| Objectifs clairs, facile à apprendre et à comprendre    | ✅      | Carte d'objectif (« Clear 2 regions 0 / 2 ») et minuteur ; chaque élément nommé quand il arrive                         |
| Commandes cohérentes, suivant la disposition du clavier | ✅      | Mêmes touches dans toute la famille ; touches par position physique (AZERTY vérifié)                                    |
| Réactif, fluide                                         | ✅      | Voir performances ; relance en 0,2 s                                                                                    |
| Défi et rythme équilibrés                               | ✅      | 1.18 : après la démonstration du 1-1, le 1-2 fait pratiquer les éléments ; le Classique attend le 1-3                   |
| Mise en page, interface adaptée à l'appareil            | ✅      | Toutes les tailles d'iframe ; portrait et paysage ; gestes au doigt                                                     |
| Plusieurs profils de joueurs                            | ✅      | Campagne, défi du jour, 13 modes, duel contre l'IA, quatre boss                                                         |
| Scénario intéressant, si le jeu en a un                 | ✅      | La faille et ses quatre Gardiens donnent un fil ; pas d'histoire racontée                                               |
| Pas de tâche répétitive                                 | ✅      | Chaque niveau change de mode ou d'objectif                                                                              |
| Unique, facile à enrichir, entretenu                    | ✅      | Nom et iconographie propres ; niveaux et boss en données ; six versions cette semaine                                   |
| Graphismes et sons de qualité, style cohérent           | ✅ / 🟡 | Une identité commune (gemmes, verre, céramique, sable) ; le volume sonore reste à juger à l'oreille                     |
| Clair sur ce qu'il est : nom et images fidèles au jeu   | ✅      | 1.18 : l'accueil joue les huit moments des vidéos, l'Œil de la Tour compris, avant même de jouer                        |

### Recommandations (à décider)

1. ~~**Rythme du chapitre 1**~~ : fait en 1.18 (1-2 de Sable, éléments au hasard, sans vent).
2. ~~**Cover et premières minutes**~~ : fait en 1.18, l'accueil joue l'Œil de la Tour parmi les
   huit moments de sa boucle.
3. **Outil QA du portail** : les brouillons et l'aperçu restent ouverts pendant la pause des
   soumissions. Téléverser le dossier `dist-crazygames/` de la 1.17.2 dans le brouillon pour
   relire le journal du SDK, Safari et un téléphone avant le 28/10.

## Contrôle des exigences (1.11.0, vitrine 1.17.0)

Légende : ✅ conforme, vérifié · 🟡 conforme, vérification humaine à faire sur le portail ·
➖ sans objet.

### Technique

| Exigence                                                      | Statut  | Preuve                                                                                         |
| ------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| Taille totale ≤ 250 Mo                                        | ✅      | Contrôle automatique de `package:crazygames` (moins de 1 Mo)                                   |
| Téléchargement initial ≤ 50 Mo, ≤ 20 Mo pour l'accueil mobile | ✅      | Tout le build compte, moins de 1 Mo                                                            |
| ≤ 1 500 fichiers                                              | ✅      | Contrôle automatique                                                                           |
| Chemins relatifs uniquement                                   | ✅      | `base: './'` ; contrôle automatique (aucun `/assets/` absolu)                                  |
| Seule requête externe : le SDK                                | ✅      | Mesuré : seul `sdk.crazygames.com` est contacté (polices embarquées)                           |
| Chrome et Edge ; Safari                                       | ✅ / 🟡 | Tests de bout en bout sur Chrome ; Safari à essayer dans l'outil QA du portail                 |
| Fluide sur Chromebook 4 Go                                    | 🟡      | Rendu canvas 2D léger ; à confirmer sur appareil                                               |
| Souris et clavier, tactile sur mobile                         | ✅      | Clavier complet, gestes partout sur l'écran de jeu, boutons tactiles en option                 |
| Paysage sur ordinateur ; portrait possible                    | ✅      | Captures à 907 × 510, 821 × 462, 1280 × 720, 800 × 450 et 390 × 844 : rien ne défile           |
| Pas de logique de verrouillage d'orientation                  | ✅      | Aucune                                                                                         |
| `user-select: none` sur `body` (+ préfixes)                   | ✅      | `:root[data-platform='crazygames'] body` (`base.css`)                                          |
| Zones sûres de l'appli CrazyGames                             | ✅      | `viewport-fit=cover`, marges `env(safe-area-inset-*)` sur le menu, le jeu et les fenêtres      |
| Audio iOS : `resume()` sur geste                              | ✅      | `AudioEngine.unlock()` à chaque `pointerdown` / `keydown`                                      |
| SDK : `gameplayStart` à l'état jouable                        | ✅      | Vérifié dans le journal du SDK (environnement `local`)                                         |
| SDK : `gameplayStop` (pause, fin, menus)                      | ✅      | Pause, fin de partie, sortie de l'écran de jeu                                                 |
| SDK : `loadingStart` / `loadingStop`                          | ✅      | Autour du chargement de chaque partie                                                          |
| SDK : module Data (sauvegarde)                                | ✅      | Réglages, records, profil, campagne ; copie unique de l'ancienne sauvegarde ; repli navigateur |
| SDK : `muteAudio`                                             | ✅      | Prioritaire sur le son du jeu (test unitaire)                                                  |
| Sitelock, comptes, données personnelles                       | ➖      | Aucun                                                                                          |

### Gameplay

| Exigence                                             | Statut | Preuve                                                                        |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Lisible à `devicePixelRatio` 1, aux tailles d'iframe | ✅     | Captures à DPR 1 ; WCAG 2.2 AA (axe) sur chaque écran et fenêtre              |
| Physique identique à 60, 144, 165 Hz                 | ✅     | Moteurs au temps écoulé ; Sable à pas fixe de 16 ms                           |
| Anglais inclus ; langue du SDK, anglais par défaut   | ✅     | `systemInfo.locale` → fr / en / id, sinon anglais                             |
| Commandes intuitives sur chaque appareil             | ✅     | Touches dessinées à côté du jeu et dans la pause ; gestes dessinés            |
| Charge vite, sans erreur                             | ✅     | Console sans erreur (e2e et revue du build) ; Lighthouse ≥ 95                 |
| Originalité (nom, visuels)                           | ✅     | Nom, identité, matières et sons propres ; aucun nom ni visuel de jeu existant |
| Pas de bouton plein écran maison                     | ✅     | Aucun                                                                         |
| Pas de promotion croisée ni de lien externe          | ✅     | « Partager » retiré du build CrazyGames ; aucun lien                          |
| PEGI 12, public 13+                                  | ✅     | Aucune violence, aucun contenu sensible                                       |
| Joueur en jeu en 1 clic au plus (Full)               | ✅     | « Play » sur l'écran-titre : 1 clic, partie guidée                            |

### Publicité

| Exigence                                                         | Statut | Preuve                                                                                       |
| ---------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Uniquement via le SDK                                            | ✅     | `ad.requestAd('midgame')`                                                                    |
| Basic Launch : le jeu tourne sans pub                            | ✅     | `adError` → la partie suivante démarre aussitôt (test unitaire)                              |
| Midgame aux pauses naturelles, **jamais sur la navigation**      | ✅     | Seulement « Play again » et « Next level » ; rien vers l'accueil ou la carte (test unitaire) |
| Jeu en pause, interface bloquée jusqu'à `adFinished` / `adError` | ✅     | Fenêtre de fin fermée, voile bloquant, partie non démarrée                                   |
| Son coupé seulement quand la pub démarre                         | ✅     | `adStarted` → `audio.suspend()`, fin → `resume()` (test unitaire)                            |
| Fréquence (1 / 3 min)                                            | ✅     | Gérée par le SDK                                                                             |
| Pub récompensée                                                  | ➖     | **Désactivée sur CrazyGames** (`supportsRewarded = false`) : voir ci-dessous                 |
| Bannières                                                        | ➖     | Non utilisées                                                                                |
| Bloqueurs de pub                                                 | ✅     | Rien ne dépend d'une pub                                                                     |

La pub récompensée « doubler l'XP » (1.6, pour Playgama) reste coupée sur CrazyGames : les pubs
y sont désactivées pendant le Basic Launch (le bouton ne ferait rien, motif de refus), et au
Full Launch la récompense doit aussi pouvoir s'obtenir sans pub. À réactiver seulement avec une
autre façon de gagner le bonus.

### Covers et vidéos

Refaites en 1.17 (`scripts/media-covers.mjs`, scènes dans `media/scenes.ts`, partagées
depuis la 1.18 avec la boucle de l'accueil dans `src/showcase/`).

| Exigence                                                   | Statut | Preuve                                                                                                                  |
| ---------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Paysage 1920 × 1080, portrait 800 × 1200, carrée 800 × 800 | ✅     | Générées aux dimensions exactes                                                                                         |
| Visuels cohérents entre les trois                          | ✅     | Même scène : l'Œil de la Tour au-dessus de la tour de gemmes, son regard rouge, une bombe qui éclate, le titre          |
| Plus qu'une capture, lisible en vignette                   | ✅     | Un personnage (l'Œil), une silhouette (la tour), le titre ; vérifié à 200 px de large                                   |
| Seul texte : le titre                                      | ✅     | « Lumirift Blocks » uniquement                                                                                          |
| Pas de bordure, d'icône de store ni de visuel sous droits  | ✅     | Dessin original (HTML et SVG), police du jeu embarquée                                                                  |
| Vidéo 15 à 20 s, ≤ 50 Mo, 1080p paysage et portrait 2:3    | ✅     | 19,7 s ; 1920 × 1080 (3,8 Mo) et 1080 × 1620 (5,5 Mo)                                                                   |
| Montre le meilleur du jeu, sans tromper                    | ✅     | Vrais moteurs : foudre dans l'eau et huile en feu, Ver des dunes, Œil de la Tour aveuglé, Golem, Cœur de la faille      |
| Pas d'écran noir, de bandes noires, de curseur, de texte   | ✅     | Images rendues directement, plein cadre, deux images de chauffe par scène ; s'ouvre sur la cover ; relu image par image |
| Sans son, pas d'accéléré                                   | ✅     | Aucune piste audio ; rendu image par image (30 i/s)                                                                     |
| Format                                                     | 🟡     | WebM (VP9) : le ffmpeg disponible n'encode pas le MP4 ; convertir (HandBrake) si le portail le refuse                   |

### Qualité (recommandations)

| Recommandation                                        | Statut                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Prise en main dans le jeu, courte, passable, visuelle | ✅ Partie guidée (doigt animé, touches), 1-1 calme : une seule idée                                                             |
| Commandes montrées (superposition clavier)            | ✅ Touches dessinées à côté du jeu (5 premières parties) et dans la pause                                                       |
| Commandes adaptées au clavier (AZERTY)                | ✅ Touches par position physique, étiquettes selon la disposition du clavier                                                    |
| Éviter les touches du navigateur (Échap, Ctrl+W)      | ✅ Aucune n'est utilisée ; sur les portails, Échap ne fait rien dans le jeu, pas même fermer une fenêtre (vérifié sur le build) |
| Style visuel cohérent, sons équilibrés, musique       | ✅                                                                                                                              |

## Indicateurs du Basic Launch

CrazyGames juge le lancement sur 7 jours (et 500 parties, sinon 21 jours) : **temps de jeu
moyen** (10 min et plus pour les meilleurs), **rétention à J+1** (10 à 15 %), **conversion**
(joueurs qui jouent au moins 1 minute ; 80 % et plus pour les meilleurs, qui chargent en
moins de 10 s et pèsent moins de 20 Mo).

- Chargement : build de moins de 1 Mo, première partie en moins de 2 s sur ordinateur.
- Conversion : une partie en 1 clic, guidée, sans danger au premier niveau.
- Temps de jeu et rétention : campagne de 34 niveaux dont quatre boss, défi du jour,
  objectifs, série, niveaux et Atelier (nouveautés signalées, un cosmétique par boss).

## Reste à faire sur le portail

1. Nouveau brouillon (ou celui qui existe) : téléverser le **dossier** du build décompressé,
   les trois covers et les deux vidéos ; saisir description et commandes ; résumer les
   améliorations ci-dessus dans le message de soumission.
2. Cocher **Progress Save** (module Data) et les orientations paysage et portrait.
3. Passer l'**outil QA** du Developer Portal (aperçu, contrôle des exigences, SDK) et essayer
   Safari et un téléphone réel.
