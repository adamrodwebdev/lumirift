# Cahier des charges — Lumirift

| Version | Date       | Statut               |
| ------- | ---------- | -------------------- |
| 1.11    | 21/10/2026 | Prêt pour CrazyGames |

Document vivant : il est mis à jour à chaque étape livrée (voir § 12, journal).

---

## 1. Contexte et objectifs

Le jeu de blocs qui tombent est l'un des genres les plus joués au monde. Tout le monde en
connaît les règles, mais l'offre web gratuite se résume le plus souvent à des clones du mode
« Marathon ». **Lumirift** part de ces règles connues et ajoute des **modes de jeu inédits**
qui changent la façon de penser la pile, sans changer la prise en main.

Objectifs :

1. **Prise en main immédiate** : un joueur qui connaît le genre joue en moins de 5 secondes,
   en un clic.
2. **Rejouabilité** : quatorze modes en quatre familles de jeux (chute, sable, placement,
   volume), dont un **défi du jour** identique pour tous les joueurs.
3. **Viralité** : le résultat du défi du jour se partage en un geste (texte court + lien).
4. **Qualité web exemplaire** : Lighthouse ≥ 95 dans les quatre catégories, sur mobile.
5. **International dès le lancement** : français, anglais et indonésien.

## 2. Positionnement marketing

### 2.1 Cibles

| Segment                     | Attentes                                        | Réponse produit                          |
| --------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Joueurs occasionnels (25+)  | Partie courte, gratuite, sans inscription       | Un clic pour jouer, parties de 2 à 5 min |
| Habitués du genre           | Contrôles précis, nouveauté                     | Rotation standard, modes inédits         |
| Joueurs mobiles (Indonésie) | Jouer sur un téléphone modeste, réseau variable | Mobile d'abord, < 100 Ko compressés      |

**Pourquoi l'indonésien** : l'Indonésie est l'un des plus grands marchés du jeu mobile, très
majoritairement joué sur téléphone Android d'entrée de gamme. Ce choix impose une exigence
forte de **légèreté** et de **jouabilité tactile**, qui profite à tous les marchés.

### 2.2 Proposition de valeur

> « Les règles que vous connaissez. Des parties que vous n'avez jamais jouées. »

Différenciation :

- **Modes à mécanique nouvelle** (renversement, miroir, bascule du puits, fusion des
  couleurs, sable, tour cylindrique) plutôt que de simples variantes de vitesse.
- **Plusieurs jeux sous une même marque** : le joueur venu pour la chute découvre le sable ou
  la mosaïque sans quitter le site ; la mosaïque se distingue de ses concurrents par des
  **jokers gagnés en jouant**, jamais vendus.
- **Défi du jour** à graine commune : même mode et même suite de pièces pour tous, résultat
  partageable (boucle virale de type jeu quotidien).
- **Duel contre une IA** et **Silhouette** (énigmes) pour ceux qui cherchent un objectif
  autre que le score.
- **Une identité spectaculaire** : des blocs de matière qui se fissurent et volent en éclats
  (§ 3.5), une matière par famille de jeux.
- **Aucun compte, aucun traceur, aucune bannière de cookies** (sur notre site) : rien ne s'interpose entre le
  joueur et la partie.

### 2.3 Nom et propriété intellectuelle

- Le nom « Tetris », ses déclinaisons et le vocabulaire déposé (« Tetrimino »…) ne sont
  **jamais utilisés** : marques détenues par The Tetris Company. Le jeu dit « pièce » et
  « ligne ».
- Les règles d'un jeu ne sont pas protégeables, mais **l'apparence** l'est (jurisprudence
  _Tetris Holding v. Xio Interactive_, 2012) : Lumirift utilise sa **propre palette**, son
  propre habillage du puits et ses propres noms de modes. Depuis la 1.11, **aucune pièce ne
  porte la couleur du standard** (I cyan, O jaune, T violet, S vert, Z rouge, J bleu, L orange) :
  I rose, O violet, T ambre, S cyan, Z citron vert, J corail, L bleu (`--tone-N` dans
  `tokens.css`, distincts des jetons `--jewel-*` de l'interface).
- Nom de travail : **Lumirift** (« la faille dans la pile »), prononçable dans les trois
  langues. Vérification de disponibilité (marque, domaine, réseaux) à faire avant lancement.

## 3. Périmètre fonctionnel

### 3.1 Règles communes

- Puits de **10 × 20** cases visibles, plus 2 rangées masquées au-dessus.
- Sept pièces de quatre blocs (I, O, T, S, Z, J, L), tirées par **sac de 7** (chaque pièce
  une fois par sac, ordre aléatoire) : pas de longue disette de barre.
- **Rotation** dans les deux sens avec décalages muraux (système de rotation standard du
  genre, dit SRS).
- **Réserve** (mettre une pièce de côté, une fois par pièce), **aperçu** des 3 prochaines
  pièces, **pièce fantôme** (désactivable).
- **Délai de verrouillage** de 500 ms, réinitialisé par un mouvement ou une rotation
  (15 fois au plus), pour garder le contrôle à grande vitesse.
- Chute douce (+1 point par case) et chute instantanée (+2 points par case).
- Après un effacement, la pièce suivante apparaît **280 ms** plus tard (temps de la
  destruction, § 3.5).
- Score des lignes, multiplié par le niveau : 1 ligne 100, 2 lignes 300, 3 lignes 500,
  4 lignes 800. **Combo** : +50 × combo × niveau par verrouillage consécutif qui efface.
- Niveau + 1 toutes les 10 lignes ; la gravité suit la courbe standard du genre.
- Fin de partie quand une pièce ne peut pas apparaître.

### 3.2 Modes de jeu

Quatorze modes, répartis en **quatre familles** de jeux. Une famille partage un moteur ; un
mode n'en change que la règle. Les règles communes du § 3.1 valent pour la famille **Chute**.

- **Chute** (10 modes) : Classique, Marée, Renversement, Chroma, Miroir, Fusion, Bascule,
  Silhouette, Rythme, Duel.
- **Sable** : Sable (les pièces se désagrègent en grains).
- **Placement** : Mosaïque (grille sans gravité, jokers).
- **Volume** : Tour (puits cylindrique en pseudo-3D).
- **Défi du jour** : entrée **transversale**, qui n'appartient à aucune famille. Il applique
  une graine commune et une durée de 2 minutes au mode du jour, tiré parmi les modes
  éligibles de toutes les familles (précisé en v0.4).

Noms des modes (FR / EN / ID) : Classique / Classic / Klasik · Défi du jour / Daily
Challenge / Tantangan Harian · Marée / Tide / Pasang · Renversement / Flip / Terbalik ·
Chroma · Miroir / Mirror / Cermin · Fusion / Fusion / Fusi · Bascule / Tilt / Miring ·
Silhouette / Silhouette / Siluet · Rythme / Rhythm / Ritme · Duel · Sable / Sand / Pasir ·
Mosaïque / Mosaic / Mozaik · Tour / Tower / Menara.

#### Famille Chute

| Mode             | Objectif                         | Mécanique nouvelle                                         |
| ---------------- | -------------------------------- | ---------------------------------------------------------- |
| **Classique**    | Meilleur score, sans fin         | Référence du genre                                         |
| **Marée**        | Tenir le plus longtemps possible | Des rangées montent du fond, de plus en plus vite          |
| **Renversement** | Meilleur score, sans fin         | Le joueur retourne le puits : la pile retombe, en cascade  |
| **Chroma**       | Meilleur score, sans fin         | Couleurs indépendantes des formes, lignes pures × 4        |
| **Miroir**       | Meilleur score, sans fin         | Le puits se reflète gauche-droite toutes les 10 lignes     |
| **Fusion**       | Meilleur score, sans fin         | 6 blocs de même couleur fusionnent, réactions en chaîne    |
| **Bascule**      | Meilleur score, sans fin         | Le puits pivote vers la gauche toutes les 10 lignes        |
| **Silhouette**   | Remplir une forme cible au mieux | Énigme : pas de lignes, une silhouette à combler           |
| **Rythme**       | Meilleur score, sans fin         | Poser sa pièce sur le temps fait grimper un multiplicateur |
| **Duel**         | Faire déborder l'adversaire (IA) | Les lignes effacées envoient des rangées chez l'adversaire |

Règles détaillées :

- **Défi du jour** : la graine est la date locale du joueur (AAAAMMJJ). Elle choisit aussi le
  **mode du jour** parmi les modes éligibles (Classique, Chroma, Miroir, Fusion, Rythme,
  puis Sable et Mosaïque quand ils seront livrés), annoncé sur l'accueil (« Aujourd'hui : Sable »). Deux minutes de jeu.
  En fin de partie, le joueur partage un texte court (mode, score, date, lien) via le partage
  natif du téléphone ou, à défaut, le presse-papiers. Meilleur score conservé par jour.
  Chaque essai du jour rejoue **exactement la même suite de pièces**. Deux graines
  distinctes sont dérivées de la date (`mode:AAAAMMJJ` et `pieces:AAAAMMJJ`) : le tirage du
  mode ne décale pas la suite des pièces. Les modes éligibles sont ceux déjà livrés : la
  liste s'allonge à chaque lot, et sera figée à la version 1.0.
- **Marée** : une rangée de déchets (un seul trou) monte du fond toutes les 10 s au départ ;
  l'intervalle diminue de 0,5 s par rangée, jusqu'à 3 s. Chaque ligne effacée retarde la
  prochaine montée de 1 s. Score principal : temps de survie. Une nouvelle rangée garde le
  trou de la précédente 7 fois sur 10 : le joueur peut creuser un puits pour y glisser la
  barre.
- **Renversement** : le joueur gagne une **charge de renversement** toutes les 10 lignes
  (2 au plus, 1 au départ). Utiliser une charge retourne le puits tête en bas : chaque
  colonne de blocs retombe vers le fond, ce qui **supprime tous les trous** et peut
  provoquer des **lignes en cascade**, comptées comme un combo. Animation désactivée si
  l'utilisateur réduit les animations.
  _Équilibrage (v0.2)_ : l'essai du moteur montre que le renversement efface tous les trous
  d'un coup ; une charge toutes les 5 lignes (3 au plus) le rendait trop puissant.
  Les lignes effacées **en cascade** ne rechargent pas : un renversement ne doit pas payer
  le suivant (v0.4).
- **Chroma** : chaque pièce reçoit l'une de 4 couleurs, indépendamment de sa forme. Une
  ligne effacée dont les 10 blocs sont de la même couleur est une **ligne pure** : son score
  est multiplié par 4.
- **Miroir** : toutes les 10 lignes, le puits se reflète gauche-droite : la pile entière et
  la pièce en cours (un S devient un Z, un J devient un L). Un compte à rebours de 3 s
  prévient le joueur. Une ligne effacée dans les 5 s qui suivent le reflet compte **double**
  (bonus réflexe). Les **commandes ne sont jamais inversées** : le défi vient du plateau, pas
  des doigts (choix d'accessibilité). Le reflet ne peut créer aucune collision : la pile et
  la pièce sont reflétées ensemble.
- **Fusion** : couleurs indépendantes des formes, comme Chroma. Après chaque verrouillage,
  tout groupe d'au moins **6 blocs de même couleur** reliés par un côté fusionne et
  disparaît ; tous les blocs retombent dans leur colonne, ce qui peut former de nouveaux
  groupes : c'est une **chaîne**. Chaque maillon multiplie les points (10 points par bloc ×
  rang de la chaîne × niveau) ; une chaîne d'au moins deux maillons est annoncée. Les lignes
  complètes s'effacent aussi, normalement.
  _Révision (v0.8)_ : le seuil passe de 4 à **6 blocs**. Une pièce compte déjà 4 blocs
  d'une même couleur reliés entre eux : avec 4, chaque pièce aurait fusionné seule dès sa
  pose. Avec 6, toute fusion demande au moins deux pièces (les jeux du genre font de même :
  pièces de 2 blocs, seuil de 4). **À valider par le porteur du projet.**
