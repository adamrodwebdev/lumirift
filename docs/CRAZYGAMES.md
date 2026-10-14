# Lumirift sur CrazyGames — build, médias et conformité

Sources (lues le 13/10/2026) : [Requirements](https://docs.crazygames.com/requirements/intro/)
(technique, gameplay, publicité, covers, qualité), [Basic Launch metrics](https://docs.crazygames.com/resources/basic-launch-metrics/),
[SDK HTML5 v3](https://docs.crazygames.com/sdk/intro/).

## Produire le build et les médias

```bash
npm run package:crazygames          # build, contrôles automatiques, zip
node scripts/crazygames-media.mjs   # 3 covers et 2 vidéos (≈ 10 min)
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

- **Title** : Lumirift
- **Description** :

  > Lumirift reinvents the falling-blocks game you know with 13 original modes across four
  > families.
  >
  > Shatter crystal lines in Classic, outlast the rising Tide, flip the well upside down, match
  > colours in Chroma, fuse blocks in Fusion, keep the beat in Rhythm and fill a target shape
  > in Silhouette. Watch pieces crumble into sand and link both walls with a single colour,
  > while water, fire and wind change the field. Place ceramic pieces on an 8×8 Mosaic and earn
  > jokers. Wrap the well into a glass Tower where every line goes all the way around. Then
  > take on an AI opponent in a head-to-head Duel, from Rookie to Expert.
  >
  > Play a 30-level campaign that visits every mode, earn up to three stars per level and spend
  > them on 10 upgrades. Come back for the Daily Challenge and three new objectives every day.
  > Level up to unlock block skins, ambiances and shatter effects.
  >
  > No sign-up, progress saved automatically. Available in English, French and Indonesian.

- **Controls** :

  > **Keyboard**
  >
  > - Move: Left / Right arrows (or A / D)
  > - Soft drop: Down arrow (or S)
  > - Hard drop: Space
  > - Rotate: Up arrow or X — rotate back: Z or Ctrl
  > - Hold: C or Shift
  > - Special ability (Flip mode): F
  > - Turn the Tower: Q / E
  > - Pause: P or Esc
  > - Mosaic: 1–3 to pick a piece (4 for the bonus cube), arrows to aim, Enter to place, J to
  >   use a joker
  >
  > AZERTY keyboards are supported automatically: the same key positions work.
  >
  > **Mouse and touch**
  >
  > - Swipe left or right to move, tap to rotate, flick down to drop, or use the on-screen
  >   buttons.
  > - Turn the Tower with a two-finger drag.
  > - Mosaic: drag and drop pieces onto the board, or tap a piece and then a cell.

- **Orientation** : paysage et portrait (le jeu s'adapte aux deux).
- **Mobile** : oui. **Progress Save** : oui (module Data). **Multijoueur** : non.
  **Comptes** : non (aucune connexion).
- **Genre** : Puzzle (blocs qui tombent). **Public** : PEGI 3 de fait (aucune violence, aucun
  achat, aucun chat).

## Contrôle des exigences

Légende : ✅ conforme, vérifié · 🟡 conforme, vérification humaine à faire sur le portail ·
➖ sans objet.

### Technique

| Exigence                                                      | Statut  | Preuve                                                                                         |
| ------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| Taille totale ≤ 250 Mo                                        | ✅      | 0,44 Mo (contrôle automatique de `package:crazygames`)                                         |
| Téléchargement initial ≤ 50 Mo, ≤ 20 Mo pour l'accueil mobile | ✅      | Tout le build pèse 0,44 Mo                                                                     |
| ≤ 1 500 fichiers                                              | ✅      | 61 fichiers                                                                                    |
| Chemins relatifs uniquement                                   | ✅      | `base: './'` ; contrôle automatique (aucun `/assets/` absolu)                                  |
| Chrome et Edge ; Safari                                       | ✅ / 🟡 | Tests de bout en bout sur Chrome ; Safari à essayer dans l'outil QA du portail                 |
| Fluide sur Chromebook 4 Go                                    | 🟡      | Rendu canvas 2D léger (6 ms par image mesurés sur le Sable chargé) ; à confirmer sur appareil  |
| Souris et clavier, tactile sur mobile                         | ✅      | Clavier complet, gestes, boutons tactiles, glisser-déposer (Mosaïque)                          |
| Paysage sur ordinateur ; portrait possible                    | ✅      | Mise en page fluide de 320 à 1920 px ; à 800 × 450 le HUD passe sur le côté                    |
| Pas de logique de verrouillage d'orientation                  | ✅      | Aucune                                                                                         |
| `user-select: none` sur `body` (+ préfixes)                   | ✅      | `:root[data-platform='crazygames'] body` (`base.css`), vérifié dans le build                   |
| Zones sûres de l'appli CrazyGames                             | ✅      | `viewport-fit=cover`, rien collé aux bords hors marges                                         |
| Audio iOS : `resume()` sur geste                              | ✅      | `AudioEngine.unlock()` à chaque `pointerdown` / `keydown`                                      |
| SDK : `gameplayStart` à l'état jouable                        | ✅      | Vérifié dans le journal du SDK (environnement `local`)                                         |
| SDK : `gameplayStop` (pause, fin, menus)                      | ✅      | Pause, fin de partie, sortie de l'écran de jeu                                                 |
| SDK : `loadingStart` / `loadingStop`                          | ✅      | Autour du chargement de chaque partie                                                          |
| SDK : module Data (sauvegarde)                                | ✅      | Réglages, records, profil, campagne ; copie unique de l'ancienne sauvegarde ; repli navigateur |
| SDK : module User                                             | ➖      | Pas de comptes                                                                                 |
| Sitelock                                                      | ➖      | Aucun                                                                                          |
| Consentement / données personnelles                           | ➖      | Aucune donnée personnelle, aucun traceur                                                       |

### Gameplay

| Exigence                                             | Statut | Preuve                                                                        |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Lisible à `devicePixelRatio` 1, aux tailles d'iframe | ✅     | Captures à 800 × 450, 1080 × 607, 1280 × 720, 1920 × 1080 ; WCAG 2.2 AA (axe) |
| Physique identique à 60, 144, 165 Hz                 | ✅     | Moteurs au temps écoulé ; Sable à pas fixe de 16 ms                           |
| Anglais inclus ; langue du SDK, anglais par défaut   | ✅     | `systemInfo.locale` → fr / en / id, sinon anglais (vérifié : `lang="en"`)     |
| Commandes intuitives sur chaque appareil             | ✅     | Clavier, tactile, aide dans la pause                                          |
| Charge vite, sans erreur                             | ✅     | Console sans erreur (e2e) ; Lighthouse 100                                    |
| Originalité (nom, visuels)                           | ✅     | Nom, palette, matières et sons propres ; aucun nom ni visuel de jeu existant  |
| Pas de bouton plein écran maison                     | ✅     | Aucun                                                                         |
| Pas de promotion croisée ni de lien externe          | ✅     | Bouton « Partager » retiré du build CrazyGames ; aucun lien                   |
| PEGI 12, public 13+                                  | ✅     | Aucune violence, aucun contenu sensible                                       |
| Joueur en jeu en 1 clic au plus (Full)               | ✅     | « Continue · 1-1 » ou « Play » sur l'accueil : 1 clic                         |

### Publicité

| Exigence                                                         | Statut | Preuve                                                              |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| Uniquement via le SDK                                            | ✅     | `ad.requestAd('midgame')`                                           |
| Basic Launch : le jeu tourne sans pub                            | ✅     | `adError` → la partie suivante démarre aussitôt (test unitaire)     |
| Midgame aux pauses naturelles, jamais sur la navigation          | ✅     | Seulement « Play again » et « Next level », après une fin de partie |
| Jeu en pause, interface bloquée jusqu'à `adFinished` / `adError` | ✅     | Fenêtre de fin fermée, voile bloquant, partie non démarrée          |
| Son coupé seulement quand la pub démarre                         | ✅     | `adStarted` → `audio.suspend()`, fin → `resume()` (test unitaire)   |
| Fréquence (1 / 3 min)                                            | ✅     | Gérée par le SDK                                                    |
| Récompensées, bannières                                          | ➖     | Non utilisées                                                       |
| Bloqueurs de pub                                                 | ✅     | Rien ne dépend d'une pub                                            |

### Comptes, multijoueur, achats

➖ Sans objet : pas de connexion, pas de multijoueur en ligne, pas d'achat.

### Covers et vidéos

| Exigence                                                   | Statut | Preuve                                                                                                            |
| ---------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| Paysage 1920 × 1080, portrait 800 × 1200, carrée 800 × 800 | ✅     | Générées aux dimensions exactes                                                                                   |
| Visuels cohérents entre les trois                          | ✅     | Même scène : pile de cristal, fissure, éclats, titre                                                              |
| Seul texte : le titre ; ni « Play », ni « New »            | ✅     | « Lumirift » uniquement                                                                                           |
| Pas de bordure, d'icône de store ni de visuel sous droits  | ✅     | Logo du jeu seulement                                                                                             |
| Net, pas pixelisé                                          | ✅     | Rendu vectoriel à la taille finale                                                                                |
| Vidéo 15 à 20 s                                            | ✅     | 17,9 s (1,5 s de cover + Classique, Sable, Mosaïque, Tour : 4,1 s chacune)                                        |
| ≤ 50 Mo                                                    | ✅     | 2,6 Mo (paysage) et 4,1 Mo (portrait)                                                                             |
| 1080p paysage 16:9 et portrait 2:3                         | ✅     | 1920 × 1080 et 1080 × 1620                                                                                        |
| Pas d'écran noir, de bandes noires, de curseur             | ✅     | Images rendues directement, plein cadre                                                                           |
| Pas de texte promotionnel, d'icône d'app                   | ✅     | Jeu seul                                                                                                          |
| Pas d'accéléré                                             | ✅     | Rendu image par image en temps réel (30 i/s)                                                                      |
| Sans son                                                   | ✅     | Aucune piste audio (vérifié avec ffmpeg)                                                                          |
| Première image = cover statique                            | ✅     | Chaque vidéo s'ouvre sur sa cover                                                                                 |
| Format                                                     | 🟡     | WebM (VP9) : le portail ne fixe pas de format ; convertir en MP4 avec HandBrake (qu'il recommande) s'il le refuse |

### Qualité (recommandations)

| Recommandation                                                 | Statut                                                                      |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Prise en main simple, objectifs clairs                         | ✅ Campagne guidée, objectif affiché en jeu                                 |
| Commandes adaptées au clavier (AZERTY)                         | ✅ Touches par position physique                                            |
| Éviter les touches du navigateur (Échap quitte le plein écran) | 🟡 Échap met en pause ; **P** fait la même chose et est indiqué dans l'aide |
| Style visuel cohérent, sons équilibrés                         | ✅                                                                          |

## Indicateurs du Basic Launch

CrazyGames juge le lancement sur 7 jours (et 500 parties, sinon 21 jours) : **temps de jeu
moyen** (10 min et plus pour les meilleurs), **rétention à J+1** (10 à 15 %), **conversion**
(joueurs qui jouent au moins 1 minute ; 80 % et plus pour les meilleurs, qui chargent en
moins de 10 s et pèsent moins de 20 Mo).

- Chargement : build de 0,44 Mo, première partie en moins de 2 s sur ordinateur.
- Conversion : une partie en 1 clic ; la campagne et le défi du jour donnent un but immédiat.
- Temps de jeu et rétention : campagne de 30 niveaux, objectifs du jour, série, niveaux et
  Atelier.

## Reste à faire sur le portail

1. Téléverser le zip, les trois covers et les deux vidéos ; saisir description et commandes.
2. Cocher **Progress Save** (module Data) et les orientations paysage et portrait.
3. Passer l'**outil QA** du Developer Portal (aperçu, contrôle des exigences, SDK) et essayer
   Safari et un téléphone réel.
