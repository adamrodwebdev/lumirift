# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions
[SemVer](https://semver.org/lang/fr/).

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
