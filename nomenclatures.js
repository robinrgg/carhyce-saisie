// Nomenclatures CARHYCE - codes et libellés issus du fichier de référence Aquascop
// Toutes les listes utilisées par les sélecteurs de l'application

const NOM = {

  conditions_hydrologiques: [
    'Assec',
    'Etiage certain',
    'Etiage probable',
    'Hydrologie stable hors étiage',
    'Autre',
  ],

  conditions_meteo: [
    'Sec ensoleillé',
    'Sec couvert',
    'Humide',
    'Pluie',
    'Orage',
  ],

  echelle_limni: [
    'Echelle absente',
    'Echelle lisible',
    'Echelle hors d\'eau',
    'Echelle à dégager',
    'Echelle hors d\'usage',
  ],

  limpidite: [
    'Limpide',
    'Légèrement trouble',
    'Trouble',
  ],

  vegetation_rivulaire: [
    'Naturelle',
    'Naturelle jardinée',
    'Exogène',
    'Plantée',
  ],

  oui_non: ['Oui', 'Non'],

  continuite_ripisylve: [
    'Absence',
    'Isolée',
    'Espacée régulière',
    'Bosquets éparses',
    'Semi-continue',
    'Continue',
  ],

  rive: ['Gauche', 'Droite'],

  // Substrats minéraux : code, libellé, borne inf (mm), borne sup (mm)
  // TV = Terre Végétale, valeur par défaut pour les points hors d'eau (berges sèches)
  substrats_mineraux: [
    { code: 'TV', libelle: 'Terre végétale',     min: null,   max: null },
    { code: 'V',  libelle: 'Vases',              min: 0,      max: 0.0625 },
    { code: 'A',  libelle: 'Argiles',            min: 0,      max: 0.0625 },
    { code: 'L',  libelle: 'Limons',             min: 0,      max: 0.0625 },
    { code: 'S',  libelle: 'Sables',             min: 0.0625, max: 2 },
    { code: 'GF', libelle: 'Graviers fins',      min: 2,      max: 8 },
    { code: 'GG', libelle: 'Graviers grossiers', min: 8,      max: 16 },
    { code: 'CF', libelle: 'Cailloux fins',      min: 16,     max: 32 },
    { code: 'CG', libelle: 'Cailloux grossiers', min: 32,     max: 64 },
    { code: 'PF', libelle: 'Pierres fines',      min: 64,     max: 128 },
    { code: 'PG', libelle: 'Pierres grossières', min: 128,    max: 256 },
    { code: 'B',  libelle: 'Blocs',              min: 256,    max: 1024 },
    { code: 'R',  libelle: 'Rochers',            min: 1024,   max: 2048 },
    { code: 'D',  libelle: 'Dalles',             min: null,   max: null },
  ],

  // Substrats additionnels (habitats non minéraux marginaux)
  substrats_additionnels: [
    { code: 'VA', libelle: 'Végétation aquatique' },
    { code: 'PD', libelle: 'Pool détritique' },
    { code: 'CR', libelle: 'Chevelu racinaire' },
    { code: 'VS', libelle: 'Végétation surplombante' },
    { code: 'DL', libelle: 'Débris ligneux grossiers, embâcle' },
    { code: 'CC', libelle: 'Concrétion calcaire' },
  ],

  facies_simplifie: [
    'Mouille',
    'Plat lentique',
    'Plat courant',
    'Radier Rapide',
  ],

  facies_affine: [
    'Chenal lentique',
    'Fosse de dissipation',
    'Mouille de concavité',
    'Fosse d\'affouillement',
    'Chenal lotique',
    'Plat lentique',
    'Plat courant',
    'Radier',
    'Rapide',
    'Cascade',
    'Chute',
  ],

  strates_ripisylve: ['Arborée', 'Arbustive', 'Herbacée'],

  epaisseur_strate: [
    'Absente',
    'Entre 0 et 5 m',
    'Entre 5 et 10 m',
    'Entre 10 et 25 m',
    'Supérieure à 25 m',
  ],

  type_vegetation: [
    'Absente',
    'Naturelle',
    'Exotique',
    'Plantée',
  ],

  strate_plus_recouvrante: [
    'Aucune',
    'Strate arborée',
    'Strate arbustive',
    'Strate herbacée',
  ],

  materiaux_berges: [
    'Matériaux naturels',
    'Aménagements végétalisés',
    'Enrochement',
    'Matériaux artificiels',
  ],

  // Habitats caractéristiques des berges
  habitats_berges: [
    { code: 'SB', libelle: 'Sous-berge' },
    { code: 'CR', libelle: 'Chevelu racinaire' },
    { code: 'DL', libelle: 'Débris ligneux grossiers, embâcles' },
    { code: 'BR', libelle: 'Blocs rocheux' },
    { code: 'VS', libelle: 'Végétation surplombante' },
    { code: 'VA', libelle: 'Végétation aquatique' },
  ],

  modification_transect: [
    'Aucune',
    'Déplacement',
    'Suppression',
    'Ajout',
  ],

  visee_stadimetrique: ['Fh', 'Fm', 'Fb'],

  etat_batonnet: [
    'En place',
    'Déplacé',
    'Perdu',
    'Cassé',
  ],
};
