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

| Reproche probable (diagnostic du 14/10/2026) | Depuis                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accueil de « web app », menu qui défile      | Écran-titre vivant (gemmes, faille), menu en quatre pages à onglets sans défilement, transition de la faille (1.8)                                                                                                                                                                                                      |
| Identité générique, premier mode = clone     | Nom « Lumirift Blocks », identité « Rift » (gemmes gravées, faille dorée, polices propres) ; la campagne s'ouvre sur le Sable, mode inédit (1.4–1.5) ; aucune pièce aux couleurs du standard du genre (1.11)                                                                                                            |
| Petit plateau dans un grand écran vide       | Plus d'en-tête pendant la partie, puits sur toute la hauteur, tableau de bord rangé contre le puits (console centrée), paysage jouable (1.7, 1.10)                                                                                                                                                                      |
| Pas de musique                               | Musique générative par famille, sons synthétisés (1.4)                                                                                                                                                                                                                                                                  |
| Pas de prise en main                         | Un nouveau joueur arrive directement dans l'entraînement, une partie (le choc au premier éclair, les éléments du Sable, puis le Ver des dunes avant 30 s), guidé à l'écran, passable depuis la pause ; les menus ensuite (1.29, une partie depuis la 1.33). Sur le site : première partie guidée, 1-1 calme (1.4, 1.10) |
| Échap et Ctrl utilisés                       | Plus aucun : P pour la pause, Retour arrière pour annuler dans la Mosaïque ; sur les portails, Échap ne ferme même plus une fenêtre (1.4, 1.10)                                                                                                                                                                         |
| Effets plats                                 | Chute instantanée animée, lignes qui éclatent en éclats de gemme, résultats mis en scène (score qui défile, barre d'XP), feuilles animées (1.7, 1.9)                                                                                                                                                                    |
| Téléphone                                    | Tout au doigt (gestes partout), aucun défilement, portrait et paysage, fenêtres qui tiennent à l'écran (1.7–1.9)                                                                                                                                                                                                        |
| Rien d'inédit face aux succès du tag         | Éléments du Sable qui réagissent entre eux (foudre et eau, huile en feu, glace, liane, acide, vapeur) montrés dès la première minute (1.12) ; gemmes-bombes dans la Tour (1.13)                                                                                                                                         |
| Peu de raisons de revenir                    | Quatre Gardiens de la faille, un boss par chapitre, chacun avec sa riposte et son cosmétique : Ver des dunes, Golem de céramique, Œil de la Tour, Cœur de la faille (1.14–1.17)                                                                                                                                         |
| Vitrine terne                                | Covers lumineuses autour d'un personnage (l'Œil de la Tour) ; vidéos sur les éléments et les quatre boss (1.17)                                                                                                                                                                                                         |
| Premières minutes sans relief                | L'accueil joue les meilleurs moments du jeu en direct (1.18) ; danger, musique qui s'emballe et « Close call! » (1.19) ; combos (1.20) ; surcharge de la faille (1.25) ; commandes au doigt précises (1.32)                                                                                                             |
| Peu de contenu, peu de raisons de revenir    | Campagne réglée par un bot de courbe (1.33), puis 69 niveaux en dix chapitres et des Gardiens qui reviennent plus forts (1.38) ; course contre la montre (1.34) ; cadeau du jour et collections (1.35) ; saisons de six semaines et élément de la semaine (1.36)                                                        |

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

**Premier lancement (1.29)** : un nouveau joueur ne voit ni écran-titre ni menu. Il arrive
dans l'entraînement (une partie depuis la 1.33 : le choc au premier éclair, les éléments du
Sable, le Ver des dunes vers 28 s), avec
`gameplayStart` dès la première pièce ; la pause propose seulement « Resume » et « Skip the
training ». Le build CrazyGames le rejoue de bout en bout (`e2e/portal.spec.ts`).

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
  > 14 original modes: Classic, Tide, Flip, Mirror, Chroma, Fusion, Tilt, Rhythm and
  > Silhouette; the Sand; the 8×8 Mosaic with its jokers; the Tower; a head-to-head Duel against
  > an AI, from Rookie to Expert; and the Rift Race, a race against the clock through the well,
  > the Sand and the Tower.
  >
  > Play a 69-level campaign across ten chapters, where every Guardian comes back stronger; earn
  > up to three stars per level and spend them on 10 upgrades. Come back for the Daily Challenge,
  > the weekly Guardian challenge, three new objectives and a gift every day, and six-week
  > seasons with their own rewards. Unlock block skins, ambiances and shatter effects, one of
  > them from each Guardian.
  >
  > No sign-up, progress saved automatically. Play with the keyboard, or by touch on phones and
  > tablets, in portrait or landscape. Available in English, French, Indonesian and Russian.

