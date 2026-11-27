# Dépendances minimales : architecture PGI souveraine

## Objectif

PGI Telecom • Audiotel Premium Pro doit réduire les dépendances externes au strict nécessaire.

## Dépendance externe minimale

### 1. Opérateur SVA hôte

Rôle strictement limité à ce que PGI ne peut pas assumer directement dans le modèle actuel :

- ressource de numérotation / exploitation réseau du 089 ;
- accessibilité du 089 depuis les réseaux appelants ;
- interconnexion SVA ;
- portabilité réseau ;
- collecte/reversement de la composante service selon le contrat ;
- obligations opérateur associées à la ressource.

L'opérateur ne doit pas être propriétaire du cœur métier PGI.

Il ne doit pas imposer, lorsque le contrat le permet :

- son SVI ;
- son routage métier ;
- son dashboard ;
- son CRM ;
- son moteur de statistiques ;
- sa logique expert ;
- son stockage comme source de vérité ;
- son moteur de marge ;
- ses exports comme seul accès aux données.

## Composants possédés par PGI

| Fonction | Propriétaire |
|---|---|
| Dashboard | PGI |
| API | PGI |
| PostgreSQL | PGI |
| Valkey | PGI |
| Kamailio/OpenSIPS | PGI |
| FreeSWITCH | PGI |
| SVI | PGI |
| Routage experts | PGI |
| Files d'attente | PGI |
| Présence experts | PGI |
| CDR interne | PGI |
| Modèle client | PGI |
| Moteur financier | PGI |
| Réconciliation | PGI |
| Historique contrats | PGI |
| Exports | PGI |
| Monitoring | PGI |
| Alertes | PGI |
| Audit | PGI |
| Sauvegardes | PGI |
| CI/CD | PGI / GitHub |
| Numéro 089 attribué directement | Audiotel seulement après décision Arcep ; sinon selon droits et contrats réels |
| Interconnexion SVA | opérateur hôte |
| Collecte réseau / reversement | opérateur hôte |

## Fournisseurs non nécessaires

PGI ne nécessite pas comme dépendance structurelle :

- plateforme Audiotel hébergée tierce ;
- fournisseur de SVI hébergé ;
- fournisseur de dashboard télécom ;
- fournisseur de CRM téléphonique ;
- fournisseur de files d'attente ;
- fournisseur de CDR métier ;
- moteur de réconciliation tiers ;
- Cloudflare ;
- outil de monitoring SaaS obligatoire.

Des services facultatifs pourront être ajoutés uniquement s'ils apportent un gain mesurable et restent remplaçables.

## Règle d'architecture

Aucun composant métier ne doit importer un SDK propre à un opérateur SVA.

La relation opérateur est limitée à :

```
PGI canonical model
       │
       ▼
Carrier Adapter v1
       │
       ├── SIP
       ├── CDR
       └── Settlement
             │
             ▼
       opérateur hôte
```

## Source de vérité

La source de vérité est PGI :

- FreeSWITCH/Kamailio pour les événements téléphoniques internes ;
- PostgreSQL pour le modèle métier ;
- relevé opérateur conservé comme preuve externe ;
- rapprochement entre les deux.

Un dashboard opérateur n'est jamais la source de vérité de PGI.

## Indépendance réseau

Le système doit continuer à fonctionner pour les fonctions non réseau même si l'opérateur hôte est indisponible :

- consultation historique ;
- finance historique ;
- rapports ;
- experts ;
- configuration ;
- audit.

La panne du fournisseur ne doit pas corrompre les données PGI.

## Changement d'opérateur

Le remplacement de l'opérateur doit se limiter à :

1. créer son profil/adaptateur ;
2. renseigner le nouveau contrat ;
3. configurer les connexions SIP/CDR/règlement ;
4. tester ;
5. porter le même 089 ;
6. basculer `sva-primary`.

Aucune refonte applicative.

## PSP / établissement de paiement

Si l'opérateur utilise un établissement de paiement en sous-jacent pour les reversements, PGI ne doit pas en dépendre techniquement dans le cœur.

L'opérateur/adaptateur encapsule cette relation. Si le modèle contractuel impose une relation directe avec un PSP, elle reste une dépendance financière périphérique, jamais une dépendance téléphonique ou applicative.

## Charte de coûts minimaux et de négociation, 27/11/2026

**Règle de décision : réduire le coût total net, pas seulement le nombre de fournisseurs.** Priorité à une préparation à dépenses nouvelles quasi nulles ; pour l'exploitation, chaque coût récurrent ou à la minute doit être justifié par une prestation vérifiable. Aucun choix ne peut dégrader la sécurité, la couverture nationale des appels 089 ou la conformité des reversements.

### Ce que nous internalisons sans nouveau prestataire

- Code du cockpit, CRM métier, gestion des clients, routage applicatif, SVI, calcul des commissions, réconciliation, normalisation et archives CDR, reporting et exports portables.
- Interfaces ouvertes et absence d'exclusivité : adaptation à l'opérateur sans réécriture du cœur, mais sans prétendre qu'une portabilité réseau est instantanée.
- Réutiliser GitHub, Vercel, Neon et les modules existants tant que leurs capacités et leurs conditions d'exploitation sont adaptées ; ne pas multiplier les outils ni héberger inutilement des serveurs 24/7 avant trafic réel.
- Les tiers d'infrastructure restent des prestataires : les plans gratuits et le logiciel libre ne garantissent ni SLA ni service téléphonique professionnel gratuit.

### Deux schémas à mettre en concurrence

