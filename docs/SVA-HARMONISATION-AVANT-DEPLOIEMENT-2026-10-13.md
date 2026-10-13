# PGI Telecom | Audiotel Premium Pro : harmonisation pré-déploiement

Préparation réalisée le 13 octobre 2026. Ce document accompagne un lot non encore publié, sans action sur l'opérateur, Stripe, Neon ni Vercel.

## Modifications de code

1. Texte de l'abonnement et du checkout : le mois civil de souscription offert est présenté comme une période sans prélèvement immédiat. Stripe détermine sa vraie prochaine échéance via le backend existant.
2. Affichage de l'abonnement : ne plus qualifier systématiquement la période en cours de période déjà payée, particulièrement pendant l'offre initiale.
3. Retour Stripe : ne pas déclarer « paiement reçu » sans webhook.
4. Départ client : messages précis en attente des confirmations de portabilité et de RIO.
5. CRM HubSpot : ne pas classer un client comme perdu sur une simple demande de départ, qui peut être partielle ou annulée.
6. Relation client : une réponse seulement enregistrée dans le dossier n'est pas présentée comme un email expédié.
7. Clôture irréversible : contrôles bloquants pour confirmation du client, sortie intégrale, facture finale, reversements, export réellement livré, lignes terminées avec référence opérateur en cas de port-out, et absence d'abonnement toujours actif.

## Dépendances et limitations

- Les 34 clauses juridiques révisées ont été préparées séparément et doivent être intégrées avec une nouvelle version contractuelle synchronisée sur toutes les surfaces d'acceptation et les parcours B2C/B2B. Ne pas remplacer silencieusement les CGV version v5 en production.
- Le conseiller de sortie SVA (27 tests locaux) est développé hors production mais son intégration technique dans les workflows reste une étape distincte.
- Le logiciel actuel doit encore produire et réellement remettre les exports des données clients. Tant que ce flux n'est pas validé, la clôture définitive doit rester bloquée plutôt que de simuler une livraison.
- La synchronisation de statut HubSpot après la clôture réellement confirmée reste à raccorder.
- La portabilité prioritaire à 9,90 euros exige la vérification de sa licéité et la disponibilité de l'opérateur avant encaissement.
- L'API opérateur, les preuves RIO, les reversements et factures finales doivent être testés de bout en bout.
- Le dépôt doit être passé aux tests complets du projet et à la revue juridique avant fusion / déploiement.

Ce commit est destiné à la validation technique. Ne pas déployer ni fusionner sur la production sans top départ explicite.
