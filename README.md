# Stackrift

Jeu de blocs qui tombent, réinventé : les règles que vous connaissez, cinq modes de jeu que
vous n'avez jamais joués. Navigateur, mobile d'abord, en français, anglais et indonésien.

Cahier des charges : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md).

## Démarrer

Prérequis : Node.js 24 (voir `.nvmrc`).

```bash
npm install
npm run dev
```

## Commandes

| Commande             | Rôle                                                 |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Serveur de développement avec rechargement à chaud   |
| `npm run build`      | Vérification des types puis build de production      |
| `npm run preview`    | Sert le build de production (port 4173)              |
| `npm test`           | Tests unitaires (Vitest)                             |
| `npm run test:e2e`   | Tests de bout en bout (Playwright, mobile et bureau) |
| `npm run lint`       | ESLint (règles TypeScript strictes, typées)          |
| `npm run format`     | Prettier                                             |
| `npm run lighthouse` | Audit Lighthouse du build (après `npm run build`)    |
| `npm run verify`     | Lint, format, types, tests et build, comme la CI     |
