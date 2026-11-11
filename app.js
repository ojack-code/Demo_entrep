/* Interface : liste des projets, formulaire, génération du business plan. */

const $ = (s, el = document) => el.querySelector(s);
const state = { projects: [], currentId: null, view: 'form', charts: [] };

/* ---------- Formatage ---------- */
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf4 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 4 });
const eur = v => nf0.format(Math.round(v)) + ' €';
const eur2 = v => nf2.format(v) + ' €';
const kwh = v => nf0.format(Math.round(v)) + ' kWh';
const pct = (v, d = 1) => v == null ? 'n.d.' : (v * 100).toFixed(d).replace('.', ',') + ' %';
const yrs = v => v == null ? 'non atteint' : v.toFixed(1).replace('.', ',') + ' ans';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateFr = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('fr-FR') : '—';

const current = () => state.projects.find(p => p.id === state.currentId);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- Persistance ---------- */
let saveTimer = null;
function scheduleSave(project) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    project.updatedAt = new Date().toISOString();
    DB.put(project).catch(err => alert('Erreur d’enregistrement : ' + err));
  }, 300);
}

async function load() {
  state.projects = (await DB.all()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  state.currentId = state.projects[0]?.id || null;
  render();
}

async function createProject(data) {
  const now = new Date().toISOString();
  const project = { ...defaultProject(), ...(data || {}), id: uid(), createdAt: now, updatedAt: now };
  await DB.put(project);
  state.projects.unshift(project);
  state.currentId = project.id;
  state.view = 'form';
  render();
  return project;
}

/* ---------- Rendu général ---------- */
function render() {
  renderList();
  const p = current();
  $('#empty').hidden = !!p;
  $('#workspace').hidden = !p;
  if (!p) return;
  $('#project-title').textContent = p.nom || 'Sans nom';
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === state.view));
  $('#view-form').hidden = state.view !== 'form';
  $('#view-plan').hidden = state.view !== 'plan';
  if (state.view === 'form') { renderForm(p); renderPhoto(p); renderQuickKpis(p); }
  else renderPlan(p);
}

function renderList() {
  const ul = $('#project-list');
  ul.innerHTML = state.projects.map(p => {
    const missing = validate(p).length;
    const status = missing ? `<span class="todo">à compléter (${missing})</span>` : 'retour ' + yrs(compute(p).k.paybackProjet);
    return `<li class="${p.id === state.currentId ? 'active' : ''}" data-id="${p.id}">
      <div class="thumb">${p.photo ? `<img src="${p.photo}" alt="">` : '☀'}</div>
      <div class="meta">
        <strong>${esc(p.nom || 'Sans nom')}</strong>
        <small>${p.puissanceCrete ? esc(p.puissanceCrete) + ' kWc · ' : ''}${status}</small>
      </div>
    </li>`;
  }).join('');
}

function renderForm(p) {
  const form = $('#project-form');
  form.innerHTML = SCHEMA.map(sec => `
    <fieldset>
      <legend>${sec.title}</legend>
      <div class="grid">
        ${sec.fields.map(f => fieldHtml(f, p[f.k])).join('')}
      </div>
    </fieldset>`).join('') + '<p class="legend-req"><b class="req">*</b> champ obligatoire — les champs facultatifs laissés vides comptent pour 0.</p>';
  updateValidity(p);
}

function fieldHtml(f, v) {
  const val = esc(v ?? '');
  const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
  let input;
  if (f.t === 'textarea') input = `<textarea name="${f.k}" rows="2"${ph}>${val}</textarea>`;
  else if (f.t === 'select') input = `<select name="${f.k}">${f.o.map(o => `<option value="${esc(o)}"${o === (v ?? '') ? ' selected' : ''}>${esc(o || '— choisir —')}</option>`).join('')}</select>`;
  else input = `<input name="${f.k}" type="${f.t}" value="${val}"${ph}${f.step ? ` step="${f.step}"` : ''}${f.t === 'number' ? ' inputmode="decimal" min="0"' : ''}>`;
  return `<label class="field${f.wide ? ' wide' : ''}" data-field="${f.k}">
    <span class="lbl">${f.l}${f.req ? ' <b class="req">*</b>' : ''}</span>
    <span class="ctl">${input}${f.u ? `<em>${f.u}</em>` : ''}</span>
    <small class="err"></small>
    ${f.help ? `<small>${f.help}</small>` : ''}
  </label>`;
}

