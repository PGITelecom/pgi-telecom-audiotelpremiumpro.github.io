# Audiotel Premium Pro : factures et relevés mensuels, audit et préparation de mise en production

Date du contrôle : 13 novembre 2026. Branche de préparation : `prep/facturation-releves-client-20261113`.
**Aucun déploiement, aucune fusion, aucune modification de la base Neon ni mouvement bancaire autorisé par ce document.**

## Constat réel (lecture des connexions projet)

- Déploiement Vercel de production lié à `main` : READY au contrôle, ce qui **ne démontre pas** la conformité métier ni l'ouverture SVA.
- Base Neon : 2 tenants clients, 0 abonnement, 0 événement de facturation, 0 cycle de facturation, 0 reversement et 0 connexion opérateur active au contrôle.
- Verrou commercial direct SVA : `false`, activation des numéros : `false`, reversements : `false`, mode : préparation.
- Intégrations direct SVA « network », « payment_psp », « statutory_accounting », « hubspot », « ga4 », « gsc » : planifiées et désactivées.
- Variables de production déclarées `PGI_EXTERNAL_BILLING_ENABLED=true` et `PGI_STRIPE_LIVE_MODE=true`. Cela ne démontre **ni** la livraison de webhooks signés, **ni** le paramétrage fiscal du bon compte, **ni** l'existence de factures.
- Les workers d'alertes, relances d'impayés et files de tâches existent mais ne constituent pas une preuve d'automatisation opérateur SVA.

## Préparation ajoutée dans cette branche

1. Nouveau backend `customer-financial-documents.mjs` : agrégation d'écritures SVA réelles par période et devise ; PDF A4 marqué « relevé non fiscal », logo officiel du dépôt, nom client, références, montants, dates d'échéance, dates de règlement inscrites, statut et notes de prudence.
2. Nouveau accès client en lecture seule `GET /api/v1/customer/finance/documents` : factures de l'abonnement obtenues directement depuis l'API Stripe pour le `customer` lié dans la base, sans factures inventées ni paiement déclenché.
3. Nouveau accès `GET /api/v1/customer/finance/statements/YYYY-MM.pdf?currency=EUR` : génération à la demande du relevé SVA à partir du registre *propre au tenant authentifié*, permission `finance.read` obligatoire.
4. Centre « Mes factures et relevés mensuels » affiché dans l'espace client existant, avec factures officielles Stripe et téléchargements PDF SVA, sans création de faux documents en absence de données.
5. Restriction HTTPS des destinations PDF Stripe, pas de données inter-clients ni cache public pour le relevé PDF, pas de cumul entre devises.
6. Tests unitaires automatiques couvrant groupement, litiges, devises, PDF/logo et domaines HTTPS autorisés.

## Points de vérité et limites

**Les factures fiscales sont exclusivement celles générées et émises par Stripe ou une solution de facturation légalement habilitée.** Le relevé SVA est un justificatif de suivi distinct, non une facture et non un avis de crédit bancaire. On ne déduit pas l'encaissement de fonds SVA d'un événement de paiement Stripe.

La production des relevés PDF est à la demande à partir des écritures existantes. **Il n'y a pas encore d'archive mensuelle figée avec horodatage et empreinte immuable**, ni d'envoi e-mail automatique de ce relevé. Cela devra être ajouté lorsque l'alimentation opérateur et la politique de validation seront établies.

La qualité des statuts `paid` du registre dépend de sa chaîne de rapprochement. Tant que le contrat et les confirmations bancaires/opérateurs ne sont pas disponibles, le PDF précise que l'inscription du règlement n'est pas une preuve de réception des fonds sur l'IBAN.

L'exigence commerciale du propriétaire est un **reversement direct de l'opérateur SVA vers l'IBAN de chaque professionnel**, et une rémunération séparée d'Audiotel Premium Pro. La préparation documentaire ne modifie aucun circuit financier et ne préjuge pas de l'accord de l'opérateur.

## Déclencheurs automatiques à exiger avant ouverture

- Souscription : Stripe Checkout, essai gratuit jusqu'à fin du mois en heure de Paris, prélèvement mensuel 4,90 € TTC seulement ensuite, webhook signé, idempotence, relances et résiliation sans engagement.
- Facturation : factures Stripe émises/finalisées, numérotation et identité de l'émetteur vérifiées ; consultation dans l'espace client et notification conforme aux consentements.
- Opérateur : import CDR/relevé par API/SFTP authentifié, horodatage de la source, validation de barème, déduplication, allocation exacte des montants par professionnel et numéro.
- Reversements directs : fichier/API opérateur ou PSP habilité, IBAN validé sous mandat, preuve de transfert, contrôle de rejet, dates de règlement et litiges. Aucun virement initié par le cockpit Audiotel sans base juridique et mandat.
- Documents SVA : clôture mensuelle après vérification, archive immutable et versionnée, vérification d'intégrité, contrôle des exceptions, possibilité de téléchargement et traçabilité.
- Résilience : reprise idempotente, rapprochement opérateur/banque, alerte incident, surveillance des paiements échoués, sauvegardes chiffrées, restauration prouvée et séparation stricte des tenants.
- Fiscalité : personne morale, SIREN/SIRET, adresse, TVA ou franchise en base, régime, mentions de facture, qualification des commissions, export comptable et gestion des avoirs à valider. **Ne jamais inventer un taux de TVA, une identité juridique ou un numéro de facture.**
- Conformité : la réception électronique s'applique depuis le 1er septembre 2026 aux entreprises assujetties; l'émission obligatoire des PME/TPE entre en vigueur le 1er septembre 2027. Un PDF ordinaire ne constitue pas la facture électronique structurée réglementaire. Prévoir la plateforme agréée et le raccordement comptable.

## Vérification de la marque sur la facture officielle Stripe

Le logo officiel du dépôt est intégré au relevé SVA. En revanche, **une facture PDF émise par Stripe affichera le logo seulement si la charte de marque de l'émetteur est configurée sur le bon compte Stripe**, et après vérification du rendu et des mentions fiscales réelles. Ne pas ajouter un second PDF maison présenté comme une facture : cela créerait une divergence de numérotation et de TVA.

## Conditions de décision

Aucun document réel ne peut être produit tant que Stripe n'a pas émis de facture et qu'aucun relevé opérateur n'a alimenté les écritures. Les écrans et la compilation ne remplacent pas les preuves de facturation/finances en production. La mise en service doit rester explicitement décidée par le propriétaire après validation des données légales, du contrat opérateur et de la conformité des paiements.

## Références officielles

- Mentions obligatoires d'une facture (mise à jour août 2026) : https://entreprendre.service-public.gouv.fr/vosdroits/F31808
- Calendrier facturation électronique : https://www.impots.gouv.fr/professionnel/questions/partir-de-quand-suis-je-concerne-par-la-reforme-de-la-facturation
- Interopérabilité plateformes agréées et réforme : https://www.impots.gouv.fr/professionnel/questions/dans-le-cadre-de-la-reforme-de-la-facturation-electronique-comment-devrais
- Stripe Billing (API invoice & customer portal) : https://docs.stripe.com/billing/invoices
