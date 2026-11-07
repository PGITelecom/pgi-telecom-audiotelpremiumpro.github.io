# Audiotel Premium Pro | Compétitivité et automatisation vérifiables
Date de la recherche : 07/11/2026. Document interne, non contractuel. Ne publier aucune promesse avant preuve opérateur et validation juridique.

## Sources externes et limitations
- Arcep, affectation des numéros, mise à jour 23/09/2026 :
  https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html
  Les nouveaux prêts de numéros 08 entre opérateurs sont interdits depuis 2018, sauf exceptions spécifiques. Le rôle de cocontractant téléphonique implique le contrôle réglementaire des numéros affectés.
- Arcep, plan de numérotation, 14/09/2026 :
  https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-numerotation.html
  Plafond HT du service à la minute : 081 = 0,050 €, 082 = 0,167 €, 089 = 0,667 €. Le prix de la communication et les reversements opérateur sont distincts.
- Dialotel, page commerciale propre à l'entreprise :
  https://www.dialotel.fr/numeros-surtaxes/voyance/
  **Allégations commerciales du concurrent non vérifiées indépendamment** : zéro abonnement / frais de mise en service, reversements mensuels automatisés, statistiques en temps réel, activation annoncée en 48 h, multi-experts et file d'attente.
- OVHcloud, documentation SVA : https://docs.ovhcloud.com/fr/guides/web-cloud/phone-and-fax/voip/faq-voip
  Présente des services SVA avec gestion des coûts et reversements en espace client. Disponibilité, prix et qualité doivent être demandés contractuellement.

## Implication commerciale
L'abonnement portail Audiotel prévu à 4,90 € TTC/mois ne constitue PAS un avantage prix universel par rapport à un acteur qui annonce un abonnement à 0 €. Ne pas promettre « moins cher que tous » sans comparer le reversement net contractuel, les frais techniques, la portabilité et les services fournis.

Différenciation crédible à mesurer :
1. **Traçabilité client de bout en bout** : montant estimé, confirmé, payable et réellement versé, date, référence PSP, relevé exportable, correction et litige visibles.
2. **Simplicité de l'activation** : une seule saisie KYB, contrat versionné, historique opérateur et numéro livré uniquement après affectation valide.
3. **Supervision** : qualité SIP/CDR, incidents, appel perdu, temps de prise en charge, tableaux de bord fiables et pannes identifiées.
4. **Portabilité sécurisée** : statut opérateur réel, annulation et reprise sur incident, pas de fausse date de bascule.
5. **Transparence contractuelle** : frais et dates connus, conditions des paliers, historique des prix, calcul exact du reversement.
6. **Service client** : réclamation horodatée, statut, responsable, historique et justificatifs, sans réaffecter à un autre compte.
7. **Fiabilité financière** : jamais de reversement fondé uniquement sur une projection ; dédoublonnage, retenues, rapprochement bancaire et prestataire autorisé.

## Garde-fou économique
L'objectif interne de marge de 0,07 €/min doit être évalué par catégorie et par contrat. **Sur 081 à la minute, il est impossible d'obtenir cette marge à partir de la seule composante réglementée du service**, limitée à 0,05 €/min HT avant autres déductions.

Le module `backend/src/audiotel-margin-safety.mjs` analyse les unités et bloque les dépassements de plafond, coûts non vérifiés, marges négatives ou sous l'objectif. Il ne publie pas de tarif et ne modifie aucun contrat.

La décision commerciale compare : marge variable réellement disponible, frais fixes, coûts de versement, durée de vie client, volume vérifié, réclamations et coût d'acquisition. Aucune offre ne doit être tarifée sur des montants théoriques sans relevés opérateur.

## Objectifs de mesure (à contractualiser, pas des résultats actuels)
- Activation : délai entre dossier complet et confirmation d'affectation opérateur.
- Connectivité : disponibilité, ASR, PDD, pertes et latence côté opérateur.
- Reversements : pourcentage rapproché sans écart, montants en retard, doublons bloqués, temps avant confirmation bancaire.
- Service client : première réponse et résolution mesurées par priorité.
- Commercial : coût d'acquisition et marge contributive par compte, par ligne et par minute réellement facturable.
- Données : restauration complète chronométrée, droits les plus limités, absence d'accès cross-tenant.
- Expérience : temps de recherche d'un dossier client, temps d'obtention du justificatif d'un versement.

## Ordre d'exécution sans prestataire
1. Fusionner proprement les trois développements uniquement sur la branche d'intégration : PR #187. Le dépôt main reste inchangé.
2. Garder le diagnostic staff `/platform/launch-readiness` fail-closed et afficher les priorités automatiques basées sur les données réelles.
3. Remonter les exceptions financières : payable en retard, blocage juridique, paiement dit versé sans référence et réclamations ouvertes.
4. Maintenir les dossiers clients et la recherche globale, avec tous les versements paginés, et un espace client isolé.
5. Exiger des essais unitaires, SQL, sécurité et de reprise sur incident après chaque changement.
6. Préparer un dossier d'interconnexion et de conformité pour l'opérateur / attributaire ou attribution directe Arcep.

## Dépendances non remplaçables par du code
- Accord opérateur, numéros effectivement attribuables, routage et relevés de détail.
- Qualification juridique du modèle Audiotel comme cocontractant et flux réglementés.
- Comptabilité TVA/FEC, facturation électronique et traitement principal ou mandataire approuvés.
- PSP bancaire autorisé pour reversements issus de recettes opérateur ; Stripe au bon compte lorsque son accès sera confirmé.
- Tests sur des appels, fonds et destinataires réels autorisés, sous contrôle et après feu vert.

**État documentaire :** aucun devis opérateur vérifié, aucune garantie concurrentielle déduite de pages marketing, aucune projection de CA présentée comme un chiffre réalisé. Aucune mise en production ni activation automatique.
