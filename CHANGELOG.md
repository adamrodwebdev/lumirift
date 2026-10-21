# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions
[SemVer](https://semver.org/lang/fr/).

## [1.13.0] — 21/10/2026

La Tour piégée.

### Ajouté

- **Gemmes-bombes** dans la Tour : environ une pièce sur cinq porte une bombe sur l'une de ses
  cases. Effacer son anneau la fait exploser : elle souffle un secteur de la tour (5 colonnes,
  l'anneau et trois rangées au-dessus), et les bombes prises dans le souffle explosent à leur tour
  (réaction en chaîne). 40 points par bloc soufflé, multipliés par le niveau.
- Avant la pose, le secteur qui sauterait **clignote en rouge, rayé** : la bombe se vise. Les
  bombes se voient aussi dans l'aperçu et la réserve.
- Éclats, secousse, éclair, son d'explosion et vibration ; « Boum ! » et « Réaction en chaîne ».

## [1.12.0] — 21/10/2026

Les éléments : le Sable devient un monde vivant, où les éléments réagissent entre eux.

### Ajouté

- **Cinq nouveaux éléments** dans le Sable, qui arrivent niveau après niveau : **huile** (épaisse,
  elle flotte sur l'eau), **glace** (elle tient comme une passerelle et fond seule), **foudre**
  (l'éclair frappe sous la pièce et cherche l'eau), **graine** (arrosée, elle pousse en liane de
  la couleur du sable : un pont pour relier les murs) et **acide** (il creuse dans le sable).
- **Réactions** : feu et huile donnent un **brasier** qui ronge le sable ; feu et eau, ou feu et
  glace, une **vapeur** qui masque le puits puis retombe en **pluie** ; l'eau **gèle** contre la
  glace ; la foudre dans l'eau **électrocute** toutes les couleurs qui la touchent (points
  entiers) ; le feu remonte une liane comme une **mèche** ; l'eau **dilue** l'acide. Chaque réaction
  est nommée la première fois, avec son effet et son son.
- **Entrée fracassante** : le premier niveau montre en une minute l'électrocution, le brasier et
  la liane ; la pièce qui réagit apparaît au-dessus de l'élément précédent.
- Ce que la foudre briserait **scintille** avant la pose, comme la zone que le feu brûlerait.

### Modifié

- L'eau reste liquide environ 6 s (au lieu de 2) avant de se figer, pour laisser le temps aux
  combinaisons ; le sable coule à travers les liquides ; le feu reste en surface.

## [1.11.1] — 21/10/2026

### Corrigé

- **Portails : une perte de focus ne signale plus d'arrêt de partie.** Le jeu se met toujours
  en pause quand il perd le focus ou que l'onglet est caché, mais seul le joueur qui met en
  pause envoie `gameplayStop` (CrazyGames suit lui-même le focus) ; la reprise n'envoie
  `gameplayStart` qu'après un arrêt signalé.
- **Zip CrazyGames** : fabriqué avec `tar` (chemins en « / ») au lieu de `Compress-Archive`,
  qui écrivait `assets\x.js` sous Windows ; le script vérifie les chemins.

## [1.11.0] — 21/10/2026

### Modifié

- **Couleurs des pièces redistribuées** : aucune pièce ne porte plus la couleur que lui donne le
  standard du genre (I rose, O violet, T ambre, S cyan, Z citron vert, J corail, L bleu). Mêmes
  sept joyaux, mêmes textures ; les menus gardent exactement leurs couleurs (jetons
  `--jewel-*` séparés des teintes des pièces). Couvertures et vidéos CrazyGames refaites.

- **Mosaïque plus vivante** :
  - la pièce prise quitte sa place dans la main (place vide en pointillés), grandit à la taille
    du plateau et suit le doigt, son ombre d'emboîtement sur la grille ;
  - lâchée sur une place libre, elle s'y glisse puis se pose : chaque carreau descend, rebondit
    et brille, du centre vers les bords, dans une poussière de glaçure ;
  - lâchée ailleurs, elle revient se ranger dans la main ;
  - une nouvelle main arrive pièce après pièce ;
  - sons : prise, emboîtement possible, retour en main, nouvelle main, pose plus lourde.
- **Ligne « Record »** sous le score de la Mosaïque (hors campagne) : le record du joueur à
  battre ; quand il tombe, la ligne passe en or, une bannière « Nouveau record ! » éclate sur le
  plateau avec une fanfare et une vibration, puis la ligne suit le score.
- **Changer d'ambiance se voit** : dans l'Atelier, un anneau de la lumière de la nouvelle
  ambiance part de la carte touchée et balaie l'écran, puis le fond passe en fondu d'une
  ambiance à l'autre (au lieu de changer d'un coup). Avec les animations réduites, le fondu
  seul.

### Corrigé

- **Boutons de fin de partie** : en paysage, ils s'étiraient en disques trop étroits pour leur
  texte. Ils gardent leur hauteur ; avec trois boutons, l'action principale prend toute la
  largeur au-dessus des deux autres.
- **Tour : la caméra ne revient plus au point de départ.** Chaque nouvelle pièce apparaît
  au-dessus de l'endroit où la précédente s'est posée (au centre si la place manque) : la vue
  reste là où le joueur construit au lieu de repartir vers la colonne d'origine.

## [1.10.0] — 20/10/2026

Prêt pour une nouvelle soumission à CrazyGames : revue complète du build comme un modérateur,
puis corrections.

### Ajouté

- **Touches dessinées** : à côté du jeu pendant les cinq premières parties et dans la pause,
  chaque commande au clavier s'affiche en touches (flèches, Espace, X, Z…), selon la disposition
  du clavier du joueur (sur AZERTY, la touche « tourner dans l'autre sens » s'affiche W).
  Elles remplacent le paragraphe d'aide.

### Modifié

- **Niveau 1-1 calme** : le Sable de la toute première partie n'a ni vent, ni eau, ni feu (ils
  arrivent au chapitre 2) : la première partie n'enseigne qu'une idée, relier les deux murs.
