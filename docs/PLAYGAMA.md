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

**Bac à sable** : en 1.29.0 depuis le 23/10/2026 (contrôle de Playgama `PASSED`, Bridge 2.3.1
détecté, chargement 0,76 s, 243 Ko au premier affichage).

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
  covers**, le même texte de fiche à un mot près, la même langue, le même trafic acheté
  (environ 1 000 parties chacun, environ 300 $ pour les deux : 400 parties coûtent
  50 $). Les covers actuelles montrent l'Œil de la Tour, qui n'est dans aucune des deux :
  une cover de sable, commune aux deux, est à choisir avant l'envoi.
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
| Yandex/Playhop : russe                                                                                                   | —      | Non traduit : exclure Playhop/Yandex dans le champ Distribution                                                                          |

## Formulaire de soumission (textes en anglais)

- **Title** : Lumirift Blocks (2 à 4 mots demandés ; le même nom dans le jeu : en-tête, titre
  de la page, logo « LUMI | RIFT » sous-titré « BLOCKS »).
- **Game engine** : `js`.
- **Description** (≥ 100 caractères) :

  > Lumirift reinvents the falling-blocks game with 13 original modes across four
  > families. Watch pieces crumble into sand and link both walls with one colour, wrap the
  > well into a glass Tower, place ceramic pieces on a Mosaic, and duel an AI from Rookie to
  > Expert. Play a 30-level campaign with 10 upgrades, a daily challenge and new objectives
  > every day. Every line you break tears the well open with the Rift.

- **How to play** (≥ 100 caractères) :

  > Keyboard: arrows or A/D to move, Up or X to rotate, Z to rotate back (W on AZERTY), Down
  > to soft drop, Space to hard drop, C or Shift to hold, P to pause. Tower: Q/E to turn.
  > Mosaic: 1-3 to pick a piece, arrows to aim, Enter to place, J for jokers. Touch: swipe to
  > move, tap the right or left half to turn that way, flick down to drop; drag and drop pieces
  > in Mosaic.

- **Supported devices** : Desktop, Android, iOS. **Orientation** : portrait et paysage.
- **Languages** : English, French, Indonesian, Russian.
- **Covers** : `release/playgama-media/` (1920×1080, 1080×1920, 800×800, PNG).
- **Distribution** : exclure Playhop et Yandex Games (pas de russe).
