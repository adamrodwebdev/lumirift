# Cahier des charges — Stackrift

| Version | Date       | Statut                        |
| ------- | ---------- | ----------------------------- |
| 0.3     | 12/10/2026 | Périmètre des 14 modes validé |

Document vivant : il est mis à jour à chaque étape livrée (voir § 12, journal).

---

## 1. Contexte et objectifs

Le jeu de blocs qui tombent est l'un des genres les plus joués au monde. Tout le monde en
connaît les règles, mais l'offre web gratuite se résume le plus souvent à des clones du mode
« Marathon ». **Stackrift** part de ces règles connues et ajoute des **modes de jeu inédits**
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
- **Aucun compte, aucun traceur, aucune bannière de cookies** : rien ne s'interpose entre le
  joueur et la partie.

### 2.3 Nom et propriété intellectuelle

- Le nom « Tetris », ses déclinaisons et le vocabulaire déposé (« Tetrimino »…) ne sont
  **jamais utilisés** : marques détenues par The Tetris Company. Le jeu dit « pièce » et
  « ligne ».
- Les règles d'un jeu ne sont pas protégeables, mais **l'apparence** l'est (jurisprudence
  _Tetris Holding v. Xio Interactive_, 2012) : Stackrift utilise sa **propre palette**, son
  propre habillage du puits et ses propres noms de modes.
- Nom de travail : **Stackrift** (« la faille dans la pile »), prononçable dans les trois
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
- Score des lignes, multiplié par le niveau : 1 ligne 100, 2 lignes 300, 3 lignes 500,
  4 lignes 800. **Combo** : +50 × combo × niveau par verrouillage consécutif qui efface.
- Niveau + 1 toutes les 10 lignes ; la gravité suit la courbe standard du genre.
- Fin de partie quand une pièce ne peut pas apparaître.

### 3.2 Modes de jeu

Quatorze modes, répartis en **quatre familles** de jeux. Une famille partage un moteur ; un
mode n'en change que la règle. Les règles communes du § 3.1 valent pour la famille **Chute**.

- **Chute** (11 modes) : Classique, Défi du jour, Marée, Renversement, Chroma, Miroir,
  Fusion, Bascule, Silhouette, Rythme, Duel.
- **Sable** : Sable (les pièces se désagrègent en grains).
- **Placement** : Mosaïque (grille sans gravité, jokers).
- **Volume** : Tour (puits cylindrique en pseudo-3D).

Noms des modes (FR / EN / ID) : Classique / Classic / Klasik · Défi du jour / Daily
Challenge / Tantangan Harian · Marée / Tide / Pasang · Renversement / Flip / Terbalik ·
Chroma · Miroir / Mirror / Cermin · Fusion / Fusion / Fusi · Bascule / Tilt / Miring ·
Silhouette / Silhouette / Siluet · Rythme / Rhythm / Ritme · Duel · Sable / Sand / Pasir ·
Mosaïque / Mosaic / Mozaik · Tour / Tower / Menara.

#### Famille Chute

| Mode             | Objectif                         | Mécanique nouvelle                                          |
| ---------------- | -------------------------------- | ----------------------------------------------------------- |
| **Classique**    | Meilleur score, sans fin         | Référence du genre                                          |
| **Défi du jour** | Meilleur score en 2 minutes      | Graine et mode du jour communs à tous, résultat partageable |
| **Marée**        | Tenir le plus longtemps possible | Des rangées montent du fond, de plus en plus vite           |
| **Renversement** | Meilleur score, sans fin         | Le joueur retourne le puits : la pile retombe, en cascade   |
| **Chroma**       | Meilleur score, sans fin         | Couleurs indépendantes des formes, lignes pures × 4         |
| **Miroir**       | Meilleur score, sans fin         | Le puits se reflète gauche-droite toutes les 10 lignes      |
| **Fusion**       | Meilleur score, sans fin         | 4 blocs de même couleur fusionnent, réactions en chaîne     |
| **Bascule**      | Meilleur score, sans fin         | Le puits pivote d'un quart de tour toutes les 10 lignes     |
| **Silhouette**   | Remplir une forme cible au mieux | Énigme : pas de lignes, une silhouette à combler            |
| **Rythme**       | Meilleur score, sans fin         | Poser sa pièce sur le temps fait grimper un multiplicateur  |
| **Duel**         | Faire déborder l'adversaire (IA) | Les lignes effacées envoient des rangées chez l'adversaire  |

