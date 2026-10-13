# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions
[SemVer](https://semver.org/lang/fr/).

## [1.3.0] — 13/10/2026

La démo du portfolio.

### Ajouté

- Éditions du jeu (complète, démo) portées par la plateforme du build.
- Build de démo (`npm run build:demo`, dossier `dist-demo`) pour adamrodwebdev.com : cinq
  modes en jeu libre (Classique, Sable, Mosaïque, Tour, Duel), le premier chapitre de la
  campagne, bandeau d'accueil ; les autres modes et niveaux restent visibles, marqués
  « Jeu complet ».

### Modifié

- Le défi du jour et les objectifs quotidiens ne proposent que les modes ouverts par
  l'édition.

## [1.2.0] — 13/10/2026

La version CrazyGames.

### Ajouté

- Abstraction `Platform` (notre site, CrazyGames) : le jeu ne parle jamais directement à un
  SDK de portail.
- Build CrazyGames (`npm run package:crazygames`) : SDK HTML5 v3, événements de jeu et de
  chargement, langue du joueur, sauvegarde dans le module Data, bouton muet du portail,
  célébrations, publicité mi-partie entre deux parties (interface bloquée, son coupé pendant
  la pub seulement), aucun lien sortant ; contrôles automatiques de taille, de nombre de
  fichiers et de chemins ; zip prêt à téléverser.
- Médias CrazyGames : trois covers (1920 × 1080, 800 × 1200, 800 × 800) et deux vidéos de
  18 s (1080p paysage et portrait) rendues image par image depuis le vrai jeu.
- docs/CRAZYGAMES.md : chaque exigence du portail, son statut et sa preuve ; textes du dépôt.

### Modifié

- Dans un cadre paysage peu haut (iframe de portail sur téléphone), le HUD passe sur le côté
  et l'en-tête s'affine.

### Corrigé

- Mosaïque : dans un cadre paysage peu haut (960 × 540, 800 × 450), la taille de la main et
  celle du plateau s'entretenaient l'une l'autre ; le plateau était redimensionné, donc
  effacé, à chaque image et restait noir.

## [1.1.0] — 13/10/2026

La campagne.

### Ajouté

- Campagne : 30 niveaux en cinq chapitres à travers tous les modes, objectifs, étoiles,
  un duel contre une IA plus forte à la fin de chaque chapitre.
- Dix améliorations à trois rangs, achetées avec les étoiles de campagne (sablier, plume,
  longue-vue, ancre, prisme, phénix, besace, braise, métronome, rempart), remboursables ;
  elles ne servent qu'en campagne.
- Carrousel des modes avec filtres par famille et une illustration par mode.

### Modifié

- Accueil repensé : barre joueur, campagne en tête, défi du jour illustré, partie rapide.
- Style : boutons en pilule, accent en dégradé, cartes surélevées.

## [1.0.0] — 12/10/2026

Première version complète : 13 modes en quatre familles, défi du jour, duel contre l'IA,
progression et Atelier, en français, anglais et indonésien.

### Ajouté

- Tests de bout en bout (Playwright) sur téléphone et ordinateur : les 13 modes, une partie
  complète, défi du jour, réglages retenus, Atelier, clavier seul, aucun défilement
  horizontal de 320 à 1920 px.
- Audits d'accessibilité axe-core WCAG 2.2 AA de chaque écran et fenêtre, dans les deux
  thèmes ; intégration continue (vérifications, parcours, Lighthouse).
- Partage : carte Open Graph, données structurées, manifeste et icônes ; lien canonique et
  plan du site quand l'adresse du site est fournie (`SITE_URL`).
- README complet : le jeu, les commandes, l'accessibilité, la mise en ligne.

### Modifié

- Le focus passe à la région principale à chaque changement d'écran.

## [0.9.0] — 12/10/2026

La progression.

### Ajouté

- Expérience et niveaux (1 à 50), gagnés de la même façon dans toutes les familles : temps
  de jeu, effacements, défi du jour, victoires en duel, objectifs.
- Trois objectifs du jour (facile, moyen, difficile), les mêmes pour tous, et la série de
  jours au défi du jour.
- Atelier : six matières de blocs pour les modes de chute, six ambiances pour tout le jeu,
  quatre signatures de bris ; tout est cosmétique et se débloque en jouant.
- Fin de partie : expérience gagnée, niveau, objectifs accomplis, objets débloqués.

## [0.8.0] — 12/10/2026

Des règles revues d'après les jeux du genre.

### Modifié

- Sable : le feu se vise (la zone qu'il brûlerait scintille), brûle pour la moitié des
  points et 1 500 grains au plus ; l'eau éteint le feu et prend la couleur la plus présente
  autour d'elle ; le vent ne soulève que la surface, alterne et se tait près du haut ; au
  moins 3 pièces de sable entre deux éléments, annoncés dans l'aperçu.
- Mosaïque : chaque main peut être posée en entier ; barème par lignes d'un coup et combo
  qui tolère deux poses sans effacement ; jokers selon l'exploit, 2 de chaque, un retour
  offert au départ.
- Duel : cinq niveaux d'IA, de Débutante à Experte, calés sur les vitesses de vrais
  joueurs ; dès la Normale, l'IA utilise la réserve et prépare des effacements de 4 lignes.

## [0.7.0] — 12/10/2026

La Tour : les 14 modes de la version 1.0 sont jouables.

### Ajouté

- Tour : le puits s'enroule en cylindre de verre de 20 colonnes ; une ligne fait le tour
  complet. Caméra qui suit la pièce, tournée à la main (A / E, ou Q / E en QWERTY, ou deux
  doigts).
- Rendu en pseudo-3D sur canvas 2D : faces ombrées selon l'angle, reflet, dos de la tour
  visible à travers le verre, éclats qui font le tour du cylindre.
- La Tour peut être le mode du défi du jour.

### Modifié

- Les couleurs des braises, de la cendre et de l'argile passent dans les jetons CSS : toute
  l'esthétique se règle depuis `tokens.css`.
- L'accueil n'annonce plus de mode à venir.

## [0.6.0] — 12/10/2026

Le Sable.

### Ajouté

- Sable : les pièces se désagrègent en 6 × 6 grains par case ; une zone d'une seule couleur
  qui relie les deux murs s'efface, même sinueuse.
- Éléments : eau qui s'infiltre puis se fige dans la couleur voisine, feu qui consume la
  zone de la couleur qu'il touche, coups de vent annoncés qui poussent le sable.
- Rendu au pixel avec une texture par couleur ; paillettes, braises, poussière, traînées de
  vent ; sons d'écoulement, de balayage, de crépitement et de rafale.
- Le Sable peut être le mode du défi du jour.

### Modifié

- Les boutons tactiles de la famille Chute peuvent masquer la réserve.

## [0.5.0] — 12/10/2026

La Mosaïque, première famille hors chute.

### Ajouté

- Mosaïque : grille de 8 × 8 sans gravité, trois pièces de céramique de 1 à 9 cases, lignes
  et colonnes, séries, grille nette ; jokers gagnés en jouant (Rotation, Relance, Bombe,
  Retour, Cube), jamais payants.
- Aperçu de la pose avec les lignes qui vont s'effacer, pièces impossibles grisées.
- Glisser-déposer (la pièce flotte au-dessus du doigt), toucher puis viser, clavier complet.
- Rendu céramique : carreaux émaillés, rebond à la pose, fissure puis tessons, bombe ; sons de
  céramique.
- La Mosaïque peut être le mode du défi du jour ; aide de la pause propre à chaque famille.

### Modifié

- Tons, palette et motifs gravés deviennent un socle partagé par toutes les familles.

### Corrigé

- Le plateau de la Mosaïque débordait de l'écran sur téléphone (taille par défaut du canvas).
- L'aperçu de la bombe restait accroché au curseur clavier quand on reprenait la souris.

## [0.4.0] — 12/10/2026

Duel contre l'IA.

### Ajouté

- Duel : affrontez une IA facile, normale ou experte ; mêmes pièces pour les deux camps,
  rangées envoyées selon les lignes et les combos, annulation des rangées reçues, délai d'une
  seconde, jauge des rangées en approche, puits adverse en vignette vivante.
- IA par recherche de placements et évaluation (hauteur, lignes, trous, irrégularité), qui
  joue par les mêmes commandes que le joueur.
- Choix de la difficulté avant la partie ; titre « Victoire » en fin de duel gagné ; son
  d'attaque.

### Corrigé

- La vignette du puits adverse débordait de sa colonne (taille par défaut d'un canvas).

## [0.3.0] — 12/10/2026

Quatre modes avancés.

### Ajouté

- Fusion : six blocs de même couleur fusionnent, réactions en chaîne, points par maillon.
- Bascule : puits carré qui pivote d'un quart de tour vers la gauche toutes les 10 lignes.
- Silhouette : la silhouette du jour à remplir avec un nombre limité de pièces ;
  bibliothèque de 30 formes nommées en français, anglais et indonésien.
- Rythme : pulsation qui accélère avec le niveau, multiplicateur jusqu'à × 4 pour les
  pièces posées dans le temps, métronome visuel et sonore.
- Effets et sons propres à ces modes ; sous-titre de partie (nom de la silhouette).
- Fusion et Rythme peuvent être le mode du défi du jour.

## [0.2.0] — 12/10/2026

Matière et effets : la destruction devient spectaculaire.

### Ajouté

- Destructions de cristal : fissure, éclats physiques qui rebondissent sur la pile,
  effondrement pondéré des rangées, points qui s'envolent, secousse et ralenti sur
  4 lignes, effondrement de toute la pile en fin de partie.
- Moments des modes : bascule 3D du Renversement, pivot du Miroir, surface d'eau de la
  Marée, gerbe prismatique des lignes pures, onde de niveau, lueur de danger.
- Son entièrement synthétisé (16 recettes, aucun fichier) et vibrations sur mobile.
- Réglages : effets complets, sobres ou aucun ; secousses ; vibrations ; volume ; coupure du
  son depuis l'en-tête.
- Qualité adaptative des particules et limiteur de flashs (WCAG 2.3.1).
- Délai de 280 ms après un effacement, identique quels que soient les effets.

### Corrigé

- « Rejouer » et « Recommencer » affichaient encore la partie précédente.
- Tableau de bord plus compact sur les petits téléphones.

## [0.1.0] — 12/10/2026

Première version jouable.

### Ajouté

- Outillage du projet : Vite, Vue 3, TypeScript strict, ESLint, Prettier, Vitest, Playwright.
- Cahier des charges v0.1 à v0.6 : cadrage, moteur, quatorze modes en quatre familles,
  session et registre, direction artistique, interface et mesures.
- Moteur de jeu pur TypeScript : puits 10 × 20, sept pièces avec rotation standard et
  décalages muraux, sac de 7, réserve, aperçu, pièce fantôme, délai de verrouillage,
  score et combos, courbe de vitesse, rangées de déchets, renversement du puits.
- Contrat des modes de jeu (stratégies) et mode Classique.
- 44 tests unitaires du moteur.
- Contrat `GameSession` commun à toutes les familles de jeux, registre des modes
  (`ModeCatalog`, chargement de chaque famille à la demande) et défi du jour
  (`DailyChallenge` : mode et pièces du jour identiques pour tous, 2 minutes).
- Modes Marée, Renversement, Chroma et Miroir.
- Interface Vue : accueil (défi du jour, modes, records), écran de jeu avec rendu Cristal
  (sprites facettés, motifs gravés pour les daltoniens), réserve, aperçu, pièce fantôme,
  tableau de bord par mode, pause, fin de partie, records et partage du résultat.
- Commandes clavier (positions physiques, répétition automatique) et tactiles (boutons et
  gestes sur le puits).
- Français, anglais et indonésien, changés à chaud ; thèmes clair et sombre sans flash.
- Script `npm run lighthouse` : 100 dans les quatre catégories, mobile et bureau.
- 121 tests unitaires au total.

### Modifié

- Le moteur devient la famille Chute (`src/families/falling`) ; les briques partagées
  passent dans `src/core`.
