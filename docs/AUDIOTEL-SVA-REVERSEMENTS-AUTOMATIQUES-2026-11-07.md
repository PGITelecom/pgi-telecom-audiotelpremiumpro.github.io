# Audiotel Premium Pro — reversements SVA automatisés (architecture préparatoire)

État 07/11/2026 : **architecture et décisions préparatoires uniquement**. Le nouveau module
`backend/src/audiotel-sva-payout-preview.mjs` ne peut pas contacter Stripe, une banque,
un opérateur, ni marquer un règlement comme payé. Aucune migration et aucune autorisation de virement.
Ne pas confondre les recettes SVA, l'abonnement mensuel 4,90 EUR TTC et les primes de parrainage.

## Pourquoi il faut deux circuits

1. **Stripe Billing** : encaissement des abonnements et autres prestations CB. Les frais Stripe,
   les remboursements et la TVA correspondante font l'objet d'une comptabilité propre.
2. **Recettes SVA collectées par l'opérateur** : CDR et relevés vérifiables, confirmation des
   montants, puis réception réelle des fonds de l'opérateur avant d'autoriser une redistribution.
   Un Stripe charge/succeeded ne démontre pas l'encaissement d'une recette SVA opérateur.

## Connect et paiements aux clients

- **Stripe Connect** peut transférer des fonds vers un compte connecté, puis Stripe peut émettre
  un payout bancaire. Il faut distinguer : transfert interne Stripe ≠ fonds arrivés au compte
  bancaire du client. Les statuts `payout.paid` / `payout.failed` doivent être rapprochés.
- **Apport de fonds opérateur non-Stripe** : les top-ups Stripe Connect sont en préversion privée
  dans l'UE, sous réserve d'acceptation. Stripe Global Payouts est aussi en préversion privée
  pour une entreprise française au 07/11/2026. **Ne jamais supposer ces fonctions actives**.
- **Plan B indispensable** : un PSP bancaire autorisé offrant des virements SEPA de masse,
  via un adaptateur interchangeable et sous responsabilité contractuelle et réglementaire claire.
- Le raccordement Stripe Connect actuellement utilisé pour les primes de parrainage n'est **pas**
  une preuve de capacité à redistribuer les recettes SVA. Aucun recyclage des tables de primes.

Sources officielles consultées :
- https://docs.stripe.com/connect/top-ups
- https://docs.stripe.com/global-payouts
- https://docs.stripe.com/connect/manage-connected-account-payouts
- https://acpr.banque-france.fr/en/node/26817

## Pipeline de bout en bout

1. **Ingestion** : relever les CDR horodatés, contrats/tarifs en vigueur et identifiants opérateur.
   Enregistrer les versions, les hashes des fichiers reçus et les anomalies sans écraser l'original.
2. **Calcul** : durée billable et tranches contractuelles ; calcul de la rémunération collectée et
   de la marge Audiotel ; distinguer projections HT, droits confirmés, TVA, retenues et régularisations.
3. **Rapprochement** : réconcilier montant CDR attendu, état opérateur signé/vérifié, règlement bancaire
   effectivement reçu, affectation par client/période. Un appel non confirmé ne crée pas de dette payable.
4. **Liquidation des droits** : détermination au centime du montant net dû après marge contractuelle,
   corrections validées, retenues documentées, reversements déjà effectués. Historisation des barèmes
   et règlements déjà versés pour éviter toute double allocation.
5. **Conformité bénéficiaire** : KYB/KYC conforme au prestataire, mandats signés, RIB vérifié,
   IBAN modifié récemment => suspension, contrôle antifraude, oppositions, réserves et litiges.
6. **Calendrier** : périodicité prévue au contrat (par exemple mensuelle), délai opérateur,
   report de montants sous seuil autorisé, évitement des jours non ouvrés ; aucune anticipation
   de trésorerie sans approbation et règle écrite.
7. **Verrouillage financier** : contrôle du solde réellement disponible et de toutes les autres
   dettes promises, contraintes de liquidité, plafond journalier et contrôle quatre yeux pour
   première mise en paiement, nouveau RIB, sommes inhabituelles ou corrections exceptionnelles.
8. **Dispatch** : émission en une fois via `payout_batch_id` et clé d'idempotence non réutilisable.
   Outbox transactionnelle, `SELECT FOR UPDATE SKIP LOCKED`, contrainte UNIQUE
   `(tenant, settlement, currency, period)`, et rapprochement API avant réessai après timeout.
9. **Réconciliation prestataire** : états `proposed → approved → submitted → in_transit →
   confirmed_paid` ou `failed/returned/held` ; statut `paid` seulement après preuve
   du PSP/bancaire vérifiable, jamais au simple retour HTTP 200 de l'API.
10. **Comptabilité et preuve** : journal de règlements, dettes envers éditeurs, montants en transit,
    marge facturée, TVA selon qualification validée, frais bancaires, régularisations, avoirs, exports
    FEC et archives documentaires. Les obligations de facturation électronique s'appliquent selon la
    catégorie de l'entité et les modalités fiscales effectives.
11. **Espace client** : quatre valeurs séparées : estimé, confirmé, payable, versé.
    Date prévisionnelle clairement identifiée, détail des relevés, déductions, réserves,
    banque masquée, références de virement, justificatifs exportables.
12. **Cockpit administrateur** : ON/OFF des reversements, capacité de gel par client,
    file de litiges, alertes anomalies, double validation des exceptions, limite de trésorerie,
    journal d'audit non réinscriptible et bilan de fin de période.
13. **Reprise sur incident** : consommation webhook signée et dédoublonnée,
    détection des événements hors ordre, réconciliation API quotidienne, corrections comptables
    compensatoires, aucun paiement lancé deux fois lors des réessais.

## Actions intelligentes mais bornées

Automatiser les rapprochements, les signalements de décalage, le rapprochement des justificatifs,
la préparation des batches et le suivi des incidents. L'analyse statistique/IA peut prioriser
les anomalies ; **elle ne décide jamais seule des montants et ne déclenche pas les virements**.
Seules les règles contractuelles déterministes et la conformité autorisée peuvent le faire.

## Conditions non remplies / interdictions de production

- Statut juridique encaissement pour compte de tiers et éventuel PSP : revue avocat/ACPR.
- Qualification principal/mandataire, TVA, plan comptable et document de règlement : expert-comptable.
- Source de fonds opérateur vérifiée ; réel stock de numéros et opérateurs encore absents de Neon.
- Contrat de financement Stripe Connect externe ou autre PSP SEPA effectivement habilité.
- Bénéficiaires vérifiés, signatures contractuelles, consentements, mandats, banque, seuils de risques.
- Tests de bout en bout avec faux fonds/faux CDR puis premiers reversements contrôlés,
  autorisés uniquement après le GO explicite du propriétaire.

**Invariant : pas d'argent réel transféré avant acceptation réglementaire, preuve des fonds,
solde vérifié, contrat valide et levée du verrou commercial.**