Règles détaillées :

- **Défi du jour** : la graine est la date locale du joueur (AAAAMMJJ). Elle choisit aussi le
  **mode du jour** parmi les modes éligibles (Classique, Chroma, Miroir, Fusion, Rythme,
  Sable, Mosaïque), annoncé sur l'accueil (« Aujourd'hui : Sable »). Deux minutes de jeu.
  En fin de partie, le joueur partage un texte court (mode, score, date, lien) via le partage
  natif du téléphone ou, à défaut, le presse-papiers. Meilleur score conservé par jour.
- **Marée** : une rangée de déchets (un seul trou) monte du fond toutes les 10 s au départ ;
  l'intervalle diminue de 0,5 s par rangée, jusqu'à 3 s. Chaque ligne effacée retarde la
  prochaine montée de 1 s. Score principal : temps de survie.
- **Renversement** : le joueur gagne une **charge de renversement** toutes les 10 lignes
  (2 au plus, 1 au départ). Utiliser une charge retourne le puits tête en bas : chaque
  colonne de blocs retombe vers le fond, ce qui **supprime tous les trous** et peut
  provoquer des **lignes en cascade**, comptées comme un combo. Animation désactivée si
  l'utilisateur réduit les animations.
  _Équilibrage (v0.2)_ : l'essai du moteur montre que le renversement efface tous les trous
  d'un coup ; une charge toutes les 5 lignes (3 au plus) le rendait trop puissant.
- **Chroma** : chaque pièce reçoit l'une de 4 couleurs, indépendamment de sa forme. Une
  ligne effacée dont les 10 blocs sont de la même couleur est une **ligne pure** : son score
  est multiplié par 4.
- **Miroir** : toutes les 10 lignes, le puits se reflète gauche-droite : la pile entière et
  la pièce en cours (un S devient un Z, un J devient un L). Un compte à rebours de 3 s
  prévient le joueur. Une ligne effacée dans les 5 s qui suivent le reflet compte **double**
  (bonus réflexe). Les **commandes ne sont jamais inversées** : le défi vient du plateau, pas
  des doigts (choix d'accessibilité).
- **Fusion** : couleurs indépendantes des formes, comme Chroma. Après chaque verrouillage,
  tout groupe d'au moins **4 blocs de même couleur** reliés par un côté disparaît ; les blocs
  qui ne reposent plus sur rien retombent, ce qui peut former de nouveaux groupes : c'est
  une **chaîne**. Chaque maillon multiplie les points (10 points par bloc × rang de la
  chaîne × niveau). Les lignes complètes s'effacent aussi, normalement.
- **Bascule** : puits **carré de 12 × 12**. Toutes les 10 lignes, le puits pivote d'un quart
  de tour dans le sens horaire : l'ancien mur gauche devient le sol, et chaque colonne
  retombe. Une animation montre la rotation (coupée si l'utilisateur réduit les
  animations). Le sens de la rotation est annoncé 3 s avant.
- **Silhouette** : une forme cible (cœur, chat, fusée…) est dessinée dans le puits. Aucune
  ligne ne s'efface. Le joueur dispose d'un nombre limité de pièces (aire de la forme / 4,
  plus 25 %). Score : +10 par case remplie dans la forme, −20 par bloc posé hors de la forme,
  bonus de 1 000 pour une forme parfaite. Bibliothèque d'au moins 30 silhouettes (dessinées
  en texte dans le code), dont une **silhouette du jour**.
