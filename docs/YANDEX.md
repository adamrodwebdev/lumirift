# Lumirift sur Yandex Games

Version Yandex Games du jeu (SDK v2), publiée en direct (décision du 23/10/2026), et contrôle
de chaque exigence de la plateforme : `references/yandex-games.md` du skill de revue des
portails, lue en entier le 23/10/2026 (exigences du 9 octobre 2026).

## Décisions (23/10/2026)

- **Voie directe**, plutôt que la diffusion par Playgama : notre fiche, la main sur les mises à
  jour. Playgama exclut déjà « Yandex Games » et Playhop de sa distribution (à garder ainsi :
  la règle 3.6 refuse un même jeu publié deux fois).
- **Sans bannière collante** au départ : pubs plein écran entre deux parties et pub récompensée
  seulement ; le puits garde toute sa place.
- **Langues** : russe, anglais, français, indonésien ; le biélorusse, le kazakh, l'ukrainien et
  l'ouzbek mènent au russe, sauf si une langue du jeu vient avant dans les préférences du
  joueur. Sur ce build seulement depuis la 1.30.1 (`russianForNeighbours`) : ailleurs,
  l'anglais, la langue de repli que Playgama demande.
- **VK** : en attente d'un avis juridique (sanctions de l'UE sur la holding VK depuis le
  13/07/2026), comme Ball Mania.
