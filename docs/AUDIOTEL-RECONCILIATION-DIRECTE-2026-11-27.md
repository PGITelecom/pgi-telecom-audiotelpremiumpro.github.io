# Audiotel Premium Pro | Encaissement direct, contrôle financier autonome

Version 27 novembre 2026. **Préparation isolée. Aucun déploiement, aucun encaissement ni virement activé.**

## Objectif

Construire un moteur interne pour contrôler les revenus SVA 089 sur une tranche **directement attribuée par l'Arcep seulement si la demande aboutit**, indépendamment du logiciel commercial des opérateurs. Il complète les modules existants ; il ne remplace ni le réseau national ni les accords de collecte.

Le moteur \`backend/src/audiotel-direct-cash-control.mjs\`, réservé à l'unité analytique \`audiotel_platform\`, ne modifie pas les modules existants de l'unité distincte \`direct_sva\` (PGI Telecom Distribution). Il peut être exécuté hors ligne sur des relevés neutralisés. Aucune API publique, aucun accès Neon, aucun changement de site, d'e-mail ou de Stripe.

## Deux montages financiers distincts

| Mode | Recette sur l'IBAN Audiotel | Sommes dues aux éditeurs | Décision |
| --- | --- | --- | --- |
| \`collector_split\` | Commission contractuelle d'Audiotel | Payées séparément par le collecteur dans un cadre légal vérifié | Premier choix à étudier, sans prétendre qu'il est déjà accepté |
| \`company_clearing\` | Commission + fonds destinés aux éditeurs | Devraient ensuite être redistribués | **Bloqué juridiquement** : l'encaissement pour compte de tiers peut exiger un statut ou un prestataire agréé et la sauvegarde des fonds |

Pour les abonnements propres d'Audiotel (ex. portail 4,90 € TTC/mois), les encaissements sont distincts du circuit SVA : conserver Stripe Billing ou un autre moyen de paiement contractuellement et juridiquement adapté. Aucun moteur de calcul ne peut se substituer aux cartes bancaires, aux réseaux télécoms ou aux banques.

## Fonctions développées

- Contrôle déterministe en centimes EUR : produit brut déclaré = frais opérateur + corrections + commission Audiotel + part éditeur.
- Détection des doublons d'appels, écritures bancaires et paiements annoncés par le collecteur.
- Rapprochement **théorique** des recettes attendues sur le compte Audiotel, des écritures bancaires annoncées et des paiements éditeurs rapportés.
- Affectation par éditeur, empreinte SHA-256 indépendante de l'ordre des relevés pour préparer une éventuelle idempotence.
- Absence d'IBAN, d'identité de l'appelant, de numéro personnel ou de donnée bancaire sensible dans les sorties.
- Invariants bloquants : aucune preuve de fonds « vérifiés » à partir d'une simple saisie ; aucun droit d'encaisser des fonds tiers présumé ; aucun virement, aucune comptabilisation statutaire, aucun transfert PSP.

Les contrôles de source, de signatures, d'accès par éditeur, de contrat et de fiscalité restent à raccorder plus tard à des connecteurs authentifiés et à des politiques validées. Les calculs peuvent signaler une incohérence, mais ne permettent pas de déclarer le service en exploitation.

## Enchaînement réel après autorisations futures

1. Obtenir l'attribution réelle des numéros, les éventuels préfixes de routage et les accords d'accès national SVA. Anticiper la date réglementaire du **1er juillet 2028**.
2. Recevoir les CDR et relevés originaux depuis une liaison authentifiée. Contrôler leur signature/traçabilité hors du moteur pur.
3. Rapprocher les montants contractuels et les règlements du collecteur avec le flux bancaire authentifié en lecture seule.
4. Si \`collector_split\` est retenu, récupérer la preuve que le collecteur a payé chaque éditeur et Audiotel séparément. Éviter de toucher aux fonds de tiers.
5. Pour \`company_clearing\`, ne jamais ingérer ni redistribuer de fonds de tiers avant une validation juridique/ACPR, bancaire, comptable, contractuelle et opérationnelle indépendante.
6. Prévoir tenue de comptes conforme, contrôle anti-fraude, restitution, gestion des litiges et réversibilité. Le net personnel n'est pas déduit de la commission brute.

## Définitions critiques

- **Livré** : paiement bancaire arrivé et contrôlé auprès d'une source bancaire authentifiée ; une écriture déclarative ne suffit jamais.
- **Commission Audiotel** : rémunération prévue au contrat, pas un « bénéfice net » personnel.
- **Payer soi-même** : peut exiger une habilitation de services de paiement ; une instruction SEPA API ne rend pas licite une activité de transfert pour compte de tiers.
- **Indépendance** : contrôle du code, des prix, des CDR, des créances, du cockpit et des exports ; maintien des seules dépendances imposées par le réseau et la réglementation.

Références : \`docs/AUDIOTEL-AUTONOMIE-PILOTABLE-REVERSIBLE-2026-11-27.md\`, \`docs/DEPENDENCY-MINIMIZATION.md\`, \`backend/src/audiotel-platform-economics.mjs\` et la fiche officielle Arcep : https://www.arcep.fr/mes-demarches-et-services/acteurs-regules/operateurs-telecoms/fiches-pratiques/operateurs-telecoms-affectation-des-numeros-de-telephone.html.
