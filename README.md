# Stackrift

Le jeu de blocs qui tombent, réinventé : les règles que vous connaissez, **13 modes** que
vous n'avez jamais joués, en quatre familles. Dans le navigateur, mobile d'abord, en
**français, anglais et indonésien**, en thème clair et sombre. Gratuit, sans inscription,
aucune donnée ne quitte l'appareil.

Cahier des charges (règles détaillées, architecture, décisions) :
[docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md) · Historique : [CHANGELOG.md](CHANGELOG.md).

## Le jeu

| Famille       | Modes                                                                                     | Matière         |
| ------------- | ----------------------------------------------------------------------------------------- | --------------- |
| **Chute**     | Classique, Marée, Renversement, Chroma, Miroir, Fusion, Bascule, Silhouette, Rythme, Duel | Cristal facetté |
| **Sable**     | Sable : les pièces se désagrègent en grains ; eau, feu et vent                            | Grains          |
| **Placement** | Mosaïque : grille 8 × 8, pièces à poser, cinq jokers                                      | Céramique       |
| **Volume**    | Tour : le puits s'enroule en cylindre de verre                                            | Verre courbé    |

- **Défi du jour** : chaque jour, un mode et les mêmes pièces pour tout le monde, deux
  minutes, résultat à partager.
- **Duel** contre une IA, cinq niveaux calés sur la vitesse de vrais joueurs.
- **Progression** : expérience et niveaux, trois objectifs du jour, série de défis ;
  **Atelier** de matières, d'ambiances et de signatures de bris, tous cosmétiques.
- **Effets** : destructions physiques, sons synthétisés, vibrations ; réglables (complets,
  sobres, aucun), sans jamais plus de trois flashs par seconde.

### Commandes

| Action                    | Clavier                                | Tactile                    |
| ------------------------- | -------------------------------------- | -------------------------- |
| Déplacer                  | ← → (ou A D)                           | Glisser                    |
| Descendre / chute franche | ↓ (ou S) / Espace                      | Glisser vers le bas / vite |
| Tourner                   | ↑ ou X / Ctrl ou Z                     | Toucher                    |
| Réserve, capacité         | C ou Maj, F                            | Boutons                    |
| Tourner la Tour           | Q / E (A / E en AZERTY)                | Glisser à deux doigts      |
| Mosaïque                  | 1, 2, 3 (4 : cube), flèches, Entrée, J | Glisser-déposer            |
| Pause                     | Échap ou P                             | Bouton                     |

L'aide propre à chaque famille s'affiche dans la fenêtre de pause.

## Accessibilité

Navigation complète au clavier (lien d'évitement, focus visible, focus déplacé à chaque
écran), annonces des événements de jeu aux lecteurs d'écran, motif gravé sur chaque couleur
(le jeu se joue sans distinguer les couleurs), cibles tactiles d'au moins 44 px, respect de
`prefers-reduced-motion` et `prefers-color-scheme`. Chaque écran et chaque fenêtre sont
audités automatiquement (axe-core, WCAG 2.2 AA) dans les deux thèmes.

## Démarrer

Prérequis : Node.js 24 (voir `.nvmrc`) et Google Chrome (tests de bout en bout, Lighthouse).

```bash
npm install
npm run dev
```

## Commandes de développement

| Commande             | Rôle                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `npm run dev`        | Serveur de développement avec rechargement à chaud                 |
| `npm run build`      | Vérification des types puis build de production (`dist/`)          |
| `npm run preview`    | Sert le build de production (port 4173)                            |
| `npm test`           | Tests unitaires (Vitest)                                           |
| `npm run test:e2e`   | Parcours et audits d'accessibilité (Playwright, mobile et bureau)  |
| `npm run lint`       | ESLint (règles TypeScript strictes, typées)                        |
| `npm run format`     | Prettier                                                           |
| `npm run lighthouse` | Audit Lighthouse du build, mobile (`-- --desktop` pour le bureau)  |
| `npm run verify`     | Lint, format, types, tests et build : à passer avant chaque commit |

Les tests de bout en bout et Lighthouse utilisent le build : lancez `npm run build` avant.
Les images de partage (`public/og-image.png`, icônes) se régénèrent avec
`node scripts/social-images.mjs`.

## Mise en ligne

Le build est un site statique, servi depuis n'importe quel dossier (chemins relatifs).

```bash
SITE_URL=https://exemple.fr/stackrift/ npm run build
```

`SITE_URL` (facultatif) ajoute le lien canonique, les adresses absolues des cartes de
partage, `sitemap.xml` et sa mention dans `robots.txt`. Sans lui, le build reste portable
(portails de jeux, sous-dossiers).

## Qualité

- TypeScript strict, ESLint `strictTypeChecked`, Prettier.
- Plus de 280 tests unitaires : moteurs, modes, IA, effets, services, progression, parité
  des traductions.
- Parcours de bout en bout sur téléphone (390 × 844) et ordinateur (1280 × 800) : les 13
  modes, une partie complète, défi du jour, réglages retenus, Atelier, clavier seul.
- Lighthouse : 100 dans les quatre catégories (seuil exigé : 95).
- Intégration continue : `.github/workflows/ci.yml` rejoue tout cela à chaque envoi.

## Architecture en bref

Vue 3.5 et TypeScript, sans bibliothèque de jeu. Chaque famille est un module chargé à la
demande : moteur pur (aucune dépendance au rendu), session au contrat commun, rendu canvas
et effets. Couleurs uniquement par jetons CSS, textes uniquement par `vue-i18n`. Détails
au § 5 du cahier des charges.

```
src/
  core/          Briques partagées (événements, hasard à graine, tons, jours)
  session/       Contrat GameSession, registre des modes, défi du jour
  families/      falling, sand, placement, volume : moteur, session, rendu, effets, interface
  progression/   Expérience, objectifs, cosmétiques, profil
  fx/, render/   Particules, secousses, sons ; palette et motifs partagés
  services/      Réglages, records, profil, thème, ambiance, audio, partage
  ui/            Écrans et composants
```

## Confidentialité

Aucun compte, aucun traceur, aucune requête vers un service tiers. Réglages, records et
progression sont gardés dans le stockage local du navigateur.