- **Un seul compte développeur et un seul contrat pour Ball Mania et Lumirift** : un contrat
  couvre tous les jeux du compte et leurs revenus s'additionnent pour les versements (réponse du
  support du 23/10/2026). La voie se choisit quand le premier des deux jeux est prêt pour la
  modération (voir « À faire par l'auteur »).

## Construire et livrer

```bash
npm run package:yandex   # build, contrôles, zip dans release/
```

Le zip (`release/lumirift-yandex-<version>.zip`, 0,5 Mo environ) a `index.html` à la racine,
des chemins relatifs et des séparateurs « / » (bsdtar). Le script vérifie : archive de 100 Mo
au plus (1.21), aucun espace ni cyrillique dans les noms (1.22), le SDK chargé par `/sdk.js`
dans `<head>` (1.19.1), aucune adresse absolue des serveurs S3 de Yandex (1.7), aucune autre
requête externe ni SDK d'un autre portail (4.1, 8.4.2), aucune analytique externe, aucune
demande « modifications non enregistrées » (1.14).

## Ce que fait le build

| Exigence                                                      | Réponse du build                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1, 1.19.1 : SDK officiel, `YaGames.init()` avant tout appel | `<script src="/sdk.js">` dans `<head>` ; `YandexPlatform.create` attend `YaGames.init()` avant toute autre chose                                                                                                                                                                                               |
| 1.19.2 : `LoadingAPI.ready()` au moment jouable               | Une fois, au premier écran interactif : l'entraînement (0,1 à 0,4 s après le chargement, avec le faux SDK)                                                                                                                                                                                                     |
| 1.19.3 : `GameplayAPI.start()` / `stop()`                     | Au début et à la fin de chaque partie, à la pause, au menu ; jamais avant `ready()` ; une pause automatique compte comme un arrêt (`stopsOnAutoPause`)                                                                                                                                                         |
| 1.3, 4.7 : son et jeu en pause hors focus et pendant les pubs | `game_api_pause` met le jeu en pause et coupe le son ; `game_api_resume` rend le son, le jeu attend le joueur sur sa fenêtre de pause                                                                                                                                                                          |
| 1.6.1.6, 1.6.2.5 : pas de lecteur système                     | Tout le son passe par Web Audio (sons et musique synthétisés)                                                                                                                                                                                                                                                  |
| 1.6.1.8, 1.6.2.7 : ni menu contextuel ni sélection            | Dans tout le cadre : `contextmenu` bloqué, `user-select: none`, `-webkit-touch-callout: none`                                                                                                                                                                                                                  |
| 1.10.2 : ni défilement de page ni glisser pour recharger      | Chaque menu tient dans l'écran (seule une fenêtre trop haute défile en elle-même) ; `overscroll-behavior: none`                                                                                                                                                                                                |
| 1.6.2.1, 1.6.2.2 : champ qui touche un bord, 2:1 au plus      | Le jeu occupe toute la fenêtre ; au-delà de 2:1 sur ordinateur, le cadre de jeu s'arrête à 2:1, centré, la lumière du jeu remplit le reste                                                                                                                                                                     |
| 1.9 : progression gardée, connecté ou non                     | Données du joueur (`player.setData`), lues en une requête au lancement, écrites entières, une requête toutes les 4 s au plus, envoyées à la pause ; navigateur en secours                                                                                                                                      |
| 1.14 : aucune information de développeur                      | Pas de numéro de version (`showsVersion`) ; aucune demande à la fermeture de la page                                                                                                                                                                                                                           |
| 2.14 : langue détectée par le SDK                             | `environment.i18n.lang` au lancement, qui l'emporte sur la langue enregistrée                                                                                                                                                                                                                                  |
| 4.4 : pubs aux pauses logiques, jamais dans un niveau         | Plein écran en quittant une partie gagnée ou finie au chrono (rejouer, niveau suivant, accueil, carte), jamais après une défaite, ni dans les 8 premières minutes, ni juste après une récompensée ; aucune dans l'entraînement (1.31)                                                                          |
| 4.5 : récompensée au choix, récompense après visionnage       | « PUB · Doubler l'XP », « Regarder une pub » pour reprendre une partie perdue (« Non merci » à côté, égal), « L'essayer une partie » à l'Atelier ; récompense seulement sur `onRewarded` ; une pub en erreur ou jamais ouverte (12 s) retire l'offre pour la visite ; jouer ne dépend jamais d'une pub (4.5.2) |
| 8.4.2 : aucun lien externe                                    | Partage masqué (`allowsExternalLinks`)                                                                                                                                                                                                                                                                         |
| Premier lancement (règle des portails)                        | Droit dans l'entraînement, sans écran-titre ni menu ; les menus ensuite                                                                                                                                                                                                                                        |

Pas encore géré : la fenêtre de Yandex qui fait choisir entre une sauvegarde anonyme et une
sauvegarde connectée (`ACCOUNT_SELECTION_DIALOG_OPENED`), les achats intégrés, les classements.

## Revue du 23/10/2026 (build 1.30.0, faux SDK)

**Méthode.** Le paquet servi en local (`vite preview --mode yandex`) dans Chrome sans profil ;
`/sdk.js` remplacé par un faux SDK qui note chaque appel, prend la langue de `?lang=`, garde les
données du joueur et déclenche les pauses de Yandex. Le vrai SDK, ses pubs et le panneau de
débogage (`?debug-mode=16`) se testent sur un brouillon, une fois le compte ouvert.

| Contrôle                                      | Statut     | Preuve                                                                                                                                                        |
| --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK initialisé d'abord, prêt une fois         | ✅         | `init` est le premier appel ; `ready` une seule fois, 0,1 à 0,4 s après le chargement                                                                         |
| Langues (2.14)                                | ✅         | ru, en, fr, id : l'écran entier bascule ; uk → russe ; tr → anglais                                                                                           |
| Repères de jeu (1.19.3)                       | ✅         | `start` après `ready` ; `stop` à la pause de Yandex, à la fin de partie ; `start` à la reprise du joueur                                                      |
| Son hors focus et pendant les pubs (1.3, 4.7) | ✅         | `game_api_pause` : son suspendu, `stop` ; pub plein écran : son suspendu pendant, rendu après                                                                 |
| Pubs (4.4, 4.5)                               | ✅         | Plein écran demandée moins d'une seconde après « Play again » ; récompensée : « Experience doubled: +13 XP! »                                                 |
| Tailles et 2:1 (1.6.2.1, 1.6.2.2, 1.10)       | ✅ corrigé | 13 tailles de 360 × 640 à 2560 × 1080 : rien de coupé ni de défilement ; 2560 × 1080 : cadre de 2,41:1 ramené à 1,97:1                                        |
| Menus sans défilement (1.10.2)                | ✅         | 4 onglets et les réglages à 13 tailles, de 320 × 568 à 2560 × 980 : la page ne défile jamais ; à 320 × 568, seule la fenêtre des réglages défile en elle-même |
| Menu contextuel, sélection (1.6.2.7, 1.6.1.8) | ✅ corrigé | Bloqués seulement sur le puits ; désormais dans tout le cadre, vérifiés par un test e2e                                                                       |
| Sauvegardes (1.9, limites)                    | ✅         | 4 requêtes en 32 s de jeu ; au rechargement, le joueur retrouve les menus                                                                                     |
| Console, réseau                               | ✅         | Aucune erreur ; aucune requête hors de la page                                                                                                                |
| Safari, téléphones réels, vrai SDK            | 🟡         | À faire sur le brouillon (panneau de débogage) et sur appareils                                                                                               |

## À faire par l'auteur

D'après la réponse du support du 23/10/2026 (détail : `references/yandex-games.md`, § 3) et
l'incident du 11/10/2026 (incendie de centres de données de Yandex : inscriptions, modération et
statistiques coupées pendant la remise en état, sans date de retour).

