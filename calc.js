/* Schéma des données d'un projet et moteur de calcul du business plan. */

/* Aucune valeur par défaut : les champs `req` doivent être saisis pour générer le business plan.
   Les champs numériques facultatifs laissés vides valent 0. `ph` = exemple affiché en grisé. */
const SCHEMA = [
  { title: 'Identification du projet', fields: [
    { k: 'nom', l: 'Nom du projet', t: 'text', req: true, wide: true, ph: 'ex. Centrale toiture hangar' },
    { k: 'porteur', l: 'Porteur du projet / client', t: 'text' },
    { k: 'dateMES', l: 'Mise en service prévue', t: 'date' },
    { k: 'adresse', l: 'Adresse du site', t: 'textarea', wide: true },
    { k: 'description', l: 'Description / notes', t: 'textarea', wide: true },
  ]},
  { title: 'Abonnement et prix de l’électricité', fields: [
    { k: 'fournisseur', l: 'Fournisseur', t: 'text' },
    { k: 'optionTarifaire', l: 'Option tarifaire', t: 'select',
      o: ['', 'Base', 'Heures pleines / creuses', 'Tempo', 'EJP', 'Tarif jaune / vert', 'Offre de marché', 'Autre'] },
    { k: 'puissanceSouscrite', l: 'Puissance souscrite', t: 'number', u: 'kVA', step: 1 },
    { k: 'pdl', l: 'N° PDL / PRM', t: 'text' },
    { k: 'prixKwh', l: 'Prix du kWh (part énergie, hors abonnement)', t: 'number', u: '€/kWh', step: 0.0001, req: true, ph: 'ex. 0,2016',
      help: 'Seul le prix du kWh consommé est effacé par l’autoconsommation ; l’abonnement reste dû et n’est pas compté dans les économies. En HP/HC, indiquez un prix moyen pondéré.' },
    { k: 'inflationElec', l: 'Hausse annuelle du prix du kWh', t: 'number', u: '%/an', step: 0.1, ph: 'ex. 3' },
  ]},
  { title: 'Installation et énergie', fields: [
    { k: 'puissanceCrete', l: 'Puissance crête', t: 'number', u: 'kWc', step: 0.1 },
    { k: 'production', l: 'Production annuelle estimée', t: 'number', u: 'kWh/an', step: 1, req: true, min: 1 },
    { k: 'consommation', l: 'Consommation à considérer pour l’autoconsommation', t: 'number', u: 'kWh/an', step: 1, req: true,
      help: 'Part de la consommation pouvant être couverte par la production (consommation simultanée).' },
    { k: 'degradation', l: 'Dégradation des panneaux', t: 'number', u: '%/an', step: 0.1, ph: 'ex. 0,5' },
  ]},
  { title: 'Vente du surplus', fields: [
    { k: 'prixRachat', l: 'Tarif de vente du surplus', t: 'number', u: '€/kWh', step: 0.0001, req: true, ph: 'ex. 0,04',
      help: 'Saisir 0 s’il n’y a pas de vente.' },
    { k: 'indexRachat', l: 'Indexation du tarif de vente', t: 'number', u: '%/an', step: 0.1 },
    { k: 'dureeContrat', l: 'Durée du contrat de vente', t: 'number', u: 'ans', step: 1, help: 'Vide = toute la durée d’analyse.' },
    { k: 'prixApresContrat', l: 'Prix de vente après contrat', t: 'number', u: '€/kWh', step: 0.0001 },
  ]},
  { title: 'Investissement et charges', fields: [
    { k: 'capex', l: 'Coût total de l’installation', t: 'number', u: '€', step: 1, req: true, min: 1 },
    { k: 'subvention', l: 'Subventions / prime à l’autoconsommation', t: 'number', u: '€', step: 1 },
    { k: 'maintenance', l: 'Maintenance', t: 'number', u: '€/an', step: 1 },
    { k: 'assurance', l: 'Assurance', t: 'number', u: '€/an', step: 1 },
    { k: 'inflationOpex', l: 'Hausse annuelle des charges', t: 'number', u: '%/an', step: 0.1 },
    { k: 'coutOnduleur', l: 'Remplacement onduleur', t: 'number', u: '€', step: 1 },
    { k: 'anneeOnduleur', l: 'Année du remplacement', t: 'number', u: 'année', step: 1 },
  ]},
  { title: 'Financement', fields: [
    { k: 'emprunt', l: 'Montant emprunté', t: 'number', u: '€', step: 1, req: true, help: 'Saisir 0 si le projet est autofinancé.' },
    { k: 'taux', l: 'Taux d’intérêt annuel', t: 'number', u: '%', step: 0.01, req: true },
    { k: 'dureeEmprunt', l: 'Durée de l’emprunt', t: 'number', u: 'ans', step: 1, req: true, min: 1 },
  ]},
  { title: 'Paramètres d’analyse', fields: [
    { k: 'dureeAnalyse', l: 'Durée d’analyse', t: 'number', u: 'ans', step: 1, req: true, min: 1, ph: 'ex. 25' },
    { k: 'tauxActualisation', l: 'Taux d’actualisation (VAN)', t: 'number', u: '%', step: 0.1, ph: 'ex. 4' },
  ]},
];

