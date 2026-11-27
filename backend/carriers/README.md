# Carrier adapters

Le cœur PGI Telecom ne contient aucune logique spécifique à un opérateur.

Chaque opérateur est branché par un **adaptateur versionné** qui décrit uniquement :

- ses capacités ;
- son transport SIP ;
- son format DNIS/CLI/DTMF ;
- le mapping de ses CDR vers le modèle PGI ;
- le mapping de ses relevés de règlement.

## Invariants

Un adaptateur ne doit jamais modifier :

- le modèle d'appel PGI ;
- les KPI du dashboard ;
- la logique de présence expert ;
- la structure des API publiques internes ;
- l'historique des anciens opérateurs.

Les données sont normalisées avant d'entrer dans le cœur.

## Canonical model

Tous les opérateurs doivent converger vers les mêmes champs PGI, notamment :

- external_call_id
- started_at
- ended_at
- conversation_seconds
- payout_eligible_seconds
- expected_payout_ht
- confirmed_payout_ht
- paid_payout_ht
- reconciliation_status

## Secrets

Un profil peut contenir `secretRef`, mais jamais la valeur du secret.

Les valeurs réelles sont injectées depuis GitHub Secrets / le gestionnaire de secrets du serveur.

## Ajout d'un nouvel opérateur

1. Copier `config/carriers/_template.json`.
2. Créer un nouvel `adapterKey`.
3. Remplir capacités et mappings.
4. Valider le profil.
5. Créer les connexions dans la base.
6. Tester SIP/CDR/règlements sans activer la route.
7. Passer la connexion en `ready`.
8. Exécuter le plan de bascule.
9. Garder l'ancien opérateur en standby pendant la fenêtre de rollback.

Aucun changement du dashboard n'est requis.


## Moteurs réutilisables d'indépendance, en mode préparation

- `cdr-normalizer.mjs` : `previewCarrierCdrBatch` convertit un relevé de n'importe quel opérateur décrivant ses champs dans `cdr.fields` vers une structure CDR neutre. Le DNIS 089 doit être présent et appartenir à la liste de numéros autorisés. L'identité de l'appelant, les coordonnées bancaires et les champs arbitraires sont exclus. Un doublon ou un numéro hors périmètre rejette le lot entier. La liste autorisée doit être obtenue par une requête authentifiée et limitée à l'éditeur concerné ; le module ne certifie pas lui-même cette permission.
- `switch-readiness.mjs` : `prepareCarrierSwitchPreview` prépare l'inventaire des capacités et des preuves indépendantes nécessaires pour remplacer un collecteur. Le même numéro, l'identifiant client, le routage métier et les données historiques demeurent notre source de vérité. La disponibilité d'une capacité déclarée par un candidat n'autorise jamais le portage, le changement de route ou un versement.
- `config/carriers/_template.json` documente désormais le champ DNIS dans le mapping des relevés d'appels : `called_dnis` vers `called_number`. Aucun vrai identifiant opérateur ni secret n'est stocké dans ce modèle.

Ces fonctions sont des composants de préparation **sans endpoint public, sans import SQL, sans connexion SIP et sans activation d'opérateur**. Un raccordement en production requiert séparément des preuves Arcep, des contrats réseau/SVA, un cadre conforme de paiement, des droits client vérifiés et une procédure de bascule et de reprise réellement exercée.

### Ordre d'intégration

1. Vérifier le schéma et le contrat d'un fournisseur, sans l'activer.
2. Préparer ses mappings de CDR et de règlement, avec des exemples **anonymisés** et des numéros 089 appartenant au bon éditeur.
3. Produire une prévisualisation et relever toutes les conditions non prouvées.
4. Faire valider l'interconnexion, la portabilité, le règlement et la sécurité indépendamment du code.
5. Autoriser éventuellement une modification de configuration par un circuit distinct, authentifié et audité. Aucune méthode de préparation ne doit être réutilisée directement comme commande de production.

## Continuité de la téléphonie SIP sous contrôle Audiotel

Le moteur pur `sip-continuity-preview.mjs` prépare la décision de continuité des appels sans dépendre du tableau de bord d'un opérateur.

- Préfère conserver la route primaire lorsque son état observé est sain.
- En cas de défaillance signalée, propose d'abord une route SIP secondaire chez le même collecteur, puis une route auprès d'un autre collecteur si celle-ci est déclarée disponible.
- Ne fabrique jamais de secours si toutes les routes sont indisponibles ou inconnues.
- Rejette les routes incohérentes, doublons et numéros 089 hors du périmètre fourni.
- **N'effectue aucune bascule** : pas de commande SIP, d'écriture dans Neon, de portabilité, de transfert d'argent ou de modification de la production.

Le moteur reçoit des instantanés de santé et une liste de numéros qui doivent provenir, dans une intégration future, de contrôles authentifiés et cloisonnés par client. Il ne les authentifie pas lui-même. Une route secondaire SIP chez le même opérateur ne suffit pas si son réseau public de collecte 089 est tombé. Une bascule vers un autre opérateur nécessite ses propres contrats, la disponibilité effective du 089, les procédures de portage et les accords de règlement. Le statut de cette proposition ne vaut jamais validation réglementaire ni disponibilité nationale.

Une évolution opérationnelle exigera une orchestration distincte et autorisée, avec contrôles de santé multi-sources, mécanismes antifraude, journal d'audit, confirmation de l'acheminement réel et procédures de retour arrière.

## Archives CDR portables, sans complexité supplémentaire

`portable-cdr-archive.mjs` fournit seulement deux fonctions :
`createPortableCdrArchive(previewCarrierCdrBatch(...))` produit un objet JSON indépendant du fournisseur ; `verifyPortableCdrArchive(JSON.stringify(archive))` contrôle format, compte, doublons et empreinte SHA-256 avant toute éventuelle réutilisation. Aucune bibliothèque externe, abonnement, formulaire ou action opérateur supplémentaire.

L'archive conserve uniquement les huit champs CDR autorisés ; les colonnes arbitraires, l'identité de l'appelant et les informations bancaires ne sont jamais reprises. Le module ne lit ni n'écrit de fichiers, ni base de données, ni réseau. L'intégration de sauvegarde/restauration et le contrôle des accès restent à réaliser séparément si autorisés.

Attention : **l'empreinte détecte les modifications accidentelles, pas l'identité de l'expéditeur** ; un tiers malveillant peut recalculer une empreinte. Garder une copie indépendante de confiance du hash, et prévoir signature/authentification et droits par client avant un usage de preuve ou une importation financière. Les archives ne commandent ni routage, ni portabilité, ni paiement.