1. **Compte développeur** (commun avec Ball Mania) : un identifiant Yandex avec une adresse
   Yandex (une adresse gmail peut empêcher la monétisation), nom de développeur en lettres
   latines, langue de contact choisie (les modérateurs écrivent dans celle-ci).
2. **Titre** : vérifier dans la console que « Lumirift Blocks » est libre (5.12).
3. **Brouillon** : « Добавить игру », les champs ci-dessous, l'archive ; tester avec « Открыть
   черновик с debug-панелью » (chargeur `IT`, point vert, 文 « I18N is used », 🎮 juste).
4. **Visuels** : icône, couverture, captures et vidéos, prêts dans `release/yandex-media/`
   (voir plus bas).
5. **Contrat, obligatoire avant la modération** (un brouillon envoyé sans contrat revient). Un
   seul pour le compte, signé quand le premier des deux jeux est prêt :
   - le **contrat unique (ЕЛС)**, ouvert aux entrepreneurs individuels étrangers, si ses
     inscriptions ont rouvert ;
   - sinon la **régie (РСЯ)**, seulement depuis la console : onglet « Реклама » d'un brouillon,
     « Подключить монетизацию », puis le formulaire de la régie avec le même identifiant
     (jamais une inscription à la régie à part). Signer la régie ferme ensuite la voie de
     l'ЕЛС en libre-service.

   Documents, TVA (franchise en base) et versements en euros : question transmise à l'équipe
   de la régie, réponse attendue.

6. **Envoi en modération**, une fois la modération rouverte : un seul jeu nouveau à la fois
   pour un compte sans historique ; après un refus, l'attente double (24 h, puis 2, 4, 8 et
   16 jours).

## Brouillon : champs et textes

**Onglet « Общее »**

- **Архив** : `release/lumirift-yandex-<version>.zip`.
- **Поддерживаемые платформы** : ordinateur, Android, iOS. **Ориентация** : « Любая » (les
  deux).
- **Игра переведена на** : русский, английский, французский, индонезийский.
- **Возрастной рейтинг** : 6+ conseillé (le Ver des dunes surgit en rugissant, l'écran
  tremble ; rien de réaliste ni de sanglant).
- **Категории** : Головоломки (casse-tête) et Аркады (arcade).
- **Игра использует облачные сохранения** : cochée (données du joueur).
- **Использовать API для показа sticky-баннера** : cochée, pour qu'aucune bannière collante ne
  s'affiche (le jeu n'en demande jamais).
- **Ключевые слова** (minuscules, 100 caractères au plus ; 96 ici) :

  ```text
  падающие блоки, песок, головоломка, стихии, боссы, кампания, дуэль, falling blocks, sand, puzzle
  ```