/* Met en évidence les champs obligatoires manquants (sans reconstruire le formulaire). */
function updateValidity(p) {
  const errors = Object.fromEntries(validate(p).map(e => [e.k, e.msg]));
  document.querySelectorAll('#project-form .field').forEach(el => {
    const k = el.dataset.field;
    const msg = errors[k];
    el.classList.toggle('invalid', !!msg);
    el.querySelector('.err').textContent = msg ? 'Obligatoire : ' + msg : '';
    const star = el.querySelector('.req');
    if (star) star.hidden = !isRequired(FIELDS[k], p);
  });
}

const missingHtml = errors => `
  <div class="missing">
    <strong>Business plan indisponible : ${errors.length} information(s) obligatoire(s) manquante(s)</strong>
    <ul>${errors.map(e => `<li>${esc(e.l)} — ${e.msg}</li>`).join('')}</ul>
  </div>`;

function renderPhoto(p) {
  $('#photo-preview').innerHTML = p.photo ? `<img src="${p.photo}" alt="Photo de la centrale">` : '<span>Aucune photo de la centrale</span>';
  $('#btn-photo-remove').hidden = !p.photo;
}

function renderQuickKpis(p) {
  const errors = validate(p);
  if (errors.length) {
    $('#quick-kpis').innerHTML = `<h3>Aperçu instantané</h3>${missingHtml(errors)}`;
    return;
  }
  const { k, warnings } = compute(p);
  $('#quick-kpis').innerHTML = `
    <h3>Aperçu instantané</h3>
    <div class="kpis">
      ${kpi('Gains année 1', eur(k.gainsAn1))}
      ${kpi('Mensualité', eur2(k.mensualite))}
      ${kpi('Flux net année 1', eur(k.fluxNetAn1), k.fluxNetAn1 < 0 ? 'neg' : 'pos')}
      ${kpi('Temps de retour', yrs(k.paybackProjet))}
      ${kpi('TRI projet', pct(k.triProjet))}
      ${kpi(`Gain net sur ${k.N} ans`, eur(k.gainNetTotal), k.gainNetTotal < 0 ? 'neg' : 'pos')}
    </div>
    ${warnings.map(w => `<p class="warn">⚠ ${esc(w)}</p>`).join('')}
    <button type="button" class="btn primary" data-goto="plan">Voir le business plan complet →</button>`;
}

const kpi = (label, value, cls = '') => `<div class="kpi ${cls}"><span>${label}</span><strong>${value}</strong></div>`;