- **Bascule** : puits **carré de 12 × 12**. Toutes les 10 lignes, après un avertissement de
  3 s, le puits pivote d'un **quart de tour vers la gauche** : l'ancien mur gauche devient le
  sol, et chaque colonne retombe ; les lignes complétées par la chute s'effacent en cascade.
  La pièce en cours repart du haut. Animation de rotation (coupée hors effets complets).
  _Correction (v0.8)_ : le texte précédent disait « sens horaire », ce qui contredisait
  « le mur gauche devient le sol » ; c'est ce second effet qui est retenu.
- **Silhouette** : la **silhouette du jour** (la même pour tous, une nouvelle chaque jour)
  est tracée en bas du puits : contour doré, cases à remplir teintées ; son nom s'affiche dans
  le tableau de bord. Aucune ligne ne s'efface et les chutes ne rapportent pas de points. Le
  joueur dispose de (aire / 4) × 1,25 pièces, arrondi au-dessus. Score : +10 par case remplie
  dans la forme, −20 par bloc posé hors de la forme (jamais sous zéro), +1 000 pour une forme
  parfaite, qui termine la partie. Fin aussi quand les pièces sont épuisées. Bibliothèque de
  **30 silhouettes** dessinées en texte (`modes/silhouettes.ts`), nommées dans les trois
  langues.
- **Rythme** : une pulsation à 100 battements par minute au niveau 1, +5 par niveau. Une
  pièce verrouillée à ± 120 ms d'un temps fait monter le **multiplicateur** (× 1 à × 4) ;
  hors du temps, il retombe à × 1. Il multiplie les points des lignes. **Métronome visuel**
  (le cadre du puits pulse, plus fort au premier temps de chaque mesure) et sonore (grosse
  caisse et charleston synthétisés) : le mode se joue aussi sans le son. « × n » s'affiche
  quand une pièce tombe dans le temps ; le multiplicateur maximal est annoncé.
- **Duel** : le joueur affronte une IA qui joue dans un second puits, affiché en **vignette
  vivante** sous la réserve (à toutes les tailles d'écran). L'adversaire se choisit avant la
  partie, parmi **cinq niveaux** (tableau ci-dessous). Les deux camps reçoivent **la même suite de
  pièces** (une seule graine pour les deux).
  - Rangées envoyées : 2 lignes → 1, 3 → 2, 4 → 4, plus 1 par combo en cours.
  - Une attaque **annule d'abord** les rangées en route vers soi ; le reste part chez
    l'adversaire. Les rangées reçues attendent **1 s**, puis montent avec un seul trou.
  - Une **jauge rouge** sur le bord gauche du puits montre les rangées en approche.
  - Le premier qui déborde perd ; les deux parties s'arrêtent. Fenêtre de fin titrée
    « Victoire » ou « Partie terminée » (défaite), avec la raison.
  - L'IA cherche tous les placements atteignables (rotation à l'apparition, glissement,
    chute), les évalue (hauteur cumulée, lignes, trous, irrégularité ; pondérations de
    référence de Yiyuan Lee) et joue **par les mêmes commandes qu'un joueur**. Les cinq
    niveaux suivent les vitesses de vrais joueurs (pièces par seconde des joueurs classés
    en ligne : environ 0,7 au 10ᵉ centile, 1,1 en médiane, 1,7 au 90ᵉ, 2,5 au 99ᵉ) :

    | Niveau    | Vitesse visée (mesurée) | Erreurs | Réserve | Pièce suivante | Attaque  |
    | --------- | ----------------------- | ------- | ------- | -------------- | -------- |
    | Débutante | 0,5 p/s (0,51)          | 30 %    | non     | non            | non      |
    | Facile    | 0,8 p/s (0,80)          | 18 %    | non     | non            | non      |
    | Normale   | 1,1 p/s (1,14)          | 8 %     | oui     | non            | 4 lignes |
    | Difficile | 1,7 p/s (1,69)          | 3 %     | oui     | oui            | 4 lignes |
    | Experte   | 2,5 p/s (2,42)          | aucune  | oui     | oui            | 4 lignes |
    - **Erreurs humaines** : une erreur choisit un placement proche du meilleur bien plus
      souvent qu'un mauvais (parmi les 5, 4, 3, 2 meilleurs selon le niveau).
    - **Réserve** : l'IA garde une pièce quand l'autre (en réserve ou suivante) se place
      nettement mieux.
    - **Attaque** : tant que son puits est bas (moins de 9 rangées), l'IA garde la colonne
      de droite libre et réserve ses lignes pour un effacement de 4, l'attaque la plus forte
      du duel ; plus haut, elle efface tout ce qu'elle peut. Sur deux minutes, seule :
      0, 0, 3, 6 et 12 effacements de 4 lignes selon le niveau.
    - Ni T-spin ni niveau adaptatif : les jeux du genre proposent des niveaux fixes ; un
      niveau qui s'adapte au joueur reste une piste (§ 11).

#### Famille Sable

- **Sable** : les pièces tombent et se manipulent comme dans la famille Chute (mêmes formes,
  même rotation, sac de 7, même vitesse par niveau), mais **sans réserve**. Elles glissent
  d'une case sur les côtés et tombent **grain par grain**, ce qui les pose en douceur sur un
  sable irrégulier. Contour de la pièce et de son point d'arrivée (désactivable avec la pièce
  fantôme). Délai de pose : 300 ms, relancé 10 fois au plus.
- À la pose, chaque case devient **6 × 6 grains** (puits de 60 × 120 grains). Chaque grain
  tombe, puis glisse en diagonale s'il est bloqué ; la pièce s'effondre en pente. Physique à
  pas fixe de 16 ms ; le sens de balayage alterne pour que le sable ne penche pas.
- Chaque pièce porte l'une de **4 couleurs**. Une **zone d'une même couleur, continue, qui
  relie le mur gauche au mur droit** est effacée, même si elle serpente. Points : 1 par grain
  effacé, multiplié par le nombre de zones effacées d'un coup. Niveau + 1 toutes les 5 zones.
- **Éléments** (à partir de la 6ᵉ pièce : eau 10 %, feu 7 %, **au moins 3 pièces de sable
  entre deux éléments**, jamais deux de suite), annoncés à leur arrivée et **reconnaissables
  dans l'aperçu** à leur motif (anneau pour l'eau, triangle pour le feu) :
  - **eau** : ses grains coulent aussi sur les côtés, puis se figent au bout d'environ 2 s
    dans la **couleur la plus présente parmi ses 8 voisins** (celle du dessous en cas
    d'égalité, au hasard s'il n'y en a aucune). **L'eau éteint le feu** : les deux
    disparaissent dans un nuage de vapeur ;
  - **feu** : un feu **se vise**. Pendant la chute, la zone qu'il brûlerait **scintille de
    flammes** sous la pièce. Posé sur du sable, il consume aussitôt la zone d'une couleur
    qu'il touche le plus (1 500 grains au plus, les plus proches d'abord), pour **la moitié
    des points** d'un effacement (1 point pour 2 grains) : il aide, il ne remplace jamais
    le fait de relier les murs. Tombé sans toucher de sable, il brûle la première zone qu'il
    touche puis s'éteint, ou s'éteint seul après environ 3,5 s ;
  - **vent** : un coup de vent toutes les 20 à 40 s, **annoncé 3 s avant** avec sa direction,
    souffle 2,5 s. Il ne soulève que les **grains libres en surface**, d'**une case au plus**
    par rafale ; les rafales **alternent de sens** et **se taisent** quand le sable approche
    du haut (moins de 3 rangées) : le vent ne décide jamais d'une partie.
- **Choix fondés sur les jeux du genre** : aucun jeu de sable publié ne propose d'éléments
  en partie classée (Sandtrix, le plus connu, les réserve à un bac à sable) ; ses joueurs
  reprochent surtout un hasard mal annoncé (couleur suivante peu lisible). D'où l'annonce
  dans l'aperçu, le feu visé et l'espacement des éléments. Le feu qui consume toute une
  couleur s'inspire du « joyau magique » de Columns, rare et accepté comme une récompense ;
  l'eau qui éteint le feu suit les simulateurs de sable (Powder Toy, Sandspiel, Noita).
- **Textures par couleur** (lisibles par les daltoniens) : damier, rayures horizontales,
  rayures verticales, points ; l'eau miroite, le feu vacille.
- **Effets** : poussière à la pose, paillettes de la couleur effacée, braises du feu, nuage
  de sable en fin de partie ; sons d'écoulement, de balayage, de crépitement et de rafale.
- Fin de partie quand une pièce ne peut plus apparaître. Le Sable peut être le mode du
  **défi du jour**.
- **Mesures** (navigateur intégré) : avec 6 444 grains dans le puits, 6,2 ms par image en
  moyenne ; un pas de physique et la recherche des zones : 0,23 ms.

#### Famille Placement

- **Mosaïque** : grille de **8 × 8**, sans gravité. Trois pièces sont proposées ; le joueur
  les pose dans l'ordre qu'il veut, **sans les tourner** (chaque orientation est une pièce).
  Toute ligne ou colonne complète s'efface (une case à un croisement compte une fois). Trois
  nouvelles pièces arrivent quand les trois sont posées.
- **Pièces** (de 1 à 9 cases ; poids par orientation) : barres de 2 et de 3 (3), petit coin
  de 3 cases (2), carré 2 × 2 (4), cube (2), barres de 4 (2) et de 5 (1), rectangles 2 × 3
  (1,5), T et S / Z (1), L / J (0,75), grand coin de 5 cases (0,6), carré 3 × 3 (1,5). Les
  petites pièces sauvent une partie, le 3 × 3 et le grand coin la mettent en danger.
- **Distribution équitable** : chaque main peut être **posée en entier**, dans un certain
  ordre, lignes effacées entre deux poses (recherche en profondeur, 4 000 essais au plus par
  main ; moins de 1 ms mesuré). Douze mains tirées au hasard au plus ; sinon la main est
  construite pièce par pièce sur un plateau simulé. Les pièces de 5 cases et plus gagnent
  10 % de fréquence toutes les 15 mains (deux fois plus au plus) ; au-delà de 40 cases
  occupées, les pièces de 3 cases ou moins sont deux fois plus fréquentes.
- **Points** : 1 par case posée ; lignes et colonnes effacées d'un coup : 1 → 10, 2 → 30,
  3 → 60, 4 → 100, 5 → 150, puis +60 par ligne ; **combo** : chaque pose qui efface ajoute
  1 au combo, qui multiplie ces points par 1 + 0,25 × (combo − 1), × 3 au plus ; le combo
  **survit à deux poses sans effacement** et retombe à la troisième (une main) ; **grille
  nette** (plateau vide après un effacement) : +300, hors combo.
