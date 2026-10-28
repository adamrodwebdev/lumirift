# Lumirift sur Playgama

Version Playgama du jeu (Bridge SDK v2) et contrôle de chaque exigence de la plateforme,
lue en entier le 14/10/2026 (wiki.playgama.com : exigences, FAQ, Bridge SDK v2).
CrazyGames a refusé la 1.2 sur la « qualité d'ensemble » (13/10/2026) : la 1.4 refond
l'identité (§ 3.8 du cahier des charges) avant cette nouvelle soumission.

## Pourquoi Playgama

- Soumission libre, contrôle préalable (page d'auto-vérification, outil QA), nouvelle
  soumission possible après un refus.
- Une seule intégration (Bridge) diffuse le jeu chez les partenaires : MSN, Playhop/Yandex,
  GameDistribution, YouTube Playables, Xiaomi, GameSnacks… (désactivables un par un).
- Revenus : 70 % jusqu'à 1 000 $/mois, 80 % jusqu'à 3 000 $, 90 % au-delà sur les sites
  partenaires ; 50 % sur Playgama et son réseau ; paiement à partir de 100 $.
- À vérifier avant de signer : l'exclusivité (la page des conditions n'a pas pu être lue).

## Construire et livrer

```bash
npm run package:playgama                          # build, contrôles, zip dans release/
node scripts/crazygames-media.mjs --covers-only   # covers dans release/playgama-media/
```

Le zip (`release/lumirift-playgama-<version>.zip`, 0,2 Mo environ) a `index.html` à la
racine, des chemins relatifs et des séparateurs « / » (bsdtar).

**Bac à sable** : en 1.38.0 depuis le 28/10/2026 (contrôle de Playgama `PASSED`, Bridge 2.3.1
détecté, chargement 0,67 s, 278 Ko au premier affichage). La fiche (description et « How to
play ») est à jour de la 1.38 depuis le même jour.

**Premier lancement (1.29)** : comme sur CrazyGames, un nouveau joueur arrive directement
dans l'entraînement, une seule partie depuis la 1.33 (le choc au premier éclair, les
éléments du Sable, puis le Ver des dunes avant 30 s), sans
écran-titre ni menu, sans pub ; les menus s'ouvrent à la fin ou quand il le passe depuis la
pause. Le profil, gardé par `bridge.storage`, retient qu'il est fait.

## Le test des Dunes (1.37)

Deux jeux du bac à sable, chacun avec un seul mode, comparés à trafic égal (le lot 19 du cahier
des charges) :

```bash
npm run package:playgama-dunes   # release/lumirift-playgama-dunes-<version>.zip
npm run package:playgama-sand    # release/lumirift-playgama-sand-<version>.zip
```

- Chaque zip passe les mêmes contrôles que la version complète (taille, chemins, Bridge, aucune
  autre requête).
- Dans les deux, un nouveau joueur commence directement par une partie du mode, sans
  entraînement ni titre ; le menu n'a que l'accueil et l'Atelier ; ni défi du jour, ni
  Gardiens, ni course, ni carrousel des autres modes.
- Sur la console : deux jeux distincts (le test compare leurs tableaux de bord), **les mêmes
  covers**, le même texte de fiche à un mot près, la même langue. **Aucun trafic acheté**
  (décision du 27/10/2026 : pas de dépense avant que le jeu rapporte) : les parties viennent
  des sessions d'inconnus et de qui reçoit le lien. Les covers actuelles montrent l'Œil de la
  Tour, qui n'est dans aucune des deux : une cover de sable, commune aux deux, est à choisir
  avant l'envoi.
- La porte et sa lecture : [PREUVE.md](PREUVE.md), section 4.

## Exigences et leur contrôle

