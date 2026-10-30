# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions
[SemVer](https://semver.org/lang/fr/).

## [1.40.0] — 29/10/2026

La prise en main (lot 26), d'après des parties sur téléphone : au doigt, la pièce suit le doigt ;
un texte reste le temps d'être lu ; le puits et le message comptent le même combo.

### Modifié

- **De côté, la pièce suit le doigt à la case près** : le premier cran part à une demi-case (au
  lieu d'une case et un tiers), les suivants à chaque case, et de même après un demi-tour, lu à
  un sixième de case. Un glissé pressé de trois cases déplace de trois, plus de deux ; le
  tremblement du pouce ne déplace rien.
- **Vers le bas aussi** : une rangée par case de doigt, et la pièce s'arrête quand le doigt
  s'arrête, au lieu d'une chute à 20 rangées par seconde jusqu'au lever. Le clavier et les
  boutons gardent la descente continue.
- **Lever le doigt ne fait plus tomber la pièce d'un coup** : la chute franche est un coup franc
  vers le bas (1,6 px/ms), joué à l'instant ou au lever, ou un coup plus doux qui accélère encore
  en quittant l'écran ; une descente rapide qui garde son allure ou ralentit n'est jamais une
  chute. Un coup fait au moins 40 px (24 avant) : une petite descente d'une rangée n'en est pas un.
- **Le temps de lire** : les messages au-dessus du puits restent le temps d'être lus (1,2 s et
  55 ms par signe, de 1,5 à 7 s, au lieu de 1,4 s pour tous), et un nouveau message attend que le
  précédent soit lu. Les lignes du guide de l'entraînement et la carte de la première partie
  restent leur temps de lecture même quand l'étape est faite tout de suite ; la partie continue.

### Corrigé

- **Le compte des combos** : au troisième effacement d'affilée, le puits écrivait « COMBO ×2 »
  quand le message disait « ×3 », et rien au deuxième ; ils disent le même nombre dès « COMBO
  ×2 », dans le puits de chute comme dans la Tour.

### Technique

- `PhoneGestures` : crans arrondis à la case, descente par crans (`softStep`, une rangée, dans le
  moteur de chute, la Tour comprise, et dans celui du Sable) ; un doigt qui glisse encore quand la
  pièce suivante entre ne la fait pas descendre.
- `VelocityTracker` donne aussi l'accélération (la parabole des moindres carrés) : un coup
  accélère jusqu'au lever, une descente garde son allure.
- La porte des gestes ajoute le glissé pressé et la descente rapide lâchée en mouvement : 99 fois
  sur 100 la commande voulue, au plus une chute franche par accident sur 500 touchers. Sur une
  page qui charge une pub, dans un navigateur qui fusionne les échantillons (Firefox sur Android,
  Safari avant iOS 18.2), 6 à 8 % des coups juste après un déplacement sont manqués (3 % avant) :
  un saut fusionné peut aussi bien être une descente rapide, et une chute par accident coûte plus
  qu'un coup à refaire.
- `readingMs`, `ReadingHold` et `MessageQueue` (`src/ui/readingTime.ts`), testés sur toutes les
  lignes du guide et de la première partie, en quatre langues.

## [1.39.0] — 28/10/2026

La fabrique de clips (lot 25, la croissance sans dépense) : le jeu filme lui-même ses meilleurs
moments, sur ses vrais moteurs, pour TikTok, Instagram et YouTube Shorts.

### Ajouté

- **`npm run clips -- --week 2026-11-02`** rend les clips d'une semaine dans
  `release/clips/<lundi>/` : un MP4 vertical par clip (1080 × 1920, 30 images/s, H.264 et AAC,
  7 à 15 s), sa couverture (l'image du pic) et `manifest.json` (scène, variante, durée, temps du
  pic, mesures du moteur : grains brûlés, foudroyés, lignes ; niveau du son ; contrôles ;
  empreinte des images). `--clip <id>` rend un seul clip. Rien n'est publié : la fabrique
  n'écrit que des fichiers.
- **Le montage suit les moteurs**, jamais des temps posés à la main : une première prise sans
  image trouve le pic (le feu qui s'embrase, l'éclair, la blessure du Cœur) ; le clip s'ouvre
  0,15 s avant lui avec un zoom de × 1 à × 1,15 et environ 2,5 s de suite, puis rejoue la scène
  depuis le début jusqu'à l'image qui précède son ouverture : une boucle sans couture, que
  l'image et le son traversent, le pic une fois par tour. Un clip de moins de 7 s allonge sa
  suite, jamais sa reprise au-delà du pic.
- **Le son du jeu** (musique, effets, battement du danger) rendu avec l'image, à l'image près :
  le moteur audio sur un contexte hors ligne, la musique qui suit la tension comme en partie, le
  tout ramené vers −14 LUFS, ses crêtes vraies sous −2 dBTP (un limiteur qui anticipe, jamais
  d'écrêtage) ; l'AAC décodé reste à −1 dBFS ou sous. Un son placé à 0,5 s sort à 0,5 s.
- **La caméra garde l'action dans la zone sûre** des applications (hors des 15 % de droite, des
  22 % du bas, des 10 % du haut) : sur le Cœur de la faille, elle cadre l'étendue de l'action,
  du plancher aux rangées qui éclatent au-dessus, le plancher au-dessus de la légende (77,5 % de
  la hauteur) ; le haut du puits sort du cadre.
- **Les défis** : la question s'arrête sur la décision, A et B au-dessus du puits ; la réponse
  montre les deux puits côte à côte, chacun avec sa lettre, et le manifeste donne leurs comptes.
- **La semaine du 2 novembre** (`media/clips.ts`) : le feu sur l'huile (lundi), le défi du feu
  (mardi, réponse dimanche), l'éclair dans l'eau (jeudi), le Cœur de la faille (vendredi).
- Trois scènes de vitrine, chacune en trois graines avec son test de pic : le feu sur l'huile,
  l'éclair dans l'eau, le défi du feu (l'huile ou l'eau, de part et d'autre d'un mur de sable).

### Modifié

- La densité des canevas vient des services (`pixelRatio()`) : 2× dans le jeu, 3× sur le
  plateau des clips.
- Le moteur audio peut jouer hors ligne (`AudioEngine.offline`), la musique avancée à la main.

### Technique

- Le plateau de tournage, `media/showcase.html?clip` : une prise par chargement, la page sur
  son propre temps (`SetTime` : minuteries, images, `performance.now()`, animations CSS), le
  son de la prise (`TakeSound`). Deux passes aux mêmes entrées donnent les mêmes images ; Chrome
  y dessine sans carte graphique, qui composait la lueur du puits un peu différemment d'une
  prise à l'autre. La semaine 1 se rend en un peu plus de 3 minutes.
- `scripts/mp4-encoder.mjs` écrit une piste AAC (son décalage d'amorce mesuré en décodant, sa
  durée coupée à celle de l'image, ses crêtes décodées sur toutes les voies), zoome en composant
  et n'envoie qu'une fois une image répétée ; `scripts/loudness.mjs` mesure selon BS.1770
  (vérifié : un sinus de 997 Hz à −20 dBFS lit −20,0 LUFS) et sa crête vraie selon l'annexe 2
  (quatre fois suréchantillonnée : le même sinus à pleine échelle lit 0,01 dBTP).
- Les vidéos des portails (`yandex-media.mjs`, `crazygames-media.mjs`) ne changent pas : le
  plateau sans `?clip` reste à 2× et sur l'horloge réelle.

## [1.38.1] — 28/10/2026

La barre des jokers de la Mosaïque ne bouge plus : le plateau garde sa taille quand un joker
arrive.

### Corrigé

- **Le plateau rétrécissait quand des jokers arrivaient**, sur un téléphone en portrait
  (constaté en jeu) : les boutons des jokers passaient à la ligne et prenaient leur hauteur au
  plateau (de 312 à 256 px à 393 × 659). La barre montre désormais **cinq emplacements, un par
  joker**, toujours là : allumés avec le nombre détenu, en pointillé tant qu'ils ne sont pas
  gagnés. Sa taille ne dépend plus que de la largeur de l'écran : rien ne bouge, de 320 × 568 à
  1920 × 1080, avec 0 à 5 jokers.
- **Téléphone en paysage** (844 × 390) : les jokers ne sortent plus de l'écran.
- **Petits cadres en paysage à la souris** (821 × 462 sur CrazyGames) : les cinq emplacements
  tiennent sur une ligne, au-dessus des touches.

### Modifié

- Un emplacement en pointillé, touché ou survolé, dit comment gagner son joker (« Bombe :
  effacez 4 lignes d'un coup, ou atteignez le combo ×6 »), aussi pour les lecteurs d'écran ; la
  phrase « Effacez plusieurs lignes d'un coup pour gagner des jokers » disparaît.
- La Relance prend l'icône d'échange de la main des Dunes (⇄) : sa flèche ronde ressemblait trop
  à celle de la Rotation, maintenant que les noms ne sont plus écrits.
- En paysage, la barre s'aligne sous le tableau de bord.

## [1.38.0] — 28/10/2026

Niveaux générés (lot 20 du chemin vers 5) : la campagne passe de 34 à 69 niveaux. Les
chapitres 6 à 10 sont tirés par un générateur par famille, et le bot de courbe ne garde que les
niveaux qui tiennent leur bande ; chacun finit sur la revanche d'un Gardien, plus fort.

### Ajouté

- **Cinq chapitres** : Sables mouvants, Terre cuite, Le Regard, Battements, Au-delà de la
  Faille. Sept niveaux chacun : un calme après le Gardien, des épreuves, un pic, toutes les
  familles (la chute deux fois, le Sable, la Mosaïque, la Tour), un duel contre l'IA difficile,
  puis la revanche d'un Gardien. Sept modes de chute reviennent au fil des chapitres (la marée et
  la bascule dans les pics, la fusion dans le calme), le Classique avec le Cœur.
- **Les niveaux générés**, par chapitre (le chrono, puis l'objectif) :
  - 6, Sables mouvants : Sable, 5 liens en 3 min ; Mosaïque, 3 lignes d'un coup en 3 min 30 ;
    Marée, tenir 2 min 30 ; Tour, 4 anneaux en 2 min ; Renversement, 36 lignes en 3 min ;
    duel contre l'IA difficile ;
  - 7, Terre cuite : Mosaïque, 9 lignes en 2 min ; Rythme, 32 lignes en 2 min 30 ; Sable, 13 liens
    en 3 min ; Bascule, 24 lignes en 3 min ; Tour, 4 anneaux en 3 min ; duel ;
  - 8, Le Regard : Tour, 6 anneaux en 2 min 30 ; Bascule, 39 lignes en 4 min ; Sable, 8 liens en
    2 min 30 ; Mosaïque, 21 lignes en 3 min 30 ; Chroma, 48 lignes en 3 min 30 ; duel ;
  - 9, Battements : Fusion, 16 lignes en 3 min ; Tour, 10 anneaux en 3 min ; Mosaïque, 21 lignes
    en 2 min 30 ; Sable, 5 liens en 2 min ; Miroir, 66 lignes en 4 min ; duel ;
  - 10, Au-delà de la Faille : Mosaïque, 15 lignes en 2 min 30 ; Tour, 14 anneaux en 3 min ;
    Bascule, 33 lignes en 3 min ; Sable, 25 500 points en 3 min 30 ; Miroir, 26 lignes en
    3 min 30 ; duel.
- **Les revanches des Gardiens** : le Ver des dunes (6-7, 150 de vie, 3 min 30), le Golem de
  céramique (7-7, 150, 3 min), l'Œil de la Tour (8-7, 150, 3 min), le Cœur de la faille (9-7,
  150, 3 min 30), puis le Cœur à pleine force pour finir la campagne (10-7, 200 de vie, 4 min).
  Le défi des Gardiens de la semaine garde leur premier combat.
- La carte compte dix chapitres et 207 étoiles ; la démo annonce soixante-neuf niveaux.

### Corrigé

- La carte sur les plus petits téléphones : sur un 320 × 568, les sept niveaux d'un chapitre se
  couvraient (deux rangées trop proches pour leurs noms et leurs étoiles) ; les rangées
  s'écartent désormais autant qu'il le faut quand des niveaux voisins se toucheraient. Sur un
  écran bas (568 × 320), le Gardien prend la taille des autres niveaux, son anneau le
  distingue, et les étoiles rapetissent. Le chemin passe derrière les noms et les étoiles, que
  garde lisibles un halo de la couleur du fond.

### Technique

- `src/campaign/generator/` :
  - `ChapterPlan` : le plan des chapitres 6 à 10 (le rôle, la famille et les modes possibles de
    chaque niveau) et la fiche de rythme de chaque rôle ;
  - `LevelGenerators` : un générateur par sorte de niveau (puits de chute, Sable, Mosaïque,
    Tour, duel) dans un registre ; sur une graine, le mode, l'objectif, le chrono et les
    étoiles ; les objectifs partent des cadences d'un habitué mesurées par le bot aux
    améliorations du chapitre 6, selon la part que demande le rôle ; un objectif peut être
    réservé aux niveaux qui le demandent (les points du Sable, environ 8 000 par minute pour un
    habitué, au chapitre 10), sans changer les autres niveaux ;
  - `PackSearch` : le tamis ; chaque niveau doit tenir sa bande sur les six parties du test de
    courbe puis sur six autres ; des trois premiers qui y arrivent, il garde celui qui joue le
    plus près de sa fiche ; un niveau déjà jugé n'est pas rejoué, et aucun niveau généré ne
    ressemble à un autre (le même mode, le même objectif, une cible à un quart près et une durée
    à trente secondes près), hors les duels.
- `src/campaign/packs/` : les chapitres générés en données (`chapter-N.json`, lus et vérifiés
  par `parseLevelPack`), le rapport de la recherche à côté (`chapter-N.report.json` : les
  victoires de chaque joueur, l'intensité mesurée, les autres candidats, les refus et leurs
  raisons). `npm run generate:levels` les réécrit, à la main, dans l'ordre des chapitres.
- La vie d'un Gardien passe du niveau à sa partie (`bossHealth`, `LevelRun`) ; le Golem de
  céramique la reçoit aussi (`CeramicGolem`, `MosaicOptions`), et sa barre lit son maximum.
- La fiche `finale` couvre désormais les combats qu'un habitué ne gagne pas : les duels après le
  chapitre 5 (l'IA experte, tirée aussi, n'en laisse gagner à l'expert que trop peu), la revanche
  du Ver et celles du Cœur (l'expert en gagne au moins quatre sur six).
- Les améliorations d'un habitué suivent dix chapitres (`STARS_BY_CHAPTER`, cent étoiles pour
  tous les rangs, tous acquis au chapitre 9).
- Les niveaux d'IA vivent à part (`AiLevels`), assez légers pour les données de la campagne.
- `mapPath` : où se placent les niveaux de la carte, tirés de la taille mesurée du champ et du
  plus grand niveau (son disque, son nom, ses étoiles).
- Tests : un même tirage donne le même niveau, chaque niveau livré se retire de sa graine tel
  qu'il a été gardé, les paquets refusent des données cassées, le tamis garde le plus proche de
  sa fiche ; la courbe des chapitres 6 à 10 en CI ; en russe, les dix chapitres de la carte
  restent entiers et sans niveaux qui se couvrent, en 320 × 568, 568 × 320 et 390 × 844.

## [1.37.0] — 27/10/2026

Dunes, le test web (lot 19 du chemin vers 5) : un mode calme de la matière du Sable, où l'on
pose le sable depuis une main de trois pièces, prêt pour son test dans le bac à sable de
Playgama contre le Sable seul. Dunes ne vit que dans ses versions de test : le jeu complet ne
le montre nulle part tant que le test n'a pas décidé.

### Ajouté

- **Dunes** :
  - un plateau de 9 × 12 cases de 6 × 6 grains ; trois pièces en main, glissées sur le plateau
    (ou touchées puis posées d'un toucher, ou au clavier : 1 à 3, les flèches, Espace) ;
    posée, la pièce s'effrite en grains qui coulent et se tassent ; une couleur qui relie les
    deux murs s'efface, comme dans le Sable ; ni chrono ni pièce qui tombe : la partie s'arrête
    quand plus aucune pièce de la main ne rentre et qu'aucun échange ne reste ;
  - la promesse de la main : une des trois pièces au moins rentre toujours (vérifié sur
    10 000 mains) ; une main qui ne rentre plus nulle part avant qu'on y ait touché (le sable a
    bougé) est redonnée ;
  - un échange de la main au départ, un de plus à chaque objectif atteint, trois au plus (R au
    clavier) ;
  - une seule partie, un objectif à la fois (D-1, D-2…) : des zones à effacer, des points à
    marquer, le Ver des dunes à vaincre (D-5, D-10, puis tous les cinq niveaux) ; chaque niveau
    apporte un élément (l'eau, le feu, la foudre, l'huile, la glace, les graines, l'acide), que
    sa première main donne ; une quatrième couleur de sable arrive au D-6 ;
  - l'ouverture : un lit de trois bandes de sable ; la première pièce, posée sur la marque qui
    brille, relie les murs, puis le Ver des dunes jaillit du sable : dans les dix premières
    secondes ;
  - la chaîne compte les pièces posées, pas les secondes ; les grains, les réactions, les
    effets et les sons sont ceux du Sable ; le danger, la musique et la reprise récompensée
    (six rangées de sable s'envolent) suivent le plateau ;
  - l'élément de la semaine vient aussi dans les Dunes, et ses actions comptent pour son
    objectif.
- **Les versions de test** (un mode seul, pour comparer deux versions, sans trafic acheté) :
  `npm run package:playgama-dunes` et `npm run package:playgama-sand` font les deux zips de
  Playgama. Un nouveau joueur commence directement par une partie du mode (ni entraînement ni
  titre, dans les deux) ; le menu n'a que l'accueil et l'Atelier : ni défi du jour, ni
  Gardiens, ni course, ni carrousel des autres modes ; le slogan est le pitch du mode ; les
  objectifs ne demandent que ce qu'on peut y faire. `npm run dev:dunes` lance Dunes seul sur
  notre site.

### Corrigé

- La saison (1.36, jamais publiée) est relue au lancement sur Playgama, Yandex et CrazyGames :
  sa clé manquait à la liste des sauvegardes. Un test exige désormais que chaque clé
  enregistrée y soit.

### Technique

- La famille `dunes` : `DunesBoard` (les cases libres, les couleurs de la surface),
  `DunesPieces`, `DunesDealer` (la promesse, la couleur la plus proche d'un lien, la
  clémence), `DunesLevels`, `PlacementStreak`, `DunesGame` (les grains, les réactions et le
  Ver du Sable, composés sans pièce qui tombe), `DunesSession`, `DunesController`,
  `DunesStage` et son glisser-déposer ; le rendu, les effets et les sons du Sable servent sans
  changer de comportement (types élargis : `LandedPiece`, `SandEventSource`).
- `Edition` : `solo`, `soloEdition`, `offersDaily` ; un mode à l'essai (`prototype`) n'apparaît
  que dans la version qui le nomme ; `firstGameOf`, `hubPagesOf` ; les objectifs reçoivent leur
  lieu (`ObjectivePlace` : les modes ouverts, un défi du jour ou non).
- Tests : la promesse sur 10 000 mains, l'ouverture, la pose, l'échange, la fin et la reprise,
  le Ver ; un bot de courbe joue les Dunes (trois joueurs, six parties chacun) ; parcours de
  bout en bout de la version Dunes (au doigt, à la souris, au clavier), audits
  d'accessibilité, tailles clés, russe.

## [1.36.0] — 27/10/2026

Événements et saison 1 (lot 18 du chemin vers 5) : chaque semaine, un élément du Sable à
l'honneur et son objectif ; des saisons de six semaines et leur piste de paliers. Une
avant-saison s'ouvre dès cette version ; la saison 1, « Braises », ouvre le 14 décembre à
minuit UTC ; les saisons 2 (« Marées ») et 3 (« Orage ») sont prêtes, en données.

### Ajouté

- **L'élément de la semaine** :
  - chaque semaine (du lundi, minuit UTC : la même semaine sur tous les appareils), un élément
    du Sable revient plus souvent dans ses parties libres, dès le premier niveau (trois fois
    son poids, et les éléments un peu plus souvent) ; la campagne, les défis et la course n'en
    changent pas ;
  - son objectif compte ce qu'il fait dans toutes les parties du Sable : le feu brûle le
    sable, la foudre tombe, les graines poussent en lianes, l'acide ronge des grains ; l'eau,
    l'huile et la glace comptent les pièces versées (leurs réactions sont trop rares, ou
    réservées à qui vise). Atteint, +150 points de saison.
- **Les saisons** : les points viennent de l'expérience de chaque partie (objectifs compris)
  et de l'objectif de la semaine ; ils montent une piste de paliers (300 points chacun) :
  de l'expérience sur la plupart, une nouveauté sur trois, récupérées une à une ou toutes à
  la fois. Les paliers laissés à la fin d'une saison sont donnés à la visite suivante : rien
  n'est perdu.
- **L'avant-saison** (du 26 octobre au 13 décembre) : dix paliers d'expérience et les
  Étincelles de la faille. **La saison 1 « Braises »** (du 14 décembre au 24 janvier) : trente
  paliers, les Flammèches, l'ambiance Braises et le Verre de braise ; réunis, l'ensemble
  Braises donne le Verre du phénix.
- **Après une saison**, ses nouveautés passent en tête du cadeau du 7e jour (la saison la plus
  récente d'abord), et son ensemble reste à compléter dans l'Atelier.
- **Des nouveautés décrites en données** : les ambiances (leurs deux lueurs et leur défaite),
  les éclats (leurs couleurs, leur vol) et le verre de saison (un motif, braises, ondes ou
  éclair, allumé dans la couleur de la pièce). Les saisons 2 et 3 sont écrites ainsi : changer
  de saison est une sortie de données.
- **Sur l'accueil, l'événement de la semaine** : son élément, le temps restant, son objectif et
  sa barre, l'anneau du palier de la saison (un point d'or quand une récompense attend). Il
  ouvre **la page de la saison** : le palier et les points, l'événement, la piste (une liste
  sur un téléphone, un ruban sur un grand écran, ouverte sur le palier en cours), l'ensemble et
  sa couronne, la saison suivante et ses nouveautés ; Retour ou Échap la referment.
- La fin de partie dit ce qu'elle a rapporté à la saison : ses points, un palier atteint,
  l'objectif de la semaine.

### Modifié

- L'Atelier ne montre les nouveautés d'une saison qu'à partir de son début ; un ensemble de
  saison dit la couronne qu'il donne.
- L'accueil sur un écran bas : l'événement se resserre ; sur les plus bas (un téléphone en
  largeur), l'aide du clavier, les durées des défis et leurs pastilles s'effacent et Jouer
  perd son icône. Le cadeau et les objectifs tiennent sur une ligne : dans une colonne
  étroite, « Objectifs du jour » s'efface (les points et le compte restent, un lecteur d'écran
  lit tout).

### Technique

- `seasons/` : `SeasonData` (les saisons et leurs nouveautés, en données), `EventCalendar`
  (semaines et saisons en UTC), `SeasonTrack`, `WeeklyGoals`, `SeasonProgress` ;
  `SeasonService` ; l'objectif de la semaine est une sorte d'objectif (`element`).
- La session commune annonce les actions des éléments (`element`), le rapport de partie les
  compte ; les parties libres reçoivent l'élément de la semaine (`featuredElement`), que le
  Sable distribue (`DealRules.featured`).
- `SeasonGlassSprites`, la feuille des ambiances de saison générée depuis leurs données, leurs
  défaites et leurs éclats aussi ; `achievementsOf` dans son module (`Achievements`).
- Tests : le calendrier franchit chaque frontière de semaine et de saison dans cinq fuseaux ;
  les données, la piste, la progression, le service, l'ordre du cadeau ; un test de courbe
  mesure les objectifs de la semaine (8 à 20 minutes de Sable pour un habitué) ; parcours de
  bout en bout des saisons (Auckland et Los Angeles le 14 décembre), audits d'accessibilité,
  tailles clés, balayage de 320 à 2 560 px, russe.

## [1.35.0] — 27/10/2026

Cadeaux et collections (lot 17 du chemin vers 5) : une raison de revenir chaque jour. Un
calendrier de sept jours de cadeaux, des ensembles d'apparences qui débloquent quatre nouvelles
ambiances, la série du défi du jour enfin affichée avec ses paliers, et un cadeau de retour
après une semaine d'absence.

### Ajouté

- **Le cadeau du jour** :
  - sept jours de cadeaux : +50, +60, +70, +80, +90 et +100 XP, puis une apparence le
    septième jour, la première que le joueur n'a pas dans une liste qui part de loin dans les
    niveaux (Obsidienne, Cosmos, Pétales…), les prix des objectifs en dernier ; 250 XP quand il
    les a toutes. Jamais un trophée de Gardien, l'or de la série ou le prix d'un ensemble ;
  - un cadeau par jour local, jamais deux : ni après un rechargement, ni quand l'horloge recule
    (un vol vers l'ouest) ; un jour manqué met le cycle en pause, sans rien reprendre ;
  - le calendrier s'ouvre de lui-même à la première visite du menu de la journée, jamais
    avant la première partie d'un nouveau joueur (sur les portails, le premier cadeau vient à
    la fin de l'entraînement) ; ensuite, un point d'or sur l'onglet Accueil et un bouton cadeau
    à côté des objectifs du jour ;
  - sur Playgama et Yandex Games, l'expérience du jour doublée contre une pub récompensée, au
    choix du joueur et après la grâce des nouveaux joueurs ; jamais sur une apparence ;
  - après le cadeau, la semaine reste affichée jusqu'à la fermeture, le jour coché d'un
    tampon, avec le cadeau de demain ; un ensemble que le cadeau complète le dit (« L'ensemble
    Arcade est complet : l'ambiance Synthwave est à vous aussi ! ») ;
  - sur un téléphone, une feuille qui monte du bas, quatre jours par ligne ; sur un ordinateur,
    une fenêtre centrée, les sept jours sur une ligne, celui du cadeau plus large ; sur un
    téléphone tenu en largeur, les sept jours sur une ligne et les boutons à côté de la série :
    la fenêtre tient sans défiler, en russe aussi ;
  - de retour d'une partie, il attend que le menu soit monté (0,9 s) ; un joueur déjà occupé
    (un geste, une touche) n'est pas interrompu, ni une fenêtre qu'il vient d'ouvrir
    recouverte : le calendrier attend la visite suivante, son point d'or sur l'onglet.
- **Le retour** : un joueur qui a déjà joué et revient après sept jours sans visite reçoit
  +150 XP avec le cadeau du jour, et la grâce des pubs repart de zéro.
- **La série du défi du jour** : sa flamme et son compte sur la carte du défi ; +75, +150, +300
  et +600 XP à 3, 7, 14 et 30 jours d'affilée, de nouveau à chaque nouvelle série ; la fenêtre
  du cadeau dit le palier suivant, et qu'un jour manqué ne fait rien perdre.
- **Les ensembles de l'Atelier** : un quatrième rayon, « Ensembles », montre quatre ensembles
  de quatre apparences (Arcade, Jardin de nuit, Trésor, Trophées des Gardiens) et leur
  avancée, la scène portant l'ambiance promise ; un ensemble complet débloque son ambiance :
  Synthwave, Lanternes, Dorure ou Sanctuaire, chacune avec ses lueurs et sa défaite.

### Modifié

- Le rayon des ambiances (onze désormais) passe à quatre colonnes.
- La grâce des pubs compte le temps de jeu depuis le retour d'un joueur absent une semaine.

### Technique

- Règles pures : `DailyGifts` (cadeaux, ordre des apparences), `GiftCalendar` (cadeau prêt,
  ouverture, série en cours, semaine juste reçue), `Collections`, `STREAK_BONUSES` ;
  `Day.daysBetween`.
- `Profile` : `visit`, `markGiftShown`, `claimGift` ; ses données gagnent `gifts`, `gifted`,
  `lastVisit`, `welcomeBack` et `graceFromMs`, relues avec prudence ; une apparence offerte
  compte partout (`Achievements.gifted`).
- `GiftService`, sur l'horloge injectée (le jour lu à chaque appel) ; `DailyGiftDialog`.
- Tests : le cycle sur une horloge figée (minuit, fin de mois, fin d'année, horloge qui recule,
  rechargement, pause, retour, paliers, ensembles) ; parcours de bout en bout du calendrier et
  des ensembles ; audits d'accessibilité ; les autres parcours ferment le calendrier quand il
  se lève (`closeDailyGift`).

## [1.34.0] — 27/10/2026

Course contre la montre (lot 24 du chemin vers 5) : la Course de la faille, un mode
chronométré où la faille change de monde toutes les 40 s entre le puits, le Sable et la Tour,
chaque monde sur un plateau neuf ; seul le chrono termine la partie. Mesurée par le bot de
courbe : une partie de débutant dure 2 min 37 en moyenne, celle d'un habitué 3 min 38.

### Ajouté

- **La Course de la faille** :
  - le chrono part de 1:30 et tient 99 s au plus ; les secondes en trop deviennent des
    points (50 par seconde, fois le cycle). Une ligne (une région du Sable) +2 s, chaque
    palier de combo +1 s, quatre lignes d'un coup +5 s de plus, un coup sur un Gardien +1 s,
    un Gardien vaincu +15 s, **chaque monde atteint +10 s** (le point de contrôle des courses
    d'arcade : sans lui, un débutant ne tenait que 2 min, mesuré) ;
  - un débordement coûte 10 s, sans jamais laisser moins de 5 s, et la moitié haute du
    plateau saute : la partie continue ;
  - les changements se voient venir : les trois mondes, le monde suivant et son compte à
    rebours restent à l'écran avec la barre de la phase ; 3 s avant, la carte « La faille
    change de monde » nomme le monde suivant, sa règle, l'accélération et le Gardien qui
    entre, et les lignes comptent double ; un balayage d'une seconde, chrono figé, compte les
    cases restantes (5 points chacune, fois le cycle), puis le monde suivant s'ouvre ;
  - la gravité monte une fois par cycle, jamais juste après un Gardien vaincu ; le
    multiplicateur de score gagne +1 par cycle ;
  - les Gardiens, chacun dans son monde (le Cœur de la faille sous le puits, le Ver des dunes,
    l'Œil de la Tour) : sûr au deuxième changement, puis 25 % plus 25 % par changement sans
    Gardien ; il reste 25 s avec un tiers de sa vie, et sa carte dit son temps, sa vie et ce
    que valent ses coups ; vaincu, un plateau neuf du même monde ;
  - l'alarme des dix dernières secondes ; à 0:00, un dernier feu de 2 s compte le plateau ;
  - la fenêtre de fin montre le record personnel et celui de la semaine (du lundi) ;
  - le mode s'ouvre au niveau 4-4, quand la Tour a été jouée (4-3 gagné) : une bannière en
    tête de la page des modes, cadenassée jusque-là avec le niveau qui l'ouvre ; à côté du
    titre sur un écran court ; jamais dans la démo.
- Un test de courbe joue 24 courses (débutant, habitué, expert) : durées, changements à
  l'heure, mondes dans l'ordre, chrono dans ses bornes ; un parcours de bout en bout, les
  audits d'accessibilité et la garde responsive (de 320 à 2560 px, quatre tailles clés)
  couvrent la course.

### Modifié

- « 14 façons de briser un bloc » ; la démo annonce quatorze modes et trente-quatre niveaux
  (trente auparavant : les Gardiens étaient oubliés).
- Les objectifs du jour ne demandent qu'un mode que le joueur peut ouvrir.

### Corrigé

- La boucle du jeu demande l'image suivante avant de jouer celle-ci : une partie qui échoue
  (un rendu) est signalée dans la console sans figer le jeu.
- La Tour ne dessine pas de blocs de moins de 3 px (un rayon négatif arrêtait le rendu
  quand un plateau s'ouvrait avant sa mise en page).
- Le verre fendu suit le puits quand son canevas change (les mondes de la course).

### Technique

- `families/race` : `RaceClock`, `ShiftSchedule` et `guardianJoins` (règles, pures),
  `RaceSession`, une session de sessions (logique), `RaceStage` et ses parties (affichage) ;
  `RaceRun` (record de la semaine), `campaign/ModeUnlocks` (`modeOpen`).
- Un débordement peut ne pas finir la partie : `overflowFrees` des moteurs (chute et Sable),
  `overflowGoesOn` des sessions, l'événement `overflow` ; les effets y jouent l'éclat de la
  reprise, ni l'effondrement ni le son de la défaite.
- Les Gardiens prennent une vie réduite (`GuardianHealth(maxHealth)`, phases
  proportionnelles) et peuvent partir (`dismiss()`) ; les sessions disent ce qui reste sur le
  plateau (`remains()`), la famille du plateau joué (`boardFamily()`) et partent d'un niveau
  donné (`startLevel`).

## [1.33.0] — 26/10/2026

Accroche et courbe (lot 16 du chemin vers 5) : la première minute montre le meilleur du jeu
quel que soit le premier geste, et chaque niveau de la campagne est mesuré par des joueurs
simulés au lieu d'être deviné. La mesure a trouvé des murs (le Ver des dunes, que personne ne
battait ; la silhouette parfaite ; les quatre lignes d'un coup au cinquième niveau) et des
niveaux plats ; ils sont réglés, et un test échoue si l'un d'eux sort de sa bande.

### Ajouté

- **Le bot de courbe** (`CurveBot`, `CurveReport`) : un débutant, un habitué et un expert
  jouent chaque niveau six fois, avec les améliorations qu'un habitué a achetées à chaque
  chapitre ; le rapport compte le temps sous pression (la moitié du puits ou plus), le temps
  mort, les quasi-défaites (un danger critique survécu), le pic et la fin. Les joueurs : l'IA
  du duel (le débutant plus lent, une pièce sur vingt posée n'importe où), un joueur de Sable
  qui étend une couleur vers les deux murs et vise le Ver avec la foudre, un joueur de
  Mosaïque qui pare les pierres du Golem et presse un joker quand rien ne rentre.
- **Une fiche de rythme par niveau** (`BEAT_CHARTS`) : son idée, l'émotion visée, son rôle
  dans la dent de scie du chapitre et l'intensité de chaque tiers ; les bandes (`CurveBands`)
  qui la vérifient : victoires minimales par joueur selon le rôle, intensité à deux crans
  près, quasi-défaites et signaux de danger là où la fiche les demande, temps mort sous 20 %.
  `npm run test:curve` joue la campagne (3 min 30 sur quatre cœurs) ; la CI aussi.
- **La clémence du début de campagne** : près du haut du puits (dès 60 %), la menace ralentit :
  la chute et la marée jusqu'à 40 % de leur vitesse, les lignes reçues en duel, la chute et le
  Ver dans le Sable jusqu'à la moitié. Pleine au chapitre 1, des deux tiers au chapitre 2, d'un
  tiers au chapitre 3, absente ensuite ; jamais hors de la campagne. Un débutant frôle la
  défaite dès le 1-3 (une partie sur deux) sans la subir.

### Modifié

- **L'entraînement des portails tient en une partie** : le premier éclair tombe sur une nappe
  d'eau posée sur le lit de sable et brise toute la couche d'une couleur dessous, où qu'il
  tombe et même si le joueur attend ; l'embrasement et la liane suivent ; le Ver des dunes sort
  de lui-même vers 28 s, un éclair une pièce sur deux. Plus de fenêtre entre deux étapes dans
  la première minute ; l'objectif s'appelle « Entraînement ». Vérifié sur 1 000 parties.
- **Des niveaux réglés sur la mesure** :
  - 1-2 : la pratique des éléments commence sur un lit de sable, pour que le danger s'entende ;
  - 1-5 : effacer 2 lignes d'un coup (4 avant : aucun débutant n'y arrivait) ;
  - 2-7 : le Ver des dunes se combat avec la foudre, l'eau et le feu dès le début ; ses
    éruptions projettent le sable de la surface, et non plus des grains de toutes les couleurs
    qui empêchaient tout lien ; un lien qui le traverse le blesse de 7 (5 avant) ;
  - 3-4 : remplir 85 % de la silhouette (la remplir entière avant : 8 % de réussite pour le
    meilleur bot) ;
  - 4-6 contre l'IA moyenne (la forte avant), 5-6 contre la forte (l'experte avant,
    imbattable même pour l'expert simulé) ;
  - 5-1 : 15 lignes en 3 min (22 en 4 avant : près de 3 min de calme plat) ;
  - 5-5 : tenir 2 min 30 (3 min avant).
- L'IA de la Tour prend le chemin le plus court autour du cylindre ; dans la scène de l'Œil
  de l'écran titre, elle attend que l'Œil fixe la bombe.

### Technique

- `session/Mercy` (règle par famille et force par chapitre), lue par la chute, la marée, le
  duel, le Sable et le Ver ; `campaign/curve` (bot, mesure, joueurs par famille, bandes,
  améliorations d'un habitué) ; `BeatCharts`.
- L'objectif « remplir » (`fill`) remplace « compléter la silhouette » ; les sessions disent
  la part de la forme remplie (`filled()`), l'état suivi par l'objectif se lit au même endroit
  pour l'écran et le bot (`liveStateOf`).
- Vitest en deux projets : `unit` (`npm test`) et `curve` (`npm run test:curve`).

## [1.32.0] — 26/10/2026

Les commandes au doigt (lot 23 du chemin vers 5) : un module tactile maison pour le puits, le
Sable et la Tour, qui lit les coups comme les téléphones les lisent et ne fait plus tomber une
pièce par erreur ; jouer aux gestes, aux boutons ou aux deux ; un mode gaucher ; des vibrations
discrètes, coupées au départ ; un guide des gestes. Les réglages suivent la recherche du
26 octobre (les succès du genre et les avis de leurs joueurs) et une porte de traces
enregistrées.

### Ajouté

- **Le module tactile** (`PhoneGestures`), chargé seulement sur écran tactile (2,2 ko
  compressés) :
  - un coup se lit sur ses 100 dernières ms, par une courbe des moindres carrés comme sur
    Android et Flutter, à 30° de la verticale près : même après un déplacement de côté, le
    coup compte à sa propre vitesse ; un coup franc fait tomber la pièce sans attendre que le
    doigt se lève, un coup plus doux au lever ; le reste du contact est ignoré ;
  - la garde contre les chutes accidentelles : un coup ne fait tomber que la pièce présente au
    début du contact ; après une pose, le doigt se lève avant qu'une autre chute compte ;
  - un cran par case, avec une zone morte d'un tiers de case, remise à chaque retour en
    arrière : un doigt posé sur une limite ne fait plus trembler la pièce ; l'arc d'un coup ne
    déplace rien de côté ;
  - la descente seulement sur un glissé presque vertical, une case et demie après qu'il a
    tourné vers le bas : l'arc du pouce ne fait plus descendre la pièce ;
  - tourner selon le côté touché (la moitié droite dans le sens horaire, la gauche dans
    l'autre) ; un deuxième doigt tapé pendant un glissé tourne aussi, sans couper le glissé ;
    le toucher à deux doigts reste ; la Tour garde son tour à deux doigts ;
  - la réserve par un coup vers le haut (jamais depuis le bord bas de l'écran, qui est au
    téléphone) ou un toucher sur sa case ;
  - les navigateurs qui fusionnent les échantillons quand la page est occupée (Firefox sur
    Android, Safari avant iOS 18.2) : un saut se lit d'un bout à l'autre.
- **Les commandes tactiles**, leur fenêtre dans Réglages (comme le clavier a la sienne) :
  jouer aux gestes, aux boutons ou aux deux (les gestes déplacent et tournent, les boutons
  font tomber et mettent en réserve) ; la vitesse du glissé, de ×0,8 à ×1,6 ; tourner selon le
  côté touché ; le mode gaucher (l'écran en miroir : les boutons et la case Réserve changent
  de côté) ; les vibrations.
- **Des vibrations discrètes**, à la demande : 8 ms à chaque case, 18 ms à chaque rotation,
  jamais à moins de 50 ms d'écart ; un téléphone qui ne vibre pas dans un navigateur
  (l'iPhone) fait briller le bord du puits à la place.
- **Le guide des gestes** : un téléphone dessiné, chaque geste à sa place, numéroté comme la
  liste, selon les réglages du joueur ; depuis la pause et la fenêtre des commandes. Les deux
  moitiés de l'écran s'éclairent quand le guide d'une première partie demande de tourner.

### Modifié

- Les vibrations sont coupées au départ (on les demande dans les commandes tactiles).
- La souris ne joue plus les gestes sur ordinateur : le clavier joue, la souris sert aux menus
  et à la Mosaïque (un clic pour rendre la main au jeu ne tourne plus la pièce).
- Avec les boutons seuls, les gestes ne jouent plus (sauf le tour de la Tour à deux doigts).
- La pause liste les gestes réglés, avec le lien « Voir les gestes ».

### Technique

- Les règles (`GestureTuning`), la logique (`VelocityTracker`, `PhoneGestures`), le ressenti
  (`TouchFeel`) ; les trois scènes partagent `useTouchPlay` ; `WellGestures` disparaît.
- La porte des gestes (`tests/falling/gestureGate.test.ts`) : des traces de gestes humains
  (taps, glissés suivis d'un coup, arcs du pouce, doigt tremblant sur sa case, coups vers le
  haut, glissés en biais, taps tremblants), 1 000 par cas à 60 et 120 Hz, et sur une page qui
  charge une pub : la bonne commande 99 fois sur 100 au moins, aucune chute accidentelle en
  20 000 traces qui n'en sont pas. Limite mesurée : sur une page occupée, dans un navigateur
  qui fusionne les échantillons, un glissé suivi aussitôt d'un coup perd son dernier cran
  environ 2,5 fois sur 100 (la tâche avale la fin du glissé et le début du coup en un seul
  saut) ; jamais de chute accidentelle.
- Un test Playwright joue de vrais événements tactiles sur un téléphone.

## [1.31.0] — 26/10/2026

La preuve et les leviers de pub (lot 15 du chemin vers 5) : une seule politique de pubs, la
même sur chaque canal, plus douce pour les nouveaux joueurs et jamais après une défaite ; la
reprise d'une partie perdue contre une pub choisie, rare et utile ; un écran de défaite où le
verre du puits se brise sous la pulsation rouge, dans la matière de l'ambiance portée ;
l'essai d'une apparence verrouillée le temps d'une partie ; le kit de preuve. La reprise et la
fenêtre de fin suivent une recherche sur les succès du genre, plus de 20 000 avis de joueurs
et les règles des portails. La boutique attendra le contrat Yandex.

### Ajouté

- **La reprise d'une partie perdue**, contre une pub récompensée que le joueur choisit :
  - une fois par partie, au plus une fois toutes les dix minutes de jeu, après une partie
    d'au moins deux minutes et à partir de cinq minutes de vie du joueur (les portails
    interdisent l'offre à chaque défaite) ; ni en Duel, ni dans les défis ou l'entraînement,
    ni sur CrazyGames ;
  - la moitié haute du plateau saute (le puits, la Tour, le Sable ; les rangées les plus
    pleines de la Mosaïque, davantage tant qu'aucune pièce n'entre), la pièce bloquée revient
    la première, et rien ne tombe avant le premier geste du joueur ;
  - la fenêtre de fin offre « Regarder une pub » et « Non merci », égaux, avec un anneau de
    cinq secondes, à la place de l'expérience (rien ne bouge quand l'offre s'en va) ;
    « Rejouer » marche tout du long ; une pub qui échoue garde l'offre et le dit ;
  - une partie reprise compte pour les records, comme chez la plupart des succès.
- **L'écran de défaite** : des fêlures rouge vif partent de l'endroit où la dernière pièce a
  frappé et parcourent le verre du puits, les vitres proches éclatent et tombent en
  tournoyant ; la pulsation rouge du danger frappe, puis bat de plus en plus lentement et
  s'éteint en trois secondes ; la pile se brise dans la matière de l'ambiance (poussière
  d'étoiles, rubans de lumière, bulles, braises, vide, pétales, éclats d'or) qui dérive
  ensuite derrière la fenêtre ; le titre d'une défaite atterrit dans une lueur rouge ; un
  record à portée montre l'écart (« Si près : … ») ; puis le bouton principal bat. Effets
  réduits : le verre se fend sans tomber, un seul battement ; mouvement réduit respecté.
- **L'essai d'une apparence** : à l'Atelier, une matière ou une ambiance verrouillée se porte
  le temps d'une partie contre une pub récompensée (« ▶ PUB L'essayer une partie ») ;
  l'ambiance se voit tout de suite autour des menus.
- **Le kit de preuve** (`docs/PREUVE.md`) : la feuille de mesures par canal et par version,
  le protocole et la grille des dix sessions d'inconnus, la porte de la 1.31.

### Modifié

- **Une seule politique de pubs** (`AdPolicy`, règles pures, et `AdScheduler`), la même sur
  Playgama, Yandex et CrazyGames, avec une table de réglages par canal : un interstitiel
  seulement en quittant une partie gagnée ou finie au chrono, jamais après une défaite, ni en
  jeu, ni dans les huit premières minutes d'un nouveau joueur, ni dans les trois premières
  minutes d'une visite, avec trois minutes d'écart ; l'expérience doublée attend trois
  minutes de jeu ; toute pub regardée relance l'écart. CrazyGames garde ses règles : jamais
  sur un bouton de navigation, aucune pub récompensée tant qu'il n'existe pas d'autre moyen
  de gagner la récompense.
- Le profil compte le temps de jeu cumulé (`playedMs`).
- Le cahier : les lots 23 (commandes au doigt, 1.32) et 24 (course contre la montre, 1.33)
  détaillés, l'ordre de sortie décidé (lots 16 à 20 décalés de deux versions).

### Corrigé

- **Playgama avec un bloqueur de pubs** : le jeu demande une fois au Bridge si les pubs sont
  bloquées (`checkAdBlock`) ; si oui, il ne propose aucun bouton de pub (expérience doublée,
  reprise, essai) et n'en demande aucune. Avant, le Bridge restait « en chargement » pour de
  bon : les boutons étaient offerts et échouaient après une attente.

### Technique

- Moteurs : `revivable` et `revive()` dans la Chute, la Tour, le Sable et la Mosaïque ;
  `ContinueRule`, `wellShatter` (géométrie pure du bris), `WellShatter`, `DefeatMatter` et
  `DEFEAT_STYLES` (registre par ambiance), `WornLook`.
- Tests unitaires de la politique, de la reprise dans `GameRun` et dans les moteurs, du bris
  et de l'essai ; bout en bout sur le build Yandex (SDK factice, horloge simulée) : la
  reprise prise, laissée filer, et l'essai d'une ambiance.

## [1.30.1] — 26/10/2026

### Modifié

- **Les langues voisines du russe ne mènent au russe que sur Yandex Games.** Ailleurs
  (Playgama, CrazyGames, notre site), un joueur qui lit le biélorusse, le kazakh, l'ukrainien
  ou l'ouzbek, et aucune des quatre langues du jeu, lit l'anglais : la langue de repli que la
  liste de contrôle de Playgama exige, et la plus neutre sur un portail ouvert au monde. Sur
  Yandex, rien ne change, comme Yandex le fait lui-même. Chaque plateforme le dit
  (`Platform.russianForNeighbours`).
- Tests : la règle des deux côtés ; un navigateur en ukrainien ouvre notre site en anglais.

## [1.30.0] — 26/10/2026

La version Yandex Games : un build de plus, pour la plateforme de jeux de Yandex, en russe,
anglais, français et indonésien, avec les visuels de sa fiche. Les autres builds ne changent
pas, sauf la langue d'un joueur qui lit une langue voisine du russe, l'objectif d'un niveau
en portrait et la pulsation rouge du danger, qui battait à tort dans les parties calmes.

### Ajouté

- **Le build Yandex Games** (`npm run package:yandex`, zip dans `release/`), branché sur le
  SDK v2 que Yandex sert à `/sdk.js` :
  - **Chargement et repères de jeu** : `YaGames.init()` avant tout ; `LoadingAPI.ready()`
    une fois, quand l'étape 1 de l'entraînement est jouable ; `GameplayAPI.start()` et
    `stop()` seulement ensuite, et seulement quand l'état change.
  - **Les pauses de Yandex** (onglet quitté, pub de la plateforme) mettent le jeu en pause,
    coupent le son et comptent comme un arrêt de jeu ; au retour, le jeu attend le joueur
    sur sa fenêtre de pause.
  - **Sauvegarde dans les données du joueur**, connecté ou non : lue en une requête au
    lancement, écrite entière, une requête toutes les 4 s au plus (Yandex en accepte 100 par
    5 minutes), envoyée aussitôt à la pause ou quand la page se cache ; un envoi refusé est
    retenté une fois, jamais en boucle. Sans Yandex, le navigateur prend le relais.
  - **Pubs** : plein écran en quittant la fin d'une partie, jamais juste après une
    récompensée ; la récompensée double l'expérience, seulement si Yandex confirme le
    visionnage. Une pub qui ne s'ouvre pas en 12 s est abandonnée ; une erreur retire l'offre
    pour la visite (Yandex ne signale pas les bloqueurs de pub). Pas de bannière collante.
  - **Langue** : celle que donne Yandex, devant la langue enregistrée.
  - **Règles de la page** : ni numéro de version, ni lien de partage, ni menu contextuel ni
    sélection dans tout le cadre, ni défilement ou rechargement par glissement ; sur un écran
    de bureau plus large que 2:1, le cadre de jeu s'arrête à 2:1, centré.
  - **Le script de paquet vérifie les règles mesurables** (taille, noms de fichiers, chemins
    relatifs, SDK dans `<head>`, aucune requête externe ni SDK d'un autre portail) et zippe
    avec des chemins « / ».
  - Revue modérateur, fiche en quatre langues et étapes de publication :
    [docs/YANDEX.md](docs/YANDEX.md).
- **Les visuels de la fiche Yandex** (`node scripts/yandex-media.mjs`, dans
  `release/yandex-media/`) : l'icône 512 × 512 (l'Œil au-dessus de sa tour, sans texte), la
  couverture 800 × 470, quatre captures de vraies parties dans chacune des quatre langues
  (deux sur ordinateur, deux sur téléphone) et deux vidéos de 25,5 s, en 16:9 et en 9:16.
  Les vidéos sont tirées image par image des scènes du jeu, puis encodées en H.264 par Chrome
  lui-même (WebCodecs) dans un MP4 que le script assemble : ni ffmpeg, ni téléchargement.
- Tests : l'adaptateur Yandex face à un faux SDK (initialisation, repères, pauses, rythme des
  sauvegardes, pubs et délais) ; quatre parcours Playwright sur le build Yandex (projet
  `yandex`) ; en russe, à 320 et 360 px, l'objectif de quatre niveaux à réserve garde toute
  sa largeur.

### Modifié

- **Les langues voisines mènent au russe**, sur tous les builds : un joueur dont le
  navigateur demande le biélorusse, le kazakh, l'ukrainien ou l'ouzbek, et aucune des quatre
  langues du jeu, lit le russe plutôt que l'anglais.
- Une plateforme dit si une pause automatique compte comme un arrêt de jeu
  (`stopsOnAutoPause` : oui sur Yandex, non sur CrazyGames et Playgama) et si le jeu montre
  sa version (`showsVersion`). Les clés sauvegardées par les portails sont partagées
  (`SAVED_KEYS`).
- Les visuels CrazyGames et Yandex enregistrent les scènes du jeu par le même module
  (`scripts/showcase-frames.mjs`), qui attend la vraie interface de la vitrine et non la
  balise qui porte son nom.

### Corrigé

- **La pulsation rouge du danger ne bat plus qu'en danger.** Avec tous les effets (le
  réglage par défaut), la vignette serrée battait dès le premier niveau et à chaque partie,
  le puits vide : son battement remplaçait l'intensité du danger au lieu de la moduler (de
  0,75 à 0 quand tout était calme). Il bat maintenant sur une couche intérieure, de 75 à
  100 % de ce que montre le danger, et seulement quand le danger la montre. Les captures
  Yandex, prises avec ce défaut, sont refaites ; un parcours le vérifie avec tous les
  effets.
- **En portrait, l'objectif d'un niveau n'est plus écrasé à côté de la réserve** : dans la
  famille des chutes, la Tour et le Duel, il se glissait entre la réserve et les suivantes,
  de 30 à 120 px de large sur un téléphone (au 2-2, son niveau sur trois lignes et sa phrase
  coupée). Il prend maintenant toute la largeur de la bande, sous elles, comme dans la
  Mosaïque. Dès 390 px, le niveau, l'objectif et le compte y tiennent sur une ligne, la
  jauge dessous : le puits y perd au plus 6 % de sa taille (7 % pour la Tour) au lieu de 9
  et 10 %. Aucun objectif coupé, dans les quatre langues, de 320 à 430 px.

## [1.29.0] — 23/10/2026

L'entraînement des portails : sur CrazyGames et Playgama, un nouveau joueur arrive
directement dans le jeu, sans écran-titre ni menu. Notre site et la démo ne changent pas.

### Ajouté

- **Un entraînement en deux étapes, sur les portails seulement**, indépendant de la
  campagne. Au premier lancement, le joueur arrive dans un puits déjà rempli de couches de
  sable ; les menus restent cachés jusqu'à la fin.
  - **Étape 1, le sable vivant** : les pièces arrivent par paires qui réagissent, l'eau puis
    l'éclair (électrocution), l'huile puis le feu (embrasement), la graine puis l'eau
    (liane). But : relier 2 zones. Un débutant simulé, qui lâche chaque pièce là où elle
    apparaît, voit les trois réactions en moins de 20 s.
  - **Étape 2, la première rencontre** : le Ver des dunes nage sous le sable, fissure la
    surface et surgit ; des éclairs arrivent jusqu'à ce qu'un coup le touche. Il replonge,
    et la fenêtre de fin donne rendez-vous au niveau 2-7.
  - **Un guide dans le tableau de bord** : à chaque pièce et à chaque mouvement du Ver, une
    phrase dit quoi faire, avec les touches du joueur ou le geste au doigt. Il prend la place
    des compteurs (qui répétaient l'objectif), jamais sur le puits : rien ne cache la pièce
    ni le Ver. Il garde la hauteur de sa plus longue phrase, pour que le puits ne bouge pas
    quand il parle. Une croix le masque.
  - **Ni défaite ni chrono** : si le sable monte trop, le fond du puits se vide. Ni pub, ni
    étoiles, ni record ; l'expérience gagnée compte. Et donc **aucune alarme** : ni
    vignette rouge qui bat, ni fissures, ni battements de cœur, ni pièce en rouge. Le puits
    préparé laissait peu de place : un joueur qui lâchait ses pièces voyait le danger dès
    15 à 28 s, et pendant 30 à 70 % de l'étape.
  - **La pause propose « Reprendre » et « Passer l'entraînement »**, sans autre menu.
  - **À la fin**, « Niveau 1-1 » en premier, « Menu » en second. Le jeu retient que
    l'entraînement est fait ou passé ; un joueur qui a déjà joué une partie ne le voit pas.
- **Le premier affichage reste rapide** : le Sable se précharge derrière l'écran de
  chargement, et `gameplayStart` part dès l'étape 1 (l'outil QA de CrazyGames mesure le
  chargement jusque-là). Sur Playgama, `game_ready` passe toujours avant `level_started`,
  même quand la partie commence aussitôt.

### Modifié

- **La carte d'objectif** (campagne et entraînement) met le niveau et le compte sur la
  première ligne, et l'objectif sur toute la largeur : « Repoussez le Ver » était coupé sur
  téléphone.
- L'indication du geste (le doigt qui glisse, touche ou tombe) devient un composant partagé
  par le guide de la première partie du site et celui de l'entraînement.

### Corrigé

- **Le rouge du danger ne se fige plus entre deux parties.** Pendant une pause en danger,
  et sur la fenêtre de victoire du 1-1 (le Ver se montre, le monde bouge encore), la
  vignette rouge battait toujours, avec les battements de cœur et le tempo pressé,
  jusqu'à la partie suivante : l'écran ne se calmait qu'à l'image suivante, et l'horloge
  s'arrêtait avant. La pause calme tout à l'instant (le danger revient avec la partie, sans
  fausse délivrance), et une partie décidée n'a plus de danger. Après une défaite, le puits
  brisé reste, immobile : il ne bat plus.
- **Plus d'erreur de vibration dans la console** : l'entraînement démarre sans clic, et le
  navigateur refusait (en le signalant) les vibrations demandées avant le premier geste du
  joueur. Elles attendent désormais ce premier geste.

## [1.28.1] — 23/10/2026

Corrections après un essai sur téléphone (Samsung S25+).

### Corrigé

- **Le puits ne vire plus au rouge sans raison** : la vapeur refroidie en haut du puits
  retombe en pluie, et ces gouttes encore en l'air comptaient comme le haut du tas. Pendant
  une seconde, le danger montait à 100 % alors que le tas était bas : vignette rouge qui
  bat, fissures, battements de cœur, musique pressée. Le spectacle du 1-1 y menait à chaque
  partie, vers la quarantième seconde. La pluie encore en l'air ne compte plus ; elle
  redevient de l'eau en touchant le tas.
- **La pluie ne termine plus une partie** : une pièce se posait sur les gouttes, en l'air,
  et s'émiettait là où la suivante doit entrer. Sur 12 parties simulées du 1-1, deux
  finissaient ainsi à 14 s, puits presque vide. Les pièces, les éclairs et le Ver
  traversent maintenant la pluie comme la vapeur.
- **La promesse du 1-1 s'affiche** : « Le Ver des dunes s'éveille : il vous attend au
  niveau 2-7 » restait vide dans la fenêtre de fin, comme l'aide « Espace pour jouer » de
  l'accueil sur ordinateur. Le composant `<i18n-t>` n'était pas installé (build allégé) ;
  il est importé là où il sert, et un test le vérifie pour chaque composant.
- **Le bonus « +30 XP » du défi des Gardiens n'est plus coupé** en haut de l'accueil sur
  téléphone : l'étiquette dépassait de sa carte, et la page la rognait. Le test responsive
  la vérifie à chaque taille clé.

### Modifié

- **La pluie tombe goutte à goutte** : un nuage né d'un coup (le feu sur l'eau) se
  dissipait d'un coup, et sa pluie tombait en une seule ligne horizontale, comme un défaut
  d'affichage. Chaque grain de vapeur refroidit désormais à son heure : le nuage
  s'éclaircit et la pluie s'égrène sur une demi-seconde environ.
- **Le Ver des dunes se montre vraiment à la fin du 1-1** : il arrivait sous le sable et
  la fenêtre le couvrait au bout de 2,6 s. Désormais, il nage jusqu'au milieu du puits,
  fissure le sable, surgit en rugissant (tête et cou hors du sable, secousse), regarde,
  puis replonge. La fenêtre attend la fin de sa plongée, environ 4 s. Il reste hors
  d'atteinte et le sable qu'il projette ne rapporte rien : le combat, lui, reste au 2-7.

## [1.28.0] — 23/10/2026

Les familles à part : la fin du plan d'architecture de l'audit du 22/10. Rien ne change à
l'écran, sauf un son de la Mosaïque qui ne joue plus pendant la pause.

### Modifié

- **Chaque famille déclare sa présentation** (`src/ui/presentation.ts`) : disposition, aide
  tactile, guide de la première partie, annonce d'un effacement. L'écran de jeu ne teste
  plus la famille ; le duel garde sa disposition à deux puits.
- **Les Gardiens à part** : les sons et vibrations du Cœur de la faille et de l'Œil de la
  Tour quittent les scènes (`HeartSounds`, `EyeSounds`), une table par événement au lieu
  d'un `switch`. La rotation à deux doigts de la Tour devient une classe testée
  (`TowerTurn`).
- **Le Sable découpé** : `SandGame` (1 029 lignes) confie les pièces à `SandDealer`, le vent
  à `SandWind` et les grains montrés par les effets à `GrainSampler` (890 lignes). Les
  tirages gardent leur ordre : une graine distribue toujours les mêmes pièces (défis du
  jour et des Gardiens). Le combat du Ver des dunes reste dans la partie : trop lié à la
  physique pour ce lot.
- **Les réglages par intentions** : `SettingsService` n'offre plus de mise à jour libre
  mais des méthodes (`chooseLocale`, `setVolume`, `toggleMute`, `bindKeys`, `setRepeat`…)
  qui gardent chaque valeur valide : volumes de 0 à 1, répétition des touches dans ses
  plages, touches relues.
- **L'état protégé** : thème affiché en lecture seule, profil sans accès à son modèle
  (`isUnlocked`), plateau en lecture seule pour l'IA et les vues (`ReadonlyBoard`), vent du
  sable et chute animée des pièces lâchées derrière des méthodes.
- Nouveaux tests : sons des Gardiens et de la Mosaïque, rotation de la Tour, distributeur
  et vent du Sable (le vent se retient quand le sable approche du haut), réglages toujours
  valides. Cinq tests lisaient la file privée des pièces : ils passent par l'aperçu public.

### Corrigé

- **Les sons de la Mosaïque suivent le temps du jeu** (`GameTimers`), comme ses effets : une
  pause juste après une ligne laissait le bruit de la casse jouer dans le menu de pause,
  tuiles figées. Il attend désormais la reprise.

## [1.27.0] — 22/10/2026

La partie hors de l'écran : l'architecture suit les règles de séparation (règles, logique,
interface), sans rien changer à l'écran.

### Modifié

- **Le déroulé d'une partie quitte l'écran de jeu** (`src/run/`) :
  - `RunKind` : une stratégie par sorte de partie (libre, défi du jour, défi des Gardiens,
    niveau de campagne) garde ce qui change avec elle : le record compté, la partie mise en
    place, la course au record, le décompte du résultat, ce qu'entend la progression ;
  - `GameRun` : la partie à l'écran, du chargement à la fin (phases, valeurs du HUD, record
    poursuivi, objectif d'un niveau, pause et portail, publicités de fin) ; elle publie ce
    qui change, l'écran le dessine ;
  - `GameEnding` : la fin réglée (record, expérience, étoiles et niveau suivant, célébrations
    du portail), par des portes étroites.
- Le score du défi des Gardiens n'est plus calculé deux fois : celui de `GuardianChallenge`,
  testé, est celui qui compte.
- Les règles restées dans l'interface rejoignent leur domaine : la durée d'un niveau
  (sablier compris, une seule fois pour le jeu et la fiche du niveau), les améliorations
  utiles à un mode, la partie suivante de Jouer, la fin du défi du jour et les comptes à
  rebours, le bonus quotidien du défi des Gardiens.
- Des registres plutôt que des `switch` : règles et textes des étoiles, niveaux d'effets,
  portée des améliorations.

## [1.26.1] — 22/10/2026

Lighthouse mobile stable à **100** : il variait de 98 à 100 d'un passage à l'autre.

### Corrigé

- **Le code attend que le navigateur signale le premier affichage** de l'écran-titre, et non
  plus une image : demandé une image plus tard, il arrivait parfois avant ce signal et comptait
  comme nécessaire à l'affichage (FCP simulé de 1,1 à 1,6 s, LCP de 1,2 à 2,1 s). Désormais
  FCP 1,1 s, LCP 1,2 à 1,4 s, TBT 20 ms à chaque passage. Un onglet en arrière-plan démarre
  aussitôt ; un navigateur sans mesure de l'affichage attend une image ; un signal qui ne
  vient pas, une seconde.

## [1.26.0] — 22/10/2026

Le responsive de bout en bout, après l'audit du 22/10 (directive mise à jour) : chaque taille
vérifiée, du petit téléphone au 2560 px et aux zooms 200 % et 400 %.

### Corrigé

- **Mosaïque en paysage** : la légende des touches (premières parties, au clavier) ouvrait une
  colonne de trop, au détriment du plateau ; elle a sa place sous les jokers. Plateau de
  330 px au lieu de 232 en 821 × 462 (la plus petite fenêtre de CrazyGames), et de toute la
  hauteur au lieu de 64 px au zoom 200 %.
- **Barre du haut à 320 px** : le bouton Réglages débordait de 11 px. Sur une barre étroite,
  les étoiles gardent leur nombre sans le total ; au zoom 400 %, le niveau se lit sur son
  anneau.
- **Zooms 200 % et 400 %** : le bouton Jouer et les objectifs du jour ne sont plus coupés. Au
  zoom 400 % (320 × 256), l'accueil et les modes défilent en une colonne, sans mot coupé, et
  le jeu garde un puits visible.
- **Duel sur petit téléphone** : ses cinq compteurs dépassaient des deux côtés de l'écran ; ils
  tiennent sur deux ou trois lignes, et le nom de l'IA dans sa colonne.

### Modifié

- **HUD lisible** : libellés de 14 px au moins (9 à 10 px avant), chiffres de 16 px. Dans un
  mode chargé (trois compteurs ou plus), chaque compteur tient sur une ligne, libellé puis
  nombre. En portrait, les pièces suivantes se passent d'étiquette (leur zone garde son nom
  pour les lecteurs d'écran).
- **Grands écrans** : le HUD grandit avec l'écran (×1,17 en 1080p, ×1,4 en 1440p, ×1,5 au
  plus).
- En paysage court, la légende des touches garde l'essentiel : tourner dans l'autre sens et
  la surcharge (qui a son bouton) restent dans la fenêtre des touches.
- Cibles tactiles de 44 px dans les réglages (choix segmentés) et sur les tuiles de mode du
  plus petit téléphone.
- Compteurs du Duel aux libellés plus courts : « En approche », « Envoyées », « Lignes IA ».
- **Écrans tactiles** : 60 images par seconde au plus (un téléphone à 120 Hz dessinait deux
  fois plus pour le même jeu, et chauffait), pour le jeu comme pour le carrousel de
  l'accueil ; la boucle s'arrête en pause et sous la fenêtre de fin de partie.
- Points de rupture en `rem` (ils suivent la taille de police choisie), styles mobile-first,
  zones sûres avec valeur de repli et `max()` (plus de place sur les téléphones à encoche) ;
  le débordement horizontal n'est plus masqué (`overflow-x: hidden` retiré de `body`).
- Container queries pour les composants qui dépendent de leur place : compteurs du HUD,
  barre du haut, bouton Jouer, tuiles de mode.

### Ajouté

- `e2e/responsive.spec.ts` : aucun défilement horizontal de 320 à 2560 px, tous les 20 px, au
  menu et dans chaque famille (éléments fautifs nommés, contrôles coupés par le bord
  détectés) ; quatre tailles clés (320 × 568 et 844 × 390 au toucher, zooms 200 % et 400 %) :
  cibles tactiles, textes du HUD, part du puits, accueil à 400 % ; l'option boutons à part.
  Il remplace l'ancien balayage de 320 à 1920 px.

## [1.25.0] — 22/10/2026

Lot C, cinquième point : la surcharge de la faille, pour sauver une partie.

### Ajouté

- **Surcharge de la faille** (Chute, Sable et Tour ; pas en Rythme ni en Duel) : chaque
  ligne effacée remplit une jauge (12 lignes ; 4 zones dans le Sable). Pleine, elle s'allume
  à côté de la réserve et l'annonce ; le joueur choisit son moment (touche V, réglable, ou un
  toucher sur le sablier).
  - Pendant huit secondes, le temps du jeu passe au **tiers** de sa vitesse (la chute, le
    verrouillage, le chrono), mais pas les commandes du joueur : la répétition des
    déplacements garde son rythme réel. Le puits baigne d'une lumière froide traversée
    d'anneaux lents, la musique s'étouffe.
  - **Bonus de sortie** : les points marqués pendant la surcharge sont multipliés par 1 + 0,25
    par ligne effacée (0,5 par zone dans le Sable), jusqu'à ×3 ; une onde de choc traverse le
    puits et le son monte avec le facteur.
- La touche de la surcharge apparaît dans la légende, dans la fenêtre des touches, et dans
  l'annonce « Surcharge prête ».

### Corrigé

- Les sons d'impact et de brisure de la Chute et de la Tour suivent le temps du jeu, et non
  plus l'horloge du navigateur : ils restent calés sur l'image pendant la surcharge, les
  ralentis et la pause.

### Modifié

- Une seule règle dit quels modes ont la surcharge (le jeu, sa jauge et la légende des
  touches la lisent), et la surcharge calcule elle-même son bonus de sortie : l'interface ne
  fait plus que le remettre à la partie.

## [1.24.0] — 22/10/2026

Le russe, quatrième langue, prêt pour les portails russophones ; les trois autres langues
relues.

### Ajouté

- **Le jeu en russe** : toutes les phrases, en « вы », avec un glossaire constant (Песок,
  Мозаика, Башня, Разлом, Стражи…). Un navigateur réglé en russe l'obtient d'emblée, et on
  le choisit dans les réglages. Le portail d'intégration (Yandex Games, VK Play) reste une
  étape à part.
- **Les pluriels du russe** (1 звезда, 3 звезды, 5 звёзд) et du français (0 et 1 au
  singulier : « 0 étoile disponible »), testés.
- **Polices cyrilliques** : Unbounded pour les titres, Montserrat sous le nom de Sora pour le
  texte, téléchargées seulement quand du russe s'affiche.
- **Tests** : mêmes paramètres dans chaque langue, pluriels russes complets, typographie
  française, anglaise et russe ; un parcours de bout en bout en russe de 320 px au bureau
  vérifie que rien ne sort de l'écran ni n'est coupé.

### Modifié

- **Traductions relues** (anglais, français, indonésien) : tournures plus naturelles,
  « Refund all », « Survive », « Urungkan », « kamu » partout en indonésien, espaces
  insécables et apostrophes typographiques en français, « 15% » sans espace en anglais et
  en indonésien.
- **« COMBO ×3 » se traduit** dans le puits (КОМБО, KOMBO) ; « RIFT! » reste le mot du jeu
  dans toutes les langues.
- **Les notes de l'Atelier tiennent sur deux lignes** au lieu d'être coupées ; un look de
  Gardien affiche le nom du Gardien, et une carte trop basse (petit paysage) atténue son nom
  au lieu de le cacher sous le cadenas.
- **Le tableau de bord tient à 320 px** : écart fluide, colonnes jamais plus étroites que
  leur plus long mot ; à 320 px la pastille du joueur ne garde que son anneau de niveau.
- Le bouton Jouer et le nom de l'adversaire du Duel se règlent sur la place disponible ;
  le nom d'un mode se coupe plutôt que de déborder.
- Le module de chaque langue est reconnu au build par son titre de page, quelle que soit son
  écriture.

### Corrigé

- **L'accueil d'un téléphone en paysage** (640 × 360) : les objectifs du jour sortaient de
  l'écran et la pastille du défi des Gardiens couvrait son titre. Rangées plus serrées,
  cartes sans icône, objectifs réduits à leurs points et à leur compte (lus en entier par un
  lecteur d'écran), pastille épinglée au bas de la carte ; le nom d'un Gardien passe sur
  deux lignes plutôt que d'être coupé.
- « Vaincre le Œil de la Tour » : chaque Gardien a sa phrase entière par langue.
- Les objectifs s'accordent à ce qu'ils comptent (« 3 minutes », « 3 lignes d'un coup »).
- « +1 jokers » et « 1 cases » ont leur singulier.
- Le chapitre 5 s'appelle « La Faille » en français, comme son Gardien et son ambiance.

### Retiré

- Treize textes que plus aucun écran n'affichait.

## [1.23.0] — 22/10/2026

Lot C, quatrième point : le défi des Gardiens, pour revenir chaque jour.

### Ajouté

- **Défi des Gardiens** : chaque semaine (du lundi au lundi), un Gardien de la faille à
  affronter directement depuis l'accueil, **ouvert à tous** quelle que soit la campagne : le
  Ver des dunes, le Golem de céramique, l'Œil de la Tour puis le Cœur de la faille, à tour de
  rôle. Le combat est celui de son niveau de campagne (même mode, 4 minutes), sans
  améliorations, avec les mêmes pièces pour tout le monde toute la semaine.
  - **Score à battre** : les points de la partie, multipliés en cas de victoire par 1 + la
    part du temps restant (un Gardien abattu avec 40 % du temps : ×1,4). La fin de partie
    montre le score du défi, le détail de la victoire et le **record de la semaine**.
  - **Premier essai du jour** : +30 XP, chaque jour de la semaine ; une pastille dorée le
    rappelle sur la carte.
  - Les récompenses des Gardiens restent celles de la campagne. Le résultat se partage.

### Modifié

- L'accueil montre les deux défis côte à côte (le défi du jour et celui des Gardiens), chacun
  sur trois lignes : ce que c'est, ce qui se joue, le temps qui reste.

## [1.22.0] — 22/10/2026

Lot C, troisième point : des commandes réglables, pour les joueurs exigeants.

### Ajouté

- **Touches réglables** (Réglages, « Clavier », ou le lien sous les touches de la pause) :
  deux touches pour chaque action de la Chute, du Sable et de la Tour (déplacer, descendre,
  tourner dans les deux sens, chute instantanée, réserve, renversement, tourner la tour,
  pause).
  - On choisit une case puis on appuie sur la nouvelle touche ; une touche déjà prise ailleurs
    échange sa place, Suppr vide la case, Échap abandonne.
  - Les touches que gardent le navigateur et les portails (Échap, Tab, Ctrl, Alt, touches
    système et de fonction) sont refusées, avec la raison.
  - Une action restée sans touche est signalée en rouge ; « Rétablir par défaut » remet tout
    comme avant.
  - La Mosaïque garde ses touches.
- **Répétition des déplacements réglable** : délai avant répétition (DAS, 50 à 300 ms) et
  intervalle (ARR, 0 à 100 ms ; 0 envoie la pièce droit au mur, et l'y ramène après une
  rotation tant que la touche est tenue). Dans la Tour, sans mur, la répétition la plus
  rapide reste d'une colonne par image. Elle vaut aussi pour les boutons tactiles.

### Modifié

- La légende des touches (à côté du jeu, dans la pause) et le guide de la première partie
  montrent les touches du joueur.
- La touche de pause reprend aussi la partie depuis la fenêtre de pause, quelle qu'elle soit.

## [1.21.0] — 22/10/2026

Lot C, deuxième point : des gestes qui jouent la musique.

### Ajouté

- **Les gestes jouent avec la musique** : chaque son du joueur prend ses notes dans l'accord
  qui sonne (ré mineur, si♭, fa, do), au lieu de notes fixes de la gamme. Aucun son n'attend le
  temps pour partir : la réponse reste immédiate ; un geste qui tombe sur le temps sonne plus
  fort.
  - **Rotations** : chacune joue la note suivante de l'accord, en montant puis en redescendant
    sur une octave et demie. Tourner les pièces dessine une mélodie au-dessus de la musique ;
    elle continue d'une pièce à l'autre et passe à la note la plus proche quand l'accord change.
  - **Pièces posées** (Chute, Tour, Sable, Mosaïque) : la fondamentale de l'accord, comme une
    basse, avec sa quinte quand la pose tombe sur le temps.
  - **Effacements** : les éclats de verre, le balayage du Sable et la céramique de la Mosaïque
    égrènent l'accord en cours, plus haut à chaque combo ; quatre lignes d'un coup font gronder
    sa fondamentale.
  - Déplacements, réserve et gestes de la Mosaïque (prise, aimantation, retour, nouvelle main)
    prennent aussi leurs notes dans l'accord.
- **Le mode Rythme mène la musique** : elle passe au tempo du mode (100 BPM, 5 de plus par
  niveau) et cale ses temps et ses mesures sur sa pulsation. Avant, la musique gardait son
  propre tempo (84 BPM) sous celui du mode.

### Modifié

- L'arpège cristallin de la musique choisit ses notes dans l'accord en cours : plus de fa sur
  l'accord de do (qui contient mi), ni de la sur celui de si♭.
- La note de chaque palier du combo du Sable suit l'accord et monte moins haut (×10 atteignait
  un do suraigu).

## [1.20.0] — 22/10/2026

Lot C, premier point : le combo du Sable.

### Ajouté

- **Jauge de combo du Sable** : un effacement remplit la jauge ; chaque effacement suivant
  avant qu'elle soit vide multiplie ses points par 2, 3… jusqu'à ×10. Elle dure 9 s à ×1, de
  moins en moins à chaque palier (5 s au plus serré), et les grands moments des éléments
  (foudre, brasier, liane, glace) la regonflent. Dans le puits, un badge en coin montre
  l'anneau qui se vide et le multiplicateur du prochain effacement ; « ×N » s'élève au-dessus
  des points, le son monte d'une note à chaque palier, deux notes retombent quand la chaîne
  s'éteint.

### Corrigé

- L'annonce d'un effacement du Sable parle de zones, plus de lignes.

## [1.19.1] — 22/10/2026

Le premier écran sans attente : Lighthouse mobile passe de 93–97 à **100** en Performance.

### Modifié

- **L'écran de chargement est le titre du jeu** (LUMI / RIFT / BLOCKS, en grand), peint par
  la page seule ; le jeu le dissout une fois monté.
- **Seule la langue du joueur est téléchargée** : chaque langue est un module à part, demandé
  avec le code ; le module d'entrée passe de 37 à 15 Ko compressés. Une autre langue choisie
  dans les réglages arrive à la demande.
- **Les styles du premier écran sont dans la page** : plus aucune feuille de style bloquante.
- **Le code est demandé après la première image** de l'écran-titre, et les images des menus
  (gemmes, scène vivante, boucle de l'accueil) une fois la page chargée et le navigateur
  libre : rien ne retarde ce que le joueur voit en premier.
- Seuil Lighthouse relevé : Performance ≥ 98 (95 dans les trois autres catégories).

## [1.19.0] — 22/10/2026

La tension de l'échec : le danger se voit, s'entend et se joue ; s'en sortir est
récompensé, perdre marque.

### Ajouté

- **Musique de danger et de délivrance** : dès 70 % du puits, le tempo passe de 84 à 96
  puis 108 BPM (au changement de mesure), un battement de cœur grave monte sous la musique
  et la nappe s'étouffe derrière un filtre. Quand la pile redescend, le filtre s'ouvre et un
  accord majeur résout la tension, sur un souffle.
- **Le puits qui se fend** : des fissures dorées gagnent le verre du puits à mesure que la
  pile monte, une vignette violet-rouge se resserre depuis les bords et le fond se désature.
  Quand la prochaine pièce n'a plus la place d'entrer, elle s'allume en rouge là où elle
  apparaîtrait. Avec les effets calmes, rien ne bouge ; sans effets, un cadre rouge immobile.
- **« Close call! »** : une ligne effacée en zone de danger (une zone de sable, une ligne de
  Mosaïque) rapporte deux fois ses points, avec un éclair doré, un bref ralenti et son
  propre son.
- **Une défaite qui marque** : quand la pile déborde, une demi-seconde de ralenti, la faille
  fend le puits de haut en bas, puis la fenêtre de fin.
- **Les dix dernières secondes** d'une partie chronométrée : un appel, un tic par seconde
  (plus aigu les trois dernières), le temps en rouge qui bat ; la musique presse.

### Modifié

- Le liseré rouge des puits disparaît, remplacé par ce langage du danger ; il reste sur le
  puits de l'adversaire en Duel.

## [1.18.0] — 22/10/2026

Accrocher dès les premières secondes : ce que les autres jeux de blocs n'ont pas, montré
avant même de jouer, puis pratiqué, puis promis.

### Ajouté

- **La boucle des moments forts sur l'accueil** : de vraies parties, jouées par les vrais
  moteurs, se succèdent sur l'écran titre (environ 27 s par tour) : les éléments du Sable
  (foudre dans l'eau, huile en feu, graine), le Renversement et ses quatre lignes, le Ver des
  dunes qui jaillit et reçoit la foudre, la Bascule, les pierres du Golem de céramique, le
  Miroir suivi d'un RIFT!, l'Œil de la Tour aveuglé par une bombe, le Cœur de la faille
  blessé. Chaque moment a sa légende traduite (le mode ou le Gardien, puis ce qu'il montre).
  Le code d'une famille se charge quand la boucle arrive à elle, après le premier affichage.
  Mouvement réduit ou effets coupés : une seule image fixe (le brasier).
- **Des scènes partagées** (`src/showcase/`) : la boucle et les vidéos des portails jouent
  les mêmes scènes, réglées par des options publiques des moteurs (premier geste d'un
  Gardien avancé, première main de la Mosaïque, puits dessiné en couleurs avec ses gemmes)
  au lieu d'écrire dans leurs champs privés ; un test vérifie que chaque moment atteint son
  sommet à temps.
- **La promesse du premier Gardien** : à la fin du 1-1, le Ver des dunes passe sous le sable
  (ombre sombre, yeux rouges qui luisent, sable qui tremble au-dessus de lui) ; la fenêtre de
  fin annonce qu'il attend au niveau 2-7, et la carte nomme le Gardien de chaque chapitre, ou
  le prochain.
- **Niveau 1-2, la pratique des éléments** : du Sable sans vent, eau, foudre, huile, feu et
  graine dès la troisième pièce et souvent. Le Classique passe au 1-3 ; Chroma quitte le
  chapitre 1 (il reste au 3-5).

### Modifié

- **Le guide ne cache plus le spectacle** : sa carte monte au-dessus du puits, et après deux
  pièces lâchées sans faire l'étape montrée, il passe directement au but.
- Les annonces des éléments s'accordent au pluriel (« 1 grain », « 12 grains »).

## [1.17.2] — 21/10/2026

Corrections issues de la revue modérateur CrazyGames.

### Corrigé

- **Pas de publicité dans les premières minutes** : sur CrazyGames, la première publicité
  « midgame » attend 3 minutes de jeu réel (pauses et menus exclus). La revue l'a vue partir
  après 25 s, au passage du niveau 1-1 au 1-2 ; le portail demande « une quantité raisonnable de
  jeu » avant toute publicité, et son aperçu QA n'applique pas sa propre attente de 3 minutes.
- **`happytime` avec parcimonie**, comme le demande le portail : seulement pour un record battu
  (plus pour la toute première partie d'un mode) ou un Gardien vaincu pour la première fois,
  plus pour chaque niveau gagné.
- **P reprend la partie** depuis la fenêtre de pause, comme il l'a ouverte.

## [1.17.1] — 21/10/2026

La vitrine des portails.

### Modifié

- **Nouvelles couvertures** (CrazyGames, Playgama, carte de partage du site) : l'Œil de la Tour
  au-dessus de la tour de gemmes, son regard rouge, une bombe qui éclate, sur un ciel violet
  lumineux ; lisibles en vignette de 200 px. Le dessin vit dans `scripts/media-covers.mjs`.
- **Nouvelles vidéos d'aperçu** (19,7 s, paysage et portrait) : la foudre dans l'eau et l'huile
  en feu, puis les quatre Gardiens (Ver des dunes, Œil de la Tour aveuglé, Golem, Cœur de la
  faille), joués par les vrais moteurs ; jamais d'image noire en début de scène.
- Description CrazyGames réécrite autour des éléments et des Gardiens (`docs/CRAZYGAMES.md`).

## [1.17.0] — 21/10/2026

Le dernier Gardien : chaque chapitre a désormais le sien.

### Ajouté

- **Le Cœur de la faille**, boss final, au niveau 5-7 (puits classique, 4 minutes). Un cœur de
  cristal bat sous la pile ; avant chaque battement il **enfle** (les trous des rangées à venir
  luisent au sol, leurs éclats en transparence), puis il fait **monter des gravats**, chaque rangée
  portant un **éclat de la faille** relié à lui par une veine de lumière.
- **Son attaque est son point faible** : effacer la rangée d'un éclat lui retire 15 points de vie ;
  chaque ligne le blesse un peu (2, 4, 7, 12) et retarde son prochain battement. Le compte à
  rebours du battement s'affiche dans le tableau de jeu.
- Trois phases : il bat plus vite ; à la dernière, la faille plie les règles (le puits se
  retourne à chaque battement) et deux rangées montent à la fois, avec le même trou.
- **Récompense** : l'ambiance **La Faille** (violet profond et lumière dorée).
- Le décor d'un mode peut se dessiner derrière la pile (`WellDecor.drawBehind`).

## [1.16.0] — 21/10/2026

Le troisième Gardien de la faille.

### Ajouté

- **L'Œil de la Tour**, boss du chapitre 4, au niveau 4-7 (Tour, 4 minutes). Un œil immense tourne
  autour de la tour comme une lune ; son **regard** éclaire un secteur de colonnes. Il s'arrête,
  rougit et **charge** (des cadres rouges montrent où tomberont les pierres), puis **frappe** : une
  pierre tombe sur chaque colonne regardée. Derrière la tour, on le voit à travers le verre et une
  flèche au bord indique de quel côté il est.
- **Riposte** : une gemme-bombe qui explose dans son regard l'**aveugle** (15 dégâts, sa charge est
  annulée, il reste fermé 3 s) ; ailleurs, une bombe ne le blesse que de 5. Chaque anneau effacé le
  blesse (5 pour un, 8 de plus par anneau en même temps). Les bombes viennent plus tôt et plus
  souvent dans ce niveau.
- Trois phases : son regard s'élargit (7 colonnes) et il peut changer de sens ; à la dernière, il
  frappe plus vite et fait monter un anneau de gravats.
- **Récompense** : l'effet de destruction **Éclats d'iris**.
- Sons (charge, impact, aveuglement), secousses, rayons de frappe, chiffres de dégâts.

## [1.15.0] — 21/10/2026

Le deuxième Gardien de la faille.

### Ajouté

- **Le Golem de céramique**, boss du chapitre 3, au niveau 3-7 (Mosaïque, 4 minutes). Le plateau
  est son armure : son visage, des fissures réparées à l'or, apparaît sous les cases vides, et ses
  yeux brûlent puis rougissent à chaque phase. Il **vise** des cases libres (un viseur rouge et le
  nombre de poses restantes), puis y **lance des pierres** en arc depuis ses yeux. Une pierre
  remplit sa case, mais une ligne effacée ne fait que la **fissurer** ; la suivante la brise.
- **Parade** : poser une pièce sur une case visée bloque sa pierre (et le blesse de 2).
- On le blesse en effaçant : 4 pour une ligne, 7 de plus par ligne en même temps, jusqu'à 4 de
  plus avec la série ; 3 par pierre à lui brisée ; 20 pour un plateau vidé. Trois phases : 2, 3
  puis 4 pierres par lancer, toutes les trois poses. Le joker bombe brise une pierre d'un coup.
- **Récompense** : le matériau de blocs **Kintsugi** (céramique réparée à l'or).
- Sons (lancer, impact de pierre, parade), éclats, effondrement du plateau à sa chute.
- Base commune des Gardiens (`GuardianHealth`) : 100 points de vie, phases sous 66 et 33.

### Corrigé

- La victoire contre un Gardien ne compte plus comme un duel gagné (objectif du jour « battre
  l'IA ») et la fin de partie l'annonce comme telle, plus « la pile de l'IA a débordé ».
- La jauge de l'objectif montre le dernier coup porté (elle restait à 96/100).

## [1.14.0] — 21/10/2026

Le premier Gardien de la faille.

### Ajouté

- **Le Ver des dunes**, premier boss, au niveau 2-7 (le Gardien du chapitre 2, sur la carte comme
  un septième niveau mis en valeur). Il nage sous le sable (son ombre ondule), annonce par des
  fissures rouges où il va surgir, jaillit en projetant du sable, puis reste exposé 3 s, son point
  faible doré sur le front. Trois phases : il rôde ; il dévore le sable en surface ; il lève une
  tempête et surgit deux fois de suite.
- On le blesse avec le jeu : la foudre sur sa tête exposée (coup critique), une électrocution dans
  une eau qui le touche (il est étourdi), le feu et le brasier quand il est dehors, une couleur
  reliée d'un mur à l'autre qui passe sur lui. L'objectif du niveau est sa barre de vie.
- **Récompense** : le matériau de blocs **Écailles des dunes**, débloqué en le battant.
- Sons (grondement, rugissement, coups), secousses, éclats, effondrement en sable doré.

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
