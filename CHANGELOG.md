# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions
[SemVer](https://semver.org/lang/fr/).

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