const FIELDS = Object.fromEntries(SCHEMA.flatMap(s => s.fields).map(f => [f.k, f]));

function defaultProject() {
  const p = {};
  for (const f of Object.values(FIELDS)) p[f.k] = '';
  return p;
}

const isEmpty = v => v === '' || v == null || (typeof v === 'number' && !isFinite(v));

/* Champ obligatoire selon le projet : taux et durée ne sont exigés que s'il y a un emprunt. */
function isRequired(f, p) {
  if (!f.req) return false;
  if ((f.k === 'taux' || f.k === 'dureeEmprunt') && !isEmpty(p.emprunt) && parseFloat(p.emprunt) === 0) return false;
  return true;
}

/* Liste des champs obligatoires manquants ou invalides : { k, l, msg }. */
function validate(p) {
  const errors = [];
  for (const f of Object.values(FIELDS)) {
    if (!isRequired(f, p)) continue;
    const v = p[f.k];
    if (f.t === 'number') {
      if (isEmpty(v)) errors.push({ k: f.k, l: f.l, msg: 'à renseigner' });
      else if (parseFloat(v) < 0) errors.push({ k: f.k, l: f.l, msg: 'doit être positif' });
      else if (f.min != null && parseFloat(v) < f.min) errors.push({ k: f.k, l: f.l, msg: `doit être au moins ${f.min}` });
    } else if (!String(v ?? '').trim()) errors.push({ k: f.k, l: f.l, msg: 'à renseigner' });
  }
  return errors;
}

/* Tableau d'amortissement mensuel, agrégé par année. */
function loanSchedule(principal, ratePct, years) {
  const n = Math.max(0, Math.round(years * 12));
  const r = ratePct / 100 / 12;
  if (principal <= 0 || n === 0) return { mensualite: 0, totalInterets: 0, annees: [] };
  const mensualite = r === 0 ? principal / n : principal * r / (1 - Math.pow(1 + r, -n));
  let solde = principal;
  const annees = [];
  for (let m = 0; m < n; m++) {
    const y = Math.floor(m / 12);
    if (!annees[y]) annees[y] = { annee: y + 1, annuite: 0, interets: 0, capital: 0, solde: 0 };
    const interet = solde * r;
    const capital = mensualite - interet;
    solde = Math.max(0, solde - capital);
    annees[y].annuite += mensualite;
    annees[y].interets += interet;
    annees[y].capital += capital;
    annees[y].solde = solde;
  }
  const totalInterets = annees.reduce((s, a) => s + a.interets, 0);
  return { mensualite, totalInterets, annees };
}

function npv(rate, flows) {
  return flows.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t), 0);
}

/* TRI par dichotomie ; null si non défini (pas de changement de signe). */
function irr(flows) {
  let lo = -0.99, hi = 1;
  let fLo = npv(lo, flows), fHi = npv(hi, flows);
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, flows);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}

/* Délai de récupération interpolé : première année où le cumul devient positif. */
function payback(initial, flows) {
  let cumul = -initial;
  if (cumul >= 0) return 0;
  for (let i = 0; i < flows.length; i++) {
    const prev = cumul;
    cumul += flows[i];
    if (cumul >= 0) return i + (flows[i] > 0 ? -prev / flows[i] : 1);
  }
  return null;
}