- **Controls** :

  > **Keyboard**
  >
  > - Move: Left / Right arrows (or A / D)
  > - Soft drop: Down arrow (or S) — Hard drop: Space
  > - Rotate: Up arrow or X — Rotate the other way: Z
  > - Hold: C or Shift — Flip the well (Flip mode): F — Rift surge, once its gauge is full: V
  > - Turn the Tower: Q / E
  > - Mosaic: 1–3 to pick a piece (4 for the bonus cube), arrows to aim, Enter to place, J for
  >   the jokers, Backspace to cancel
  > - Pause: P
  >
  > Keys follow your keyboard layout (on AZERTY, the same places: W rotates the other way).
  >
  > **Touch**
  >
  > - Drag sideways to move; tap the right half to rotate, the left half to rotate the other way
  >   (a second finger's tap turns the piece during a drag).
  > - Drag down to drop softly, flick down to drop at once, flick up (or tap the hold box) to
  >   hold.
  > - Turn the Tower with a two-finger drag. Mosaic: drag pieces onto the board, or tap a piece
  >   then a cell.
  > - Touch controls in the settings: gestures, on-screen buttons or both, drag speed,
  >   left-handed, vibrations.

- **Orientation** : paysage et portrait (le jeu s'adapte aux deux).
- **Mobile** : oui. **Progress Save** : oui (module Data). **Multijoueur** : non.
  **Comptes** : non (aucune connexion).
- **Genre** : Puzzle (blocs qui tombent). **Public** : PEGI 3 de fait (aucune violence, aucun
  achat, aucun chat).

## Revue modérateur du 28/10/2026 (build 1.38.0)

**Méthode.** Le paquet `release/lumirift-crazygames-1.38.0.zip` (123 fichiers, 1,39 Mo,
chemins en `/`) est servi en local (`vite preview --mode crazygames`, SDK v3 3.8.0 en
environnement `local`), dans Chrome sans profil, chaque appel au SDK journalisé, à 907 × 510
sauf mention, puis à 821 × 462, 800 × 450, 1280 × 720, 1920 × 1080, 390 × 844 et 844 × 390.
Deux joueurs simulés : un débutant qui lâche chaque pièce, et un joueur qui revient (9 minutes
déjà jouées).

| Contrôle                             | Statut     | Preuve                                                                                                                                                                                                                  |
| ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arrivée directe en jeu               | ✅         | L'entraînement dès l'ouverture, aucun onglet ; `gameplayStart` entre 0,5 et 0,7 s à toutes les tailles                                                                                                                  |
| Entrée fracassante                   | ✅         | Le débutant chasse le Ver des dunes à 32 s (4 813 points, combo ×2), puis le 1-1 suit sans menu, 2,4 s plus tard                                                                                                        |
| Événements SDK                       | ✅         | `gameplayStart` et `gameplayStop` à chaque partie et sur la pause ; ni `gameplayStop` à la perte du focus, ni `gameplayStart` au retour                                                                                 |
| Pubs                                 | ✅         | Aucune demande avant 8 min de jeu d'un nouveau joueur, ni avant 3 min de la visite ; joueur qui revient : première midgame à 4,3 min, entre deux niveaux, sur « Try again » ; le niveau suivant attend la fin de la pub |
| Aucune offre récompensée             | ✅         | Sur CrazyGames, ni reprise, ni cadeau ou expérience doublés, ni essai d'une ambiance contre une pub                                                                                                                     |
| Fenêtre qui s'ouvre seule            | 🟡         | Le cadeau du jour s'ouvre sur l'accueil pour un joueur qui revient (« Claim +50 XP » et une croix) ; jamais pour un nouveau joueur                                                                                      |
| Écran de fin                         | ✅         | « Level complete! », étoiles, expérience et points de saison ; « Level 1-2 », « Try again », « Campaign map »                                                                                                           |
| Muet du portail, Échap, Ctrl+W       | ✅         | Le muet du SDK l'emporte sur le réglage du jeu et suit ses changements ; Échap neutralisé ; Ctrl jamais utilisé                                                                                                         |
| Disposition du clavier               | ✅         | La légende suit la disposition du joueur (W pour « tourner dans l'autre sens » sur AZERTY)                                                                                                                              |
| Tailles d'iframe, téléphones         | ✅         | Aucun défilement ni erreur aux sept tailles ; au téléphone, le guide au-dessus du puits, les gestes au doigt                                                                                                            |
| Performances (processeur ralenti 4×) | ✅         | 158 images/s en médiane, 99 % sous 12,2 ms, une seule au-delà de 50 ms en 12 s                                                                                                                                          |
| Moteurs à 144 / 165 Hz               | ✅         | Pas fixe de 16 ms : vitesse indépendante de l'écran (inchangé depuis la revue de la 1.17.2)                                                                                                                             |
| Console, réseau, taille              | ✅         | Aucune erreur ; seuls `localhost` et `sdk.crazygames.com` ; 123 fichiers, 1,39 Mo                                                                                                                                       |
| Musique                              | ✅         | Dès le premier geste, sur tous les écrans : calme dans les menus, plus intense dans le danger                                                                                                                           |
| Description de la fiche              | ✅ corrigé | Disait « 13 original modes » et « 34-level campaign » : 14 modes, 69 niveaux, la course, les saisons et le défi des Gardiens ; la surcharge de la faille (V) ajoutée aux commandes                                      |
| Vidéos                               | 🟡         | En WebM (19,7 s, 16:9 et 2:3) : vérifier que le formulaire les accepte, sinon les exporter en MP4                                                                                                                       |
| Safari, téléphone réel               | 🟡         | Pas de WebKit sur la machine : outil QA du portail et appareil                                                                                                                                                          |

**La page qualité (grille E).** Tout passe, sauf deux lignes subjectives, laissées aux inconnus :
le style face aux cinq meilleurs du tag (sombre et précieux là où les covers du tag sont vives),
et le volume sonore, à juger à l'oreille. Le reste : arrivée en jeu, prise en main visuelle,
objectifs à l'écran, réactivité, courbe mesurée par le bot (une tension dès le 1-3, rien de
répétitif : chaque niveau change de mode ou d'objectif), fluidité (relance d'un clic, 2,4 s
d'un niveau au suivant), interface par appareil, publics variés (clémence des premiers
chapitres, durées de partie diverses), un fil (les Gardiens), graphismes nets aux deux
densités, nom unique ; la cover (l'Œil de la Tour) est jouée par l'accueil dès la fin de
l'entraînement.

**Verdict.** Prêt techniquement. Avant de soumettre : vérifier le format des vidéos dans le
formulaire, téléverser le dossier `dist-crazygames` dans l'outil QA du brouillon « Lumirift
Blocks » (Safari, un vrai téléphone), et faire jouer une dizaine d'inconnus sans aide (moyenne
au-delà de 3 minutes, un quart des parties au-delà de 3 minutes).

## Revue modérateur du 23/10/2026 (build 1.29.0, premier lancement)

**Méthode.** Le paquet `release/lumirift-crazygames-1.29.0.zip` est servi en local
(`vite preview --mode crazygames`, SDK v3 en environnement `local`), dans un Chromium sans
profil, avec chaque appel au SDK journalisé, à 8 tailles : 1280 × 720, 1920 × 1080,
907 × 510, 821 × 462, 800 × 450, 915 × 412, 390 × 844 et 360 × 640 (les quatre dernières au
toucher). Le « débutant » garde la descente rapide enfoncée : chaque pièce tombe où elle
apparaît.

| Contrôle                            | Statut     | Preuve                                                                                                                           |
| ----------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Arrivée directe en jeu, sans menu   | ✅         | Étape 1/2 de l'entraînement dès l'ouverture, aucun onglet ; `gameplayStart` vers 0,45 à 0,6 s                                    |
| Prise en main dans le jeu, passable | ✅         | Une phrase à la fois, touches ou geste ; croix pour masquer le guide ; « Skip the training » dans la pause                       |
| Rien sur le puits, rien de coupé    | ✅         | Aux 8 tailles : le guide ne recouvre jamais le puits, aucun texte rogné, aucun défilement                                        |
| Événements SDK                      | ✅         | `gameplayStart` à chaque étape ; `gameplayStop` sur P et à chaque fin d'étape ; reprise sur P                                    |
| Aucune pub pendant l'entraînement   | ✅         | Aucun appel au module `ad` jusqu'au 1-1 compris                                                                                  |
| Échap                               | ✅         | Sans effet pendant l'entraînement                                                                                                |
| Parcours complet du débutant        | ✅         | Étape 1 gagnée en 12 à 23 s, étape 2 en 6 à 7 s, puis « Level 1-1 » ; au rechargement, l'accueil                                 |
| Console, réseau                     | ✅ corrigé | Aucune erreur ; seul `sdk.crazygames.com` contacté. Les vibrations attendent le premier geste (Chrome les refusait en le disant) |
| Alarme de danger                    | ✅ corrigé | Plus aucune pendant l'entraînement, qui ne peut pas être perdu ; le rouge ne se fige plus sur une pause ni une fenêtre de fin    |
| Pubs, bloqueur, sauvegarde, 144 Hz  | —          | Code inchangé depuis la revue de la 1.17.2 : non refait                                                                          |
| Safari, téléphone réel              | 🟡         | Pas de WebKit sur la machine : à faire dans l'outil QA du portail et sur appareil                                                |

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
| Langues                                    | ✅         | Français, indonésien et russe sans débordement (langue réglée dans le jeu : le SDK local dit toujours `en-US`)                                                  |
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
| Plusieurs profils de joueurs                            | ✅      | Campagne, défi du jour, 14 modes dont une course contre la montre, duel contre l'IA, quatre boss                        |
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

| Exigence                                                         | Statut | Preuve                                                                                                                       |
| ---------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Uniquement via le SDK                                            | ✅     | `ad.requestAd('midgame')`                                                                                                    |
| Basic Launch : le jeu tourne sans pub                            | ✅     | `adError` → la partie suivante démarre aussitôt (test unitaire)                                                              |
| Midgame aux pauses naturelles, **jamais sur la navigation**      | ✅     | Seulement « Play again » et « Next level » ; rien vers l'accueil ou la carte (test unitaire)                                 |
| Jeu en pause, interface bloquée jusqu'à `adFinished` / `adError` | ✅     | Fenêtre de fin fermée, voile bloquant, partie non démarrée                                                                   |
| Son coupé seulement quand la pub démarre                         | ✅     | `adStarted` → `audio.suspend()`, fin → `resume()` (test unitaire)                                                            |
| Fréquence (1 / 3 min)                                            | ✅     | Gérée par le SDK, et par notre politique (1.31) : 8 min de grâce, 3 min d'écart, jamais après une défaite                    |
| Pub récompensée                                                  | ➖     | **Désactivée sur CrazyGames** (`supportsRewarded = false`, et `rewarded: false` dans la politique de pubs) : voir ci-dessous |
| Bannières                                                        | ➖     | Non utilisées                                                                                                                |
| Bloqueurs de pub                                                 | ✅     | Rien ne dépend d'une pub                                                                                                     |

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
- Temps de jeu et rétention : campagne de 69 niveaux dont neuf combats de Gardiens, défi du jour,
  objectifs, série, niveaux et Atelier (nouveautés signalées, un cosmétique par boss).

## Reste à faire sur le portail

1. Nouveau brouillon (ou celui qui existe) : téléverser le **dossier** du build décompressé,
   les trois covers et les deux vidéos ; saisir description et commandes ; résumer les
   améliorations ci-dessus dans le message de soumission.
2. Cocher **Progress Save** (module Data) et les orientations paysage et portrait.
3. Passer l'**outil QA** du Developer Portal (aperçu, contrôle des exigences, SDK) et essayer
   Safari et un téléphone réel.