- **Rythme** : une pulsation musicale synthétisée (Web Audio, aucun fichier), 100 battements
  par minute au niveau 1, plus 5 par niveau. Une pièce posée à ± 120 ms d'un temps augmente
  le **groove** (multiplicateur × 1 à × 4) ; une pièce posée hors du temps le remet à × 1.
  Un **métronome visuel** (pulsation du cadre du puits) rend le mode jouable sans le son.
- **Duel** : le joueur affronte une IA qui joue dans un second puits (côte à côte sur grand
  écran, en vignette sur mobile). Lignes envoyées : 2 lignes → 1 rangée, 3 → 2, 4 → 4, plus 1
  par combo. Les rangées reçues attendent 1 s et peuvent être annulées en effaçant des
  lignes. L'IA évalue chaque placement possible (hauteur, trous, irrégularité, lignes) ;
  3 niveaux (Facile, Normal, Expert) jouent sur son temps de réflexion et ses erreurs
  volontaires. Victoire quand l'adversaire déborde.

#### Famille Sable

- **Sable** : les pièces tombent et se manipulent comme d'habitude, puis se **désagrègent
  en grains** au contact (6 × 6 grains par case, soit un puits de 60 × 120 grains). Chaque
  grain tombe, puis glisse en diagonale s'il est bloqué.
- Chaque pièce porte l'une de 4 couleurs. Une **zone de grains d'une même couleur, continue,
  qui relie le mur gauche au mur droit** est effacée, même si elle serpente. Points : 1 par
  grain effacé, multipliés par le nombre de zones effacées d'un coup.
