# Cahier des charges — Stackrift

| Version | Date       | Statut                      |
| ------- | ---------- | --------------------------- |
| 0.2     | 12/10/2026 | Lot 1 livré : moteur de jeu |

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
2. **Rejouabilité** : cinq modes aux objectifs différents, dont un **défi du jour** identique
   pour tous les joueurs.
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

- **Modes à mécanique nouvelle** (renversement du puits, couleurs, marée) plutôt que de
  simples variantes de vitesse.
- **Défi du jour** à graine commune : même suite de pièces pour tous, résultat partageable
  (boucle virale de type jeu quotidien).
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

| Mode             | Objectif                         | Mécanique nouvelle                                        |
| ---------------- | -------------------------------- | --------------------------------------------------------- |
| **Classique**    | Meilleur score, sans fin         | Référence du genre                                        |
| **Défi du jour** | Meilleur score en 2 minutes      | Graine du jour commune à tous, résultat partageable       |
| **Marée**        | Tenir le plus longtemps possible | Des rangées montent du fond, de plus en plus vite         |
| **Renversement** | Meilleur score, sans fin         | Le joueur retourne le puits : la pile retombe, en cascade |
| **Chroma**       | Meilleur score, sans fin         | Couleurs indépendantes des formes, lignes pures × 4       |

Règles détaillées :

- **Défi du jour** : la graine est la date locale du joueur (AAAAMMJJ). Deux minutes de jeu,
  niveau de départ 1. En fin de partie, le joueur partage un texte court (score, lignes, date,
  lien) via le partage natif du téléphone ou, à défaut, le presse-papiers. Meilleur score
  conservé par jour.
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
  aucune requête tierce.
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

1. Les cinq modes sont jouables du début à la fin, au clavier et au tactile.
2. Lighthouse ≥ 95 dans les quatre catégories (mobile, build de production).
3. Aucun défilement horizontal de 320 à 1920 px ; le puits reste entièrement visible.
4. Les trois langues sont complètes ; changer de langue ne recharge pas la page.
5. Le thème sombre s'applique sans flash au chargement.
6. `npm run verify` et `npm run test:e2e` passent.

## 9. Lots et planning

| Lot | Contenu                                               | Statut  |
| --- | ----------------------------------------------------- | ------- |
| 0   | Cadrage, outillage, cahier des charges                | Livré   |
| 1   | Moteur : puits, pièces, rotation, sac, score, gravité | Livré   |
| 2   | Modes de jeu (stratégies)                             | À faire |
| 3   | Interface Vue, rendu canvas, clavier et tactile, i18n | À faire |
| 4   | Thèmes, accessibilité, SEO, mesure Lighthouse         | À faire |
| 5   | Tests de bout en bout, documentation, version 1.0.0   | À faire |

## 10. Hors périmètre (v1)

Comptes et classements en ligne, multijoueur, manette, musique, monétisation. Voir § 11.

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
