# RésistoLab

Simulateur pédagogique destiné à la co-intervention mathématiques et enseignement professionnel en seconde Bac Pro CIEL.

L’élève doit décoder une résistance E12 ou E24, calculer les bornes de son intervalle de tolérance, raccorder et régler le multimètre, puis lire une inéquation à trois membres.

## Lancer localement

```powershell
npm run dev
```

Puis ouvrir `http://localhost:8000`.

## Tester

```powershell
npm test
```

Le site est entièrement statique et peut être publié directement avec GitHub Pages.

## Défi évalué dans Moodle

RésistoLab détecte automatiquement l’API SCORM 1.2 lorsqu’il est lancé depuis Moodle. Dans ce contexte, le défi :

- démarre directement et enregistre les quatre résistances tirées dans `cmi.suspend_data` ;
- reprend la même tentative après une actualisation ;
- évalue quatre réponses au premier contrôle et un point de correction par résistance, soit une note sur 20 ;
- permet d’abandonner une résistance pour révéler les réponses et poursuivre sans point de correction ;
- transmet la note à Moodle avec `cmi.core.score.raw` ;
- désactive le bouton permettant de recommencer après la fin du défi.

Préparer le paquet :

```powershell
npm run scorm:stage
Compress-Archive -Path .\dist-scorm-v3\* -DestinationPath .\resistolab-defi-scorm-v3.zip -Force
```

Dans Moodle, ajouter une activité **Paquetage SCORM**, téléverser le ZIP, fixer la note maximale et le nombre maximal de tentatives à `20` et `1`, puis activer le verrouillage après la dernière tentative.
