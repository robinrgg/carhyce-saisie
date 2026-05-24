// Persistance locale via IndexedDB
// Une "opération" = une campagne CARHYCE complète sur une station

const DB_NAME = 'carhyce-db';
const DB_VERSION = 1;
const STORE = 'operations';

const DB = {

  _db: null,

  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updated_at', 'updated_at');
          store.createIndex('station_libelle', 'station.libelle');
        }
      };
      req.onsuccess = () => {
        this._db = req.result;
        resolve(this._db);
      };
    });
  },

  async _tx(mode = 'readonly') {
    const db = await this.open();
    return db.transaction(STORE, mode).objectStore(STORE);
  },

  async list() {
    const store = await this._tx();
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = req.result.sort((a, b) =>
          (b.updated_at || '').localeCompare(a.updated_at || '')
        );
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async get(id) {
    const store = await this._tx();
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(op) {
    op.updated_at = new Date().toISOString();
    const store = await this._tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(op);
      req.onsuccess = () => resolve(op);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(id) {
    const store = await this._tx('readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  newOperation() {
    const id = 'op_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    return {
      id,
      meta: {
        schema_version: '1.0',
        application: 'CARHYCE Saisie Terrain',
        created_at: now,
      },
      station: {
        campagne: '',
        code: '',
        libelle: '',
        cours_eau: '',
        masse_eau: '',
        date: now.slice(0, 10),
        heure: now.slice(11, 16),
        operateurs: '',
        conditions_meteo: '',
        conditions_hydrologiques: '',
        echelle_limni: '',
        propriete_privee: '',
        vegetation_rivulaire: '',
        limpidite: '',
        x_amont: null,
        y_amont: null,
        x_aval: null,
        y_aval: null,
        srs: 'RGF93 / Lambert 93 (EPSG:2154)',
        lpb_ev_mesures: [null, null, null],
        lm_ev_mesures: [null, null, null],
        longueur_reelle_m: null,
        distance_interpoints_appliquee_m: null,
        continuite_ripisylve_rg: '',
        continuite_ripisylve_rd: '',
        debit_m3s: null,
        pente_estimee_pourmille: null,
        pente_calculee_pourmille: null,
        habitats_non_min_marginaux: {
          presence: '',
          liste: [],
        },
        photos_amont_aval: '',
        remarques: '',
      },
      granulometrie: {
        date_pose: '',
        situation_particuliere: 'Aucune',
        mesures_mm: [],  // jusqu'à 100 mesures
        remarques: '',
      },
      pente: {
        troncons: [],  // {n, limite_aval, limite_amont, distance_m, aval:{fh,fm,fb}, amont:{fh,fm,fb}}
      },
      colmatage: {
        actif: true,
        classe_archambaud: '',
        remarques: '',
        date_pose: '',
        date_releve_prevue: '',
        date_releve_effective: '',
        photos_releve: '',
        radiers: [
          { id: 'A', lat: null, lon: null, x_l93: null, y_l93: null, indice_position: '', remarques: '', nb_batonnets: 4, batonnets: [
            { code: 'A1', etat: '', profondeur_oxy_cm: null },
            { code: 'A2', etat: '', profondeur_oxy_cm: null },
            { code: 'A3', etat: '', profondeur_oxy_cm: null },
            { code: 'A4', etat: '', profondeur_oxy_cm: null },
          ]},
          { id: 'B', lat: null, lon: null, x_l93: null, y_l93: null, indice_position: '', remarques: '', nb_batonnets: 4, batonnets: [
            { code: 'B1', etat: '', profondeur_oxy_cm: null },
            { code: 'B2', etat: '', profondeur_oxy_cm: null },
            { code: 'B3', etat: '', profondeur_oxy_cm: null },
            { code: 'B4', etat: '', profondeur_oxy_cm: null },
          ]},
        ],
      },
      transects: Array.from({ length: 18 }, (_, i) => ({
        numero: i + 1,
        actif: i < 15,  // 15 transects standards activés par défaut, 16-18 optionnels
        rive_depart: 'Gauche',
        lpb_m: null,
        lm_m: null,
        hpb_m: null,
        modification: { type: 'Aucune', raison: '' },
        distance_interpoints_appliquee_m: null,
        points: [],  // {distance_m, profondeur_cm, substrat_min, substrat_add_1, substrat_add_2}
        facies_simplifie: '',
        facies_affine: '',
        ripisylve_rg: {
          arboree:  { presente: false, epaisseur: 'Absente', type: 'Absente' },
          arbustive:{ presente: false, epaisseur: 'Absente', type: 'Absente' },
          herbacee: { presente: false, epaisseur: 'Absente', type: 'Absente' },
          plus_recouvrante: 'Aucune',
        },
        ripisylve_rd: {
          arboree:  { presente: false, epaisseur: 'Absente', type: 'Absente' },
          arbustive:{ presente: false, epaisseur: 'Absente', type: 'Absente' },
          herbacee: { presente: false, epaisseur: 'Absente', type: 'Absente' },
          plus_recouvrante: 'Aucune',
        },
        berge_rg: { materiaux: '', habitats: [] },
        berge_rd: { materiaux: '', habitats: [] },
        remarques: '',
      })),
    };
  },
};