| Exigence                                                                                                                 | Statut | Preuve                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Bridge chargé, `bridge.initialize()` avant tout appel                                                                    | ✓      | `PlaygamaPlatform.create`, script v2 en `<head>` (contrôlé par le paquet)                                                                |
| Langue de la plateforme (`platform.language`), anglais par défaut                                                        | ✓      | `locale` de la plateforme, appliquée à chaque lancement                                                                                  |
| Choix de la langue compréhensible sans lire                                                                              | ✓      | Icône réglages, noms des langues dans leur langue                                                                                        |
| Progression par `bridge.storage` seulement, une lecture groupée au lancement                                             | ✓      | `BridgeStorage` : une lecture de toutes les clés, écritures groupées                                                                     |
| Progression conservée (rechargement, rotation, publicité)                                                                | ✓      | Vérifié avec le vrai Bridge (2.3.1, mode local)                                                                                          |
| Pause et son de la plateforme (`PAUSE_STATE_CHANGED`, `AUDIO_STATE_CHANGED`)                                             | ✓      | Pause de la partie, coupure du son ; état du son lu au lancement                                                                         |
| Son coupé quand la page est cachée                                                                                       | ✓      | Contexte audio suspendu (`visibilitychange`)                                                                                             |
| Bouton muet                                                                                                              | ✓      | En-tête                                                                                                                                  |
| `game_ready` une fois, au premier écran interactif                                                                       | ✓      | Après le montage et le premier rendu ; avant `level_started` (1.29)                                                                      |
| Messages de niveau (`level_started`, `_paused`, `_resumed`, `_completed`…)                                               | ✓      | Début, pause, reprise, fin (gagné : niveau ou duel)                                                                                      |
| Au moins un format de publicité, aux pauses naturelles                                                                   | ✓      | Interstitiel en quittant une partie gagnée ou finie au chrono, jamais après une défaite ni en jeu ; 8 min de grâce, 3 min d'écart (1.31) |
| Publicité jamais sous le doigt ; jeu en pause et muet pendant                                                            | ✓      | Interface bloquée pendant la pause publicitaire ; événements de la plateforme                                                            |
| Pub récompensée facultative, étiquetée « PUB », récompense seulement sur `rewarded`                                      | ✓      | Doubler l'XP, la reprise d'une partie perdue (rare, 10 min d'écart), l'essai d'une apparence ; rien si fermée tôt                        |
| Aucune requête externe hormis le Bridge ; pas d'analytique                                                               | ✓      | Contrôle du paquet (polices et sons inclus, aucune URL appelée)                                                                          |
| Pas de liens sortants, pas de verrouillage de domaine                                                                    | ✓      | `allowsExternalLinks = false` (pas de partage d'URL)                                                                                     |
| Pas de barre de défilement de la page                                                                                    | ✓      | Défilement dans le cadre du jeu ; vérifié de 360×640 à 2560×1440                                                                         |
| Contrôles ordinateur et tactiles                                                                                         | ✓      | Clavier, souris, gestes et boutons                                                                                                       |
| Archive ZIP ≤ 300 Mo, `index.html` à la racine, noms latins                                                              | ✓      | Contrôle du paquet                                                                                                                       |
| Partenaires : MSN < 50 Mo, YouTube ≤ 30 Mo et ≤ 8 000 fichiers, Facebook ≤ 500 fichiers, GameSnacks < 10 Mio par fichier | ✓      | Contrôle du paquet                                                                                                                       |
| Contenu original, pas de marque d'autrui, pas d'art IA brut                                                              | ✓      | Identité propre (Rift), aucun nom « Tetris », graphismes dessinés en code                                                                |
| Difficulté croissante, progression, son                                                                                  | ✓      | Niveaux de vitesse, campagne, musique générative                                                                                         |
| Titre de 2 à 4 mots identique dans le jeu et le formulaire                                                               | ✓      | « Lumirift Blocks » dans le jeu et le formulaire                                                                                         |
| Yandex/Playhop : russe                                                                                                   | ✓      | Russe depuis la 1.24 ; Yandex Games reste exclu de la distribution, le jeu y va en direct ([YANDEX.md](YANDEX.md))                       |

## Formulaire de soumission (textes en anglais)

- **Title** : Lumirift Blocks (2 à 4 mots demandés ; le même nom dans le jeu : en-tête, titre
  de la page, logo « LUMI | RIFT » sous-titré « BLOCKS »).
- **Game engine** : `js`.
- **Description** (≥ 100 caractères ; 1 226 saisis le 28/10/2026, chaque paragraphe séparé
  d'une ligne vide dans le champ) :

  > Lumirift Blocks is a falling-blocks game where the blocks fight back. Pieces crumble into
  > sand alive with elements: drop lightning into water to shock a whole colour away, set oil
  > ablaze, freeze water into ice, grow a vine across a gap. Wrap the well into a glass Tower
  > where bomb gems blow whole sectors apart, then face the four Guardians of the rift: the Dune
  > Wyrm, the Ceramic Golem, the Eye of the Tower and the Heart of the Rift.
  >
  > 14 original modes: Classic, Tide, Flip, Mirror, Chroma, Fusion, Tilt, Rhythm and
  > Silhouette; the Sand; the 8×8 Mosaic with its jokers; the Tower; a Duel against an AI, from
  > Rookie to Expert; and the Rift Race through the well, the Sand and the Tower.
  >
  > Play a 69-level campaign across ten chapters where every Guardian comes back stronger; earn
  > up to three stars per level and spend them on 10 upgrades. Come back for the Daily
  > Challenge, the weekly Guardian challenge, three new objectives and a gift every day, and
  > six-week seasons with their own rewards. Unlock block skins, ambiances and shatter effects.
  >
  > No sign-up, progress saved automatically. Play with the keyboard, or by touch on phones and
  > tablets, in portrait or landscape. Available in English, French, Indonesian and Russian.

- **How to play** (≥ 100 caractères ; 1 075 saisis le 28/10/2026) :

  > Each campaign level sets a goal (lines to clear, points to score, a Guardian to defeat...)
  > worth up to three stars. Fill rows to clear lines; in the Sand, link both walls with one
  > colour. Your first game is a short guided training.
  >
  > Keyboard: Left/Right arrows or A/D to move, Down or S to soft drop, Space to hard drop, Up
  > or X to rotate, Z to rotate the other way, C or Shift to hold, F to flip the well (Flip), V
  > for the Rift surge once its gauge is full, Q/E to turn the Tower, P to pause. Mosaic: 1-3
  > to pick a piece (4 for the bonus cube), arrows to aim, Enter to place, J for the jokers,
  > Backspace to cancel. Keys follow your keyboard layout (on AZERTY, W rotates the other way)
  > and can be changed in the settings.
  >
  > Touch: drag sideways to move, tap the right half to rotate and the left half to rotate the
  > other way, drag down to drop softly, flick down to drop at once, flick up or tap the hold
  > box to hold, turn the Tower with a two-finger drag. Mosaic: drag pieces onto the board, or
  > tap a piece then a cell. The settings offer gestures, on-screen buttons or both.

- **Supported devices** : Desktop, Android, iOS. **Orientation** : portrait et paysage.
- **Languages** : English, French, Indonesian, Russian.
- **Covers** : `release/playgama-media/` (1920×1080, 1080×1920, 800×800, PNG).
- **Distribution** : « Yandex Games » exclu, le jeu y va en direct (la règle 3.6 de Yandex
  refuse un même jeu publié deux fois : [YANDEX.md](YANDEX.md)).