1. **Collecteur de gros à périmètre réduit** : Audiotel détient sa numérotation seulement après décision Arcep, garde son SIP/SVI et sa relation éditeur ; un partenaire assure l'accessibilité nationale 089, l'interconnexion et la collecte, plus un règlement conforme. Exiger un prix unitaire HT et les retenues documentées, les frais fixes minimaux, aucun minimum de trafic non accepté, pas de location d'un bloc qui nous est directement attribué, exports complets et possibilité de sortie.
2. **Interconnexion gérée par Audiotel** : équipement SIP/SBC exploité par Audiotel et accords bilatéraux avec des opérateurs ; chiffrer séparément raccordement, transport, énergie/hébergement, astreinte, cybersécurité, fraude, facturation interopérateurs, CDR et créances. Cela ne supprime pas les contrats et la couverture réseau ; ne le préférer que si son coût complet et son risque sont démontrés inférieurs à la collecte de gros.

### Demande commerciale non confidentielle aux opérateurs

- Objet : collecte et accessibilité nationale de numéros SVA 089 **dont l'attribution directe est projetée et non acquise**, avec livraison sur SIP Audiotel et CDR standard exportables.
- Préciser le statut réel de la société, l'état de la demande de numérotation, les capacités réellement exploitées, le dispositif anti-fraude *prévu* et les partenaires effectivement confirmés. Ne jamais inventer Kbis, agrément, volumes, garanties de paiement ni infrastructure en production.
- Demander des tarifs complets, sans exclusivité ni outil de gestion imposé : frais d'ouverture/fermeture, transit ou acheminement, coût/minute, retenues/frais de litige, règlement éditeurs, périodicité, SLA et conditions de sortie.
- Autoriser des propositions alternatives **à condition que les fonctions et coûts soient ventilés** ; une réponse négative n'autorise pas à contourner les règles de sécurité ni à falsifier le dossier.

### Critères de choix objectifs

- **Éliminatoires :** droits réels d'exploitation, disponibilité 089 prouvée, accord de collecte/règlements conforme, contrôle antifraude, cloisonnement des clients, données exportables, sécurité du SIP et conditions de sortie acceptables.
- **Coût total :** investissement amorti, coûts fixes, coûts variables, hébergement, maintenance/sécurité, assurance/réclamations, fraude, fiscalité et risques financiers. Calculer au volume réaliste confirmé ; ne pas afficher de prix inventés.
- **Marge privée :** contrôler le plancher interne de marge par minute après coûts et fiscalité, sans divulguer ce seuil aux prestataires.
- **Arcep :** taxe de numérotation indicative en 2026 : 0,02 €/numéro/an pour un bloc standard, soit 20 €/an pour 1 000 numéros s'ils sont attribués. Ce montant ne couvre pas l'interconnexion, l'exploitation, la collecte ni les obligations réglementaires. Source : https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation/taxes-de-numerotation.html (mise à jour du 09/07/2026).
- **Paiements :** l'encaissement pour compte de tiers peut relever de services de paiement ; la qualification exacte dépend du montage. Privilégier, si juridiquement valide, les versements directs opérateur/PSP aux éditeurs pour ne pas immobiliser de fonds. Source : https://acpr.banque-france.fr/en/node/26817 .

Aucun engagement, déploiement ni interconnexion ne découle de ce dossier de négociation. Les contrôles de conformité et de cybersécurité restent obligatoires même lorsqu'ils ont un coût.


## Maximiser le rendement réel par appel, sans frais supplémentaires

Le simulateur pur `evaluatePerCallContribution` du module `assets/autonomy-cost-engine.mjs` évalue une **contribution économique HT prévisionnelle par appel**, sans appeler aucun opérateur, sans changer le tarif du client et sans utiliser une base de données. Les huit paramètres obligatoires sont : secondes de service facturables, revenu HT de la composante service contractuellement dû à Audiotel avant partage, part de l'éditeur, coûts opérateur/collecte, exploitation variable, provision prudente pour fraude/impayés, frais fixes mensuels affectés et nombre mensuel d'appels.

La contribution unitaire = revenu service HT contractuel - part éditeur - collecte/réseau - autres coûts variables - provision de risque - quote-part des frais fixes. Le résultat **n'est pas le bénéfice net personnel après fiscalité** ; l'impôt, les cotisations et les conditions effectives d'encaissement doivent être instruits séparément. Ne pas appliquer la recette totale facturée par l'opérateur au client comme revenu Audiotel, ne pas compter deux fois un frais déjà déduit par contrat, et ne pas afficher une marge comme « confirmée » sans pièces et réconciliation.

Le moteur refuse les valeurs manquantes, volumes nuls pour la répartition mensuelle et montants ambigus ; il expose aussi les marges négatives. Aucune hypothèse commerciale n'est préremplie. Les valeurs des tests automatiques sont **fictives et non assimilables à des tarifs négociés**.

Pour optimiser le rendement, comparer la marge unitaire réellement recouvrée **et** le nombre d'appels légitimes, la satisfaction client et la rétention des éditeurs. Respecter strictement la signalétique SVA, le message gratuit d'information tarifaire, les plafonds réglementaires et la tarification autorisée. Ne jamais améliorer la marge par facturation fictive, prolongation abusive des appels, trafic artificiel, opacité du tarif ou manipulation des CDR.

Références : https://www.arcep.fr/mes-demarches-et-services/consommateurs/fiches-pratiques/les-numeros-08-et-les-numeros-courts.html et https://www.economie.gouv.fr/particuliers/eviter-les-arnaques/numeros-commencant-par-08-quels-sont-les-tarifs
