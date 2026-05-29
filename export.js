/* ============================================================
   Export JSON et Excel (.xlsx)
   ============================================================ */

const Exporter = {

  filenameSafe(op) {
    const st = op.station;
    // Slugification : retire les accents puis remplace tout ce qui n'est pas
    // alphanumérique par un seul _, et fusionne les _ multiples.
    const slug = (s) => (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // retire accents
      .replace(/[^a-zA-Z0-9]+/g, '_')                       // groupes non-alphanum -> _
      .replace(/^_+|_+$/g, '');                              // trim _
    const code = slug(st.code);
    const lib  = slug((st.libelle || '').slice(0, 60));
    const date = (st.date || '').replace(/-/g, '');
    // Format : CARHYCE_<libelle>_<date>  (ou avec code si pas de libelle)
    return ['CARHYCE', lib || code || 'op', date].filter(Boolean).join('_');
  },

  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // ---------- JSON ----------
  toJSON(op) {
    const exportable = {
      ...op,
      meta: {
        ...op.meta,
        exporte_le: new Date().toISOString(),
      },
    };
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
    this.download(blob, this.filenameSafe(op) + '.json');
    App.toast('Export JSON téléchargé');
  },

  // ---------- Excel ----------
  toXLSX(op) {
    if (typeof XLSX === 'undefined') {
      alert('La librairie d\'export Excel n\'est pas chargée. Vérifie ta connexion à internet (premier chargement).');
      return;
    }
    const wb = XLSX.utils.book_new();

    // ---- Feuille Station ----
    const st = op.station;
    const stationRows = [
      ['Application CARHYCE - Saisie terrain'],
      ['Exporté le', new Date().toISOString()],
      [],
      ['Informations générales'],
      ['Campagne', st.campagne],
      ['Code station', st.code],
      ['Libellé', st.libelle],
      ['Cours d\'eau', st.cours_eau],
      ['Masse d\'eau', st.masse_eau],
      ['Date', st.date],
      ['Heure', st.heure],
      ['Opérateurs', st.operateurs],
      ['Conditions météorologiques', st.conditions_meteo],
      ['Conditions hydrologiques', st.conditions_hydrologiques],
      ['Échelle limnimétrique', st.echelle_limni],
      ['Limpidité', st.limpidite],
      ['Propriété privée', st.propriete_privee],
      ['Végétation rivulaire', st.vegetation_rivulaire],
      ['Photos amont/aval', st.photos_amont_aval],
      [],
      ['Coordonnées RGF93 / Lambert 93 (m)'],
      ['X amont', st.x_amont],
      ['Y amont', st.y_amont],
      ['X aval', st.x_aval],
      ['Y aval', st.y_aval],
      [],
      ['Largeurs d\'évaluation'],
      ['Lpb mesure 1 (m)', st.lpb_ev_mesures[0]],
      ['Lpb mesure 2 (m)', st.lpb_ev_mesures[1]],
      ['Lpb mesure 3 (m)', st.lpb_ev_mesures[2]],
      ['Lm mesure 1 (m)',  st.lm_ev_mesures[0]],
      ['Lm mesure 2 (m)',  st.lm_ev_mesures[1]],
      ['Lm mesure 3 (m)',  st.lm_ev_mesures[2]],
      ['Longueur réelle (m)', st.longueur_reelle_m],
      ['Distance inter-points appliquée (m)', st.distance_interpoints_appliquee_m],
      [],
      ['Continuité de la ripisylve'],
      ['Rive gauche', st.continuite_ripisylve_rg],
      ['Rive droite', st.continuite_ripisylve_rd],
      [],
      ['Débit et pente'],
      ['Débit (m³/s)', st.debit_m3s],
      ['Pente estimée (‰)', st.pente_estimee_pourmille],
      ['Pente calculée (‰)', st.pente_calculee_pourmille],
      [],
      ['Habitats non minéraux marginaux'],
      ['Présence', st.habitats_non_min_marginaux.presence],
      ['Liste', (st.habitats_non_min_marginaux.liste || []).join(', ')],
      [],
      ['Remarques', st.remarques],
    ];
    const wsStation = XLSX.utils.aoa_to_sheet(stationRows);
    XLSX.utils.book_append_sheet(wb, wsStation, 'Station');

    // ---- Feuille Granulométrie ----
    const g = op.granulometrie;
    const granRows = [
      ['Granulométrie - Wolman'],
      ['Remarques', g.remarques],
      [],
      ['N°', 'Diamètre (mm)'],
    ];
    for (let i = 0; i < 100; i++) {
      granRows.push([i + 1, g.mesures_mm[i] == null ? '' : g.mesures_mm[i]]);
    }
    const wsGran = XLSX.utils.aoa_to_sheet(granRows);
    XLSX.utils.book_append_sheet(wb, wsGran, 'Granulométrie');

    // ---- Feuille Pente ----
    const penteRows = [
      ['Pente de la ligne d\'eau'],
      [],
      ['Tronçon', 'Limite aval', 'Limite amont', 'Distance (m)',
       'Aval Fh (cm)', 'Aval Fm (cm)', 'Aval Fb (cm)',
       'Amont Fh (cm)', 'Amont Fm (cm)', 'Amont Fb (cm)',
       'Δh (m)'],
    ];
    op.pente.troncons.forEach((tr, i) => {
      const dh = (tr.aval.fm != null && tr.amont.fm != null) ? (tr.aval.fm - tr.amont.fm) / 100 : null;
      penteRows.push([
        i + 1,
        tr.limite_aval, tr.limite_amont, tr.distance_m,
        tr.aval.fh, tr.aval.fm, tr.aval.fb,
        tr.amont.fh, tr.amont.fm, tr.amont.fb,
        dh,
      ]);
    });
    const wsPente = XLSX.utils.aoa_to_sheet(penteRows);
    XLSX.utils.book_append_sheet(wb, wsPente, 'Pente');

    // ---- Feuille Colmatage ----
    const c = op.colmatage;
    const colRows = [
      ['Colmatage'],
      ['Module activé', c.actif ? 'Oui' : 'Non'],
      ['Classe Archambaud', c.classe_archambaud],
      ['Date de pose', c.date_pose],
      ['Date de relève prévue', c.date_releve_prevue],
      ['Date de relève effective', c.date_releve_effective],
      ['Photos de la relève', c.photos_releve],
      ['Remarques', c.remarques],
      [],
    ];
    c.radiers.forEach(r => {
      colRows.push(['']);
      colRows.push([`Radier ${r.id}`]);
      colRows.push(['  Latitude WGS84', r.lat]);
      colRows.push(['  Longitude WGS84', r.lon]);
      colRows.push(['  X L93 (m)', r.x_l93]);
      colRows.push(['  Y L93 (m)', r.y_l93]);
      colRows.push(['  Indice de repérage', r.indice_position]);
      colRows.push(['  Remarques radier', r.remarques]);
      colRows.push(['  Nb bâtonnets', r.nb_batonnets]);
      colRows.push(['']);
      colRows.push(['  Bâtonnet', 'État', 'Profondeur oxy. (cm)']);
      r.batonnets.forEach(b => {
        colRows.push(['  ' + b.code, b.etat, b.profondeur_oxy_cm]);
      });
      const vals = r.batonnets.filter(b => b.profondeur_oxy_cm != null).map(b => +b.profondeur_oxy_cm);
      const moy = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
      colRows.push(['  Moyenne radier ' + r.id + ' (cm)', moy]);
    });
    const wsCol = XLSX.utils.aoa_to_sheet(colRows);
    XLSX.utils.book_append_sheet(wb, wsCol, 'Colmatage');

    // ---- Feuilles Transect ----
    op.transects.forEach(tr => {
      if (!tr.actif && tr.points.length === 0 && !tr.lpb_m) return;
      const rows = [
        [`Transect T${tr.numero}`],
        ['Rive de départ', tr.rive_depart],
        ['Lpb (m)', tr.lpb_m],
        ['Lm (m)', tr.lm_m],
        ['Hpb (m)', tr.hpb_m],
        ['Distance inter-points appliquée (m)', tr.distance_interpoints_appliquee_m],
        ['Modification - type', tr.modification.type],
        ['Modification - raison', tr.modification.raison],
        ['Faciès simplifié', tr.facies_simplifie],
        ['Faciès affiné', tr.facies_affine],
        [],
        ['Points de mesure'],
        ['N°', 'Distance (m)', 'Profondeur (cm)', 'Substrat minéral', 'Add. 1', 'Add. 2'],
      ];
      tr.points.forEach((p, i) => {
        rows.push([i, p.distance_m, p.profondeur_cm, p.substrat_min, p.substrat_add_1, p.substrat_add_2]);
      });
      rows.push([]);
      rows.push(['Ripisylve RG']);
      ['arboree','arbustive','herbacee'].forEach(s => {
        const d = tr.ripisylve_rg[s];
        rows.push([s, d.presente ? 'présente' : 'absente', d.epaisseur, d.type]);
      });
      rows.push(['Plus recouvrante RG', tr.ripisylve_rg.plus_recouvrante]);
      rows.push([]);
      rows.push(['Ripisylve RD']);
      ['arboree','arbustive','herbacee'].forEach(s => {
        const d = tr.ripisylve_rd[s];
        rows.push([s, d.presente ? 'présente' : 'absente', d.epaisseur, d.type]);
      });
      rows.push(['Plus recouvrante RD', tr.ripisylve_rd.plus_recouvrante]);
      rows.push([]);
      rows.push(['Berge RG', 'Matériaux', tr.berge_rg.materiaux]);
      rows.push(['', 'Habitats', (tr.berge_rg.habitats || []).join(', ')]);
      rows.push(['Berge RD', 'Matériaux', tr.berge_rd.materiaux]);
      rows.push(['', 'Habitats', (tr.berge_rd.habitats || []).join(', ')]);
      rows.push([]);
      rows.push(['Remarques', tr.remarques]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `T${tr.numero}`);
    });

    // Écriture du fichier
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    this.download(blob, this.filenameSafe(op) + '.xlsx');
    App.toast('Export Excel téléchargé');
  },
};