- **Une console au centre** (paysage, ordinateur) : le tableau de bord se range en colonne
  contre le puits, les pièces suivantes de l'autre côté, au lieu d'être aux bords de l'écran.
- L'objectif d'un niveau tient sur deux lignes au lieu d'être coupé (téléphone).
- **Échap n'est plus utilisé du tout sur les portails** (il y quitte le plein écran) : ni dans
  la Mosaïque (Retour arrière annule le choix), ni pour fermer une fenêtre (seuls ses boutons
  la ferment). Sur notre site, Échap ferme toujours une fenêtre.
- **CrazyGames** : aucune pub en allant vers l'accueil ou la carte (le portail interdit les
  pubs sur les boutons de navigation) ; pas de pub récompensée (les pubs sont coupées pendant
  le Basic Launch, et la récompense devrait aussi s'obtenir sans pub). Playgama inchangé.
- Vidéos de présentation refaites avec le jeu actuel (elles montraient l'ancien look).

## [1.9.0] — 20/10/2026

Les fenêtres deviennent des feuilles : rien ne défile, même sur un petit téléphone.

### Ajouté

- **Feuilles** : chaque fenêtre monte du bas de l'écran sur un téléphone tenu droit et
  apparaît au centre en paysage et sur ordinateur ; son contenu suit en cascade, et elle
  redescend en se fermant. Un bouton de fermeture dans le coin pour celles qui informent ou
  règlent.
- **Fin de partie mise en scène** : le résultat défile jusqu'à sa valeur, « Nouveau record »
  surgit, la barre d'expérience se remplit (jusqu'au bout puis de nouveau quand un niveau
  est franchi, avec son badge), puis ce que la partie a débloqué ; deux colonnes en paysage.
- **Garde à l'ouverture** : une fenêtre qui vient d'apparaître ignore un instant les
  touchers, Entrée et Espace, pour qu'un joueur qui martèle Espace en fin de partie ne
  relance pas sans le vouloir.
- **Nouveautés de l'Atelier** : une pastille sur l'onglet Atelier compte les matières,
  ambiances et éclats gagnés depuis la dernière visite ; un point marque leur famille et une
  étiquette « Nouveau » chaque objet. L'Atelier s'ouvre sur la famille qui a du nouveau ;
  un objet n'est plus nouveau une fois essayé, ou quand on quitte son étagère. Les objets
  déjà gagnés avant cette version ne sont pas comptés.

### Modifié

- **Pause** : Reprendre en grand, puis Recommencer, Réglages et Quitter ; les gestes à
  droite en paysage.
- **Réglages** en lignes compactes (interrupteurs, choix en pastille), deux colonnes en
  paysage ; la confidentialité et la version tiennent en une ligne.
- **Améliorations** : les dix dans une grille ; celle qu'on choisit montre son effet et
  s'achète en dessous. « Tout reprendre » à côté des étoiles.
- **Fiche de niveau**, **choix de l'adversaire** (deux colonnes en paysage) et **objectifs du
  jour** passent aussi en feuilles.
- L'Atelier dit où se voit chaque matière et chaque signature d'éclats.
- Un test de bout en bout vérifie qu'aucune fenêtre ne défile de 360 × 640 à l'ordinateur.

## [1.8.0] — 20/10/2026

Le menu devient un jeu : quatre pages en onglets, sans défilement, au doigt comme au clavier.

### Ajouté

- **Menu à onglets** : Accueil, Modes, Carte et Atelier, côte à côte. On passe de l'une à
  l'autre par les onglets ou d'un **glissement du doigt** ; la pastille de l'onglet suit le
  doigt. Les onglets sont sous le pouce en portrait et deviennent un **rail à gauche** en
  paysage et sur ordinateur. Au clavier, les flèches vont d'onglet en onglet.
- **Accueil vivant** : les gemmes du jeu tombent à plusieurs profondeurs devant la faille,
  qui respire et jette des étincelles ; le logo, le défi du jour, un grand bouton Jouer à
  portée du pouce et les objectifs du jour (dans une fenêtre).
- **Page Modes** : les 13 modes sur un seul écran, les quatre qui n'existent nulle part
  ailleurs en grand, chacun illustré avec les vraies gemmes du jeu ; le mode choisi montre son
  principe, son record et le bouton Jouer.
- **Carte de campagne** : un chapitre par écran, ses six niveaux sur un chemin sinueux qui
  s'illumine à mesure qu'on avance, le prochain niveau qui pulse ; flèches pour changer de
  chapitre. Un niveau encore fermé dit ce qui l'ouvre.
- **Atelier en page** : une vitrine au-dessus d'une étagère. Un premier toucher essaie la
  matière, l'ambiance ou les éclats sur la vitrine ; un second la porte.
- **Transition de la faille** : en lançant une partie, la faille s'ouvre depuis le bouton
  touché et inonde l'écran de sa lumière, le temps de charger le mode ; au retour, les pages
  remontent en place.
- La barre du haut garde le joueur (niveau, expérience : ouvre l'Atelier), les étoiles
  (ouvrent la carte), le son et les réglages.

### Modifié

- Plus d'en-tête de page ni de pied de page : la confidentialité et la version passent dans
  les réglages.
- Après une partie, on revient sur la page d'où on l'a lancée (la carte pour la campagne).

### Retiré

- L'ancien accueil défilant, le carrousel des modes et l'écran de campagne séparé.

## [1.7.0] — 20/10/2026

La partie sur téléphone : tout au doigt, sans défilement, dans les deux orientations.

### Ajouté

- **Gestes partout sur l'écran de jeu**, plus seulement sur le puits (le doigt ne cache plus
  les pièces) : glisser sur le côté pour déplacer, toucher pour tourner, **toucher à deux
  doigts pour tourner dans l'autre sens**, **glisser vite vers le haut pour la réserve**,
  glisser vers le bas pour descendre, d'un coup sec pour la chute instantanée. La case de la
  réserve se touche aussi, et le pouvoir de Renversement a son bouton à côté.
- **Réglage « Commandes : Gestes / Boutons »** sur écran tactile : les boutons ne s'affichent
  plus par défaut ; choisis, ils reviennent en deux groupes, un par pouce (sous le puits en
  portrait, de chaque côté en paysage).
- **Paysage jouable** pour toutes les familles : le puits au centre sur toute la hauteur, le
  tableau de bord et la réserve à gauche, les pièces suivantes à droite (le Duel ajoute
  l'adversaire à côté d'elles, la Mosaïque pose sa main à droite).
- **La chute instantanée se voit** : la pièce tombe en accélérant (90 à 230 ms selon la
  hauteur, avec une traînée) puis se pose avec une lueur ; les règles, l'IA et le Rythme ne
  changent pas (la chute reste instantanée en Rythme, pour sonner sur le temps).
- **Effacement de ligne** : la faille part de la pièce qui a complété la ligne et court dans
  les deux sens ; chaque brique s'éclaire et se fissure à son passage, puis éclate **le long de
  ses fissures en morceaux de la gemme elle-même** (image de la brique, pas une couleur unie) ;
  un « RIFT! » allume le puits d'une lueur chaude.
- La pause montre les **gestes en images** sur écran tactile, et donne accès aux réglages.

### Modifié

- Pendant une partie, **plus d'en-tête de page** : une barre minimale (pause, son) ; le puits
  gagne la place. Au téléphone (390 × 844), les cases passent de 23 à 32 px ; en paysage
  (844 × 390), de 7 à 18 px.
- Le guide de la première partie montre le geste par un doigt animé.
- Plus de surlignage bleu au toucher (celui d'Android) ; le contour doré reste pour le clavier.

## [1.6.0] — 15/10/2026

### Ajouté

- **Pub récompensée facultative** en fin de partie : un bouton « PUB · Doubler l'XP » double
  l'expérience de la partie. La récompense n'est donnée que si le portail confirme que la pub a
  été vue jusqu'au bout (Playgama : état `rewarded`, CrazyGames : `adFinished`). Une pub
  fermée trop tôt ou absente ne donne rien et le jeu continue normalement. Une seule fois par
  partie, jamais pendant le jeu.

### Modifié

- L'interstitiel peut aussi passer quand le joueur quitte l'écran de fin de partie vers
  l'accueil ou la carte de campagne, plus seulement sur « Rejouer » et « Niveau suivant ». Le
  portail espace toujours les pubs (120 s au moins sur Playgama), et il n'y a jamais
  d'interstitiel juste après une pub récompensée.

## [1.5.1] — 14/10/2026

### Modifié

- Nom complet « Lumirift Blocks » (Playgama demande un titre de 2 à 4 mots, identique dans le
  jeu et le formulaire) : en-tête, titre de la page, manifeste, logo « LUMI | RIFT » sous-titré
  « BLOCKS », écran de démarrage, covers. La marque reste Lumirift.

## [1.5.0] — 14/10/2026

Le jeu s'appelle désormais **Lumirift**.

### Modifié

- Nouveau nom partout : logo (LUMI | RIFT), titres et descriptions en trois langues, écran de
  démarrage, manifeste, covers, paquets des portails (`lumirift-playgama-<version>.zip`…),
  documentation. Les clés de sauvegarde ne changent pas : aucune progression n'est perdue.

## [1.4.0] — 14/10/2026

L'identité « Rift » et la version Playgama.

### Ajouté

- Version Playgama (`npm run package:playgama`) : Bridge SDK v2, langue, son et pause de la
  plateforme, sauvegarde par le Bridge, `game_ready` et messages de niveau, interstitiel entre
  deux parties ; contrôles des exigences de Playgama et de ses partenaires ; covers 1920×1080,
  1080×1920, 800×800 ; docs/PLAYGAMA.md.
- Écran-titre : logo fendu par la faille, grand bouton Jouer, modes inédits en tuiles, scène
  animée ; écran de démarrage statique.
- Première partie guidée pas à pas (déplacer, tourner, faire tomber, le but), passable.
- Musique générative dans la tonalité du jeu, dont l'intensité suit le danger ; volume de la
  musique dans les réglages.
- Mots des grands moments dans le puits (×2, ×3, COMBO ×N, RIFT!) ; la faille déchire les
  lignes effacées.
- Lumière de famille et faille lointaine derrière le jeu.

### Modifié

- Thème unique sombre « Rift » (indigo, or, tons joyaux), polices Unbounded et Sora livrées
  avec le jeu, blocs gemmes ; écran de jeu resserré autour du puits.
- Tous les sons dans une même tonalité (ré mineur pentatonique), réverbération commune.
- La campagne s'ouvre sur le Sable ; en Sable, les buts parlent de zones.
- Plus d'Échap ni de Ctrl en jeu (réservées par les portails) : P pour la pause, Z (W en
  AZERTY) pour tourner dans l'autre sens.
- La langue d'un portail s'applique à chaque lancement.
- Covers (CrazyGames et Playgama) redessinées dans la nouvelle identité.

### Supprimé

- Le thème clair et la bascule de thème.

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