function num(v) {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

function compute(raw) {
  const p = {};
  for (const f of Object.values(FIELDS)) p[f.k] = f.t === 'number' ? num(raw[f.k]) : raw[f.k];

  const N = Math.max(1, Math.min(50, Math.round(p.dureeAnalyse || 25)));
  const deg = p.degradation / 100;
  const inflE = p.inflationElec / 100;
  const inflO = p.inflationOpex / 100;
  const idxR = p.indexRachat / 100;
  const disc = p.tauxActualisation / 100;
  const contrat = isEmpty(raw.dureeContrat) ? N : p.dureeContrat;

  const loan = loanSchedule(p.emprunt, p.taux, p.dureeEmprunt);
  const investNet = p.capex - p.subvention;
  const apport = investNet - p.emprunt;

  const years = [];
  let cumul = -apport;
  for (let y = 1; y <= N; y++) {
    const production = p.production * Math.pow(1 - deg, y - 1);
    const autoconso = Math.min(production, p.consommation);
    const surplus = production - autoconso;
    const prixAchat = p.prixKwh * Math.pow(1 + inflE, y - 1);
    const prixVente = y <= contrat ? p.prixRachat * Math.pow(1 + idxR, y - 1) : p.prixApresContrat;
    const economies = autoconso * prixAchat;
    const ventes = surplus * prixVente;
    const charges = (p.maintenance + p.assurance) * Math.pow(1 + inflO, y - 1)
      + (Math.round(p.anneeOnduleur) === y ? p.coutOnduleur : 0);
    const l = loan.annees[y - 1] || { annuite: 0, interets: 0, capital: 0, solde: 0 };
    const fluxProjet = economies + ventes - charges;
    const fluxNet = fluxProjet - l.annuite;
    cumul += fluxNet;
    years.push({ annee: y, production, autoconso, surplus, prixAchat, prixVente, economies, ventes,
      charges, annuite: l.annuite, interets: l.interets, capital: l.capital, fluxProjet, fluxNet, cumul });
  }

  const fluxProjet = years.map(y => y.fluxProjet);
  const fluxNet = years.map(y => y.fluxNet);
  const projetFlows = [-investNet, ...fluxProjet];
  const equityFlows = [-apport, ...fluxNet];

  const discProd = years.reduce((s, y) => s + y.production / Math.pow(1 + disc, y.annee), 0);
  const discCharges = years.reduce((s, y) => s + y.charges / Math.pow(1 + disc, y.annee), 0);

  const y1 = years[0];
  const k = {
    N,
    investNet,
    apport,
    mensualite: loan.mensualite,
    totalInterets: loan.totalInterets,
    coutTotalCredit: p.emprunt + loan.totalInterets,
    productible: p.puissanceCrete > 0 ? p.production / p.puissanceCrete : null,
    autoconsoAn1: y1.autoconso,
    surplusAn1: y1.surplus,
    tauxAutoconso: y1.production > 0 ? y1.autoconso / y1.production : 0,
    tauxCouverture: p.consommation > 0 ? y1.autoconso / p.consommation : 0,
    gainsAn1: y1.economies + y1.ventes,
    economiesAn1: y1.economies,
    ventesAn1: y1.ventes,
    fluxNetAn1: y1.fluxNet,
    paybackProjet: payback(investNet, fluxProjet),
    paybackTreso: payback(apport, fluxNet),
    triProjet: irr(projetFlows),
    triFondsPropres: apport > 0 ? irr(equityFlows) : null,
    vanProjet: npv(disc, projetFlows),
    vanFondsPropres: npv(disc, equityFlows),
    lcoe: discProd > 0 ? (investNet + discCharges) / discProd : null,
    gainNetTotal: fluxNet.reduce((s, v) => s + v, 0) - apport,
    totalEconomies: years.reduce((s, y) => s + y.economies, 0),
    totalVentes: years.reduce((s, y) => s + y.ventes, 0),
    totalCharges: years.reduce((s, y) => s + y.charges, 0),
    minTreso: Math.min(-apport, ...years.map(y => y.cumul)),
    anneesNegatives: years.filter(y => y.annee <= p.dureeEmprunt && y.fluxNet < 0).length,
  };

  const warnings = [];
  if (p.emprunt > investNet + 0.5) warnings.push('Le montant emprunté dépasse l’investissement net de subventions.');
  if (p.production <= 0) warnings.push('La production annuelle doit être renseignée.');
  if (p.consommation <= 0) warnings.push('Aucune consommation autoconsommable : toute la production est vendue.');
  if (p.dureeEmprunt > N) warnings.push('La durée de l’emprunt dépasse la durée d’analyse.');

  return { p, loan, years, k, warnings, contrat };
}