/* ---------- Business plan ---------- */
function renderPlan(p) {
  const errors = validate(p);
  if (errors.length) {
    state.charts.forEach(c => c.destroy());
    state.charts = [];
    $('#plan').innerHTML = `${missingHtml(errors)}
      <button type="button" class="btn primary" id="btn-goto-form">← Compléter les données</button>`;
    $('#btn-goto-form').onclick = () => { state.view = 'form'; render(); };
    return;
  }
  const { k, years, loan, warnings, contrat, p: v } = compute(p);
  const today = new Date().toLocaleDateString('fr-FR');
  const row = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;

  const rentable = k.vanProjet > 0;
  const autofinance = k.anneesNegatives === 0;
  const conclusion = `
    <p>Le projet <strong>${esc(v.nom)}</strong> consiste en l’installation d’une centrale photovoltaïque
    ${v.puissanceCrete ? `de <strong>${nf2.format(v.puissanceCrete)} kWc</strong> ` : ''}produisant environ
    <strong>${kwh(v.production)}</strong> la première année, dont <strong>${pct(k.tauxAutoconso, 0)}</strong> sont autoconsommés
    (couverture de ${pct(k.tauxCouverture, 0)} de la consommation considérée), le surplus étant vendu au réseau.</p>
    <p>Pour un investissement de <strong>${eur(v.capex)}</strong>${v.subvention ? `, diminué de ${eur(v.subvention)} de subventions,` : ''}
    financé à hauteur de <strong>${eur(v.emprunt)}</strong> par emprunt (${nf2.format(v.taux)} % sur ${nf0.format(v.dureeEmprunt)} ans),
    le projet génère <strong>${eur(k.gainsAn1)}</strong> de gains la première année
    (${eur(k.economiesAn1)} d’économies et ${eur(k.ventesAn1)} de ventes).</p>
    <p>L’investissement est récupéré en <strong>${yrs(k.paybackProjet)}</strong>, pour un TRI projet de
    <strong>${pct(k.triProjet)}</strong> et une VAN de <strong>${eur(k.vanProjet)}</strong> au taux de ${nf2.format(v.tauxActualisation)} %.
    Sur ${k.N} ans, le gain net cumulé après remboursement de l’emprunt atteint <strong>${eur(k.gainNetTotal)}</strong>.</p>
    <p class="verdict ${rentable ? 'ok' : 'ko'}">${rentable
      ? `✔ Le projet est rentable sur la durée d’analyse.`
      : `✘ Le projet n’est pas rentable au taux d’actualisation retenu.`}
    ${loan.mensualite > 0 ? (autofinance
      ? ' Les gains couvrent les annuités d’emprunt dès la première année : le projet s’autofinance.'
      : ` Pendant ${k.anneesNegatives} année(s) de remboursement, les gains ne couvrent pas entièrement l’annuité (effort de trésorerie maximal cumulé : ${eur(-k.minTreso)}).`) : ''}</p>`;

  const ressources = [
    ['Subventions / primes', v.subvention],
    ['Emprunt bancaire', v.emprunt],
    ['Apport personnel / fonds propres', Math.max(0, k.apport)],
  ];

  $('#plan').innerHTML = `
  <section class="cover page">
    <p class="eyebrow">Business plan — Centrale photovoltaïque</p>
    <h1>${esc(v.nom || 'Projet sans nom')}</h1>
    ${v.porteur ? `<p class="sub">Porteur du projet : <strong>${esc(v.porteur)}</strong></p>` : ''}
    ${v.adresse ? `<p class="sub">${esc(v.adresse).replace(/\n/g, '<br>')}</p>` : ''}
    ${p.photo ? `<figure class="cover-photo"><img src="${p.photo}" alt="Photo de la centrale"></figure>` : ''}
    <p class="date">Document généré le ${today}</p>
  </section>

  <section class="page">
    <h2>1. Synthèse</h2>
    <div class="kpis big">
      ${kpi('Investissement', eur(v.capex))}
      ${kpi('Apport', eur(Math.max(0, k.apport)))}
      ${kpi('Gains année 1', eur(k.gainsAn1))}
      ${kpi('Mensualité', eur2(k.mensualite))}
      ${kpi('Temps de retour', yrs(k.paybackProjet))}
      ${kpi('TRI projet', pct(k.triProjet))}
      ${kpi('VAN projet', eur(k.vanProjet), k.vanProjet < 0 ? 'neg' : 'pos')}
      ${kpi(`Gain net ${k.N} ans`, eur(k.gainNetTotal), k.gainNetTotal < 0 ? 'neg' : 'pos')}
    </div>
    ${conclusion}
    ${warnings.map(w => `<p class="warn">⚠ ${esc(w)}</p>`).join('')}
  </section>

  <section class="page">
    <h2>2. Présentation du projet</h2>
    <div class="two-col">
      <table class="kv">
        ${row('Nom du projet', esc(v.nom))}
        ${row('Porteur du projet', esc(v.porteur) || '—')}
        ${row('Adresse du site', esc(v.adresse).replace(/\n/g, '<br>') || '—')}
        ${row('Mise en service prévue', dateFr(v.dateMES))}
      </table>
      <table class="kv">
        <caption>Abonnement électricité</caption>
        ${row('Fournisseur', esc(v.fournisseur) || '—')}
        ${row('Option tarifaire', esc(v.optionTarifaire) || '—')}
        ${row('Puissance souscrite', v.puissanceSouscrite ? nf0.format(v.puissanceSouscrite) + ' kVA' : '—')}
        ${row('N° PDL / PRM', esc(v.pdl) || '—')}
        ${row('Prix du kWh (part énergie)', nf4.format(v.prixKwh) + ' €/kWh')}
      </table>
    </div>
    ${v.description ? `<p class="desc">${esc(v.description).replace(/\n/g, '<br>')}</p>` : ''}

    <h2>3. Caractéristiques techniques et énergétiques</h2>
    <table class="kv">
      ${row('Puissance crête', v.puissanceCrete ? nf2.format(v.puissanceCrete) + ' kWc' : '—')}
      ${row('Production annuelle (année 1)', kwh(v.production))}
      ${row('Productible spécifique', k.productible ? nf0.format(k.productible) + ' kWh/kWc' : '—')}
      ${row('Consommation considérée pour l’autoconsommation', kwh(v.consommation))}
      ${row('Énergie autoconsommée (année 1)', kwh(k.autoconsoAn1))}
      ${row('Surplus injecté sur le réseau (année 1)', kwh(k.surplusAn1))}
      ${row('Taux d’autoconsommation', pct(k.tauxAutoconso))}
      ${row('Taux de couverture de la consommation', pct(k.tauxCouverture))}
      ${row('Dégradation annuelle des panneaux', nf2.format(v.degradation) + ' %')}
    </table>
  </section>

  <section class="page">
    <h2>4. Hypothèses économiques</h2>
    <table class="kv">
      ${row('Prix du kWh effacé par l’autoconsommation', nf4.format(v.prixKwh) + ' €/kWh, +' + nf2.format(v.inflationElec) + ' %/an')}
      ${row('Abonnement électricité', 'Non affecté par l’autoconsommation, exclu des économies')}
      ${row('Tarif de vente du surplus', nf4.format(v.prixRachat) + ' €/kWh pendant ' + nf0.format(contrat) + ' ans' + (v.indexRachat ? ', indexé +' + nf2.format(v.indexRachat) + ' %/an' : ''))}
      ${contrat < k.N ? row('Prix de vente après contrat', nf4.format(v.prixApresContrat) + ' €/kWh') : ''}
      ${row('Maintenance + assurance', eur(v.maintenance + v.assurance) + ' / an, +' + nf2.format(v.inflationOpex) + ' %/an')}
      ${row('Remplacement de l’onduleur', v.coutOnduleur ? eur(v.coutOnduleur) + ' en année ' + nf0.format(v.anneeOnduleur) : '—')}
      ${row('Durée d’analyse', k.N + ' ans')}
      ${row('Taux d’actualisation', nf2.format(v.tauxActualisation) + ' %')}
    </table>

    <h2>5. Plan de financement</h2>
    <div class="two-col">
      <table class="fin">
        <caption>Besoins</caption>
        <tr><th>Installation photovoltaïque (clé en main)</th><td>${eur(v.capex)}</td></tr>
        <tr class="total"><th>Total besoins</th><td>${eur(v.capex)}</td></tr>
      </table>
      <table class="fin">
        <caption>Ressources</caption>
        ${ressources.map(([a, b]) => `<tr><th>${a}</th><td>${eur(b)}</td></tr>`).join('')}
        <tr class="total"><th>Total ressources</th><td>${eur(ressources.reduce((s, r) => s + r[1], 0))}</td></tr>
      </table>
    </div>
    <table class="kv">
      <caption>Emprunt</caption>
      ${row('Montant emprunté', eur(v.emprunt))}
      ${row('Taux d’intérêt', nf2.format(v.taux) + ' %')}
      ${row('Durée', nf0.format(v.dureeEmprunt) + ' ans (' + nf0.format(v.dureeEmprunt * 12) + ' mensualités)')}
      ${row('Mensualité', eur2(k.mensualite))}
      ${row('Coût total des intérêts', eur(k.totalInterets))}
      ${row('Coût total du crédit', eur(k.coutTotalCredit))}
    </table>
    ${loan.annees.length ? `
    <table class="data">
      <caption>Tableau d’amortissement annuel</caption>
      <thead><tr><th>Année</th><th>Annuité</th><th>Intérêts</th><th>Capital remboursé</th><th>Capital restant dû</th></tr></thead>
      <tbody>${loan.annees.map(a => `<tr><td>${a.annee}</td><td>${eur(a.annuite)}</td><td>${eur(a.interets)}</td><td>${eur(a.capital)}</td><td>${eur(a.solde)}</td></tr>`).join('')}</tbody>
    </table>` : ''}
  </section>

  <section class="page">
    <h2>6. Prévisions financières</h2>
    <div class="chart-wrap"><canvas id="chart-cumul"></canvas></div>
    <div class="chart-wrap"><canvas id="chart-flux"></canvas></div>
  </section>

  <section class="page">
    <table class="data small">
      <caption>Compte prévisionnel annuel</caption>
      <thead><tr><th>Année</th><th>Production</th><th>Autoconso.</th><th>Économies</th><th>Ventes surplus</th><th>Charges</th><th>Annuité emprunt</th><th>Flux net</th><th>Trésorerie cumulée</th></tr></thead>
      <tbody>
        <tr class="y0"><td>0</td><td colspan="6">Apport initial</td><td>${eur(-k.apport)}</td><td>${eur(-k.apport)}</td></tr>
        ${years.map(y => `<tr>
          <td>${y.annee}</td><td>${nf0.format(y.production)}</td><td>${nf0.format(y.autoconso)}</td>
          <td>${eur(y.economies)}</td><td>${eur(y.ventes)}</td><td>${eur(y.charges)}</td><td>${eur(y.annuite)}</td>
          <td class="${y.fluxNet < 0 ? 'neg' : ''}">${eur(y.fluxNet)}</td><td class="${y.cumul < 0 ? 'neg' : ''}">${eur(y.cumul)}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr><th>Total</th><td>${nf0.format(years.reduce((s, y) => s + y.production, 0))}</td><td>${nf0.format(years.reduce((s, y) => s + y.autoconso, 0))}</td>
        <td>${eur(k.totalEconomies)}</td><td>${eur(k.totalVentes)}</td><td>${eur(k.totalCharges)}</td><td>${eur(k.coutTotalCredit)}</td>
        <td>${eur(k.gainNetTotal + k.apport)}</td><td>${eur(k.gainNetTotal)}</td></tr></tfoot>
    </table>
    <p class="note">Production et autoconsommation en kWh. Flux net = économies + ventes − charges − annuité d’emprunt.</p>
  </section>

  <section class="page">
    <h2>7. Indicateurs de rentabilité</h2>
    <table class="kv">
      ${row('Temps de retour sur investissement (hors financement)', yrs(k.paybackProjet))}
      ${row('Retour sur l’apport (trésorerie cumulée positive)', k.apport > 0 ? yrs(k.paybackTreso) : 'Sans apport')}
      ${row('TRI du projet', pct(k.triProjet, 2))}
      ${row('TRI des fonds propres', k.apport > 0 ? pct(k.triFondsPropres, 2) : 'n.d. (sans apport)')}
      ${row('VAN du projet', eur(k.vanProjet))}
      ${row('VAN après financement', eur(k.vanFondsPropres))}
      ${row('Coût actualisé de l’énergie produite (LCOE)', k.lcoe != null ? nf4.format(k.lcoe) + ' €/kWh' : '—')}
      ${row(`Économies cumulées sur ${k.N} ans`, eur(k.totalEconomies))}
      ${row(`Ventes de surplus cumulées sur ${k.N} ans`, eur(k.totalVentes))}
      ${row(`Gain net cumulé sur ${k.N} ans`, eur(k.gainNetTotal))}
    </table>
    <p class="note">Estimations indicatives basées sur les hypothèses saisies ; la fiscalité n’est pas prise en compte.
    Le LCOE est à comparer au prix d’achat de l’électricité (${nf4.format(v.prixKwh)} €/kWh).</p>
  </section>`;

  drawCharts(years, k);
}

function drawCharts(years, k) {
  state.charts.forEach(c => c.destroy());
  state.charts = [];
  if (typeof Chart === 'undefined') return;
  const labels = ['0', ...years.map(y => String(y.annee))];
  const money = v => nf0.format(v) + ' €';
  const base = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => `${c.dataset.label} : ${money(c.parsed.y)}` } } },
    scales: { y: { ticks: { callback: money } }, x: { title: { display: true, text: 'Année' } } },
  };
  const cumul = [-k.apport, ...years.map(y => y.cumul)];
  state.charts.push(new Chart($('#chart-cumul'), {
    type: 'bar',
    data: { labels, datasets: [{
      label: 'Trésorerie cumulée', data: cumul,
      backgroundColor: cumul.map(v => v < 0 ? '#e0715b' : '#2f9e6b'),
    }] },
    options: { ...base, plugins: { ...base.plugins, title: { display: true, text: 'Trésorerie cumulée (après emprunt)' } } },
  }));
  state.charts.push(new Chart($('#chart-flux'), {
    type: 'bar',
    data: { labels: labels.slice(1), datasets: [
      { label: 'Économies', data: years.map(y => y.economies), backgroundColor: '#2f9e6b', stack: 'g' },
      { label: 'Ventes surplus', data: years.map(y => y.ventes), backgroundColor: '#f2b53a', stack: 'g' },
      { label: 'Charges', data: years.map(y => -y.charges), backgroundColor: '#8a94a6', stack: 'c' },
      { label: 'Annuité emprunt', data: years.map(y => -y.annuite), backgroundColor: '#3b6fd8', stack: 'c' },
    ] },
    options: { ...base, scales: { ...base.scales, x: { ...base.scales.x, stacked: true }, y: { ...base.scales.y, stacked: true } },
      plugins: { ...base.plugins, title: { display: true, text: 'Gains et dépenses annuels' } } },
  }));
}

/* ---------- Photo : redimensionnée pour limiter le stockage ---------- */
function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

/* ---------- Événements ---------- */
$('#btn-new').onclick = $('#btn-new-empty').onclick = () => createProject();

$('#project-list').onclick = e => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  state.currentId = li.dataset.id;
  render();
};

document.querySelectorAll('.tab').forEach(t => t.onclick = () => { state.view = t.dataset.view; render(); });
$('#view-form').addEventListener('click', e => {
  if (e.target.dataset.goto) { state.view = e.target.dataset.goto; render(); window.scrollTo(0, 0); }
});

$('#project-form').addEventListener('input', e => {
  const p = current();
  const f = FIELDS[e.target.name];
  if (!p || !f) return;
  p[f.k] = f.t === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value;
  if (f.k === 'nom') $('#project-title').textContent = p.nom || 'Sans nom';
  updateValidity(p);
  renderQuickKpis(p);
  renderList();
  scheduleSave(p);
});

$('#input-photo').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const p = current();
  try {
    p.photo = await resizeImage(file);
    renderPhoto(p); renderList(); scheduleSave(p);
  } catch (err) { alert(err.message); }
};
$('#btn-photo-remove').onclick = () => {
  const p = current();
  delete p.photo;
  renderPhoto(p); renderList(); scheduleSave(p);
};

$('#btn-print').onclick = () => {
  const missing = validate(current()).length;
  if (missing) {
    alert(`Impossible d’imprimer : ${missing} information(s) obligatoire(s) manquante(s).`);
    state.view = 'form'; render();
    return;
  }
  if (state.view !== 'plan') { state.view = 'plan'; render(); }
  setTimeout(() => window.print(), 150);
};

$('#btn-duplicate').onclick = () => {
  const { id, createdAt, updatedAt, ...data } = current();
  createProject({ ...data, nom: (data.nom || 'Projet') + ' (copie)' });
};

$('#btn-delete').onclick = async () => {
  const p = current();
  if (!confirm(`Supprimer définitivement le projet « ${p.nom} » ?`)) return;
  await DB.remove(p.id);
  state.projects = state.projects.filter(x => x.id !== p.id);
  state.currentId = state.projects[0]?.id || null;
  render();
};

$('#btn-export').onclick = () => {
  const blob = new Blob([JSON.stringify({ app: 'pv-business-plan', version: 1, projects: state.projects }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pv-business-plans-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$('#input-import').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.projects;
    if (!Array.isArray(list)) throw new Error('Format de fichier non reconnu');
    for (const p of list) {
      const project = { ...defaultProject(), ...p, id: p.id || uid() };
      await DB.put(project);
    }
    await load();
    alert(`${list.length} projet(s) importé(s).`);
  } catch (err) { alert('Import impossible : ' + err.message); }
};

window.addEventListener('beforeprint', () => state.charts.forEach(c => c.resize()));

load();
