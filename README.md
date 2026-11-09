# ☀ PV Business Plan

Application web qui génère automatiquement le business plan d'un projet de centrale photovoltaïque en autoconsommation avec vente du surplus.

Aucune installation, aucun serveur : c'est une page web statique, hébergeable gratuitement sur **GitHub Pages**.

## Fonctionnalités

- **Plusieurs projets** enregistrés, avec création, duplication et suppression.
- **Fiche projet** : nom, porteur, adresse, date de mise en service, notes, **photo de la centrale**.
- **Abonnement électricité** : fournisseur, option tarifaire, puissance souscrite, coût annuel, n° PDL.
- **Données de calcul** : production, consommation à considérer pour l'autoconsommation, prix du kWh, tarif de vente du surplus, investissement, subventions, charges, **montant, taux et durée de l'emprunt**.
- **Business plan généré** : synthèse et conclusion rédigées, présentation, caractéristiques techniques, hypothèses, plan de financement, tableau d'amortissement, graphiques, compte prévisionnel sur 25 ans, indicateurs (temps de retour, TRI, VAN, LCOE).
- **Export PDF** via le bouton « Imprimer / PDF » (choisir « Enregistrer au format PDF »).
- **Sauvegarde / transfert** : export et import de tous les projets en fichier JSON.

## Méthode de calcul

Pour chaque année *n* de la durée d'analyse :

| Grandeur | Formule |
|---|---|
| Production | production × (1 − dégradation)^(n−1) |
| Autoconsommation | min(production, consommation considérée) |
| Surplus vendu | production − autoconsommation |
| Économies | autoconsommation × prix du kWh × (1 + hausse)^(n−1) |
| Ventes | surplus × tarif de vente (indexé pendant le contrat, puis prix après contrat) |
| Charges | (maintenance + assurance) indexées + remplacement onduleur l'année choisie |
| Annuité | mensualités de l'emprunt à taux fixe (amortissement constant) |
| Flux net | économies + ventes − charges − annuité |

Apport = investissement − subventions − emprunt. La fiscalité n'est pas prise en compte.

## Mise en ligne sur GitHub Pages

1. Créez un dépôt sur <https://github.com/new> (par ex. `pv-business-plan`), public.
2. Envoyez les fichiers `index.html`, `style.css`, `app.js`, `calc.js`, `db.js` et `README.md` :
   - sans outil : bouton **Add file → Upload files** sur la page du dépôt, puis **Commit changes** ;
   - ou avec Git / GitHub Desktop.
3. Dans le dépôt : **Settings → Pages → Build and deployment**, Source **Deploy from a branch**, branche `main`, dossier `/ (root)`, **Save**.
4. Après une minute, l'application est disponible à l'adresse `https://<votre-compte>.github.io/pv-business-plan/`.

## Où sont stockées les données ?

Les projets (photos comprises) sont enregistrés **dans le navigateur** de l'utilisateur (IndexedDB) : rien n'est envoyé sur GitHub ni sur un serveur. Conséquences :

- chaque navigateur / ordinateur a ses propres projets ;
- vider les données du site efface les projets → utilisez **Exporter** régulièrement ;
- pour passer d'un poste à un autre : **Exporter** sur le premier, **Importer** sur le second.

## Utilisation en local

Ouvrez `index.html` via un petit serveur local (par ex. `npx serve .`) ou directement depuis GitHub Pages. Une connexion internet est nécessaire pour les graphiques (Chart.js chargé depuis jsDelivr).
