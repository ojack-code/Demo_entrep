/* Schéma des données d'un projet et moteur de calcul du business plan. */

const SCHEMA = [
  { title: 'Identification du projet', fields: [
    { k: 'nom', l: 'Nom du projet', t: 'text', d: 'Nouveau projet', wide: true },
    { k: 'porteur', l: 'Porteur du projet / client', t: 'text', d: '' },
    { k: 'dateMES', l: 'Mise en service prévue', t: 'date', d: '' },
    { k: 'adresse', l: 'Adresse du site', t: 'textarea', d: '', wide: true },
    { k: 'description', l: 'Description / notes', t: 'textarea', d: '', wide: true },
  ]},
  { title: 'Abonnement électricité', fields: [
    { k: 'fournisseur', l: 'Fournisseur', t: 'text', d: '' },
    { k: 'optionTarifaire', l: 'Option tarifaire', t: 'select', d: 'Base',
      o: ['Base', 'Heures pleines / creuses', 'Tempo', 'EJP', 'Tarif jaune / vert', 'Offre de marché', 'Autre'] },
    { k: 'puissanceSouscrite', l: 'Puissance souscrite', t: 'number', u: 'kVA', d: 9, step: 1 },
    { k: 'coutAbonnement', l: 'Coût de l’abonnement', t: 'number', u: '€/an', d: 180, step: 1 },
    { k: 'pdl', l: 'N° PDL / PRM', t: 'text', d: '' },
  ]},
  { title: 'Installation et énergie', fields: [
    { k: 'puissanceCrete', l: 'Puissance crête', t: 'number', u: 'kWc', d: 9, step: 0.1 },
    { k: 'production', l: 'Production annuelle estimée', t: 'number', u: 'kWh/an', d: 10800, step: 1, req: true },
    { k: 'consommation', l: 'Consommation à considérer pour l’autoconsommation', t: 'number', u: 'kWh/an', d: 6000, step: 1, req: true,
      help: 'Part de la consommation pouvant être couverte par la production (consommation simultanée).' },
    { k: 'degradation', l: 'Dégradation des panneaux', t: 'number', u: '%/an', d: 0.5, step: 0.1 },
  ]},
  { title: 'Prix de l’énergie', fields: [
    { k: 'prixKwh', l: 'Prix d’achat du kWh', t: 'number', u: '€/kWh', d: 0.2016, step: 0.0001, req: true },
    { k: 'inflationElec', l: 'Hausse annuelle du prix de l’électricité', t: 'number', u: '%/an', d: 3, step: 0.1 },
    { k: 'prixRachat', l: 'Tarif de vente du surplus', t: 'number', u: '€/kWh', d: 0.04, step: 0.0001 },
    { k: 'indexRachat', l: 'Indexation du tarif de vente', t: 'number', u: '%/an', d: 0, step: 0.1 },
    { k: 'dureeContrat', l: 'Durée du contrat de vente', t: 'number', u: 'ans', d: 20, step: 1 },
    { k: 'prixApresContrat', l: 'Prix de vente après contrat', t: 'number', u: '€/kWh', d: 0.03, step: 0.0001 },
  ]},
  { title: 'Investissement et charges', fields: [
    { k: 'capex', l: 'Coût total de l’installation', t: 'number', u: '€', d: 18000, step: 1, req: true },
    { k: 'subvention', l: 'Subventions / prime à l’autoconsommation', t: 'number', u: '€', d: 720, step: 1 },
    { k: 'maintenance', l: 'Maintenance', t: 'number', u: '€/an', d: 150, step: 1 },
    { k: 'assurance', l: 'Assurance', t: 'number', u: '€/an', d: 60, step: 1 },
    { k: 'inflationOpex', l: 'Hausse annuelle des charges', t: 'number', u: '%/an', d: 2, step: 0.1 },
    { k: 'coutOnduleur', l: 'Remplacement onduleur', t: 'number', u: '€', d: 1500, step: 1 },
    { k: 'anneeOnduleur', l: 'Année du remplacement', t: 'number', u: 'année', d: 12, step: 1 },
  ]},
  { title: 'Financement', fields: [
    { k: 'emprunt', l: 'Montant emprunté', t: 'number', u: '€', d: 15000, step: 1, req: true },
    { k: 'taux', l: 'Taux d’intérêt annuel', t: 'number', u: '%', d: 4, step: 0.01, req: true },
    { k: 'dureeEmprunt', l: 'Durée de l’emprunt', t: 'number', u: 'ans', d: 10, step: 1, req: true },
  ]},
  { title: 'Paramètres d’analyse', fields: [
    { k: 'dureeAnalyse', l: 'Durée d’analyse', t: 'number', u: 'ans', d: 25, step: 1 },
    { k: 'tauxActualisation', l: 'Taux d’actualisation (VAN)', t: 'number', u: '%', d: 4, step: 0.1 },
  ]},
];

const FIELDS = Object.fromEntries(SCHEMA.flatMap(s => s.fields).map(f => [f.k, f]));

function defaultProject() {
  const p = {};
  for (const f of Object.values(FIELDS)) p[f.k] = f.d;
  return p;
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
    const prixVente = y <= p.dureeContrat ? p.prixRachat * Math.pow(1 + idxR, y - 1) : p.prixApresContrat;
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

  return { p, loan, years, k, warnings };
}
