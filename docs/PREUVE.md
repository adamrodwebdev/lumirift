# Le kit de preuve

Chaque version se juge sur ce que font les joueurs, pas sur ce qu'on en pense : une ligne de
mesures par canal et par version, et dix premières sessions d'inconnus regardées sans aide
(lot 15, 1.31). Le jeu n'embarque aucun traceur : les chiffres viennent des tableaux de bord
des portails, les observations des sessions.

## 1. La feuille de mesures

Une ligne par canal vivant et par version, remplie sept jours après la sortie de la version
sur ce canal.

| Canal | Version | Du … au … | Parties | Joueurs | Temps de jeu moyen par joueur | Sessions de plus de 3 min | Rétention J1 / J7 | Pubs par partie (plein écran / récompensées) | Revenu | Note |
| ----- | ------- | --------- | ------- | ------- | ----------------------------- | ------------------------- | ----------------- | -------------------------------------------- | ------ | ---- |
|       |         |           |         |         |                               |                           |                   |                                              |        |      |

- **Sources** : la console Playgama (bac à sable puis catalogue), la console Yandex Games (une
  fois le jeu publié), le portail développeur de CrazyGames (une fois le jeu en ligne). Notre
  site n'a pas de ligne : il ne mesure rien.
- **Une version ne se juge que sur ses propres sessions.** Les tableaux de bord cumulent depuis
  le début : on lit la période qui suit la sortie, jamais le total.
- **Jamais de trafic acheté sur une version qu'on va remplacer** : il pèserait pour toujours dans
  les moyennes du portail.
- La porte de chaque lot nomme les colonnes qu'elle lit (cahier, § 9 bis).

## 2. Les dix sessions d'inconnus

Dix personnes qui n'ont jamais joué à Lumirift jouent la version, chacune seule, sous les yeux
d'un observateur muet.

- **Qui** : dix personnes, d'âges variés, ni collègues ni proches qui connaissent le projet ;
  au moins six sur téléphone (Android et iPhone), les autres sur ordinateur.
- **Quoi** : le build du portail de la version (lien du bac à sable Playgama ou du brouillon
  Yandex), jamais le serveur de développement ; les pubs comme en ligne ; le son allumé ;
  l'appareil de la personne.
- **La consigne, une seule phrase** : « Voici un jeu, joue comme tu veux, je regarde
  seulement. » Aucune aide, aucune réponse pendant la partie : on note les questions.
- **Durée** : tant que la personne veut jouer, dix minutes au plus.
- **Après** : trois questions, dans cet ordre. Qu'as-tu préféré ? Qu'est-ce qui t'a gêné ? Tu y
  rejouerais, et pourquoi ?

### La grille

Une ligne par session, remplie pendant qu'elle se déroule.

| #   | Appareil | Premier geste (s) | Commandes comprises sans aide | Première défaite (s) | Reprise vue / prise | Chutes manquées / accidentelles | Moments de confusion | Plainte sur les pubs | Durée (min) | Rejouerait |
| --- | -------- | ----------------- | ----------------------------- | -------------------- | ------------------- | ------------------------------- | -------------------- | -------------------- | ----------- | ---------- |
| 1   |          |                   |                               |                      |                     |                                 |                      |                      |             |            |

- **Reprise vue / prise** : la reprise ne s'offre qu'après cinq minutes de jeu et une partie de
  deux minutes ; « non offerte » se note aussi.
- **Chutes manquées / accidentelles** : un coup vers le bas qui ne fait rien, ou une pièce
  tombée sans qu'on le veuille (la porte du lot 23).
- **Moments de confusion** : où, et ce que la personne a dit ou fait.

## 3. La porte de la 1.31

- Une ligne 1.31 pour chaque canal vivant dans la feuille de mesures.
- Le temps de jeu moyen et les pubs par partie au moins égaux à ceux de la 1.30.
- Aucune plainte sur les pubs dans les dix sessions.

Une porte qui échoue fait reprendre la fonction une fois, ou l'abandonner ; jamais la forcer.

## 4. Le test des Dunes (1.37)

Sans traceur, deux jeux du bac à sable de Playgama comparés sur leurs tableaux de bord : Dunes
seul et le Sable seul (voir [PLAYGAMA.md](PLAYGAMA.md)), les mêmes covers.

**Décision du 27/10/2026 : aucune dépense avant que le jeu rapporte.** Le test ne s'achète pas
(les 300 $ de trafic prévus sont abandonnés) : on investira les bénéfices, on ne dépense pas
sans solde. Le test se joue sur des parties gratuites :

- les dix sessions d'inconnus, sur **chacune** des deux versions (la grille de la section 2,
  plus le temps joué et le passage des 3 minutes) ;
- les parties que les deux jeux du bac à sable reçoivent sans achat (le lien partagé par
  l'utilisateur, s'il le souhaite) ;
- le test payant (environ 1 000 parties de chacun) attend les premiers revenus.

- **Porte** : les Dunes battent le Sable en temps de jeu moyen **et** en part des sessions de
  plus de 3 minutes, sur les sessions d'inconnus et les parties gratuites ; avec si peu de
  parties, le verdict reste provisoire, et le test payant le confirmera quand le jeu
  rapportera.
- **Lecture** : une ligne par jeu dans la feuille de mesures (parties, temps moyen, sessions
  au-delà de 3 minutes, jour du relevé). Ne comparer que des chiffres pris le même jour, après
  le même trafic : un bac à sable fait la moyenne de toutes ses parties depuis le début.
- **Si le tableau de bord ne donne pas les sessions de plus de 3 minutes**, le dire avant de
  conclure : la porte ne se juge alors que sur le temps moyen, et les dix sessions d'inconnus
  disent le reste.
- **Après** : si la porte passe, les Dunes mènent la version des magasins et rejoignent
  l'entraînement ; sinon elles sont retirées (leur dossier `families/dunes` et leurs entrées).
