/* ============================================================
   CARHYCE Saisie Terrain — Application principale
   ============================================================ */

const App = {

  state: {
    op: null,           // opération en cours
    screen: 'home',     // écran actif
    currentTransect: 0, // index du transect en cours d'édition
  },

  // ----------- Initialisation -----------
  async init() {
    await DB.open();
    this.bindHeader();
    this.bindHome();
    this.bindOperationScreen();
    this.bindExport();
    await this.showHome();
    this.registerSW();
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err =>
        console.warn('SW registration failed:', err)
      );
    }
  },

  // ----------- Routage entre écrans -----------
  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.add('active');
    this.state.screen = name;
    window.scrollTo(0, 0);
  },

  async showHome() {
    this.state.op = null;
    document.getElementById('app-title').textContent = 'CARHYCE';
    const list = document.getElementById('op-list');
    const empty = document.getElementById('op-list-empty');
    const operations = await DB.list();
    list.innerHTML = '';
    if (operations.length === 0) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      operations.forEach(op => {
        const li = document.createElement('li');
        const meta = document.createElement('div');
        meta.className = 'op-meta';
        const name = document.createElement('span');
        name.className = 'op-name';
        name.textContent = op.station.libelle || op.station.code || '(opération sans nom)';
        const sub = document.createElement('span');
        sub.textContent = [
          op.station.date || '—',
          op.station.cours_eau,
          op.station.campagne,
        ].filter(Boolean).join(' · ');
        meta.appendChild(name);
        meta.appendChild(sub);
        const arrow = document.createElement('span');
        arrow.textContent = '›';
        arrow.style.fontSize = '1.5rem';
        arrow.style.color = 'var(--text-muted)';
        li.appendChild(meta);
        li.appendChild(arrow);
        li.addEventListener('click', () => this.openOperation(op.id));
        list.appendChild(li);
      });
    }
    this.showScreen('home');
  },

  bindHome() {
    document.getElementById('btn-new-op').addEventListener('click', async () => {
      const op = DB.newOperation();
      await DB.put(op);
      await this.openOperation(op.id);
    });
    document.getElementById('btn-import').addEventListener('click', () =>
      document.getElementById('file-import').click()
    );
    document.getElementById('file-import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.id) data.id = 'op_' + Date.now() + '_imp';
        await DB.put(data);
        this.toast('Opération importée');
        await this.showHome();
      } catch (err) {
        alert('Fichier JSON invalide : ' + err.message);
      }
      e.target.value = '';
    });
  },

  bindHeader() {
    document.getElementById('btn-menu').addEventListener('click', () => {
      // Retour à l'écran opération si on est dans une sous-section, sinon home
      if (this.state.op && ['station','granulo','pente','colmatage','transects','transect-edit','export'].includes(this.state.screen)) {
        if (this.state.screen === 'transect-edit') {
          this.openTransects();
        } else {
          this.openOperationScreen();
        }
      } else {
        this.showHome();
      }
    });
  },

  // ----------- Écran opération (sommaire) -----------
  async openOperation(id) {
    const op = await DB.get(id);
    if (!op) {
      alert('Opération introuvable');
      this.showHome();
      return;
    }
    this.state.op = op;
    this.openOperationScreen();
  },

  openOperationScreen() {
    const op = this.state.op;
    document.getElementById('app-title').textContent = op.station.libelle || 'Opération';
    document.getElementById('op-title').textContent = op.station.libelle || '(opération sans nom)';
    document.getElementById('op-subtitle').textContent = [
      op.station.code,
      op.station.cours_eau,
      op.station.date,
      op.station.campagne
    ].filter(Boolean).join(' · ');
    this.updateProgress();
    this.showScreen('op');
  },

  bindOperationScreen() {
    document.querySelectorAll('#screen-op [data-go]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-go');
        switch (target) {
          case 'station':   this.renderStation();   this.showScreen('station');   break;
          case 'granulo':   this.renderGranulo();   this.showScreen('granulo');   break;
          case 'pente':     this.renderPente();     this.showScreen('pente');     break;
          case 'colmatage': this.renderColmatage(); this.showScreen('colmatage'); break;
          case 'transects': this.openTransects();   break;
          case 'export':    this.renderExport();    this.showScreen('export');    break;
        }
      });
    });
    document.getElementById('btn-delete-op').addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement cette opération ? Cette action est irréversible.')) return;
      await DB.delete(this.state.op.id);
      this.toast('Opération supprimée');
      await this.showHome();
    });
  },

  updateProgress() {
    const op = this.state.op;
    const set = (id, txt, done) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = txt;
      el.classList.toggle('done', done);
    };
    // Station
    const st = op.station;
    const stFilled = [st.code, st.cours_eau, st.date, st.lpb_ev_mesures[0], st.debit_m3s].filter(v => v !== null && v !== '').length;
    set('prog-station', stFilled >= 5 ? '✓ saisi' : `${stFilled}/5 champs clés`, stFilled >= 5);
    // Granulo
    const gNb = op.granulometrie.mesures_mm.filter(x => x != null && x !== '').length;
    set('prog-granulo', gNb === 0 ? 'À saisir' : `${gNb}/100 mesures`, gNb >= 100);
    // Pente
    const pNb = op.pente.troncons.length;
    set('prog-pente', pNb === 0 ? 'À saisir' : `${pNb} tronçon${pNb>1?'s':''}`, pNb >= 1);
    // Colmatage
    if (!op.colmatage.actif) {
      set('prog-colmatage', 'Désactivé', false);
    } else {
      const allBat = op.colmatage.radiers.flatMap(r => r.batonnets);
      const releve = allBat.filter(b => b.profondeur_oxy_cm != null).length;
      set('prog-colmatage', `${releve}/${allBat.length} relevés`, releve === allBat.length);
    }
    // Transects
    const tActifs = op.transects.filter(t => t.actif);
    const tDone = tActifs.filter(t => t.points.length > 0 && t.lpb_m && t.hpb_m).length;
    set('prog-transects', `${tDone}/${tActifs.length} transects`, tDone === tActifs.length && tActifs.length > 0);
  },

  // ============================================================
  //   Sauvegarde et indicateur
  // ============================================================
  _saveTimer: null,
  async scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      await DB.put(this.state.op);
      this.flashSaved();
      this.updateProgress();
    }, 400);
  },

  flashSaved() {
    const el = document.getElementById('save-indicator');
    el.textContent = '✓ sauvé';
    el.classList.add('visible');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => el.classList.remove('visible'), 1200);
  },

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  },

  // ============================================================
  //   Helpers de génération de champs
  // ============================================================

  field({ label, type = 'text', value, onChange, options, note, readonly, full, placeholder, inputmode, step }) {
    const f = document.createElement('div');
    f.className = 'field' + (full ? ' full' : '');
    const lbl = document.createElement('label');
    lbl.textContent = label;
    f.appendChild(lbl);

    let input;
    if (type === 'select') {
      input = document.createElement('select');
      const blank = document.createElement('option');
      blank.value = ''; blank.textContent = '—';
      input.appendChild(blank);
      options.forEach(opt => {
        const o = document.createElement('option');
        if (typeof opt === 'string') {
          o.value = opt; o.textContent = opt;
        } else {
          o.value = opt.value !== undefined ? opt.value : opt.code;
          o.textContent = opt.label !== undefined ? opt.label : (opt.code ? `${opt.code} — ${opt.libelle}` : opt.libelle);
        }
        input.appendChild(o);
      });
      input.value = value == null ? '' : value;
    } else if (type === 'textarea') {
      input = document.createElement('textarea');
      input.value = value || '';
      if (placeholder) input.placeholder = placeholder;
    } else {
      input = document.createElement('input');
      input.type = type;
      if (placeholder) input.placeholder = placeholder;
      if (inputmode) input.inputMode = inputmode;
      if (step) input.step = step;
      if (type === 'number') input.inputMode = 'decimal';
      input.value = value == null ? '' : value;
    }
    if (readonly) input.readOnly = true;
    if (onChange) {
      input.addEventListener('input', () => {
        let v = input.value;
        if (type === 'number') v = v === '' ? null : parseFloat(v);
        onChange(v);
        this.scheduleSave();
      });
      input.addEventListener('change', () => {
        let v = input.value;
        if (type === 'number') v = v === '' ? null : parseFloat(v);
        onChange(v);
        this.scheduleSave();
      });
    }
    f.appendChild(input);
    if (note) {
      const n = document.createElement('div');
      n.className = 'field-note';
      n.textContent = note;
      f.appendChild(n);
    }
    return f;
  },

  calcField({ label, value, unit, note }) {
    const f = document.createElement('div');
    f.className = 'field';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    f.appendChild(lbl);
    const div = document.createElement('div');
    div.className = 'calc-value';
    div.textContent = (value == null || isNaN(value)) ? '—' : `${(+value).toFixed(2)} ${unit || ''}`;
    f.appendChild(div);
    if (note) {
      const n = document.createElement('div');
      n.className = 'field-note';
      n.textContent = note;
      f.appendChild(n);
    }
    return f;
  },

  checkboxGroup({ options, selected, onChange }) {
    const group = document.createElement('div');
    group.className = 'checkbox-group';
    options.forEach(opt => {
      const code = typeof opt === 'string' ? opt : opt.code;
      const label = typeof opt === 'string' ? opt : `${opt.code} — ${opt.libelle}`;
      const lbl = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = code;
      cb.checked = (selected || []).includes(code);
      cb.addEventListener('change', () => {
        const set = new Set(selected || []);
        if (cb.checked) set.add(code); else set.delete(code);
        onChange(Array.from(set));
        this.scheduleSave();
      });
      const span = document.createElement('span');
      span.textContent = label;
      lbl.appendChild(cb);
      lbl.appendChild(span);
      group.appendChild(lbl);
    });
    return group;
  },

  section(title, { collapsible = false, collapsed = false } = {}) {
    const sec = document.createElement('div');
    sec.className = 'form-section' + (collapsible ? ' collapsible' : '') + (collapsed ? ' collapsed' : '');
    const h3 = document.createElement('h3');
    h3.textContent = title;
    sec.appendChild(h3);
    const body = document.createElement('div');
    body.className = 'form-body';
    sec.appendChild(body);
    if (collapsible) {
      h3.addEventListener('click', () => sec.classList.toggle('collapsed'));
    }
    return { section: sec, body };
  },

  grid() {
    const g = document.createElement('div');
    g.className = 'field-grid';
    return g;
  },

  // ============================================================
  //   ÉCRAN STATION
  // ============================================================
  renderStation() {
    const op = this.state.op;
    const st = op.station;
    const root = document.getElementById('form-station');
    root.innerHTML = '';

    // --- Informations générales
    {
      const { section, body } = this.section('Informations générales');
      const g = this.grid();
      g.appendChild(this.field({ label: 'Campagne', value: st.campagne, onChange: v => st.campagne = v }));
      g.appendChild(this.field({ label: 'Code station', value: st.code, onChange: v => st.code = v, placeholder: 'ex. 06198506' }));
      g.appendChild(this.field({ label: 'Libellé station', value: st.libelle, onChange: v => st.libelle = v, full: true, placeholder: 'ex. Huveaune à Marseille 4' }));
      g.appendChild(this.field({ label: 'Cours d\'eau', value: st.cours_eau, onChange: v => st.cours_eau = v }));
      g.appendChild(this.field({ label: 'Masse d\'eau', value: st.masse_eau, onChange: v => st.masse_eau = v, full: true }));
      g.appendChild(this.field({ label: 'Date du relevé', type: 'date', value: st.date, onChange: v => st.date = v }));
      g.appendChild(this.field({ label: 'Heure', type: 'time', value: st.heure, onChange: v => st.heure = v }));
      g.appendChild(this.field({ label: 'Opérateurs', value: st.operateurs, onChange: v => st.operateurs = v, placeholder: 'ex. RREG, JNIE', full: true }));
      g.appendChild(this.field({ label: 'Conditions météorologiques', type: 'select', options: NOM.conditions_meteo, value: st.conditions_meteo, onChange: v => st.conditions_meteo = v }));
      g.appendChild(this.field({ label: 'Conditions hydrologiques', type: 'select', options: NOM.conditions_hydrologiques, value: st.conditions_hydrologiques, onChange: v => st.conditions_hydrologiques = v }));
      g.appendChild(this.field({ label: 'Échelle limnimétrique', type: 'select', options: NOM.echelle_limni, value: st.echelle_limni, onChange: v => st.echelle_limni = v }));
      g.appendChild(this.field({ label: 'Limpidité', type: 'select', options: NOM.limpidite, value: st.limpidite, onChange: v => st.limpidite = v }));
      g.appendChild(this.field({ label: 'Propriété privée', type: 'select', options: NOM.oui_non, value: st.propriete_privee, onChange: v => st.propriete_privee = v }));
      g.appendChild(this.field({ label: 'Végétation rivulaire', type: 'select', options: NOM.vegetation_rivulaire, value: st.vegetation_rivulaire, onChange: v => st.vegetation_rivulaire = v }));
      g.appendChild(this.field({ label: 'Photos amont/aval prises ?', type: 'select', options: NOM.oui_non, value: st.photos_amont_aval, onChange: v => st.photos_amont_aval = v }));
      body.appendChild(g);
      root.appendChild(section);
    }

    // --- Coordonnées (RGF93 Lambert 93)
    {
      const { section, body } = this.section('Coordonnées RGF93 / Lambert 93 (m)');
      const g = this.grid();
      g.appendChild(this.field({ label: 'X amont (m)', type: 'number', value: st.x_amont, onChange: v => st.x_amont = v }));
      g.appendChild(this.field({ label: 'Y amont (m)', type: 'number', value: st.y_amont, onChange: v => st.y_amont = v }));
      g.appendChild(this.field({ label: 'X aval (m)', type: 'number', value: st.x_aval, onChange: v => st.x_aval = v }));
      g.appendChild(this.field({ label: 'Y aval (m)', type: 'number', value: st.y_aval, onChange: v => st.y_aval = v }));
      body.appendChild(g);
      root.appendChild(section);
    }

    // --- Caractéristiques (Lpb-ev, Lm-ev, longueur)
    {
      const { section, body } = this.section('Largeurs d\'évaluation et longueur de station');
      body.appendChild(this.renderLpbLmBlock(st));
      root.appendChild(section);
    }

    // --- Continuité de la ripisylve
    {
      const { section, body } = this.section('Continuité longitudinale de la ripisylve');
      const g = this.grid();
      g.appendChild(this.field({ label: 'Rive gauche', type: 'select', options: NOM.continuite_ripisylve, value: st.continuite_ripisylve_rg, onChange: v => st.continuite_ripisylve_rg = v }));
      g.appendChild(this.field({ label: 'Rive droite', type: 'select', options: NOM.continuite_ripisylve, value: st.continuite_ripisylve_rd, onChange: v => st.continuite_ripisylve_rd = v }));
      body.appendChild(g);
      root.appendChild(section);
    }

    // --- Débit et pente
    {
      const { section, body } = this.section('Débit et pente');
      const g = this.grid();
      g.appendChild(this.field({ label: 'Débit mesuré (m³/s)', type: 'number', step: '0.001', value: st.debit_m3s, onChange: v => st.debit_m3s = v }));
      g.appendChild(this.field({ label: 'Pente estimée (‰)', type: 'number', step: '0.01', value: st.pente_estimee_pourmille, onChange: v => st.pente_estimee_pourmille = v, note: 'Calculée depuis l\'écran « Pente »' }));
      g.appendChild(this.field({ label: 'Pente calculée (‰)', type: 'number', step: '0.01', value: st.pente_calculee_pourmille, onChange: v => st.pente_calculee_pourmille = v, note: 'Calculée depuis l\'écran « Pente »' }));
      body.appendChild(g);
      root.appendChild(section);
    }

    // --- Habitats non minéraux marginaux
    {
      const { section, body } = this.section('Habitats non minéraux marginaux');
      const g = this.grid();
      g.appendChild(this.field({ label: 'Présence', type: 'select', options: NOM.oui_non, value: st.habitats_non_min_marginaux.presence, onChange: v => st.habitats_non_min_marginaux.presence = v }));
      body.appendChild(g);
      const lbl = document.createElement('label');
      lbl.style.fontWeight = '500';
      lbl.style.fontSize = '0.85rem';
      lbl.textContent = 'Habitats observés (cocher) :';
      body.appendChild(lbl);
      body.appendChild(this.checkboxGroup({
        options: NOM.substrats_additionnels,
        selected: st.habitats_non_min_marginaux.liste,
        onChange: v => st.habitats_non_min_marginaux.liste = v,
      }));
      root.appendChild(section);
    }

    // --- Remarques
    {
      const { section, body } = this.section('Remarques sur la station');
      body.appendChild(this.field({ label: 'Observations libres', type: 'textarea', value: st.remarques, onChange: v => st.remarques = v, full: true }));
      root.appendChild(section);
    }
  },

  renderLpbLmBlock(st) {
    const container = document.createElement('div');

    // 3 mesures Lpb
    const lpbRow = this.grid();
    [0,1,2].forEach(i => {
      lpbRow.appendChild(this.field({
        label: `Lpb mesure ${i+1} (m)`,
        type: 'number', step: '0.1',
        value: st.lpb_ev_mesures[i],
        onChange: v => { st.lpb_ev_mesures[i] = v; this.refreshLpbLmCalcs(); }
      }));
    });
    container.appendChild(lpbRow);

    // 3 mesures Lm
    const lmRow = this.grid();
    [0,1,2].forEach(i => {
      lmRow.appendChild(this.field({
        label: `Lm mesure ${i+1} (m)`,
        type: 'number', step: '0.1',
        value: st.lm_ev_mesures[i],
        onChange: v => { st.lm_ev_mesures[i] = v; this.refreshLpbLmCalcs(); }
      }));
    });
    container.appendChild(lmRow);

    // Calculs auto
    const calcRow = this.grid();
    const lpbEvMean = this.avg(st.lpb_ev_mesures);
    const lmEvMean  = this.avg(st.lm_ev_mesures);
    const lTheo     = lpbEvMean != null ? lpbEvMean * 14 : null;
    const dTheo     = lmEvMean  != null ? lmEvMean / 7   : null;

    this._lpbCalcRow = calcRow;
    calcRow.appendChild(this.calcField({ label: 'Lpb-ev moyen (m)', value: lpbEvMean, unit: 'm' }));
    calcRow.appendChild(this.calcField({ label: 'Lm-ev moyen (m)', value: lmEvMean, unit: 'm' }));
    calcRow.appendChild(this.calcField({ label: 'L théorique (= 14 × Lpb-ev)', value: lTheo, unit: 'm' }));
    calcRow.appendChild(this.calcField({ label: 'Distance inter-points théorique (= Lm-ev / 7)', value: dTheo, unit: 'm' }));
    container.appendChild(calcRow);

    // Longueur réelle + distance inter-points appliquée
    const realRow = this.grid();
    realRow.appendChild(this.field({
      label: 'Longueur réelle de station (m)',
      type: 'number', step: '0.1',
      value: st.longueur_reelle_m,
      onChange: v => st.longueur_reelle_m = v,
      note: 'Mesurée sur le terrain',
    }));
    realRow.appendChild(this.field({
      label: 'Distance inter-points appliquée (m)',
      type: 'number', step: '0.01',
      value: st.distance_interpoints_appliquee_m,
      onChange: v => st.distance_interpoints_appliquee_m = v,
      note: 'Souvent arrondie depuis la valeur théorique',
    }));
    container.appendChild(realRow);
    return container;
  },

  refreshLpbLmCalcs() {
    const st = this.state.op.station;
    if (!this._lpbCalcRow) return;
    const lpbEvMean = this.avg(st.lpb_ev_mesures);
    const lmEvMean  = this.avg(st.lm_ev_mesures);
    const lTheo     = lpbEvMean != null ? lpbEvMean * 14 : null;
    const dTheo     = lmEvMean  != null ? lmEvMean / 7   : null;
    const vals = [lpbEvMean, lmEvMean, lTheo, dTheo];
    this._lpbCalcRow.querySelectorAll('.calc-value').forEach((el, i) => {
      const v = vals[i];
      el.textContent = (v == null || isNaN(v)) ? '—' : `${v.toFixed(2)} m`;
    });
  },

  avg(arr) {
    const nums = arr.filter(v => v != null && v !== '' && !isNaN(v)).map(Number);
    if (nums.length === 0) return null;
    return nums.reduce((a,b)=>a+b, 0) / nums.length;
  },

  // ============================================================
  //   ÉCRAN GRANULOMÉTRIE
  // ============================================================
  renderGranulo() {
    const op = this.state.op;
    const g = op.granulometrie;
    const root = document.getElementById('form-granulo');
    root.innerHTML = '';

    // Métadonnées
    {
      const { section, body } = this.section('Pose du Wolman');
      const grid = this.grid();
      grid.appendChild(this.field({ label: 'Date de pose', type: 'date', value: g.date_pose, onChange: v => g.date_pose = v }));
      grid.appendChild(this.field({ label: 'Situation particulière', value: g.situation_particuliere, onChange: v => g.situation_particuliere = v, placeholder: 'Aucune si rien à signaler' }));
      body.appendChild(grid);
      root.appendChild(section);
    }

    // Grille de saisie 100 mesures
    {
      const { section, body } = this.section('Diamètres mesurés (mm) — 100 éléments');
      const info = document.createElement('div');
      info.className = 'info-banner';
      info.textContent = 'Saisir le diamètre perpendiculaire au plus grand axe. La grille contient 100 cases : utilisez la touche TAB pour passer d\'une case à la suivante.';
      body.appendChild(info);

      const grid = document.createElement('div');
      grid.className = 'granulo-grid';
      // S'assure que le tableau fait 100 entrées
      while (g.mesures_mm.length < 100) g.mesures_mm.push(null);
      for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.className = 'granulo-cell';
        const num = document.createElement('span');
        num.className = 'gr-num';
        num.textContent = (i+1).toString();
        cell.appendChild(num);
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.inputMode = 'numeric';
        inp.step = '1';
        inp.min = '0';
        inp.value = g.mesures_mm[i] == null ? '' : g.mesures_mm[i];
        inp.addEventListener('input', () => {
          const v = inp.value === '' ? null : parseFloat(inp.value);
          g.mesures_mm[i] = v;
          this.refreshGranuloStats();
          this.scheduleSave();
        });
        cell.appendChild(inp);
        grid.appendChild(cell);
      }
      body.appendChild(grid);

      // Statistiques
      const stats = document.createElement('div');
      stats.className = 'granulo-stats';
      stats.id = 'granulo-stats';
      body.appendChild(stats);
      this.refreshGranuloStats();
      root.appendChild(section);
    }

    // Remarques
    {
      const { section, body } = this.section('Remarques');
      body.appendChild(this.field({ label: 'Observations libres', type: 'textarea', value: g.remarques, onChange: v => g.remarques = v, full: true }));
      root.appendChild(section);
    }
  },

  refreshGranuloStats() {
    const arr = (this.state.op.granulometrie.mesures_mm || []).filter(v => v != null && !isNaN(v)).map(Number);
    const el = document.getElementById('granulo-stats');
    if (!el) return;
    const n = arr.length;
    const sorted = [...arr].sort((a,b)=>a-b);
    const pct = (p) => {
      if (n === 0) return null;
      const idx = (n - 1) * p;
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    };
    const d16 = pct(0.16), d50 = pct(0.5), d84 = pct(0.84);
    const ratio = (d16 && d84) ? d84/d16 : null;
    const fmt = v => (v == null) ? '—' : v.toFixed(1) + ' mm';
    el.innerHTML = '';
    const cells = [
      { label: 'N saisi', value: `${n} / 100` },
      { label: 'D16', value: fmt(d16) },
      { label: 'D50 (médian)', value: fmt(d50) },
      { label: 'D84', value: fmt(d84) },
      { label: 'D84 / D16', value: ratio == null ? '—' : ratio.toFixed(2) },
      { label: 'Min', value: fmt(arr.length ? Math.min(...arr) : null) },
      { label: 'Max', value: fmt(arr.length ? Math.max(...arr) : null) },
    ];
    cells.forEach(c => {
      const div = document.createElement('div');
      div.className = 'stat';
      div.innerHTML = `<div class="label">${c.label}</div><div class="value">${c.value}</div>`;
      el.appendChild(div);
    });
  },

  // ============================================================
  //   ÉCRAN PENTE
  // ============================================================
  renderPente() {
    const op = this.state.op;
    const p = op.pente;
    const root = document.getElementById('form-pente');
    root.innerHTML = '';

    const info = document.createElement('div');
    info.className = 'info-banner';
    info.innerHTML = 'Pour chaque tronçon, saisir la distance et les <strong>trois fils stadimétriques</strong> (haut, médian, bas) pour la visée aval puis la visée amont. La pente est calculée à partir des Fm.';
    root.appendChild(info);

    const listSec = this.section('Tronçons');
    root.appendChild(listSec.section);
    const list = document.createElement('div');
    list.id = 'troncons-list';
    listSec.body.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.className = 'primary-btn';
    addBtn.textContent = '＋ Ajouter un tronçon';
    addBtn.style.marginTop = '0.6rem';
    addBtn.addEventListener('click', () => {
      p.troncons.push({
        n: p.troncons.length + 1,
        limite_aval: '',
        limite_amont: '',
        distance_m: null,
        aval:  { fh: null, fm: null, fb: null },
        amont: { fh: null, fm: null, fb: null },
      });
      this.refreshTroncons();
      this.scheduleSave();
    });
    listSec.body.appendChild(addBtn);

    // Calcul de pente
    const calcSec = this.section('Calcul de la pente');
    root.appendChild(calcSec.section);
    const calcWrap = document.createElement('div');
    calcWrap.id = 'pente-calc';
    calcSec.body.appendChild(calcWrap);

    this.refreshTroncons();
  },

  refreshTroncons() {
    const op = this.state.op;
    const p = op.pente;
    const list = document.getElementById('troncons-list');
    if (!list) return;
    list.innerHTML = '';

    p.troncons.forEach((tr, idx) => {
      const card = document.createElement('div');
      card.className = 'troncon-card';
      const head = document.createElement('h4');
      head.innerHTML = `<span>Tronçon ${idx+1}</span>`;
      const rm = document.createElement('button');
      rm.className = 'danger-btn';
      rm.style.padding = '0.3rem 0.6rem';
      rm.style.minHeight = '32px';
      rm.style.minWidth = '40px';
      rm.style.flex = '0';
      rm.textContent = '×';
      rm.title = 'Supprimer ce tronçon';
      rm.addEventListener('click', () => {
        if (!confirm('Supprimer ce tronçon ?')) return;
        p.troncons.splice(idx, 1);
        this.refreshTroncons();
        this.scheduleSave();
      });
      head.appendChild(rm);
      card.appendChild(head);

      const g = this.grid();
      g.appendChild(this.field({ label: 'Limite aval', value: tr.limite_aval, onChange: v => { tr.limite_aval = v; this.refreshPenteCalc(); }, placeholder: 'ex. Transect 1' }));
      g.appendChild(this.field({ label: 'Limite amont', value: tr.limite_amont, onChange: v => { tr.limite_amont = v; this.refreshPenteCalc(); }, placeholder: 'ex. Point 1' }));
      g.appendChild(this.field({ label: 'Distance (m)', type: 'number', step: '0.1', value: tr.distance_m, onChange: v => { tr.distance_m = v; this.refreshPenteCalc(); } }));
      card.appendChild(g);

      const visAval = this.grid();
      visAval.appendChild(this.field({ label: 'Aval — Fh (cm)', type: 'number', step: '0.1', value: tr.aval.fh, onChange: v => { tr.aval.fh = v; this.refreshPenteCalc(); } }));
      visAval.appendChild(this.field({ label: 'Aval — Fm (cm)', type: 'number', step: '0.1', value: tr.aval.fm, onChange: v => { tr.aval.fm = v; this.refreshPenteCalc(); } }));
      visAval.appendChild(this.field({ label: 'Aval — Fb (cm)', type: 'number', step: '0.1', value: tr.aval.fb, onChange: v => { tr.aval.fb = v; this.refreshPenteCalc(); } }));
      card.appendChild(visAval);

      const visAmont = this.grid();
      visAmont.appendChild(this.field({ label: 'Amont — Fh (cm)', type: 'number', step: '0.1', value: tr.amont.fh, onChange: v => { tr.amont.fh = v; this.refreshPenteCalc(); } }));
      visAmont.appendChild(this.field({ label: 'Amont — Fm (cm)', type: 'number', step: '0.1', value: tr.amont.fm, onChange: v => { tr.amont.fm = v; this.refreshPenteCalc(); } }));
      visAmont.appendChild(this.field({ label: 'Amont — Fb (cm)', type: 'number', step: '0.1', value: tr.amont.fb, onChange: v => { tr.amont.fb = v; this.refreshPenteCalc(); } }));
      card.appendChild(visAmont);

      // Delta H du tronçon
      const dh = (tr.aval.fm != null && tr.amont.fm != null) ? (tr.aval.fm - tr.amont.fm) / 100 : null;
      const dhDiv = document.createElement('div');
      dhDiv.className = 'calc-value';
      dhDiv.style.marginTop = '0.4rem';
      dhDiv.textContent = `Δh tronçon = ${dh == null ? '—' : dh.toFixed(3) + ' m'}`;
      card.appendChild(dhDiv);

      list.appendChild(card);
    });
    this.refreshPenteCalc();
  },

  refreshPenteCalc() {
    const op = this.state.op;
    const p = op.pente;
    const wrap = document.getElementById('pente-calc');
    if (!wrap) return;
    wrap.innerHTML = '';

    // Σ Fm aval, Σ Fm amont, Σ distances
    let sFmAval = 0, sFmAmont = 0, sDist = 0, nValid = 0;
    p.troncons.forEach(tr => {
      if (tr.aval.fm != null && tr.amont.fm != null && tr.distance_m != null) {
        sFmAval += tr.aval.fm / 100;
        sFmAmont += tr.amont.fm / 100;
        sDist += tr.distance_m;
        nValid++;
      }
    });
    const dH = sFmAval - sFmAmont;
    const penteEstimee = sDist > 0 ? 1000 * dH / sDist : null;

    // Pente calculée par régression linéaire sur (distance cumulée, Δh cumulée)
    const pts = [{x: 0, y: 0}];
    let xCum = 0, yCum = 0;
    p.troncons.forEach(tr => {
      if (tr.aval.fm != null && tr.amont.fm != null && tr.distance_m != null) {
        xCum += tr.distance_m;
        yCum += (tr.aval.fm - tr.amont.fm) / 100;
        pts.push({ x: xCum, y: yCum });
      }
    });
    let slopePerMille = null;
    if (pts.length >= 2) {
      const n = pts.length;
      const sx = pts.reduce((s,p) => s + p.x, 0);
      const sy = pts.reduce((s,p) => s + p.y, 0);
      const sxx = pts.reduce((s,p) => s + p.x*p.x, 0);
      const sxy = pts.reduce((s,p) => s + p.x*p.y, 0);
      const denom = n * sxx - sx * sx;
      if (denom !== 0) slopePerMille = 1000 * (n * sxy - sx * sy) / denom;
    }

    const grid = this.grid();
    grid.appendChild(this.calcField({ label: 'Σ Fm visées aval (m)', value: sFmAval, unit: 'm' }));
    grid.appendChild(this.calcField({ label: 'Σ Fm visées amont (m)', value: sFmAmont, unit: 'm' }));
    grid.appendChild(this.calcField({ label: 'ΔH (m)', value: dH, unit: 'm' }));
    grid.appendChild(this.calcField({ label: 'Σ distances (m)', value: sDist, unit: 'm' }));
    grid.appendChild(this.calcField({ label: 'Pente estimée (‰)', value: penteEstimee, unit: '‰' }));
    grid.appendChild(this.calcField({ label: 'Pente calculée (‰)', value: slopePerMille, unit: '‰', note: 'Régression sur dist./Δh cumulés' }));
    wrap.appendChild(grid);

    // Reporter automatiquement dans la station
    if (penteEstimee != null) op.station.pente_estimee_pourmille = +penteEstimee.toFixed(3);
    if (slopePerMille != null) op.station.pente_calculee_pourmille = +slopePerMille.toFixed(3);
  },

  // ============================================================
  //   ÉCRAN COLMATAGE
  // ============================================================
  renderColmatage() {
    const op = this.state.op;
    const c = op.colmatage;
    const root = document.getElementById('form-colmatage');
    root.innerHTML = '';

    // Activation
    {
      const { section, body } = this.section('Module colmatage');
      const g = this.grid();
      g.appendChild(this.field({
        label: 'Module activé ?',
        type: 'select',
        options: NOM.oui_non,
        value: c.actif ? 'Oui' : 'Non',
        onChange: v => { c.actif = (v === 'Oui'); this.toast(c.actif ? 'Colmatage activé' : 'Colmatage désactivé'); }
      }));
      g.appendChild(this.field({ label: 'Classe ARCHAMBAUD', value: c.classe_archambaud, onChange: v => c.classe_archambaud = v, placeholder: 'optionnel' }));
      body.appendChild(g);
      body.appendChild(this.field({ label: 'Remarques générales', type: 'textarea', value: c.remarques, onChange: v => c.remarques = v, full: true }));
      root.appendChild(section);
    }

    if (!c.actif) return;

    // Dates pose / relève
    {
      const { section, body } = this.section('Calendrier de la mesure');
      const g = this.grid();
      g.appendChild(this.field({ label: 'Date de pose', type: 'date', value: c.date_pose, onChange: v => c.date_pose = v }));
      g.appendChild(this.field({ label: 'Date de relève prévue', type: 'date', value: c.date_releve_prevue, onChange: v => c.date_releve_prevue = v, note: 'En général +1 mois' }));
      g.appendChild(this.field({ label: 'Date de relève effective', type: 'date', value: c.date_releve_effective, onChange: v => c.date_releve_effective = v }));
      g.appendChild(this.field({ label: 'Photos de la relève', type: 'select', options: NOM.oui_non, value: c.photos_releve, onChange: v => c.photos_releve = v }));
      body.appendChild(g);
      root.appendChild(section);
    }

    // Chaque radier
    c.radiers.forEach((r, ri) => {
      const { section, body } = this.section(`Radier ${r.id}`);
      const meta = this.grid();
      meta.appendChild(this.field({
        label: 'Nb de bâtonnets posés',
        type: 'number', step: '1',
        value: r.nb_batonnets,
        onChange: v => {
          r.nb_batonnets = v;
          const target = Math.max(1, Math.min(10, parseInt(v) || 4));
          // Adapter le nombre de bâtonnets
          while (r.batonnets.length < target) {
            const i = r.batonnets.length + 1;
            r.batonnets.push({ code: r.id + i, lat: null, lon: null, x_l93: null, y_l93: null, indice_position: '', etat: '', profondeur_oxy_cm: null, remarques: '' });
          }
          while (r.batonnets.length > target) r.batonnets.pop();
          this.renderColmatage();
        }
      }));
      body.appendChild(meta);

      r.batonnets.forEach((bat, bi) => {
        const card = document.createElement('div');
        card.className = 'batonnet-card';
        const h = document.createElement('h5');
        h.textContent = `Bâtonnet ${bat.code}`;
        card.appendChild(h);

        const pose = this.grid();
        pose.appendChild(this.field({ label: 'Latitude WGS84 (Dd)', type: 'number', step: '0.000001', value: bat.lat, onChange: v => bat.lat = v }));
        pose.appendChild(this.field({ label: 'Longitude WGS84 (Dd)', type: 'number', step: '0.000001', value: bat.lon, onChange: v => bat.lon = v }));
        pose.appendChild(this.field({ label: 'X L93 (m)', type: 'number', value: bat.x_l93, onChange: v => bat.x_l93 = v }));
        pose.appendChild(this.field({ label: 'Y L93 (m)', type: 'number', value: bat.y_l93, onChange: v => bat.y_l93 = v }));
        pose.appendChild(this.field({ label: 'Indice pour retrouver le bâtonnet', value: bat.indice_position, onChange: v => bat.indice_position = v, full: true, placeholder: 'ex. à 1,5 m sous bloc en RG' }));
        card.appendChild(pose);

        const releve = this.grid();
        releve.appendChild(this.field({ label: 'État', type: 'select', options: NOM.etat_batonnet, value: bat.etat, onChange: v => bat.etat = v }));
        releve.appendChild(this.field({ label: 'Profondeur d\'oxygénation (cm)', type: 'number', step: '0.1', value: bat.profondeur_oxy_cm, onChange: v => bat.profondeur_oxy_cm = v }));
        releve.appendChild(this.field({ label: 'Remarques', value: bat.remarques, onChange: v => bat.remarques = v, full: true }));
        card.appendChild(releve);

        body.appendChild(card);
      });

      // Synthèse radier
      const oxyVals = r.batonnets.filter(b => b.profondeur_oxy_cm != null).map(b => +b.profondeur_oxy_cm);
      const moy = oxyVals.length ? oxyVals.reduce((a,b)=>a+b, 0) / oxyVals.length : null;
      const synth = this.grid();
      synth.appendChild(this.calcField({ label: `Moyenne radier ${r.id} (cm)`, value: moy, unit: 'cm' }));
      body.appendChild(synth);

      root.appendChild(section);
    });

    // Synthèse globale
    {
      const { section, body } = this.section('Synthèse globale');
      const all = c.radiers.flatMap(r => r.batonnets).filter(b => b.profondeur_oxy_cm != null).map(b => +b.profondeur_oxy_cm);
      const moy = all.length ? all.reduce((a,b)=>a+b,0)/all.length : null;
      const sd = all.length ? Math.sqrt(all.reduce((s,v)=>s+(v-moy)**2,0)/all.length) : null;
      const cv = (moy != null && moy !== 0 && sd != null) ? sd/moy : null;
      const g = this.grid();
      g.appendChild(this.calcField({ label: 'Moyenne globale (cm)', value: moy, unit: 'cm' }));
      g.appendChild(this.calcField({ label: 'Coef. de variation', value: cv == null ? null : cv * 100, unit: '%' }));
      body.appendChild(g);
      root.appendChild(section);
    }
  },

  // ============================================================
  //   ÉCRAN LISTE TRANSECTS
  // ============================================================
  openTransects() {
    const op = this.state.op;
    const list = document.getElementById('transect-list');
    list.innerHTML = '';
    op.transects.forEach((tr, idx) => {
      const li = document.createElement('li');
      if (!tr.actif) li.classList.add('inactive');
      const num = document.createElement('span');
      num.className = 't-num';
      num.textContent = 'T' + tr.numero;
      const info = document.createElement('span');
      info.className = 't-info';
      const npts = tr.points.length;
      const status = !tr.actif ? 'désactivé'
        : (npts > 0 && tr.lpb_m && tr.hpb_m) ? 'complet'
        : (npts > 0 || tr.lpb_m) ? 'partiel'
        : 'à saisir';
      info.innerHTML = `<strong>${tr.facies_affine || tr.facies_simplifie || '—'}</strong><br><small>${npts} points · Lpb=${tr.lpb_m ?? '—'} m</small>`;
      const st = document.createElement('span');
      st.className = 't-status ' + (status === 'complet' ? 'done' : status === 'partiel' ? 'partial' : 'todo');
      st.textContent = status === 'désactivé' ? '○' : (status === 'complet' ? '✓' : status === 'partiel' ? '…' : '·');
      const tog = document.createElement('button');
      tog.className = 'secondary-btn';
      tog.style.flex = '0';
      tog.style.minWidth = '50px';
      tog.style.minHeight = '34px';
      tog.style.padding = '0.2rem 0.5rem';
      tog.style.fontSize = '0.8rem';
      tog.textContent = tr.actif ? 'ON' : 'OFF';
      tog.addEventListener('click', (e) => {
        e.stopPropagation();
        tr.actif = !tr.actif;
        this.scheduleSave();
        this.openTransects();
      });
      li.appendChild(num);
      li.appendChild(info);
      li.appendChild(st);
      li.appendChild(tog);
      li.addEventListener('click', () => {
        if (!tr.actif) {
          if (!confirm(`Le transect T${tr.numero} est désactivé. L'activer et l'éditer ?`)) return;
          tr.actif = true;
        }
        this.openTransectEdit(idx);
      });
      list.appendChild(li);
    });
    this.showScreen('transects');
  },

  // ============================================================
  //   ÉCRAN ÉDITION TRANSECT
  // ============================================================
  openTransectEdit(idx) {
    this.state.currentTransect = idx;
    const tr = this.state.op.transects[idx];
    document.getElementById('transect-edit-title').textContent = `Transect T${tr.numero}`;
    this.renderTransect();
    this.showScreen('transect-edit');
  },

  renderTransect() {
    const op = this.state.op;
    const tr = op.transects[this.state.currentTransect];
    const root = document.getElementById('form-transect');
    root.innerHTML = '';

    // --- Caractéristiques générales
    {
      const { section, body } = this.section('Caractéristiques du transect');
      const g = this.grid();
      g.appendChild(this.field({ label: 'Rive de départ', type: 'select', options: NOM.rive, value: tr.rive_depart, onChange: v => tr.rive_depart = v, note: 'Rive où débute la mesure' }));
      g.appendChild(this.field({ label: 'Lpb — Largeur plein bord (m)', type: 'number', step: '0.01', value: tr.lpb_m, onChange: v => { tr.lpb_m = v; this.refreshTransectCalc(); } }));
      g.appendChild(this.field({ label: 'Lm — Largeur mouillée (m)', type: 'number', step: '0.01', value: tr.lm_m, onChange: v => { tr.lm_m = v; this.refreshTransectCalc(); } }));
      g.appendChild(this.field({ label: 'Hpb — Hauteur plein bord (m)', type: 'number', step: '0.01', value: tr.hpb_m, onChange: v => { tr.hpb_m = v; this.refreshTransectCalc(); } }));
      g.appendChild(this.field({ label: 'Distance inter-points appliquée (m)', type: 'number', step: '0.01', value: tr.distance_interpoints_appliquee_m, onChange: v => tr.distance_interpoints_appliquee_m = v, note: 'Souvent identique à celle de la station' }));
      body.appendChild(g);

      const peauDiv = document.createElement('div');
      peauDiv.id = 'peau-calc';
      peauDiv.style.marginTop = '0.4rem';
      body.appendChild(peauDiv);

      const g2 = this.grid();
      g2.appendChild(this.field({ label: 'Modification du transect', type: 'select', options: NOM.modification_transect, value: tr.modification.type, onChange: v => tr.modification.type = v }));
      g2.appendChild(this.field({ label: 'Raison de la modification', value: tr.modification.raison, onChange: v => tr.modification.raison = v }));
      body.appendChild(g2);

      root.appendChild(section);
    }

    // --- Points de mesure (lit)
    {
      const { section, body } = this.section('Points de mesure dans le lit');
      const tools = document.createElement('div');
      tools.className = 'points-actions';
      const addBtn = document.createElement('button');
      addBtn.className = 'primary';
      addBtn.textContent = '＋ Ajouter un point';
      addBtn.addEventListener('click', () => {
        const lastDist = tr.points.length ? tr.points[tr.points.length - 1].distance_m : 0;
        const step = tr.distance_interpoints_appliquee_m || this.state.op.station.distance_interpoints_appliquee_m || 1;
        tr.points.push({
          distance_m: (lastDist != null ? +lastDist : 0) + step,
          profondeur_cm: null,
          substrat_min: '',
          substrat_add_1: '',
          substrat_add_2: '',
        });
        this.renderTransect();
        this.scheduleSave();
      });
      tools.appendChild(addBtn);

      const seedBtn = document.createElement('button');
      seedBtn.textContent = '⚡ Pré-remplir Lpb';
      seedBtn.title = 'Crée des points à intervalle régulier sur la largeur plein bord';
      seedBtn.addEventListener('click', () => {
        if (!tr.lpb_m) { alert('Saisir d\'abord Lpb.'); return; }
        const step = tr.distance_interpoints_appliquee_m || this.state.op.station.distance_interpoints_appliquee_m;
        if (!step) { alert('Saisir d\'abord la distance inter-points appliquée.'); return; }
        if (tr.points.length > 0 && !confirm('Remplacer les points existants ?')) return;
        tr.points = [];
        let d = 0;
        while (d <= tr.lpb_m + 1e-6) {
          tr.points.push({ distance_m: +d.toFixed(2), profondeur_cm: null, substrat_min: '', substrat_add_1: '', substrat_add_2: '' });
          d += step;
        }
        this.renderTransect();
        this.scheduleSave();
      });
      tools.appendChild(seedBtn);

      const clearBtn = document.createElement('button');
      clearBtn.className = 'danger';
      clearBtn.textContent = '🗑 Vider';
      clearBtn.addEventListener('click', () => {
        if (!confirm('Supprimer tous les points de ce transect ?')) return;
        tr.points = [];
        this.renderTransect();
        this.scheduleSave();
      });
      tools.appendChild(clearBtn);
      body.appendChild(tools);

      // Tableau des points
      const wrap = document.createElement('div');
      wrap.className = 'points-table-wrapper';
      const table = document.createElement('table');
      table.className = 'points-table';
      const thead = document.createElement('thead');
      thead.innerHTML = `
        <tr>
          <th>n°</th>
          <th>Distance (m)</th>
          <th>Profondeur (cm)<br><small>négatif = berge / hors d'eau</small></th>
          <th>Substrat min.</th>
          <th>Add. 1</th>
          <th>Add. 2</th>
          <th></th>
        </tr>`;
      table.appendChild(thead);
      const tbody = document.createElement('tbody');

      tr.points.forEach((pt, i) => {
        const row = document.createElement('tr');
        const numTd = document.createElement('td');
        numTd.className = 'col-num';
        numTd.textContent = i;
        row.appendChild(numTd);

        // Distance
        const distTd = document.createElement('td');
        distTd.className = 'col-dist';
        const dInp = document.createElement('input');
        dInp.type = 'number'; dInp.step = '0.01'; dInp.inputMode = 'decimal';
        dInp.value = pt.distance_m == null ? '' : pt.distance_m;
        dInp.addEventListener('input', () => {
          pt.distance_m = dInp.value === '' ? null : parseFloat(dInp.value);
          this.refreshProfileChart();
          this.scheduleSave();
        });
        distTd.appendChild(dInp);
        row.appendChild(distTd);

        // Profondeur
        const profTd = document.createElement('td');
        profTd.className = 'col-prof';
        const pInp = document.createElement('input');
        pInp.type = 'number'; pInp.step = '0.1'; pInp.inputMode = 'decimal';
        pInp.value = pt.profondeur_cm == null ? '' : pt.profondeur_cm;
        pInp.addEventListener('input', () => {
          pt.profondeur_cm = pInp.value === '' ? null : parseFloat(pInp.value);
          this.refreshProfileChart();
          this.refreshTransectCalc();
          this.scheduleSave();
        });
        profTd.appendChild(pInp);
        row.appendChild(profTd);

        // Substrat principal
        const sTd = document.createElement('td');
        const sSel = document.createElement('select');
        const sBlank = document.createElement('option'); sBlank.value=''; sBlank.textContent='—';
        sSel.appendChild(sBlank);
        NOM.substrats_mineraux.forEach(s => {
          const o = document.createElement('option');
          o.value = s.code; o.textContent = `${s.code} — ${s.libelle}`;
          sSel.appendChild(o);
        });
        sSel.value = pt.substrat_min || '';
        sSel.addEventListener('change', () => { pt.substrat_min = sSel.value; this.scheduleSave(); });
        sTd.appendChild(sSel);
        row.appendChild(sTd);

        // Additionnel 1
        const a1Td = document.createElement('td');
        const a1Sel = document.createElement('select');
        const a1Blank = document.createElement('option'); a1Blank.value=''; a1Blank.textContent='—';
        a1Sel.appendChild(a1Blank);
        NOM.substrats_additionnels.forEach(s => {
          const o = document.createElement('option');
          o.value = s.code; o.textContent = s.code;
          o.title = s.libelle;
          a1Sel.appendChild(o);
        });
        a1Sel.value = pt.substrat_add_1 || '';
        a1Sel.addEventListener('change', () => { pt.substrat_add_1 = a1Sel.value; this.scheduleSave(); });
        a1Td.appendChild(a1Sel);
        row.appendChild(a1Td);

        // Additionnel 2
        const a2Td = document.createElement('td');
        const a2Sel = a1Sel.cloneNode(true);
        a2Sel.value = pt.substrat_add_2 || '';
        a2Sel.addEventListener('change', () => { pt.substrat_add_2 = a2Sel.value; this.scheduleSave(); });
        a2Td.appendChild(a2Sel);
        row.appendChild(a2Td);

        // Suppression
        const rmTd = document.createElement('td');
        const rmBtn = document.createElement('button');
        rmBtn.textContent = '×';
        rmBtn.title = 'Supprimer ce point';
        rmBtn.style.padding = '0.3rem 0.5rem';
        rmBtn.style.minHeight = '30px';
        rmBtn.style.color = 'var(--danger)';
        rmBtn.style.border = '1px solid var(--danger)';
        rmBtn.style.background = 'white';
        rmBtn.style.borderRadius = '6px';
        rmBtn.style.cursor = 'pointer';
        rmBtn.addEventListener('click', () => {
          tr.points.splice(i, 1);
          this.renderTransect();
          this.scheduleSave();
        });
        rmTd.appendChild(rmBtn);
        row.appendChild(rmTd);

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      body.appendChild(wrap);

      // Aperçu graphique profil en travers
      const chart = document.createElement('div');
      chart.className = 'profile-chart';
      chart.id = 'profile-chart';
      body.appendChild(chart);

      root.appendChild(section);
    }

    // --- Faciès
    {
      const { section, body } = this.section('Faciès d\'écoulement');
      const g = this.grid();
      g.appendChild(this.field({ label: 'Faciès simplifié', type: 'select', options: NOM.facies_simplifie, value: tr.facies_simplifie, onChange: v => tr.facies_simplifie = v }));
      g.appendChild(this.field({ label: 'Faciès affiné (Malavoi)', type: 'select', options: NOM.facies_affine, value: tr.facies_affine, onChange: v => tr.facies_affine = v }));
      body.appendChild(g);
      root.appendChild(section);
    }

    // --- Ripisylve RG / RD
    ['rg', 'rd'].forEach(rive => {
      const r = tr['ripisylve_' + rive];
      const label = rive === 'rg' ? 'Rive gauche' : 'Rive droite';
      const { section, body } = this.section(`Ripisylve — ${label}`, { collapsible: true, collapsed: true });
      NOM.strates_ripisylve.forEach(strate => {
        const key = strate.toLowerCase().replace('é','e');
        const sk = key === 'arboree' ? 'arboree' : key === 'arbustive' ? 'arbustive' : 'herbacee';
        const data = r[sk];
        const sub = document.createElement('div');
        sub.style.borderBottom = '1px dashed var(--border)';
        sub.style.paddingBottom = '0.5rem';
        sub.style.marginBottom = '0.5rem';
        const h = document.createElement('h4');
        h.textContent = `Strate ${strate.toLowerCase()}`;
        sub.appendChild(h);
        const g = this.grid();
        g.appendChild(this.field({
          label: 'Présente ?',
          type: 'select',
          options: NOM.oui_non,
          value: data.presente ? 'Oui' : 'Non',
          onChange: v => data.presente = (v === 'Oui')
        }));
        g.appendChild(this.field({ label: 'Épaisseur', type: 'select', options: NOM.epaisseur_strate, value: data.epaisseur, onChange: v => data.epaisseur = v }));
        g.appendChild(this.field({ label: 'Type de végétation', type: 'select', options: NOM.type_vegetation, value: data.type, onChange: v => data.type = v }));
        sub.appendChild(g);
        body.appendChild(sub);
      });
      const g = this.grid();
      g.appendChild(this.field({ label: 'Strate la plus recouvrante', type: 'select', options: NOM.strate_plus_recouvrante, value: r.plus_recouvrante, onChange: v => r.plus_recouvrante = v }));
      body.appendChild(g);
      root.appendChild(section);
    });

    // --- Berges RG / RD
    ['rg', 'rd'].forEach(rive => {
      const b = tr['berge_' + rive];
      const label = rive === 'rg' ? 'Rive gauche' : 'Rive droite';
      const { section, body } = this.section(`Berge — ${label}`, { collapsible: true, collapsed: true });
      const g = this.grid();
      g.appendChild(this.field({ label: 'Nature des matériaux', type: 'select', options: NOM.materiaux_berges, value: b.materiaux, onChange: v => b.materiaux = v, full: true }));
      body.appendChild(g);
      const lbl = document.createElement('label');
      lbl.style.fontWeight = '500'; lbl.style.fontSize = '0.85rem';
      lbl.textContent = 'Habitats caractéristiques :';
      body.appendChild(lbl);
      body.appendChild(this.checkboxGroup({
        options: NOM.habitats_berges,
        selected: b.habitats,
        onChange: v => b.habitats = v,
      }));
      root.appendChild(section);
    });

    // --- Remarques
    {
      const { section, body } = this.section('Remarques sur le transect');
      body.appendChild(this.field({ label: 'Observations libres', type: 'textarea', value: tr.remarques, onChange: v => tr.remarques = v, full: true }));
      root.appendChild(section);
    }

    this.refreshTransectCalc();
    this.refreshProfileChart();
  },

  refreshTransectCalc() {
    const tr = this.state.op.transects[this.state.currentTransect];
    if (!tr) return;
    // Peau = moyenne des profondeurs > 0
    const profs = tr.points.filter(p => p.profondeur_cm != null && p.profondeur_cm > 0).map(p => p.profondeur_cm / 100);
    const peau = profs.length ? profs.reduce((a,b)=>a+b,0)/profs.length : null;
    const el = document.getElementById('peau-calc');
    if (el) {
      el.innerHTML = '';
      const g = this.grid();
      g.appendChild(this.calcField({ label: 'Peau — Profondeur d\'eau moyenne (m)', value: peau, unit: 'm', note: 'Moyenne des profondeurs > 0' }));
      // Ratios
      if (tr.lpb_m && tr.hpb_m) {
        g.appendChild(this.calcField({ label: 'Lpb / Hpb', value: tr.lpb_m / tr.hpb_m, unit: '', note: 'Indicateur géodynamique' }));
      }
      if (tr.lm_m && peau != null && peau > 0) {
        g.appendChild(this.calcField({ label: 'Lm / Peau', value: tr.lm_m / peau, unit: '' }));
      }
      el.appendChild(g);
    }
  },

  // ============================================================
  //   GRAPHIQUE SVG : profil en travers
  // ============================================================
  refreshProfileChart() {
    const tr = this.state.op.transects[this.state.currentTransect];
    const root = document.getElementById('profile-chart');
    if (!root) return;
    root.innerHTML = '';

    const pts = tr.points
      .filter(p => p.distance_m != null && p.profondeur_cm != null)
      .map(p => ({ x: +p.distance_m, y: -p.profondeur_cm / 100 }))  // y en m : profondeur négative = au-dessus de la ligne d'eau
      .sort((a,b) => a.x - b.x);

    if (pts.length < 2) {
      const msg = document.createElement('div');
      msg.className = 'muted small';
      msg.textContent = 'Profil en travers : saisir au moins 2 points pour afficher l\'aperçu.';
      msg.style.padding = '0.4rem';
      root.appendChild(msg);
      return;
    }

    const W = 700, H = 240;
    const pad = { l: 50, r: 20, t: 20, b: 36 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    const xMin = Math.min(...pts.map(p => p.x));
    const xMax = Math.max(...pts.map(p => p.x));
    const xPad = (xMax - xMin) * 0.02 || 0.5;
    const x0 = xMin - xPad, x1 = xMax + xPad;

    // Y : ligne d'eau = 0 ; profondeur négative en cm dans pt → ici on a déjà signé y
    // profondeur saisie positive = en eau (y > 0 en m descendant) ; on veut l'eau VERS LE BAS
    // On a fait y = -profondeur_cm/100 ; donc profondeur positive => y < 0 (vers le bas)
    // On affichera y croissant vers le bas → inversion sur le SVG
    const yMin = Math.min(...pts.map(p => p.y), 0);
    const yMax = Math.max(...pts.map(p => p.y), 0);
    const yPad = (yMax - yMin) * 0.1 || 0.2;
    const y0 = yMin - yPad, y1 = yMax + yPad;

    const xScale = x => pad.l + (x - x0) / (x1 - x0) * innerW;
    const yScale = y => pad.t + (y1 - y) / (y1 - y0) * innerH;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    // Grille horizontale
    for (let i = 0; i <= 4; i++) {
      const y = y0 + (y1 - y0) * i / 4;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', pad.l); line.setAttribute('x2', W - pad.r);
      line.setAttribute('y1', yScale(y)); line.setAttribute('y2', yScale(y));
      line.setAttribute('class', 'grid');
      svg.appendChild(line);
      const txt = document.createElementNS(svgNS, 'text');
      txt.setAttribute('x', pad.l - 6); txt.setAttribute('y', yScale(y) + 3);
      txt.setAttribute('text-anchor', 'end');
      txt.setAttribute('class', 'label');
      txt.textContent = y.toFixed(2) + ' m';
      svg.appendChild(txt);
    }

    // Axe X
    const axisX = document.createElementNS(svgNS, 'line');
    axisX.setAttribute('x1', pad.l); axisX.setAttribute('x2', W - pad.r);
    axisX.setAttribute('y1', H - pad.b); axisX.setAttribute('y2', H - pad.b);
    axisX.setAttribute('class', 'axis');
    svg.appendChild(axisX);

    // Étiquettes axe X
    const nbXLab = Math.min(8, pts.length);
    for (let i = 0; i < nbXLab; i++) {
      const xv = x0 + (x1 - x0) * i / (nbXLab - 1);
      const txt = document.createElementNS(svgNS, 'text');
      txt.setAttribute('x', xScale(xv)); txt.setAttribute('y', H - pad.b + 16);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('class', 'label');
      txt.textContent = xv.toFixed(1);
      svg.appendChild(txt);
    }
    // Légende X
    const xLab = document.createElementNS(svgNS, 'text');
    xLab.setAttribute('x', (W - pad.r + pad.l)/2);
    xLab.setAttribute('y', H - 4);
    xLab.setAttribute('text-anchor', 'middle');
    xLab.setAttribute('class', 'label');
    xLab.textContent = `Distance depuis la rive ${tr.rive_depart || ''} (m)`;
    svg.appendChild(xLab);

    // Surface d'eau (polygone fermé)
    // Trace la zone entre y=0 et le profil pour les points sous l'eau (y < 0)
    const ySurface = yScale(0);
    let pathSurface = '';
    pts.forEach((p, i) => {
      pathSurface += (i === 0 ? 'M' : 'L') + xScale(p.x) + ' ' + yScale(p.y);
    });
    const lastX = xScale(pts[pts.length-1].x), firstX = xScale(pts[0].x);
    pathSurface += ` L${lastX} ${ySurface} L${firstX} ${ySurface} Z`;
    const surf = document.createElementNS(svgNS, 'path');
    surf.setAttribute('d', pathSurface);
    surf.setAttribute('class', 'surf-eau');
    svg.appendChild(surf);

    // Ligne du profil
    const profile = document.createElementNS(svgNS, 'path');
    let pathLine = '';
    pts.forEach((p, i) => {
      pathLine += (i === 0 ? 'M' : 'L') + xScale(p.x) + ' ' + yScale(p.y);
    });
    profile.setAttribute('d', pathLine);
    profile.setAttribute('class', 'line-eau');
    svg.appendChild(profile);

    // Ligne d'eau
    const eau = document.createElementNS(svgNS, 'line');
    eau.setAttribute('x1', pad.l); eau.setAttribute('x2', W - pad.r);
    eau.setAttribute('y1', ySurface); eau.setAttribute('y2', ySurface);
    eau.setAttribute('class', 'line-eau-niveau');
    svg.appendChild(eau);
    const eauLab = document.createElementNS(svgNS, 'text');
    eauLab.setAttribute('x', W - pad.r - 4);
    eauLab.setAttribute('y', ySurface - 4);
    eauLab.setAttribute('text-anchor', 'end');
    eauLab.setAttribute('class', 'label');
    eauLab.textContent = 'ligne d\'eau';
    svg.appendChild(eauLab);

    // Points
    pts.forEach(p => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', xScale(p.x));
      c.setAttribute('cy', yScale(p.y));
      c.setAttribute('r', 3);
      c.setAttribute('class', p.y >= 0 ? 'pt-air' : 'pt');
      svg.appendChild(c);
    });

    root.appendChild(svg);
  },

  // ============================================================
  //   EXPORT
  // ============================================================
  renderExport() {
    const op = this.state.op;
    document.getElementById('json-preview').textContent = JSON.stringify(op, null, 2);
  },

  bindExport() {
    document.getElementById('btn-export-json').addEventListener('click', () => {
      Exporter.toJSON(this.state.op);
    });
    document.getElementById('btn-export-xlsx').addEventListener('click', () => {
      Exporter.toXLSX(this.state.op);
    });
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