- **Jokers**, **jamais payants**, 2 de chaque au plus, gagnés selon l'exploit — plus il est
  grand, plus le joker est fort ; chaque partie commence avec un **Retour** :
  - **Rotation** (2 lignes d'un coup) : tourner d'un quart de tour une pièce proposée ;
  - **Cube** (3 lignes d'un coup) : une pièce d'une seule case dans un emplacement bonus ;
  - **Bombe** (4 lignes ou plus d'un coup, ou combo de 6) : effacer un carré de 3 × 3 (zone
    surlignée avant de la lancer) ;
  - **Relance** (toutes les 25 lignes) : remplacer les trois pièces proposées ;
  - **Retour** (grille nette, ou toutes les 10 mains posées) : annuler la dernière pose,
    une seule fois. Il rend l'état d'avant la pose, jokers compris : un joker gagné par la
    pose annulée est perdu, et l'usage d'un autre joker ne s'annule pas.
- **Fin de partie** quand aucune pièce ne rentre **et** qu'aucun joker détenu ne peut
  débloquer la situation (une Bombe ou une Relance gardent la partie en vie).
- **Choix fondés sur les jeux du genre** (Block Blast, 1010!, Woodoku, Blockudoku) : le
  reproche le plus fréquent est la **main impossible**, d'où la distribution équitable ;
  le barème croissant et le combo qui tolère une main sans effacement suivent les jeux du
  genre (leurs barèmes exacts ne sont pas publiés). La barre des jokers les regroupe par
  type, avec le nombre détenu.
- **Aide au jeu** : pendant qu'on vise, l'aperçu montre la pièce à sa place (ou un contour
  rouge si elle ne rentre pas) et **les lignes et colonnes qui vont s'effacer s'illuminent**.
  Une pièce qui ne rentre nulle part est grisée dans la main.
- **Commandes** : glisser-déposer au doigt (la pièce flotte au-dessus du doigt) ou à la
  souris ; toucher une pièce puis une case ; clavier complet (1, 2, 3, 4 pour le cube, flèches,
  Entrée, J pour les jokers, Échap). La pause affiche l'aide propre à la famille.
- **Matière : céramique émaillée** : carreaux arrondis au reflet brillant et aux fines
  craquelures, motif gravé par couleur ; posés, ils rebondissent ; effacés, ils sautent, se
  fendent puis éclatent en tessons et éclats de terre ; la bombe pulvérise sa zone ; sons de
  céramique (pose, bris plus grave que le verre, bombe, relance, retour).
- Mécanique libre de droits (genre partagé par de nombreux jeux) ; ni le nom ni l'apparence
  d'un jeu existant ne sont repris. La Mosaïque peut être le mode du **défi du jour**
  (deux minutes).

#### Famille Volume

- **Tour** : le puits s'enroule en **cylindre de verre** de **20 colonnes** sur 16 rangées :
  la colonne 19 touche la colonne 0, il n'y a plus de murs. Une ligne est un **anneau**
  complet de 20 cases. Les règles sont celles de la famille Chute (mêmes pièces, rotation,
  réserve, vitesse, points, pièce fantôme), sauf l'arrivée des pièces : chaque nouvelle pièce
  apparaît **au-dessus de l'endroit où la précédente s'est posée** (au centre si la place
  manque), pour que la vue reste là où le joueur construit (1.11).
- **Caméra** : elle suit la pièce et la garde de face, en tournant par le chemin le plus
  court. Environ 10 colonnes sont visibles ; elles s'amincissent vers les bords. Le joueur
  la tourne à la main avec **A / E** (AZERTY) ou **Q / E** (QWERTY), ou en **glissant à
  deux doigts** ; la caméra revient sur la pièce à l'arrivée de la suivante. Avec les effets
  réduits, elle se place sans glisser.
- **Rendu** : pseudo-3D sur canvas 2D, sans bibliothèque 3D. La tour est vue un peu
  au-dessus ; chaque case est un parallélogramme, dessiné par une transformation affine.
  Les faces sont ombrées selon leur angle à la lumière, avec un reflet vertical. **Le dos
  de la tour se voit à travers le verre**, atténué.
- **Matière** : verre teinté (corps translucide, arête claire, reflet), avec le motif gravé
  de chaque couleur. Les éclats de la famille Chute font le tour du cylindre ; ceux qui
  passent derrière se voient en transparence. Les points s'affichent au centre de l'écran,
  lisibles quel que soit l'angle.
- La Tour peut être le mode du **défi du jour**.
- **Mesures** (navigateur intégré) : l'animation tient la cadence de l'écran (165 images/s)
  avec une pile sur toute la hauteur.

### 3.2 bis Campagne et améliorations (livrées en 1.1)

- **Campagne** : **30 niveaux** en cinq chapitres de six (Premiers blocs, Courants,
  Mosaïques, Vertiges, Le Rift), qui parcourent **tous les modes** ; chaque chapitre se
  termine par un **duel** contre une IA plus forte (Débutante → Experte). Les niveaux
  s'ouvrent dans l'ordre : il faut gagner un niveau pour ouvrir le suivant.
- **Objectifs** : effacer des lignes, marquer des points, effacer plusieurs lignes d'un
  coup, tenir un temps donné, battre l'IA, compléter la silhouette. Les objectifs mesurés en
  jeu (lignes, points, lignes d'un coup, survie) **terminent le niveau dès qu'ils sont
  atteints** ; la victoire en duel et la silhouette se jugent à la fin de la partie. La
  plupart des niveaux sont **minutés** (2 à 4 min).
- **Étoiles** (1 à 3, la meilleure note est gardée) : selon le temps restant à la réussite
  (40 % → 3, 15 % → 2), les lignes effacées (survie) ou la rapidité (duel, silhouette). La
  fiche du niveau énonce l'objectif, le temps et la règle des étoiles avant de jouer.
- **Dix améliorations**, trois rangs chacune, achetées avec les étoiles (2, 3 puis 5 par
  rang : 100 étoiles pour tout, 90 à gagner, il faut donc choisir) ; toutes les étoiles
  peuvent être **rendues** pour essayer d'autres choix. Elles ne servent **qu'en campagne** :
  records, défi du jour et classements restent équitables ; en duel, elles n'aident jamais
  l'IA.

  | Amélioration | Effet par rang                                                                                                                                | Modes              |
  | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
  | Sablier      | +15 / 30 / 45 s au chrono des niveaux minutés                                                                                                 | Tous               |
  | Plume        | Chute ralentie de 10 / 20 / 30 %                                                                                                              | Chute, Tour, Sable |
  | Longue-vue   | +1 / 2 / 3 pièces à l'aperçu                                                                                                                  | Chute, Tour, Sable |
  | Ancre        | +100 / 200 / 300 ms avant la pose                                                                                                             | Chute, Tour, Sable |
  | Prisme       | +10 / 20 / 30 % de points sur les effacements                                                                                                 | Tous               |
  | Phénix       | Seconde chance : 4 / 6 / 8 rangées du bas effacées au lieu de la fin, une fois par niveau (Mosaïque : les 2 / 3 / 4 rangées les plus pleines) | Tous               |
  | Besace       | 1 / 2 / 3 jokers de plus au départ (Bombe, Relance, Rotation)                                                                                 | Mosaïque           |
  | Braise       | +3 / 6 / 9 % de pièces de feu                                                                                                                 | Sable              |
  | Métronome    | Fenêtre du temps élargie de 40 / 80 / 120 ms                                                                                                  | Rythme             |
  | Rempart      | Rangées adverses retardées de 1 / 2 / 3 s                                                                                                     | Duel               |

- Une partie de campagne rapporte de l'expérience et compte pour les objectifs du jour,
  mais **jamais comme record** (elle peut être aidée).
- **Équilibrage à confirmer en jeu** : les cibles de chaque niveau sont des estimations.

### 3.2 ter Menu (accueil refait en 1.1, en onglets en 1.8)

- **Quatre pages côte à côte, sans défilement** : Accueil, Modes, Carte, Atelier. Onglets
  sous le pouce en portrait, rail à gauche en paysage et sur ordinateur (le même menu
  partout) ; glissement du doigt d'une page à l'autre, la pastille de l'onglet suivant le
  doigt. Barre du haut : joueur (niveau, expérience → Atelier), étoiles (→ Carte), son,
  réglages.
- **Accueil** : scène vivante (les gemmes du jeu tombent à plusieurs profondeurs devant la
  faille, qui respire et jette des étincelles), logo, défi du jour, grand bouton Jouer à
  portée du pouce (la campagne continue ; au-delà des niveaux de la démo, une partie de
  Sable), objectifs du jour en fenêtre. Espace lance la partie au clavier.
- **Modes** : les 13 modes sur un écran, les quatre inédits en grand ; illustrations
  dessinées avec les vraies gemmes, recadrées sur leur contenu. Le mode choisi montre son
  principe, son record et Jouer (le Duel demande d'abord l'adversaire).
- **Carte** : un chapitre par écran, six niveaux sur un chemin sinueux (vertical en
  portrait, horizontal en paysage), chemin parcouru illuminé, prochain niveau qui pulse ;
  fiche du niveau avant de jouer (objectif, temps, étoiles, meilleur résultat, améliorations
  utiles ; ce qui ouvre un niveau fermé) ; améliorations.
- **Atelier** : vitrine (un petit puits qui porte la matière, l'ambiance ou les éclats
  essayés) au-dessus d'une étagère en trois familles ; premier toucher : essayer, second :
  porter ; un objet verrouillé dit comment l'obtenir. **Nouveautés** (1.9) : une pastille
  sur l'onglet compte les objets gagnés et pas encore vus, un point marque leur famille, une
  étiquette « Nouveau » chaque objet ; l'Atelier s'ouvre sur la famille qui a du nouveau ;
  un objet est vu une fois essayé ou quand on quitte son étagère.
- **Transitions** : la faille s'ouvre depuis le bouton touché et couvre l'écran le temps de
  charger le mode (écran de jeu, famille et plateau préchargés derrière la lumière) ; au
  retour, les pages remontent en place. Coupe franche si le système demande moins
  d'animations.
- Style : boutons et tuiles en relief qui s'enfoncent, pastilles dorées ; tout passe par les
  jetons.

### 3.3 Commandes

| Action            | Clavier                 | Tactile (gestes, partout sur l'écran de jeu)  |
| ----------------- | ----------------------- | --------------------------------------------- |
| Gauche / droite   | ← → (ou Q D / A D)      | Glisser sur le côté, case par case            |
| Chute douce       | ↓ (ou S)                | Glisser vers le bas                           |
| Chute instantanée | Espace                  | Glisser vite vers le bas                      |
| Rotation horaire  | ↑ ou X                  | Toucher                                       |
| Rotation inverse  | W (AZERTY) / Z (QWERTY) | Toucher à deux doigts                         |
| Réserve           | C ou Maj                | Glisser vite vers le haut, ou toucher la case |
| Renversement      | F                       | Bouton à côté de la réserve                   |
| Pause             | P                       | Bouton en haut de l'écran                     |

Sur écran tactile, **les gestes sont la règle** (1.7) : le réglage « Commandes » fait revenir
des boutons, en deux groupes (déplacer et descendre ; tourner et faire tomber), sous le puits
en portrait et de chaque côté en paysage. Les gestes partent de n'importe où sur l'écran de
jeu, sauf d'un bouton : le doigt ne cache pas le puits.

Famille Placement (Mosaïque) : glisser-déposer au doigt ou à la souris (la pièce s'affiche
au-dessus du doigt pour rester visible) ; au clavier, 1 / 2 / 3 choisit une pièce, les
flèches la déplacent, Entrée la pose, J ouvre les jokers, Retour arrière annule un choix.

**Échap n'appartient qu'au portail** (1.10) : sur CrazyGames et Playgama, il quitte le plein
écran ; le jeu annule la touche (`reservesEscape` de la plateforme) pour que le navigateur
n'en fasse pas une demande de fermeture de fenêtre : seuls leurs boutons les ferment. Sur
notre site, Échap ferme une fenêtre, comme partout sur le web.

**Touches dessinées** (1.10) : la légende de chaque mode (`keyLegendFor`) s'affiche en
touches à côté du jeu pendant les cinq premières parties et dans la pause ; les lettres
suivent la disposition du clavier du joueur quand le navigateur la donne
(`navigator.keyboard.getLayoutMap()`, Chrome et Edge), sinon la lettre QWERTY.

Ni Échap ni Ctrl ne servent en jeu (1.4) : les portails les réservent (Échap quitte le plein
écran, Ctrl+W ferme l'onglet).

Les touches lettres se lisent par **position physique** (`KeyboardEvent.code`) : la même
position fonctionne en AZERTY et en QWERTY. Répétition automatique horizontale : délai
170 ms puis une case toutes les 50 ms.

### 3.4 Paramètres et données

- Langue (FR, EN, ID ; détection de la langue du navigateur au premier lancement).
- Pièce fantôme : oui / non.
- Coupure du son en un geste depuis l'en-tête.
- Effets : complets / sobres / aucun ; secousse : oui / non ; vibrations : oui / non.
- Volumes séparés des effets sonores et de la musique ; coupure du son.
- Progression (expérience, objectifs, série, objets portés) et meilleurs scores par mode,
  stockés **uniquement sur l'appareil** (`localStorage`, avec repli
  en mémoire si le stockage est indisponible). Aucune donnée ne quitte l'appareil.

### 3.5 Direction artistique et son (décidé en v0.5)

Lumirift est destiné à être monétisé sur des portails de jeux : il lui faut une identité
**unique, vendeuse et spectaculaire**, reconnaissable sur une vignette comme dans une vidéo
de dix secondes.

**Concept : « la matière réagit ».** Chaque bloc est un objet, pas un carré de couleur : il
a un poids, il cogne en tombant, il se fissure puis se brise. **La faille** (le _rift_ du nom)
est la signature de la marque : dans le logo, dans les transitions entre écrans (fondu par
fissure) et sur l'écran de fin de partie.

**Une matière par famille de jeux :**

| Famille   | Matière         | Destruction                                                             |
| --------- | --------------- | ----------------------------------------------------------------------- |
| Chute     | Cristal facetté | La ligne se fend, puis éclate en esquilles qui tournent et rebondissent |
| Sable     | Grains          | Les blocs se désagrègent en grains (c'est la mécanique même)            |
| Placement | Céramique       | Les carreaux sautent, se fendent et retombent en morceaux               |
| Volume    | Verre courbé    | L'anneau éclate ; les reflets tournent avec la caméra                   |

**Intensité : spectaculaire par défaut.** Effets de référence (prototype validé le
12/10/2026) :

- **Fissure** : la ligne complète se fend en 150 ms avant de rompre.
- **Éclats physiques** : chaque bloc se brise en 4 à 8 esquilles qui tournent, retombent,
  **rebondissent sur la pile** et sur le fond, puis s'estompent (1,3 à 2 s).
- **Effondrement pondéré** : les rangées du dessus tombent et rebondissent légèrement au lieu
  de se téléporter.
- **Gradation** : plus de lignes d'un coup donne plus d'éclats, projetés plus haut. À 4 lignes
  s'ajoutent une secousse et un court ralenti (120 ms). L'intensité augmente avec les combos.
- **Sensations** : écrasement léger et poussière à l'impact, traînée de la chute instantanée,
  points qui s'envolent vers le compteur, onde au changement de niveau.
- **Fin de partie** : la pile entière se brise.
- **Moments propres aux modes** : bascule 3D du puits (Renversement), reflet qui balaie la
  surface (Miroir), surface d'eau qui monte (Marée), éclat en prisme d'une ligne pure (Chroma),
  ondes de choc de maillon en maillon (Fusion).

**Palette** : propre à Lumirift (terre cuite, sable, sauge, azur, mauve, rose…), déclinée par
thème, volontairement éloignée des couleurs standard du genre. Chaque couleur porte un **motif
gravé** dans ses facettes, pour rester lisible par les daltoniens.

**Son : entièrement synthétisé** (Web Audio, aucun fichier, poids quasi nul). Déplacement,
rotation, impact, verrouillage, fissure, bris (verre, grains, céramique selon la famille),
effondrement, niveau, fin de partie. Les bris d'un combo montent sur une gamme : les combos
« chantent ». Volumes séparés (effets, ambiance), coupure en un geste.

**Vibrations** sur mobile (API Vibration, quand elle existe) : impact court, ligne, 4 lignes ;
désactivables.

**Garde-fous :**

- Système de particules maison, **réservoir d'objets réutilisés** (pas d'allocation pendant le
  jeu), plafond de particules et **qualité adaptative** (sous 55 images/s, moins d'éclats).
- Les effets vivent dans les modules de jeu chargés à la demande : l'accueil reste léger.
- Réglage **Effets : complets / sobres / aucun** ; secousse réglable à part ;
  `prefers-reduced-motion` active « sobres » au premier lancement.
- **Jamais plus de 3 flashs par seconde** (WCAG 2.3.1) ; les éclats ne masquent jamais la
  pièce en cours.

#### Réalisé au lot 4 (famille Chute)

| Moment                | Ce que voit et entend le joueur                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Déplacement, rotation | Petit clic ; rotation plus aiguë                                                                                                                                                                                                                                                                                    |
| Chute instantanée     | Traînée colorée (190 ms), poussière à l'impact, choc sourd, secousse si la chute est longue                                                                                                                                                                                                                         |
| Verrouillage          | Éclair blanc sur les cases posées (110 ms), choc léger                                                                                                                                                                                                                                                              |
| Ligne effacée         | Fissure qui traverse la ligne (130 ms), puis éclats facettés (4 à 8 par case) qui tournent, rebondissent sur la pile et s'estompent ; rangées du dessus retenues puis effondrées avec rebond ; « +points » qui s'envole ; craquement puis bris de verre en carillon (gamme pentatonique, plus aiguë à chaque combo) |
| 4 lignes d'un coup    | Plus d'éclats, projetés plus haut, secousse forte, ralenti de 120 ms, éclair du puits (limité), grondement grave                                                                                                                                                                                                    |
| Ligne pure (Chroma)   | Gerbe d'étincelles aux quatre couleurs, accord cristallin                                                                                                                                                                                                                                                           |
| Changement de niveau  | Onde lumineuse qui remonte le puits, arpège                                                                                                                                                                                                                                                                         |
| Marée                 | Rangées qui glissent depuis le fond, poussière, grondement ; **surface d'eau** qui ondule au-dessus des rangées montées                                                                                                                                                                                             |
| Renversement          | Le puits bascule en 3D (560 ms), la pile retombe, secousse, souffle et impact                                                                                                                                                                                                                                       |
| Miroir                | Le puits pivote sur son axe vertical (460 ms), balayage lumineux, scintillement ; double bip d'avertissement 3 s avant                                                                                                                                                                                              |
| Pile haute (> 70 %)   | Lueur de danger pulsée sur les bords du puits                                                                                                                                                                                                                                                                       |
| Fin de partie         | Toute la pile vole en éclats ; la fenêtre de résultat attend 1,1 s (0,6 s en effets sobres)                                                                                                                                                                                                                         |

**Délai après effacement** : 280 ms entre l'effacement et la pièce suivante, le temps de la
fissure et de l'effondrement. C'est une **règle du jeu**, identique quel que soit le réglage
des effets (le défi du jour reste équitable).

**Profils d'effets** (réglage « Effets visuels ») :

| Profil   | Particules | Fissure et effondrement | Secousse      | Mouvements du puits | Attente fin |
| -------- | ---------- | ----------------------- | ------------- | ------------------- | ----------- |
| Complets | 100 %      | oui                     | selon réglage | oui                 | 1,1 s       |
| Sobres   | 35 %       | oui                     | non           | non (décor figé)    | 0,6 s       |
| Aucun    | 0          | non                     | non           | non                 | aucune      |

**Qualité adaptative** : budget de 1 600, 800 puis 300 particules. Le niveau baisse après
**deux fenêtres consécutives de 2 s** à plus de 18,5 ms par image en moyenne ; les images de
plus de 50 ms (chargement, changement d'onglet) sont ignorées. Il ne remonte pas en cours de
partie (stable plutôt que clignotant).

**Sons** : 16 recettes synthétisées (`src/fx/sounds.ts`), aucun fichier. Le contexte audio
naît au premier geste du joueur (exigence des navigateurs) et se met en veille quand la page
est masquée. **Vibrations** : impact 6 à 14 ms, ligne 26 à 50 ms, 4 lignes [30, 40, 80],
renversement [20, 30, 50], fin de partie [60, 40, 120].

### 3.6 Progression et personnalisation (livrées au lot 10)

Tout ce qui se gagne reste **cosmétique** : aucun avantage de jeu. Tout est gardé **sur
l'appareil** (`stackrift:profile`), comme les records.

- **Expérience**, gagnée par partie dans toutes les familles de la même façon (jamais
  d'après les points, trop différents d'un mode à l'autre) :

  | Source                             | Expérience                                                |
  | ---------------------------------- | --------------------------------------------------------- |
  | Partie d'au moins 20 s             | 10                                                        |
  | Temps de jeu (hors pause)          | 1 toutes les 6 s, 60 au plus                              |
  | Effacements                        | 3 par effacement, +2 par ligne au-delà d'une, 150 au plus |
  | Premier défi du jour de la journée | 25                                                        |
  | Victoire en duel                   | 10, 15, 25, 35 ou 50 selon le niveau de l'IA              |
  | Objectif du jour accompli          | 40, 70 ou 110 selon sa difficulté                         |

  Une partie de moins de 20 s ne rapporte que son temps : relancer sans jouer ne sert à
  rien (la fin de partie le dit).

- **Niveaux** 1 à 50 : le niveau n demande 100 + 40 × (n − 1) points.
- **Objectifs du jour** : trois, un facile, un moyen, un difficile, de sortes différentes,
  les mêmes pour tous le même jour (tirés de la date) : jouer des parties, jouer un mode
  donné, effacer des lignes, effacer plusieurs lignes d'un coup, enchaîner des effacements,
  tenir plusieurs minutes, terminer le défi du jour, battre l'IA normale ou plus forte.
  Chaque objectif est compté une seule fois.
- **Série** : jours d'affilée avec un défi du jour terminé (meilleure série gardée) ;
  affichée sur l'accueil tant qu'elle court.
- **Atelier** (depuis l'accueil, chargé à la demande) : chaque objet porté est marqué, les
  objets verrouillés disent comment les obtenir.

  | Sorte                                | Objets (condition)                                                                                             |
  | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
  | **Matières** (modes de chute)        | Cristal (offert), Néon (niv. 3), Papier (niv. 6), Pixel (niv. 10), Obsidienne (niv. 15), Or (série de 7 jours) |
  | **Ambiances** (tout le jeu)          | Nuit (offerte), Aurore (niv. 2), Abysses (niv. 5), Forge (niv. 8), Cosmos (niv. 12), Sakura (20 objectifs)     |
  | **Signatures de bris** (chute, Tour) | Éclats (offerts), Confettis (niv. 4), Pétales (niv. 9), Feuille d'or (30 objectifs)                            |
  - Les matières gardent toutes le **motif gravé** de chaque couleur. Les autres familles
    gardent leur matière propre (sable, céramique, verre de la Tour) : c'est leur identité.
  - Les ambiances ne changent que deux **lueurs** derrière le jeu, à faible opacité : les
    contrastes de textes et de pièces sont intacts. Elles bougent lentement et s'arrêtent
    avec les effets sobres ou la réduction des animations du système.

- **Fin de partie** : expérience gagnée ligne par ligne, niveau atteint, objectifs
  accomplis, objets débloqués.
- **Plus tard** : les canaux commerciaux (publicités récompensées, achats) avec les versions
  portails. **Musique d'ambiance** : non retenue pour la 1.0 (le jeu reste lisible et
  léger, les portails imposent de toute façon la coupure du son) ; à reprendre avec les
  portails.

### 3.9 Nom du jeu (1.5)

Le jeu s'appelait **Stackrift** jusqu'à la 1.4 ; ce nom était déjà employé sur le web. Il
s'appelle **Lumirift** depuis la 1.5 (lumière + faille : il garde la faille, signature de
l'identité, et le logo se fend au même endroit, LUMI | RIFT). Vérifications du 14/10/2026 :

- Aucun jeu ni aucune appli de ce nom (Steam, itch.io, magasins d'applis, presse jeu).
- Marques (TMview : UE, France, Royaume-Uni, États-Unis, Chine…) : une seule, **LUMIRIFT au
  Royaume-Uni** (UK00004314704, déposée le 23/12/2025 par Guangzhou Jinshiguang E-commerce),
  pour des sacs (classe 18) et du mobilier (classe 20), pas pour des jeux (classes 9, 28, 41).
  Choix confirmé par l'utilisateur en connaissance de cause ; une consultation (INPI, conseil
  en propriété industrielle) reste conseillée avant un dépôt ou des produits dérivés.
- Domaines : `lumirift.com` est pris ; `.net`, `.io`, `.fr`, `.app`, `.game` étaient libres.
- Les clés de sauvegarde restent `stackrift:…` : aucun joueur ne perd sa progression.
- Nom complet **Lumirift Blocks** (1.5.1) : Playgama demande un titre de 2 à 4 mots, identique
  dans le jeu et le formulaire ; le logo garde LUMI | RIFT, sous-titré BLOCKS.

### 3.8 Identité « Rift » (1.4)

CrazyGames a refusé la 1.2 sur la « qualité d'ensemble ». Diagnostic : un accueil qui
ressemblait à une application web, un puits petit au milieu d'un écran vide, pas de musique,
une première impression de clone (Classique partout en premier), pas de prise en main.
Maquettes validées le 14/10/2026 (écran-titre, écran de jeu, covers), puis appliquées :

- **Thème unique sombre** : fond indigo profond, un seul accent or ambré (la faille et
  l'action principale), tons « joyaux » sur les pièces seulement. Polices livrées avec le jeu :
  Unbounded (logo, chiffres) et Sora (interface).
- **Blocs gemmes** : corps arrondi, liseré de lumière en haut à gauche, ombre en bas à droite,
  reflet, motif gravé conservé.
- **Écran-titre** : logo fendu par la faille, « 13 façons de briser un bloc », un grand bouton
  Jouer (la campagne continue ; Espace au clavier), carte et améliorations, les modes inédits
  en tuiles (Sable, Tour, Mosaïque, Duel), défi du jour, scène animée ; tous les modes et les
  objectifs plus bas. Écran de démarrage statique dans `index.html`.
- **Écran de jeu** : HUD contre le puits, score en grand chiffre doré, puits lumineux, aide
  des commandes pendant les cinq premières parties.
- **Effets** : la faille déchire les lignes (halo, liseré doré, cœur blanc), mots des grands
  moments dans le puits (×2, ×3, COMBO ×N, RIFT!), identiques dans toutes les langues.
- **Prise en main** : la première partie est guidée (déplacer, tourner, faire tomber, puis le
  but), chaque étape validée en la faisant, quelle que soit l'entrée ; « Passer » à tout moment.
  La campagne s'ouvre sur le **Sable** (1-1 : deux zones en trois minutes), en version
  **calme** (1.10) : ni vent, ni eau, ni feu, qui arrivent au chapitre 2 (`calm` du niveau,
  `hazards: false` du jeu).
- **Son** : tous les sons dans une même tonalité (ré mineur pentatonique) ; **musique
  générative** dans cette tonalité (nappe i – VI – III – VII, puis basse, arpège et battement
  quand l'intensité monte), dont l'intensité suit le danger (`pressure()` de chaque famille) ;
  volumes séparés, une même réverbération.
- **Ambiance** : derrière le jeu, la lumière de la famille dérive lentement, une faille
  lointaine respire.

### 3.7 Distribution (décidé en v0.5 ; CrazyGames livré en 1.2, Playgama en 1.4)

- **Playgama (1.4)** : plateforme suivante après le refus de CrazyGames (pas de nouvelle
  soumission à CrazyGames pour l'instant). Build `npm run package:playgama` (Bridge SDK v2),
  covers, exigences et formulaire dans [PLAYGAMA.md](PLAYGAMA.md). Diffusion chez les
  partenaires de Playgama (MSN, GameDistribution, YouTube Playables…), Yandex exclu.
  Publicités (1.6) : un interstitiel peut passer à la sortie de chaque fin de partie (rejouer,
  niveau suivant, accueil, campagne), espacé par le portail ; une **pub récompensée
  facultative** double l'expérience de la partie (bouton étiqueté « PUB », récompense seulement
  une fois la pub confirmée vue, une fois par partie, jamais d'interstitiel juste après).

- **CrazyGames (1.2)** : build dédié (`npm run package:crazygames`), médias (covers et vidéos,
  `scripts/crazygames-media.mjs`) et contrôle de chaque exigence du portail dans
  [CRAZYGAMES.md](CRAZYGAMES.md). Le jeu passe par l'abstraction `Platform` : événements de
  jeu, langue, sauvegarde du portail, coupure du son, publicité entre deux parties ; aucun
  lien sortant. Refusé en 1.2.0 sur la qualité ; **resoumission préparée en 1.10** (revue
  complète du build, corrections, médias refaits). Chaque portail décide de ses pubs
  (`midgameAd(hooks, moment)`) : CrazyGames n'en montre jamais en allant vers un menu (boutons
  de navigation) et n'offre pas de pub récompensée.

- **Maintenant** : le jeu de base, sur notre propre site, sans publicité ni SDK tiers.
- **Démo pour le portfolio (1.3)** : `npm run build:demo` produit `dist-demo`, servi par
  adamrodwebdev.com dans `/demos/lumirift/` (chemins relatifs, aucune balise de référencement :
  la page du portfolio porte les siennes). Une **édition** (`src/platform/Edition.ts`) dit ce
  que le build ouvre ; la plateforme `DemoPlatform` porte l'édition démo :
  - jeu libre : **Classique, Sable, Mosaïque, Tour et Duel** (un mode par famille, plus le
    duel) ; les huit autres restent visibles dans le carrousel, grisés, « Jeu complet » ;
  - campagne : le **premier chapitre** (niveaux 1-1 à 1-6, qui passent aussi par Chroma et
    Miroir) ; la carte montre la suite verrouillée, pas de « niveau suivant » après 1-6 ;
  - défi du jour et objectifs quotidiens tirés parmi les modes ouverts ;
  - un bandeau d'accueil annonce la démo. Progression, Atelier et améliorations sont complets.
- **Versions portails** (CrazyGames, Poki, GameDistribution, GamePix, itch.io, Newgrounds…) :
  préparées **une fois le projet fini**. Le jeu passera alors par une abstraction `Platform`
  (début et fin de partie, publicités, stockage, langue, son coupé) sans jamais parler
  directement à un SDK ; un build par portail. Rien de cela n'est développé avant.

## 4. Exigences non fonctionnelles

### 4.1 Performance et Lighthouse

- **Lighthouse ≥ 95** en Performance, Accessibilité, Bonnes pratiques et SEO, mesuré sur le
  build de production en profil mobile. Mesure automatisée : `npm run build` puis
  `npm run lighthouse` (ajouter `-- --desktop` pour le profil bureau). Résultats : § 5.7.
- Budget : JavaScript initial < 100 Ko compressés, aucune police web (polices système),
  aucune requête tierce. Chaque famille de jeux (et l'IA du Duel, et le synthétiseur du
  Rythme) est un **module chargé à la demande** : l'accueil ne charge que le nécessaire.
- Rendu du puits sur `<canvas>` 2D, boucle `requestAnimationFrame`. Dans le moteur, les
  tests de collision et le calcul de la pièce fantôme n'allouent rien (grille `Uint8Array`,
  orientations précalculées, sondes par décalage). 60 images/s visées sur téléphone d'entrée
  de gamme.

### 4.2 Responsive

- **Mobile d'abord** : styles de base pour ~360 px, puis `min-width` aux points de rupture
  640 / 768 / 1024 / 1280 px.
- Aucun défilement horizontal de 320 à 1920 px ; largeurs fluides (`%`, `fr`, `clamp()`,
  `min()`), typographie fluide, espacements en `rem`.
- Le puits occupe la hauteur disponible (`dvh`) en gardant son rapport 1:2.
- **Écran de jeu** (1.7) : aucune page ne défile ni n'a d'en-tête pendant une partie. Une
  seule grille, aux zones nommées : en **portrait**, une bande en haut (pause, score, son ;
  réserve, objectif, suivantes ; indicateurs), puis le puits sur toute la largeur ; en
  **paysage**, le puits au centre sur toute la hauteur, le tableau de bord et la réserve à
  gauche, les suivantes (et l'adversaire du Duel) à droite. Les scènes des familles n'ont pas
  de boîte (`display: contents`) : chaque partie nomme sa zone. Mesures : cases de 32 px en
  390 × 844 (23 en 1.6), 22 px en 360 × 640 (18), 18 px en 844 × 390 (7), 38 px sur ordinateur.
- **Fenêtres** (1.9) : des feuilles qui montent du bas en portrait, des cartes au centre en
  paysage et sur ordinateur, composées pour tenir sans défilement de 360 × 640 à l'ordinateur
  (vérifié par un test de bout en bout ; le défilement interne ne reste qu'en dernier
  recours, texte agrandi ou très petit écran). En paysage, les plus chargées passent sur deux
  colonnes (pause et gestes, réglages, résultats, améliorations, fiche de niveau).
- Cibles tactiles ≥ 44 × 44 px ; aucune action réservée au survol.

### 4.3 Accessibilité (complétée au lot 11)

- Navigation complète au clavier : **lien d'évitement** vers le contenu, focus visible, et
  **focus déplacé sur la région principale** à chaque changement d'écran (le bouton qui y
  menait disparaît). Fenêtres modales natives : focus piégé, Échap, arrière-plan inerte.
- Le puits est décrit (`role="img"` + libellé) ; chaque écran a son titre de niveau 1 ;
  score, niveau et événements (lignes, éléments, jokers, fin de partie) annoncés via une
  région `aria-live` polie.
- La couleur ne porte jamais seule l'information : motif gravé par ton, textures du Sable.
- Contrastes WCAG AA dans les deux thèmes ; cibles tactiles ≥ 44 px.
- Respect de `prefers-reduced-motion` (effets « sobres », ambiances figées) et
  `prefers-color-scheme`.
- Effets réglables (complets, sobres, aucun), secousse et vibrations désactivables, jamais
  plus de 3 flashs par seconde (§ 3.5).
- **Vérification** : audits axe-core **WCAG 2.2 AA** de chaque écran et fenêtre (accueil,
  réglages, Atelier, choix de l'IA, jeu de chaque famille, pause, fin de partie), dans les
  deux thèmes, sur téléphone et ordinateur : aucune violation. Parcours au clavier seul
  testé de bout en bout.

### 4.4 Internationalisation

- Trois langues complètes : **français** (référence), **anglais**, **indonésien**. Mêmes clés
  dans les trois fichiers, vérifié par un test automatisé.
- Aucun texte en dur dans les composants (règle ESLint `vue/no-bare-strings-in-template`).
- Nombres, durées et dates formatés par `Intl` dans la langue courante ; attribut `lang` du
  document synchronisé.

### 4.5 Thème

- Un seul thème, sombre : l'identité « Rift » (§ 3.8, depuis la 1.4 ; il y avait un thème
  clair et un thème sombre jusqu'à la 1.3). Couleurs uniquement via des **jetons CSS**
  (`tokens.css`) : un nouveau thème ne changerait que ce fichier.

### 4.6 Confidentialité et sécurité

- Version de notre site : aucun cookie, aucun traceur, aucune requête tierce, donc pas de
  bannière de consentement. Les versions portails (§ 3.7) embarqueront le SDK du portail, qui
  gère lui-même le consentement ; Lumirift n'ajoute jamais de traceur.
- Messages i18n précompilés au build (pas d'`eval`).
- Alertes `npm audit` (12/10/2026) : 5 alertes « high » sur `braces`, dépendance de
  l'outillage de développement uniquement (lint, plugin i18n), sans entrée non fiable ; rien
  n'est livré au joueur. À réévaluer à chaque mise à jour.

### 4.7 Compatibilité

Navigateurs evergreen des deux dernières années (Chrome, Edge, Firefox, Safari iOS 16+,
Chrome Android). Cible de compilation ES2022.

### 4.8 Référencement et partage (livrés au lot 11)

- Titre et description traduits suivant la langue ; `<html lang>` suit le réglage.
- **Open Graph** et carte Twitter (image 1200 × 630, `public/og-image.png`, langues de
  partage), **données structurées** schema.org `VideoGame` (gratuit, trois langues), contenu
  `<noscript>` décrivant le jeu, manifeste web et icônes 180 / 192 / 512 px.
- L'adresse du site n'est connue qu'au déploiement : `SITE_URL` au build ajoute le lien
  canonique, les adresses absolues de partage, `sitemap.xml` et sa mention dans
  `robots.txt`. Sans elle, le build reste portable (portails, sous-dossiers).
- Une seule adresse pour les trois langues (langue choisie sur l'appareil) : pas de
  `hreflang`, le français est la langue de référence pour les robots.

## 5. Architecture technique

### 5.1 Pile

- **Vue 3** (branche 3.5, branche majeure maintenue ; Vue 2 n'est plus supporté depuis
  fin 2023 — Vue ne publie pas de branche « LTS » formelle, la 3.x en tient lieu).
- **TypeScript** strict, **Vite**, **vue-i18n** (messages précompilés).
- Qualité : ESLint (règles typées strictes), Prettier, `vue-tsc`, Vitest, Playwright.

### 5.2 Principes orientés objet

- **Moteur pur** (`src/engine/`), sans dépendance à Vue ni au DOM : entièrement testable.
- **Une classe = une responsabilité** : `Board` (grille), `Piece` (pièce active), `Bag`
  (tirage), `Scoring`, `GravityCurve`, `Game` (orchestration et état).
- **Polymorphisme plutôt que `switch`** : chaque mode est une stratégie implémentant
  l'interface `GameMode` ; un registre les expose à l'interface.
- **Dépendre d'abstractions** : horloge, aléatoire (`RandomSource` à graine), stockage
  (`KeyValueStorage`), partage (`ShareService`).
- **Événements typés** : le moteur publie (`clear`, `levelUp`, `over`…), l'interface
  s'abonne (annonces, animations, sons).
- Classes `final` dans l'esprit (non dérivées), champs `private` / `readonly` par défaut.
- Vue sert à l'**affichage** : composants minces, logique réutilisable en composables.

### 5.3 Moteur (livré au lot 1)

```
src/engine/
  core/     Emitter (événements typés), Random (RandomSource, SeededRandom à graine)
  pieces/   PieceType et Tone, Shapes (orientations SRS, décalages muraux), Piece, Bag
  board/    Board : grille, collisions, lignes (pureté), déchets, renversement
  rules/    Scoring, GravityCurve
  game/     Game (partie), GameEvents
  modes/    GameMode (contrat), AbstractMode (comportement par défaut), ClassicMode
```

- `Piece` est un **objet valeur immuable** : un déplacement crée une nouvelle pièce, gardée
  seulement si le puits l'accepte.
- Le puits stocke des **tons** (`Tone`), jamais des couleurs : le rendu associe chaque ton
  à un jeton CSS du thème.
- `Game` expose des **méthodes d'intention** pour le joueur (`moveLeft`, `rotate`,
  `hardDrop`, `hold`, `useAbility`) et des **points d'extension** pour les modes
  (`raiseGarbage`, `flipWell`, `finish`). Un mode ne modifie jamais la grille directement.
- Contrat `GameMode` : graine (`createRandom`), couleur d'une pièce (`toneFor`),
  abonnement (`attach`), évolution dans le temps (`update`), capacité spéciale
  (`useAbility`), indicateurs du HUD (`indicators`), valeur classée (`resultValue`).
  `AbstractMode` fournit les comportements par défaut : un mode ne surcharge que sa
  mécanique propre.
- Délai de verrouillage : il démarre à l'image qui **suit** l'atterrissage, jamais pendant
  l'image où la pièce touche le sol.

### 5.4 Familles de jeux (décidé en v0.3)

Avec le Sable, la Mosaïque et la Tour, Lumirift réunit plusieurs jeux. L'architecture passe
à deux niveaux :

1. **`GameSession`** : contrat commun à toutes les familles, le seul que connaît l'écran de
   jeu. Il porte le cycle de vie (`start`, `pause`, `resume`, `update`), les intentions du
   joueur sous forme de **commandes** (objets `Command` propres à chaque famille, traduites
   depuis le clavier, le tactile ou la souris par un `InputMapper` de la famille), un
   **modèle de rendu** lu par le `Renderer` de la famille, les indicateurs du HUD, le
   résultat et les événements communs (`clear`, `over`…), pour les annonces et les meilleurs
   scores.
2. **Familles** : chacune fournit son moteur, son rendu et ses commandes, et ses modes sont
   des stratégies de ce moteur.

| Famille   | Moteur                                          | Rendu                          |
| --------- | ----------------------------------------------- | ------------------------------ |
| Chute     | `Game` + `GameMode` (lot 1), puits paramétrable | Canvas 2D, grille              |
| Sable     | Automate cellulaire de grains, zones connexes   | Canvas 2D au pixel (ImageData) |
| Placement | Grille 8 × 8 sans gravité, pièces, jokers       | Canvas 2D + glisser-déposer    |
| Volume    | Moteur Chute avec bord qui boucle (cylindre)    | Canvas 2D, projection cylindre |

- Un **registre des modes** décrit chaque mode (identifiant, famille, clé de traduction,
  type de résultat, éligibilité au défi du jour) et **charge sa famille à la demande**
  (`import()` dynamique) : un module par famille dans le build.
- Les jokers de la Mosaïque sont des **stratégies** (`Joker` : `canUse`, `use`) ; les
  éléments du Sable (eau, feu, vent) aussi. Ajouter un joker ou un élément ne touche pas le
  moteur.
- L'IA du Duel est un **joueur** qui envoie des commandes à sa propre `Game` : elle passe
  par la même interface que le joueur humain, sans accès privilégié.
- Le puits de la famille Chute devient **paramétrable** (largeur, hauteur, bord qui boucle)
  pour la Bascule (12 × 12) et la Tour (20 colonnes en anneau).

### 5.5 Session et registre (livrés au lot 2)

```
src/
  core/               Emitter, Random : briques partagées par toutes les familles
  session/            ModeId, GameSession (contrat), ModeCatalog (registre), DailyChallenge
  families/falling/   index.ts (point d'entrée du module), FallingSession, moteur du lot 1
    modes/            AbstractMode, ClassicMode, TideMode, FlipMode, ChromaMode, MirrorMode
```

- **Commandes** : union discriminée par famille (`{ type: 'move', direction: -1 }`,
  `{ type: 'hardDrop' }`…). `FallingSession` les résout par une **table de traitements**
  typée, sans `switch`.
- **`FallingView`** : vue en lecture seule de la partie (puits, pièce, réserve, aperçu,
  distance de chute) pour le rendu ; le rendu ne peut pas agir sur la partie.
- **Événements communs** : `state`, `clear`, `levelUp`, `notice`, `over`. Les événements
  propres au moteur (renversement, reflet, annonces des modes) deviennent des `notice` dont
  l'identifiant est une clé de traduction (`notice.mirrorSoon`, `notice.reflexBonus`…).
- **Indicateurs** : score, lignes et niveau d'abord (précédés du temps pour un mode classé
  au temps), puis ceux du mode (`charges`, `nextRise`, `mirrorIn`…), chacun avec son format
  (`count` ou `duration`). Le HUD n'a besoin d'aucun cas particulier par mode.
- **Patron de méthode** dans `AbstractMode` : la limite de temps et ses indicateurs sont
  gérés une fois pour toutes ; un mode ne surcharge que `tick` (évolution dans le temps) et
  `ownIndicators`.
- Le moteur reçoit trois nouveaux points d'extension : `mirrorWell` (reflet), `awardPoints`
  (bonus annoncé) et `notify` (annonce).
- `ModeCatalog` charge la famille par `import()` : le module Chute est un chunk séparé du
  build, téléchargé au premier lancement d'un de ses modes.

### 5.6 Interface (livrée au lot 3)

```
src/
  main.ts, App.vue       Création des services, i18n, écran courant (accueil ou partie)
  app/                   AppServices (conteneur injecté), FrameClock (boucle), useFormat (Intl)
  services/              KeyValueStorage (navigateur + repli mémoire), SettingsService,
                         ThemeController, ScoreBoard, ShareService
  i18n/                  locales.ts (langues, détection), index.ts (instance), locales/*.json
  ui/                    stages.ts, components/ (réglages, HUD, pause, fin), screens/ (menu, jeu),
                         hub/ (pages du menu, art des gemmes, scène, faille)
  families/falling/
    render/              TonePalette (jetons CSS), CrystalSprites, FallingRenderer, PieceRenderer
    input/               FallingInput (clavier et boutons, répétition), WellGestures (gestes)
    ui/                  FallingStage, PiecePreview, TouchControls
```

- **Écran de jeu générique** (`GameScreen`) : il crée la session par le registre, fait
  tourner la boucle, gère pause, reprise, fin de partie, records, partage et annonces. Le
  **plateau** propre à chaque famille (`FallingStage`) est choisi par `stageFor(famille)` et
  chargé avec elle ; il reçoit la session, l'horloge, l'état actif et la pièce fantôme.
- **Une seule boucle** (`FrameClock`) : la simulation avance d'abord, puis la famille traite
  la répétition des touches et dessine. Un pas est plafonné à 100 ms : après un blocage, le
  jeu ralentit au lieu de sauter.
- **Rendu Cristal** : chaque couleur est dessinée une fois en sprite facetté (quatre biseaux
  éclairés en haut à gauche, reflet, motif gravé), à la taille exacte d'une case en pixels de
  l'écran ; une image coûte alors un `drawImage` par bloc. Les couleurs viennent des jetons
  CSS : changer de thème relit la palette et redessine les sprites.
- **Motifs gravés** par couleur (point, barre, triangle, anneau, croix…), les quatre plus
  distincts réservés aux couleurs de Chroma : la couleur ne porte jamais seule l'information.
- **Commandes** : les appareils ne signalent que des **actions** (`left`, `hardDrop`…) ;
  `FallingInput` les traduit en commandes et gère seul la répétition (170 ms, puis 50 ms).
  Gestes (`WellGestures`), reçus par tout l'écran de jeu (`useGameSurface`) : glisser d'une
  case par case, toucher pour tourner, toucher à deux doigts pour l'autre sens, glisser vite
  vers le bas pour la chute instantanée ou vers le haut pour la réserve, glisser lentement pour
  la chute douce. Boutons tactiles seulement sur écran tactile et sur demande (réglage
  « Commandes », 1.7).
- **Chute instantanée animée** (1.7) : les règles verrouillent la pièce aussitôt ; seule
  l'image la montre tomber (`fallMs`, 90 à 230 ms, en accélérant), la retire du tas jusqu'à
  l'atterrissage et diffère d'autant la fissure, les points et le son. Pas en Rythme (les
  atterrissages y sonnent sur le temps) ni avec les effets sobres.
- **Effacement** (1.7) : la faille part du centre de la pièce qui a complété la ligne ; chaque
  brique s'éclaire et se fissure depuis son point de rupture, puis éclate en éclats découpés
  le long de ces fissures, qui gardent l'image de la brique (motif de canevas transformé, sans
  découpage coûteux).
- **Menu** (1.8, `HubScreen`) : quatre pages dans une piste qui glisse (`useSwipe` : un
  glissement ne compte qu'une fois clairement horizontal, et avale le clic qu'il aurait
  produit) ; onglets au modèle WAI-ARIA (flèches, activation automatique), pages inactives
  `inert`. Les tailles suivent la boîte du menu (unités de conteneur `cqw`/`cqh`), pas la
  fenêtre. Les illustrations (`GemArt`) et la scène de l'accueil (`HubScene`) utilisent le
  code de rendu des gemmes, chargé après le premier affichage ; la scène ne tourne que
  visible. `RiftWipe` couvre le changement d'écran, précharge (`ModeCatalog.preload`,
  `preloadStage`) puis se retire une fois le nouvel écran peint.
- **Fenêtres** (1.9, `ModalDialog`) : la boîte de dialogue native (`showModal`) garde le
  focus, Échap et l'arrière-plan inerte ; ouverte, c'est une grille dont les éléments sont la
  ligne de titre et chaque bloc de contenu, et chaque fenêtre y place ses colonnes en paysage.
  Fermeture animée (200 ms) avant `close()` ; à l'ouverture, 350 ms pendant lesquels touchers,
  Entrée et Espace sont ignorés. Résultats : `useCountUp` (le résultat défile, valeur finale
  lue par les lecteurs d'écran) et `useXpReveal` (la barre se remplit, franchit un niveau,
  repart de zéro). Mouvements réduits : tout apparaît à sa place, sans délai.
- **Pause automatique** quand l'onglet est masqué ou perd le focus ; mettre en pause relâche
  la chute douce (une touche tenue ne fait pas tomber la pièce à la reprise).
- **Thème sans flash** : un court script dans `index.html` pose `data-theme` avant le premier
  affichage, à partir du réglage enregistré ou du système.
- **Langue** : détectée au premier lancement (l'ancien code `in` vaut indonésien), changée à
  chaud ; `lang`, titre et description de la page suivent.
- **Records** arrondis (points ou millisecondes entiers), clés `mode` ou `daily:AAAAMMJJ`.

### 5.7 Mesures

| Mesure (build de production)               | Mobile  | Bureau  |
| ------------------------------------------ | ------- | ------- |
| Lighthouse Performance                     | 100     | 100     |
| Lighthouse Accessibilité                   | 100     | 100     |
| Lighthouse Bonnes pratiques                | 100     | 100     |
| Lighthouse SEO                             | 100     | 100     |
| JavaScript initial (compressé)             | 54,5 Ko | 54,5 Ko |
| Module de jeu (écran + famille, compressé) | 13,4 Ko | 13,4 Ko |

Après le lot 4 (effets, son, vibrations) : Lighthouse toujours **100** dans les quatre
catégories, mobile et bureau ; JavaScript initial **56,5 Ko** compressés ; module de jeu
**18,3 Ko** compressés. Pendant une destruction de 4 lignes avec renversement, dans le
navigateur intégré : **12,1 ms** par image en moyenne, **12,4 ms** au pire.

- Lighthouse 13 ajoute une catégorie expérimentale, « Agentic Browsing » (50) : hors des
  quatre catégories exigées, elle est affichée à titre indicatif par `npm run lighthouse`.
- Sur ce poste, le Chromium de Playwright ne peut pas être lancé par Node (`spawn UNKNOWN`) ;
  le script utilise le Chrome installé (variable `CHROME_PATH` pour en imposer un autre).
- Vérifié dans le navigateur : 320, 375 et 853 px de large sans défilement horizontal,
  boutons ≥ 44 px, thèmes clair et sombre à chaud, passage en français à chaud, pause,
  fin de partie et record, commandes tactiles (Marée).

### 5.8 Effets, son et vibrations (livrés au lot 4)

```
src/fx/                 Socle partagé par toutes les familles
  ParticlePool          Particules en tableaux typés (structure de tableaux), aucune allocation
  AdaptiveQuality       Budget de particules selon la fluidité mesurée
  ScreenShake, FlashLimiter, EffectsProfile, sounds (recettes synthétisées)
src/services/audio/     AudioEngine (contexte, volume, veille), Synth (oscillateurs, bruit filtré)
src/services/Haptics    Vibrations, absentes sans erreur là où l'API n'existe pas
src/families/falling/
  fx/FallingEffects     Metteur en scène : écoute le moteur, simule les effets en cases
  fx/FallingSoundscape  Sons et vibrations, en phase avec l'image
  render/EffectsPainter Dessine l'état des effets
  render/WellDecor      Décors propres à un mode (eau de la Marée), par polymorphisme
```

- **Séparation stricte** : le moteur publie des événements (`hardDrop`, `move`, `rotate`,
  `clear` avec les rangées et leurs tons…) ; `FallingEffects` les transforme en état
  (fissures, décalages de rangées, particules) ; `FallingRenderer` et `EffectsPainter` ne
  font que dessiner. Le plateau n'accède au moteur qu'en **lecture** (`onGame`).
- **Unités** : tous les effets sont simulés **en cases**, pas en pixels : un redimensionnement
  ou un écran haute densité ne déforme rien.
- **Rangées pondérées** : à l'effacement, le moteur a déjà tassé la pile ; les effets
  redessinent chaque rangée à sa place d'origine (décalage négatif), la retiennent le temps
  de la fissure, puis la laissent tomber sous gravité avec un rebond amorti.
- **Collisions des éclats** avec la pile réelle (cases occupées et immobiles) et le fond.
- **Moments du puits** (renversement, miroir) en animations CSS du canvas, coupées hors du
  profil « Complets ».
- Correctif du lot 3 : le plateau est désormais **recréé à chaque partie** (clé par partie) ;
  avant, « Rejouer » gardait l'affichage de la partie précédente.

### 5.9 Modes avancés (livrés au lot 5)

- **Contrat `GameMode` étendu**, avec des valeurs par défaut dans `AbstractMode` (les modes
  existants ne changent pas) : `well` (taille du puits, 10 × 20), `clearsLines`,
  `scoresDrops`, `afterLock` (réaction après chaque pose), `clearMultiplier`
  (multiplicateur des lignes), `subtitleKey` (sous-titre de la partie).
- **Nouvelles opérations du puits** : `settle` (chute de chaque colonne), `rotateLeft`
  (quart de tour d'un puits carré), `findGroups` (groupes de même couleur reliés),
  `removeCells`.
- **Nouveaux points d'extension de `Game`** : `fuse`, `tiltWell`, `adjustScore`, `beat`,
  `groove`, et les événements correspondants (`fusion`, `tilt`, `beat`, `groove`). Un mode
  ne touche toujours jamais la grille directement.
- **Fusion** n'hérite pas de Chroma (une fusion n'est pas une couleur pure) : les deux
  partagent le tirage des couleurs par une fonction (`randomChromaTone`), par composition.
- **Décors par mode** (`WellDecor`) : eau de la Marée, contour de la Silhouette. Le rendu ne
  connaît pas les modes ; il reçoit le décor du mode.
- **Date du jour** transmise à la session (`SessionOptions.today`) pour la silhouette du jour.
- Nouveaux formats d'indicateur : `percent` (forme remplie).

### 5.10 Duel et IA (livrés au lot 6)

```
src/families/falling/
  ai/BoardFeatures      Mesure d'un puits : hauteurs, trous, irrégularité
  ai/PlacementSearch    Tous les placements atteignables, simulés sur une copie du puits
  ai/Evaluator          Note d'un placement (pondérations de référence)
  ai/AiPlayer           Joueur IA : choisit, « réfléchit », puis joue coup par coup
  modes/DuelMode        Un camp : attaques, annulation, rangées reçues différées
  DuelSession           Deux parties reliées, une seule session pour l'écran
  ui/DuelStage          Le plateau habituel du joueur + OpponentWell (vignette)
```

- **Composition** : `DuelSession` contient deux `FallingSession` (joueur et IA) ; le plateau du
  duel réutilise tel quel celui de la famille Chute pour le joueur, et y insère la vignette
  adverse par un emplacement (`slot`) prévu sous la réserve.
- **Équité** : l'IA ne lit que ce qu'un joueur voit (`FallingView`) et n'agit que par
  `execute` ; sa graine d'aléatoire est distincte de celle des pièces.
- **Plateau par mode** : `stageFor` cherche d'abord un plateau propre au mode (le duel), puis
  celui de la famille.
- **Variantes** : un mode peut proposer des variantes (`variants`, `defaultVariant`) choisies
  avant la partie dans une fenêtre dédiée ; la variante est transmise à la session
  (`SessionOptions.variant`).
- `createFallingSession` renvoie une session générique (solo ou duel) ; `createSoloSession`
  reste disponible, typée, pour une partie seule.

### 5.11 Famille Placement (livrée au lot 7)

```
src/core/Tone, src/render/TonePalette, src/render/motifs
                      Socle de couleurs partagé (sorti de la famille Chute pour l'occasion)
src/families/placement/
  engine/Shape        Forme immuable (rotation, clé), bibliothèque pondérée de 1 à 9 cases
  engine/Grid         Grille 8 × 8 : pose, lignes et colonnes, zone de bombe, aperçu
  engine/Dealer       Distribution pondérée des pièces et des glaçures
  engine/MosaicGame   Partie : main, pose, séries, jokers, retour, fin de partie
  jokers/Joker        Contrat Joker (cible, canUse, use, canHelp) et cinq stratégies
  PlacementSession    Adaptation au contrat GameSession, commandes typées
  MosaicController    Sélection, curseur clavier, joker en attente : sans DOM, testable
  render/             CeramicSprites, MosaicRenderer
  fx/                 MosaicEffects (rebonds, fissures, tessons), MosaicSoundscape
  ui/                 MosaicStage (plateau, main, jokers, glisser-déposer), HandPiece
```

- **Jokers en stratégies** : chacun déclare sa cible (aucune, une pièce, une case), sait s'il
  est utilisable et s'il peut **débloquer** une partie ; la partie n'a aucun `switch` sur les
  jokers. En ajouter un ne touche ni la partie ni l'interface.
- **Le contrôleur** centralise les choix entre deux coups ; le doigt, la souris et le clavier
  passent tous par lui, donc se comportent pareil.
- Le moteur de la Mosaïque est un module chargé à la demande (environ 3 Ko compressés,
  plus 7,6 Ko pour son plateau) : l'accueil ne grossit pas.
- Leçon retenue (deux fois : vignette du Duel, plateau de la Mosaïque) : un canvas mesure
  300 × 150 px par défaut et peut élargir son conteneur avant le premier calcul ; tout
  conteneur de canvas dimensionné par mesure reçoit `min-width: 0` et le canvas
  `max-width: 100%`.

### 5.12 Famille Sable (livrée au lot 8)

```
src/families/sand/
  engine/SandGrid     Grains en tableaux typés : chute, glissement, eau, feu, vent ; zones
                      reliant les murs (parcours en largeur sans allocation par grain)
  engine/SandPiece    Pièce rigide en grains, formes de la famille Chute
  engine/SandGame     Partie : gravité, pose, désagrégation, pas fixe, brûlures, zones,
                      éléments, vent annoncé, niveaux
  SandSession         Contrat commun ; parle les commandes de la famille Chute
  render/SandRenderer Rendu au pixel : une image de 60 × 120 agrandie sans lissage, couleurs
                      précalculées (ton × nuance × texture) écrites dans un Uint32Array
  fx/                 SandEffects (paillettes, braises, poussière, vent), SandSoundscape
  ui/                 SandStage, SandPreview
```

- **Réutilisation assumée** de la famille Chute : formes, rotations et sac de pièces,
  courbe de vitesse, clavier (`FallingInput`), gestes (`WellGestures`) et boutons tactiles
  (`TouchControls`, dont la réserve devient optionnelle). Ce sont des modules purs, partagés
  par le build ; le Sable ne dépend d'aucune partie de jeu de la Chute.
- Nouveaux tons du socle partagé : **eau** et **feu** (couleurs et motifs dans les deux thèmes).

### 5.13 Famille Volume (livrée au lot 9)

```
src/families/volume/
  index.ts              Point d'entrée : une FallingSession de la famille « volume »
  TowerMode             Mode du moteur Chute : puits de 20 × 16 qui boucle
  camera/TowerCamera    Position de la caméra en colonnes : suit la pièce, rotation à la
                        main, chemin le plus court
  camera/CylinderProjection  Projection du cylindre (pure, testée) : angle, écran,
                        profondeur, ombre, reflet, transformation affine d'une face
  render/GlassSprites   Blocs de verre teinté précalculés par couleur
  render/TowerRenderer  Dos de la tour, gravure, pile, pièce, effets projetés
  ui/TowerStage         Plateau : commandes de la Chute, caméra au clavier et à deux doigts
```

- **Le moteur ne connaît pas le cylindre** au-delà d'une option : `WellSize.wraps`. Le
  `Board` replie alors les colonnes (`column(x)`), sans murs ; tout le reste (rotation,
  lignes, points, réserve, fantôme) est celui de la Chute. Les particules font le tour
  (`ParticleWorld.wraps`).
- **Effets et sons réutilisés** : `FallingEffects` calcule en cases, `TowerRenderer` les
  projette. Seul le rendu change d'une famille à l'autre.
- Le délai d'effacement des lignes vit dans `rules/Timings`, pour que le module de la Tour
  ne charge pas tous les modes de la Chute.

### 5.14 Séparation du rendu et des règles

- Les règles (`engine`, `board`, `game`, `modes`, `session`) n'importent jamais le rendu,
  les effets, les sons ni Vue : vérifié sur tout le code au lot 9.
- **Toutes les couleurs de matière viennent des jetons CSS** (`tokens.css`, thèmes clair et
  sombre), lues par `TonePalette` : tons des pièces, puits, accents, braises et cendre du
  feu, argile de la Mosaïque. Seules restent dans le code la lumière et l'ombre neutres
  (blanc et noir translucides) des matières.
- Retoucher l'esthétique se fait donc à trois endroits, sans toucher aux règles : les
  jetons, les sprites d'une famille (`CrystalSprites`, `CeramicSprites`, `GlassSprites`,
  textures du Sable) et ses effets (`*Effects`, `*Soundscape`).

### 5.15 Progression (livrée au lot 10)

```
src/progression/
  GameReport      Bilan d'une partie (mode, durée jouée, effacements, combo…) ; GameTracker
                  le tire des événements communs à toutes les familles
  Experience      Barème de l'expérience, courbe des niveaux
  Objectives      Objectifs du jour : une règle par sorte (stratégies), tirage par la date
  Cosmetics       Catalogue des objets et règles de déblocage
  Profile         Entité : recordGame, objectivesFor, equip, markSeen ; protège ses règles ;
                  newCosmetics (objets gagnés pas encore vus, 1.9 ; une ancienne
                  sauvegarde compte comme vu ce qu'elle avait déjà gagné)
src/services/
  ProfileService  Profil réactif, sauvegardé sur l'appareil
  AmbianceController  data-ambiance et data-motion sur <html>
src/families/falling/
  render/BlockSprites  Classe de base des matières (cache par ton, motif gravé)
  render/materials     Cristal, Néon, Papier, Pixel, Obsidienne, Or
  fx/ShatterStyles     Signatures de bris (couleur, rotation, envol des éclats)
src/styles/ambiances.css  Lueurs par ambiance et par thème
src/ui/  ProfileCard, AtelierDialog (chargé à la demande), bilan dans GameOverDialog
```

- La progression ne connaît aucune famille : elle lit le contrat commun (`GameSession`).
- Toutes les couleurs nouvelles (or, pétales, lueurs) sont des **jetons** des deux thèmes.

### 5.16 Campagne (livrée en 1.1)

```
src/session/Boosts.ts      Aides portées par SessionOptions (campagne seulement)
src/campaign/
  Levels       Les 30 niveaux (données) et leurs règles d'étoiles
  Goals        Une règle par sorte d'objectif (progression, réussite en jeu, à la fin)
  CampaignRun  Arbitre pur d'une partie : progression, réussite, étoiles
  Upgrades     Les dix améliorations (rangs → Boosts), coûts
  CampaignProgress  Entité : niveaux ouverts, meilleures étoiles, achats, remboursement
src/services/CampaignService.ts   Campagne réactive, gardée sur l'appareil
src/ui/  CampaignScreen, UpgradesDialog, CampaignCard, CampaignGoal, StarRow,
         ModeCarousel, ModeArt, PlayerBar, ObjectivesCard
```

- Chaque moteur lit les `Boosts` qui le concernent (vitesse de chute, aperçu, délai de pose,
  bonus de points, seconde chance, jokers de départ, feu, fenêtre du Rythme, délai des
  rangées reçues) ; sans `Boosts`, il joue exactement comme avant.
- L'écran de jeu suit l'objectif à chaque image (`GameTracker` + résultat de la session) ;
  la campagne ne connaît aucune famille.

## 6. Qualité et tests

- **Tests unitaires** (Vitest, plus de 280) : moteurs et règles de chaque famille, chaque
  mode, IA (vitesses et comportements par niveau), effets, services, progression, parité des
  clés de traduction (fichiers lus bruts) et présence d'un libellé pour chaque mode,
  indicateur, annonce et fin de partie.
- **Tests de bout en bout** (Playwright, `e2e/`) sur le build de production, Chrome
  installé, en **mobile (390 × 844) et bureau (1280 × 800)** : accueil, ouverture, pause,
  reprise et sortie des 13 modes, partie complète au clavier jusqu'au record, défi du jour,
  Mosaïque au clavier, langue et thème retenus, Atelier, console sans erreur, navigation au
  clavier seul, aucun défilement horizontal de 320 à 1920 px.
- **Audits d'accessibilité** axe-core WCAG 2.2 AA (§ 4.3).
- **Lighthouse** mobile et bureau : 100 dans les quatre catégories (`npm run lighthouse`).
- `npm run verify` (lint, format, types y compris des tests e2e, tests, build) avant
  chaque commit ; l'intégration continue (`.github/workflows/ci.yml`) rejoue `verify`,
  `test:e2e` et `lighthouse` à chaque envoi.

## 7. Conventions Git

- Dépôt autonome, branche `main` stable ; une **branche par lot** (`feat/…`, `chore/…`),
  fusionnée en `--no-ff` pour garder l'historique des lots lisible.
- Commits _Conventional Commits_ en français ; code et commentaires en anglais.
- Chaque version : entrée dans `CHANGELOG.md` (Keep a Changelog) et version de
  `package.json`.

## 8. Critères d'acceptation

1. Les quatorze modes sont jouables du début à la fin, au clavier et au tactile.
2. Lighthouse ≥ 95 dans les quatre catégories (mobile, build de production de notre site).
3. Aucun défilement horizontal de 320 à 1920 px ; le puits reste entièrement visible.
4. Les trois langues sont complètes ; changer de langue ne recharge pas la page.
5. Le thème sombre s'applique sans flash au chargement.
6. Les destructions décrites au § 3.5 tiennent 60 images/s sur un téléphone d'entrée de
   gamme (qualité adaptative comprise).
7. `npm run verify` et `npm run test:e2e` passent.

**État à la 1.0** : critères 1 à 5 et 7 vérifiés par les tests automatiques (le tactile, en
plus, dans le navigateur à 375 px). Critère 6 : mesuré sur ordinateur (Sable chargé :
6,2 ms par image ; Tour à la cadence de l'écran) ; la mesure sur un téléphone d'entrée de
gamme reste à faire sur un appareil réel.

## 9. Lots et planning

Tous les modes sortent ensemble en **version 1.0** (décision du 12/10/2026). Les lots sont
ordonnés pour qu'une version **jouable** existe dès le lot 3, puis s'enrichisse.

| Lot | Contenu                                                                                                    | Statut                 |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| 0   | Cadrage, outillage, cahier des charges                                                                     | Livré                  |
| 1   | Moteur Chute : puits, pièces, rotation, sac, score, gravité                                                | Livré                  |
| 2   | `GameSession`, registre ; Défi du jour, Marée, Renversement, Chroma, Miroir                                | Livré                  |
| 3   | Interface Vue jouable : accueil, écran de jeu, rendu Cristal, clavier et tactile, i18n, thèmes, Lighthouse | Livré                  |
| 4   | Matière et effets : particules, destructions, moments des modes, son synthétisé, vibrations, réglages      | Livré                  |
| 5   | Chute avancée : Fusion, Bascule, Silhouette (bibliothèque), Rythme                                         | Livré                  |
| 6   | Duel contre l'IA                                                                                           | Livré                  |
| 7   | Placement : Mosaïque (céramique) et ses cinq jokers                                                        | Livré                  |
| 8   | Sable (grains) et ses éléments                                                                             | Livré                  |
| 9   | Volume : Tour (verre courbé)                                                                               | Livré                  |
| 10  | Progression et personnalisation : expérience, objectifs, matières, ambiances, bris                         | Livré                  |
| 11  | Accessibilité complète, SEO, tests de bout en bout, documentation, 1.0.0                                   | Livré                  |
| 12  | Démo pour le portfolio (adamrodwebdev.com)                                                                 | Livré (1.3)            |
| 13  | Versions portails : abstraction `Platform`, SDK, builds, fiches de présentation                            | CrazyGames livré (1.2) |
| 14  | Campagne (30 niveaux), dix améliorations, nouvel accueil et carrousel des modes                            | Livré                  |

Lighthouse est mesuré à **chaque lot** à partir du lot 3 : aucune régression sous 95.

## 10. Hors périmètre (v1)

Comptes et classements en ligne, multijoueur en ligne, manette. La monétisation (publicités,
achats) arrive avec les versions portails, après la 1.0 (§ 3.7). Voir § 11.

## 11. Évolutions envisagées

- Classement du défi du jour (nécessite un service distant et une politique anti-triche).
- Duel en ligne (envoi de rangées à l'adversaire).
- IA du duel au niveau adaptatif (±0,1 pièce par seconde après chaque victoire ou défaite,
  niveau toujours affiché).
- Sable : une bombe de sable (effacement d'un rayon d'une case et demie), seul élément
  éprouvé par les jeux mobiles du genre.
- Prise en charge de la manette.
- Application installable (PWA).

## 12. Journal des versions du document

| Version | Date       | Changements                                                                                                                                                       |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1     | 12/10/2026 | Création : cadrage complet, lot 0.                                                                                                                                |
| 0.2     | 12/10/2026 | Lot 1 : architecture du moteur (§ 5.3), équilibrage du Renversement, précision sur les allocations.                                                               |
| 0.3     | 12/10/2026 | Atelier des modes : 14 modes en 4 familles (§ 3.2), architecture `GameSession` (§ 5.4), lots 2 à 9.                                                               |
| 0.4     | 12/10/2026 | Lot 2 : Défi du jour transversal, précisions Marée, Renversement, Miroir ; session et registre (§ 5.5).                                                           |
| 0.5     | 12/10/2026 | Direction artistique et son (§ 3.5), personnalisation commerciale (§ 3.6), distribution : démo portfolio et portails après la 1.0 (§ 3.7) ; lots 3 à 13.          |
| 0.6     | 12/10/2026 | Lot 3 : interface (§ 5.6), mesures Lighthouse et budget (§ 5.7), tests de l'interface (§ 6).                                                                      |
| 0.7     | 12/10/2026 | Lot 4 : effets réalisés et profils (§ 3.5), délai après effacement (§ 3.1), architecture des effets (§ 5.8), mesures (§ 5.7).                                     |
| 0.8     | 12/10/2026 | Lot 5 : règles détaillées de Fusion (seuil porté à 6), Bascule (sens corrigé), Silhouette, Rythme ; architecture des modes avancés (§ 5.9).                       |
| 0.9     | 12/10/2026 | Lot 6 : règles et niveaux du Duel (§ 3.2), architecture du duel et de l'IA (§ 5.10).                                                                              |
| 0.10    | 12/10/2026 | Lot 7 : règles complètes de la Mosaïque et de ses jokers (§ 3.2), famille Placement et socle de couleurs partagé (§ 5.11).                                        |
| 0.11    | 12/10/2026 | Lot 8 : règles complètes du Sable et de ses éléments (§ 3.2), famille Sable (§ 5.12).                                                                             |
| 0.12    | 12/10/2026 | Lot 9 : règles et caméra de la Tour (§ 3.2), famille Volume (§ 5.13), séparation du rendu et des règles (§ 5.14).                                                 |
| 0.13    | 12/10/2026 | Règles des éléments du Sable, de la Mosaïque et cinq niveaux d'IA, fondés sur une recherche des jeux du genre (§ 3.2).                                            |
| 0.14    | 12/10/2026 | Lot 10 : progression et personnalisation (§ 3.6), architecture (§ 5.15) ; musique d'ambiance non retenue pour la 1.0.                                             |
| 1.0     | 12/10/2026 | Lot 11 : accessibilité vérifiée (§ 4.3), référencement et partage (§ 4.8), tests de bout en bout et CI (§ 6), état des critères d'acceptation (§ 8). Version 1.0. |
| 1.1     | 13/10/2026 | Campagne et dix améliorations (§ 3.2 bis, § 5.16), nouvel accueil et carrousel des modes (§ 3.2 ter).                                                             |
| 1.2     | 13/10/2026 | Version CrazyGames : abstraction `Platform`, build, médias et contrôle des exigences (§ 3.7, CRAZYGAMES.md).                                                      |
| 1.3     | 13/10/2026 | Lot 12 : démo du portfolio, éditions complète et démo (§ 3.7).                                                                                                    |
| 1.4     | 14/10/2026 | Identité « Rift » (§ 3.8), première partie guidée, musique, Playgama (§ 3.7, PLAYGAMA.md), sans Échap ni Ctrl.                                                    |
| 1.5     | 14/10/2026 | Nouveau nom : Lumirift (§ 3.9), vérification des marques et des domaines.                                                                                         |
| 1.6     | 15/10/2026 | Publicités : pub récompensée facultative (doubler l'XP), interstitiel à toute sortie de fin de partie (§ 3.7).                                                    |
| 1.7     | 20/10/2026 | La partie au doigt : gestes partout, boutons sur demande (§ 3.3), écran de jeu sans en-tête ni défilement, paysage (§ 4.2), chute et effacement animés (§ 5.6).   |
| 1.8     | 20/10/2026 | Le menu à onglets : Accueil, Modes, Carte, Atelier sans défilement, glissement, rail en paysage, transition de la faille (§ 3.2 ter, § 5.6).                      |
| 1.9     | 20/10/2026 | Les fenêtres en feuilles sans défilement, résultats mis en scène, garde à l'ouverture (§ 4.2, § 5.6).                                                             |
| 1.10    | 20/10/2026 | Prêt pour CrazyGames : 1-1 calme, touches dessinées, console centrée, pubs par portail (§ 3.7), vidéos refaites.                                                  |
| 1.11    | 21/10/2026 | Couleurs des pièces loin du standard du genre (§ 2), menus inchangés, médias refaits.                                                                             |