- **Éléments** (pour se démarquer des jeux de sable existants) : de temps en temps, une
  pièce d'**eau** (ses grains s'infiltrent dans les creux puis se figent dans la couleur
  voisine), une pièce de **feu** (consume la couleur qu'elle touche), et des coups de
  **vent** annoncés qui poussent le sable d'un côté.
- Chaque couleur a sa **texture de grain** propre, pour rester lisible par les daltoniens.
- Fin de partie quand le sable atteint le haut du puits.

#### Famille Placement

- **Mosaïque** : grille de **8 × 8**, sans gravité. Trois pièces (formes de 1 à 9 cases)
  sont proposées ; le joueur les glisse et les dépose dans l'ordre qu'il veut. Toute ligne ou
  colonne complète s'efface. Trois nouvelles pièces arrivent quand les trois sont posées.
  Fin de partie quand aucune des pièces restantes ne rentre.
- Points : 1 par case posée ; 10 par case effacée, multipliés par le nombre de lignes et
  colonnes effacées d'un coup ; bonus de série pour les effacements consécutifs.
- **Jokers**, gagnés par les combos (2 lignes ou colonnes ou plus d'un coup, ou 3
  effacements de suite), 3 emplacements au plus, **jamais payants** :
  - **Rotation** : tourner une pièce proposée (impossible dans les jeux du genre) ;
  - **Relance** : remplacer les trois pièces proposées ;
  - **Bombe** : effacer un carré de 3 × 3 ;
  - **Retour** : annuler le dernier coup ;
  - **Cube** : une pièce d'une seule case, à poser où l'on veut.
- Jeu complet au **clavier** : 1, 2, 3 pour choisir une pièce, flèches pour la placer, Entrée
  pour la poser, J pour ouvrir les jokers.
- Mécanique libre de droits (genre partagé par de nombreux jeux) ; ni le nom ni l'apparence
  d'un jeu existant ne sont repris.

#### Famille Volume

- **Tour** : le puits s'enroule en **cylindre** de **20 colonnes** sur 16 rangées : la
  colonne 19 touche la colonne 0. La caméra tourne autour de la tour pour garder la pièce de
  face ; environ 10 colonnes sont visibles à la fois. Une ligne est un **anneau** complet de
  20 cases. Logique 2D (le moteur Chute avec un bord qui boucle), rendu en pseudo-3D sur
  canvas 2D (projection cylindrique, faces ombrées selon l'angle), sans bibliothèque 3D.
- Commandes identiques à la famille Chute ; la caméra suit automatiquement, ou se tourne à la
  main (A / E en AZERTY, Q / E en QWERTY, ou glisser à deux doigts).

### 3.3 Commandes

| Action            | Clavier                         | Tactile                          |
| ----------------- | ------------------------------- | -------------------------------- |
| Gauche / droite   | ← → (ou Q D / A D)              | Boutons, ou glisser horizontal   |
| Chute douce       | ↓ (ou S)                        | Bouton, ou glisser vers le bas   |
| Chute instantanée | Espace                          | Bouton, ou glissement rapide bas |
| Rotation horaire  | ↑ ou X                          | Bouton, ou toucher le puits      |
| Rotation inverse  | Ctrl ou W (AZERTY) / Z (QWERTY) | Bouton                           |
| Réserve           | C ou Maj                        | Bouton                           |
| Renversement      | F                               | Bouton (mode Renversement)       |
| Pause             | Échap ou P                      | Bouton                           |

Famille Placement (Mosaïque) : glisser-déposer au doigt ou à la souris (la pièce s'affiche
au-dessus du doigt pour rester visible) ; au clavier, 1 / 2 / 3 choisit une pièce, les
flèches la déplacent, Entrée la pose, J ouvre les jokers, Échap annule.

Les touches lettres se lisent par **position physique** (`KeyboardEvent.code`) : la même
position fonctionne en AZERTY et en QWERTY. Répétition automatique horizontale : délai
170 ms puis une case toutes les 50 ms.

### 3.4 Paramètres et données

- Langue (FR, EN, ID ; détection de la langue du navigateur au premier lancement).
- Thème : système, clair ou sombre.
- Pièce fantôme : oui / non.
- Meilleurs scores par mode, stockés **uniquement sur l'appareil** (`localStorage`, avec repli
  en mémoire si le stockage est indisponible). Aucune donnée ne quitte l'appareil.

## 4. Exigences non fonctionnelles

### 4.1 Performance et Lighthouse

- **Lighthouse ≥ 95** en Performance, Accessibilité, Bonnes pratiques et SEO, mesuré sur le
  build de production en profil mobile. Mesure automatisée : `npm run lighthouse`.
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
- Cibles tactiles ≥ 44 × 44 px ; aucune action réservée au survol.

### 4.3 Accessibilité

- Navigation complète au clavier, focus visible, contrastes WCAG AA dans les deux thèmes.
- Le puits est décrit (`role="img"` + libellé) ; score, niveau et événements (lignes, fin de
  partie) annoncés via une région `aria-live` polie.
- Respect de `prefers-reduced-motion` (animations coupées) et `prefers-color-scheme`.

### 4.4 Internationalisation

- Trois langues complètes : **français** (référence), **anglais**, **indonésien**. Mêmes clés
  dans les trois fichiers, vérifié par un test automatisé.
- Aucun texte en dur dans les composants (règle ESLint `vue/no-bare-strings-in-template`).
- Nombres, durées et dates formatés par `Intl` dans la langue courante ; attribut `lang` du
  document synchronisé.

### 4.5 Thèmes

- Thème clair et thème sombre ; par défaut, celui du système. Couleurs uniquement via des
  **jetons CSS** ; les couleurs des pièces sont déclinées par thème pour garder le contraste.

### 4.6 Confidentialité et sécurité

- Aucun cookie, aucun traceur, aucune requête tierce : pas de bannière de consentement.
- Messages i18n précompilés au build (pas d'`eval`).
- Alertes `npm audit` (12/10/2026) : 5 alertes « high » sur `braces`, dépendance de
  l'outillage de développement uniquement (lint, plugin i18n), sans entrée non fiable ; rien
  n'est livré au joueur. À réévaluer à chaque mise à jour.

### 4.7 Compatibilité

Navigateurs evergreen des deux dernières années (Chrome, Edge, Firefox, Safari iOS 16+,
Chrome Android). Cible de compilation ES2022.

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

Avec le Sable, la Mosaïque et la Tour, Stackrift réunit plusieurs jeux. L'architecture passe
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

## 6. Qualité et tests

- Tests unitaires du moteur : collisions, rotations et décalages muraux, effacement de
  lignes, sac de 7, score, chaque mode.
- Test de parité des clés de traduction.
- Tests de bout en bout Playwright en mobile (390 × 844) et bureau (1280 × 800).
- `npm run verify` (lint, format, types, tests, build) doit passer avant chaque commit.

## 7. Conventions Git

- Dépôt autonome, branche `main` stable ; une **branche par lot** (`feat/…`, `chore/…`),
  fusionnée en `--no-ff` pour garder l'historique des lots lisible.
- Commits _Conventional Commits_ en français ; code et commentaires en anglais.
- Chaque version : entrée dans `CHANGELOG.md` (Keep a Changelog) et version de
  `package.json`.

## 8. Critères d'acceptation

1. Les quatorze modes sont jouables du début à la fin, au clavier et au tactile.
2. Lighthouse ≥ 95 dans les quatre catégories (mobile, build de production).
3. Aucun défilement horizontal de 320 à 1920 px ; le puits reste entièrement visible.
4. Les trois langues sont complètes ; changer de langue ne recharge pas la page.
5. Le thème sombre s'applique sans flash au chargement.
6. `npm run verify` et `npm run test:e2e` passent.

## 9. Lots et planning

Tous les modes sortent ensemble en **version 1.0** (décision du 12/10/2026). Les lots sont
ordonnés pour qu'une version **jouable** existe dès le lot 3, puis s'enrichisse.

| Lot | Contenu                                                                     | Statut  |
| --- | --------------------------------------------------------------------------- | ------- |
| 0   | Cadrage, outillage, cahier des charges                                      | Livré   |
| 1   | Moteur Chute : puits, pièces, rotation, sac, score, gravité                 | Livré   |
| 2   | `GameSession`, registre ; Défi du jour, Marée, Renversement, Chroma, Miroir | À faire |
| 3   | Interface Vue, rendu, clavier et tactile, i18n, thèmes, mesure Lighthouse   | À faire |
| 4   | Chute avancée : Fusion, Bascule, Silhouette (bibliothèque), Rythme (audio)  | À faire |
| 5   | Duel contre l'IA                                                            | À faire |
| 6   | Placement : Mosaïque et ses cinq jokers                                     | À faire |
| 7   | Sable et ses éléments                                                       | À faire |
| 8   | Volume : Tour                                                               | À faire |
| 9   | Accessibilité complète, SEO, tests de bout en bout, documentation, 1.0.0    | À faire |

Lighthouse est mesuré à **chaque lot** à partir du lot 3 : aucune régression sous 95.

## 10. Hors périmètre (v1)

Comptes et classements en ligne, multijoueur en ligne, manette, musique d'ambiance (seul le
Rythme a une pulsation), monétisation. Voir § 11.

## 11. Évolutions envisagées

- Classement du défi du jour (nécessite un service distant et une politique anti-triche).
- Duel en ligne (envoi de rangées à l'adversaire).
- Prise en charge de la manette, effets sonores synthétisés, retour haptique.
- Application installable (PWA) et publication sur portails de jeux.

## 12. Journal des versions du document

| Version | Date       | Changements                                                                                         |
| ------- | ---------- | --------------------------------------------------------------------------------------------------- |
| 0.1     | 12/10/2026 | Création : cadrage complet, lot 0.                                                                  |
| 0.2     | 12/10/2026 | Lot 1 : architecture du moteur (§ 5.3), équilibrage du Renversement, précision sur les allocations. |
| 0.3     | 12/10/2026 | Atelier des modes : 14 modes en 4 familles (§ 3.2), architecture `GameSession` (§ 5.4), lots 2 à 9. |