- **Комментарий разработчика** : « Saves: player data (setData), whether logged in or not.
  Monetization: fullscreen ads between games and an optional rewarded ad (double XP); no
  sticky banner. A new player starts with a two-step training (Sand), then the menus. »

**Onglet « Описание и продвижение »** : le titre est **Lumirift Blocks** dans les quatre langues
(un titre latin vaut pour toutes ; le même dans le jeu, sur l'icône, la couverture et la
vidéo).

### Русский

- **Короткое описание** :
  > Блоки рассыпаются живым песком: соедините стенки, прогоните червя.
- **Описание для SEO** :
  > Головоломка с падающими блоками, живым песком, стихиями и четырьмя боссами-стражами: 13 режимов и кампания на 30 уровней!
- **Об игре** :
  > Lumirift заново придумывает жанр падающих блоков. Фигуры рассыпаются живым песком: соедините левую и правую стенки одним цветом, чтобы очистить зону, и пользуйтесь стихиями. Молния разбивает все цвета, которых касается вода, огонь поджигает масло, вода превращает семя в лозу. А под песком ждёт Песчаный червь.
  >
  > Тринадцать оригинальных режимов в четырёх семействах: Песок; Классика и её вариации (Переворот, Наклон, Зеркало, Слияние, Ритм…); стеклянная Башня, которая сворачивает поле в цилиндр; керамическая Мозаика с пятью джокерами; дуэль с ИИ пяти уровней. Кампания на 30 уровней с четырьмя Стражами и десятью улучшениями, задание дня, еженедельный вызов Стражей, ежедневные цели, опыт и косметика.
- **Как играть** :
  > Управляйте падающими фигурами и очищайте поле, пока оно не заполнилось. В режиме «Песок» фигуры рассыпаются на песчинки: соедините левую и правую стенки одним цветом, чтобы очистить эту зону. В других режимах собирайте линии. Цель каждого уровня кампании показана на экране, а при первом запуске короткое обучение объясняет главное.
  >
  > Клавиатура: стрелки влево и вправо — сдвинуть, стрелка вверх или X — повернуть, Z — повернуть в другую сторону, стрелка вниз — ускорить падение, пробел — мгновенный сброс, C или Shift — отложить фигуру, V — перегрузка Разлома, P — пауза. Башня: Q и E — вращать. Мозаика: 1–3 — выбрать фигуру, стрелки — прицелиться, Enter — поставить, J — джокеры. Клавиши следуют раскладке вашей клавиатуры.
  >
  > Касания: проведите в сторону — сдвинуть, коснитесь правой или левой половины — повернуть в ту сторону, резко проведите вниз — сбросить.

### English

- **Short description**:
  > Blocks crumble into living sand: link the walls, drive off the Wyrm.
- **SEO description**:
  > Falling-blocks puzzle with living sand, reacting elements and four Guardian bosses: 13 modes and a 30-level campaign to play!
- **About**:
  > Lumirift reinvents the falling-blocks game. Your pieces crumble into living sand: link the left and right walls with one colour to clear it, and play with the elements. Lightning shatters every colour the water touches, fire sets oil ablaze, water grows a seed into a vine. Beneath the sand, the Dune Wyrm is waiting.
  >
  > Thirteen original modes across four families: the Sand; Classic and its twists (Flip, Tilt, Mirror, Fusion, Rhythm…); a glass Tower that wraps the well into a cylinder; a ceramic Mosaic with five jokers; and duels against an AI with five levels. A 30-level campaign with four Guardians and ten upgrades, a daily challenge, a weekly Guardian challenge, daily objectives, experience and cosmetics.
- **How to play**:
  > Guide the falling pieces and clear the well before it fills up. In the Sand, pieces crumble into grains: link the left and right walls with one colour to clear that region. In the other modes, complete lines. Each campaign level shows its goal on screen, and a short training teaches the basics at the first launch.
  >
  > Keyboard: Left and Right arrows to move, Up or X to rotate, Z to rotate the other way, Down to drop faster, Space to hard drop, C or Shift to hold, V for the rift surge, P to pause. Tower: Q and E to turn. Mosaic: 1–3 to pick a piece, arrows to aim, Enter to place, J for the jokers. Keys follow your keyboard layout.
  >
  > Touch: swipe sideways to move, tap the right or left half to turn that way, flick down to drop.

