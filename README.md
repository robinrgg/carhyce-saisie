# CARHYCE — Saisie terrain

Application web mobile-first pour la saisie de données du protocole CARHYCE (caractérisation hydromorphologique des cours d'eau, OFB).

Conçue pour une utilisation sur smartphone, en autonomie totale (hors-ligne) sur le terrain. Les données sont stockées localement dans le navigateur et exportables en JSON ou Excel.

## Périmètre

Saisie uniquement. Aucun calcul d'indicateurs IMG / IHC, aucune comparaison aux références régionales — ces traitements seront produits dans un second temps par un script Python qui consommera le JSON exporté.

## Modules couverts

- **Station** — métadonnées, coordonnées RGF93/L93, Lpb-ev × 3 et Lm-ev × 3, longueur réelle, distance inter-points, continuité de la ripisylve RG/RD, conditions météo/hydro, débit, pente, habitats non minéraux marginaux ;
- **Granulométrie** — 100 mesures Wolman, calcul en direct de D16/D50/D84, D84/D16 ;
- **Pente** — saisie des tronçons (Fh/Fm/Fb aval et amont, distance), calcul de la pente estimée et de la pente régressée ;
- **Colmatage** — module complet pose (XY + indice de repérage) puis relève (état + profondeur d'oxygénation) ;
- **Transects** — jusqu'à 18 transects (15 actifs par défaut, T16 à T18 activables) : Lpb / Lm / Hpb, points de mesure (profondeur, substrat minéral, 2 substrats additionnels), faciès simplifié + affiné, ripisylve RG/RD (3 strates × épaisseur + type), nature des matériaux et habitats des berges. Aperçu graphique du profil en travers en temps réel ;
- **Export** — JSON (format pivot pour la chaîne Python aval) et Excel `.xlsx` (un onglet par module + un onglet par transect).

## Déploiement sur GitHub Pages

1. Créer un dépôt GitHub, par exemple `carhyce-saisie`.
2. Copier l'intégralité du contenu de ce dossier à la racine du dépôt.
3. Pousser sur `main`.
4. Dans **Settings → Pages**, sélectionner la branche `main`, dossier `/ (root)`, et valider.
5. Au bout d'une à deux minutes, l'application est accessible à l'URL `https://<utilisateur>.github.io/<nom-du-dépôt>/`.

Première ouverture en ligne : l'application est mise en cache par le service worker. Ensuite, elle fonctionne 100 % hors connexion. Sur Android (Chrome) ou iOS (Safari), utiliser « Ajouter à l'écran d'accueil » pour disposer d'une icône et d'un lancement plein écran.

## Architecture des fichiers

```
.
├── index.html               # structure HTML, navigation entre écrans
├── styles.css               # mise en forme mobile-first
├── nomenclatures.js         # toutes les listes de référence (substrats, faciès, etc.)
├── db.js                    # persistance via IndexedDB + modèle de données initial
├── app.js                   # rendu des écrans, logique métier, calculs auto
├── export.js                # export JSON et Excel (SheetJS)
├── manifest.webmanifest     # PWA (installabilité, icône)
├── sw.js                    # service worker (cache hors-ligne)
└── icon.svg                 # icône de l'application
```

Aucune dépendance npm, aucun build. Le fichier `xlsx.full.min.js` est chargé depuis un CDN (jsDelivr) lors du premier accès puis mis en cache.

## Format JSON exporté

Schéma versionné (`meta.schema_version` = 1.0). Structure stable : tout changement futur incrémente la version.

```jsonc
{
  "id": "op_…",
  "meta": { "schema_version": "1.0", "exporte_le": "2026-…" },
  "station":      { … },
  "granulometrie":{ "mesures_mm": [29, 30, 37, …] },
  "pente":        { "troncons": [ { "aval": {fh,fm,fb}, "amont": {fh,fm,fb}, "distance_m": … } ] },
  "colmatage":    { "actif": true, "radiers": [ { "id": "A", "batonnets": [ … ] } ] },
  "transects":    [ { "numero": 1, "points": [ {distance_m, profondeur_cm, substrat_min, …} ], … } ]
}
```

C'est ce JSON qui servira d'entrée au script Python de calcul des indicateurs (D16/D50/D84, Folk & Ward, CV largeurs/profondeurs, Lpb/Ppb, Strickler, Qpb, puissance spécifique, IMG/IHC le cas échéant) et à la génération des figures matplotlib pour les rapports d'étude.

## Cycle de travail recommandé

1. Sur le terrain (smartphone, hors-ligne) : créer une opération, saisir Station + Pente + Granulo + Transects.
2. Au retour au bureau : ouvrir l'appli sur ordinateur ou téléphone, exporter le JSON sur le poste de travail.
3. Lancer le script Python de traitement sur le JSON pour obtenir indicateurs et figures.
4. Conserver le JSON comme archive brute de l'opération (fichier léger, lisible et auto-porteur).

## Limites connues / améliorations possibles

- Pas de synchronisation entre appareils : un export JSON doit être transféré manuellement.
- Pas de prise de photos intégrée pour l'instant (les photos sont stockées séparément).
- Pas de capture des coordonnées GPS automatique (à ajouter via `navigator.geolocation` si besoin).
- Les transects gérés vont de T1 à T18. La désactivation/activation est gérée individuellement.

## À faire pour la phase suivante

**Livrable client / annexe de rapport** : équivalent de l'export PDF actuel du fichier Excel (tous les onglets jusqu'au dernier transect imprimés et annexés au rapport d'étude). À produire une fois la saisie stabilisée : génération d'un PDF mis en forme à partir du JSON, intégrable directement dans les annexes du rapport Aquascop. À traiter avec la chaîne Python aval (script de calcul des indicateurs + génération PDF mis en page).