### Français

- **Description courte** :
  > Des blocs en sable vivant : reliez les murs, chassez le Ver des dunes.
- **Description SEO** :
  > Casse-tête de blocs qui tombent, avec sable vivant, éléments qui réagissent et quatre Gardiens : 13 modes et une campagne de 30 niveaux !
- **À propos** :
  > Lumirift réinvente le jeu de blocs qui tombent. Vos pièces s’effritent en sable vivant : reliez les murs de gauche et de droite d’une même couleur pour l’effacer, et jouez avec les éléments. La foudre brise toutes les couleurs que touche l’eau, le feu embrase l’huile, l’eau fait pousser une graine en liane. Sous le sable, le Ver des dunes vous attend.
  >
  > Treize modes inédits en quatre familles : le Sable ; le Classique et ses variantes (Renversement, Bascule, Miroir, Fusion, Rythme…) ; une Tour de verre qui enroule le puits en cylindre ; une Mosaïque de céramique et ses cinq jokers ; des duels contre une IA à cinq niveaux. Une campagne de 30 niveaux avec quatre Gardiens et dix améliorations, un défi du jour, un défi des Gardiens chaque semaine, des objectifs quotidiens, de l’expérience et des cosmétiques.
- **Comment jouer** :
  > Guidez les pièces qui tombent et videz le puits avant qu’il ne déborde. Dans le Sable, les pièces s’effritent en grains : reliez les murs de gauche et de droite d’une même couleur pour effacer cette zone. Dans les autres modes, complétez des lignes. Chaque niveau de la campagne affiche son objectif, et un court entraînement montre l’essentiel au premier lancement.
  >
  > Clavier : flèches gauche et droite pour déplacer, Haut ou X pour tourner, Z pour tourner dans l’autre sens, Bas pour accélérer la chute, Espace pour la chute instantanée, C ou Maj pour la réserve, V pour la surcharge de la faille, P pour la pause. Tour : Q et E pour la faire tourner. Mosaïque : 1 à 3 pour choisir une pièce, flèches pour viser, Entrée pour poser, J pour les jokers. Les touches suivent la disposition de votre clavier.
  >
  > Tactile : glissez sur le côté pour déplacer, touchez la moitié droite ou gauche pour tourner de ce côté, glissez vite vers le bas pour lâcher la pièce.

### Bahasa Indonesia

- **Deskripsi singkat**:
  > Balok hancur jadi pasir hidup: hubungkan dinding, usir Cacing Pasir.
- **Deskripsi SEO**:
  > Puzzle balok jatuh dengan pasir hidup, elemen yang bereaksi, dan empat bos Penjaga: 13 mode dan kampanye 30 level!
- **Tentang game**:
  > Lumirift menghadirkan ulang game balok jatuh. Balokmu hancur menjadi pasir hidup: hubungkan dinding kiri dan kanan dengan satu warna untuk menghapusnya, dan manfaatkan elemen. Petir memecah semua warna yang tersentuh air, api membakar minyak, air menumbuhkan benih menjadi sulur. Di bawah pasir, Cacing Pasir sedang menunggu.
  >
  > Tiga belas mode orisinal dalam empat keluarga: Pasir; Klasik dan variasinya (Terbalik, Miring, Cermin, Fusi, Ritme…); Menara kaca yang menggulung area main menjadi silinder; Mozaik keramik dengan lima joker; dan duel melawan AI dengan lima tingkat. Kampanye 30 level dengan empat Penjaga dan sepuluh peningkatan, tantangan harian, tantangan Penjaga mingguan, misi harian, pengalaman, dan kosmetik.
- **Cara bermain**:
  > Arahkan balok yang jatuh dan kosongkan area main sebelum penuh. Di mode Pasir, balok hancur menjadi butiran: hubungkan dinding kiri dan kanan dengan satu warna untuk menghapus area itu. Di mode lain, lengkapi baris. Setiap level kampanye menampilkan tujuannya di layar, dan latihan singkat mengajarkan dasarnya saat pertama kali bermain.
  >
  > Keyboard: panah kiri dan kanan untuk menggeser, atas atau X untuk memutar, Z untuk memutar ke arah sebaliknya, bawah untuk mempercepat jatuh, Spasi untuk menjatuhkan langsung, C atau Shift untuk menyimpan, V untuk lonjakan retakan, P untuk jeda. Menara: Q dan E untuk memutar. Mozaik: 1–3 untuk memilih balok, panah untuk membidik, Enter untuk menaruh, J untuk joker. Tombol mengikuti tata letak keyboard-mu.
  >
  > Sentuh: geser ke samping untuk menggeser, ketuk separuh kanan atau kiri untuk memutar ke arah itu, sentil ke bawah untuk menjatuhkan.

## Visuels

```bash
node scripts/yandex-media.mjs   # tout, dans release/yandex-media/ (une dizaine de minutes)
node scripts/yandex-media.mjs --no-video --lang=ru   # les captures d'une langue
```

Le script dessine l'icône et la couverture (l'art des portails, `scripts/media-covers.mjs`),
joue le build Yandex avec un faux SDK pour les captures de chaque langue, et enregistre les
vidéos depuis les vraies scènes du jeu (`scripts/showcase-frames.mjs`), image par image, puis
les fait encoder en H.264 par Chrome (WebCodecs) dans un MP4 (`scripts/mp4-encoder.mjs`) :
pas de ffmpeg, rien à télécharger.

| Visuel                          | Fichier                                                      | Format                  | Règles                                                                                                            |
| ------------------------------- | ------------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Icône                           | `icon-512x512.png`                                           | 512 × 512 PNG           | L'Œil au-dessus de sa tour de gemmes ; ni capture, ni interface, ni texte, ni coin arrondi (5.6, 8.3)             |
| Couverture                      | `cover-800x470.png`                                          | 800 × 470 PNG           | Le titre « Lumirift Blocks », seul texte, identique au jeu (5.1.3)                                                |
| Captures, ordinateur            | `screenshots/<langue>/desktop-1-elements`, `desktop-2-heart` | 1920 × 1080 JPEG        | L'huile qui s'embrase dans l'entraînement ; le Cœur de la faille (5-7)                                            |
| Captures, téléphone             | `screenshots/<langue>/mobile-1-wyrm`, `mobile-2-golem`       | 1080 × 1920 JPEG        | Le Ver qui jaillit du sable ; le Golem de céramique (3-7)                                                         |
| Vidéo horizontale (obligatoire) | `video-horizontal-1920x1080.mp4`                             | MP4 16:9, 25,5 s, 30 Mo | La couverture 1,5 s, puis sept scènes de vrai jeu (94 %) : éléments, Renversement, Ver, Bascule, Golem, Œil, Cœur |
| Vidéo verticale                 | `video-vertical-1080x1920.mp4`                               | MP4 9:16, 25,5 s, 34 Mo | Les mêmes scènes, en portrait                                                                                     |

Les captures montrent de vraies parties de chaque langue (100 % de jeu) ; les bulles de texte,
qui couvriraient le puits, y sont masquées. Chaque onglet de langue du brouillon reçoit ses
quatre captures ; l'icône, la couverture et les vidéos, sans texte de l'interface, servent
pour toutes les langues.

## Après la publication

- Une note (0 à 100) se forme vers la deuxième semaine, si plus de 10 joueurs par jour jouent
  pendant 20 jours ; elle doit dépasser 30 en trois semaines, sinon le jeu est retiré (2.13).
- Chaque mise à jour qui change les fichiers repasse une modération complète ; la version en
  ligne reste jusqu'à l'accord.
